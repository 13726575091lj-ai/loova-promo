// B2 interactive heart hero (three.js r170, no other dependencies).
// Usage:  <div data-b2-heart style="height:100vh"></div>
//         <script type="module" src="b2-heart/b2-heart.js"></script>
// Interaction: capsules under the cursor / finger turn cobalt blue and lift, then slowly fade back;
// clicking the floor sends a ripple; hovering the heart makes it beat; clicking it makes it cry.
import * as THREE from './three.module.min.js';

const BASE = new URL('.', import.meta.url).href;
const PAL = { paper: 0xf0eedf, cream: 0xf4eee1, peach: 0xf2b48c, orange: 0xe8551f, blue: 0x3154e8 };
const BED = 0.36, HX = -0.25, TILT = THREE.MathUtils.degToRad(-13), G = 8.6;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (u) => (u = clamp(u), u * u * (3 - 2 * u));
const outBack = (u, s = 2.2) => (u = clamp(u) - 1, 1 + (s + 1) * u ** 3 + s * u ** 2);
const pulse = (t, t0, w = 0.07) => { const u = (t - t0) / w; return u <= 0 ? 0 : u * Math.exp(1 - u); };

async function loadHeart() {
  const buf = await (await fetch(BASE + 'heart.bin')).arrayBuffer();
  const dv = new DataView(buf);
  const nv = dv.getUint32(0, true), nf = dv.getUint32(4, true);
  const lo = [0, 1, 2].map((i) => dv.getFloat32(8 + i * 4, true)), hi = [0, 1, 2].map((i) => dv.getFloat32(20 + i * 4, true));
  const q = new Uint16Array(buf, 32, nv * 3);
  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) pos[i] = lo[i % 3] + (q[i] / 65535) * (hi[i % 3] - lo[i % 3]);
  const idx = new Uint16Array(buf.slice(32 + nv * 6, 32 + nv * 6 + nf * 6));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return { geo: g, lo, hi };
}

function tearGeometry(h = 0.52) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const th = (Math.PI * i) / 40;
    pts.push(new THREE.Vector2(0.36 * h * Math.sin(th) * Math.sin(th / 2) ** 1.25 + 1e-4, -h * (1 - Math.cos(th)) / 2));
  }
  return new THREE.LatheGeometry(pts, 48);
}

function studioEnv(renderer) {
  // soft cream studio: bright overhead softbox + side strips, used only for reflections / IBL
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0xe9e2d2, side: THREE.BackSide })));
  const box = (w, h, x, y, z, ry, c, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); m.rotateZ(ry); s.add(m);
  };
  box(10, 6, -6, 9, 6, 0, 0xfff3e6, 5);
  box(4, 12, 9, 3, -2, 0, 0xffe4cf, 2.5);
  box(12, 3, 2, 2, 12, 0, 0xeef0ff, 1.6);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  return rt.texture;
}

