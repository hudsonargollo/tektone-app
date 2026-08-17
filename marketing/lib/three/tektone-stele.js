// Tektone · Autoridade — a Greek aedicula (stele billboard) carrying the video.
// Two fluted columns on a stylobate, architrave, pediment, and the portrait
// video set into a recessed panel. The whole artifact swings into frame as the
// section scrolls past, like a billboard turning to face you.
//
// mountStele(container, { video, scrollTarget }) -> { destroy() }
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.min(Math.max(v, 0), 1);
const EASE = t => 1 - Math.pow(1 - t, 3);

const STONE = new THREE.MeshStandardMaterial({ name: 'marble_pale', color: '#D8CDBA', roughness: 0.42, metalness: 0.04 });
const STONE_D = new THREE.MeshStandardMaterial({ name: 'marble_shadow', color: '#A2988A', roughness: 0.5, metalness: 0.04 });
const SAND = new THREE.MeshStandardMaterial({ name: 'mineral_sand', color: '#C7B79C', roughness: 0.55, metalness: 0.06 });
const INK = new THREE.MeshStandardMaterial({ name: 'mineral_black', color: '#141618', roughness: 0.35, metalness: 0.18 });
const GREEN = new THREE.MeshStandardMaterial({ name: 'mineral_green', color: '#2E4A43', roughness: 0.42, metalness: 0.2 });
const BRASS = new THREE.MeshStandardMaterial({ name: 'brass', color: '#B2894C', roughness: 0.24, metalness: 0.9 });

function box(name, mat, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function column(name, h, r) {
  const g = new THREE.Group();
  g.name = name;
  // Modern Doric: no swelling echinus, just a square capital and a plain base.
  const base = box('base', STONE_D, r * 2.3, 0.10, r * 2.3, 0, 0.05, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, h, 24, 1, false), STONE);
  shaft.name = 'shaft';
  shaft.position.y = 0.10 + h / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.014, h - 0.06, 0.02), STONE_D);
    f.name = 'flute_' + (i + 1);
    f.position.set(Math.cos(a) * r * 0.985, 0.10 + h / 2, Math.sin(a) * r * 0.985);
    f.rotation.y = -a;
    f.receiveShadow = true;
    g.add(f);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.02, 24), BRASS);
  collar.name = 'brass_collar';
  collar.position.y = 0.10 + h - 0.04;
  const capital = box('capital', STONE, r * 2.5, 0.11, r * 2.5, 0, 0.10 + h + 0.055, 0);
  for (const m of [base, shaft, collar, capital]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData.top = 0.10 + h + 0.11;
  return g;
}

