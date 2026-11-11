// Scene 1 — Runway open + kinetic title (reference: Higgsfield "Content Factory" card at 4 s).
// The supplied runway clip plays as an image sequence; as the title lands the footage
// exposure drops (no plate behind the type). Row 1: LOOVA icon + wordmark. Row 2: SEEDREAM,
// a per-letter cascade with vertical motion trails and a squash on landing. Row 3: 5.5 in a
// flowing brand gradient. Exit: pink polka dots grow out from "5.5" until they cover the frame
// (the slot scene starts on the same dot grid and shrinks it back).
import { seg, ease, lerp, clamp, rgba, mixHex, layoutText, layerCtl, withLayer } from '../util.js';
import { W, H, drawIcon, drawWordmark, embers, polkaField, polkaCover } from '../fx.js';

export const OPEN_SPACING = 64;
const ROW1 = 300, L1_BASE = 640, L2_BASE = 930;

export function openTimes(scene, dur) {
  const p = scene.params;
  const k = Math.min(1, dur / 2.0);
  return {
    darken: (p.darkenAt ?? 0.45) * k,
    row1: (p.row1At ?? 0.55) * k,
    l1: (p.line1At ?? 0.62) * k,
    l2: (p.line2At ?? 0.86) * k,
    stagger: (p.letterStagger ?? 0.032) * k,
    fall: 0.2 * Math.max(0.75, k),
    exit: dur - (p.exitLen ?? 0.34) * Math.max(0.75, k),
  };
}

/** letters of a single-line layout with their x positions (left edge), centred on cx */
function glyphRun(ctx, L, cx) {
  ctx.font = L.font;
  ctx.letterSpacing = `${L.letterSpacing}px`;
  const text = L.lines[0];
  const chars = [...text];
  const total = ctx.measureText(text).width - L.letterSpacing;
  let x0 = cx - total / 2;
  const out = [];
  let prefix = '';
  for (const ch of chars) {
    const x = x0 + (prefix ? ctx.measureText(prefix).width : 0);
    const w = ctx.measureText(ch).width - L.letterSpacing;
    out.push({ ch, x, w });
    prefix += ch;
  }
  ctx.letterSpacing = '0px';
  return { glyphs: out, total };
}

