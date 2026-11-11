// v3 Scene 2 — Pink slot reel on white (reference: the "HOOK AD / VIRAL REEL / WHAT IF" reel).
// Model names ride a vertical cylinder: rows bow as they turn, blur with speed and fade toward
// the rim. Two small pointers frame the centre row and track its width. On lock the word
// wobbles (a wave runs through it), breathes, and the pointers turn into dots that fly out.
// Exit: pink polka dots grow from the word until they cover the frame (the drag scene shrinks
// the same grid back).
import { seg, ease, lerp, clamp, rgba, mixHex, layoutText, layerCtl, withLayer } from '../util.js';
import { W, H, polkaField, polkaCover } from '../fx.js';

export const SLOT_SPACING = 64;
const CY = 560;
const STEP = 0.4; // radians per row
const RC = 430; // cylinder radius
const SIZE = 165;

export function slot3Times(scene, dur) {
  const p = scene.params;
  return { land: dur * (p.landAt ?? 0.36), exit: dur - (p.exitLen ?? 0.42) };
}

export function reel3Pos(t, land, N) {
  const u = clamp(t / land);
  const bump = Math.pow(Math.sin(Math.PI * clamp((u - 0.74) / 0.26)), 2);
  // starts already at speed (hand-off from the fly-through), decelerates into the lock
  return N * (1 - Math.pow(1 - u, 2.4)) + 0.16 * bump;
}

const itemAt = (prm, i, N) => (i === N ? prm.final : prm.items[((i % prm.items.length) + prm.items.length) % prm.items.length]);

/** pre-rendered word (gradient fill) cached per text/style */
const cache = new Map();
function wordSprite(ctx, P, text, style) {
  const key = text + '|' + style;
  if (cache.has(key)) return cache.get(key);
  const L = layoutText(ctx, text, { family: P.fonts.display, size: SIZE, maxWidth: 1500, letterSpacing: 0.0 });
  const pad = 30;
  const w = Math.ceil(L.width + pad * 2), h = Math.ceil(L.capH * 1.5 + pad * 2);
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d');
  g.font = L.font;
  g.textBaseline = 'alphabetic';
  const base = pad + L.capH * 1.12;
  const pal = P.palette;
  const grd = g.createLinearGradient(0, base - L.capH, 0, base);
  if (style === 'hot') {
    grd.addColorStop(0, mixHex(pal.pinkHot, '#ffffff', 0.15));
    grd.addColorStop(0.45, pal.pink);
    grd.addColorStop(0.8, pal.pinkDeep);
    grd.addColorStop(1, '#4A0A2A');
  } else {
    grd.addColorStop(0, mixHex(pal.pinkHot, '#ffffff', 0.45));
    grd.addColorStop(1, mixHex(pal.pink, '#ffffff', 0.15));
  }
  g.fillStyle = grd;
  g.fillText(text, pad, base);
  const s = { c, w, h, L, cy: base - L.capH / 2 };
  cache.set(key, s);
  return s;
}

