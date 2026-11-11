// B2 portfolio film (20 s). Look taken from the B2 site: cobalt blue #3154E8, cream paper
// #F0EEDF, orange #ED662E, Delius (round), Caveat (hand), DM Mono; hand-drawn doodles.
// Scenes: pf_intro → pf_statement → pf_work ×4 → pf_grid → pf_end, all on the shared timeline.
// Transitions are shape-based (iris, card grow, diagonal band wipe, card shrink, panel rise).
import { seg, ease, lerp, clamp, rgba, roundRectPath, layoutText, rng } from '../util.js';
import { W, H } from '../fx.js';

const PUSH = 1.08; // every work shot pushes from 1.0 to PUSH; grid hand-off starts from PUSH
const BAND = 0.26; // half-length of the band wipe (s)
const SLOT = { w: 404, h: 228, gap: 36, cy: 640 };

const C = (P) => {
  const p = P.palette;
  return { blue: p.blue, ink: p.ink, paper: p.paper, orange: p.orange, dark: p.dark, white: '#FFFFFF' };
};
const F = (P) => P.fonts;

// ------------------------------------------------------------------ doodles (paths from the B2 site, 64-unit box)
const DOODLES = {
  note: ['M26 43V15l23-5v28M26 23l23-5', 'M10 45a8 7 0 1 0 16 0a8 7 0 1 0 -16 0', 'M33 40a8 7 0 1 0 16 0a8 7 0 1 0 -16 0', 'M8 17l2-4m4 9 4-1'],
  clapper: ['M17 23h30a7 7 0 0 1 7 7v17a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V30a7 7 0 0 1 7-7z', 'm10 23-2-11L51 5l2 11Z', 'm17 10 8 10m7-12 8 10m7-12 6 7', 'M10 31h44', 'M28 45q4 4 8 0'],
  ghost: ['M13 51V29C13 15 22 8 32 8s19 7 19 21v22l-9-5-10 7-10-7Z', 'M28 37q4 4 8 0', 'M19 36h3m20 0h3', 'm54 8 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z'],
};
const EYES = { note: [], clapper: [[25, 39], [39, 39]], ghost: [[25, 31], [39, 31]] };
const pathCache = {};
const pth = (d) => (pathCache[d] ||= new Path2D(d));

