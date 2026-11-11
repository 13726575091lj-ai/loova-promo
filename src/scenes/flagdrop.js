// v4 Scene 4 — Flag drop. The poster stays centred on a white flowing-light field. One flag at a
// time is tossed into it (arc, spin, motion trail). On impact the flag bursts into dots in its
// own colours, the camera punches in on the hit (close-up), and a halftone dot wave spreads from
// the impact point across the card, turning the poster into that country's language version.
// TH → JP → ES → KR, and finally the US flag turns it English. No canvas text in this scene:
// the only words on screen are the poster's own.
import { seg, ease, lerp, clamp, rgba, roundRectPath, layerCtl, withLayer, minHold, rng } from '../util.js';
import { W, H } from '../fx.js';
import { drawFlag } from '../flags.js';
import { CARD, centerCardRect, drawFlowBg } from './shared.js';

const FLAG_COL = {
  th: ['#ED1C24', '#241D4F'], ja: ['#BC002D', '#F2B8C2'], es: ['#C60B1E', '#FFC400'],
  ko: ['#CD2E3A', '#0047A0'], kr: ['#CD2E3A', '#0047A0'], en: ['#B22234', '#3C3B6E'], us: ['#B22234', '#3C3B6E'],
};
// launch points (screen) and impact points (card fraction) per drop, cycled
const LAUNCH = [[-260, 240], [W + 260, 330], [-260, 860], [W + 260, 820], [W / 2 + 120, -220]];
const HIT = [[0.32, 0.12], [0.7, 0.36], [0.34, 0.62], [0.66, 0.2], [0.5, 0.42]];
const GRID = 22;

export function dropTimes(scene, dur) {
  const p = scene.params, ms = p.markets;
  const first = p.firstAt ?? 0.08, flight = p.flight ?? 0.3, reveal = p.reveal ?? 0.26;
  const need = ms.map((m) => minHold(m.language));
  const avail = dur - first - flight - reveal * ms.length;
  const sumNeed = need.reduce((a, b) => a + b, 0);
  const tw = ms.reduce((s, m) => s + (m.weight ?? 1), 0);
  const hold = ms.map((m, i) => (avail >= sumNeed ? need[i] + ((avail - sumNeed) * (m.weight ?? 1)) / tw : (need[i] * avail) / sumNeed));
  const imp = [];
  let c = first + flight;
  ms.forEach((m, i) => {
    imp.push(c);
    c += reveal + hold[i];
  });
  return { imp, hold, flight, reveal, first };
}

/** card-local hit point in screen px */
function hitPoint(i, C) {
  const [u, v] = HIT[i % HIT.length];
  return [C.x + C.w * u, C.y + C.h * v];
}

