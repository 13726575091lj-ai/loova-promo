// Editor UI: live preview on the shared timeline + controls generated from project.json.
// Every control writes straight into the project object; the engine and the audio
// worker re-resolve the timeline, so later scenes and all cues follow duration edits.
import { Engine, loadAssets, FONT_FILES } from './engine.js';
import { minHold } from './util.js';

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  kids.flat().forEach((c) => e.append(c));
  return e;
};

let original, project, engine, audioBuf = null, audioCtx = null, src = null;
let playing = false, t = 0, clock0 = 0, audioJob = 0;
const worker = new Worker(new URL('./audio-worker.js', import.meta.url), { type: 'module' });

async function boot() {
  original = await (await fetch('project.json', { cache: 'no-store' })).json();
  project = structuredClone(original);
  const assets = await loadAssets(project);
  engine = new Engine($('#c'), project, assets);
  buildPanel();
  changed(true);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ change handling
let audioTimer = 0;
function changed(structural = false) {
  engine.setProject(project);
  t = Math.min(t, engine.duration);
  drawStrip();
  renderNow();
  checkHolds();
  clearTimeout(audioTimer);
  audioTimer = setTimeout(requestAudio, 350);
  if (structural) buildPanel();
}

function requestAudio() {
  const id = ++audioJob;
  $('#status').dataset.audio = 'rendering soundtrack…';
  worker.postMessage({ id, project: JSON.parse(JSON.stringify(project)) });
}
worker.onmessage = (e) => {
  if (e.data.id !== audioJob) return;
  if (e.data.error) return console.error(e.data.error);
  audioCtx ||= new AudioContext();
  const b = audioCtx.createBuffer(2, e.data.L.length, e.data.sr);
  b.copyToChannel(e.data.L, 0);
  b.copyToChannel(e.data.R, 1);
  audioBuf = b;
  $('#status').dataset.audio = `soundtrack ready (${e.data.cues.length} cues)`;
  if (playing) startAudio();
  showStatus();
};

// ------------------------------------------------------------------ transport
function startAudio() {
  stopAudio();
  if (!audioBuf || !$('#sound').checked) return;
  src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  src.connect(audioCtx.destination);
  src.start(0, Math.min(t, audioBuf.duration - 0.01));
}
function stopAudio() {
  if (src) { try { src.stop(); } catch {} src = null; }
}
function play() {
  if (t >= engine.duration - 0.02) t = 0;
  playing = true;
  audioCtx ||= new AudioContext();
  audioCtx.resume();
  clock0 = performance.now() / 1000 - t;
  startAudio();
  $('#play').textContent = 'Pause';
}
function pause() {
  playing = false;
  stopAudio();
  $('#play').textContent = 'Play';
}
$('#play').onclick = () => (playing ? pause() : play());
$('#sound').onchange = () => (playing ? startAudio() : 0);
$('#scrub').oninput = (e) => {
  t = (e.target.value / 1000) * engine.duration;
  if (playing) play();
  renderNow();
};
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select')) return;
  if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
  if (e.code === 'ArrowRight') { t = Math.min(engine.duration, t + 1 / 30); renderNow(); }
  if (e.code === 'ArrowLeft') { t = Math.max(0, t - 1 / 30); renderNow(); }
});

let lastReport = null;
function renderNow() {
  lastReport = engine.render(t);
  $('#time').textContent = `${t.toFixed(2)} / ${engine.duration.toFixed(2)} s`;
  $('#scrub').value = Math.round((t / engine.duration) * 1000);
  const ph = $('#strip .ph');
  if (ph) ph.style.left = `${(t / engine.duration) * 100}%`;
  showStatus();
}
function loop() {
  if (playing) {
    t = performance.now() / 1000 - clock0;
    if (t >= engine.duration) { t = engine.duration - 1e-3; pause(); }
    renderNow();
  }
  requestAnimationFrame(loop);
}

let holdWarnings = [];
function checkHolds() {
  holdWarnings = engine.holds.filter((h) => h.end - h.start < minHold(h.text)).map((h) => `${h.label} visible ${(h.end - h.start).toFixed(2)} s (needs ${minHold(h.text).toFixed(2)} s)`);
}
function showStatus() {
  if (!lastReport) return;
  const issues = lastReport.reports.filter((r) => !r.fits || r.clipped).map((r) => `${r.label}: ${!r.fits ? 'text overflow' : ''}${r.clipped ? ' outside safe area' : ''}`);
  const all = [...issues, ...lastReport.posterWarnings, ...holdWarnings];
  $('#status').innerHTML = `<b>${lastReport.scene}</b> · ${$('#status').dataset.audio || ''} ` + (all.length ? all.map((w) => `<div class="warn">${w}</div>`).join('') : ' · no text/layout warnings');
}

