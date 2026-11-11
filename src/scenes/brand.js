// Scene 6 — Brand end card. The flat poster shrinks into the LOOVA icon (shape match),
// particles burst, the wordmark wipes on and the tagline settles. Ends on the logo.
import { seg, ease, lerp, rgba, layoutText, layerCtl, withLayer, roundRectPath } from '../util.js';
import { W, H, particleSphere, embers, drawIcon, drawWordmark, brandGradient, drawLines, vignette } from '../fx.js';
import { CARD, lockupLayout, drawFlowBg } from './shared.js';

function times(dur) {
  const k = Math.min(1, dur / 2.5);
  return { land: 0.6 * k, word: 0.7 * k, wordEnd: 1.1 * k, tag: 0.95 * k };
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params;
    const T = times(dur);
    const iconS = prm.iconSize ?? 190;
    const LK = lockupLayout(P, assets.logo, iconS);

    const light = !!prm.light;
    ctx.fillStyle = light ? pal.paper : pal.bg;
    ctx.fillRect(0, 0, W, H);
    if (light && prm.flowBg) drawFlowBg(ctx, P, S.gT, 1);
    const glowK = seg(t, T.land - 0.1, T.land + 0.6);
    const g = ctx.createRadialGradient(W / 2, LK.cy, 0, W / 2, LK.cy, 950);
    g.addColorStop(0, rgba(pal.cyan, 0.22 * glowK));
    g.addColorStop(0.5, rgba(pal.mint, 0.06 * glowK));
    g.addColorStop(1, rgba(light ? pal.paper : pal.bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const part = layerCtl(scene, 'particles');
    if (part.visible) {
      embers(ctx, t, { color: pal.mint, alpha: 0.4 * glowK * part.opacity, n: 80, speed: 40, seed: 11 });
      const ex = seg(t, T.land, T.land + 1.4, ease.outCubic);
      if (t >= T.land && ex < 1)
        particleSphere(ctx, t, { x: LK.icon.x + iconS / 2, y: LK.cy, r: iconS * 0.7, n: 700, seed: 21, colorA: pal.mint, colorB: pal.cyan, explode: ex * 1.6, alpha: (1 - ex) * part.opacity, spin: 0.1 });
    }

    // slow push plus a breathing pulse once the mark has landed
    const push = 1 + 0.03 * seg(t, T.land, dur) + (light ? 0.018 * seg(t, T.land + 0.1, T.land + 0.3) * Math.sin((t - T.land) * 7) : 0);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(push, push);
    ctx.translate(-W / 2, -H / 2);

    withLayer(ctx, scene, 'lockup', W / 2, LK.cy, () => {
      // poster -> icon morph
      const m = seg(t, 0, T.land, ease.inOutCubic);
      const tw = lerp(CARD.w, iconS, m), th = lerp(CARD.h, iconS, m);
      const cx = lerp(W / 2, LK.icon.x + iconS / 2, m), cy = lerp(H / 2, LK.cy, m);
      const rad = lerp(CARD.r, iconS * assets.logo.iconCornerRadius, m);
      const x = cx - tw / 2, y = cy - th / 2;
      const flat = S.poster.build(P).flat;
      const pa = 1 - seg(m, 0.35, 0.85);
      if (pa > 0) {
        ctx.save();
        roundRectPath(ctx, x, y, tw, th, rad);
        ctx.clip();
        ctx.drawImage(flat, x, y, tw, th);
        ctx.restore();
      }
      const ga = seg(m, 0.3, 0.85);
      if (ga > 0) {
        ctx.save();
        ctx.globalAlpha *= ga;
        const pd = Math.max(0, t - T.land) / 0.07;
        const pop = 1 + 0.07 * pd * Math.exp(1 - pd);
        ctx.translate(cx, cy);
        ctx.scale(pop, pop);
        ctx.translate(-cx, -cy);
        const bolt = seg(t, T.land - 0.15, T.land + 0.2, (v) => ease.outBack(v, 2.2));
        // icon drawn at morph size; corner radius follows the morph
        roundRectPath(ctx, x, y, tw, th, rad);
        ctx.fillStyle = brandGradient(ctx, x, y, tw, th, P);
        ctx.fill();
        if (bolt > 0) drawIcon(ctx, x, y, tw, P, assets.logo, { boltScale: bolt, fill: 'rgba(0,0,0,0)' });
        ctx.restore();
      }
      // wordmark wipe
      const wk = seg(t, T.word, T.wordEnd, ease.outCubic);
      if (wk > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(LK.word.x - 10, LK.word.y - 40, (LK.word.w + 30) * wk, LK.word.h + 80);
        ctx.clip();
        ctx.translate(-(1 - wk) * 60, 0);
        drawWordmark(ctx, LK.word.x, LK.word.y, LK.word.h, P, assets.logo, light ? flowInk(ctx, LK, t, P) : undefined);
        // glint
        const gl = seg(t, T.wordEnd + 0.25, T.wordEnd + 0.95);
        if (!light && gl > 0 && gl < 1) {
          const gx = lerp(LK.word.x - 200, LK.word.x + LK.word.w + 200, gl);
          const sg = ctx.createLinearGradient(gx - 90, 0, gx + 90, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)');
          sg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          drawWordmark(ctx, LK.word.x, LK.word.y, LK.word.h, P, assets.logo, sg);
        }
        ctx.restore();
      }
      S.report('brand.lockup', { x: LK.icon.x, y: LK.icon.y, w: LK.total, h: iconS }, wk, true);
    });

    // tagline in an auto-sized gradient-outline pill + sub line
    withLayer(ctx, scene, 'tagline', W / 2, 800, () => {
      const a = seg(t, T.tag, T.tag + 0.35, ease.outCubic);
      if (a <= 0) return;
      const TL = layoutText(ctx, prm.tagline, { family: P.fonts.ui, weight: 800, size: 32, letterSpacing: 0.16, maxWidth: 1400 });
      const bw = TL.width + 70, bh = 68, bx = W / 2 - bw / 2, by = LK.cy + iconS / 2 + 70 + (1 - a) * 18;
      ctx.save();
      ctx.globalAlpha *= a;
      roundRectPath(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = rgba('#ffffff', 0.04);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = brandGradient(ctx, bx, by, bw, bh, P, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      drawLines(ctx, TL, W / 2, by + bh / 2 + TL.capH / 2, 'center');
      const SL = layoutText(ctx, prm.sub, { family: P.fonts.ui, weight: 500, size: 21, letterSpacing: 0.34, maxWidth: 1400 });
      ctx.globalAlpha *= seg(t, T.tag + 0.15, T.tag + 0.5);
      ctx.fillStyle = rgba('#ffffff', 0.72);
      drawLines(ctx, SL, W / 2, by + bh + 58, 'center');
      ctx.restore();
      S.report('brand.tagline', { x: bx, y: by, w: bw, h: bh }, a, TL.fits);
      S.report('brand.sub', { x: W / 2 - SL.width / 2, y: by + bh + 58 - SL.capH, w: SL.width, h: SL.capH }, a, SL.fits);
    });
    ctx.restore();
    if (!light) vignette(ctx, 0.4);
  },

  cues(scene, P, dur) {
    const T = times(dur);
    return [
      { t: 0, type: 'section', pattern: 'pre', len: T.land },
      { t: 0.0, type: 'suck', len: T.land, gain: 0.5 },
      { t: T.land, type: 'impact', gain: 1.0, size: 1.2 },
      { t: T.land, type: 'section', pattern: 'finale', len: dur - T.land },
      { t: T.word, type: 'shimmer', len: 0.9, gain: 0.45 },
      { t: T.tag, type: 'pop', gain: 0.35 },
      { t: T.wordEnd + 0.25, type: 'sparkle', gain: 0.35 },
    ];
  },

  holds(scene, P, dur) {
    const T = times(dur);
    return [
      { label: 'brand.lockup', layer: 'lockup', text: P.brand.name, start: T.wordEnd, end: dur },
      { label: 'brand.tagline', layer: 'tagline', text: scene.params.tagline, start: T.tag + 0.35, end: dur },
    ];
  },
};

/** light theme wordmark: ink with a mint→cyan band that keeps flowing across the letters */
function flowInk(ctx, LK, t, P) {
  const m = P.palette[P.brand.gradientStart] || '#00F5A0', c = P.palette[P.brand.gradientEnd] || '#00D9F5';
  const w = LK.word.w, x0 = LK.word.x;
  const f = ((t * 0.9) % 1) * 2 - 0.5;
  const g = ctx.createLinearGradient(x0 - w * 0.5, 0, x0 + w * 1.5, 0);
  const at = (p) => Math.max(0, Math.min(1, p));
  // deep teal → cyan base (no black) with a bright mint band flowing through
  g.addColorStop(0, '#04685C');
  g.addColorStop(at(f / 2 + 0.1), '#078C9E');
  g.addColorStop(at(f / 2 + 0.2), m);
  g.addColorStop(at(f / 2 + 0.28), c);
  g.addColorStop(at(f / 2 + 0.38), '#077CB4');
  g.addColorStop(1, '#04685C');
  return g;
}