// A thin raked member — one side of an open pediment.
function rake(name, len, thick, depth, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, thick, depth), mat);
  m.name = name;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function pediment(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, STONE);
  m.name = 'pediment';
  m.castShadow = true; m.receiveShadow = true;
  return m;
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
  let dist = 5.5;
  const look = new THREE.Vector3(0, 0, 0);   // set to the object's centre below

  // ---- the artifact ------------------------------------------------------
  const swing = new THREE.Group();          // scroll rotation
  const stele = new THREE.Group();          // the built object
  swing.add(stele);
  scene.add(swing);

  // ---- stylobate: one slab floating on a dark shadow gap ------------------
  const gapH = 0.07;
  stele.add(box('shadow_gap', INK, 2.55, gapH, 1.15, 0, gapH / 2, 0));
  stele.add(box('stylobate', STONE, 2.95, 0.15, 1.30, 0, gapH + 0.075, 0));
  stele.add(box('stylobate_reveal', BRASS, 2.97, 0.010, 1.32, 0, gapH + 0.155, 0));
  const top = gapH + 0.16;

  const colR = 0.115, colH = 2.30;
  const cols = [];
  for (const s of [-1, 1]) {
    const c = column(s < 0 ? 'column_left' : 'column_right', colH, colR);
    c.position.set(s * 1.12, top, 0);
    cols.push(c);
    stele.add(c);
  }
  const colTop = top + cols[0].userData.top;

  // ---- the ink monolith the screen is cut into ---------------------------
  const slabH = colTop - top - 0.06;
  stele.add(box('monolith', INK, 2.02, slabH, 0.20, 0, top + slabH / 2, -0.10));
  stele.add(box('monolith_reveal', GREEN, 2.04, 0.012, 0.21, 0, top + 0.006, -0.10));

  // ---- video panel -------------------------------------------------------
  const panelW = 1.42, panelH = panelW * 4 / 3;
  const panelY = top + slabH / 2 + 0.06;
  const rail = 0.016;                       // a hairline brass bezel
  stele.add(box('bezel_top', BRASS, panelW + rail * 2, rail, 0.05, 0, panelY + panelH / 2 + rail / 2, 0.005));
  stele.add(box('bezel_bottom', BRASS, panelW + rail * 2, rail, 0.05, 0, panelY - panelH / 2 - rail / 2, 0.005));
  for (const s of [-1, 1]) {
    stele.add(box(s < 0 ? 'bezel_left' : 'bezel_right', BRASS,
      rail, panelH + rail * 2, 0.05, s * (panelW / 2 + rail / 2), panelY, 0.005));
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

  // ---- entablature: slim beam, brass hairline, open pediment -------------
  const archH = 0.17;
  stele.add(box('architrave', STONE, 2.86, archH, 0.42, 0, colTop + archH / 2, -0.02));
  stele.add(box('taenia', BRASS, 2.90, 0.012, 0.44, 0, colTop + archH + 0.006, -0.02));
  for (let i = -4; i <= 4; i++) {
    stele.add(box('triglyph_' + (i + 5), SAND, 0.024, archH - 0.05, 0.02,
      i * 0.30, colTop + archH / 2, 0.19));
  }
  const cornY = colTop + archH + 0.012;
  stele.add(box('cornice', STONE, 3.06, 0.09, 0.50, 0, cornY + 0.045, -0.02));

  const pedW = 3.02, pedH = 0.60;
  const rakeLen = Math.hypot(pedW / 2, pedH) + 0.06;
  const ang = Math.atan2(pedH, pedW / 2);
  const pedBase = cornY + 0.09;
  for (const s of [-1, 1]) {
    const r1 = rake(s < 0 ? 'rake_left' : 'rake_right', rakeLen, 0.085, 0.34, STONE);
    r1.position.set(s * pedW / 4, pedBase + pedH / 2, -0.02);
    r1.rotation.z = s * -ang;
    stele.add(r1);
    const r2 = rake(s < 0 ? 'rake_brass_left' : 'rake_brass_right', rakeLen, 0.010, 0.36, BRASS);
    r2.position.set(s * pedW / 4, pedBase + pedH / 2 - 0.048, -0.02);
    r2.rotation.z = s * -ang;
    stele.add(r2);
  }
  stele.add(box('acroterion', INK, 0.09, 0.09, 0.30, 0, pedBase + pedH + 0.02, -0.02));
  const objTop = pedBase + pedH + 0.07;

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
  for (const [w, d, o, y] of [[3.3, 1.5, 0.6, 0.006], [5.0, 2.4, 0.34, 0.004], [7.6, 3.6, 0.16, 0.002]]) {
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
  key.position.set(-4.4, 6.4, 4.6);
  key.castShadow = true;
  key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  const sc = key.shadow.camera;
  sc.left = -5; sc.right = 5; sc.top = 6; sc.bottom = -3; sc.near = 1; sc.far = 22;
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
    GREEN.envMapIntensity = 0.6;
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
    // frame the whole artifact (base to pediment) to the canvas, whatever its
    // shape: pull back until both the object's height and width fit
    const objH = objTop * 1.02, objW = 3.15, pad = camera.aspect < 0.9 ? 1.22 : 1.14;
    const vFit = (objH * pad / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
    const hFit = (objW * pad / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) / camera.aspect;
    dist = Math.max(vFit, hFit);
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
    const amp = MOBILE ? 0.6 : 1;
    swing.rotation.y = t * 0.62 * amp + mx * 0.10;
    swing.rotation.x = -t * 0.13 * amp + my * 0.04;
    swing.position.y = -t * 0.30 * amp;
    swing.position.x = t * 0.42 * amp;
    swing.position.z = -Math.abs(t) * 1.0 * amp;
    warm.intensity = 1.6 + settle * 2.2;
    key.intensity = 2.4 + settle * 0.9;

    camera.position.set(0, centreY + my * 0.10, dist);
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
