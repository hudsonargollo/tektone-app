// Tektone · Autoridade — a minimal Greek stele carrying the video.
// Two plain columns on a stylobate with a single lintel across them, and the
// portrait video filling almost the whole opening between. No pediment, no
// frieze, no ornament: the screen is the subject, the stone only frames it.
// The artifact swings into frame as the section scrolls past.
//
// mountStele(container, { video, scrollTarget }) -> { destroy() }
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(Math.max(v, 0), 1);
const EASE = t => 1 - Math.pow(1 - t, 3);

const STONE = new THREE.MeshStandardMaterial({ name: 'marble_pale', color: '#D8CDBA', roughness: 0.42, metalness: 0.04 });
const STONE_D = new THREE.MeshStandardMaterial({ name: 'marble_shadow', color: '#A2988A', roughness: 0.5, metalness: 0.04 });
const INK = new THREE.MeshStandardMaterial({ name: 'mineral_black', color: '#141618', roughness: 0.35, metalness: 0.18 });
const BRASS = new THREE.MeshStandardMaterial({ name: 'brass', color: '#B2894C', roughness: 0.24, metalness: 0.9 });

function box(name, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A proper Doric capital, in profile: a necking ring, a curved echinus cushion
// that flares out of the shaft, and a square abacus with a chamfered underside.
// BASE_H + CAP_H is the column's fixed overhead above the shaft.
const BASE_H = 0.09;
const ANN_H = 0.054, ECH_H = 0.086, ABA_H = 0.070, ABA_CH = 0.018;
const CAP_H = ANN_H + ECH_H + ABA_H;

// The Doric shaft is fluted: twenty shallow arcs meeting at sharp arrises, with
// a slight entasis so the profile is not a plain cone. Built once per radius.
function flutedShaft(r, h, flutes = 12, cutAbs = 0.016) {
  const pts = [];
  const N = flutes * 8;
  const cut = cutAbs / r;                    // an absolute depth, not a fraction
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = 1 - cut * (0.5 + 0.5 * Math.cos(flutes * a));
    pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
  }
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
    depth: 1, bevelEnabled: false, curveSegments: 1
  });
  // rotateX already lays the extrusion along y = 0..1 — do NOT translate, or the
  // entasis clamp below collapses every vertex to the top and the shaft vanishes.
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(Math.max(p.getY(i), 0), 1);
    // taper to 0.86 at the neck, with a small swell at a third height
    const k = (1 - 0.14 * t) * (1 + 0.018 * Math.sin(Math.PI * t));
    p.setX(i, p.getX(i) * k * r);
    p.setZ(i, p.getZ(i) * k * r);
    p.setY(i, t * h);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, STONE);
  m.name = 'shaft';
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// The echinus: a flaring cushion, tight at the annulets and opening almost to
// the abacus — a cone softened by a curve, not a mushroom cap.
function echinus(r, h) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // slow at the neck, then a strong outward flare near the top
    const rr = r * (1 + 0.62 * Math.pow(t, 1.55));
    pts.push(new THREE.Vector2(rr, t * h));
  }
  const geo = new THREE.LatheGeometry(pts, 48);
  const m = new THREE.Mesh(geo, STONE);
  m.name = 'echinus';
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function column(name, h, r) {
  const g = new THREE.Group();
  g.name = name;
  const base = box('base', STONE_D, r * 2.2, BASE_H, r * 2.2, 0, BASE_H / 2, 0);
  const shaft = flutedShaft(r, h);
  shaft.position.y = BASE_H;

  // Annulets: the three thin rings that separate shaft from echinus. They are
  // what makes a Doric capital read as Doric.
  const neckY = BASE_H + h;
  const neckR = r * 0.86;
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const rh = ANN_H / 3;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(neckR * (1.03 + i * 0.035), neckR * (1.0 + i * 0.035), rh * 0.78, 48),
      i === 1 ? STONE_D : STONE
    );
    ring.name = 'annulet_' + (i + 1);
    ring.position.y = neckY + rh * (i + 0.5);
    rings.push(ring);
  }

  const echR = neckR * 1.07;
  const ech = echinus(echR, ECH_H);
  ech.position.y = neckY + ANN_H;

  // The abacus is a thin plate with a real overhang past the echinus, and a
  // chamfered underside so its edge catches the key light.
  const abaW = echR * 1.62 * 2;
  const chamfer = new THREE.Mesh(
    new THREE.CylinderGeometry(abaW * 0.5, echR * 1.62, ABA_CH, 4), STONE);
  chamfer.name = 'abacus_chamfer';
  chamfer.rotation.y = Math.PI / 4;
  chamfer.position.y = neckY + ANN_H + ECH_H + ABA_CH / 2;
  const abaPlate = ABA_H - ABA_CH;
  const abacus = box('abacus', STONE, abaW, abaPlate, abaW,
    0, neckY + ANN_H + ECH_H + ABA_CH + abaPlate / 2, 0);

  for (const m of [base, shaft, ...rings, chamfer, abacus]) {
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  g.add(ech);
  g.userData.top = BASE_H + h + CAP_H;
  g.userData.abaW = abaW;
  return g;
}

