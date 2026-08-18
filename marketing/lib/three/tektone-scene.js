// Tektone · hero scene — a colonnade of stone, golden light and the Mineral T.
// mountScene(container, opts) -> { destroy() }
import * as THREE from 'three';
import { buildMark, MARK_HEIGHT } from './tektone-mark.js';

const EASE = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(Math.max(v, 0), 1);

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
  // soften the side edges so the beam has no hard boundary
  const s = x.createLinearGradient(0, 0, 64, 0);
  s.addColorStop(0, 'rgba(0,0,0,1)');
  s.addColorStop(0.5, 'rgba(0,0,0,0)');
  s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = s; x.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A radial falloff, used for contact shadows and glows.
function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.55, inner.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,241,214,1)');
  g.addColorStop(1, 'rgba(255,241,214,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  // a soft blotchy puff: many overlapping faint radial blobs, edges feathered
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    const cx = 34 + rnd() * 60, cy = 34 + rnd() * 60, r = 14 + rnd() * 30;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.34)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill();
  }
  // feather the sprite's own edge so no square boundary shows
  const m = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  m.addColorStop(0, 'rgba(0,0,0,0)');
  m.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = m; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const STONE = new THREE.MeshStandardMaterial({ name: 'stone_warm', color: '#6F675C', roughness: 0.94, metalness: 0.03, flatShading: true });
const STONE_DARK = new THREE.MeshStandardMaterial({ name: 'stone_shadow', color: '#463F38', roughness: 0.96, metalness: 0.03, flatShading: true });

function column(h, r, mat) {
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(r * 2.9, 0.22, r * 2.9), mat);
  plinth.position.y = 0.11;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.22, r * 1.34, 0.18, 24), mat);
  base.position.y = 0.31;
  // 20 facets + flat shading reads as fluting without 20 extra meshes
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 20, 1), mat);
  shaft.position.y = 0.40 + h / 2;
  const echinus = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 0.92, 0.2, 24), mat);
  echinus.position.y = 0.40 + h + 0.1;
  const abacus = new THREE.Mesh(new THREE.BoxGeometry(r * 2.9, 0.2, r * 2.9), mat);
  abacus.position.y = 0.40 + h + 0.3;
  for (const m of [plinth, base, shaft, echinus, abacus]) {
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  g.name = 'column';
  return g;
}

