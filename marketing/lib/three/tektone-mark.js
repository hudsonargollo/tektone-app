// Tektone · Mineral T — three structural layers: architrave, pillar, foundation.
// Proportions traced from the flat mark (architrave width = 0.600 m base unit).
import * as THREE from 'three';

const MAT = {
  black: new THREE.MeshStandardMaterial({ name: 'mineral_black', color: '#141618', roughness: 0.62, metalness: 0.12 }),
  green: new THREE.MeshStandardMaterial({ name: 'mineral_green', color: '#2E4A43', roughness: 0.5, metalness: 0.18 }),
  sand:  new THREE.MeshStandardMaterial({ name: 'mineral_sand',  color: '#C7B79C', roughness: 0.68, metalness: 0.06 }),
  grey:  new THREE.MeshStandardMaterial({ name: 'mineral_grey',  color: '#A1AEAA', roughness: 0.55, metalness: 0.14 }),
  ivory: new THREE.MeshStandardMaterial({ name: 'ivory_clay',    color: '#EFE8DC', roughness: 0.74, metalness: 0.04 })
};

export const MARK_HEIGHT = 0.566;

// A box with a small chamfer on its face outlines, so edges catch the key light.
function slab(w, h, d, bevel = 0.004) {
  const b = Math.min(bevel, w / 4, h / 4, d / 4);
  const x = w / 2 - b, y = h / 2 - b;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y); shape.lineTo(x, -y); shape.lineTo(x, y); shape.lineTo(-x, y); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(d - 2 * b, 0.001), bevelEnabled: true,
    bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1
  });
  g.center();
  return g;
}

// One extruded piece from an outline in the mark's own XY plane, bevelled on
// every border. `frontZ` is where the front face lands. Points may carry a
// third value: a corner radius, filleted with a quadratic curve.
function profile(name, mat, pts, depth, frontZ, bevel = 0.003) {
  const b = Math.min(bevel, depth / 4);
  const shape = new THREE.Shape();
  const n = pts.length;
  const at = i => pts[(i + n) % n];
  const trim = (from, to, r) => {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(r, len / 2) / len;
    return [from[0] + dx * k, from[1] + dy * k];
  };
  for (let i = 0; i < n; i++) {
    const p = at(i), r = p[2] || 0;
    if (!r) {
      i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]);
      continue;
    }
    const a = trim(p, at(i - 1), r), c = trim(p, at(i + 1), r);
    i ? shape.lineTo(a[0], a[1]) : shape.moveTo(a[0], a[1]);
    shape.quadraticCurveTo(p[0], p[1], c[0], c[1]);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * b, 0.001), bevelEnabled: true,
    bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 4
  });
  g.translate(0, 0, frontZ - depth + b);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function part(name, mat, w, h, d, x, y, z = 0, bevel) {
  const m = new THREE.Mesh(slab(w, h, d, bevel), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildMark() {
  const g = new THREE.Group();
  g.name = 'tektone_mineral_t';

  const D = 0.150;                 // depth of the mark's main body

  // iii. Foundation — four strata in progressive descent, stacked flush and all
  // sharing the mark's depth and centre plane: sand plinth, stone slab,
  // tectonic horizon line, echo.
  const strata = [
    { name: 'foundation_echo',    mat: MAT.sand,  w: 0.343, h: 0.0024 },
    { name: 'foundation_horizon', mat: MAT.black, w: 0.463, h: 0.0073 },
    { name: 'foundation_stone',   mat: MAT.black, w: 0.340, h: 0.0233 },
    { name: 'foundation_sand',    mat: MAT.sand,  w: 0.275, h: 0.0306 }
  ];
  let y = 0;
  for (const s of strata) {
    g.add(part(s.name, s.mat, s.w, s.h, D, 0, y + s.h / 2, 0, Math.min(0.002, s.h / 3)));
    y += s.h;
  }
  const baseTop = y;                                  // ≈ 0.0819

  // ii. Pillar — green mineral shell, black core front and back, one sand flute
  const pillarW = 0.1286, pillarH = 0.337;
  const pillarY = baseTop + pillarH / 2;
  const face = 0.0005;                       // half-mm relief only — no coplanar faces
  const shaftD = D - face * 2;               // set in from BOTH frame faces
  // The shaft runs up past the architrave's bottom rail so its top edge (and
  // bevel) is buried inside the stone panel — no seam line at the junction.
  const shaftUp = 0.022;
  g.add(part('pillar_shaft', MAT.black, pillarW, pillarH + shaftUp, shaftD,
    0, pillarY + shaftUp / 2, 0, 0.002));
  // Two mineral-green inlines just inside the shaft's edges, sitting all but
  // flush with its face.
  const inlineW = 0.0138, inlineX = pillarW / 2 - 0.006 - inlineW / 2, inlineD = D * 0.55;
  for (const s of [-1, 1]) {
    g.add(part(s < 0 ? 'pillar_inline_left' : 'pillar_inline_right', MAT.green,
      inlineW, pillarH, inlineD, s * inlineX, pillarY, D / 2 - inlineD / 2, 0.0005));
  }
  // The single sand-grey flute, a silent Doric reference, on the centre axis.
  const fluteD = D * 0.5;
  g.add(part('pillar_flute', MAT.grey, 0.006, pillarH * 0.87, fluteD,
    0, pillarY + 0.004, D / 2 - fluteD / 2, 0.0005));

  // i. Architrave — a sand frame of real depth with the stone panel recessed
  // behind it. The bottom rail stops at the pillar: the stone runs down into
  // the shaft, with a sand tab standing at each side of the junction.
  const archW = 0.600, archH = 0.147, frame = 0.0171;
  const archY = baseTop + pillarH + archH / 2;
  const inner = archW - frame * 2;
  const tab = frame;
  const A = archW / 2, xi = inner / 2, xp = pillarW / 2, xt = xp - 0.001 + tab;
  const yBot = archY - archH / 2, yTopEdge = archY + archH / 2;
  const yB = yBot + frame, yT = yTopEdge - frame, yt = yB + tab;
  const R = 0.0042, r2 = 0.0026;
  // The whole frame is ONE milled piece: outer rectangle, opening cut down to
  // the bottom edge where the pillar passes, every inner corner filleted alike
  // (top and bottom read the same).
  g.add(profile('architrave_frame', MAT.sand, [
    [-A, yBot], [-xp, yBot], [-xp, yt, r2], [-xt, yt, r2], [-xt, yB, r2],
    [-xi, yB, R], [-xi, yT, R], [xi, yT, R], [xi, yB, R],
    [xt, yB, r2], [xt, yt, r2], [xp, yt, r2], [xp, yBot],
    [A, yBot], [A, yTopEdge], [-A, yTopEdge]
  ], D, D / 2, 0.0018));

  // Junction: the frame's inner face meets the shaft with no reveal line.

  // The stone panel and the tongue that runs down into the shaft are ONE
  // extruded piece — a single outline, so no seam or step crosses the mark —
  // bevelled all round to keep the silhouette from reading choppy.
  const recess = face;                        // same plane as the shaft's face
  const yTongue = yBot - 0.004;               // laps into the shaft
  g.add(profile('architrave_stone', MAT.black, [
    [-xi, yT], [xi, yT], [xi, yB], [xp, yB],
    [xp, yTongue], [-xp, yTongue], [-xp, yB], [-xi, yB]
  ], D - recess * 2, D / 2 - recess, 0.0032));

  return g;
}

