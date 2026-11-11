// Shared math, easing, colour and text-layout helpers. No DOM access at import time,
// so this module also loads in Node (audio + QC tooling).

/** minimum readable hold for a text (s): shared by scenes, editor warnings and QC */
export const minHold = (text) => 0.45 + 0.025 * String(text ?? '').length;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a)));
/** progress of t through [a,b] with optional easing */
export const seg = (t, a, b, ease = (x) => x) => ease(invLerp(a, b, t));
export const smoothstep = (a, b, v) => {
  const x = invLerp(a, b, v);
  return x * x * (3 - 2 * x);
};

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inQuart: (x) => x * x * x * x,
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
};

/** deterministic PRNG (mulberry32) so every render is identical */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export const rgba = (hex, a = 1) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Resolve a colour reference: palette key or literal hex */
export const col = (project, key) => (key && key.startsWith('#') ? key : project.palette[key] || key);

// ------------------------------------------------------------------ text layout
/**
 * Lay out (possibly multi-line) text inside a container.
 * The font size shrinks until every line fits maxWidth (and maxHeight if given).
 * Returns measured box so containers can size themselves around the text.
 */
export function layoutText(ctx, text, o) {
  const lines = String(text ?? '').split('\n');
  const weight = o.weight ?? 400;
  const family = o.family;
  const ls = o.letterSpacing ?? 0; // em
  let size = o.size;
  const minSize = o.minSize ?? Math.max(6, size * 0.35);
  const lh = o.lineHeight ?? 1.1;
  const sx = o.scaleX ?? 1;
  let widths = [];
  let fits = false;
  for (let iter = 0; iter < 60; iter++) {
    ctx.font = `${o.italic ? 'italic ' : ''}${weight} ${size}px "${family}"`;
    ctx.letterSpacing = `${ls * size}px`;
    widths = lines.map((l) => ctx.measureText(l).width * sx);
    const w = Math.max(0, ...widths);
    const h = size * (1 + (lines.length - 1) * lh);
    const okW = !o.maxWidth || w <= o.maxWidth + 0.5;
    const okH = !o.maxHeight || h <= o.maxHeight + 0.5;
    if ((okW && okH) || size <= minSize) {
      fits = okW && okH;
      break;
    }
    size = Math.max(minSize, size * 0.96);
  }
  const m = ctx.measureText('H');
  const capH = m.actualBoundingBoxAscent || size * 0.72;
  const width = Math.max(0, ...widths);
  const height = size * (1 + (lines.length - 1) * lh);
  ctx.letterSpacing = '0px';
  return { lines, widths, size, width, height, capH, lineStep: size * lh, fits, font: `${o.italic ? 'italic ' : ''}${weight} ${size}px "${family}"`, letterSpacing: ls * size, scaleX: sx };
}

/** draw a layout produced by layoutText. align: left|center|right; y is the first baseline */
export function drawLayout(ctx, L, x, y, align = 'left', paint = (c, s, px, py) => c.fillText(s, px, py)) {
  ctx.save();
  ctx.font = L.font;
  ctx.letterSpacing = `${L.letterSpacing}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  L.lines.forEach((line, i) => {
    const w = L.widths[i];
    // letterSpacing adds trailing space after the last glyph; compensate for visual alignment
    const trail = L.letterSpacing * L.scaleX;
    let px = x;
    if (align === 'center') px = x - (w - trail) / 2;
    else if (align === 'right') px = x - (w - trail);
    const py = y + i * L.lineStep;
    if (L.scaleX !== 1) {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(L.scaleX, 1);
      paint(ctx, line, 0, 0);
      ctx.restore();
    } else paint(ctx, line, px, py);
  });
  ctx.restore();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Per-layer transform controls exposed in project.json: {visible, scale, x, y, opacity} */
export function layerCtl(scene, id) {
  const l = (scene.layers && scene.layers[id]) || {};
  return { visible: l.visible !== false, scale: l.scale ?? 1, x: l.x ?? 0, y: l.y ?? 0, opacity: l.opacity ?? 1 };
}

/** Apply a layer control around an anchor point; returns false when hidden */
export function withLayer(ctx, scene, id, ax, ay, fn) {
  const L = layerCtl(scene, id);
  if (!L.visible || L.opacity <= 0) return false;
  ctx.save();
  ctx.globalAlpha *= L.opacity;
  ctx.translate(ax + L.x, ay + L.y);
  ctx.scale(L.scale, L.scale);
  ctx.translate(-ax, -ay);
  fn(L);
  ctx.restore();
  return true;
}
