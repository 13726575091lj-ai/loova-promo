// Scene 5 — Layer breakdown (reference: exploded wireframe stack).
// The English poster separates into its editable layers in depth while the camera orbits,
// then the stack recombines flat at centre (hand-off to the brand lockup).
import { seg, ease, lerp, clamp, rgba, layoutText, layerCtl, withLayer, roundRectPath } from '../util.js';
import { W, H, makeCam, toView, dotFloor, drawLines, vignette } from '../fx.js';
import { CARD, CAM_D, drawLocalizeBg } from './shared.js';

function times(dur) {
  const k = Math.min(1, dur / 3.5);
  return { k, inEnd: 1.0 * k, outStart: dur - 0.85 * Math.max(0.65, k) };
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
    const { k, inEnd, outStart } = times(dur);
    const o = seg(t, 0.05, inEnd + 0.2, ease.inOutCubic);
    const r = seg(t, outStart, dur - 0.08, ease.inOutCubic);
    const orbit = o * (1 - r);

    // backgrounds: navy (from localize) -> charcoal -> brand black
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#202227');
    bg.addColorStop(1, pal.charcoal);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const fromNavy = 1 - seg(t, 0, 0.55);
    drawLocalizeBg(ctx, P, fromNavy);
    const dots = layerCtl(scene, 'dots');
    if (dots.visible) {
      const cam0 = makeCam({ z: 0 });
      dotFloor(ctx, S.gT, { cam: cam0, color: pal.blueGlow, alpha: 0.42 * fromNavy * dots.opacity, speed: 260, y: 430, spacing: 120 });
      dotFloor(ctx, S.gT, { cam: cam0, color: '#9aa0a8', alpha: 0.22 * (1 - fromNavy) * (1 - r) * dots.opacity, speed: 260, y: 430, spacing: 120 });
    }
    if (r > 0) {
      ctx.fillStyle = rgba(pal.bg, r);
      ctx.fillRect(0, 0, W, H);
    }

    const kit = S.poster.build(P);
    const layers = kit.layers.filter((l) => l.visible);
    const n = layers.length;
    const c = (n - 1) / 2;
    const sep = prm.separation ?? 150;
    const yaw = ((prm.yawDeg ?? -38) * Math.PI) / 180 * orbit + 0.07 * seg(t, inEnd, outStart, ease.inOutQuad) * (1 - r);
    const pitch = ((prm.pitchDeg ?? 9) * Math.PI) / 180 * orbit;
    const D = lerp(CAM_D, CAM_D * 1.38, orbit);
    const cam = orbitCam(yaw, pitch, D);

    const planes = layers.map((L, i) => {
      const si = seg(t, (0.15 + i * 0.06) * k, inEnd + i * 0.06 * k, ease.outCubic) * (1 - r);
      return { L, i, source: L.source, version: kit.version, x: -150 * orbit, y: 0, z: (c - i) * sep * si, w: CARD.w, h: CARD.h, radius: CARD.r, alpha: L.opacity };
    });
    ctx.drawImage(S.gl.render(cam, planes, { sort: false }), 0, 0);

    // wireframes + labels
    const fA = seg(t, 0.3 * k, 0.75 * k) * (1 - seg(t, outStart, outStart + 0.3 * k));
    const fr = layerCtl(scene, 'frames'), lb = layerCtl(scene, 'labels');
    if (fA > 0) {
      ctx.save();
      for (const p of planes) {
        const pts = rrPoints(CARD.w, CARD.h, CARD.r).map(([u, v]) => {
          const [x, y, z] = toView(cam, u + p.x, v, p.z);
          return [W / 2 + (cam.f * x) / z, H / 2 + (cam.f * y) / z];
        });
        if (fr.visible) {
          ctx.globalAlpha = fA * fr.opacity * 0.9;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.stroke();
        }
        if (lb.visible) {
          // label column on the right, leader line to each layer's top-right corner
          const la = seg(t, (0.55 + p.i * 0.07) * k, (0.85 + p.i * 0.07) * k) * fA * lb.opacity;
          if (la <= 0) continue;
          const [x, y, z] = toView(cam, p.x + CARD.w / 2, -CARD.h / 2 + 40 + p.i * 6, p.z);
          const sx = W / 2 + (cam.f * x) / z, sy = H / 2 + (cam.f * y) / z;
          const T = layoutText(ctx, `${String(p.i + 1).padStart(2, '0')}  ${p.L.label}`, { family: P.fonts.ui, weight: 700, size: 16, letterSpacing: 0.2, maxWidth: 300 });
          const bw = T.width + 26, bh = 34;
          const lx = 1500 + (1 - la) * 30, ly = 250 + (n - 1 - p.i) * 62;
          ctx.globalAlpha = la;
          ctx.strokeStyle = rgba('#ffffff', 0.55);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(lx - 40, ly);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          roundRectPath(ctx, lx, ly - bh / 2, bw, bh, 7);
          ctx.fillStyle = rgba('#000000', 0.6);
          ctx.fill();
          ctx.strokeStyle = rgba('#ffffff', 0.45);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          drawLines(ctx, T, lx + 13, ly + T.capH / 2, 'left');
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
          S.report(`layers.label${p.i}`, { x: lx, y: ly - bh / 2, w: bw, h: bh }, la, T.fits);
        }
      }
      ctx.restore();
    }

    // caption in an auto-sized pill
    withLayer(ctx, scene, 'caption', W / 2, 1000, () => {
      const ca = seg(t, inEnd - 0.1, inEnd + 0.25, ease.outCubic) * (1 - seg(t, outStart - 0.1, outStart + 0.2));
      if (ca <= 0) return;
      const T = layoutText(ctx, prm.caption, { family: P.fonts.ui, weight: 700, size: 26, letterSpacing: 0.32, maxWidth: 1100 });
      const bw = T.width + 64, bh = 60, bx = W / 2 - bw / 2, by = 985 - bh / 2 + (1 - ca) * 16;
      ctx.save();
      ctx.globalAlpha *= ca;
      roundRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = rgba('#000000', 0.45);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.blueGlow, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      drawLines(ctx, T, W / 2, by + bh / 2 + T.capH / 2, 'center');
      ctx.restore();
      S.report('layers.caption', { x: bx, y: by, w: bw, h: bh }, ca, T.fits);
    });
    vignette(ctx, 0.45 * fromNavy, pal.navy);
    vignette(ctx, 0.4 * (1 - fromNavy));
  },

  cues(scene, P, dur) {
    const { inEnd, outStart } = times(dur);
    const n = Object.values(P.poster.en.layers).filter((l) => l.visible !== false).length;
    const out = [
      { t: 0, type: 'section', pattern: 'breakdown', len: dur },
      { t: 0.05, type: 'subdrop', gain: 0.8 },
      { t: 0.05, type: 'swish', len: inEnd, gain: 0.4, pan: -0.5 },
      { t: outStart, type: 'suck', len: dur - outStart, gain: 0.5 },
    ];
    for (let i = 0; i < n; i++) out.push({ t: 0.15 + i * 0.06 + 0.25, type: 'glass', note: i, gain: 0.32 });
    return out;
  },

  holds(scene, P, dur) {
    const { inEnd, outStart } = times(dur);
    return [{ label: 'layers.caption', layer: 'caption', text: scene.params.caption, start: inEnd + 0.25, end: outStart - 0.1 }];
  },
};
