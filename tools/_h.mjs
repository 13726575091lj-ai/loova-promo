import fs from 'fs';
import { collectHolds, resolveTimeline } from '../src/timeline.js';
import { minHold } from '../src/util.js';
const P = JSON.parse(fs.readFileSync(process.argv[2] || 'project.json'));
const tl = resolveTimeline(P);
console.log('total', tl.total.toFixed(3));
for (const h of collectHolds(P, tl)) { const d = h.end - h.start, m = minHold(h.text); console.log((d >= m ? 'ok  ' : 'FAIL'), h.label.padEnd(18), d.toFixed(3), '>=', m.toFixed(3)); }
