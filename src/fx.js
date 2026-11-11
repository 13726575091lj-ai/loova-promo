// Procedural motion-graphics building blocks shared by every scene:
// perspective camera, moving dot matrix, particle sphere, 3D fan, chrome type, logo.
import { clamp, lerp, rng, rgba, hexToRgb, ease, roundRectPath } from './util.js';

export const W = 1920;
export const H = 1080;

// ------------------------------------------------------------------ camera
export function makeCam({ x = 0, y = 0, z = -1600, yaw = 0, pitch = 0, roll = 0, f = 1600 } = {}) {
  return { x, y, z, yaw, pitch, roll, f, cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll) };
}
/** world -> view space (camera looks down +z) */
export function toView(cam, X, Y, Z) {
  let x = X - cam.x, y = Y - cam.y, z = Z - cam.z;
  // yaw (around Y)
  let x1 = x * cam.cy - z * cam.sy;
  let z1 = x * cam.sy + z * cam.cy;
  // pitch (around X)
  let y1 = y * cam.cp - z1 * cam.sp;
  let z2 = y * cam.sp + z1 * cam.cp;
  // roll
  const x2 = x1 * cam.cr - y1 * cam.sr;
  const y2 = x1 * cam.sr + y1 * cam.cr;
  return [x2, y2, z2];
}
export function proj(cam, X, Y, Z) {
  const [x, y, z] = toView(cam, X, Y, Z);
  const zz = Math.max(1, z);
  return { x: W / 2 + (cam.f * x) / zz, y: H / 2 + (cam.f * y) / zz, z, s: cam.f / zz };
}

