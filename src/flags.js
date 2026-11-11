// Vector national flags drawn in canvas (no external artwork). All flags are fitted to
// the given box (3:2 recommended) and clipped to a rounded rectangle.
import { roundRectPath } from './util.js';

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.382 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function stripes(ctx, x, y, w, h, list) {
  const tot = list.reduce((s, [, k]) => s + k, 0);
  let yy = y;
  for (const [c, k] of list) {
    const hh = (h * k) / tot;
    ctx.fillStyle = c;
    ctx.fillRect(x, yy, w, hh + 0.6);
    yy += hh;
  }
}

/** Korean trigram: bars = array of 3 booleans (true = solid), drawn along +x of the current frame */
function trigram(ctx, bars, len, bw, gap) {
  bars.forEach((solid, i) => {
    const y = (i - 1) * (bw + gap) - bw / 2;
    if (solid) ctx.fillRect(-len / 2, y, len, bw);
    else {
      const g = len * 0.08;
      ctx.fillRect(-len / 2, y, len / 2 - g / 2, bw);
      ctx.fillRect(g / 2, y, len / 2 - g / 2, bw);
    }
  });
}

const DRAW = {
  th(ctx, x, y, w, h) {
    stripes(ctx, x, y, w, h, [['#A51931', 1], ['#F4F5F8', 1], ['#2D2A4A', 2], ['#F4F5F8', 1], ['#A51931', 1]]);
  },
  jp(ctx, x, y, w, h) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#BC002D';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  es(ctx, x, y, w, h) {
    stripes(ctx, x, y, w, h, [['#AA151B', 1], ['#F1BF00', 2], ['#AA151B', 1]]);
  },
  ko(ctx, x, y, w, h) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    const cx = x + w / 2, cy = y + h / 2, R = h / 4;
    const ang = Math.atan2(h, w); // diagonal used by the official construction
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    // taegeuk: red top half, blue bottom half, joined by two small semicircles
    ctx.fillStyle = '#CD2E3A';
    ctx.beginPath();
    ctx.arc(0, 0, R, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#0047A0';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-R / 2, 0, R / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#CD2E3A';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(R / 2, 0, R / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0047A0';
    ctx.fill();
    ctx.restore();
    // trigrams on the diagonals: geon (TL) gam (TR) ri (BL) gon (BR)
    ctx.fillStyle = '#000000';
    const len = R * 1.0, bw = R / 6, gap = R / 12, d = R * 1.5 + (bw * 3 + gap * 2) / 2;
    const place = (sx, sy, bars) => {
      ctx.save();
      ctx.translate(cx + sx * d * Math.cos(ang), cy + sy * d * Math.sin(ang));
      ctx.rotate(sx * sy > 0 ? ang + Math.PI / 2 : -ang + Math.PI / 2);
      trigram(ctx, bars, len, bw, gap);
      ctx.restore();
    };
    place(-1, -1, [true, true, true]);
    place(1, 1, [false, false, false]);
    place(1, -1, [false, true, false]);
    place(-1, 1, [true, false, true]);
  },
  us(ctx, x, y, w, h) {
    const sh = h / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 ? '#FFFFFF' : '#B22234';
      ctx.fillRect(x, y + i * sh, w, sh + 0.6);
    }
    const cw = w * 0.4, ch = sh * 7;
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = '#FFFFFF';
    const r = Math.max(0.6, ch * 0.031);
    for (let row = 0; row < 9; row++) {
      const n = row % 2 ? 5 : 6;
      for (let c = 0; c < n; c++) {
        const sx = x + cw * ((c * 2 + (row % 2 ? 2 : 1)) / 12);
        const sy = y + ch * ((row + 1) / 10);
        star(ctx, sx, sy, r);
      }
    }
  },
};
DRAW.kr = DRAW.ko;

/** draw the flag for a market id (th, ja/jp, es, ko/kr, en/us) */
export function drawFlag(ctx, id, x, y, w, h, radius = Math.min(w, h) * 0.12, { border = 'rgba(0,0,0,0.12)' } = {}) {
  const key = { ja: 'jp', en: 'us', kr: 'ko' }[id] || id;
  const fn = DRAW[key];
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.clip();
  if (fn) fn(ctx, x, y, w, h);
  else {
    ctx.fillStyle = '#ccc';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  if (border) {
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
