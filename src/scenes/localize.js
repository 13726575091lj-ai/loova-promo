// Scene 4 — Localize: the blue poster in a 3D card fan; the left panel names the market
// and language for each version (TH → JA → ES → KO), settling on English.
// Exit: the English card glides to centre (hand-off to the layer breakdown).
import { seg, ease, lerp, clamp, rgba, layoutText, layerCtl, withLayer, roundRectPath, hexToRgb, minHold } from '../util.js';
import { W, H, makeCam, dotFloor, fan3D, drawLines, vignette } from '../fx.js';
import { CARD, FRONT_X, CAM_D, drawLocalizeBg } from './shared.js';

const STEP = (24 * Math.PI) / 180;
const RZ = 900;
const PX = 150; // panel left edge

export function marketTimes(scene, dur) {
  const ms = scene.params.markets;
  const k = Math.min(1, dur / 5);
  const exit = scene.params.exit ?? 0.6 * Math.max(0.6, k);
  const sw = scene.params.swing ?? 0.4 * Math.max(0.6, k);
  const panelIn = scene.params.panelIn ?? 0.5;
  const U = dur - exit;
  if (scene.params.holdMode === 'auto') {
    // every market gets its minimum readable hold first; spare time is shared by weight
    const need = ms.map((m) => minHold(m.language));
    const avail = U - panelIn - sw * (ms.length - 1);
    const sumNeed = need.reduce((a, b) => a + b, 0);
    const tw = ms.reduce((s, m) => s + (m.weight ?? 1), 0);
    const hold = ms.map((m, i) => (avail >= sumNeed ? need[i] + ((avail - sumNeed) * (m.weight ?? 1)) / tw : (need[i] * avail) / sumNeed));
    const bounds = [];
    let c = panelIn;
    for (let i = 0; i < ms.length - 1; i++) {
      c += hold[i] + sw / 2;
      bounds.push(c);
      c += sw / 2;
    }
    return { exit, sw, U, bounds, panelIn };
  }
  const tot = ms.reduce((s, m) => s + (m.weight ?? 1), 0);
  let acc = 0;
  const bounds = ms.slice(0, -1).map((m) => (acc += m.weight ?? 1) / tot * U);
  return { exit, sw, U, bounds, panelIn };
}