// ------------------------------------------------------------------ sprites
const spriteCache = new Map();
export function glowSprite(hex, size = 64, hard = 0.35) {
  const key = hex + size + hard;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = new OffscreenCanvas(size, size);
  const g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(hex);
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(hard, `rgba(${r},${gg},${b},0.85)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ moving dot matrix
/**
 * Perspective floor (and optional ceiling) of dots scrolling toward camera.
 * Dots fade in at the far plane and out near the lens, so the wrap never pops.
 */
export function dotFloor(ctx, t, o = {}) {
  const { color = '#ffffff', alpha = 0.5, speed = 600, spacing = 110, y = 420, cols = 34, rows = 46, size = 5, horizonFade = 0.9, cam = makeCam({ z: 0 }), ceiling = false, composite = 'lighter' } = o;
  const spr = glowSprite(color, 32, 0.5);
  const off = (t * speed) % spacing;
  ctx.save();
  ctx.globalCompositeOperation = composite;
  const planes = ceiling ? [y, -y] : [y];
  for (const py of planes) {
    for (let r = 0; r < rows; r++) {
      const z = 150 + r * spacing - off;
      const zf = (z - 150) / (rows * spacing);
      const a = alpha * clamp(zf / 0.06) * clamp((1 - zf) / (1 - horizonFade + 1e-3)) * clamp((z - 150) / 250);
      if (a <= 0.003) continue;
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * spacing;
        const p = proj(cam, x, py, z);
        if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
        const s = size * p.s * 2.2;
        ctx.globalAlpha = a;
        ctx.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
      }
    }
  }
  ctx.restore();
}

/** Flat screen-space dot grid with a travelling wave of dot sizes. */
export function dotWave(ctx, t, o = {}) {
  const { color = '#ffffff', alpha = 0.25, spacing = 36, size = 3.2, speed = 1.2, dir = [1, 0.35], amp = 0.8, freq = 0.012, drift = [0, -24] } = o;
  ctx.save();
  ctx.fillStyle = color;
  const dx = (t * drift[0]) % spacing, dy = (t * drift[1]) % spacing;
  for (let y = -spacing; y < H + spacing; y += spacing) {
    for (let x = -spacing; x < W + spacing; x += spacing) {
      const px = x + dx, py = y + dy;
      const w = Math.sin((px * dir[0] + py * dir[1]) * freq - t * speed * Math.PI * 2);
      const r = size * (1 + amp * w) * 0.5 + 0.4;
      ctx.globalAlpha = alpha * (0.55 + 0.45 * w);
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.2, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ particle sphere
const sphereCache = new Map();
function spherePoints(n, seed) {
  const key = n + ':' + seed;
  if (sphereCache.has(key)) return sphereCache.get(key);
  const R = rng(seed);
  const pts = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = ga * i;
    pts.push({
      x: Math.cos(th) * r, y, z: Math.sin(th) * r,
      // scatter origin (for the assemble animation)
      sx: (R() - 0.5) * 5, sy: (R() - 0.5) * 3, sz: (R() - 0.5) * 4,
      d: R(), // per-particle delay / noise
      e: R(),
    });
  }
  sphereCache.set(key, pts);
  return pts;
}

/**
 * Particle sphere. assemble 0..1 flies particles in from a scatter cloud,
 * explode 0..1 bursts them outward, collapse 0..1 shrinks to a point.
 */
export function particleSphere(ctx, t, o = {}) {
  const { x = W / 2, y = H / 2, r = 260, n = 1400, seed = 7, colorA = '#00F5A0', colorB = '#00D9F5', assemble = 1, explode = 0, collapse = 0, spin = 0.35, tilt = 0.35, alpha = 1, size = 3.2, f = 1400 } = o;
  const pts = spherePoints(n, seed);
  const sprA = glowSprite(colorA, 32, 0.4), sprB = glowSprite(colorB, 32, 0.4);
  const ay = t * spin * Math.PI * 2, ax = tilt;
  const ca = Math.cos(ay), sa = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const rad = r * (1 - ease.inCubic(collapse));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of pts) {
    // assemble with per-particle stagger
    const k = ease.outCubic(clamp((assemble - p.d * 0.35) / 0.65));
    let px = lerp(p.sx, p.x, k), py = lerp(p.sy, p.y, k), pz = lerp(p.sz, p.z, k);
    // breathing noise
    const n1 = 1 + 0.04 * Math.sin(t * 3 + p.e * 20);
    const ex = 1 + explode * (1.5 + p.e * 3.5);
    px *= n1 * ex; py *= n1 * ex; pz *= n1 * ex;
    // rotate
    const x1 = px * ca - pz * sa, z1 = px * sa + pz * ca;
    const y1 = py * cx - z1 * sx, z2 = py * sx + z1 * cx;
    const zz = f / (f + z2 * rad);
    const X = x + x1 * rad * zz, Y = y + y1 * rad * zz;
    const depth = (z2 + 1) / 2; // 0 front .. 1 back
    const a = alpha * (0.25 + 0.75 * (1 - depth)) * (1 - explode * 0.8) * clamp(assemble * 3) * (1 - collapse * 0.3);
    if (a < 0.01) continue;
    const s = size * zz * (1.4 - depth * 0.6) * 2.4;
    ctx.globalAlpha = a;
    ctx.drawImage((p.y + 1) / 2 > 0.5 ? sprA : sprB, X - s / 2, Y - s / 2, s, s);
  }
  ctx.restore();
}

/** Floating embers (deterministic), drifting upward. */
export function embers(ctx, t, o = {}) {
  const { n = 90, seed = 3, color = '#00F5A0', alpha = 0.6, speed = 60, size = 3, area = [0, 0, W, H] } = o;
  const R = rng(seed);
  const spr = glowSprite(color, 32, 0.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bx = R(), by = R(), sp = 0.4 + R(), ph = R() * 6.28, sz = 0.4 + R();
    const yy = area[1] + ((by * area[3] - t * speed * sp) % area[3] + area[3]) % area[3];
    const xx = area[0] + bx * area[2] + Math.sin(t * 0.8 + ph) * 20;
    // fade near the wrap edges to avoid popping
    const edge = clamp(Math.min(yy - area[1], area[1] + area[3] - yy) / 80);
    const tw = 0.6 + 0.4 * Math.sin(t * 2.2 + ph * 3);
    ctx.globalAlpha = alpha * edge * tw;
    const s = size * sz * 3;
    ctx.drawImage(spr, xx - s / 2, yy - s / 2, s, s);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ 3D fan
/** Sector blades on a tilted disc rotating in 3D ("3D 扇形"). spread 0..1 widens blades to a full disc. */
export function fan3D(ctx, t, o = {}) {
  const { x = W / 2, y = H / 2, blades = 9, R = 900, r0 = 40, rot = 0, tiltX = 1.05, tiltY = 0.0, z0 = 1400, f = 1400, colorA = '#00F5A0', colorB = '#00D9F5', alpha = 0.35, width = 0.45, spread = 0, segs = 18, composite = 'lighter' } = o;
  const cxa = Math.cos(tiltX), sxa = Math.sin(tiltX), cya = Math.cos(tiltY), sya = Math.sin(tiltY);
  const P = (a, rr) => {
    let px = Math.cos(a) * rr, py = Math.sin(a) * rr, pz = 0;
    // tilt around X
    let y1 = py * cxa - pz * sxa, z1 = py * sxa + pz * cxa;
    // tilt around Y
    const x1 = px * cya + z1 * sya, z2 = -px * sya + z1 * cya;
    const s = f / (z0 + z2);
    return [x + x1 * s, y + y1 * s];
  };
  const step = (Math.PI * 2) / blades;
  const wd = lerp(width, 1.0, spread) * step;
  ctx.save();
  ctx.globalCompositeOperation = composite;
  for (let k = 0; k < blades; k++) {
    const a0 = rot + k * step;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const [px, py] = P(a0 + (wd * i) / segs, R);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    for (let i = segs; i >= 0; i--) {
      const [px, py] = P(a0 + (wd * i) / segs, r0);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    const [ex, ey] = P(a0 + wd / 2, R);
    const g = ctx.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, rgba(colorA, alpha));
    g.addColorStop(1, rgba(colorB, alpha * 0.15));
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ type effects
/** Chrome / gradient display type with extrusion and glow (reference: 4s title card). */
export function displayText(ctx, L, x, baseline, o = {}) {
  const { stops = [[0, '#ffffff'], [1, '#9aa3ad']], extrude = 0, extrudeColor = '#1a1d22', glow = 0, glowColor = '#ffffff', stroke = 0, strokeColor = '#000', scaleY = 1, align = 'center', shine = -1, shineColor = 'rgba(255,255,255,0.9)' } = o;
  const top = baseline - L.capH * scaleY;
  ctx.save();
  ctx.translate(0, baseline);
  ctx.scale(1, scaleY);
  ctx.translate(0, -baseline);
  // extrusion: stacked offset copies
  if (extrude > 0) {
    ctx.fillStyle = extrudeColor;
    const n = Math.ceil(extrude / 2);
    for (let i = n; i >= 1; i--) {
      drawLines(ctx, L, x + i * 0.5, baseline + (i * 2) / scaleY, align);
    }
  }
  if (glow > 0) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glow;
    ctx.fillStyle = glowColor;
    ctx.globalAlpha *= 0.35;
    drawLines(ctx, L, x, baseline, align);
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, baseline - L.capH, 0, baseline + (L.lines.length - 1) * L.lineStep);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  drawLines(ctx, L, x, baseline, align);
  if (stroke > 0) {
    ctx.lineWidth = stroke;
    ctx.strokeStyle = strokeColor;
    drawLines(ctx, L, x, baseline, align, true);
  }
  if (shine >= 0 && shine <= 1) {
    // light sweep: glyphs refilled with a narrow band gradient (glyph shapes act as the mask)
    const sx = lerp(x - L.width, x + L.width, shine);
    const sg = ctx.createLinearGradient(sx - 160, 0, sx + 160, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, shineColor);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.globalAlpha *= 0.85;
    drawLines(ctx, L, x, baseline, align);
  }
  ctx.restore();
  return { top, bottom: baseline + (L.lines.length - 1) * L.lineStep * scaleY };
}

export function drawLines(ctx, L, x, y, align = 'center', strokeOnly = false) {
  ctx.font = L.font;
  ctx.letterSpacing = `${L.letterSpacing}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  L.lines.forEach((line, i) => {
    const w = L.widths[i] - L.letterSpacing * L.scaleX;
    let px = x;
    if (align === 'center') px = x - w / 2;
    else if (align === 'right') px = x - w;
    const py = y + i * L.lineStep;
    // draw in the caller's coordinate space so gradient fills stay anchored to the layout
    if (L.scaleX === 1) {
      strokeOnly ? ctx.strokeText(line, px, py) : ctx.fillText(line, px, py);
      return;
    }
    ctx.save();
    ctx.translate(px, 0);
    ctx.scale(L.scaleX, 1);
    strokeOnly ? ctx.strokeText(line, 0, py) : ctx.fillText(line, 0, py);
    ctx.restore();
  });
  ctx.letterSpacing = '0px';
}

// ------------------------------------------------------------------ logo (vector, traced from supplied artwork)
export function brandGradient(ctx, x, y, w, h, project, angleDeg) {
  const a = ((angleDeg ?? project.brand.gradientAngle) * Math.PI) / 180;
  const cx = x + w / 2, cy = y + h / 2, L = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(a) * L, cy + Math.sin(a) * L, cx + Math.cos(a) * L, cy - Math.sin(a) * L);
  g.addColorStop(0, project.palette[project.brand.gradientEnd] || project.brand.gradientEnd);
  g.addColorStop(1, project.palette[project.brand.gradientStart] || project.brand.gradientStart);
  return g;
}

