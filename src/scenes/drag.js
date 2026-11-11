// v3 Scene 3 — Drag to poster. The pink halftone from the reel shrinks away; the blue-haired
// model (the same cut-out used in the poster) is dragged in by a cursor with a design-tool
// selection box, snaps to the centre guides, and the poster grows out around her. The finished
// card then glides to the front-card slot of the localize scene (exact hand-off geometry).
import { seg, ease, lerp, clamp, rgba, roundRectPath, layerCtl, withLayer } from '../util.js';
import { W, H, polkaField, polkaCover } from '../fx.js';
import { CARD, frontCardRect, centerCardRect, drawLocalizeBg, firstMarket } from './shared.js';
import { SLOT_SPACING } from './slot3.js';

export function dragTimes(scene, dur) {
  const p = scene.params;
  const k = dur / 1.15;
  return {
    reveal: (p.revealLen ?? 0.32) * k,
    grab: 0.02 * k,
    drop: (p.dropAt ?? 0.55) * k,
    build0: (p.buildAt ?? 0.6) * k,
    build1: ((p.buildAt ?? 0.6) + (p.buildLen ?? 0.3)) * k,
    glide: dur - (p.glideLen ?? 0.3) * k,
  };
}

function cursor(ctx, x, y, s, press) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 - 0.12 * press), s * (1 - 0.12 * press));
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 34);
  ctx.lineTo(9, 26);
  ctx.lineTo(15.5, 40);
  ctx.lineTo(21, 37.5);
  ctx.lineTo(14.5, 24);
  ctx.lineTo(26, 24);
  ctx.closePath();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#0B0B0C';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette;
    const T = dragTimes(scene, dur);
    const box = P.poster.en.subjectBox || [98, 153, 534, 870];
    const [pw, ph] = P.poster.size;

    // background: white; the localize light pool comes up during the glide
    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, W, H);
    const gk = seg(t, T.glide, dur, ease.inOutCubic);
    if (scene.next === 'localize' && gk > 0) drawLocalizeBg(ctx, P, gk);

    // drag path: from the right edge to centre, inOutCubic, with a velocity tilt (it swings when pulled)
    const dk = seg(t, T.grab, T.drop, ease.inOutCubic);
    const vel = (seg(t + 0.01, T.grab, T.drop, ease.inOutCubic) - seg(t - 0.01, T.grab, T.drop, ease.inOutCubic)) / 0.02;
    const C = centerCardRect();
    const F = frontCardRect();
    const settle = Math.max(0, t - T.drop);
    const bounce = t > T.drop ? 0.035 * Math.exp(-settle * 14) * Math.sin(settle * 40) : 0;
    const lift = 1 - seg(t, T.drop - 0.05, T.drop + 0.1);
    const sc = lerp(0.8, 1, dk) * (1 + 0.04 * lift + bounce);
    const ox = lerp(760, 0, dk), oy = lerp(70, 0, dk) - 26 * lift;
    const rot = 0.05 * (1 - dk) - 0.05 * vel * 0.4;
    // glide to the localize front slot
    const cx = lerp(C.x + C.w / 2 + ox, F.x + F.w / 2, gk), cy = lerp(C.y + C.h / 2 + oy, F.y + F.h / 2, gk);
    const cardScale = sc;

    // poster build: rounded clip grows from the subject's box to the full card
    const bk = seg(t, T.build0, T.build1, ease.outCubic);
    const sx = CARD.w / pw, sy = CARD.h / ph;
    const sub = { x: box[0] * sx - CARD.w / 2, y: box[1] * sy - CARD.h / 2, w: box[2] * sx, h: box[3] * sy };
    const R = { x: lerp(sub.x, -CARD.w / 2, bk), y: lerp(sub.y, -CARD.h / 2, bk), w: lerp(sub.w, CARD.w, bk), h: lerp(sub.h, CARD.h, bk), r: lerp(60, CARD.r, bk) };

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * (1 - gk));
    ctx.scale(cardScale, cardScale);
    // soft drop shadow under the lifted subject
    withLayer(ctx, scene, 'subject', 0, 0, () => {
      if (bk > 0) {
        ctx.save();
        ctx.shadowColor = `rgba(7,40,70,${0.22 * bk})`;
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 24;
        roundRectPath(ctx, R.x, R.y, R.w, R.h, R.r);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRectPath(ctx, R.x, R.y, R.w, R.h, R.r);
        ctx.clip();
        const src = S.poster.source(P, firstMarket(P)).source;
        if (src) ctx.drawImage(src, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h);
        ctx.restore();
      }
      const ca = 1 - seg(t, T.build1 - 0.08, T.build1);
      if (ca > 0) {
        const img = assets.images[P.poster.en.subject];
        if (img) {
          ctx.save();
          ctx.globalAlpha *= ca;
          if (bk <= 0) {
            ctx.shadowColor = `rgba(7,40,70,${0.18 + 0.12 * lift})`;
            ctx.shadowBlur = 30 + 30 * lift;
            ctx.shadowOffsetY = 18 + 30 * lift;
          }
          ctx.drawImage(img, -CARD.w / 2, -CARD.h / 2, CARD.w, CARD.h);
          ctx.restore();
        }
      }
    });

    // selection box + handles (follows the subject; grows with the poster)
    withLayer(ctx, scene, 'selection', 0, 0, () => {
      const a = seg(t, T.grab, T.grab + 0.08) * (1 - seg(t, T.build1 - 0.05, T.build1 + 0.08));
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.strokeStyle = pal.blueGlow;
      ctx.lineWidth = 2 / cardScale;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      const hs = 12 / cardScale;
      ctx.fillStyle = '#fff';
      for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) {
        const x = R.x + R.w * u, y = R.y + R.h * v;
        ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
        ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
      }
      // size tag under the box
      const tag = `${Math.round(R.w * 2)} × ${Math.round(R.h * 2)}`;
      ctx.font = `700 ${18 / cardScale}px "${P.fonts.ui}"`;
      const tw = ctx.measureText(tag).width + 20 / cardScale;
      const th = 30 / cardScale;
      roundRectPath(ctx, -tw / 2, R.y + R.h + 14 / cardScale, tw, th, 6 / cardScale);
      ctx.fillStyle = pal.blueGlow;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(tag, 0, R.y + R.h + 14 / cardScale + th * 0.7);
      ctx.restore();
    });
    ctx.restore();

    // centre guides flash on the snap
    const gA = seg(t, T.drop - 0.08, T.drop) * (1 - seg(t, T.drop + 0.12, T.drop + 0.3));
    if (gA > 0) {
      ctx.save();
      ctx.globalAlpha = gA;
      ctx.fillStyle = pal.pink;
      ctx.fillRect(W / 2 - 1, 0, 2, H);
      ctx.fillRect(0, H / 2 - 1, W, 2);
      ctx.restore();
    }

    // cursor: grabs near the face, travels with the drag, lets go and leaves down-right
    const cl = layerCtl(scene, 'cursor');
    if (cl.visible) {
      const leave = ease.inCubic(seg(t, T.drop + 0.05, T.drop + 0.4));
      const ca = seg(t, 0, 0.06) * (1 - seg(leave, 0.6, 1));
      if (ca > 0) {
        const gx = cx + 40 * cardScale, gy = cy - 170 * cardScale;
        const press = seg(t, 0, T.grab + 0.06) * (1 - seg(t, T.drop, T.drop + 0.06));
        ctx.save();
        ctx.globalAlpha = ca * cl.opacity;
        cursor(ctx, gx + leave * 420, gy + leave * 300, 1.5, press);
        ctx.restore();
      }
    }

    // incoming: the reel's pink halftone shrinks back from full cover
    const rv = seg(t, 0, T.reveal);
    if (rv < 1) {
      const cover = polkaCover(SLOT_SPACING);
      polkaField(ctx, {
        spacing: SLOT_SPACING, color: pal.pink,
        rOf: (x, y) => {
          const d = Math.hypot(x - W / 2, y - 560) / 1100;
          return cover * (1 - ease.inOutQuad(clamp(rv * 1.45 - d * 0.45)));
        },
      });
    }
  },

  cues(scene, P, dur) {
    const T = dragTimes(scene, dur);
    return [
      { t: 0, type: 'section', pattern: 'groove', len: T.glide, chord: 0 },
      { t: T.grab, type: 'whoosh', len: T.drop - T.grab, gain: 0.5, pan: 0.6 },
      { t: T.drop, type: 'lock', gain: 0.6 },
      { t: T.drop, type: 'pop', gain: 0.45 },
      { t: T.build0, type: 'shimmer', len: 0.45, gain: 0.35 },
      { t: T.glide, type: 'swish', len: dur - T.glide, gain: 0.4, pan: 0.4 },
    ];
  },

  holds() {
    return [];
  },
};
