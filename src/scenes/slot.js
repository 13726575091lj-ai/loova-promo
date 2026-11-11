// Scene 3 — Pink slot reel (reference: 9s pink kinetic type).
// Model names spin on a 3D cylinder, decelerate and lock on the final model.
// Exit: the lock frame morphs into the first localized poster card (shape match).
import { seg, ease, lerp, clamp, rgba, layoutText, layerCtl, withLayer, roundRectPath } from '../util.js';
import { W, H, dotWave, drawLines, smear, drawIcon, vignette } from '../fx.js';
import { frontCardRect, drawLocalizeBg, firstMarket } from './shared.js';

const CY = 580;
const STEP = 0.36; // radians per row on the reel cylinder
const RC = 470; // cylinder radius in px
const EXIT = 0.6;

export function slotTimes(scene, dur) {
  const k = Math.min(1, dur / 3.5);
  return { land: dur * (scene.params.landAt ?? 0.52), exit: dur - EXIT * Math.max(0.7, k) };
}

/** reel position in rows; continuous velocity incl. a small overshoot that settles at N */
export function reelPos(t, land, N) {
  const u = clamp(t / land);
  const bump = Math.pow(Math.sin(Math.PI * clamp((u - 0.72) / 0.28)), 2);
  return N * ease.outQuad(u) + 0.18 * bump;
}