function polyPath(ctx, polys, ox, oy, s) {
  ctx.beginPath();
  for (const p of polys) {
    p.forEach(([px, py], i) => (i ? ctx.lineTo(ox + px * s, oy + py * s) : ctx.moveTo(ox + px * s, oy + py * s)));
    ctx.closePath();
  }
}

/** LOOVA app icon: rounded square in brand gradient with the bolt knocked out. */
export function drawIcon(ctx, x, y, size, project, logo, o = {}) {
  const { radius = logo.iconCornerRadius, boltScale = 1, boltColor = '#05070A', fill } = o;
  ctx.save();
  roundRectPath(ctx, x, y, size, size, size * radius);
  ctx.fillStyle = fill || brandGradient(ctx, x, y, size, size, project);
  ctx.fill();
  if (boltScale > 0) {
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(boltScale, boltScale);
    ctx.translate(-size / 2, -size / 2);
    polyPath(ctx, logo.bolt, 0, 0, size);
    ctx.fillStyle = boltColor;
    ctx.fill('evenodd');
  }
  ctx.restore();
}

/** LOOVA wordmark at a given cap height; returns drawn width. */
export function drawWordmark(ctx, x, y, h, project, logo, fill) {
  const w = logo.wordmark.aspect * h;
  ctx.save();
  polyPath(ctx, logo.wordmark.polys, x, y, h);
  ctx.fillStyle = fill || brandGradient(ctx, x, y, w, h, project, 0);
  ctx.fill('evenodd');
  ctx.restore();
  return w;
}

