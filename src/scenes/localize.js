// Scene 4 — Localize: the blue poster in a 3D card fan; the left panel names the market
// and language for each version (TH → JA → ES → KO), settling on English.
// Exit: the English card glides to centre (hand-off to the layer breakdown).
import { seg, ease, lerp, clamp, rgba, layoutText, layerCtl, withLayer, roundRectPath, hexToRgb, minHold } from '../util.js';
import { W, H, makeCam, dotFloor, fan3D, drawLines } from '../fx.js';
import { drawFlag } from '../flags.js';
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
    if (dots.visible) dotFloor(ctx, S.gT, { cam: makeCam({ z: 0 }), color: pal.blue, alpha: 0.32 * dots.opacity * seg(t, 0, 0.6), speed: 260, y: 430, spacing: 120, composite: 'source-over' });
    const fanL = layerCtl(scene, 'fan');
    if (fanL.visible)
      fan3D(ctx, t, { x: W / 2 + lerp(FRONT_X, 0, kx), y: H / 2, blades: 12, R: 1100, r0: 60, rot: -t * 0.25 - a * 0.5, tiltX: 0.95, tiltY: -0.25, colorA: pal.blueGlow, colorB: pal.paper, alpha: 0.07 * fanL.opacity * seg(t, 0, 0.6) * (1 - kx), width: 0.5, composite: 'source-over' });

    // poster cards (WebGL planes)
    const pl = layerCtl(scene, 'posters');
    if (pl.visible) {
      const cam = makeCam({ z: -CAM_D, f: CAM_D });
      const navy = hexToRgb(pal.paper).map((v) => v / 255); // back cards fade toward the white field
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
          yaw: -th, alpha, tint: [navy[0], navy[1], navy[2], clamp(Math.abs(d) * 0.5) * 0.6],
        };
      });
      ctx.drawImage(S.gl.render(cam, planes), 0, 0);
    }

    // left panel: flag + country, the language in its own script, and a market list where
    // markets not reached yet show only their flag; the active one opens to its language.
    withLayer(ctx, scene, 'panel', PX, H / 2, () => {
      const pi = T.panelIn / 0.5;
      const ent = (i) => seg(t, (0.05 + i * 0.05) * pi, (0.4 + i * 0.05) * pi, ease.outCubic);
      const off = (i) => -(1 - ent(i)) * 80 - kx * 120;
      const fade = (i) => ent(i) * (1 - seg(kx, 0, 0.6));
      const ink = pal.posterInk, blue = pal.blue;
      ctx.save();
      const HL = layoutText(ctx, prm.header, { family: P.fonts.ui, weight: 700, size: 24, letterSpacing: 0.28, maxWidth: 760 });
      ctx.globalAlpha = fade(0);
      ctx.fillStyle = blue;
      drawLines(ctx, HL, PX + off(0), 250, 'left');
      S.report('localize.header', { x: PX, y: 250 - HL.capH, w: HL.width, h: HL.capH }, fade(0), HL.fits);
      ctx.fillRect(PX + off(0), 278, 64 * ent(0), 4);

      ms.forEach((m, k) => {
        const d = k - a;
        const vis = clamp(1 - Math.abs(d) * 1.8);
        if (vis <= 0) return;
        const dy = d * 90;
        // flag (3:2) + country name; the flag lands slightly before the language (it leads the swing)
        const fw = 78, fh = 52, fy = 330 + dy * 0.6;
        ctx.save();
        ctx.globalAlpha = vis * fade(1);
        ctx.shadowColor = 'rgba(10,30,60,0.18)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        drawFlag(ctx, m.id, PX + off(1), fy, fw, fh, 8);
        ctx.restore();
        const NL = layoutText(ctx, m.country, { family: P.fonts.ui, weight: 800, size: 30, letterSpacing: 0.14, maxWidth: 560 });
        ctx.globalAlpha = vis * fade(1);
        ctx.fillStyle = blue;
        drawLines(ctx, NL, PX + off(1) + fw + 22, fy + fh / 2 + NL.capH / 2, 'left');
        const LL = layoutText(ctx, m.language, { family: P.fonts[m.font] || P.fonts.ui, weight: 700, size: 128, maxWidth: 720, maxHeight: 190 });
        ctx.globalAlpha = vis * fade(2);
        ctx.fillStyle = ink;
        drawLines(ctx, LL, PX + off(2), 530 + dy, 'left');
        if (vis > 0.95) {
          S.report('localize.language', { x: PX, y: 530 - LL.capH, w: LL.width, h: LL.capH }, vis, LL.fits);
          S.report('localize.country', { x: PX, y: fy, w: fw + 22 + NL.width, h: fh }, vis, NL.fits);
        }
      });

      ctx.globalAlpha = fade(2);
      ctx.fillStyle = rgba(blue, 0.15);
      ctx.fillRect(PX + off(2), 586, 640, 3);
      const idx = Math.round(a);
      const b0 = idx === 0 ? T.panelIn : T.bounds[idx - 1] + T.sw / 2, b1 = idx < T.bounds.length ? T.bounds[idx] - T.sw / 2 : dur - T.exit;
      ctx.fillStyle = blue;
      ctx.fillRect(PX + off(2), 586, 640 * seg(t, b0, b1), 3);

      // market list: flag chips; the active row widens and shows its language
      const LY = 640, RH = 66, cw = 57, ch = 38;
      ms.forEach((m, k) => {
        const on = clamp(1 - Math.abs(k - a));
        const done = clamp(a - k + 1); // reached at least once
        const y = LY + k * RH;
        ctx.save();
        ctx.globalAlpha = fade(3 + k * 0.3);
        if (on > 0.01) {
          const LL = layoutText(ctx, m.language, { family: P.fonts[m.font] || P.fonts.ui, weight: 600, size: 30, maxWidth: 360 });
          const pillW = cw + 30 + (LL.width + 26) * ease.outCubic(on);
          roundRectPath(ctx, PX - 12 + off(3), y - 8, pillW, ch + 16, (ch + 16) / 2);
          ctx.fillStyle = rgba(blue, 0.1 + 0.06 * on);
          ctx.fill();
          ctx.save();
          ctx.globalAlpha *= on;
          ctx.fillStyle = ink;
          ctx.beginPath();
          ctx.rect(PX + off(3) + cw + 16, y - 10, (LL.width + 26) * ease.outCubic(on), ch + 20);
          ctx.clip();
          drawLines(ctx, LL, PX + off(3) + cw + 16, y + ch / 2 + LL.capH / 2, 'left');
          ctx.restore();
        }
        ctx.globalAlpha *= 0.55 + 0.45 * Math.max(on, done * 0.6);
        drawFlag(ctx, m.id, PX + off(3), y, cw, ch, 5);
        ctx.restore();
      });
      ctx.restore();
    });
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
