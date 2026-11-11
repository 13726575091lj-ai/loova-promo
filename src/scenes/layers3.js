// v3 Scene 5 — Layer showcase on white. The English poster splits into its editable layers and
// the camera visits several angles (three-quarter left, three-quarter right, high angle) on one
// continuous Hermite path, then the stack closes flat at centre for the brand hand-off.
import { seg, ease, lerp, clamp, rgba, layoutText, layerCtl, roundRectPath } from '../util.js';
import { W, H, makeCam, toView, dotFloor, drawLines } from '../fx.js';
import { CARD, CAM_D, drawLocalizeBg, drawFlowBg } from './shared.js';

const D2R = Math.PI / 180;

/** camera keyframes: time fraction, yaw, pitch, separation (0..1), distance factor, stack x */
function keys(prm) {
  const a = prm.angles || [
    [0.22, -38, 10],
    [0.48, 34, -7],
    [0.72, -14, 30],
  ];
  return [
    { u: 0, yaw: 0, pitch: 0, sep: 0, dist: 1, x: 0 },
    ...a.map(([u, y, p], i) => ({ u, yaw: y * D2R, pitch: p * D2R, sep: 1, dist: 1.42 + (i === 2 ? 0.08 : 0), x: i === 1 ? -40 : -150 })),
    { u: 0.9, yaw: 0, pitch: 0, sep: 0, dist: 1, x: 0 },
    { u: 1, yaw: 0, pitch: 0, sep: 0, dist: 1, x: 0 },
  ];
}

/** piecewise cubic Hermite (finite-difference tangents, zero at the ends) */
function sample(K, u, f) {
  let i = 0;
  while (i < K.length - 2 && u > K[i + 1].u) i++;
  const a = K[i], b = K[i + 1];
  const h = b.u - a.u || 1e-6;
  const s = clamp((u - a.u) / h);
  const tan = (j) => (j <= 0 || j >= K.length - 1 ? 0 : (K[j + 1][f] - K[j - 1][f]) / (K[j + 1].u - K[j - 1].u));
  // stops (sep 0) and the ends get zero tangents so the camera eases in and out of them
  const m0 = a.sep === 0 ? 0 : tan(i) * 0.6, m1 = b.sep === 0 ? 0 : tan(i + 1) * 0.6;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * a[f] + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * b[f] + (s3 - s2) * h * m1;
}

function orbitCam(yaw, pitch, D) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
  return makeCam({ x: -D * cp * sy, y: -D * sp, z: -D * cp * cy, yaw, pitch, f: CAM_D });
}

function rrPoints(w, h, r, n = 6) {
  const pts = [];
  const cs = [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * (Math.PI / 2);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const pal = P.palette, prm = scene.params;
    const K = keys(prm);
    const u = clamp(t / dur);
    const yaw = sample(K, u, 'yaw'), pitch = sample(K, u, 'pitch'), sepK = clamp(sample(K, u, 'sep'));
    const D = CAM_D * sample(K, u, 'dist'), sx = sample(K, u, 'x');
    const cam = orbitCam(yaw, pitch, D);

    if (prm.flowBg) drawFlowBg(ctx, P, S.gT, 1);
    else {
      ctx.fillStyle = pal.paper;
      ctx.fillRect(0, 0, W, H);
      drawLocalizeBg(ctx, P, 1 - seg(t, 0, 0.4));
    }
    const dots = layerCtl(scene, 'dots');
    if (dots.visible) dotFloor(ctx, S.gT, { cam: makeCam({ z: 0 }), color: pal.blue, alpha: 0.26 * dots.opacity, speed: 260, y: 430, spacing: 120, composite: 'source-over' });

    const kit = S.poster.build(P);
    const layers = kit.layers.filter((l) => l.visible);
    const n = layers.length, c = (n - 1) / 2;
    const sep = prm.separation ?? 190;
    const planes = layers.map((L, i) => {
      // layers peel off one after another, and close in reverse order
      const lag = (i / Math.max(1, n - 1)) * 0.25;
      const si = clamp(sepK * (1 + lag) - lag * (1 - sepK));
      return { L, i, source: L.source, version: kit.version, x: sx, y: 0, z: (c - i) * sep * si, w: CARD.w, h: CARD.h, radius: CARD.r, alpha: L.opacity };
    });
    ctx.drawImage(S.gl.render(cam, planes, { sort: false }), 0, 0);

    // wireframes + labels while the stack is open
    const fA = seg(sepK, 0.25, 0.7);
    const fr = layerCtl(scene, 'frames'), lb = layerCtl(scene, 'labels');
    if (fA > 0) {
      ctx.save();
      for (const p of planes) {
        const pts = rrPoints(CARD.w, CARD.h, CARD.r).map(([uu, vv]) => {
          const [x, y, z] = toView(cam, uu + p.x, vv, p.z);
          return [W / 2 + (cam.f * x) / z, H / 2 + (cam.f * y) / z];
        });
        if (fr.visible) {
          ctx.globalAlpha = fA * fr.opacity;
          ctx.strokeStyle = pal.blueGlow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = pal.blueGlow;
          for (const [x, y] of [pts[0], pts[7], pts[14], pts[21]]) ctx.fillRect(x - 4, y - 4, 8, 8);
        }
        if (lb.visible) {
          const la = fA * lb.opacity * seg(t, 0.12 * dur + p.i * 0.025, 0.2 * dur + p.i * 0.025);
          if (la <= 0) continue;
          const [x, y, z] = toView(cam, p.x + CARD.w / 2, -CARD.h / 2 + 40 + p.i * 6, p.z);
          const px = W / 2 + (cam.f * x) / z, py = H / 2 + (cam.f * y) / z;
          const TL = layoutText(ctx, `${String(p.i + 1).padStart(2, '0')}  ${p.L.label}`, { family: P.fonts.ui, weight: 800, size: 17, letterSpacing: 0.18, maxWidth: 300 });
          const bw = TL.width + 28, bh = 36;
          const lx = 1500 + (1 - la) * 30, ly = 250 + (n - 1 - p.i) * 64;
          ctx.globalAlpha = la;
          ctx.strokeStyle = rgba(pal.blue, 0.6);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(lx - 40, ly);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          roundRectPath(ctx, lx, ly - bh / 2, bw, bh, bh / 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = pal.blueGlow;
          ctx.stroke();
          ctx.fillStyle = pal.blue;
          drawLines(ctx, TL, lx + 14, ly + TL.capH / 2, 'left');
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          S.report(`layers.label${p.i}`, { x: lx, y: ly - bh / 2, w: bw, h: bh }, la, TL.fits);
        }
      }
      ctx.restore();
    }
  },

  cues(scene, P, dur) {
    const K = keys(scene.params);
    const n = Object.values(P.poster.en.layers).filter((l) => l.visible !== false).length;
    const out = [
      { t: 0, type: 'section', pattern: 'breakdown', len: dur },
      { t: 0.03, type: 'subdrop', gain: 0.7 },
    ];
    // a camera move between every pair of angles
    for (let i = 0; i < K.length - 2; i++) {
      const a = K[i].u * dur, b = K[i + 1].u * dur;
      out.push({ t: a + 0.01, type: i === K.length - 3 ? 'suck' : 'swish', len: Math.max(0.15, b - a), gain: 0.42, pan: i % 2 ? 0.5 : -0.5 });
    }
    for (let i = 0; i < n; i++) out.push({ t: 0.1 * dur + i * 0.035, type: 'glass', note: i, gain: 0.3 });
    return out;
  },

  holds() {
    return [];
  },
};