function footageFrame(S, t) {
  const F = S.assets.footage;
  if (!F || !F.frames.length) return null;
  const p = S.scene.params;
  const src = (p.clipIn ?? 0) + t * (p.playbackRate ?? 1);
  const i = Math.max(0, Math.min(F.frames.length - 1, Math.floor(src * F.fps + 1e-6)));
  return F.frames[i]; // clamps on the last frame, never loops
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params;
    const T = openTimes(scene, dur);
    const kx = seg(t, T.exit, dur, ease.inQuad);

    // ---------------------------------------------------------------- footage
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    withLayer(ctx, scene, 'footage', W / 2, H / 2, (Lc) => {
      const img = footageFrame(S, t);
      if (!img) return;
      // camera follows the model walking toward the lens: slow push-in, eased at both ends
      const push = 1.0 + 0.07 * ease.inOutQuad(seg(t, 0, dur));
      const s = Math.max(W / img.width, H / img.height) * push;
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, W / 2 - dw / 2, H / 2 - dh / 2 - (push - 1) * 260, dw, dh);
      // exposure ramp under the type (replaces any plate behind text)
      const ex = seg(t, T.darken, T.darken + 0.3, ease.inOutCubic) * (prm.darken ?? 0.62);
      if (ex > 0) {
        ctx.fillStyle = `rgba(4,8,10,${ex})`;
        ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, H * 1.05);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${ex * 0.6})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    });
    const part = layerCtl(scene, 'particles');
    if (part.visible) embers(ctx, t, { color: pal.mint, alpha: 0.45 * part.opacity * seg(t, T.l2, T.l2 + 0.3), n: 60, speed: 90, size: 2.6, seed: 5 });

    // ---------------------------------------------------------------- type group
    const settle = seg(t, T.l2 + T.fall, dur, ease.outCubic);
    const groupS = 1 + 0.03 * settle + 0.08 * ease.inCubic(kx);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(groupS, groupS);
    ctx.translate(-W / 2, -H / 2);

    // row 1 — LOOVA icon + wordmark (brand gradient)
    withLayer(ctx, scene, 'brandRow', W / 2, ROW1, () => {
      const k = seg(t, T.row1, T.row1 + 0.32, ease.outExpo);
      if (k <= 0) return;
      const iconS = 74, wordH = 56, gap = 22;
      const wordW = assets.logo.wordmark.aspect * wordH;
      const total = iconS + gap + wordW, x0 = W / 2 - total / 2;
      ctx.save();
      ctx.globalAlpha *= clamp(k * 1.6);
      ctx.translate(W / 2, ROW1);
      ctx.scale(lerp(0.94, 1, k), lerp(0.94, 1, k));
      ctx.translate(-W / 2, -ROW1 + (1 - k) * 26);
      ctx.filter = k < 1 ? `blur(${(1 - k) * 8}px)` : 'none';
      drawIcon(ctx, x0, ROW1 - iconS / 2, iconS, P, assets.logo);
      drawWordmark(ctx, x0 + iconS + gap, ROW1 - wordH / 2, wordH, P, assets.logo);
      ctx.restore();
      S.report('open.brandRow', { x: x0, y: ROW1 - iconS / 2, w: total, h: iconS }, k, true);
    });

    // row 2 — SEEDREAM: per-letter cascade (chrome white)
    withLayer(ctx, scene, 'line1', W / 2, L1_BASE - 120, () => {
      const L = layoutText(ctx, prm.line1, { family: P.fonts.display, size: 250, maxWidth: 1640, letterSpacing: -0.005 });
      const { glyphs, total } = glyphRun(ctx, L, W / 2);
      const SY = 1.18;
      let shown = 0;
      glyphs.forEach((gph, i) => {
        const t0 = T.l1 + i * T.stagger;
        const k = seg(t, t0, t0 + T.fall);
        if (k <= 0) return;
        shown++;
        const e = ease.outExpo(k);
        const dy = -(1 - e) * 380;
        const land = Math.max(0, t - (t0 + T.fall * 0.55));
        const squash = 1 - 0.1 * Math.exp(-land * 22) * (land > 0 ? Math.sin(Math.min(Math.PI, land * 40)) : 0);
        drawLetter(ctx, L, gph, L1_BASE + dy, SY * squash, {
          stops: [[0, '#FFFFFF'], [0.5, '#F4F6F8'], [0.64, '#B9C2CB'], [1, '#7D8792']],
          extrude: '#11161B', glow: 'rgba(255,255,255,0.55)', trail: (1 - e), trailColor: 'rgba(255,255,255,', alpha: clamp(k * 3),
          shine: seg(t, T.l2 + 0.25, T.l2 + 0.95), runX0: W / 2 - total / 2, runW: total,
        });
      });
      if (shown) S.report('open.line1', { x: W / 2 - total / 2, y: L1_BASE - L.capH * SY, w: total, h: L.capH * SY }, seg(t, T.l1 + glyphs.length * T.stagger, T.l1 + glyphs.length * T.stagger + T.fall), L.fits);
    });

    // row 3 — 5.5: drops in as a block with trail, then the gradient keeps flowing
    withLayer(ctx, scene, 'line2', W / 2, L2_BASE - 160, () => {
      const L = layoutText(ctx, prm.line2, { family: P.fonts.display, size: 330, maxWidth: 1500 });
      const { glyphs, total } = glyphRun(ctx, L, W / 2);
      const SY = 1.18;
      glyphs.forEach((gph, i) => {
        const t0 = T.l2 + i * T.stagger * 0.8;
        const k = seg(t, t0, t0 + T.fall * 1.1);
        if (k <= 0) return;
        const e = ease.outExpo(k);
        const dy = (1 - e) * 420; // rises from below: opposite direction to row 2, meets in the middle
        const flow = (t * 0.55) % 1;
        const m = pal[P.brand.gradientStart] || '#00F5A0', c = pal[P.brand.gradientEnd] || '#00D9F5';
        drawLetter(ctx, L, gph, L2_BASE + dy, SY, {
          stops: flowStops(flow, ['#FFFFFF', mixHex('#FFFFFF', m, 0.55), m, c, mixHex(c, '#7CFFE0', 0.4)]),
          extrude: '#033A2C', glow: rgba(m, 0.6), trail: 1 - e, trailColor: `rgba(0,245,160,`, alpha: clamp(k * 3),
          runX0: W / 2 - total / 2, runW: total, vertical: true,
        });
      });
      const k = seg(t, T.l2, T.l2 + T.fall * 1.2);
      S.report('open.line2', { x: W / 2 - total / 2, y: L2_BASE - L.capH * SY, w: total, h: L.capH * SY }, k, L.fits);
    });
    ctx.restore();

    // ---------------------------------------------------------------- exit: halftone dots grow from "5.5"
    if (kx > 0) {
      const cx = W / 2, cy = L2_BASE - 160, maxD = Math.hypot(W, H) * 0.62, spread = 0.9;
      const cover = polkaCover(OPEN_SPACING);
      polkaField(ctx, {
        spacing: OPEN_SPACING, color: pal.pink,
        rOf: (x, y) => {
          const d = Math.hypot(x - cx, y - cy) / maxD;
          return cover * ease.outCubic(clamp((kx * (1 + spread) - d * spread) / 1));
        },
      });
    }
  },

  cues(scene, P, dur) {
    const T = openTimes(scene, dur);
    const n1 = [...String(scene.params.line1 ?? '')].length;
    const out = [
      { t: 0, type: 'section', pattern: 'intro', len: T.l1 },
      { t: 0.02, type: 'riser', len: T.l1 - 0.02, gain: 0.5 },
      { t: T.row1, type: 'shimmer', len: 0.5, gain: 0.3 },
      { t: Math.max(0, T.l1 - 0.08), type: 'whoosh', len: 0.26, gain: 0.45, pan: -0.2 },
      { t: T.l1 + T.fall * 0.55, type: 'impact', gain: 0.75, size: 0.8 },
      { t: T.l1 + T.fall * 0.55, type: 'section', pattern: 'drop', len: T.exit - (T.l1 + T.fall * 0.55) },
      { t: T.l2 + T.fall * 0.6, type: 'impact', gain: 1.0, size: 1.0 },
      { t: T.l2 + 0.25, type: 'shimmer', len: 0.6, gain: 0.3 },
      { t: T.exit, type: 'sweep', len: dur - T.exit, gain: 0.7 },
      { t: T.exit, type: 'section', pattern: 'fill', len: dur - T.exit },
    ];
    // one soft tick per SEEDREAM letter landing (after the first, which carries the impact)
    for (let i = 1; i < n1; i++) out.push({ t: T.l1 + i * T.stagger + T.fall * 0.55, type: 'tick', gain: 0.22, pan: (i / (n1 - 1)) * 1.2 - 0.6 });
    return out;
  },

  holds(scene, P, dur) {
    const T = openTimes(scene, dur);
    const n1 = [...String(scene.params.line1 ?? '')].length;
    return [
      { label: 'open.brandRow', layer: 'brandRow', text: P.brand.name, start: T.row1 + 0.3, end: T.exit + 0.12 },
      { label: 'open.line1', layer: 'line1', text: scene.params.line1, start: T.l1 + (n1 - 1) * T.stagger + T.fall, end: T.exit + 0.12 },
      { label: 'open.line2', layer: 'line2', text: scene.params.line2, start: T.l2 + T.fall * 1.1, end: T.exit + 0.12 },
    ];
  },
};