export function mountStele(container, opts = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOBILE = innerWidth < 820 || matchMedia('(pointer: coarse)').matches;
  const scrollTarget = opts.scrollTarget || container;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.4 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  let dist = 5.5, shiftX = 0;
  const CONTACT_W = 3.3;                     // visible ground footprint, see below
  const look = new THREE.Vector3(0, 0, 0);   // set to the object's centre below

  // ---- the artifact ------------------------------------------------------
  const swing = new THREE.Group();          // scroll rotation
  const stele = new THREE.Group();          // the built object
  swing.add(stele);
  scene.add(swing);

  // ---- stylobate: two courses on a dark shadow gap -----------------------
  // The dedication needs two lines of real size, so the base is stepped: a wide
  // lower course carrying the title, a narrower upper course carrying the name.
  // Each face gets one line only — that is what keeps both legible at the scale
  // the section renders at.
  const gapH = 0.06;
  const baseH = 0.20, baseW = 2.86, baseD = 1.20;      // lower course, the title
  const upperH = 0.24, upperW = 2.60, upperD = 1.06;   // upper course, the name
  stele.add(box('shadow_gap', INK, 2.44, gapH, 1.04, 0, gapH / 2, 0));
  const BASE_STONE = new THREE.MeshStandardMaterial({
    name: 'stone_dark_course', color: '#33383B', roughness: 0.62, metalness: 0.05
  });
  stele.add(box('base_course', BASE_STONE, baseW, baseH, baseD, 0, gapH + baseH / 2, 0));
  stele.add(box('stylobate', STONE, upperW, upperH, upperD, 0, gapH + baseH + upperH / 2, 0));
  const top = gapH + baseH + upperH;

  // ---- the dedication, cut into the two stone faces -----------------------
  // A Greek stele carries its inscription on the stone, not on a label beside
  // it. Each line is drawn on a canvas generated at its face's exact aspect —
  // so it can neither spill past the stone nor squash — with a lit upper edge
  // over a shadowed groove, so it reads as an incision rather than printed ink.
  function inscribe(name, text, opts) {
    const { faceW, faceH, faceY, faceZ, weight, family, ratio, track, fill, hi, lo } = opts;
    const plateW = faceW * 0.92, plateH = faceH;
    const W = 3072, H = Math.round(W * plateH / plateW);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const size = Math.round(H * ratio);
    const draw = (colour, dy) => {
      x.fillStyle = colour;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = weight + ' ' + size + 'px ' + family;
      x.letterSpacing = track + 'px';
      x.fillText(text, W / 2 + track / 2, H * 0.54 + dy);
    };
    // A bevel in three passes: a dark edge below, a lit edge above, then the
    // letter's own face between them — the letter reads as chamfered stone
    // rather than flat paint.
    const e = Math.max(Math.round(H * 0.026), 2);
    draw(lo, e);
    draw(hi, -e);
    draw(fill, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateH),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0.02, depthWrite: false }));
    plate.name = name;
    plate.position.set(0, faceY, faceZ + 0.0015);
    plate.receiveShadow = true;
    stele.add(plate);
  }

  inscribe('dedication_name', 'PEDRO SILVESTRINI', {
    faceW: upperW, faceH: upperH, faceY: gapH + baseH + upperH / 2, faceZ: upperD / 2,
    weight: '700', family: 'Inter, system-ui, sans-serif', ratio: 0.66, track: 22,
    fill: 'rgba(48,42,34,0.97)', hi: 'rgba(255,251,242,0.95)', lo: 'rgba(26,22,17,0.55)'
  });
  // the title is cut in the mineral grey, bevelled the same way
  inscribe('dedication_role', 'CEO & FUNDADOR', {
    faceW: baseW, faceH: baseH, faceY: gapH + baseH / 2, faceZ: baseD / 2,
    weight: '500', family: '"JetBrains Mono", ui-monospace, monospace', ratio: 0.52, track: 26,
    fill: 'rgba(184,195,191,0.97)', hi: 'rgba(232,238,235,0.7)', lo: 'rgba(14,17,18,0.7)'
  });

  // ---- video panel: sized first, everything else is built around it -------
  const panelW = 1.90, panelH = panelW * 4 / 3;      // 1.90 × 2.53
  const panelY = top + 0.14 + panelH / 2;
  const rail = 0.014;                                 // one hairline brass edge

  const colR = 0.165, colH = panelY + panelH / 2 + 0.10 - top - (BASE_H + CAP_H);
  const cols = [];
  for (const s of [-1, 1]) {
    const c = column(s < 0 ? 'column_left' : 'column_right', colH, colR);
    // clear of the backing's edge, so it reads as a column carrying the lintel
    c.position.set(s * (panelW / 2 + 0.05 + colR + 0.055), top, 0.06);
    cols.push(c);
    stele.add(c);
  }
  const colTop = top + cols[0].userData.top;

  // the ink field the screen sits in — just deep enough to read as stone
  stele.add(box('backing', INK, panelW + 0.10, panelH + 0.20, 0.16, 0, panelY, -0.09));

  stele.add(box('bezel_top', BRASS, panelW + rail * 2, rail, 0.04, 0, panelY + panelH / 2 + rail / 2, 0.004));
  stele.add(box('bezel_bottom', BRASS, panelW + rail * 2, rail, 0.04, 0, panelY - panelH / 2 - rail / 2, 0.004));
  for (const s of [-1, 1]) {
    stele.add(box(s < 0 ? 'bezel_left' : 'bezel_right', BRASS,
      rail, panelH + rail * 2, 0.04, s * (panelW / 2 + rail / 2), panelY, 0.004));
  }

  const videoMat = new THREE.MeshBasicMaterial({ color: '#141618' });
  if (opts.video) {
    const tex = new THREE.VideoTexture(opts.video);
    tex.colorSpace = THREE.SRGBColorSpace;
    videoMat.map = tex;
    videoMat.color.set('#ffffff');
    // cover-fit whatever aspect the source has into the 3:4 panel
    const fit = () => {
      const va = (opts.video.videoWidth || 3) / (opts.video.videoHeight || 4);
      const pa = panelW / panelH;
      if (va > pa) { tex.repeat.set(pa / va, 1); tex.offset.set((1 - pa / va) / 2, 0); }
      else { tex.repeat.set(1, va / pa); tex.offset.set(0, (1 - va / pa) / 2); }
    };
    opts.video.readyState >= 1 ? fit() : opts.video.addEventListener('loadedmetadata', fit, { once: true });
  }
  videoMat.name = 'video_screen';
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(panelW, panelH), videoMat);
  screen.name = 'video_screen';
  screen.position.set(0, panelY, 0.006);
  stele.add(screen);

  // ---- one lintel across the columns, and nothing above it ---------------
  const archH = 0.15;
  const lintelW = (panelW / 2 + 0.05 + colR + 0.055) * 2 + cols[0].userData.abaW;
  stele.add(box('lintel', STONE, lintelW, archH, 0.38, 0, colTop + archH / 2, 0.01));
  const objTop = colTop + archH;

  // ---- ground contact ----------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), new THREE.ShadowMaterial({ opacity: 0.26, color: '#3A3226' }));
  floor.name = 'shadow_catcher';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // A tight occlusion core at the join plus wider falloffs, so the stylobate
  // reads as resting on the ground rather than hovering over its own shadow.
  const aoTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const contact = new THREE.Group();
  contact.name = 'contact_shadow';
  // The rings fade radially to nothing, so the widest one may exceed the stone
  // without a visible edge — but it still has to fit the frame.
  for (const [w, d, o, y] of [[2.7, 1.15, 0.6, 0.006], [3.4, 1.5, 0.30, 0.004], [3.9, 1.8, 0.12, 0.002]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
      map: aoTex, transparent: true, opacity: o, depthWrite: false, color: '#000000'
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0.05, y, 0.04);
    contact.add(m);
  }
  stele.add(contact);

  // ---- light -------------------------------------------------------------
  const key = new THREE.DirectionalLight('#FFE7BE', 3.0);
  key.position.set(-1.5, 10.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  const sc = key.shadow.camera;
  sc.left = -3.6; sc.right = 3.6; sc.top = 4.6; sc.bottom = -2; sc.near = 1; sc.far = 20;
  key.shadow.bias = -0.0007; key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight('#C9D6CE', 0.9);
  fill.position.set(4.5, 2.0, 3.0);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight('#F3E7D2', '#6B6252', 0.7));
  const warm = new THREE.PointLight('#E0B778', 3.2, 7, 2);
  warm.position.set(0, panelY + 0.4, 1.6);
  scene.add(warm);
  // the screen itself spills light onto the stone around it
  const spill = new THREE.PointLight('#CFE0DA', 1.6, 3.2, 2);
  spill.position.set(0, panelY, 0.5);
  scene.add(spill);

  // a small warm environment so the brass has something to reflect
  (function env() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#FFF4DF'); g.addColorStop(0.5, '#C9BCA5'); g.addColorStop(1, '#4A443C');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const hot = x.createRadialGradient(70, 34, 2, 70, 34, 60);
    hot.addColorStop(0, '#FFFFFF'); hot.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = hot; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.mapping = THREE.EquirectangularReflectionMapping;
    const p = new THREE.PMREMGenerator(renderer);
    scene.environment = p.fromEquirectangular(t).texture;
    scene.environmentIntensity = 0.7;
    BRASS.envMapIntensity = 1.9;
    INK.envMapIntensity = 0.5;
    p.dispose(); t.dispose();
  })();

  // ---- motion ------------------------------------------------------------
  const centreY = objTop / 2;
  look.set(0, centreY, 0);
  let tp = 0, p = 0, tmx = 0, tmy = 0, mx = 0, my = 0;
  function onScroll() {
    const r = scrollTarget.getBoundingClientRect();
    // 0 as the section enters from below, 1 once it has passed above
    tp = clamp01((innerHeight - r.top) / (r.height + innerHeight));
  }
  function onMove(e) {
    const r = container.getBoundingClientRect();
    tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    tmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  addEventListener('scroll', onScroll, { passive: true });
  if (!reduced && !MOBILE) addEventListener('pointermove', onMove, { passive: true });
  onScroll();

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Frame the object AND the ground shadow it throws. The shadow's reach is
    // the top of the lintel projected along the light direction; the widest
    // contact-shadow ring adds to that. Aim at the centre of the whole box, so
    // neither the stone nor its shadow can be clipped by the canvas edge.
    const L = key.position;
    const reachX = objTop * (-L.x) / L.y;                 // + is screen-right
    const halfW = Math.max(lintelW / 2, CONTACT_W / 2);
    const xMin = Math.min(-halfW, -halfW + reachX);
    const xMax = Math.max(halfW, halfW + reachX);
    const objW = xMax - xMin;
    const objH = objTop * 1.02;
    const pad = camera.aspect < 0.9 ? 1.01 : 1.0;
    const tan = Math.tan((camera.fov * Math.PI / 180) / 2);
    dist = Math.max((objH * pad / 2) / tan, (objW * pad / 2) / tan / camera.aspect);
    shiftX = (xMin + xMax) / 2;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = clock.getDelta();
    p = lerp(p, tp, Math.min(dt * 2.4, 1));       // smoother settle, matches the hero
    mx = lerp(mx, tmx, Math.min(dt * 2.4, 1));
    my = lerp(my, tmy, Math.min(dt * 2.4, 1));

    // -1 below frame, 0 face-on at centre, +1 turned away above
    const t = (p - 0.5) * 2;
    const settle = 1 - Math.abs(t);
    // on a phone the swing is gentler: less lateral travel, less yaw
    const amp = MOBILE ? 0.55 : 1;
    swing.rotation.y = t * 0.40 * amp + mx * 0.07;
    swing.rotation.x = -t * 0.08 * amp + my * 0.03;
    swing.position.y = -t * 0.20 * amp;
    swing.position.x = t * 0.26 * amp;
    swing.position.z = -Math.abs(t) * 0.65 * amp;
    warm.intensity = 1.6 + settle * 2.2;
    key.intensity = 2.4 + settle * 0.9;

    camera.position.set(shiftX, centreY + my * 0.10, dist);
    look.set(shiftX, centreY, 0);
    camera.lookAt(look);
    renderer.render(scene, camera);
  }
  frame();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('pointermove', onMove);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
