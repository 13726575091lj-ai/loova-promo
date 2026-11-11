// Render still frames for review:  node tools/stills.mjs [project.json] --times 0.5,2.3 --out build/stills
//   --sheet  also assemble a contact sheet (requires ffmpeg)
import fs from 'node:fs';
import path from 'node:path';
import { openRenderer, loadProject, decodeDataURL, ROOT } from './browser.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a) => a.endsWith('.json'));
const project = loadProject(file);
const out = path.resolve(ROOT, opt('--out', 'build/stills'));
fs.mkdirSync(out, { recursive: true });
const R = await openRenderer(project);
let times = opt('--times', null);
times = times ? times.split(',').map(Number) : Array.from({ length: Math.ceil(R.info.total * 2) }, (_, i) => i * 0.5 + 0.25);
for (const t of times) {
  const f = await R.frame(t, 'image/jpeg', 0.9);
  const name = `t${t.toFixed(2).padStart(6, '0')}.jpg`;
  fs.writeFileSync(path.join(out, name), decodeDataURL(f.data));
  const issues = f.reports.filter((r) => !r.fits || r.clipped);
  console.log(name, f.scene, issues.length ? JSON.stringify(issues) : '', f.posterWarnings.length ? f.posterWarnings.join(';') : '');
}
if (R.logs.length) console.log('browser log:\n' + R.logs.join('\n'));
await R.close();
