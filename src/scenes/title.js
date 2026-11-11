// Scene 2 — Title card (reference: 4s "Higgsfield / CONTENT FACTORY").
// Row 1: LOOVA icon + wordmark. Row 2: chrome "SEEDANCE". Row 3: brand-gradient "5.5".
// Exit: the 3D fan behind the type opens up and floods the frame pink (hand-off to slot).
import { seg, ease, lerp, rgba, mixHex, layoutText, layerCtl, withLayer } from '../util.js';
import { W, H, fan3D, embers, displayText, drawIcon, drawWordmark, smear, vignette } from '../fx.js';

const EXIT = 0.55;
const SLAM = 0.24; // slam-in duration
const ROW1_Y = 262, L1_BASE = 585, L2_BASE = 868;

function times(scene, dur) {
  const p = scene.params;
  const k = Math.min(1, dur / 3.5); // compress keyframes for short cuts
  return { t1: (p.line1At ?? 0.3) * k, t2: (p.line2At ?? 0.62) * k, exit: dur - EXIT * Math.max(0.6, k) };
}

function shake(t, hits) {
  let x = 0, y = 0;
  for (const [ti, a] of hits) {
    const d = t - ti;
    if (d < 0) continue;
    // single damped kick (no sustained oscillation, avoids strobing)
    const e = a * (d / 0.05) * Math.exp(1 - d / 0.05);
    x += e * 0.6;
    y += e;
  }
  return [x, y];
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params;
    const { t1, t2, exit } = times(scene, dur);
    const kx = seg(t, exit, dur, ease.inOutCubic);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04090A');
    bg.addColorStop(1, '#06120F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const [sx, sy] = shake(t, [[t1 + SLAM, 9], [t2 + SLAM, 13]]);
    ctx.save();
    ctx.translate(sx, sy);

    // pink base fades in under the opening fan so blade seams never show dark gaps
    if (kx > 0) {
      ctx.fillStyle = rgba(pal.pink, seg(t, exit, dur - 0.04));
      ctx.fillRect(-60, -60, W + 120, H + 120);
    }
    const fan = layerCtl(scene, 'fan');
    if (fan.visible) {
      fan3D(ctx, t, {
        x: W / 2, y: lerp(470, H / 2, kx), blades: 10, R: lerp(1350, 2600, kx), r0: lerp(30, 0, kx),
        rot: t * 0.32 + kx * 1.2, tiltX: lerp(1.12, 0.0, kx), tiltY: Math.sin(t * 0.6) * 0.12,
        colorA: mixHex(pal.mint, pal.pink, kx), colorB: mixHex(pal.cyan, pal.pinkDeep, kx),
        alpha: fan.opacity * lerp(0.16, 1, kx), width: 0.42, spread: kx, composite: 'source-over',
      });
    }
    const part = layerCtl(scene, 'particles');
    if (part.visible) embers(ctx, t, { color: pal.mint, alpha: 0.55 * part.opacity * (1 - kx), n: 110, speed: 70 });

    // shockwave hand-off from the intro collapse
    const sw = seg(t, 0, 0.55, ease.outCubic);
    if (sw < 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#ffffff', 0.9 * (1 - sw));
      ctx.lineWidth = 2 + 30 * (1 - sw);
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 20 + sw * 1300, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.85 * (1 - seg(t, 0, 0.22)));
      ctx.fillRect(-50, -50, W + 100, H + 100);
      ctx.restore();
    }

    // type group: slow push-in, then fly-through on exit
    const push = 1 + 0.035 * seg(t, t2, dur) + 0.9 * ease.inCubic(kx);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(push, push);
    ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha = 1 - seg(kx, 0.05, 0.5);

    // row 1 — brand
    const r1 = seg(t, 0.12, 0.45, ease.outCubic);
    withLayer(ctx, scene, 'brandRow', W / 2, ROW1_Y, () => {
      const iconS = 66, wordH = 50, gap = 20;
      const wordW = assets.logo.wordmark.aspect * wordH;
      const total = iconS + gap + wordW;
      const x0 = W / 2 - total / 2;
      ctx.save();
      ctx.globalAlpha *= r1;
      ctx.translate(0, (1 - r1) * 24);
      drawIcon(ctx, x0, ROW1_Y - iconS / 2, iconS, P, assets.logo);
      drawWordmark(ctx, x0 + iconS + gap, ROW1_Y - wordH / 2, wordH, P, assets.logo, '#ffffff');
      ctx.restore();
      S.report('title.brandRow', { x: x0, y: ROW1_Y - iconS / 2, w: total, h: iconS }, r1, true);
    });

    // row 2 — SEEDANCE (chrome)
    withLayer(ctx, scene, 'line1', W / 2, L1_BASE - 100, () => {
      const k = seg(t, t1, t1 + SLAM);
      if (k <= 0) return;
      const e = ease.outExpo(k);
      const s = lerp(2.4, 1, e);
      const L = layoutText(ctx, prm.line1, { family: P.fonts.display, size: 236, maxWidth: 1600, letterSpacing: -0.01 });
      ctx.save();
      ctx.globalAlpha *= seg(t, t1, t1 + 0.06);
      ctx.translate(W / 2, L1_BASE - 100);
      ctx.scale(s, s);
      ctx.translate(-W / 2, -(L1_BASE - 100));
      const v = (1 - e) * 60;
      smear(ctx, v > 2 ? 6 : 1, 0, v, () =>
        displayText(ctx, L, W / 2, L1_BASE, {
          scaleY: 1.2, extrude: 12, extrudeColor: '#15191E', glow: 34, glowColor: '#ffffff',
          stops: [[0, '#FFFFFF'], [0.48, '#F3F5F7'], [0.62, '#B4BDC6'], [1, pal.chromeBottom]],
          shine: seg(t, t2 + 0.5, t2 + 1.3),
        })
      );
      ctx.restore();
      S.report('title.line1', { x: W / 2 - L.width / 2, y: L1_BASE - L.capH * 1.2, w: L.width, h: L.capH * 1.2 }, k, L.fits);
    });

    // row 3 — 5.5 (brand gradient)
    withLayer(ctx, scene, 'line2', W / 2, L2_BASE - 150, () => {
      const k = seg(t, t2, t2 + SLAM);
      if (k <= 0) return;
      const e = ease.outBack(k, 1.4);
      const L = layoutText(ctx, prm.line2, { family: P.fonts.display, size: 336, maxWidth: 1500, letterSpacing: 0.0 });
      ctx.save();
      ctx.globalAlpha *= seg(t, t2, t2 + 0.06);
      ctx.translate(0, (1 - e) * 300);
      const sc = lerp(1.35, 1, ease.outCubic(k));
      ctx.translate(W / 2, L2_BASE - 150);
      ctx.scale(sc, sc);
      ctx.translate(-W / 2, -(L2_BASE - 150));
      const v = (1 - ease.outCubic(k)) * 90;
      smear(ctx, v > 2 ? 6 : 1, 0, v, () =>
        displayText(ctx, L, W / 2, L2_BASE, {
          scaleY: 1.2, extrude: 14, extrudeColor: '#02372A', glow: 50, glowColor: pal.mint,
          stops: [[0, '#FFFFFF'], [0.22, mixHex('#ffffff', pal.mint, 0.6)], [0.55, pal.mint], [1, pal.cyan]],
          shine: seg(t, t2 + 0.8, t2 + 1.6),
        })
      );
      ctx.restore();
      S.report('title.line2', { x: W / 2 - L.width / 2, y: L2_BASE - L.capH * 1.2, w: L.width, h: L.capH * 1.2 }, k, L.fits);
    });
    ctx.restore();
    ctx.restore();

    // guarantee a clean pink frame for the cut into the slot scene
    const flood = seg(t, dur - 0.1, dur);
    if (flood > 0) {
      ctx.fillStyle = rgba(pal.pink, flood);
      ctx.fillRect(0, 0, W, H);
    }
    vignette(ctx, 0.5 * (1 - kx));
  },

  cues(scene, P, dur) {
    const { t1, t2, exit } = times(scene, dur);
    return [
      { t: 0, type: 'impact', gain: 0.55, size: 0.6 },
      { t: Math.max(0, t1 - 0.06), type: 'whoosh', len: 0.3, gain: 0.5, pan: -0.3 },
      { t: t1 + SLAM, type: 'impact', gain: 0.9, size: 0.9 },
      { t: t1 + SLAM, type: 'section', pattern: 'drop', len: exit - (t1 + SLAM) },
      { t: Math.max(t1 + SLAM + 0.05, t2 - 0.06), type: 'whoosh', len: 0.3, gain: 0.5, pan: 0.3 },
      { t: t2 + SLAM, type: 'impact', gain: 1.0, size: 1.0 },
      { t: t2 + 0.8, type: 'shimmer', len: 0.8, gain: 0.35 },
      { t: exit, type: 'sweep', len: dur - exit, gain: 0.75 },
      { t: exit, type: 'section', pattern: 'fill', len: dur - exit },
    ];
  },

  holds(scene, P, dur) {
    const { t1, t2, exit } = times(scene, dur);
    return [
      { label: 'title.brandRow', layer: 'brandRow', text: P.brand.name, start: 0.45, end: exit + 0.15 },
      { label: 'title.line1', layer: 'line1', text: scene.params.line1, start: t1 + SLAM, end: exit + 0.15 },
      { label: 'title.line2', layer: 'line2', text: scene.params.line2, start: t2 + SLAM, end: exit + 0.15 },
    ];
  },
};
