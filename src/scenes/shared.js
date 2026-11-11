// Geometry shared between scenes so hand-offs match exactly (shape-matched transitions).
import { W, H } from '../fx.js';

export const CARD = { w: 575, h: 860, r: 14 };
/** front card centre in localize (world x offset from screen centre, camera 1:1 at z=0) */
export const FRONT_X = 340;
export const CAM_D = 1600;

export const frontCardRect = () => ({ x: W / 2 + FRONT_X - CARD.w / 2, y: H / 2 - CARD.h / 2, w: CARD.w, h: CARD.h, r: CARD.r });
export const centerCardRect = () => ({ x: W / 2 - CARD.w / 2, y: H / 2 - CARD.h / 2, w: CARD.w, h: CARD.h, r: CARD.r });

/** Localize background (white + soft blue light behind the front card); also used by the slot exit. */
export function drawLocalizeBg(ctx, P, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = P.palette.paper;
  ctx.fillRect(0, 0, W, H);
  // soft blue light pool behind the front card
  const g = ctx.createRadialGradient(W / 2 + FRONT_X, H / 2, 0, W / 2 + FRONT_X, H / 2, 900);
  g.addColorStop(0, hexA(P.palette.blueGlow, 0.16));
  g.addColorStop(1, hexA(P.palette.blueGlow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function hexA(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export function firstMarket(P) {
  const loc = P.scenes.find((s) => s.type === 'localize' && s.enabled !== false);
  return loc?.params.markets?.[0]?.id ?? 'en';
}

/** Brand lockup layout (icon + wordmark) used by the brand scene and the layers hand-off */
export function lockupLayout(project, logo, iconSize) {
  const wordH = iconSize * 0.5;
  const gap = iconSize * 0.2;
  const wordW = logo.wordmark.aspect * wordH;
  const total = iconSize + gap + wordW;
  const x0 = W / 2 - total / 2;
  const cy = H / 2 - 40;
  return { icon: { x: x0, y: cy - iconSize / 2, s: iconSize }, word: { x: x0 + iconSize + gap, y: cy - wordH / 2, h: wordH, w: wordW }, total, cy };
}

/**
 * White field with flowing light: three large soft colour pools (mint, cyan, pink) drift on slow
 * Lissajous paths, plus a faint diagonal light band. Driven by global time `gT`, so consecutive
 * scenes that use it hand off without a jump.
 */
export function drawFlowBg(ctx, P, gT, alpha = 1) {
  if (alpha <= 0) return;
  const pal = P.palette;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, W, H);
  const pools = [
    [pal.mint, 0.16, 0.25, 0.3, 0.31, 0.43, 0.0],
    [pal.cyan, 0.14, 0.75, 0.62, 0.23, 0.37, 2.1],
    [pal.pinkHot, 0.1, 0.55, 0.15, 0.29, 0.21, 4.2],
  ];
  for (const [c, a, bx, by, fx, fy, ph] of pools) {
    const x = W * (bx + 0.16 * Math.sin(gT * fx * 2 + ph)), y = H * (by + 0.18 * Math.cos(gT * fy * 2 + ph));
    const g = ctx.createRadialGradient(x, y, 0, x, y, 820);
    g.addColorStop(0, hexA(c, a));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // slow light band
  const u = (gT * 0.12) % 1;
  const bx = -600 + u * (W + 1200);
  const lg = ctx.createLinearGradient(bx - 300, 0, bx + 300, H * 0.4);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
