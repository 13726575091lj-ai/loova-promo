// Browser render engine: loads assets, resolves the shared timeline, draws any frame.
import { resolveTimeline, sceneAt, collectCues, collectHolds } from './timeline.js';
import { SCENES } from './scenes/index.js';
import { PlaneRenderer } from './gl3d.js';
import { PosterKit } from './poster.js';
import { W, H } from './fx.js';

export const FONT_FILES = {
  'Archivo Black': 'assets/fonts/ArchivoBlack-Regular.ttf',
  Anton: 'assets/fonts/Anton-Regular.ttf',
  Montserrat: 'assets/fonts/Montserrat.ttf',
  'Bodoni Moda': 'assets/fonts/BodoniModa.ttf',
  'Libre Bodoni': 'assets/fonts/LibreBodoni.ttf',
  Jost: 'assets/fonts/Jost.ttf',
  Unbounded: 'assets/fonts/Unbounded.ttf',
  'Noto Sans Thai': 'assets/fonts/NotoSansThai.ttf',
  'Noto Sans JP': 'assets/fonts/NotoSansJP.ttf',
  'Noto Sans KR': 'assets/fonts/NotoSansKR.ttf',
};

const loadImage = (src) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image failed: ' + src));
    im.src = src;
  });

export async function loadAssets(project, base = '') {
  await Promise.all(
    Object.entries(FONT_FILES).map(async ([name, url]) => {
      const ff = new FontFace(name, `url(${base}${url})`, { weight: '100 900' });
      await ff.load();
      document.fonts.add(ff);
    })
  );
  const urls = new Set([...Object.values(project.poster.images), project.poster.en.background, project.poster.en.crowd, project.poster.en.subject]);
  const images = {};
  await Promise.all([...urls].map(async (u) => (images[u] = await loadImage(base + u))));
  const logo = await (await fetch(base + project.logo.paths)).json();
  return { images, logo };
}

export class Engine {
  constructor(canvas, project, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.assets = assets;
    this.gl = new PlaneRenderer();
    this.poster = new PosterKit(assets);
    this.setProject(project);
  }

  setProject(project) {
    this.project = project;
    this.timeline = resolveTimeline(project);
    this.cues = collectCues(project, this.timeline);
    this.holds = collectHolds(project, this.timeline);
  }

  get duration() {
    return this.timeline.total;
  }

  /** draw frame at absolute time t (seconds). Returns QC reports for the frame. */
  render(t) {
    const ctx = this.ctx;
    const P = this.project;
    const tl = this.timeline;
    const scene = sceneAt(tl, Math.min(t, tl.total - 1e-6));
    const mod = SCENES[scene.type];
    const reports = [];
    const margin = (P.meta.safeMargin ?? 0.04);
    const safe = { x0: W * margin, y0: H * margin, x1: W * (1 - margin), y1: H * (1 - margin) };
    const S = {
      t: Math.max(0, t - scene.start), dur: scene.dur, gT: t, scene, project: P, assets: this.assets, gl: this.gl, poster: this.poster,
      report: (label, b, alpha, fits) => {
        if (alpha < 0.6) return;
        const clipped = b.x < safe.x0 - 0.5 || b.y < safe.y0 - 0.5 || b.x + b.w > safe.x1 + 0.5 || b.y + b.h > safe.y1 + 0.5;
        reports.push({ label, box: b, fits, clipped });
      },
    };
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    mod.draw(ctx, S);
    ctx.restore();
    const pw = this.poster.cache.warnings || [];
    return { scene: scene.id, reports, posterWarnings: pw };
  }
}