/** stroke a doodle drawing itself on (k 0..1), centred at x,y, size px; blink 0..1 squashes the eyes */
function doodle(ctx, kind, x, y, size, color, k = 1, { lw = 2.4, blink = 0, rot = 0 } = {}) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(size / 64, size / 64);
  ctx.translate(-32, -32);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw * (64 / size) * (size / 64) * 1.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const parts = DOODLES[kind];
  parts.forEach((d, i) => {
    const kk = clamp(k * parts.length - i * 0.7);
    if (kk <= 0) return;
    ctx.setLineDash([260 * kk, 400]);
    ctx.stroke(pth(d));
  });
  ctx.setLineDash([]);
  if (k > 0.75) for (const [ex, ey] of EYES[kind]) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(1, 1 - 0.85 * blink);
    ctx.beginPath();
    ctx.arc(0, 0, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** the B2 asterisk: 8 arms, drawn as strokes so it never depends on a font glyph */
function star(ctx, x, y, r, color, k = 1, spin = 0, lw = 0) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = lw || r * 0.24;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** hand scribble underline (two passes, like the site's .scribble-line), drawn on with k */
function scribble(ctx, x, y, w, color, k, lw = 5) {
  if (k <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 180, w / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw * (180 / w);
  ctx.lineCap = 'round';
  const a = pth('M2 8C45 0 128 0 177 5'), b = pth('M9 13C57 6 131 4 170 10');
  ctx.setLineDash([200 * clamp(k * 1.6), 400]);
  ctx.stroke(a);
  ctx.setLineDash([200 * clamp(k * 1.6 - 0.6), 400]);
  ctx.stroke(b);
  ctx.restore();
}

/** the B2 brand mark: Caveat "B2", rotated −7°, tight tracking; write-on reveal with a pen dot */
function b2mark(ctx, P, x, y, size, color, k = 1, { star: starK = 0, starColor, spin = 0, breathe = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.scale(breathe, breathe);
  ctx.font = `700 ${size}px "${F(P).hand}"`;
  ctx.letterSpacing = `${(-6 * size) / 55}px`;
  ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText('B2').width;
  const capH = size * 0.62;
  if (k > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2 - size * 0.2, -size, (w + size * 0.4) * k, size * 1.7);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillText('B2', -w / 2, capH / 2);
    ctx.restore();
    if (k < 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(-w / 2 - size * 0.2 + (w + size * 0.4) * k, -capH * 0.1 + Math.sin(k * 30) * size * 0.12, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  const sx = x + w * 0.56, sy = y - capH * 0.78;
  star(ctx, sx, sy, size * 0.11, starColor || C(P).orange, starK, spin, size * 0.03);
  return { w, capH, star: [sx, sy] };
}

/**
 * Words rise out of a mask line by line (enter), breathe while held, and slide up out of the
 * mask (exit). `parts` = [{ text, font, color }] drawn on one baseline (mixed fonts allowed).
 */
function riseLine(ctx, parts, x, base, align, t, t0, tx, o = {}) {
  const { stag = 0.06, len = 0.5, exitLen = 0.32, breathe = 0.022, gap = 0.28 } = o;
  const words = [];
  for (const p of parts) for (const wd of p.text.split(' ')) if (wd) words.push({ ...p, text: wd });
  ctx.save();
  let tot = 0, maxA = 0, maxD = 0;
  for (const w of words) {
    ctx.font = w.font;
    ctx.letterSpacing = `${w.ls || 0}px`;
    const m = ctx.measureText(w.text);
    w.w = m.width - (w.ls || 0);
    w.sp = m.width / Math.max(1, w.text.length) * gap * 2.2;
    w.a = m.actualBoundingBoxAscent;
    w.d = m.actualBoundingBoxDescent;
    maxA = Math.max(maxA, w.a);
    maxD = Math.max(maxD, w.d);
  }
  words.forEach((w, i) => (tot += w.w + (i < words.length - 1 ? words[i + 1].sp * 0.5 + w.sp * 0.5 : 0)));
  let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  let shown = 1, out = 0;
  const lineH = maxA + maxD;
  words.forEach((w, i) => {
    const e = ease.outExpo(seg(t, t0 + i * stag, t0 + i * stag + len));
    const xk = ease.inCubic(seg(t, tx + i * stag * 0.5, tx + i * stag * 0.5 + exitLen));
    shown = Math.min(shown, e);
    out = Math.max(out, xk);
    if (e > 0 && xk < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - 30, base - maxA - 16, w.w + 60, lineH + 32);
      ctx.clip();
      const dy = (1 - e) * (lineH + 24) - xk * (lineH + 24);
      const b = 1 + breathe * e * (1 - xk) * Math.sin(t * 4.2 - i * 0.7);
      ctx.translate(cx + w.w / 2, base - maxA / 2 + dy);
      ctx.rotate((1 - e) * 0.12 - xk * 0.06);
      ctx.scale(b, b);
      ctx.font = w.font;
      ctx.letterSpacing = `${w.ls || 0}px`;
      ctx.fillStyle = w.color;
      ctx.fillText(w.text, -w.w / 2, maxA / 2);
      ctx.restore();
    }
    cx += w.w + (i < words.length - 1 ? words[i + 1].sp * 0.5 + w.sp * 0.5 : 0);
  });
  ctx.letterSpacing = '0px';
  ctx.restore();
  const x0 = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  return { box: { x: x0, y: base - maxA, w: tot, h: lineH }, alpha: shown * (1 - out) };
}

/** typed mono line: characters appear one by one with a block caret */
function typed(ctx, P, text, x, base, size, color, t, t0, cps = 50, ls = 0.3, align = 'left', fade = 1) {
  const n = Math.floor(clamp((t - t0) * cps, 0, text.length));
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.font = `400 ${size}px "${F(P).mono}"`;
  ctx.letterSpacing = `${ls * size}px`;
  const full = ctx.measureText(text).width - ls * size;
  const x0 = align === 'center' ? x - full / 2 : align === 'right' ? x - full : x;
  ctx.fillStyle = color;
  ctx.fillText(text.slice(0, n), x0, base);
  if (t >= t0 && n < text.length) {
    const cw = ctx.measureText(text.slice(0, n)).width;
    ctx.fillRect(x0 + cw + 2, base - size * 0.8, size * 0.55, size * 0.9);
  }
  ctx.letterSpacing = '0px';
  ctx.restore();
  return { x: x0, y: base - size * 0.8, w: full, h: size, done: n >= text.length };
}

// ------------------------------------------------------------------ images
function img(S, key) {
  return S.assets.images[S.project.images[key]];
}
/** draw an image covering rect R, extra zoom s about the rect centre, horizontal drift dx (px of R) */
function cover(ctx, im, R, s = 1, dx = 0, dy = 0) {
  if (!im) return;
  const k = Math.max(R.w / im.width, R.h / im.height) * s;
  const w = im.width * k, h = im.height * k;
  ctx.drawImage(im, R.x + R.w / 2 - w / 2 + dx, R.y + R.h / 2 - h / 2 + dy, w, h);
}
/** camera for a work shot at progress u (0..1): slow push + drift, identical for hand-offs */
export function workCam(u, dir = 1) {
  const e = ease.inOutQuad(clamp(u));
  return { s: lerp(1, PUSH, e), dx: -dir * 46 * e, dy: -14 * e };
}

/** holo card: white border, soft shadow, rounded; optional sheen sweep */
function holoCard(ctx, R, rad, border, drawInside, { sheen = -1, shadow = 0.28, rot = 0 } = {}) {
  ctx.save();
  ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
  ctx.rotate(rot);
  ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));
  if (shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(24,34,42,${shadow})`;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRectPath(ctx, R.x, R.y, R.w, R.h, rad);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
  if (border > 0) {
    roundRectPath(ctx, R.x, R.y, R.w, R.h, rad);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  const I = { x: R.x + border, y: R.y + border, w: R.w - border * 2, h: R.h - border * 2 };
  ctx.save();
  roundRectPath(ctx, I.x, I.y, I.w, I.h, Math.max(0, rad - border * 0.6));
  ctx.clip();
  drawInside(I);
  if (sheen >= 0 && sheen <= 1) {
    const sx = lerp(I.x - I.w * 0.6, I.x + I.w * 1.6, sheen);
    const g = ctx.createLinearGradient(sx - I.w * 0.25, I.y, sx + I.w * 0.25, I.y + I.h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(180,230,255,0.10)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.55, 'rgba(255,200,240,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(I.x, I.y, I.w, I.h);
  }
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ paper + grain
let grain = null;
function paper(ctx, P, color) {
  ctx.fillStyle = color || C(P).paper;
  ctx.fillRect(0, 0, W, H);
  if (!grain) {
    // fixed (not per-frame) fibre noise so the paper has tooth without any flicker
    grain = new OffscreenCanvas(480, 270);
    const g = grain.getContext('2d');
    const id = g.createImageData(480, 270);
    const r = rng(77);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 60;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = 'overlay';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(grain, 0, 0, W, H);
  ctx.restore();
}

/**
 * Diagonal band wipe (site's blue/orange transition). k: 0..0.5 bands cover the frame from the
 * left; 0.5 fully covered (blue with the spinning asterisk); 0.5..1 bands leave to the right.
 */
function bands(ctx, P, k, t) {
  if (k <= 0 || k >= 1) return;
  const c = C(P), sk = 360;
  const span = W + sk + 260;
  const edge = (u) => -sk - 260 + u * (span + sk + 260); // leading edge x (bottom) of a band
  const para = (xL, xR) => {
    ctx.beginPath();
    ctx.moveTo(xL + sk, 0);
    ctx.lineTo(xR + sk, 0);
    ctx.lineTo(xR, H);
    ctx.lineTo(xL, H);
    ctx.closePath();
  };
  ctx.save();
  if (k <= 0.5) {
    const u = ease.inOutCubic(k / 0.5);
    const lead = edge(u);
    ctx.fillStyle = c.orange;
    para(-sk - 400, lead);
    ctx.fill();
    ctx.fillStyle = c.blue;
    para(-sk - 400, lead - 130);
    ctx.fill();
  } else {
    const u = ease.inOutCubic((k - 0.5) / 0.5);
    const tail = edge(u);
    ctx.fillStyle = c.orange;
    para(tail - 130, W + sk + 400);
    ctx.fill();
    ctx.fillStyle = c.blue;
    para(tail, W + sk + 400);
    ctx.fill();
  }
  // asterisk rides the band's middle
  const sk2 = 1 - Math.abs(k - 0.5) / 0.5;
  star(ctx, W / 2, H / 2, 46, c.paper, ease.outBack(clamp(sk2 * 1.4 - 0.2)), t * 5, 11);
  ctx.restore();
}

// ================================================================== scenes
const introT = (dur) => ({ write: [0.12, 0.62], star: 0.66, type: 0.5, ghost: 0.78, exit: dur - 0.45 });

const pf_intro = {
  draw(ctx, S) {
    const { t, dur, project: P } = S;
    const c = C(P), T = introT(dur);
    paper(ctx, P);
    const breathe = 1 + 0.015 * seg(t, T.write[1], T.write[1] + 0.3) * Math.sin((t - T.write[1]) * 4.5);
    const pullBack = 1 - 0.05 * ease.inCubic(seg(t, T.exit, dur));
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(pullBack, pullBack);
    ctx.translate(-W / 2, -H / 2);
    const mk = b2mark(ctx, P, W / 2 - 20, 500, 360, c.blue, ease.inOutQuad(seg(t, T.write[0], T.write[1])), {
      star: ease.outBack(seg(t, T.star, T.star + 0.22), 2.4), spin: t * 1.4, breathe,
    });
    scribble(ctx, W / 2 - 250, 640, 480, c.orange, seg(t, T.write[1] - 0.1, T.write[1] + 0.3, ease.outCubic), 6);
    const blink = Math.max(0, 1 - Math.abs(t - (T.ghost + 0.75)) / 0.06);
    const bob = Math.sin(t * 5) * 6;
    doodle(ctx, 'ghost', W / 2 + 300, 300 + bob, 130, c.blue, seg(t, T.ghost, T.ghost + 0.4), { blink, lw: 2.6 });
    const tb = typed(ctx, P, 'FILMS & MOVING IMAGES', W / 2, 760, 28, c.blue, t, T.type, 50, 0.3, 'center');
    S.report('intro.mark', { x: W / 2 - 20 - mk.w / 2, y: 500 - 230, w: mk.w, h: 360 }, 1, true);
    if (tb.done) S.report('intro.sub', tb, 1, true);
    ctx.restore();
    // exit: orange iris from the asterisk, blue iris right behind it → statement starts on blue
    const kx = seg(t, T.exit, dur);
    if (kx > 0) {
      const [sx, sy] = mk.star;
      const far = Math.hypot(Math.max(sx, W - sx), Math.max(sy, H - sy)) + 20;
      const r1 = far * Math.sqrt(ease.inOutQuad(clamp(kx / 0.8)));
      const r2 = far * Math.sqrt(ease.inOutQuad(clamp((kx - 0.18) / 0.82)));
      ctx.fillStyle = c.orange;
      ctx.beginPath();
      ctx.arc(sx, sy, r1, 0, Math.PI * 2);
      ctx.fill();
      if (r2 > 0) {
        ctx.fillStyle = c.blue;
        ctx.beginPath();
        ctx.arc(sx, sy, r2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  cues(scene, P, dur) {
    const T = introT(dur);
    const out = [
      { t: 0, type: 'section', pattern: 'intro', len: dur },
      { t: T.write[0], type: 'swish', len: T.write[1] - T.write[0], gain: 0.35, pan: -0.3 },
      { t: T.star, type: 'pop', gain: 0.6 },
      { t: T.star + 0.02, type: 'sparkle', gain: 0.35 },
      { t: T.ghost, type: 'shimmer', len: 0.4, gain: 0.25 },
      { t: T.exit, type: 'whoosh', len: dur - T.exit, gain: 0.55, pan: 0.3 },
      { t: dur - 0.1, type: 'riser', len: 0.1, gain: 0.3 },
    ];
    const n = 'FILMS & MOVING IMAGES'.length;
    for (let i = 0; i < n; i += 2) out.push({ t: T.type + i / 50, type: 'tick', gain: 0.16, pan: (i / n) * 1.2 - 0.6 });
    return out;
  },
  holds(scene, P, dur) {
    const T = introT(dur);
    return [{ label: 'intro.sub', text: 'FILMS & MOVING IMAGES', start: T.type + 21 / 50, end: T.exit + 0.1 }];
  },
};

const stT = (dur) => ({ chip: 0.05, l1: 0.1, l2: 0.3, hand: 0.6, exit: dur - 0.8, card: dur - 0.55, grow: dur - 0.36 });

const pf_statement = {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const c = C(P), f = F(P), T = stT(dur), prm = scene.params;
    ctx.fillStyle = c.blue;
    ctx.fillRect(0, 0, W, H);
    // soft light pool + paper grain on blue
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, 900);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // chip "THE WORLD OF B2"
    const ck = ease.outBack(seg(t, T.chip, T.chip + 0.3), 2) * (1 - seg(t, T.exit, T.exit + 0.2));
    if (ck > 0) {
      ctx.save();
      ctx.translate(W / 2, 250);
      ctx.rotate(-0.03);
      ctx.scale(ck, ck);
      ctx.font = `400 22px "${f.mono}"`;
      ctx.letterSpacing = '3px';
      const tw = ctx.measureText(prm.chip).width;
      ctx.fillStyle = c.orange;
      ctx.fillRect(-tw / 2 - 16, -20, tw + 32, 36);
      ctx.fillStyle = c.paper;
      ctx.fillText(prm.chip, -tw / 2, 6);
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
    const font = `400 108px "${f.round}"`;
    const a = riseLine(ctx, [{ text: prm.line1, font, color: c.paper, ls: -2 }], W / 2, 455, 'center', t, T.l1, T.exit);
    const b = riseLine(ctx, [{ text: prm.line2, font, color: c.paper, ls: -2 }], W / 2, 590, 'center', t, T.l2, T.exit + 0.05);
    S.report('statement.l1', a.box, a.alpha, a.box.w < W * 0.9);
    S.report('statement.l2', b.box, b.alpha, b.box.w < W * 0.9);
    // handwritten "Welcome to my world." + scribble
    const hk = seg(t, T.hand, T.hand + 0.4, ease.inOutQuad);
    const hx = 1 - seg(t, T.exit, T.exit + 0.25);
    if (hk > 0 && hx > 0) {
      ctx.save();
      ctx.globalAlpha = hx;
      ctx.translate(W / 2 + 330, 712 - (1 - hx) * 40);
      ctx.rotate(-0.07);
      ctx.font = `600 64px "${f.hand}"`;
      const tw = ctx.measureText(prm.hand).width;
      ctx.beginPath();
      ctx.rect(-tw / 2 - 10, -70, (tw + 20) * hk, 110);
      ctx.clip();
      ctx.fillStyle = c.orange;
      ctx.fillText(prm.hand, -tw / 2, 0);
      ctx.restore();
      scribble(ctx, W / 2 + 330 - 200, 740, 400, c.orange, seg(t, T.hand + 0.3, T.hand + 0.6) * hx, 5);
      S.report('statement.hand', { x: W / 2 + 130, y: 650, w: 420, h: 80 }, hk * hx, true);
    }
    // exit: the first work rises as a holo card and grows to full frame
    const ck2 = seg(t, T.card, T.grow, ease.outCubic);
    if (ck2 > 0) {
      const gk = ease.inOutCubic(seg(t, T.grow, dur));
      const small = { x: W / 2 - 320, y: lerp(H + 40, 620 - 180, ck2), w: 640, h: 360 };
      const R = { x: lerp(small.x, 0, gk), y: lerp(small.y, 0, gk), w: lerp(small.w, W, gk), h: lerp(small.h, H, gk) };
      const im = img(S, prm.next);
      holoCard(ctx, R, lerp(18, 0, gk), lerp(9, 0, gk), (I) => cover(ctx, im, I, 1), { rot: lerp(-0.05, 0, ease.outCubic(ck2)) * (1 - gk), shadow: 0.35 * (1 - gk), sheen: seg(t, T.card, dur) });
    }
  },
  cues(scene, P, dur) {
    const T = stT(dur);
    return [
      { t: 0, type: 'section', pattern: 'breakdown', len: dur },
      { t: 0, type: 'impact', gain: 0.6, size: 0.6 },
      { t: T.chip + 0.05, type: 'pop', gain: 0.4 },
      { t: T.l1, type: 'swish', len: 0.35, gain: 0.35, pan: -0.4 },
      { t: T.l2, type: 'swish', len: 0.35, gain: 0.35, pan: 0.4 },
      { t: T.hand, type: 'shimmer', len: 0.5, gain: 0.3 },
      { t: T.card, type: 'whoosh', len: dur - T.card, gain: 0.55 },
      { t: dur - 0.12, type: 'riser', len: 0.12, gain: 0.35 },
    ];
  },
  holds(scene, P, dur) {
    const T = stT(dur), p = scene.params;
    return [
      { label: 'statement.l1', text: p.line1, start: T.l1 + 0.5, end: T.exit + 0.05 },
      { label: 'statement.l2', text: p.line2, start: T.l2 + 0.55, end: T.exit + 0.1 },
      { label: 'statement.hand', text: p.hand, start: T.hand + 0.4, end: T.exit + 0.05 },
    ];
  },
};

const wkT = (dur, prm) => ({ meta: 0.3, title: 0.36, exit: dur - 0.44, bandsIn: prm.enter === 'bands' ? BAND : 0, bandsOut: prm.exit === 'bands' ? dur - BAND : dur });

const pf_work = {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const c = C(P), f = F(P), prm = scene.params, T = wkT(dur, prm);
    const im = img(S, prm.image);
    const cam = workCam(t / dur, prm.dir ?? 1);
    // beat punch on the first frames of a band entry
    const punch = prm.enter === 'bands' ? 0.035 * Math.exp(-Math.max(0, t - BAND * 0.5) / 0.12) * (t > BAND * 0.5 ? 1 : 0) : 0;
    ctx.fillStyle = c.dark;
    ctx.fillRect(0, 0, W, H);
    cover(ctx, im, { x: 0, y: 0, w: W, h: H }, cam.s + punch, cam.dx, cam.dy);
    // holo sheen once per shot
    const sh = seg(t, 0.25, 1.35, ease.inOutQuad);
    if (sh > 0 && sh < 1) {
      const sx = lerp(-700, W + 700, sh);
      const g = ctx.createLinearGradient(sx - 380, 0, sx + 380, H);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.13)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // label corner darkening (no plate behind the type)
    const pos = prm.labelPos || 'bl';
    const lx = pos.includes('r') ? W - 96 : 96, top = pos.includes('t');
    const vg = ctx.createRadialGradient(lx, top ? 140 : H - 140, 0, lx, top ? 140 : H - 140, 820);
    const dk = (prm.shade ?? 0.6) * seg(t, 0.1, 0.5) * (1 - seg(t, T.exit, dur));
    vg.addColorStop(0, rgba(c.dark, dk));
    vg.addColorStop(1, rgba(c.dark, 0));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    const al = pos.includes('r') ? 'right' : 'left';
    const metaY = top ? 150 : H - 196, titleY = top ? 262 : H - 92;
    typed(ctx, P, `${prm.index} — ${prm.category}`, lx, metaY, 22, c.paper, t, T.meta, 70, 0.22, al, 1 - seg(t, T.exit, T.exit + 0.2));
    const tl = riseLine(ctx, [{ text: prm.title, font: `400 84px "${f.round}"`, color: c.paper, ls: -1 }], lx, titleY, al, t, T.title, T.exit, { breathe: 0.016 });
    // orange chip with the category doodle, pinned opposite the label
    const dk2 = ease.outBack(seg(t, T.meta + 0.1, T.meta + 0.4), 2) * (1 - ease.inBack(seg(t, T.exit, T.exit + 0.25)));
    if (dk2 > 0) {
      const ix = al === 'right' ? W - 150 : 150, iy = top ? 470 : H - 420;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(-0.08 + 0.05 * Math.sin(t * 3));
      ctx.scale(dk2, dk2);
      ctx.fillStyle = c.orange;
      roundRectPath(ctx, -52, -52, 104, 104, 26);
      ctx.fill();
      ctx.restore();
      doodle(ctx, prm.doodle, ix, iy, 78 * dk2, c.paper, seg(t, T.meta + 0.2, T.meta + 0.7), { lw: 2.6, blink: Math.max(0, 1 - Math.abs(t - 1.5) / 0.06) });
    }
    S.report(`work.${prm.image}`, tl.box, tl.alpha, tl.box.w < W * 0.8);
    // band wipes
    if (T.bandsIn > 0 && t < BAND) bands(ctx, P, 0.5 + 0.5 * (t / BAND), S.gT);
    if (prm.exit === 'bands' && t > T.bandsOut) bands(ctx, P, 0.5 * ((t - T.bandsOut) / BAND), S.gT);
  },
  cues(scene, P, dur) {
    const prm = scene.params, T = wkT(dur, prm);
    const out = [
      { t: 0, type: 'section', pattern: prm.music || 'drop', len: dur },
      { t: prm.enter === 'bands' ? BAND * 0.5 : 0, type: 'impact', gain: 0.8, size: 0.8 },
      { t: T.title, type: 'swish', len: 0.35, gain: 0.3, pan: prm.labelPos?.includes('r') ? 0.5 : -0.5 },
      { t: T.meta + 0.12, type: 'pop', gain: 0.35 },
      { t: 0.3, type: 'shimmer', len: 0.8, gain: 0.2 },
    ];
    const n = `${prm.index} — ${prm.category}`.length;
    for (let i = 0; i < n; i += 3) out.push({ t: T.meta + i / 70, type: 'tick', gain: 0.12, pan: 0 });
    if (prm.exit === 'bands') out.push({ t: T.bandsOut, type: 'whoosh', len: BAND * 2, gain: 0.6, pan: 0.5 });
    return out;
  },
  holds(scene, P, dur) {
    const prm = scene.params, T = wkT(dur, prm);
    return [
      { label: `work.${prm.image}`, text: prm.title, start: T.title + 0.5, end: T.exit + 0.05 },
      { label: `work.${prm.image}.meta`, text: `${prm.index} — ${prm.category}`, start: T.meta + `${prm.index} — ${prm.category}`.length / 70, end: T.exit + 0.1 },
    ];
  },
};

const grT = (dur) => ({ shrink: 0.5, head: 0.1, note: 0.35, panel: dur - 0.4 });
const slotRect = (i) => {
  const tot = SLOT.w * 4 + SLOT.gap * 3, x0 = W / 2 - tot / 2;
  return { x: x0 + i * (SLOT.w + SLOT.gap), y: SLOT.cy - SLOT.h / 2, w: SLOT.w, h: SLOT.h };
};

const pf_grid = {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const c = C(P), f = F(P), prm = scene.params, T = grT(dur);
    paper(ctx, P);
    const hd = riseLine(ctx, [{ text: prm.heading, font: `400 128px "${f.round}"`, color: c.blue, ls: -3 }], 130, 330, 'left', t, T.head, 99);
    S.report('grid.heading', hd.box, hd.alpha, true);
    const nk = seg(t, T.note, T.note + 0.4, ease.inOutQuad);
    if (nk > 0) {
      ctx.save();
      ctx.translate(W - 140, 250);
      ctx.rotate(-0.06);
      ctx.font = `600 50px "${f.hand}"`;
      const tw = ctx.measureText(prm.note).width;
      ctx.beginPath();
      ctx.rect(-tw - 10, -60, (tw + 20) * nk, 90);
      ctx.clip();
      ctx.fillStyle = c.orange;
      ctx.fillText(prm.note, -tw, 0);
      ctx.restore();
      doodle(ctx, 'clapper', W - 230, 155, 70, c.blue, seg(t, T.note + 0.1, T.note + 0.5), { lw: 2.6 });
    }
    // rule line like the site's filter bar
    ctx.fillStyle = rgba(c.blue, 0.35);
    ctx.fillRect(130, 420, (W - 260) * seg(t, 0.15, 0.6, ease.outCubic), 2);
    const works = prm.works; // image keys in order; the last one arrives from full frame
    const last = works.length - 1;
    works.forEach((key, i) => {
      const R0 = slotRect(i);
      const fl = Math.sin(S.gT * 2.4 + i * 1.3) * 6;
      const rot = (i % 2 ? 1 : -1) * 0.035;
      const doodleK = seg(t, 0.55 + i * 0.07, 0.95 + i * 0.07);
      doodle(ctx, prm.doodles[i], R0.x + R0.w / 2, R0.y + R0.h + 70, 54, c.blue, doodleK, { lw: 2.6 });
      if (i === last) {
        const k = ease.inOutCubic(seg(t, 0, T.shrink));
        const R = { x: lerp(0, R0.x, k), y: lerp(0, R0.y + fl, k), w: lerp(W, R0.w, k), h: lerp(H, R0.h, k) };
        const end = workCam(1, prm.lastDir ?? 1);
        holoCard(ctx, R, lerp(0, 16, k), lerp(0, 8, k), (I) => cover(ctx, img(S, key), I, lerp(end.s, 1, k), end.dx * (I.w / W), end.dy * (I.h / H)), { rot: rot * k, shadow: 0.3 * k, sheen: seg(t, 0.6, 1.4) });
      } else {
        const k = seg(t, 0.12 + i * 0.07, 0.6 + i * 0.07);
        if (k <= 0) return;
        const e = ease.outBack(k, 1.6);
        const R = { x: R0.x, y: R0.y + (1 - ease.outCubic(k)) * 520 + fl, w: R0.w, h: R0.h };
        holoCard(ctx, R, 16, 8, (I) => cover(ctx, img(S, key), I, 1.02), { rot: rot * e + (1 - e) * 0.3 * (i % 2 ? -1 : 1), shadow: 0.3, sheen: seg(t, 0.6 + i * 0.1, 1.4 + i * 0.1) });
      }
    });
    // exit: blue panel rises with an orange leading strip
    const pk = ease.inOutCubic(seg(t, T.panel, dur));
    if (pk > 0) {
      const y = H * (1 - pk);
      ctx.fillStyle = c.orange;
      ctx.fillRect(0, y - 16, W, 16 + 1);
      ctx.fillStyle = c.blue;
      ctx.fillRect(0, y, W, H - y + 1);
    }
  },
  cues(scene, P, dur) {
    const T = grT(dur);
    const out = [
      { t: 0, type: 'section', pattern: 'pre', len: dur },
      { t: 0, type: 'suck', len: T.shrink, gain: 0.45 },
      { t: T.head, type: 'swish', len: 0.4, gain: 0.35, pan: -0.5 },
      { t: T.note, type: 'shimmer', len: 0.4, gain: 0.25 },
      { t: T.panel, type: 'whoosh', len: dur - T.panel, gain: 0.55 },
    ];
    for (let i = 0; i < 3; i++) out.push({ t: 0.6 + i * 0.07, type: 'glass', note: i, gain: 0.3 });
    return out;
  },
  holds(scene, P, dur) {
    const T = grT(dur);
    return [{ label: 'grid.heading', text: scene.params.heading, start: T.head + 0.45, end: T.panel + 0.1 }];
  },
};

const enT = (dur) => ({ write: [0.05, 0.5], star: 0.48, ghost: 0.4, stay: 0.5, foot: 0.8 });

const pf_end = {
  draw(ctx, S) {
    const { t, dur, project: P, scene } = S;
    const c = C(P), f = F(P), prm = scene.params, T = enT(dur);
    ctx.fillStyle = c.blue;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, 430, 0, W / 2, 430, 820);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const land = T.write[1];
    const pd = Math.max(0, t - land) / 0.08;
    const pop = 1 + 0.05 * pd * Math.exp(1 - pd);
    const breathe = pop * (1 + 0.014 * seg(t, land + 0.2, land + 0.5) * Math.sin((t - land) * 4.5));
    const mk = b2mark(ctx, P, W / 2 - 30, 420, 420, c.paper, ease.inOutQuad(seg(t, T.write[0], T.write[1])), {
      star: ease.outBack(seg(t, T.star, T.star + 0.25), 2.4), spin: t * 1.2, breathe,
    });
    S.report('end.mark', { x: W / 2 - 30 - mk.w / 2, y: 420 - 260, w: mk.w, h: 420 }, 1, true);
    doodle(ctx, 'ghost', W / 2 + 350, 200 + Math.sin(t * 5) * 7, 140, c.paper, seg(t, T.ghost, T.ghost + 0.4), { lw: 2.6, blink: Math.max(0, 1 - Math.abs(t - 1.3) / 0.06) });
    const st = riseLine(ctx, [
      { text: prm.stay, font: `400 150px "${f.round}"`, color: c.paper, ls: -2 },
      { text: prm.curious, font: `700 170px "${f.hand}"`, color: c.orange, ls: -2 },
    ], W / 2, 850, 'center', t, T.stay, 99, { stag: 0.1, gap: 0.5 });
    S.report('end.stay', st.box, st.alpha, true);
    const fa = seg(t, T.foot, T.foot + 0.3);
    if (fa > 0) {
      ctx.save();
      ctx.globalAlpha = 0.75 * fa;
      ctx.fillStyle = c.paper;
      ctx.fillRect(130, 960, W - 260, 1.5);
      ctx.font = `400 18px "${f.mono}"`;
      ctx.letterSpacing = '3px';
      ctx.fillText(prm.footL, 130, 1000);
      const tw = ctx.measureText(prm.footR).width - 3;
      ctx.fillText(prm.footR, W - 130 - tw, 1000);
      ctx.letterSpacing = '0px';
      ctx.restore();
    }
  },
  cues(scene, P, dur) {
    const T = enT(dur);
    return [
      { t: 0, type: 'section', pattern: 'finale', len: dur },
      { t: 0, type: 'impact', gain: 0.7, size: 0.8 },
      { t: T.write[0], type: 'swish', len: 0.45, gain: 0.35 },
      { t: T.write[1], type: 'impact', gain: 1.0, size: 1.1 },
      { t: T.star, type: 'pop', gain: 0.55 },
      { t: T.star + 0.03, type: 'sparkle', gain: 0.4 },
      { t: T.stay, type: 'shimmer', len: 0.8, gain: 0.35 },
      { t: T.stay + 0.3, type: 'ding', gain: 0.45 },
    ];
  },
  holds(scene, P, dur) {
    const T = enT(dur), p = scene.params;
    return [{ label: 'end.stay', text: `${p.stay} ${p.curious}`, start: T.stay + 0.55, end: dur }];
  },
};

export default { pf_intro, pf_statement, pf_work, pf_grid, pf_end };