const itemAt = (prm, i, N) => (i === N ? prm.final : prm.items[((i % prm.items.length) + prm.items.length) % prm.items.length]);

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params;
    const N = Math.max(3, prm.spinRows | 0);
    const { land, exit } = slotTimes(scene, dur);
    const kx = seg(t, exit, dur, ease.inOutCubic);
    const s = reelPos(t, land, N);
    const vel = (reelPos(t + 1 / 60, land, N) - reelPos(t - 1 / 60, land, N)) * 30; // rows / s

    // pink field
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, pal.pink);
    bg.addColorStop(1, pal.pinkDeep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const hl = ctx.createRadialGradient(W / 2, CY, 0, W / 2, CY, 820);
    hl.addColorStop(0, rgba(pal.pinkHot, 0.55));
    hl.addColorStop(1, rgba(pal.pinkHot, 0));
    ctx.fillStyle = hl;
    ctx.fillRect(0, 0, W, H);
    const dots = layerCtl(scene, 'dots');
    if (dots.visible) dotWave(ctx, S.gT, { color: '#ffffff', alpha: 0.2 * dots.opacity, spacing: 38, size: 3.4, speed: 0.9, drift: [0, -30 - vel * 6] });

    const out = 1 - seg(kx, 0, 0.35); // type fades as the frame morphs

    // header
    withLayer(ctx, scene, 'header', W / 2, 170, () => {
      const a = seg(t, 0.1, 0.4) * out;
      const L = layoutText(ctx, prm.header, { family: P.fonts.ui, weight: 700, size: 28, letterSpacing: 0.32, maxWidth: 1300 });
      const iconS = 34, gap = 18, total = iconS + gap + L.width;
      const x0 = W / 2 - total / 2;
      ctx.save();
      ctx.globalAlpha *= a;
      drawIcon(ctx, x0, 170 - iconS / 2 - 10, iconS, P, assets.logo, { fill: '#ffffff', boltColor: pal.pink });
      ctx.fillStyle = '#ffffff';
      drawLines(ctx, L, x0 + iconS + gap, 170, 'left');
      ctx.restore();
      S.report('slot.header', { x: x0, y: 170 - L.capH, w: total, h: L.capH }, a, L.fits);
    });

    // reel
    const finalL = layoutText(ctx, prm.final, { family: P.fonts.display, size: 132, maxWidth: 1500, letterSpacing: 0.01 });
    const landed = seg(t, land - 0.05, land + 0.25);
    withLayer(ctx, scene, 'reel', W / 2, CY, () => {
      const base = Math.round(s);
      for (let i = base - 5; i <= base + 5; i++) {
        if (i < 0) continue;
        const th = (i - s) * STEP;
        if (Math.abs(th) > 1.2) continue;
        const d = Math.abs(i - s);
        const isFinal = i === N;
        const L = layoutText(ctx, itemAt(prm, i, N), { family: P.fonts.display, size: 132, maxWidth: 1500, letterSpacing: 0.01 });
        const y = CY + RC * Math.sin(th);
        const sy = Math.cos(th);
        const focus = clamp(1 - d * 1.4);
        let a = Math.pow(clamp((1.2 - Math.abs(th)) / 1.2), 1.4) * out;
        if (!isFinal) a *= 1 - landed * 0.92;
        if (a < 0.01) continue;
        // smear covers the distance a row travels in one frame, so fast spin reads as a streak (no strobing)
        const blur = Math.min(240, (Math.abs(vel) / 30) * RC * STEP * sy * 1.1);
        ctx.save();
        ctx.globalAlpha *= a;
        ctx.translate(W / 2, y);
        ctx.scale(1 - 0.05 * d, sy * (isFinal ? 1 + 0.06 * Math.exp(-Math.max(0, t - land) * 9) * (t > land ? 1 : 0) : 1));
        ctx.translate(-W / 2, -y);
        const baseY = y + L.capH / 2;
        smear(ctx, blur > 3 ? Math.min(14, 4 + Math.ceil(blur / 18)) : 1, 0, blur, () => {
          // pink echo outline (kinetic stack)
          ctx.lineWidth = 3;
          ctx.strokeStyle = rgba('#ffffff', 0.85 * (1 - focus) + 0.25);
          drawLines(ctx, L, W / 2, baseY, 'center', true);
          if (focus > 0) {
            ctx.save();
            ctx.globalAlpha *= focus;
            ctx.shadowColor = rgba(pal.pinkDeep, 0.6);
            ctx.shadowBlur = 30;
            ctx.shadowOffsetY = 10;
            ctx.fillStyle = '#ffffff';
            drawLines(ctx, L, W / 2, baseY, 'center');
            ctx.restore();
          }
        });
        ctx.restore();
      }
      // centre guide lines (slot window)
      const gA = 0.5 * out * (1 - landed);
      ctx.fillStyle = rgba('#ffffff', gA);
      ctx.fillRect(W / 2 - 860, CY - 100, 1720, 2);
      ctx.fillRect(W / 2 - 860, CY + 98, 1720, 2);
      S.report('slot.final', { x: W / 2 - finalL.width / 2, y: CY - finalL.capH / 2, w: finalL.width, h: finalL.capH }, landed * out, finalL.fits);
    });

    // lock frame + badge — container sizes itself to the final text
    const padX = 70, padY = 56;
    const fr = { x: W / 2 - finalL.width / 2 - padX, y: CY - finalL.capH / 2 - padY, w: finalL.width + padX * 2, h: finalL.capH + padY * 2, r: 28 };
    const fl = layerCtl(scene, 'frame');
    if (fl.visible) {
      const draw = seg(t, land + 0.02, land + 0.4, ease.outCubic);
      const card = frontCardRect();
      const hasNext = scene.next === 'localize';
      const R = {
        x: lerp(fr.x, hasNext ? card.x : fr.x, kx), y: lerp(fr.y, hasNext ? card.y : fr.y, kx),
        w: lerp(fr.w, hasNext ? card.w : fr.w, kx), h: lerp(fr.h, hasNext ? card.h : fr.h, kx), r: lerp(fr.r, card.r, kx),
      };
      ctx.save();
      ctx.translate(W / 2 + fl.x, CY + fl.y);
      ctx.scale(fl.scale, fl.scale);
      ctx.translate(-W / 2, -CY);
      if (hasNext && kx > 0) {
        // circular wipe into the localize background, centred on the growing card
        // radius grows ~sqrt(time) so the swept area (and per-frame change) stays even; soft edge
        // starts once the lock text has faded (out reaches 0 at kx = 0.35)
        const wr = Math.sqrt(seg(kx, 0.3, 0.95, ease.inOutQuad)) * 2300;
        if (wr > 1) {
          const cx = R.x + R.w / 2, cy = R.y + R.h / 2, edge = 160;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1, wr - edge / 2), 0, Math.PI * 2);
          ctx.clip();
          drawLocalizeBg(ctx, P, 1);
          ctx.restore();
          const rg = ctx.createRadialGradient(cx, cy, Math.max(0, wr - edge / 2), cx, cy, wr + edge / 2);
          rg.addColorStop(0, rgba(pal.navy, 1));
          rg.addColorStop(1, rgba(pal.navy, 0));
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, wr + edge / 2, 0, Math.PI * 2);
          ctx.arc(cx, cy, Math.max(0.5, wr - edge / 2), 0, Math.PI * 2, true);
          ctx.fillStyle = rg;
          ctx.fill('evenodd');
          ctx.restore();
        }
        ctx.save();
        roundRectPath(ctx, R.x, R.y, R.w, R.h, R.r);
        ctx.clip();
        ctx.fillStyle = rgba(pal.navy, seg(kx, 0, 0.3));
        ctx.fillRect(R.x, R.y, R.w, R.h);
        const src = S.poster.source(P, firstMarket(P)).source;
        if (src) {
          ctx.globalAlpha = seg(kx, 0.25, 0.9);
          ctx.drawImage(src, R.x, R.y, R.w, R.h);
        }
        ctx.restore();
      }
      if (draw > 0) {
        const per = 2 * (R.w + R.h);
        ctx.save();
        ctx.lineWidth = lerp(5, 2, kx);
        ctx.strokeStyle = rgba('#ffffff', 1 - seg(kx, 0.6, 1));
        ctx.setLineDash([per * draw, per]);
        ctx.lineDashOffset = -per * 0.12;
        roundRectPath(ctx, R.x, R.y, R.w, R.h, R.r);
        ctx.stroke();
        ctx.restore();
        // NEW badge pinned to the frame corner, auto-sized
        if (prm.badge) {
          const bk = seg(t, land + 0.18, land + 0.42, (x) => ease.outBack(x, 2)) * (1 - seg(kx, 0, 0.3));
          if (bk > 0) {
            const BL = layoutText(ctx, prm.badge, { family: P.fonts.ui, weight: 800, size: 30, letterSpacing: 0.12, maxWidth: 300 });
            const bw = BL.width + 44, bh = 54;
            const bx = R.x + R.w - bw * 0.6, by = R.y - bh * 0.55;
            ctx.save();
            ctx.translate(bx + bw / 2, by + bh / 2);
            ctx.scale(bk, bk);
            ctx.rotate(-0.06);
            roundRectPath(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.fillStyle = pal.pinkDeep;
            drawLines(ctx, BL, 0, BL.capH / 2, 'center');
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
    vignette(ctx, 0.35 * (1 - kx), pal.pinkDeep);
  },

  cues(scene, P, dur) {
    const N = Math.max(3, scene.params.spinRows | 0);
    const { land, exit } = slotTimes(scene, dur);
    const out = [
      { t: 0, type: 'section', pattern: 'spin', len: land },
      { t: land, type: 'lock', gain: 0.9 },
      { t: land + 0.03, type: 'ding', gain: 0.55 },
      { t: land, type: 'impact', gain: 0.55, size: 0.5 },
      { t: land, type: 'section', pattern: 'groove', len: exit - land },
      { t: land + 0.2, type: 'pop', gain: 0.5 },
      { t: exit, type: 'whoosh', len: dur - exit + 0.1, gain: 0.6, pan: 0.4 },
      { t: exit, type: 'section', pattern: 'fill', len: dur - exit },
    ];
    // one tick every time a row crosses the centre line (derived from the visual reel)
    let prev = reelPos(0, land, N);
    for (let t = 0.002; t <= land + 0.3; t += 0.002) {
      const s = reelPos(t, land, N);
      if (Math.floor(s + 0.5) !== Math.floor(prev + 0.5)) out.push({ t, type: 'tick', gain: 0.35 + 0.25 * (t / land), pan: 0 });
      prev = s;
    }
    return out;
  },

  holds(scene, P, dur) {
    const { land, exit } = slotTimes(scene, dur);
    return [
      { label: 'slot.header', layer: 'header', text: scene.params.header, start: 0.4, end: exit + 0.1 },
      { label: 'slot.final', layer: 'reel', text: scene.params.final, start: land + 0.1, end: exit + 0.15 },
    ];
  },
};
