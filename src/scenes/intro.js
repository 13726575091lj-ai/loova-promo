// Scene 1 — "Ignite": a moving dot-matrix floor and a particle sphere that assembles,
// spins up and collapses into a point of light (hands off to the title shockwave).
import { seg, ease, rgba, layoutText, layerCtl, withLayer } from '../util.js';
import { W, H, dotFloor, particleSphere, makeCam, glowSprite, drawLines, vignette } from '../fx.js';

const COLLAPSE = 0.42;

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const pal = P.palette;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const asm = seg(t, 0, dur * 0.62);
    const col = seg(t, dur - COLLAPSE, dur, ease.inCubic);

    // teal ambience
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
    g.addColorStop(0, rgba(pal.cyan, 0.16 * asm * (1 - col)));
    g.addColorStop(1, rgba(pal.bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const dots = layerCtl(scene, 'dots');
    if (dots.visible) {
      const cam = makeCam({ z: 0, pitch: -0.02 });
      dotFloor(ctx, S.gT, { cam, color: pal.mint, alpha: 0.55 * dots.opacity * seg(t, 0, 0.5), speed: 520 + 900 * col, y: 380, ceiling: true });
    }

    withLayer(ctx, scene, 'sphere', W / 2, H / 2, () => {
      particleSphere(ctx, t + col * col * 1.2, {
        r: scene.params.sphereRadius ?? 250, n: scene.params.particles ?? 1500,
        colorA: pal.mint, colorB: pal.cyan, assemble: asm, collapse: col, spin: 0.22, tilt: 0.4,
      });
      // core light that the collapse feeds
      const core = seg(t, dur - COLLAPSE * 0.8, dur, ease.inQuad);
      if (core > 0) {
        const s = 40 + 260 * core;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = core;
        ctx.drawImage(glowSprite('#ffffff', 128, 0.15), W / 2 - s / 2, H / 2 - s / 2, s, s);
        ctx.restore();
      }
    });

    const kIn = seg(t, 0.15, 0.45, ease.outCubic), kOut = seg(t, dur - 0.4, dur - 0.22);
    withLayer(ctx, scene, 'kicker', W / 2, 900, () => {
      const L = layoutText(ctx, scene.params.kicker, { family: P.fonts.ui, weight: 600, size: 22, letterSpacing: 0.42, maxWidth: 1200 });
      ctx.save();
      ctx.globalAlpha *= kIn * (1 - kOut);
      ctx.fillStyle = pal.ink;
      drawLines(ctx, L, W / 2, 905 + (1 - kIn) * 14, 'center');
      ctx.restore();
      S.report('intro.kicker', { x: W / 2 - L.width / 2, y: 905 - L.capH, w: L.width, h: L.capH }, kIn * (1 - kOut), L.fits);
    });
    vignette(ctx, 0.6);
    // white-out that the title's opening flash continues from
    const wo = seg(t, dur - 0.16, dur, ease.inQuad);
    if (wo > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.85 * wo})`;
      ctx.fillRect(0, 0, W, H);
    }
  },

  cues(scene, P, dur) {
    return [
      { t: 0, type: 'section', pattern: 'intro', len: dur },
      { t: 0.05, type: 'riser', len: dur - 0.05, gain: 0.55 },
      { t: dur - COLLAPSE, type: 'suck', len: COLLAPSE, gain: 0.7 },
    ];
  },

  holds(scene, P, dur) {
    return [{ label: 'intro.kicker', layer: 'kicker', text: scene.params.kicker, start: 0.45, end: dur - 0.4 }];
  },
};
