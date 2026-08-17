/**
 * Server-side compositing for the AI Instagram Post Generator — replaces
 * SocialPostGenerator.jsx's client-side <canvas> post-processing step (see
 * that file's now-removed useEffect) so both web and mobile just display a
 * single pre-composited static PNG instead of duplicating canvas logic in
 * React Native. Runs in the Worker via @cf-wasm/photon (Rust/WASM image
 * processing built specifically for the Workers runtime — no native
 * bindings, no DOM/canvas APIs needed).
 *
 * IMPORTANT — never composite onto an already-composited image: every call
 * here must be given the PRISTINE raw SDXL output (see socialPostService.js,
 * which stores it separately at `social/{id}-raw.png`), or the translucent
 * caption band and watermark would stack on top of themselves on every
 * reroll/edit. This module is pure — it takes raw bytes in, returns
 * composited bytes out, and touches no storage itself.
 *
 * Caveats worth knowing (disclosed, not hidden):
 * - Photon's draw_text_with_color has no text-metrics API, so line-wrapping
 *   and horizontal centering use an average-glyph-width estimate instead of
 *   real measurement (web's canvas wrapText uses ctx.measureText, which
 *   Photon can't offer). Captions are short by product design (<=90 chars,
 *   enforced client-side), so the approximation error stays small, but it
 *   won't be pixel-identical to web's old canvas rendering.
 * - Photon's bundled font is not EB Garamond (the brand's caption typeface
 *   on web) — it's whatever default font ships in the photon-rs WASM
 *   binary. Visual fidelity to web's serif caption styling is approximate,
 *   not exact.
 * - This WASM library has never run in this Worker before this change —
 *   verified only via `wrangler pages functions build` (bundles cleanly)
 *   and static review of its documented API, NOT via a live request in a
 *   real Workers runtime. Recommend a staging/dev smoke test before
 *   trusting this in production.
 */
import { PhotonImage, resize, crop, watermark, draw_text_with_color, SamplingFilter, Rgba } from "@cf-wasm/photon/workerd";

// Same 3-layer rect geometry as src/components/LogoMark.jsx / the inline
// MARK_SVG in SocialPostGenerator.jsx, rasterized directly to a raw RGBA
// pixel buffer instead of shipping a static PNG asset or an SVG-to-raster
// dependency — the mark is just axis-aligned rectangles, cheap to fill by
// hand.
const MARK_VIEWBOX_W = 100;
const MARK_VIEWBOX_H = 116;
const MARK_RECTS = [
  [15, 18, 70, 22, "#C7B79C"],
  [18, 21, 64, 16, "#141618"],
  [42, 37, 16, 58, "#2E4A43"],
  [45, 37, 10, 56, "#141618"],
  [49.2, 41, 1.6, 46, "#C7B79C"],
  [38, 95, 24, 5, "#C7B79C"],
  [33, 100, 34, 4, "#141618"],
  [26, 106.5, 48, 1.8, "#141618"],
  [21, 110.5, 58, 1.2, "#C7B79C"],
];

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rasterizeMark(targetW) {
  const scale = targetW / MARK_VIEWBOX_W;
  const targetH = Math.max(1, Math.round(MARK_VIEWBOX_H * scale));
  const buf = new Uint8Array(targetW * targetH * 4); // zero-filled = fully transparent
  for (const [x, y, w, h, hex] of MARK_RECTS) {
    const [r, g, b] = hexToRgb(hex);
    const x0 = Math.max(0, Math.round(x * scale));
    const y0 = Math.max(0, Math.round(y * scale));
    const x1 = Math.min(targetW, Math.round((x + w) * scale));
    const y1 = Math.min(targetH, Math.round((y + h) * scale));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * targetW + px) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }
  }
  return new PhotonImage(buf, targetW, targetH);
}

function bandOverlay(w, bandH) {
  // rgba(20,22,24,0.55) — matches web's translucent caption band.
  const buf = new Uint8Array(w * bandH * 4);
  for (let i = 0; i < w * bandH; i++) {
    const o = i * 4;
    buf[o] = 20;
    buf[o + 1] = 22;
    buf[o + 2] = 24;
    buf[o + 3] = 140;
  }
  return new PhotonImage(buf, w, bandH);
}

// No text-measurement API on Photon (see module docstring) — approximate
// with an average-glyph-width heuristic. Good enough for short captions.
function wrapLines(text, maxWidth, fontSize) {
  const avgCharW = fontSize * 0.55;
  const maxChars = Math.max(4, Math.floor(maxWidth / avgCharW));
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {Uint8Array} rawImageBytes - pristine SDXL output, never a
 *   previously-composited image.
 * @param {{width:number, height:number, caption?:string|null, watermarkOn?:boolean}} opts
 * @returns {Promise<Uint8Array>} composited PNG bytes
 */
export async function compositePost(rawImageBytes, { width, height, caption, watermarkOn = true }) {
  let img = PhotonImage.new_from_byteslice(rawImageBytes);

  // object-cover fit: scale up to cover target box, then center-crop.
  const scale = Math.max(width / img.get_width(), height / img.get_height());
  const rw = Math.max(1, Math.round(img.get_width() * scale));
  const rh = Math.max(1, Math.round(img.get_height() * scale));
  const resized = resize(img, rw, rh, SamplingFilter.Lanczos3);
  img.free();
  const x0 = Math.round((rw - width) / 2);
  const y0 = Math.round((rh - height) / 2);
  img = crop(resized, x0, y0, x0 + width, y0 + height);
  resized.free();

  const trimmedCaption = (caption || "").trim();
  if (trimmedCaption) {
    const bandH = Math.round(height * 0.16);
    const band = bandOverlay(width, bandH);
    watermark(img, band, 0n, BigInt(height - bandH));
    band.free();

    const fontSize = Math.round(width * 0.032);
    const lineHeight = Math.round(width * 0.04);
    const lines = wrapLines(trimmedCaption, width * 0.86, fontSize);
    const startY = height - bandH / 2 - ((lines.length - 1) * lineHeight) / 2 - fontSize / 2;
    const color = new Rgba(239, 232, 220, 255); // #EFE8DC
    lines.forEach((line, i) => {
      const approxW = line.length * fontSize * 0.55;
      const x = Math.max(0, Math.round((width - approxW) / 2));
      draw_text_with_color(img, line, x, Math.round(startY + i * lineHeight), fontSize, color);
    });
    color.free();
  }

  if (watermarkOn) {
    const markSize = Math.round(width * 0.09);
    const mark = rasterizeMark(markSize);
    const pad = Math.round(width * 0.035);
    watermark(img, mark, BigInt(width - markSize - pad), BigInt(height - mark.get_height() - pad));
    mark.free();
  }

  const out = img.get_bytes();
  img.free();
  return out;
}
