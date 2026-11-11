// Geometry shared between scenes so hand-offs match exactly (shape-matched transitions).
import { W, H } from '../fx.js';

export const CARD = { w: 575, h: 860, r: 14 };
/** front card centre in localize (world x offset from screen centre, camera 1:1 at z=0) */
export const FRONT_X = 340;
export const CAM_D = 1600;

export const frontCardRect = () => ({ x: W / 2 + FRONT_X - CARD.w / 2, y: H / 2 - CARD.h / 2, w: CARD.w, h: CARD.h, r: CARD.r });
export const centerCardRect = () => ({ x: W / 2 - CARD.w / 2, y: H / 2 - CARD.h / 2, w: CARD.w, h: CARD.h, r: CARD.r });

/** Localize background (navy + blue glow behind the front card); also used by the slot exit. */
export function drawLocalizeBg(ctx, P, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = P.palette.navy;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2 + FRONT_X, H / 2, 0, W / 2 + FRONT_X, H / 2, 900);
  g.addColorStop(0, hexA(P.palette.blueGlow, 0.32));
  g.addColorStop(1, hexA(P.palette.navy, 0));
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