/** Motion blur helper: draw fn n times along an offset vector with split alpha. */
export function smear(ctx, n, dx, dy, fn) {
  if (n <= 1 || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return fn(0, 1);
  const base = ctx.globalAlpha;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1) - 0.5;
    ctx.save();
    ctx.translate(dx * k, dy * k);
    ctx.globalAlpha = base * (1.6 / n);
    fn(k, 1 / n);
    ctx.restore();
  }
}

export function vignette(ctx, strength = 0.55, color = '#000') {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------------ polka-dot field
/**
 * Staggered polka-dot grid. rOf(x, y, row, col) returns each dot's radius, so the same
 * grid serves as a steady pattern, a halftone wipe (dots grow to cover the frame) and the
 * reverse (dots shrink back to the pattern). Offsets move the grid without changing geometry.
 */
export function polkaField(ctx, { spacing = 64, color = '#FF3D9A', rOf, offX = 0, offY = 0, alpha = 1 }) {
  const ox = ((offX % spacing) + spacing) % spacing, oy = ((offY % (spacing * 2)) + spacing * 2) % (spacing * 2);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let row = -2; row * spacing < H + spacing * 2; row++) {
    const y = row * spacing + oy - spacing;
    const shift = (row & 1) * (spacing / 2);
    for (let col = -2; col * spacing < W + spacing * 2; col++) {
      const x = col * spacing + ox + shift - spacing;
      const r = rOf(x, y, row, col);
      if (r <= 0.15) continue;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}
/** dot radius that fully covers a staggered grid of this spacing */
export const polkaCover = (spacing) => spacing * 0.76;
