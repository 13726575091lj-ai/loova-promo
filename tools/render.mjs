// Full export: soundtrack (mix + stems) from the shared timeline, every frame from the
// headless engine, H.264/AAC MP4 mux, and a per-frame QC log.
//   node tools/render.mjs [project.json] [--out dist/name] [--crf 16] [--mb 3 motion-blur samples] [--shutter 0.5]
// Requires ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openRenderer, loadProject, decodeDataURL, ROOT } from './browser.mjs';
import { renderAudio, encodeWav } from '../src/audio.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const projFile = args.find((a) => a.endsWith('.json')) || path.join(ROOT, 'project.json');
const project = loadProject(projFile);
const base = path.resolve(ROOT, opt('--out', `dist/${path.basename(projFile, '.json')}`));
const FF = process.env.FFMPEG || 'ffmpeg';
fs.mkdirSync(path.dirname(base), { recursive: true });
const stemsDir = base + '_stems';
fs.mkdirSync(stemsDir, { recursive: true });

// 1. audio
const t0 = Date.now();
const A = renderAudio(project);
fs.writeFileSync(path.join(stemsDir, 'mix.wav'), encodeWav(A.mix, A.sr));
fs.writeFileSync(path.join(stemsDir, 'music.wav'), encodeWav(A.music, A.sr));
fs.writeFileSync(path.join(stemsDir, 'sfx.wav'), encodeWav(A.sfx, A.sr));
console.log(`audio: ${A.total.toFixed(2)}s, ${A.cues.length} cues (${Date.now() - t0} ms)`);

// 2. video frames -> ffmpeg
const R = await openRenderer(project);
const fps = project.meta.fps;
const frames = Math.round(R.info.total * fps);
const ff = spawn(FF, [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-i', path.join(stemsDir, 'mix.wav'),
  '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', opt('--preset', 'slow'), '-crf', opt('--crf', '16'), '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
  '-c:a', 'aac', '-b:a', '256k', '-ar', String(A.sr),
  '-movflags', '+faststart', '-shortest', base + '.mp4',
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));

const log = { project: path.basename(projFile), total: R.info.total, fps, frames, timeline: R.info.timeline, cues: R.info.cues, holds: R.info.holds, frameIssues: [], posterWarnings: [] };
const t1 = Date.now();
for (let i = 0; i < frames; i++) {
  const f = await R.frame(i / fps, 'image/png', 0.95, Number(opt('--mb', '3')), Number(opt('--shutter', '0.5')), fps);
  for (const r of f.reports) if (!r.fits || r.clipped) log.frameIssues.push({ frame: i, t: +(i / fps).toFixed(3), ...r });
  for (const w of f.posterWarnings) if (!log.posterWarnings.includes(w)) log.posterWarnings.push(w);
  if (!ff.stdin.write(decodeDataURL(f.data))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${frames} (${((Date.now() - t1) / (i + 1)).toFixed(0)} ms/f)\n`);
}
ff.stdin.end();
await done;
if (R.logs.length) log.browserLog = R.logs;
await R.close();
fs.writeFileSync(base + '_render-log.json', JSON.stringify(log, null, 2));
console.log(`video: ${base}.mp4  (${frames} frames, ${((Date.now() - t1) / 1000).toFixed(1)} s)`);
console.log(`frame issues: ${log.frameIssues.length}, poster warnings: ${log.posterWarnings.length}`);
