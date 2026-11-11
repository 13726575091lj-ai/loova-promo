// Shared helper: static server + headless Chromium page with the render target loaded.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.css': 'text/css', '.mp4': 'video/mp4' };

export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(ROOT, p === '/' ? '/index.html' : p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

export async function openRenderer(project) {
  const server = await serve(0);
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
  await page.goto(`http://127.0.0.1:${port}/render.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 }).catch((e) => {
    throw new Error('render page failed: ' + logs.join('\n') + e.message);
  });
  const info = await page.evaluate((p) => window.__init(p), project).catch((e) => {
    throw new Error('init failed: ' + logs.join('\n') + '\n' + e.message);
  });
  return {
    info, page, logs,
    frame: (t, fmt, q, samples = 1, shutter = 0.5, fps = 30) => page.evaluate((a) => window.__frame(...a), [t, fmt, q, samples, shutter, fps]),
    close: async () => { await browser.close(); server.close(); },
  };
}

export function loadProject(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file || path.join(ROOT, 'project.json')), 'utf8'));
}

export const decodeDataURL = (d) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