/** continuous active-market index */
export function activeAt(t, T) {
  let a = 0;
  T.bounds.forEach((b, i) => {
    a += ease.inOutCubic(seg(t, b - T.sw / 2, b + T.sw / 2));
  });
  return a;
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const pal = P.palette, prm = scene.params, ms = prm.markets;
    const T = marketTimes(scene, dur);
    const a = activeAt(t, T);
    const kx = seg(t, dur - T.exit, dur, ease.inOutCubic);
    const spread = seg(t, 0.05, 0.75, ease.outCubic) * (1 - kx);

    drawLocalizeBg(ctx, P, 1);
    const dots = layerCtl(scene, 'dots');
    if (dots.visible) dotFloor(ctx, S.gT, { cam: makeCam({ z: 0 }), color: pal.blueGlow, alpha: 0.42 * dots.opacity * seg(t, 0, 0.6), speed: 260, y: 430, spacing: 120 });
    const fanL = layerCtl(scene, 'fan');
    if (fanL.visible)
      fan3D(ctx, t, { x: W / 2 + lerp(FRONT_X, 0, kx), y: H / 2, blades: 12, R: 1100, r0: 60, rot: -t * 0.25 - a * 0.5, tiltX: 0.95, tiltY: -0.25, colorA: pal.blueGlow, colorB: pal.blue, alpha: 0.16 * fanL.opacity * seg(t, 0, 0.6) * (1 - kx), width: 0.5 });

    // poster cards (WebGL planes)
    const pl = layerCtl(scene, 'posters');
    if (pl.visible) {
      const cam = makeCam({ z: -CAM_D, f: CAM_D });
      const navy = hexToRgb(pal.navy).map((v) => v / 255);
      const planes = ms.map((m, k) => {
        const d = k - a;
        const th = d * STEP * spread;
        let alpha = d < 0 ? clamp(1 + d * 1.3) : clamp(1 - d * 0.3) * (k === Math.round(a) ? 1 : Math.max(spread, d < 0.5 ? 1 : 0));
        if (k !== ms.length - 1) alpha *= 1 - kx;
        const isFront = Math.abs(d) < 0.5;
        const fx = (isFront ? lerp(FRONT_X, 0, kx) : FRONT_X) * pl.scale + pl.x;
        const { source, version } = S.poster.source(P, m.id);
        return {
          source, version, w: CARD.w * pl.scale, h: CARD.h * pl.scale, radius: CARD.r * pl.scale,
          x: fx + Math.sin(th) * RZ - (d < 0 ? (-d) * 120 * spread : 0), y: pl.y, z: RZ - Math.cos(th) * RZ + Math.abs(d) * 2,
          yaw: -th, alpha, tint: [navy[0], navy[1], navy[2], clamp(Math.abs(d) * 0.5) * 0.85],
        };
      });
      ctx.drawImage(S.gl.render(cam, planes), 0, 0);
    }

    // left panel
    withLayer(ctx, scene, 'panel', PX, H / 2, () => {
      const pi = T.panelIn / 0.5;
      const ent = (i) => seg(t, (0.05 + i * 0.05) * pi, (0.4 + i * 0.05) * pi, ease.outCubic);
      const off = (i) => -(1 - ent(i)) * 80 - kx * 120;
      const fade = (i) => ent(i) * (1 - seg(kx, 0, 0.6));
      ctx.save();
      // header
      const HL = layoutText(ctx, prm.header, { family: P.fonts.ui, weight: 700, size: 24, letterSpacing: 0.28, maxWidth: 760 });
      ctx.globalAlpha = 0.75 * fade(0);
      ctx.fillStyle = pal.ink;
      drawLines(ctx, HL, PX + off(0), 250, 'left');
      S.report('localize.header', { x: PX, y: 250 - HL.capH, w: HL.width, h: HL.capH }, fade(0), HL.fits);
      ctx.fillStyle = rgba(pal.blueGlow, 0.9);
      ctx.globalAlpha = fade(0);
      ctx.fillRect(PX + off(0), 278, 64 * ent(0), 4);

      // country row + hero language: vertical slot transition between markets
      ms.forEach((m, k) => {
        const d = k - a;
        const vis = clamp(1 - Math.abs(d) * 1.8);
        if (vis <= 0) return;
        const dy = d * 90;
        // code badge (auto width) + country
        const CL = layoutText(ctx, m.code, { family: P.fonts.ui, weight: 800, size: 22, letterSpacing: 0.08, maxWidth: 120 });
        const NL = layoutText(ctx, m.country, { family: P.fonts.ui, weight: 800, size: 30, letterSpacing: 0.14, maxWidth: 560 });
        const bw = CL.width + 28, bh = 42, by = 336 + dy * 0.6;
        ctx.globalAlpha = vis * fade(1);
        roundRectPath(ctx, PX + off(1), by, bw, bh, 8);
        ctx.fillStyle = pal.blue;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        drawLines(ctx, CL, PX + off(1) + bw / 2, by + bh / 2 + CL.capH / 2, 'center');
        ctx.fillStyle = pal.blueGlow;
        drawLines(ctx, NL, PX + off(1) + bw + 20, by + bh / 2 + NL.capH / 2, 'left');
        // hero native language name
        const LL = layoutText(ctx, m.language, { family: P.fonts[m.font] || P.fonts.ui, weight: 700, size: 128, maxWidth: 720, maxHeight: 190 });
        ctx.globalAlpha = vis * fade(2);
        ctx.fillStyle = '#ffffff';
        ctx.save();
        ctx.shadowColor = rgba(pal.blueGlow, 0.45);
        ctx.shadowBlur = 40;
        drawLines(ctx, LL, PX + off(2), 530 + dy, 'left');
        ctx.restore();
        if (vis > 0.95) {
          S.report('localize.language', { x: PX, y: 530 - LL.capH, w: LL.width, h: LL.capH }, vis, LL.fits);
          S.report('localize.country', { x: PX, y: by, w: bw + 20 + NL.width, h: bh }, vis, NL.fits);
        }
      });

      // hold progress line under the hero
      ctx.globalAlpha = fade(2) * 0.9;
      ctx.fillStyle = rgba('#ffffff', 0.14);
      ctx.fillRect(PX + off(2), 586, 640, 3);
      const idx = Math.round(a);
      const b0 = idx === 0 ? 0 : T.bounds[idx - 1] + T.sw / 2, b1 = idx < T.bounds.length ? T.bounds[idx] - T.sw / 2 : dur - T.exit;
      ctx.fillStyle = pal.blueGlow;
      ctx.fillRect(PX + off(2), 586, 640 * seg(t, b0, b1), 3);

      // market list with sliding highlight
      const LY = 662, RH = 58;
      ctx.globalAlpha = fade(3);
      roundRectPath(ctx, PX - 18 + off(3), LY + a * RH - 38, 520, 52, 10);
      ctx.fillStyle = rgba(pal.blue, 0.38);
      ctx.fill();
      ctx.fillStyle = pal.blueGlow;
      ctx.fillRect(PX - 18 + off(3), LY + a * RH - 38, 4, 52);
      ms.forEach((m, k) => {
        const on = clamp(1 - Math.abs(k - a));
        ctx.globalAlpha = fade(3 + k * 0.3) * (0.45 + 0.55 * on);
        const CL = layoutText(ctx, m.code, { family: P.fonts.ui, weight: 800, size: 18, letterSpacing: 0.12, maxWidth: 60 });
        ctx.fillStyle = on > 0.5 ? '#ffffff' : rgba('#ffffff', 0.8);
        drawLines(ctx, CL, PX + off(3), LY + k * RH, 'left');
        const LL = layoutText(ctx, m.language, { family: P.fonts[m.font] || P.fonts.ui, weight: 500, size: 25, maxWidth: 400 });
        drawLines(ctx, LL, PX + 70 + off(3), LY + k * RH, 'left');
      });
      ctx.restore();
    });
    vignette(ctx, 0.45, pal.navy);
  },

  cues(scene, P, dur) {
    const T = marketTimes(scene, dur);
    const out = [
      { t: 0, type: 'section', pattern: 'groove', len: dur - T.exit, chord: 0 },
      { t: 0.15, type: 'swish', len: 0.5, gain: 0.35, pan: -0.6 },
    ];
    T.bounds.forEach((b, i) => {
      out.push({ t: b - T.sw / 2, type: 'whoosh', len: T.sw + 0.05, gain: 0.5, pan: 0.5 });
      out.push({ t: b, type: 'tick', gain: 0.6, pan: -0.4 });
      out.push({ t: b + T.sw / 2, type: 'chord', chord: i + 1 });
      out.push({ t: b + T.sw / 2 - 0.02, type: 'pop', gain: 0.35 + (i === T.bounds.length - 1 ? 0.25 : 0) });
    });
    out.push({ t: dur - T.exit, type: 'swish', len: T.exit, gain: 0.45, pan: 0 });
    out.push({ t: dur - T.exit, type: 'section', pattern: 'fill', len: T.exit });
    return out;
  },

  holds(scene, P, dur) {
    const T = marketTimes(scene, dur);
    const ms = scene.params.markets;
    return ms.map((m, i) => ({
      label: `localize.${m.id}`, layer: 'panel', text: m.language,
      start: i === 0 ? T.panelIn : T.bounds[i - 1] + T.sw / 2, end: i < T.bounds.length ? T.bounds[i] - T.sw / 2 : dur - T.exit,
    }));
  },
};
