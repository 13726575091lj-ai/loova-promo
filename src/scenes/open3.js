// v3 Scene 1 — Runway open + kinetic title, modelled on the reference opener
// (Higgsfield "CONTENT FACTORY"): every letter starts huge, close to the lens, and flies back
// into place with a long 3D extrusion "tunnel"; landing fires a ring + speed-line burst; while
// held, the letters breathe in a wave that flows across each row; the exit throws every letter
// back through the lens with the same extrusion walls. White look: the footage is washed toward
// white under the type (no plate), type is dark chrome + flowing mint.
// Footage cuts (blonde → red, red → blue) get a zoom punch, slice glitch and a light-leak sweep.
import { seg, ease, lerp, clamp, rgba, mixHex, layoutText, layerCtl, withLayer, rng } from '../util.js';
import { W, H, drawIcon, drawWordmark } from '../fx.js';

const ROW1 = 292, L1_BASE = 640, L2_BASE = 930;
const VP = { x: W / 2, y: 600 }; // vanishing point of the fly-through
const FOOT_CUTS = [0.433, 1.533]; // seconds in the source clip (measured by frame difference)

export function open3Times(scene, dur) {
  const p = scene.params;
  const k = Math.min(1, dur / 2.2);
  const enter = p.enterAt ?? 0.55;
  return {
    enter: enter * k,
    row1: (p.row1At ?? enter + 0.04) * k,
    l1: (p.line1At ?? enter) * k,
    l2: (p.line2At ?? enter + 0.1) * k,
    fly: (p.flyLen ?? 0.42) * Math.max(0.8, k),
    exit: dur - (p.exitLen ?? 0.45) * Math.max(0.8, k),
    exitLen: (p.exitLen ?? 0.45) * Math.max(0.8, k),
  };
}

/** footage cut times in scene time */
function cutTimes(scene) {
  const p = scene.params;
  return FOOT_CUTS.map((c) => (c - (p.clipIn ?? 0)) / (p.playbackRate ?? 1)).filter((c) => c > 0.05);
}

function footageFrame(S, t) {
  const F = S.assets.footage;
  if (!F || !F.frames.length) return null;
  const p = S.scene.params;
  const src = (p.clipIn ?? 0) + t * (p.playbackRate ?? 1);
  const i = Math.max(0, Math.min(F.frames.length - 1, Math.floor(src * F.fps + 1e-6)));
  return F.frames[i];
}

function glyphRun(ctx, L, cx) {
  ctx.font = L.font;
  ctx.letterSpacing = `${L.letterSpacing}px`;
  const text = L.lines[0];
  const total = ctx.measureText(text).width - L.letterSpacing;
  const x0 = cx - total / 2;
  const out = [];
  let prefix = '';
  for (const ch of [...text]) {
    const x = x0 + (prefix ? ctx.measureText(prefix).width : 0);
    const w = ctx.measureText(ch).width - L.letterSpacing;
    out.push({ ch, x, w });
    prefix += ch;
  }
  ctx.letterSpacing = '0px';
  return { glyphs: out, total };
}

/** per-letter random personality (deterministic) */
function personas(n, seed) {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ s0: 3.2 + r() * 3.2, rot0: (r() - 0.5) * 0.7, sy0: 1 + r() * 0.7, d: r() * 0.1, s1: 4.5 + r() * 4.5, rot1: (r() - 0.5) * 0.6, dx: r() * 0.08 }));
}