/** draw a sprite bowed (arch) and optionally waved, in vertical strips */
function drawBowed(ctx, sp, cx, cy, sx, sy, bow, wave, phase) {
  const strips = 36;
  const sw = sp.w / strips;
  for (let k = 0; k < strips; k++) {
    const u = (k + 0.5) / strips;
    const v = 2 * u - 1;
    const dy = -bow * (1 - v * v) + wave * Math.sin(u * Math.PI * 3 - phase);
    const x = cx + (k * sw - sp.w / 2) * sx;
    ctx.drawImage(sp.c, k * sw, 0, sw + 0.6, sp.h, x, cy - sp.cy * sy + dy, sw * sx + 0.9, sp.h * sy);
  }
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const pal = P.palette, prm = scene.params;
    const N = Math.max(3, prm.spinRows | 0);
    const { land, exit } = slot3Times(scene, dur);
    const kx = seg(t, exit, dur, ease.inQuad);
    const s = reel3Pos(t, land, N);
    const vel = (reel3Pos(t + 1 / 60, land, N) - reel3Pos(Math.max(0, t - 1 / 60), land, N)) * 30;
    const after = Math.max(0, t - land);
    const landed = seg(t, land - 0.04, land + 0.2);

    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, W, H);
    // faint pink halo behind the slot window
    const hg = ctx.createRadialGradient(W / 2, CY, 0, W / 2, CY, 900);
    hg.addColorStop(0, rgba(pal.pinkHot, 0.1));
    hg.addColorStop(1, rgba(pal.pinkHot, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);

    let centreW = 0;
    withLayer(ctx, scene, 'reel', W / 2, CY, () => {
      const base = Math.round(s);
      const rows = [];
      for (let i = base - 4; i <= base + 4; i++) {
        if (i < 0) continue;
        const th = (i - s) * STEP;
        if (Math.abs(th) > 1.25) continue;
        rows.push({ i, th, d: Math.abs(i - s) });
      }
      rows.sort((a, b) => b.d - a.d);
      for (const r of rows) {
        const isFinal = r.i === N;
        const focus = clamp(1 - r.d * 1.6);
        const sp = wordSprite(ctx, P, itemAt(prm, r.i, N), focus > 0.02 ? 'hot' : 'soft');
        const y = CY + RC * Math.sin(r.th);
        const sy = Math.cos(r.th);
        const sc = lerp(1, 0.62, clamp(r.d / 2.6));
        let a = Math.pow(clamp((1.25 - Math.abs(r.th)) / 1.25), 1.2) * lerp(0.55, 1, focus);
        if (!isFinal) a *= 1 - landed;
        if (a < 0.01) continue;
        if (r.d < 0.5) centreW = sp.L.width * sc;
        // vertical smear = distance travelled in one frame (no strobing)
        const blur = Math.min(220, (Math.abs(vel) / 30) * RC * STEP * sy);
        const n = blur > 4 ? Math.min(9, 3 + Math.ceil(blur / 30)) : 1;
        const pulse = isFinal && t > land ? 1 + 0.07 * Math.exp(-after * 8) * Math.sin(Math.min(Math.PI, after * 18)) : 1;
        const breathe = isFinal ? 1 + 0.03 * landed * Math.sin(after * 6.5) * (1 - kx) : 1;
        const sx = sc * pulse * breathe, syy = sc * sy * pulse * breathe;
        const bow = 16 + 34 * Math.sin(r.th);
        const wave = isFinal ? 22 * Math.exp(-after * 5.5) * (t > land ? 1 : 0) : 0;
        ctx.save();
        for (let j = 0; j < n; j++) {
          const o = n > 1 ? (j / (n - 1) - 0.5) * blur : 0;
          ctx.globalAlpha = (a * (n > 1 ? 1.5 / n : 1)) * (1 - seg(kx, 0.45, 0.9));
          drawBowed(ctx, sp, W / 2, y + o, sx, syy, bow, wave, after * 16);
        }
        ctx.restore();
      }
      const fl = layoutText(ctx, prm.final, { family: P.fonts.display, size: SIZE, maxWidth: 1500 });
      S.report('slot.final', { x: W / 2 - fl.width / 2, y: CY - fl.capH / 2, w: fl.width, h: fl.capH }, landed * (1 - seg(kx, 0.45, 0.9)), fl.fits);
    });

    // pointers: track the centre row; on lock they turn into dots and fly out
    withLayer(ctx, scene, 'frame', W / 2, CY, () => {
      const half = Math.max(260, centreW / 2) + 62;
      const fly = ease.inCubic(seg(t, land + 0.12, land + 0.55));
      const round = seg(t, land + 0.02, land + 0.16, ease.outCubic);
      const a = seg(t, 0, 0.12) * (1 - seg(fly, 0.7, 1));
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha *= a;
      for (const side of [-1, 1]) {
        const x = W / 2 + side * (half + fly * 900);
        const sz = 22 * (1 + 0.4 * round);
        ctx.save();
        ctx.translate(x, CY);
        // motion smear while flying
        const smearN = fly > 0.05 ? 6 : 1;
        for (let j = 0; j < smearN; j++) {
          ctx.save();
          ctx.translate(-side * j * 26 * fly, 0);
          ctx.globalAlpha *= smearN > 1 ? (1 - j / smearN) * 0.5 : 1;
          ctx.fillStyle = '#3A0820';
          ctx.beginPath();
          if (round < 1) {
            // triangle pointing at the word
            ctx.moveTo(side * sz * 0.75 * (1 - round), 0);
            ctx.lineTo(-side * sz * 0.6, -sz * 0.75);
            ctx.lineTo(-side * sz * 0.6, sz * 0.75);
            ctx.closePath();
            ctx.fill();
          }
          if (round > 0) {
            ctx.globalAlpha *= round;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.8);
            g.addColorStop(0, pal.pinkDeep);
            g.addColorStop(1, '#3A0820');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, sz * 0.75 * round, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore();
    });

    // exit: halftone dots grow out of the word
    if (kx > 0) {
      const cx = W / 2, cy = CY, maxD = Math.hypot(W, H) * 0.62, spread = 0.9;
      const cover = polkaCover(SLOT_SPACING);
      polkaField(ctx, {
        spacing: SLOT_SPACING, color: pal.pink,
        rOf: (x, y) => cover * ease.outCubic(clamp(kx * (1 + spread) - (Math.hypot(x - cx, y - cy) / maxD) * spread)),
      });
    }
  },

  cues(scene, P, dur) {
    const N = Math.max(3, scene.params.spinRows | 0);
    const { land, exit } = slot3Times(scene, dur);
    const out = [
      { t: 0, type: 'section', pattern: 'spin', len: land },
      { t: land, type: 'lock', gain: 0.9 },
      { t: land, type: 'impact', gain: 0.6, size: 0.6 },
      { t: land + 0.03, type: 'ding', gain: 0.5 },
      { t: land, type: 'section', pattern: 'groove', len: exit - land },
      { t: land + 0.14, type: 'whoosh', len: 0.4, gain: 0.35, pan: 0 },
      { t: exit, type: 'sweep', len: dur - exit + 0.05, gain: 0.6 },
      { t: exit, type: 'section', pattern: 'fill', len: dur - exit },
    ];
    let prev = reel3Pos(0, land, N);
    for (let t = 0.002; t <= land + 0.3; t += 0.002) {
      const s = reel3Pos(t, land, N);
      if (Math.floor(s + 0.5) !== Math.floor(prev + 0.5)) out.push({ t, type: 'tick', gain: 0.3 + 0.25 * (t / land), pan: 0 });
      prev = s;
    }
    return out;
  },

  holds(scene, P, dur) {
    const { land, exit } = slot3Times(scene, dur);
    return [{ label: 'slot.final', layer: 'reel', text: scene.params.final, start: land + 0.1, end: exit + (dur - exit) * 0.55 }];
  },
};