function drawStrip() {
  const s = $('#strip');
  s.innerHTML = '';
  const T = engine.duration;
  for (const sc of engine.timeline.scenes) {
    s.append(el('div', { class: 'sc', style: `left:${(sc.start / T) * 100}%;width:${(sc.dur / T) * 100}%;background:hsl(${(sc.index * 57) % 360} 25% 22%)` }, `${sc.id} ${sc.dur.toFixed(1)}s`));
  }
  for (const c of engine.cues) if (c.type !== 'section') s.append(el('div', { class: 'cue', title: `${c.type} @ ${c.t.toFixed(2)}s`, style: `left:${(c.t / T) * 100}%` }));
  s.append(el('div', { class: 'ph' }));
  s.onclick = (e) => {
    const r = s.getBoundingClientRect();
    t = ((e.clientX - r.left) / r.width) * T;
    if (playing) play();
    renderNow();
  };
}

// ------------------------------------------------------------------ controls
const row = (label, input) => el('div', { class: 'row' }, el('label', { title: label }, label), input);
function textInput(obj, key, cb = () => changed()) {
  const v = obj[key];
  const multi = typeof v === 'string' && v.includes('\n');
  const i = el(multi ? 'textarea' : 'input', multi ? {} : { type: 'text' });
  i.value = v ?? '';
  i.oninput = () => { obj[key] = i.value; cb(); };
  return i;
}
function numInput(obj, key, min, max, step, cb = () => changed()) {
  const r = el('input', { type: 'range', min, max, step });
  const n = el('input', { type: 'number', min, max, step });
  r.value = n.value = obj[key] ?? 0;
  const set = (v) => { obj[key] = Number(v); r.value = n.value = v; cb(); };
  r.oninput = () => set(r.value);
  n.onchange = () => set(n.value);
  return el('div', { class: 'pair' }, r, n);
}
function check(obj, key, cb = () => changed()) {
  const c = el('input', { type: 'checkbox' });
  c.checked = obj[key] !== false;
  c.onchange = () => { obj[key] = c.checked; cb(); };
  return c;
}
function colorInput(obj, key) {
  const c = el('input', { type: 'color' });
  c.value = obj[key];
  const tx = el('input', { type: 'text' });
  tx.value = obj[key];
  c.oninput = () => { obj[key] = tx.value = c.value; changed(); };
  tx.onchange = () => { obj[key] = c.value = tx.value; changed(); };
  return el('div', { class: 'pair' }, tx, c);
}
function selectInput(obj, key, options, cb = () => changed()) {
  const s = el('select', {}, options.map((o) => el('option', { value: o }, o)));
  s.value = obj[key];
  s.onchange = () => { obj[key] = s.value; cb(); };
  return s;
}
function layerControls(layers) {
  return Object.entries(layers || {}).map(([id, L]) =>
    el('div', { class: 'sub' }, el('b', {}, `layer · ${id}`),
      row('visible', check(L, 'visible')),
      'scale' in L ? row('scale', numInput(L, 'scale', 0.2, 3, 0.01)) : '',
      'x' in L ? row('x', numInput(L, 'x', -800, 800, 1)) : '',
      'y' in L ? row('y', numInput(L, 'y', -600, 600, 1)) : '',
      'opacity' in L ? row('opacity', numInput(L, 'opacity', 0, 1, 0.01)) : '')
  );
}
function paramControls(params) {
  return Object.entries(params).map(([k, v]) => {
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      const ta = el('textarea', { rows: Math.max(2, v.length) });
      ta.value = v.join('\n');
      ta.oninput = () => { params[k] = ta.value.split('\n').filter((s) => s.trim()); changed(); };
      return row(`${k} (one per line)`, ta);
    }
    if (Array.isArray(v)) {
      return el('div', {}, el('b', {}, k), v.map((item, i) =>
        el('div', { class: 'sub' }, el('b', {}, `${k}[${i}]`),
          Object.keys(item).map((f) => (typeof item[f] === 'number' ? row(f, numInput(item, f, 0.2, 4, 0.05)) : f === 'font' ? row(f, selectInput(item, f, Object.keys(project.fonts))) : row(f, textInput(item, f))))
        )));
    }
    if (typeof v === 'number') return row(k, numInput(params, k, 0, Math.max(10, v * 3), v % 1 ? 0.01 : 1));
    return row(k, textInput(params, k));
  });
}