/** gradient stops scrolled by flow (0..1) */
function flowStops(flow, colors) {
  const n = colors.length;
  const stops = [];
  for (let i = 0; i <= n * 2; i++) {
    const p = i / n - flow;
    if (p < -1 / n || p > 1 + 1 / n) continue;
    stops.push([clamp(p), colors[i % n]]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  return stops.length >= 2 ? stops : [[0, colors[0]], [1, colors[n - 1]]];
}

/**
 * Draw one glyph in pseudo-3D. `s` is the screen scale of the front face (1 = home),
 * `depth` the relative z-length of the extrusion (back face scale = s / (1 + depth)).
 * The extrusion is drawn as stacked slices, dark with a coloured rim, receding to VP.
 */
function glyph3D(ctx, L, g, base, st, look) {
  const { s, depth, rot, sy, alpha, breathe = 1 } = st;
  if (alpha <= 0.002) return;
  const cx = g.x + g.w / 2, cy = base - L.capH * 0.5;
  const slices = depth > 0.08 ? 12 : 6;
  const place = (sc) => [VP.x + (cx - VP.x) * sc, VP.y + (cy - VP.y) * sc];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = L.font;
  ctx.textBaseline = 'alphabetic';
  const paintAt = (sc, fn) => {
    const [px, py] = place(sc);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(sc * breathe, sc * sy * breathe);
    ctx.translate(-g.w / 2, L.capH * 0.5);
    fn();
    ctx.restore();
  };
  // extrusion walls, back to front
  for (let j = slices; j >= 1; j--) {
    const sc = s / (1 + depth * (j / slices));
    paintAt(sc, () => {
      ctx.fillStyle = look.wall;
      ctx.fillText(g.ch, 0, 0);
      if (depth > 0.08) {
        ctx.lineWidth = 2.2 / sc;
        ctx.strokeStyle = look.rim;
        ctx.strokeText(g.ch, 0, 0);
      }
    });
  }
  // front face
  paintAt(s, () => {
    const grd = ctx.createLinearGradient(0, -L.capH, 0, 0);
    look.stops.forEach(([p, c]) => grd.addColorStop(p, c));
    ctx.fillStyle = grd;
    ctx.fillText(g.ch, 0, 0);
    if (look.edge) {
      ctx.lineWidth = 2 / s;
      ctx.strokeStyle = look.edge;
      ctx.strokeText(g.ch, 0, 0);
    }
  });
  ctx.restore();
}

/** letter state: entrance fly-in, flowing breathe while held, exit fly-out */
function letterState(t, i, n, per, t0, T, held) {
  const e = ease.outExpo(seg(t, t0 + per.d, t0 + per.d + T.fly));
  const xk = ease.inQuart(seg(t, T.exit + per.dx + (i / Math.max(1, n - 1)) * 0.04, T.exit + per.dx + T.exitLen * 0.82));
  const s = lerp(per.s0, 1, e) * lerp(1, per.s1, xk);
  const depth = 0.03 + 0.85 * (1 - e) + 0.9 * xk;
  const rot = per.rot0 * (1 - e) + per.rot1 * xk;
  const sy = lerp(per.sy0, 1, e);
  const alpha = clamp(seg(t, t0 + per.d, t0 + per.d + 0.04)) * (1 - seg(xk, 0.75, 1));
  // breathing: a scale wave that travels across the row (phase per letter)
  const bk = held * (1 - xk);
  const breathe = 1 + bk * 0.035 * Math.sin((t - t0) * 5.2 - i * 0.55);
  return { s, depth, rot, sy, alpha, breathe, e, xk };
}

export default {
  draw(ctx, S) {
    const { t, dur, project: P, scene, assets } = S;
    const pal = P.palette, prm = scene.params;
    const T = open3Times(scene, dur);
    const cuts = cutTimes(scene);
    const mint = pal[P.brand.gradientStart] || '#00F5A0', cyan = pal[P.brand.gradientEnd] || '#00D9F5';

    // ---------------------------------------------------------------- footage with cut FX
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    let cutEnv = 0, cutAt = -1;
    for (const c of cuts) {
      const e = t < c - 0.03 ? 0 : t < c ? (t - (c - 0.03)) / 0.03 : Math.exp(-(t - c) / 0.08);
      if (e > cutEnv) (cutEnv = e), (cutAt = c);
    }
    withLayer(ctx, scene, 'footage', W / 2, H / 2, () => {
      const img = footageFrame(S, t);
      if (!img) return;
      const push = 1.0 + 0.06 * ease.inOutQuad(seg(t, 0, dur)) + 0.07 * cutEnv;
      const s = Math.max(W / img.width, H / img.height) * push;
      const dw = img.width * s, dh = img.height * s, x0 = W / 2 - dw / 2, y0 = H / 2 - dh / 2;
      if (cutEnv > 0.02) {
        // slice glitch: horizontal bands slide apart and settle back (monotonic decay, no strobing)
        const r = rng(91 + Math.round(cutAt * 100));
        const bands = 12;
        for (let b = 0; b < bands; b++) {
          const ya = (b / bands) * H, yb = ((b + 1) / bands) * H;
          const dx = (r() - 0.5) * 150 * cutEnv;
          const sy0 = ((ya - y0) / dh) * img.height, sh = ((yb - ya) / dh) * img.height;
          ctx.drawImage(img, 0, sy0, img.width, sh, x0 + dx, ya, dw, yb - ya + 1);
        }
        // colour fringe: mint / pink offset ghosts
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 0.35 * cutEnv;
        ctx.fillStyle = mixHex('#ffffff', pal.pink, 0.6);
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.3 * cutEnv;
        ctx.drawImage(img, x0 - 18 * cutEnv, y0, dw, dh);
        ctx.restore();
      } else ctx.drawImage(img, x0, y0, dw, dh);
      // wash toward white under the type; at the exit the frame goes fully white
      const wash = lerp(0, prm.wash ?? 0.6, seg(t, T.enter - 0.08, T.enter + 0.25, ease.inOutCubic));
      const wx = seg(t, T.exit + T.exitLen * 0.2, dur - 0.04, ease.inOutCubic);
      const wa = lerp(wash, 1, wx);
      if (wa > 0) {
        ctx.fillStyle = `rgba(255,255,255,${wa})`;
        ctx.fillRect(0, 0, W, H);
      }
    });
    // light-leak sweep at each cut
    const part = layerCtl(scene, 'particles');
    if (part.visible) {
      for (const c of cuts) {
        const k = seg(t, c - 0.04, c + 0.2, ease.inOutQuad);
        if (k <= 0 || k >= 1) continue;
        const x = lerp(-400, W + 400, k);
        const g = ctx.createLinearGradient(x - 260, 0, x + 260, 0);
        g.addColorStop(0, rgba(mint, 0));
        g.addColorStop(0.45, rgba(mint, 0.38 * part.opacity));
        g.addColorStop(0.55, rgba(pal.pinkHot, 0.32 * part.opacity));
        g.addColorStop(1, rgba(pal.pinkHot, 0));
        ctx.save();
        ctx.translate(x, H / 2);
        ctx.transform(1, 0, -0.35, 1, 0, 0);
        ctx.translate(-x, -H / 2);
        ctx.fillStyle = g;
        ctx.fillRect(x - 260, -200, 520, H + 400);
        ctx.restore();
      }
    }

    // ---------------------------------------------------------------- landing burst (ring + speed lines)
    const landT = T.l1 + T.fly * 0.45;
    if (part.visible) burst(ctx, t - landT, pal, mint, part.opacity, 1);
    // smaller kick on the in-hold footage cut
    const holdCut = cuts.find((c) => c > landT + 0.2 && c < T.exit);
    if (part.visible && holdCut) burst(ctx, t - holdCut, pal, mint, part.opacity * 0.6, 0.7);
    const kick = holdCut ? Math.exp(-Math.max(0, t - holdCut) / 0.09) * (t >= holdCut ? 1 : 0) : 0;

    // ---------------------------------------------------------------- type
    const held = seg(t, landT + 0.1, landT + 0.5, ease.inOutQuad);
    const ink = { stops: [[0, '#4A525C'], [0.42, '#1A1E23'], [0.6, '#0B0B0C'], [1, '#22272D']], wall: '#0B0B0C', rim: rgba(mint, 0.95), edge: null };
    const groupK = 1 + 0.02 * kick;
    ctx.save();
    ctx.translate(VP.x, VP.y);
    ctx.scale(groupK, groupK);
    ctx.translate(-VP.x, -VP.y);

    // row 1 — LOOVA icon + wordmark, flies in as one unit
    withLayer(ctx, scene, 'brandRow', W / 2, ROW1, () => {
      const per = { s0: 4.2, rot0: -0.12, sy0: 1.2, d: 0, s1: 6.5, rot1: 0.15, dx: 0 };
      const st = letterState(t, 0, 1, per, T.row1, T, held);
      if (st.alpha <= 0.002) return;
      const iconS = 74, wordH = 54, gap = 22;
      const wordW = assets.logo.wordmark.aspect * wordH;
      const total = iconS + gap + wordW, x0 = W / 2 - total / 2;
      const cy = ROW1;
      const place = (sc) => [VP.x + (W / 2 - VP.x) * sc, VP.y + (cy - VP.y) * sc];
      ctx.save();
      ctx.globalAlpha *= st.alpha;
      const slices = st.depth > 0.08 ? 10 : 0;
      for (let j = slices; j >= 0; j--) {
        const sc = st.s / (1 + st.depth * (j / Math.max(1, slices)));
        const [px, py] = place(sc);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(st.rot);
        ctx.scale(sc * st.breathe, sc * st.sy * st.breathe);
        ctx.translate(-W / 2, -cy);
        if (j > 0) {
          ctx.globalAlpha *= 0.85;
          drawIcon(ctx, x0, cy - iconS / 2, iconS, P, assets.logo, { fill: '#0B0B0C', boltScale: 0 });
          drawWordmark(ctx, x0 + iconS + gap, cy - wordH / 2, wordH, P, assets.logo, '#0B0B0C');
        } else {
          drawIcon(ctx, x0, cy - iconS / 2, iconS, P, assets.logo);
          drawWordmark(ctx, x0 + iconS + gap, cy - wordH / 2, wordH, P, assets.logo, '#0B0B0C');
        }
        ctx.restore();
      }
      ctx.restore();
      S.report('open.brandRow', { x: x0, y: cy - iconS / 2, w: total, h: iconS }, st.e * (1 - st.xk), true);
    });

    // row 2 — SEEDREAM, dark chrome
    withLayer(ctx, scene, 'line1', W / 2, L1_BASE - 120, () => {
      const L = layoutText(ctx, prm.line1, { family: P.fonts.display, size: 250, maxWidth: 1640, letterSpacing: -0.005 });
      const { glyphs, total } = glyphRun(ctx, L, W / 2);
      const pers = personas(glyphs.length, 7);
      let minE = 1, maxX = 0;
      // draw far letters first so the closest (largest) sits on top
      const order = glyphs.map((g, i) => i).sort((a, b) => pers[a].s0 - pers[b].s0);
      const states = glyphs.map((g, i) => letterState(t, i, glyphs.length, pers[i], T.l1, T, held));
      order.reverse().forEach((i) => {
        const st = states[i];
        st.sy *= 1.18;
        glyph3D(ctx, L, glyphs[i], L1_BASE, st, ink);
      });
      states.forEach((st) => ((minE = Math.min(minE, st.e)), (maxX = Math.max(maxX, st.xk))));
      S.report('open.line1', { x: W / 2 - total / 2, y: L1_BASE - L.capH * 1.18, w: total, h: L.capH * 1.18 }, minE * (1 - maxX), L.fits);
    });

    // row 3 — 5.5, flowing mint gradient
    withLayer(ctx, scene, 'line2', W / 2, L2_BASE - 160, () => {
      const L = layoutText(ctx, prm.line2, { family: P.fonts.display, size: 330, maxWidth: 1500 });
      const { glyphs, total } = glyphRun(ctx, L, W / 2);
      const pers = personas(glyphs.length, 19);
      const flow = (t * 0.6) % 1;
      const look = {
        stops: flowStops(flow, [mixHex('#FFFFFF', mint, 0.35), mint, cyan, '#00A98C', mint]),
        wall: '#06261F', rim: rgba(mint, 0.9), edge: 'rgba(6,38,31,0.9)',
      };
      let minE = 1, maxX = 0;
      glyphs.forEach((g, i) => {
        const st = letterState(t, i, glyphs.length, pers[i], T.l2, T, held);
        st.sy *= 1.18;
        glyph3D(ctx, L, g, L2_BASE, st, look);
        minE = Math.min(minE, st.e);
        maxX = Math.max(maxX, st.xk);
      });
      S.report('open.line2', { x: W / 2 - total / 2, y: L2_BASE - L.capH * 1.18, w: total, h: L.capH * 1.18 }, minE * (1 - maxX), L.fits);
    });
    ctx.restore();
  },

  cues(scene, P, dur) {
    const T = open3Times(scene, dur);
    const landT = T.l1 + T.fly * 0.45;
    const cuts = cutTimes(scene);
    const n1 = [...String(scene.params.line1 ?? '')].length;
    const out = [
      { t: 0, type: 'section', pattern: 'intro', len: landT },
      { t: 0.02, type: 'riser', len: landT - 0.02, gain: 0.45 },
      { t: Math.max(0, T.enter - 0.06), type: 'whoosh', len: T.fly, gain: 0.6, pan: 0 },
      { t: landT, type: 'impact', gain: 1.0, size: 1.0 },
      { t: landT, type: 'section', pattern: 'drop', len: T.exit - landT },
      { t: landT + 0.05, type: 'shimmer', len: 0.6, gain: 0.3 },
      { t: T.exit, type: 'sweep', len: dur - T.exit, gain: 0.75 },
      { t: T.exit, type: 'section', pattern: 'fill', len: dur - T.exit },
    ];
    for (const c of cuts) {
      out.push({ t: Math.max(0, c - 0.04), type: 'swish', len: 0.26, gain: c > landT ? 0.4 : 0.55, pan: -0.3 });
      if (c > landT + 0.2 && c < T.exit) out.push({ t: c, type: 'impact', gain: 0.45, size: 0.5 });
    }
    // letter landings: soft ticks as the per-letter delays resolve
    const pers = personas(n1, 7);
    pers.forEach((p, i) => i && out.push({ t: T.l1 + p.d + T.fly * 0.45, type: 'tick', gain: 0.18, pan: (i / Math.max(1, n1 - 1)) * 1.2 - 0.6 }));
    return out;
  },

  holds(scene, P, dur) {
    const T = open3Times(scene, dur);
    const landAll = (t0, n, seed) => t0 + Math.max(...personas(n, seed).map((p) => p.d)) + T.fly * 0.7;
    const n1 = [...String(scene.params.line1 ?? '')].length, n2 = [...String(scene.params.line2 ?? '')].length;
    return [
      { label: 'open.brandRow', layer: 'brandRow', text: P.brand.name, start: T.row1 + T.fly * 0.7, end: T.exit + 0.1 },
      { label: 'open.line1', layer: 'line1', text: scene.params.line1, start: landAll(T.l1, n1, 7), end: T.exit + 0.1 },
      { label: 'open.line2', layer: 'line2', text: scene.params.line2, start: landAll(T.l2, n2, 19), end: T.exit + 0.1 },
    ];
  },
};

/** expanding ring + radial speed lines; u = time since trigger */
function burst(ctx, u, pal, mint, op, size) {
  if (u < 0 || u > 0.45) return;
  const k = ease.outCubic(u / 0.45);
  ctx.save();
  ctx.globalAlpha = op * (1 - k);
  ctx.strokeStyle = rgba(mint, 1);
  ctx.lineWidth = lerp(16, 2, k) * size;
  ctx.beginPath();
  ctx.arc(VP.x, VP.y, lerp(220, 1150, k) * size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba('#0B0B0C', 0.8);
  ctx.lineWidth = lerp(3, 1, k) * size;
  ctx.beginPath();
  ctx.arc(VP.x, VP.y, lerp(180, 980, k) * size, 0, Math.PI * 2);
  ctx.stroke();
  // speed lines
  const r = rng(33);
  ctx.lineCap = 'round';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + r() * 0.15;
    const r0 = lerp(380, 820, k) * size + r() * 80, len = (90 + r() * 140) * (1 - k * 0.6) * size;
    ctx.strokeStyle = i % 3 === 0 ? rgba(mint, 1) : rgba('#0B0B0C', 0.85);
    ctx.lineWidth = (i % 3 === 0 ? 5 : 3) * size;
    ctx.beginPath();
    ctx.moveTo(VP.x + Math.cos(a) * r0, VP.y + Math.sin(a) * r0 * 0.75);
    ctx.lineTo(VP.x + Math.cos(a) * (r0 + len), VP.y + Math.sin(a) * (r0 + len) * 0.75);
    ctx.stroke();
  }
  ctx.restore();
}
