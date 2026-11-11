// Export the English poster as standalone layer PNGs (2× resolution) + the flattened composite.
//   node tools/export-layers.mjs [project.json] --out dist/layers
import fs from 'node:fs';
import path from 'node:path';
import { openRenderer, loadProject, decodeDataURL, ROOT } from './browser.mjs';

const args = process.argv.slice(2);
const i = args.indexOf('--out');
const out = path.resolve(ROOT, i >= 0 ? args[i + 1] : 'dist/layers');
fs.mkdirSync(out, { recursive: true });
const R = await openRenderer(loadProject(args.find((a) => a.endsWith('.json'))));
const L = await R.page.evaluate(() => window.__posterLayers());
let n = 0;
for (const [k, v] of Object.entries(L)) {
  if (k === 'warnings') continue;
  const name = k === 'flat' ? 'en_poster_flat.png' : `en_layer_${String(++n).padStart(2, '0')}_${k}.png`;
  fs.writeFileSync(path.join(out, name), decodeDataURL(v));
  console.log('wrote', name);
}
if (L.warnings.length) console.log('warnings:', L.warnings);
await R.close();