function buildPanel() {
  const P = project;
  const panel = $('#panel');
  const open = new Set([...panel.querySelectorAll('details[open]')].map((d) => d.dataset.key));
  panel.innerHTML = '';
  const section = (key, title, meta, ...body) => {
    const d = el('details', { 'data-key': key }, el('summary', {}, title, meta ? el('span', { class: 'meta' }, meta) : ''), el('div', { class: 'body' }, ...body));
    if (open.has(key)) d.open = true;
    return d;
  };
  panel.append(el('h2', {}, 'Scenes (shared timeline)'));
  P.scenes.forEach((s, i) => {
    const up = el('button', { class: 'mini', title: 'move earlier', onclick: (e) => { e.preventDefault(); if (i > 0) { [P.scenes[i - 1], P.scenes[i]] = [P.scenes[i], P.scenes[i - 1]]; changed(true); } } }, 'up');
    const dn = el('button', { class: 'mini', title: 'move later', onclick: (e) => { e.preventDefault(); if (i < P.scenes.length - 1) { [P.scenes[i + 1], P.scenes[i]] = [P.scenes[i], P.scenes[i + 1]]; changed(true); } } }, 'down');
    panel.append(section(`scene:${s.id}`, `${i + 1}. ${s.id}`, el('span', {}, `${s.duration.toFixed(1)} s `, up, dn),
      row('enabled', check(s, 'enabled', () => changed(true))),
      row('duration (s)', numInput(s, 'duration', 0.5, 10, 0.1, () => { changed(); panel.querySelector(`details[data-key="scene:${s.id}"] .meta`).firstChild.textContent = `${s.duration.toFixed(1)} s `; })),
      ...paramControls(s.params),
      ...layerControls(s.layers)));
  });

  panel.append(el('h2', {}, 'Look'));
  panel.append(section('palette', 'Palette', `${Object.keys(P.palette).length} colours`, Object.keys(P.palette).map((k) => row(k, colorInput(P.palette, k)))));
  const fontNames = Object.keys(FONT_FILES);
  panel.append(section('fonts', 'Fonts', '', Object.keys(P.fonts).map((k) => row(k, selectInput(P.fonts, k, [...new Set([P.fonts[k], ...fontNames])])))));
  panel.append(section('brand', 'Brand', P.brand.name,
    row('name', textInput(P.brand, 'name')),
    row('gradient start', selectInput(P.brand, 'gradientStart', Object.keys(P.palette))),
    row('gradient end', selectInput(P.brand, 'gradientEnd', Object.keys(P.palette))),
    row('angle', numInput(P.brand, 'gradientAngle', 0, 360, 1))));

  panel.append(el('h2', {}, 'English poster layers'));
  const E = P.poster.en;
  panel.append(section('poster:layers', 'Layer visibility / transform', `${Object.keys(E.layers).length} layers`, layerControls(E.layers), Object.keys(E.labels).map((k) => row(`label ${k}`, textInput(E.labels, k)))));
  Object.entries(E.text).forEach(([k, tx]) =>
    panel.append(section(`poster:${k}`, `Text · ${k}`, '',
      row('text', textInput(tx, 'text')),
      row('font', selectInput(tx, 'font', Object.keys(P.fonts))),
      row('color', selectInput(tx, 'color', Object.keys(P.palette))),
      'size' in tx ? row('size', numInput(tx, 'size', 6, 200, 0.5)) : '',
      'weight' in tx ? row('weight', numInput(tx, 'weight', 100, 900, 100)) : '',
      'x' in tx ? row('x', numInput(tx, 'x', 0, 685, 1)) : '',
      'y' in tx ? row('y', numInput(tx, 'y', 0, 1024, 1)) : '',
      'maxWidth' in tx ? row('max width', numInput(tx, 'maxWidth', 40, 685, 1)) : '',
      'accentColor' in tx ? row('accent colour', selectInput(tx, 'accentColor', Object.keys(P.palette))) : '')));

  panel.append(el('h2', {}, 'Sound'));
  const A = P.audio;
  panel.append(section('audio', 'Mix', `${A.bpm} bpm`,
    row('bpm', numInput(A, 'bpm', 80, 160, 1)),
    row('music gain', numInput(A, 'musicGain', 0, 1.5, 0.01)),
    row('sfx gain', numInput(A, 'sfxGain', 0, 1.5, 0.01)),
    row('duck depth', numInput(A, 'duck', 0, 1, 0.01)),
    row('reverb', numInput(A, 'reverb', 0, 1, 0.01)),
    row('peak dBFS', numInput(A, 'peakDb', -12, 0, 0.1))));

  const fileIn = el('input', { type: 'file', accept: '.json', style: 'display:none' });
  fileIn.onchange = async () => { project = JSON.parse(await fileIn.files[0].text()); changed(true); };
  panel.append(el('div', { class: 'btns' },
    el('button', { onclick: () => { const b = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }); const a = el('a', { href: URL.createObjectURL(b), download: 'project.json' }); a.click(); } }, 'Download project.json'),
    el('button', { onclick: () => fileIn.click() }, 'Load project.json'),
    el('button', { onclick: () => { project = structuredClone(original); changed(true); } }, 'Reset'),
    fileIn));
}

boot().catch((e) => { $('#status').textContent = 'Failed: ' + e.message; console.error(e); });