export function mountScene(container, opts = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Mobile profile: fewer particles, smaller shadow map, capped pixel ratio,
  // no pointer parallax (touch has no hover) — the scene must hold 60fps on a
  // mid-range phone.
  const MOBILE = innerWidth < 820 || matchMedia('(pointer: coarse)').matches;
  const scrollTarget = opts.scrollTarget || container;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0B0D0E', 0.052);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const camBase = new THREE.Vector3(0, 1.75, 6.4);
  let aimX = 0, aimY = 1.55;      // the axis the camera looks at, per aspect branch
  camera.position.copy(camBase);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.4 : 2));
  renderer.setClearColor('#0B0D0E');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  container.appendChild(renderer.domElement);

  // ── light ────────────────────────────────────────────────────────────────
  const key = new THREE.DirectionalLight('#FFD79A', 3.4);
  key.position.set(-7, 10.5, -7);
  key.castShadow = true;
  key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  key.shadow.camera.near = 1; key.shadow.camera.far = 45;
  key.shadow.camera.left = -14; key.shadow.camera.right = 14;
  key.shadow.camera.top = 16; key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0006;
  key.shadow.radius = 3;
  scene.add(key);

  const gold = new THREE.PointLight('#F0CE93', 20, 11, 2);   // reveals the mark's faces
  gold.position.set(-0.9, 2.6, 2.8);
  scene.add(gold);
  // a second, tighter source from the right so both faces of the mark read
  const rim = new THREE.PointLight('#FFE3B0', 9, 7.5, 2);
  rim.position.set(1.9, 3.1, 1.9);
  scene.add(rim);
  const cool = new THREE.DirectionalLight('#6E8C86', 0.55);
  cool.position.set(5, 2, 6);
  scene.add(cool);
  scene.add(new THREE.HemisphereLight('#54636B', '#0A0C0D', 0.75));

  // A small procedural environment so the brass bezel has something to
  // reflect — a warm sky band with one bright source, slowly rotating.
  (function buildEnv() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#5A4A33');
    g.addColorStop(0.45, '#241F19');
    g.addColorStop(1, '#0A0B0C');
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    const hot = x.createRadialGradient(150, 70, 4, 150, 70, 120);
    hot.addColorStop(0, '#FFF0CE');
    hot.addColorStop(0.35, 'rgba(255,214,150,.55)');
    hot.addColorStop(1, 'rgba(255,214,150,0)');
    x.fillStyle = hot; x.fillRect(0, 0, 512, 256);
    const warm = x.createRadialGradient(400, 110, 4, 400, 110, 150);
    warm.addColorStop(0, 'rgba(226,178,110,.45)');
    warm.addColorStop(1, 'rgba(226,178,110,0)');
    x.fillStyle = warm; x.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.9;
    scene.environmentRotation = new THREE.Euler(0, 0, 0);
    pmrem.dispose(); tex.dispose();
  })();

  // ── ground ───────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ name: 'floor_stone', color: '#191B1D', roughness: 0.88, metalness: 0.05 })
  );
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── colonnade ────────────────────────────────────────────────────────────
  const colonnade = new THREE.Group();
  colonnade.name = 'colonnade';
  // Two rows receding, so the mark stands in a nave between them. The right row
  // is offset in depth and slightly slimmer, so the colonnade reads built rather
  // than mirrored. The right row also gives the desktop two-column layout (mark
  // panned right, into the [data-band-box] guide) something to flank it with —
  // a left-only colonnade left that side of the frame visibly empty.
  const colSpecs = [
    { x: -3.15, z: 2.4, h: 5.7, r: 0.46, mat: STONE },
    { x: -3.45, z: -0.9, h: 5.9, r: 0.46, mat: STONE },
    { x: -3.85, z: -4.4, h: 2.6, r: 0.44, mat: STONE_DARK, broken: true },
    { x: -4.35, z: -8.0, h: 6.1, r: 0.46, mat: STONE_DARK },
    { x: -5.0, z: -11.8, h: 6.2, r: 0.46, mat: STONE_DARK },
    { x: 2.05, z: -0.4, h: 5.5, r: 0.42, mat: STONE },
    { x: 2.3, z: -3.4, h: 5.8, r: 0.42, mat: STONE_DARK },
    { x: 2.7, z: -6.8, h: 6.0, r: 0.42, mat: STONE_DARK },
    { x: 3.3, z: -10.6, h: 6.2, r: 0.42, mat: STONE_DARK }
  ];
  colSpecs.forEach((s, i) => {
    const c = column(s.h, s.r, s.mat);
    c.position.set(s.x, 0, s.z);
    c.rotation.y = (i * 0.19) % (Math.PI / 10);
    colonnade.add(c);
    if (s.broken) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.9, 20, 1), STONE_DARK);
      drum.name = 'fallen_drum';
      drum.rotation.set(Math.PI / 2, -0.4, 0.15);
      drum.position.set(s.x + 0.95, 0.44, s.z + 1.0);
      drum.castShadow = true; drum.receiveShadow = true;
      colonnade.add(drum);
    }
  });
  // a lintel course above each row
  for (const [lx, lz] of [[-4.0, -8.6], [2.6, -7.2]]) {
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.30, 0.48, 22), STONE_DARK);
    lintel.name = 'lintel';
    lintel.position.set(lx, 6.45, lz);
    lintel.castShadow = true; lintel.receiveShadow = true;
    colonnade.add(lintel);
  }
  scene.add(colonnade);

  // ── the mark, mounted on a stone pedestal ────────────────────────────────
  const site = new THREE.Vector3(0, 0, 0.6);
  const pedestal = new THREE.Group();
  pedestal.name = 'pedestal';
  const steps = [
    { w: 3.0, h: 0.26, d: 1.9, y: 0.13 },
    { w: 2.4, h: 0.22, d: 1.5, y: 0.37 },
    { w: 1.9, h: 0.14, d: 1.15, y: 0.55 }
  ];
  for (const s of steps) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), STONE);
    m.position.set(0, s.y, 0);
    m.castShadow = true; m.receiveShadow = true;
    pedestal.add(m);
  }
  pedestal.position.copy(site);
  pedestal.rotation.y = -0.20;
  pedestal.visible = false;          // the CTA button is the slab the mark stands on
  scene.add(pedestal);
  const plinthTop = 0;               // the mark rests on the floor itself

  // Contact: a tight occlusion core right at the join plus a wider soft falloff,
  // laid on the floor so the base courses read as resting on stone rather than
  // hovering over it.
  const contact = new THREE.Group();
  contact.name = 'contact_shadow';
  const aoTex = radialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
  for (const [w, d, o, y] of [[1.55, 0.72, 0.72, 0.004], [2.7, 1.25, 0.4, 0.003], [4.4, 2.1, 0.2, 0.002]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
      map: aoTex, transparent: true, opacity: o, depthWrite: false, color: '#000000'
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(site.x + 0.06, y, site.z + 0.05);
    contact.add(m);
  }
  scene.add(contact);

  const markHolder = new THREE.Group();
  const mark = buildMark();
  const S = 2.9;
  mark.scale.setScalar(S);            // base of the mark sits at the group origin
  markHolder.add(mark);
  markHolder.position.set(site.x, plinthTop, site.z);
  scene.add(markHolder);
  const markMid = MARK_HEIGHT * S / 2;

  const parts = [];
  const order = { foundation: 0, pillar: 1, architrave: 2, bezel: 2 };
  const ENV = { mineral_black: 0.55, mineral_green: 0.85, mineral_sand: 0.75, mineral_grey: 1.0, brass_bezel: 1.1 };
  // Scene-side only: the black stone gets a faint warm self-glow and a touch
  // more sheen so the mark separates from the dark colonnade behind it.
  const LIFT = {
    mineral_black: { emissive: '#241E17', emissiveIntensity: 0.55, roughness: 0.5 },
    mineral_green: { emissive: '#12241F', emissiveIntensity: 0.5, roughness: 0.42 },
    mineral_sand:  { emissive: '#3A3227', emissiveIntensity: 0.32 },
    mineral_grey:  { emissive: '#2A3230', emissiveIntensity: 0.3 }
  };
  mark.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    o.material.envMapIntensity = ENV[o.material.name] ?? 0.3;
    const lift = LIFT[o.material.name];
    if (lift) {
      o.material.emissive = new THREE.Color(lift.emissive);
      o.material.emissiveIntensity = lift.emissiveIntensity;
      if (lift.roughness !== undefined) o.material.roughness = lift.roughness;
    }
    o.castShadow = true; o.receiveShadow = true;
    parts.push({ mesh: o, baseY: o.position.y, step: order[o.name.split('_')[0]] ?? 0 });
  });
  for (const m of [STONE, STONE_DARK, floor.material]) m.envMapIntensity = 0.12;

  // glow behind the mark — a soft additive disc, standing in for bloom
  const glowTex = dotTexture();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: '#D9A960', opacity: 0.8 })
  );
  glow.name = 'mark_glow';
  glow.position.set(site.x, plinthTop + markMid, -1.4);
  scene.add(glow);

  // ── god rays ─────────────────────────────────────────────────────────────
  const beamTex = beamTexture();
  const beams = new THREE.Group();
  beams.name = 'light_rays';
  const beamSpecs = [
    { x: -2.15, z: -1.8, w: 2.0, h: 16, o: 0.20, rz: 0.30 },
    { x: -0.35, z: -5.0, w: 2.6, h: 18, o: 0.14, rz: 0.24 },
    { x: 1.85, z: -3.2, w: 1.7, h: 15, o: 0.15, rz: 0.34 },
    { x: 3.5, z: -7.0, w: 3.0, h: 18, o: 0.10, rz: 0.22 },
    { x: -4.1, z: -9.0, w: 2.6, h: 18, o: 0.11, rz: 0.28 }
  ];
  for (const b of beamSpecs) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(b.w, b.h),
      new THREE.MeshBasicMaterial({
        map: beamTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, color: '#F0C182', opacity: b.o, side: THREE.DoubleSide
      })
    );
    m.position.set(b.x, b.h * 0.42, b.z);
    m.rotation.set(0.14, 0, b.rz);
    m.userData.base = b.o;
    beams.add(m);
  }
  scene.add(beams);

  // ── dust ─────────────────────────────────────────────────────────────────
  const N = MOBILE ? 240 : 700, pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = Math.random() * 8;
    pos[i * 3 + 2] = -14 + Math.random() * 18;
    spd[i] = 0.02 + Math.random() * 0.06;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.055, map: dotTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.75, color: '#F6E0B8'
  }));
  dust.name = 'dust';
  scene.add(dust);

  // ── dust puffs, kicked up where each piece lands ────────────────────────
  // ── impact dust: a billowing skirt of soft puffs plus fine airborne grit ──
  const cloudTex = [0, 1, 2, 3].map(i => cloudTexture(i + 1));
  function makeCloud(x, y, z, o = {}) {
    const grp = new THREE.Group();
    grp.name = 'impact_dust';
    grp.position.set(x, y, z);
    const puffs = [];
    const n = Math.round((o.n ?? 16) * (MOBILE ? 0.55 : 1));
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex[i % 4], color: '#7C7061', transparent: true, opacity: 0, depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      const a = (i / n) * 6.283 + Math.random() * 0.5;
      puffs.push({
        sp, a,
        speed: (0.7 + Math.random() * 1.5) * (o.spread ?? 1),
        rise: 0.10 + Math.random() * 0.42,
        drag: 1.1 + Math.random() * 1.9,
        grow: 0.9 + Math.random() * 2.1,
        s0: (0.35 + Math.random() * 0.5) * (o.size ?? 1),
        delay: Math.random() * 0.22,
        span: 1.5 + Math.random() * 1.9,
        peak: (0.05 + Math.random() * 0.05) * (o.peak ?? 1)
      });
      grp.add(sp);
    }
    scene.add(grp);
    return { grp, puffs, at: null, wide: o.wide ?? 1 };
  }
  const clouds = [
    makeCloud(site.x, plinthTop + 0.05, site.z, { n: 10, spread: 0.9, size: 0.8, peak: 0.34 }),
    makeCloud(site.x, plinthTop + 0.02, site.z, { n: 7, spread: 1.5, size: 1.1, peak: 0.24 }),
    makeCloud(site.x, plinthTop + MARK_HEIGHT * S * 0.72, site.z,
      { n: 8, spread: 1.1, size: 0.7, peak: 0.26, wide: 1.5 })
  ];

  const puffTex = dotTexture();
  function makePuff(x, y, z, o = {}) {
    const count = Math.round((o.count ?? 260) * (MOBILE ? 0.42 : 1));
    const p = new Float32Array(count * 3), v = new Float32Array(count * 3);
    const k = new Float32Array(count), ph = new Float32Array(count * 3), life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.45) * (o.radial ?? 1.1);
      v[i * 3] = Math.cos(a) * r * (o.wide ?? 1);
      v[i * 3 + 1] = (Math.random() - 0.25) * (o.up ?? 0.22);   // some falls, some lifts
      v[i * 3 + 2] = Math.sin(a) * r * 0.6;
      p[i * 3] = Math.cos(a) * r * 0.05;
      p[i * 3 + 1] = Math.random() * 0.05;
      p[i * 3 + 2] = Math.sin(a) * r * 0.04;
      k[i] = 0.7 + Math.random() * 2.6;                          // each grain drags differently
      ph[i * 3] = Math.random() * 6.28;
      ph[i * 3 + 1] = Math.random() * 6.28;
      ph[i * 3 + 2] = 0.5 + Math.random() * 1.8;                 // its own turbulence rate
      life[i] = 0.45 + Math.random() * 0.75;                     // fraction of the puff's life
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: o.size ?? 0.36, map: puffTex, transparent: true, opacity: 0, depthWrite: false,
      color: '#8C7F6C'                       // soft warm dust, not glowing sparks
    }));
    pts.name = 'impact_dust';
    pts.position.set(x, y, z);
    scene.add(pts);
    return { pts, v, k, ph, life, count, at: null, dur: o.dur ?? 2.6, peak: o.peak ?? 0.2 };
  }
  const puffs = [
    makePuff(site.x, plinthTop + 0.01, site.z, { count: 260, radial: 0.8, up: 0.20, size: 0.05, dur: 2.4, peak: 0.14 }),
    makePuff(site.x, plinthTop + 0.01, site.z, { count: 200, radial: 1.7, up: 0.10, size: 0.075, peak: 0.08, dur: 3.4 }),
    makePuff(site.x, plinthTop + MARK_HEIGHT * S * 0.72, site.z,
      { count: 240, radial: 1.1, up: 0.20, size: 0.055, wide: 1.6, peak: 0.1, dur: 2.8 })
  ];
  const LAND = [1420, 1420, 2120];

  // ── motion ───────────────────────────────────────────────────────────────
  const t0 = performance.now();
  let last = t0;
  let mx = 0, my = 0, tmx = 0, tmy = 0, sp = 0, tsp = 0;

  function onPointer(e) {
    const r = container.getBoundingClientRect();
    tmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    tmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
  }
  function onScroll() {
    // the hero is sticky, so page scroll (not its rect) drives the exit
    tsp = clamp01(scrollY / Math.max(innerHeight, 1));
  }
  if (!reduced && !MOBILE) addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    // The copy reserves a band at the top (eyebrow + three headline lines) and
    // one at the bottom (CTA, fine print, scroll cue). Frame the mark into the
    // clear band between them: derive the distance from the pixels actually
    // available, so the mark never sits under the type at any window height.
    camera.fov = camera.aspect < 1 ? 50 : camera.aspect < 1.35 ? 43 : 38;
    // Measure the real copy, don't guess: [data-band-top] is the last element of
    // the upper block, [data-band-bottom] the first of the lower one. The mark
    // is then framed into whatever is genuinely clear between them, with a
    // breathing margin, so type and object never overlap at any size.
    const rect = container.getBoundingClientRect();
    const pad = Math.max(h * 0.035, 22);
    // Take the lowest visible upper element and the highest visible lower one;
    // an element hidden at this size (the lede on short screens) is skipped.
    const edge = (sel, pick) => {
      let v = null;
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.height < 2) continue;
        const y = pick === 'bottom' ? r.bottom - rect.top : rect.bottom - r.top;
        v = v === null ? y : Math.max(v, y);
      }
      return v;
    };
    const rawTop = (edge('[data-band-top]', 'bottom') ?? h * 0.30) + pad;
    // [data-band-seat] is the element the mark STANDS ON — its top edge is the
    // mark's base line, with no breathing gap, so the button reads as the slab
    // under the mark. Without one, the lower copy block just gets clearance.
    const seat = edge('[data-band-seat]', 'top');
    const rawBottom = seat !== null ? seat
      : (edge('[data-band-bottom]', 'top') ?? h * 0.20) + pad;
    // Never solve against an inverted or hairline band: if the copy leaves
    // less than this fraction of the stage clear, fall back to centring the
    // mark in that minimum height. Otherwise the solver would chase a
    // negative span and push the camera outward until the mark is a few
    // pixels tall. On mobile the "seat" branch below buys extra room by
    // letting the mark rise up BEHIND the copy — on a 4-5 line headline on a
    // narrow phone, even 0.16 still bought more room than the real gap
    // between the sub-headline and the CTA button, so the mark kept clipping
    // the last line of copy. Dropped hard to 0.07: on mobile this mark is
    // decorative background art, not something that needs a guaranteed
    // minimum size — never overlapping the copy matters far more here.
    // Desktop uses [data-band-box] instead (see the guide check below) so
    // this constant only matters there as a brief-mount fallback before the
    // guide is measured — safe to keep conservative.
    const MIN = h * (MOBILE ? 0.07 : 0.36);
    let TOP = rawTop, BOTTOM = rawBottom;
    if (h - TOP - BOTTOM < MIN) {
      if (seat !== null) {
        // The seat line is a hard contract: the mark's base stays on the
        // button's top edge. Buy the room upward instead, letting the mark
        // rise behind the copy rather than sinking below its slab.
        BOTTOM = seat;
        TOP = Math.max(h - BOTTOM - MIN, 0);
      } else {
        const centre = Math.min(Math.max((rawTop + (h - rawBottom)) / 2, MIN / 2), h - MIN / 2);
        TOP = centre - MIN / 2;
        BOTTOM = h - (centre + MIN / 2);
      }
    }
    const markH = MARK_HEIGHT * S;
    const yTop = plinthTop + markH, yBot = plinthTop;
    let wantTop = TOP, wantBot = h - BOTTOM;
    // A visible [data-band-box] overrides the band solve entirely: the mark is
    // framed into that element's rectangle on BOTH axes. Hide the guide with
    // display:none at a breakpoint and the top/bottom/seat logic above takes
    // over again, so one scene serves a side-by-side desktop and a stacked
    // phone without a separate desktop-only scene.
    let boxCentreX = null;
    const guide = document.querySelector('[data-band-box]');
    if (guide) {
      const g = guide.getBoundingClientRect();
      if (g.width > 2 && g.height > 2) {
        wantTop = g.top - rect.top;
        wantBot = g.bottom - rect.top;
        boxCentreX = (g.left + g.right) / 2 - rect.left;
      }
    }
    // Floor this at MIN, not a separate constant — a bigger floor here than
    // the one already baked into TOP/BOTTOM above would size the mark for
    // more room than it's actually being positioned into, overflowing the
    // band it's supposed to fit and overlapping the copy regardless of how
    // small MIN itself is set.
    const solveBand = Math.max(wantBot - wantTop, MIN);
    // Solve for distance and aim numerically: the view is tilted, so a closed
    // form is off by enough to overlap the type. Six passes converge to the
    // mark sitting exactly inside the clear band.
    aimX = 0;
    aimY = plinthTop + markH * 0.55;
    let dist = Math.max((markH / (solveBand / h)) / (2 * Math.tan((camera.fov * Math.PI / 180) / 2)), 3);
    const toPx = y => (1 - new THREE.Vector3(0, y, site.z).project(camera).y) / 2 * h;
    let panX = 0;
    for (let i = 0; i < 6; i++) {
      camera.position.set(panX, aimY - 0.30, site.z + dist);
      camera.updateProjectionMatrix();
      camera.lookAt(aimX + panX, aimY, 0.4);
      camera.updateMatrixWorld(true);
      const pTop = toPx(yTop), pBot = toPx(yBot), span = pBot - pTop;
      if (!(span > 1) || !(wantBot - wantTop > 1)) break;
      dist = Math.max(dist * span / (wantBot - wantTop), 2.5);
      aimY -= ((pTop + pBot) / 2 - (wantTop + wantBot) / 2) / span * markH;
      if (boxCentreX !== null) {
        // Pan laterally so the mark lands on the guide's centre line; the
        // camera moves opposite to the wanted screen travel.
        const halfW = dist * Math.tan((camera.fov * Math.PI / 180) / 2) * camera.aspect;
        panX = -((boxCentreX / w) - 0.5) * 2 * halfW;
      }
    }
    camBase.set(panX, aimY - 0.30, site.z + dist);
    aimX += panX;
    // A lateral pan carries the whole scene with it, so a colonnade row placed
    // for the centred layout can leave the frustum. Slide the right row back
    // toward the axis by the pan, but never inside a clearance corridor around
    // the mark's footprint — a near column crossing the silhouette would read
    // as a pillar cutting the architrave. The centred hero is untouched (pan
    // is 0 with no guide present).
    const CLEAR = 1.95;              // the mark's half-width is 0.89, plus air
    colonnade.children.forEach(o => {
      if (o.userData.homeX === undefined) o.userData.homeX = o.position.x;
      const home = o.userData.homeX;
      if (home > 0) o.position.x = Math.max(home + panX * 0.62, Math.min(home, CLEAR));
    });
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  // The container's own box (min-h-screen) doesn't change size when the
  // copy inside it settles, so the ResizeObserver above never re-fires for
  // that — but the [data-band-*] elements it measures DO move: web fonts
  // swap in after this first paint (changing text metrics/line wraps) and
  // the headline's Framer Motion stagger is still mid-animation (opacity/
  // translateY transforms shift getBoundingClientRect() while running) at
  // the instant this first resize() call fires. Re-measure once fonts are
  // ready and once more after the stagger has had time to settle, so the
  // mark frames itself against the real, final copy position instead of
  // wherever it happened to be at mount.
  const settleTimer = setTimeout(resize, 1700);
  let fontsCancelled = false;
  document.fonts?.ready?.then(() => { if (!fontsCancelled) resize(); });

  container.__tk = { scene, camera, markHolder, pedestal, site };   // introspection handle

  // Departure: fired from the CTA. The mark unseats from its slab, gathers, then
  // rushes past the camera on a rising arc while the key light flares.
  const DEPART = 1250;
  let departAt = null;

  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((performance.now() - last) / 1000, 0.05);
    last = performance.now();
    const ms = performance.now() - t0;

    // Assembly: the foundation settles, then the pillar drops onto it, then
    // the architrave lands on the pillar — each impact kicking up dust.
    for (const p of parts) {
      if (p.step === 0) {
        const k = reduced ? 1 : EASE(clamp01((ms - 240) / 760));
        p.mesh.position.y = p.baseY + (1 - k) * 0.10;
        p.mesh.material.opacity = k;
      } else {
        const land = p.step === 1 ? LAND[0] : LAND[2];
        const fall = reduced ? 1 : clamp01((ms - (land - 720)) / 720);
        const drop = Math.pow(1 - fall, 2.3) * (p.step === 1 ? 2.6 : 3.2);
        const after = clamp01((ms - land) / 260);
        const settle = 0;                     // pieces land dead — no rebound
        p.mesh.position.y = p.baseY + drop - settle;
        p.mesh.material.opacity = fall > 0 ? 1 : 0;
      }
    }

    // dust bursts
    // dust: soft puffs billow outward and up, fine grit drifts with them
    clouds.forEach((cl, i) => {
      if (cl.at === null && ms >= LAND[i]) cl.at = ms;
      if (cl.at === null) return;
      const age = (ms - cl.at) / 1000;
      for (const p of cl.puffs) {
        const t = age - p.delay;
        if (t <= 0) { p.sp.material.opacity = 0; continue; }
        if (t > p.span) { p.sp.material.opacity = 0; continue; }
        const drift = (1 - Math.exp(-t * p.drag)) / p.drag * p.speed * 1.7;
        p.sp.position.set(
          Math.cos(p.a) * drift * cl.wide,
          p.rise * Math.pow(t, 0.7) + Math.sin(t * 1.7 + p.a) * 0.03,
          Math.sin(p.a) * drift * 0.65
        );
        const k = t / p.span;
        p.sp.scale.setScalar(p.s0 + p.grow * Math.pow(t, 0.8));
        p.sp.material.rotation += 0.0016 + p.a * 0.00002;
        p.sp.material.opacity = p.peak * clamp01(t / 0.18) * Math.pow(1 - k, 2.4);
      }
    });

    puffs.forEach((pf, i) => {
      if (pf.at === null && ms >= LAND[i]) pf.at = ms;
      if (pf.at === null) { pf.pts.material.opacity = 0; return; }
      const age = (ms - pf.at) / 1000;
      if (age > pf.dur) { pf.pts.material.opacity = 0; return; }
      const arr = pf.pts.geometry.attributes.position.array;
      for (let j = 0; j < pf.count; j++) {
        const t = Math.min(age, pf.dur * pf.life[j]);
        const drag = (1 - Math.exp(-t * pf.k[j])) / pf.k[j] * 1.8;   // per-grain slow-down
        const sw = pf.ph[j * 3 + 2];
        arr[j * 3] = pf.v[j * 3] * drag + Math.sin(t * sw + pf.ph[j * 3]) * 0.045 * t;
        arr[j * 3 + 1] = pf.v[j * 3 + 1] * drag * 1.4 - 0.05 * t * t
          + Math.sin(t * sw * 0.7 + pf.ph[j * 3 + 1]) * 0.03 * t;
        arr[j * 3 + 2] = pf.v[j * 3 + 2] * drag + Math.cos(t * sw * 0.8 + pf.ph[j * 3 + 1]) * 0.035 * t;
      }
      pf.pts.geometry.attributes.position.needsUpdate = true;
      const rise = clamp01(age / 0.1);
      const fall = Math.pow(1 - clamp01(age / pf.dur), 2.2);
      pf.pts.material.opacity = pf.peak * rise * fall;
    });
    // intro: the camera settles forward as the mark lands
    const intro = reduced ? 1 : EASE(clamp01(ms / 2900));
    mx = lerp(mx, tmx, Math.min(dt * 2.8, 1));
    my = lerp(my, tmy, Math.min(dt * 2.8, 1));
    sp = lerp(sp, tsp, Math.min(dt * 3.2, 1));

    camera.position.set(
      camBase.x + mx * 0.65,
      camBase.y - my * 0.30 + sp * 0.9 + (1 - intro) * 0.5,
      camBase.z + (1 - intro) * 2.6 - sp * 2.4
    );
    camera.lookAt(aimX, aimY + sp * 0.5, 0.4);

    // On scroll the pedestal sinks into the floor while the mark slides off
    // toward the camera's lower right, invading the next section as it goes.
    const fly = sp * sp;
    pedestal.position.y = -clamp01(sp / 0.55) * 1.35;
    markHolder.position.set(
      site.x + fly * 4.6 + mx * 0.08,
      plinthTop - fly * 2.4 + Math.sin(ms / 3400) * 0.012 - my * 0.04,
      site.z + fly * 7.2
    );
    markHolder.scale.setScalar(1 + fly * 1.9);
    markHolder.rotation.y = -0.42 + mx * 0.26 + sp * 1.5;
    markHolder.rotation.x = my * 0.05 + fly * 0.22 - my * 0.06;
    markHolder.rotation.z = mx * my * 0.02;
    const exit = 1 - clamp01((sp - 0.72) / 0.28);
    for (const p of parts) p.mesh.material.opacity = Math.min(p.mesh.material.opacity, exit);

    if (departAt !== null) {
      const d = clamp01((ms - departAt) / DEPART);
      const anticip = Math.sin(clamp01(d / 0.14) * Math.PI) * 0.055;   // crouch, then go
      const launch = d < 0.14 ? 0 : Math.pow((d - 0.14) / 0.86, 2.1);
      markHolder.position.y += anticip * -0.06 + launch * 3.1;
      markHolder.position.x += launch * 0.55;
      markHolder.position.z += launch * 9.5;
      markHolder.scale.multiplyScalar(1 - anticip + launch * 2.4);
      markHolder.rotation.y += launch * 0.9;
      markHolder.rotation.x -= launch * 0.42;
      const flare = Math.sin(clamp01((d - 0.1) / 0.35) * Math.PI);
      gold.intensity = 20 + flare * 46;
      rim.intensity = 9 + flare * 16;
      glow.material.opacity = 0.8 + flare * 0.5;
      glow.scale.setScalar(1 + flare * 0.5);
      const fade = 1 - clamp01((d - 0.5) / 0.34);
      for (const p of parts) p.mesh.material.opacity = Math.min(p.mesh.material.opacity, fade);
      if (d >= 1) {                             // reset for a second run
        departAt = null;
        gold.intensity = 20; rim.intensity = 9;
        glow.material.opacity = 0.8; glow.scale.setScalar(1);
      }
    }
    pedestal.visible = false;

    glow.position.set(markHolder.position.x, markHolder.position.y + markMid, -1.4);
    glow.material.opacity = (0.42 + Math.sin(ms / 2100) * 0.08) * intro * exit;
    glow.lookAt(camera.position);

    const a = ms / 7000;
    if (scene.environmentRotation) scene.environmentRotation.y = ms / 11000 + mx * 0.2;
    key.position.set(-7 + Math.sin(a) * 1.6, 10.5, -7 + Math.cos(a * 0.8) * 1.2);
    gold.intensity = 11 + Math.sin(ms / 1500) * 2.2;
    beams.children.forEach((b, i) => {
      b.material.opacity = b.userData.base * intro * (0.78 + Math.sin(ms / 1900 + i) * 0.22);
      b.rotation.z += Math.sin(ms / 5200 + i) * 0.00012;
    });

    const P = dust.geometry.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = P.array[i * 3 + 1] + spd[i] * dt;
      if (y > 8) y = 0;
      P.array[i * 3 + 1] = y;
      P.array[i * 3] += Math.sin(ms / 4000 + i) * 0.0004;
    }
    P.needsUpdate = true;

    renderer.render(scene, camera);
  }
  frame();

  return {
    scene, camera,
    // Play the departure and resolve once the mark has left frame. Safe to call
    // twice — the second call resolves on the first animation's clock.
    depart() {
      if (departAt === null) departAt = performance.now() - t0;
      const left = Math.max(DEPART * 0.72 - ((performance.now() - t0) - departAt), 0);
      return new Promise(r => setTimeout(r, left));
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(settleTimer);
      fontsCancelled = true;
      removeEventListener('pointermove', onPointer);
      removeEventListener('scroll', onScroll);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
