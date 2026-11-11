import fs from 'node:fs';
import { collectHolds, resolveTimeline } from '../src/timeline.js';
import { minHold } from '../src/util.js';
const p = JSON.parse(fs.readFileSync('project.json','utf8'));
const tl=resolveTimeline(p); console.log('total', tl.total, tl.scenes.map(s=>`${s.id}@${s.start.toFixed(2)}`).join(' '));
for (const h of collectHolds(p)) console.log(h.label.padEnd(18), (h.end-h.start).toFixed(3), minHold(h.text).toFixed(3), h.end-h.start>=minHold(h.text)?'ok':'FAIL');
