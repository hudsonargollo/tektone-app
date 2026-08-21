import * as THREE from "three";

// Decorative-only backdrop for formv2's parchment stage: slow-drifting gold
// dust and a soft pulsing glow behind the parchment card. Mounted only on
// capable devices (see lib/device-tier.ts) — the parchment roll itself is
// pure CSS/Framer Motion and works everywhere without this.
function makeDustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function mountAmbience(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 0, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const COUNT = 90;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    speeds[i] = 0.15 + Math.random() * 0.25;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dustTex = makeDustTexture();
  const mat = new THREE.PointsMaterial({
    size: 0.09,
    map: dustTex,
    transparent: true,
    opacity: 0.35,
    color: "#C79A55",
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const glowGeo = new THREE.PlaneGeometry(14, 14);
  const glowMat = new THREE.MeshBasicMaterial({
    color: "#F0CE93",
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.z = -4;
  scene.add(glow);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  let basePulse = 0.05;
  function tick(t) {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * 0.003;
      if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -5;
    }
    geo.attributes.position.needsUpdate = true;
    glowMat.opacity = basePulse + Math.sin(t * 0.0006) * 0.02;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    // 0..1 — nudged up briefly on scene transitions for a subtle "breath."
    pulse(intensity) {
      basePulse = 0.05 + Math.max(0, Math.min(1, intensity)) * 0.09;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      dustTex.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
