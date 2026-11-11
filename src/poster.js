// English poster rebuilt as editable layers: photo plates from assets/layers +
// live type layers rendered from project.json (text, font, colour, position, scale).
import { layoutText, col, clamp } from './util.js';

export const POSTER_LAYER_ORDER = ['background', 'crowd', 'masthead', 'subject', 'coverlines', 'headline'];
const TEXT_LAYERS = { masthead: ['masthead'], coverlines: ['date', 'issue', 'cover1', 'cover2'], headline: ['headline', 'deck'] };
const RES = 2; // type layers are rendered at 2× poster resolution

export class PosterKit {
  constructor(assets) {
    this.assets = assets;
    this.cache = { key: null, layers: null, flat: null, version: 0, warnings: [] };
  }

  build(project) {
    const P = project.poster;
    const key = JSON.stringify([P.en, project.palette, project.fonts]);
    if (this.cache.key === key) return this.cache;
    const [pw, ph] = P.size;
    const warnings = [];
    const layers = [];
    for (const id of POSTER_LAYER_ORDER) {
      const ctl = P.en.layers?.[id] || {};
      const c = new OffscreenCanvas(pw * RES, ph * RES);
      const g = c.getContext('2d');
      g.scale(RES, RES);
      g.translate(pw / 2 + (ctl.x || 0), ph / 2 + (ctl.y || 0));
      g.scale(ctl.scale ?? 1, ctl.scale ?? 1);
      g.translate(-pw / 2, -ph / 2);
      if (TEXT_LAYERS[id]) {
        for (const el of TEXT_LAYERS[id]) drawTextEl(g, P.en.text[el], project, el, warnings, pw);
      } else {
        const img = this.assets.images[P.en[id]];
        if (img) g.drawImage(img, 0, 0, pw, ph);
      }
      layers.push({ id, source: c, visible: ctl.visible !== false, opacity: ctl.opacity ?? 1, label: P.en.labels?.[id] || id.toUpperCase() });
    }
    const flat = new OffscreenCanvas(pw * RES, ph * RES);
    const fg = flat.getContext('2d');
    fg.fillStyle = '#e9e9e9';
    fg.fillRect(0, 0, flat.width, flat.height);
    for (const L of layers) if (L.visible) { fg.globalAlpha = L.opacity; fg.drawImage(L.source, 0, 0); }
    this.cache = { key, layers, flat, version: this.cache.version + 1, warnings };
    return this.cache;
  }

  /** texture source for a market poster (EN uses the live layered composite) */
  source(project, market) {
    if (market === 'en') return { source: this.build(project).flat, version: this.cache.version };
    const img = this.assets.images[project.poster.images[market]];
    return { source: img, version: 0 };
  }
}

function drawTextEl(g, el, project, name, warnings, pw) {
  if (!el || el.visible === false || !String(el.text ?? '').length) return;
  const family = project.fonts[el.font] || el.font;
  const color = col(project, el.color || 'paper');
  if (el.mode === 'masthead') return drawMasthead(g, el, project, family, color, warnings, name);
  const L = layoutText(g, el.text, {
    family, weight: el.weight ?? 400, size: el.size, minSize: el.minSize ?? el.size * 0.5, maxWidth: el.maxWidth, maxHeight: el.maxHeight,
    lineHeight: el.lineHeight ?? 1.15, letterSpacing: el.letterSpacing ?? 0,
  });
  if (!L.fits) warnings.push(`poster.${name}: text does not fit its box even at min size`);
  g.save();
  g.font = L.font;
  g.letterSpacing = `${L.letterSpacing}px`;
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  const base = el.y + L.capH;
  const blockW = L.width - L.letterSpacing;
  L.lines.forEach((line, i) => {
    const w = L.widths[i] - L.letterSpacing;
    // blockRight: lines share a left edge, the block's right edge sits on x
    const x = el.align === 'right' ? el.x - w : el.align === 'center' ? el.x - w / 2 : el.align === 'blockRight' ? el.x - blockW : el.x;
    g.fillText(line, x, base + i * L.lineStep);
  });
  g.restore();
  const left = el.align === 'right' || el.align === 'blockRight' ? el.x - L.width : el.align === 'center' ? el.x - L.width / 2 : el.x;
  if (left < 0 || left + L.width > pw + 1) warnings.push(`poster.${name}: text crosses the poster edge`);
}

/** Masthead: fills its box like a magazine nameplate; accent letters take the accent colour. */
function drawMasthead(g, el, project, family, color, warnings, name) {
  const [bx, by, bw, bh] = el.box;
  const text = String(el.text);
  const chars = [...text];
  const weight = el.weight ?? 500;
  // size so that cap height == box height
  g.font = `${weight} 100px "${family}"`;
  g.letterSpacing = '0px';
  const capRatio = (g.measureText('H').actualBoundingBoxAscent || 70) / 100;
  let size = bh / capRatio;
  g.font = `${weight} ${size}px "${family}"`;
  const widths = chars.map((c) => g.measureText(c).width);
  const natural = widths.reduce((a, b) => a + b, 0);
  let sx = 1, gap = (el.tracking ?? 0) * size;
  let total = natural + gap * (chars.length - 1);
  if (total > bw) {
    sx = Math.max(el.minScaleX ?? 0.72, bw / total);
    if (total * sx > bw) {
      const k = bw / (total * sx);
      size *= k;
      gap *= k;
      for (let i = 0; i < widths.length; i++) widths[i] *= k;
      warnings.push(`poster.${name}: masthead shrunk to fit (${chars.length} letters)`);
    }
  } else if (chars.length > 1 && el.justify !== false) {
    gap += Math.min((bw - total) / (chars.length - 1), size * 0.2);
  }
  total = (widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1)) * sx;
  g.save();
  g.font = `${weight} ${size}px "${family}"`;
  g.textBaseline = 'alphabetic';
  const accent = new Set(el.accent || []);
  const accentColor = col(project, el.accentColor || 'blue');
  const x0 = bx + (bw - total) / 2;
  const base = by + size * capRatio;
  g.translate(x0, base);
  g.scale(sx, 1);
  let x = 0;
  chars.forEach((c, i) => {
    g.fillStyle = accent.has(i) ? accentColor : color;
    g.fillText(c, x, 0);
    x += widths[i] + gap;
  });
  g.restore();
  return clamp(0);
}