/** gradient stops scrolled by `flow` (0..1) so the colour band keeps travelling through the glyphs */
function flowStops(flow, colors) {
  const n = colors.length;
  const stops = [];
  for (let i = 0; i <= n * 2; i++) {
    const p = i / n - flow;
    if (p < -1 / n || p > 1 + 1 / n) continue;
    stops.push([clamp(p), colors[i % n]]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  return stops.length >= 2 ? stops : [[0, colors[0]], [1, colors[n - 1]]];
}

/** one glyph with extrusion, vertical motion trail, glow, gradient fill and optional shine */
function drawLetter(ctx, L, g, baseline, sy, o) {
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = L.font;
  ctx.textBaseline = 'alphabetic';
  ctx.translate(g.x, baseline);
  ctx.scale(1, sy);
  // motion trail: echoes above/below along the direction of travel
  if (o.trail > 0.02) {
    for (let k = 1; k <= 4; k++) {
      ctx.save();
      ctx.fillStyle = o.trailColor + (0.16 * o.trail * (1 - k / 5)).toFixed(3) + ')';
      ctx.fillText(g.ch, 0, (o.vertical ? 1 : -1) * k * 70 * o.trail);
      ctx.restore();
    }
  }
  // extrusion
  ctx.fillStyle = o.extrude;
  for (let i = 7; i >= 1; i--) ctx.fillText(g.ch, i * 0.5, i * 1.8);
  // glow
  ctx.save();
  ctx.shadowColor = o.glow;
  ctx.shadowBlur = 36;
  ctx.fillStyle = o.glow;
  ctx.globalAlpha *= 0.4;
  ctx.fillText(g.ch, 0, 0);
  ctx.restore();
  // gradient fill (vertical; same on every letter so the word reads as one material)
  const grd = ctx.createLinearGradient(0, -L.capH, 0, 0);
  o.stops.forEach(([p, c]) => grd.addColorStop(p, c));
  ctx.fillStyle = grd;
  ctx.fillText(g.ch, 0, 0);
  // shine sweep across the whole word, clipped by refilling the glyph
  if (o.shine > 0 && o.shine < 1) {
    const sx = lerp(-300, o.runW + 300, o.shine) + o.runX0 - g.x;
    const sg = ctx.createLinearGradient(sx - 140, 0, sx + 140, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillText(g.ch, 0, 0);
  }
  ctx.restore();
}