export async function mountHeart(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: location.search.includes('capture') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.style.position ||= 'relative';
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y';
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.paper);
  scene.fog = new THREE.Fog(PAL.paper, 11, 24);
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.9;

  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
  const camHome = new THREE.Vector3(1.4, 2.6, 10.4), look = new THREE.Vector3(HX + 0.35, 0.95, 0);

  const key = new THREE.DirectionalLight(0xfff1e4, 2.2);
  key.position.set(-5, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25 });
  key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key, new THREE.HemisphereLight(0xfff8ee, 0xe8dcc6, 0.6));
  const rim = new THREE.DirectionalLight(0xffd9c0, 1.2); rim.position.set(5, 4, -6); scene.add(rim);

  // floor (under the capsules)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xeee6d4, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // ---------------------------------------------------------------- capsule field
  const PR = 0.098, PH = 0.36, PITCH = 0.25, ROWH = PITCH * Math.sqrt(3) / 2;
  const capGeo = new THREE.CapsuleGeometry(PR, PH - 2 * PR, 4, 12); capGeo.translate(0, PH / 2, 0);
  const capMat = new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.06 });
  const P = [];
  for (let r = 0, z = 3.4; z > -7; r++, z -= ROWH) for (let x = -7 + (r & 1) * PITCH / 2; x < 7; x += PITCH) {
    const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    const rnd = h - Math.floor(h);
    P.push({ x: x + (rnd - 0.5) * 0.02, z, rnd, rot: rnd * 6.283, blue: 0, touched: -99, lift: 0, liftV: 0 });
  }
  const N = P.length;
  const caps = new THREE.InstancedMesh(capGeo, capMat, N);
  caps.castShadow = caps.receiveShadow = true;
  caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(caps);
  const cCream = new THREE.Color(PAL.cream), cPeach = new THREE.Color(PAL.peach), cBlue = new THREE.Color(PAL.blue), tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), eul = new THREE.Euler();
  for (let i = 0; i < N; i++) caps.setColorAt(i, P[i].rnd > 0.975 ? cPeach : cCream);

  // ---------------------------------------------------------------- heart + tear
  const { geo: hGeo, hi } = await loadHeart();
  const heartMat = new THREE.MeshPhysicalMaterial({ color: PAL.orange, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06,
    sheen: 0.35, sheenColor: new THREE.Color(0xffc4a0), sheenRoughness: 0.5 });
  const heart = new THREE.Mesh(hGeo, heartMat); heart.castShadow = true;
  const heartPivot = new THREE.Group(); heartPivot.add(heart); scene.add(heartPivot);
  const tearMat = new THREE.MeshPhysicalMaterial({ color: 0x8aa0ff, transmission: 1, thickness: 0.5, roughness: 0.03, ior: 1.36,
    attenuationColor: new THREE.Color(PAL.blue), attenuationDistance: 0.28, clearcoat: 0.6 });
  const TEAR_H = 0.52;
  const tear = new THREE.Mesh(tearGeometry(TEAR_H), tearMat); tear.castShadow = true; tear.visible = false; scene.add(tear);
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), tearMat, 12); beads.count = 0; scene.add(beads);
  // attach point on the right lobe (heart-local, tip at y = 0, front = +z)
  const A0 = new THREE.Vector3(0.66, 1.52, hi[2] * 0.62), A1 = new THREE.Vector3(0.74, 1.22, hi[2] * 0.62);

  // ---------------------------------------------------------------- state
  const ripples = []; // {t0, x, z, amp, speed, decay, width}
  const addRipple = (t0, x, z, amp, speed = 3.3, decay = 1.6, width = 0.36) => { ripples.push({ t0, x, z, amp, speed, decay, width }); if (ripples.length > 12) ripples.shift(); };
  let clock = 0, landed = false, tearT0 = 3.2, tearHit = null, hitPos = null, beadState = [];
  const LAND = 0.55;
  let hoverHeart = 0, hoverK = 0, beatPhase = 0;
  const mouse = new THREE.Vector2(9, 9), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BED);
  let cursor = null, cursorPrev = null, pointerIn = false, lookX = 0, lookY = 0;

  function heartMatrix(t, out) {
    let y = BED - 0.08, sx = 1, sy = 1, roll = 0;
    if (t < LAND) {
      y += 0.5 * G * (LAND - t) ** 2;
      const st = Math.min(0.16, 0.022 * G * (LAND - t)); sy = 1 + st; sx = 1 / Math.sqrt(1 + st);
    } else {
      const u = t - LAND;
      const hop = u > 0.09 && u < 0.5 ? 4 * 0.22 * ((u - 0.09) / 0.41) * (1 - (u - 0.09) / 0.41) : 0;
      y += hop;
      const sq = u < 0.6 ? 0.3 * Math.exp(-u * 9) * Math.cos(u * 24) : 0;
      // heartbeat: double pulse; faster and stronger while hovered
      const b = beatPhase % 1;
      const beat = 0.05 * (1 + hoverK) * (pulse(b, 0.0, 0.06) + 0.7 * pulse(b, 0.17, 0.05));
      let sob = 0;
      if (tearT0 !== null) { const tt = clock - tearT0; sob = -0.035 * smooth(seg(tt, -0.1, 0.25)) * (1 - smooth(seg(tt, 0.7, 1.1))); }
      sy = 1 - sq + sob + beat * 0.8 + 0.012 * Math.sin(t * 2.4);
      sx = 1 + sq * 0.55 - sob * 0.4 + beat + 0.012 * Math.sin(t * 2.4);
      roll = 0.1 * Math.exp(-u * 3.5) * Math.sin(u * 9.5);
    }
    eul.set(lookY * 0.18, lookX * 0.35, TILT + roll);
    return out.compose(v3.set(HX, y, 0), q4.setFromEuler(eul), s3.set(sx, sy, sx));
  }
  const HM = new THREE.Matrix4(), HM2 = new THREE.Matrix4();

  function tearUpdate(dt) {
    if (tearT0 === null) return;
    const tt = clock - tearT0;
    if (tt < 0) { tear.visible = false; return; }
    if (!tearHit) {
      const s = outBack(seg(tt, 0, 0.7));
      const jig = 0.08 * Math.exp(-Math.max(0, tt - 0.7) * 5) * Math.sin(Math.max(0, tt - 0.7) * 22);
      const st = smooth(seg(tt, 1.4, 2.05));
      const DET = 2.05;
      if (tt < DET) {
        const p = A0.clone().lerp(A1, smooth(seg(tt, 0.75, 1.9))).applyMatrix4(HM);
        tear.position.copy(p);
        tear.scale.set(s * (1 - 0.1 * st - jig * 0.5), s * (1 + 0.3 * st + jig), s * (1 - 0.1 * st - jig * 0.5));
        tear.userData.v = 0; tear.userData.d = 0;
      } else {
        const d = (tear.userData.d += dt);
        tear.userData.v += G * dt;
        tear.position.y -= tear.userData.v * dt;
        tear.position.x += 0.05 * dt;
        const rel = 1 - Math.exp(-d * 9);
        const sy = 1.3 + (1.05 - 1.3) * rel + 0.06 * Math.exp(-d * 6) * Math.sin(d * 30), sxz = 0.9 + 0.08 * rel;
        tear.scale.set(sxz, sy, sxz);
        if (tear.position.y - TEAR_H * sy <= BED + 0.01) {
          tearHit = clock; hitPos = new THREE.Vector3(tear.position.x, BED, tear.position.z);
          addRipple(clock, hitPos.x, hitPos.z, 0.13, 2.7, 1.25, 0.3);
          beadState = Array.from({ length: 11 }, (_, i) => {
            const a = (2 * Math.PI * i) / 11 + Math.sin(i * 7.1) * 0.25;
            return { x: hitPos.x, y: BED + 0.04, z: hitPos.z, vx: Math.cos(a) * (0.55 + 0.6 * ((i * 0.37) % 1)), vz: Math.sin(a) * 0.8 * (0.55 + 0.6 * ((i * 0.53) % 1)),
              vy: 1.4 + 0.9 * ((i * 0.61) % 1), r: 0.028 + 0.027 * ((i * 0.29) % 1), alive: true };
          });
        }
      }
      tear.visible = true;
    } else {
      const u = clock - tearHit;
      const sq = 1 - Math.exp(-u * 18), wob = 0.12 * Math.exp(-u * 6) * Math.sin(u * 28), sink = smooth(seg(u, 0.25, 0.85));
      const sy = (1.05 + (0.22 - 1.05) * sq + wob) * (1 - sink), sxz = (0.98 + (1.95 - 0.98) * sq - wob * 0.6) * (1 - 0.6 * sink);
      tear.position.set(hitPos.x, BED - 0.01 + TEAR_H * sy, hitPos.z);
      tear.scale.set(sxz, Math.max(sy, 1e-4), sxz);
      tear.visible = u < 0.9;
      // the pool: capsules around the impact turn blue, growing outward
      const R = 1.75 * (1 - Math.exp(-u * 1.5));
      for (const p of P) {
        const d = Math.hypot(p.x - hitPos.x, p.z - hitPos.z);
        const k = clamp((R - d) / 0.32);
        if (k > p.blue) { p.blue = k; p.touched = clock + 2.5; }
      }
      if (u > 7) { tearT0 = clock + 2.5; tearHit = null; } // next tear in a while
    }
    // splash beads
    let n = 0;
    for (const b of beadState) {
      if (!b.alive) continue;
      b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.y < BED - 0.02) { b.alive = false; continue; }
      beads.setMatrixAt(n++, m4.compose(v3.set(b.x, b.y, b.z), q4.identity(), s3.setScalar(b.r)));
    }
    beads.count = n; beads.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- input
  const toNDC = (e) => { const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const onMove = (e) => { toNDC(e); pointerIn = true; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onMove);
  el.addEventListener('pointerleave', () => { pointerIn = false; cursor = null; });
  el.addEventListener('click', (e) => {
    toNDC(e); ray.setFromCamera(mouse, cam);
    if (ray.intersectObject(heart).length) { if (!tearT0 || clock - tearT0 > 3 || clock < tearT0) { tearT0 = clock; tearHit = null; } return; }
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (hit) {
      addRipple(clock, hit.x, hit.z, 0.09, 3.0, 1.8, 0.3);
      for (const p of P) { const d = Math.hypot(p.x - hit.x, p.z - hit.z); const k = clamp(1.1 - d / 0.9); if (k > p.blue) { p.blue = k; p.touched = clock + 1.5; } }
    }
  });

  // ---------------------------------------------------------------- resize / visibility
  const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h;
    cam.fov = w / h < 1 ? 38 : 24; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();
  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(el);

  // ---------------------------------------------------------------- loop
  let last = performance.now(), ft = 0.016, pr = renderer.getPixelRatio();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    clock += dt;
    const t = clock;
    // adaptive quality: slow devices drop resolution (never below 0.6x)
    ft = ft * 0.95 + dt * 0.05;
    if (t > 1.5 && ft > 0.034 && pr > 0.6) { pr = Math.max(0.6, pr - 0.15); renderer.setPixelRatio(pr); resize(); ft = 0.016; }
    if (!landed && t >= LAND) { landed = true; addRipple(t, HX, 0, 0.17, 3.4, 1.5, 0.38); }

    // camera: gentle parallax toward the pointer
    lookX += ((pointerIn ? mouse.x : 0) - lookX) * Math.min(1, dt * 3);
    lookY += ((pointerIn ? mouse.y : 0) - lookY) * Math.min(1, dt * 3);
    const intro = 1 - (1 - clamp(t / 2.2)) ** 5;
    cam.position.set(camHome.x + lookX * 0.6 - (1 - intro) * 2.4, camHome.y + lookY * 0.25 - (1 - intro) * 1.4, camHome.z - (1 - intro) * 4.2);
    cam.lookAt(look);

    // hover tests
    ray.setFromCamera(mouse, cam);
    hoverHeart = pointerIn && ray.intersectObject(heart).length ? 1 : 0;
    hoverK += (hoverHeart - hoverK) * Math.min(1, dt * 6);
    el.style.cursor = hoverHeart ? 'pointer' : '';
    beatPhase += dt * (0.62 + 0.55 * hoverK);
    cursorPrev = cursor;
    cursor = pointerIn && !hoverHeart ? ray.ray.intersectPlane(plane, new THREE.Vector3()) : null;

    heartMatrix(t, HM);
    heartPivot.matrixAutoUpdate = false; heartPivot.matrix.copy(HM);
    tearUpdate(dt);

    // capsules
    const amb = reduce ? 0 : 1;
    const footK = clamp((t - LAND) * 6);
    const sweepX = -7.5 + t * 11;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      let z = amb * (Math.sin(p.x * 1.15 + t * 2.1) * Math.sin(p.z * 0.85 + t * 1.5) * 0.026 + Math.sin((p.x + p.z) * 0.62 - t * 2.6) * 0.016);
      if (t < 1.25) z += 0.085 * Math.exp(-(((p.x - sweepX) / 0.55) ** 2));
      for (const r of ripples) {
        const dt2 = t - r.t0; if (dt2 <= 0) continue;
        const d = Math.hypot(p.x - r.x, p.z - r.z), env = Math.exp(-dt2 * r.decay);
        z += r.amp * env * Math.exp(-(((d - dt2 * r.speed) / r.width) ** 2)) - r.amp * 0.9 * Math.exp(-((d / 0.45) ** 2)) * Math.exp(-dt2 * 7);
      }
      z -= 0.11 * footK * Math.exp(-(((p.x - HX - 0.05) / 0.42) ** 2 + (p.z / 0.36) ** 2));
      // cursor brush: lift + paint blue (also along the path between frames, so fast swipes leave no gaps)
      let target = 0;
      if (cursor) {
        let d = Math.hypot(p.x - cursor.x, p.z - cursor.z);
        if (cursorPrev) {
          const ax = cursorPrev.x, az = cursorPrev.z, bx = cursor.x - ax, bz = cursor.z - az, L2 = bx * bx + bz * bz;
          if (L2 > 1e-6) { const u = clamp(((p.x - ax) * bx + (p.z - az) * bz) / L2); d = Math.min(d, Math.hypot(p.x - ax - u * bx, p.z - az - u * bz)); }
        }
        const k = clamp(1 - d / 0.62);
        target = 0.09 * smooth(k);
        if (k > 0) { const b = smooth(clamp(k * 1.6)); if (b > p.blue) p.blue += (b - p.blue) * Math.min(1, dt * 14); p.touched = t; }
      }
      // spring for the lift (overshoot = jelly)
      p.liftV += ((target - p.lift) * 180 - p.liftV * 14) * dt; p.lift += p.liftV * dt;
      if (t - p.touched > 2.2 && p.blue > 0) p.blue = Math.max(0, p.blue - dt * 0.28);
      const sc = 1 + Math.max(z + p.lift, -0.05) * 1.6;
      m4.compose(v3.set(p.x, z + p.lift - 0.02, p.z), q4.setFromEuler(eul.set((p.rnd - 0.5) * 0.12, p.rot, (p.rnd - 0.5) * 0.12)), s3.set(1, sc, 1));
      caps.setMatrixAt(i, m4);
      tmpC.copy(p.rnd > 0.975 ? cPeach : cCream).lerp(cBlue, p.blue);
      caps.setColorAt(i, tmpC);
    }
    caps.instanceMatrix.needsUpdate = true; caps.instanceColor.needsUpdate = true;
    renderer.render(scene, cam);
  }
  requestAnimationFrame(frame);
  return { renderer, scene };
}

for (const el of document.querySelectorAll('[data-b2-heart]')) mountHeart(el).catch((e) => console.error('[b2-heart]', e));