/** flag position along its toss: quadratic Bezier with a raised control point, accelerating */
function tossAt(i, u, C) {
  const [x0, y0] = LAUNCH[i % LAUNCH.length];
  const [x1, y1] = hitPoint(i, C);
  const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 260;
  const p = 0.35 * u + 0.65 * u * u;
  const q = 1 - p;
  return [q * q * x0 + 2 * q * p * cx + p * p * x1, q * q * y0 + 2 * q * p * cy + p * p * y1, p];
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params, ms = prm.markets;
    const T = dropTimes(scene, dur);
    const C = centerCardRect();

    drawFlowBg(ctx, P, S.gT, 1);

    // which version is showing, and the wave in progress
    let cur = -1;
    T.imp.forEach((it, i) => t >= it && (cur = i));
    const src = (i) => (i < 0 ? assets.images[P.poster.clean] : S.poster.source(P, ms[i].id).source);

    // close-up punch on the latest hit, centred on the impact point
    let zoom = 1, zx = W / 2, zy = H / 2;
    if (cur >= 0) {
      const u = t - T.imp[cur];
      const k = u < 0.09 ? ease.outCubic(u / 0.09) : 1 - ease.inOutQuad(clamp((u - 0.09) / 0.5));
      zoom = 1 + (prm.punch ?? 0.12) * k;
      [zx, zy] = hitPoint(cur, C);
    }
    ctx.save();
    ctx.translate(zx, zy);
    ctx.scale(zoom, zoom);
    ctx.translate(-zx, -zy);

    withLayer(ctx, scene, 'poster', W / 2, H / 2, () => {
      const breathe = 1 + 0.006 * Math.sin(S.gT * 3.2);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(breathe, breathe);
      ctx.translate(-W / 2, -H / 2);
      // shadow matches the drag hand-off, fades out for the WebGL layer stack that follows
      const sh = 1 - seg(t, dur - 0.25, dur);
      if (sh > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(7,40,70,${0.22 * sh})`;
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 24;
        roundRectPath(ctx, C.x, C.y, C.w, C.h, CARD.r);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      roundRectPath(ctx, C.x, C.y, C.w, C.h, CARD.r);
      ctx.clip();
      const base = src(cur - 1);
      // during a reveal the previous version sits underneath; otherwise the current one
      const k = cur >= 0 ? seg(t, T.imp[cur], T.imp[cur] + T.reveal, ease.outCubic) : 1;
      const under = cur >= 0 && k < 1 ? base : src(cur);
      if (under) ctx.drawImage(under, C.x, C.y, C.w, C.h);
      if (cur >= 0 && k < 1) halftoneReveal(ctx, C, hitPoint(cur, C), k, src(cur), FLAG_COL[ms[cur].id] || [pal.pink, pal.blue]);
      ctx.restore();
      ctx.restore();
    });

    // flags in flight, and the dot splash where each one lands
    const fl = layerCtl(scene, 'flags');
    if (fl.visible) {
      ms.forEach((m, i) => {
        const launch = T.imp[i] - T.flight;
        const u = (t - launch) / T.flight;
        const cols = FLAG_COL[m.id] || [pal.pink, pal.blue];
        if (u >= 0 && u < 1) {
          const spin = (i % 2 ? -1 : 1) * 2.4;
          // trail: earlier positions, fading (reads as motion, not as copies)
          for (let j = 5; j >= 0; j--) {
            const uj = u - j * 0.035;
            if (uj < 0) continue;
            const [x, y, p] = tossAt(i, uj, C);
            const s = lerp(1.45, 0.72, p);
            ctx.save();
            ctx.globalAlpha = fl.opacity * (j === 0 ? 1 : 0.28 * (1 - j / 6));
            ctx.translate(x, y);
            ctx.rotate(spin * (1 - p));
            ctx.scale(s, s);
            if (j === 0) {
              ctx.shadowColor = 'rgba(7,40,70,0.3)';
              ctx.shadowBlur = 24;
              ctx.shadowOffsetY = 12 * (1 - p) + 4;
            }
            drawFlag(ctx, m.id, -120, -80, 240, 160, 14);
            ctx.restore();
          }
        }
        // splash: the flag collapses into dots of its colours that spray outward
        const v = t - T.imp[i];
        if (v >= 0 && v < 0.5) {
          const [hx, hy] = hitPoint(i, C);
          const pop = 1 - ease.inQuad(clamp(v / 0.1));
          if (pop > 0) {
            ctx.save();
            ctx.globalAlpha = fl.opacity;
            ctx.translate(hx, hy);
            ctx.scale(0.72 * pop, 0.72 * pop);
            drawFlag(ctx, m.id, -120, -80, 240, 160, 14);
            ctx.restore();
          }
          const r = rng(300 + i * 17);
          const k = ease.outCubic(v / 0.5);
          ctx.save();
          ctx.globalAlpha = fl.opacity * (1 - ease.inQuad(v / 0.5));
          for (let d = 0; d < 34; d++) {
            const a = r() * Math.PI * 2, sp = 90 + r() * 260, rad = (6 + r() * 12) * (1 - 0.6 * k);
            ctx.fillStyle = d % 3 === 2 ? '#ffffff' : cols[d % 2];
            ctx.beginPath();
            ctx.arc(hx + Math.cos(a) * sp * k, hy + Math.sin(a) * sp * k, rad, 0, Math.PI * 2);
            ctx.fill();
          }
          // white ring kick at the impact
          ctx.strokeStyle = rgba(cols[0], 0.9);
          ctx.lineWidth = lerp(10, 1, k);
          ctx.beginPath();
          ctx.arc(hx, hy, lerp(20, 220, k), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });
    }
    ctx.restore();
  },

  cues(scene, P, dur) {
    const T = dropTimes(scene, dur);
    const ms = scene.params.markets;
    const out = [{ t: 0, type: 'section', pattern: 'groove', len: dur, chord: 0 }];
    T.imp.forEach((it, i) => {
      out.push({ t: Math.max(0, it - T.flight), type: 'whoosh', len: T.flight, gain: 0.5, pan: LAUNCH[i % LAUNCH.length][0] < W / 2 ? -0.6 : 0.6 });
      out.push({ t: it, type: 'impact', gain: i === ms.length - 1 ? 0.85 : 0.6, size: 0.6 });
      out.push({ t: it, type: 'pop', gain: 0.45 });
      out.push({ t: it, type: 'swish', len: T.reveal + 0.2, gain: 0.3, pan: 0 });
      out.push({ t: it + 0.04, type: 'sparkle', gain: 0.3 });
      out.push({ t: it, type: 'chord', chord: i + 1 });
    });
    return out;
  },

  holds(scene, P, dur) {
    const T = dropTimes(scene, dur);
    const ms = scene.params.markets;
    return ms.map((m, i) => ({ label: `flags.${m.id}`, layer: 'poster', text: m.language, start: T.imp[i] + T.reveal, end: i < ms.length - 1 ? T.imp[i + 1] : dur }));
  },
};

/**
 * Halftone wave: inside radius (R - band) the new version is fully shown; across the band it
 * shows through growing dots on a fixed grid; the wave front carries a ring of flag-coloured dots.
 */
function halftoneReveal(ctx, C, [hx, hy], k, img, cols) {
  if (!img) return;
  const far = Math.max(...[[C.x, C.y], [C.x + C.w, C.y], [C.x, C.y + C.h], [C.x + C.w, C.y + C.h]].map(([x, y]) => Math.hypot(x - hx, y - hy)));
  const band = 150;
  const R = k * (far + band * 1.4);
  const cover = GRID * 0.76;
  ctx.save();
  ctx.beginPath();
  if (R - band > 0) ctx.arc(hx, hy, R - band, 0, Math.PI * 2);
  const front = [];
  for (let gy = C.y - GRID; gy < C.y + C.h + GRID; gy += GRID) {
    const row = Math.round((gy - C.y) / GRID);
    for (let gx = C.x - GRID + (row & 1) * (GRID / 2); gx < C.x + C.w + GRID; gx += GRID) {
      const d = Math.hypot(gx - hx, gy - hy);
      if (d > R + 40 || d < R - band) continue;
      const r = cover * clamp((R - d) / band);
      if (r > 0.3) {
        ctx.moveTo(gx + r, gy);
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
      }
      const f = 1 - Math.abs(d - (R - band * 0.15)) / (band * 0.45);
      if (f > 0) front.push([gx, gy, f, row]);
    }
  }
  ctx.clip();
  ctx.drawImage(img, C.x, C.y, C.w, C.h);
  ctx.restore();
  // coloured wave front (fades as the wave leaves the card)
  const fa = 1 - seg(k, 0.75, 1);
  if (fa <= 0) return;
  ctx.save();
  ctx.globalAlpha *= fa;
  for (const [x, y, f, row] of front) {
    ctx.fillStyle = cols[(row + Math.round(x / GRID)) & 1];
    ctx.beginPath();
    ctx.arc(x, y, GRID * 0.42 * f, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
