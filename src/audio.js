// Procedural soundtrack driven by the shared timeline.
// Music sections and sound effects are generated from the cue list each scene emits,
// so changing a scene duration moves every musical and SFX cue with it.
// Pure JS (no DOM): runs in Node for export and in the browser for preview.
import { resolveTimeline, collectCues } from './timeline.js';
import { rng, clamp } from './util.js';

const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A-minor palette. Chord index is used by the localize scene (one chord per market).
const CHORDS = [
  { root: 45, tones: [57, 60, 64, 67] }, // Am7
  { root: 41, tones: [57, 60, 65, 69] }, // Fmaj7
  { root: 48, tones: [55, 60, 64, 67] }, // C
  { root: 43, tones: [55, 59, 62, 67] }, // G
  { root: 45, tones: [57, 60, 64, 71] }, // Am(add9)
];

class Bus {
  constructor(n) {
    this.L = new Float32Array(n);
    this.R = new Float32Array(n);
    this.n = n;
  }
  add(i, v, pan = 0) {
    if (i < 0 || i >= this.n) return;
    const a = (clamp(pan, -1, 1) + 1) * (Math.PI / 4);
    this.L[i] += v * Math.cos(a);
    this.R[i] += v * Math.sin(a);
  }
}

// RBJ biquad, coefficients refreshed by caller
class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set('lp', 1000, 0.7, 48000); }
  set(type, f, q, sr) {
    const w = (TAU * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function reverb(L, R, sr, mix) {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round((d * sr) / 44100));
  const aps = [225, 556].map((d) => Math.round((d * sr) / 44100));
  const proc = (inp, spread) => {
    const out = new Float32Array(inp.length);
    const cb = combs.map((d) => ({ b: new Float32Array(d + spread), i: 0, f: 0 }));
    const ab = aps.map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < inp.length; n++) {
      let s = 0;
      for (const c of cb) {
        const y = c.b[c.i];
        c.f = y * 0.75 + c.f * 0.25;
        c.b[c.i] = inp[n] * 0.12 + c.f * 0.84;
        c.i = (c.i + 1) % c.b.length;
        s += y;
      }
      for (const a of ab) {
        const y = a.b[a.i];
        a.b[a.i] = s + y * 0.5;
        s = y - s * 0.5;
        a.i = (a.i + 1) % a.b.length;
      }
      out[n] = s;
    }
    return out;
  };
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const wl = proc(mono, 0), wr = proc(mono, 23);
  for (let i = 0; i < L.length; i++) { L[i] += wl[i] * mix; R[i] += wr[i] * mix; }
}

// ------------------------------------------------------------------ instruments
function voice(bus, sr, t0, dur, fn, pan = 0, endFade = 0.01) {
  const i0 = Math.max(0, Math.round(t0 * sr)), n = Math.round(dur * sr);
  const fadeN = Math.max(1, Math.round(endFade * sr));
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    if (i >= bus.n) break;
    const g = k > n - fadeN ? (n - k) / fadeN : 1;
    bus.add(i, fn(k / sr, k) * g, typeof pan === 'function' ? pan(k / sr) : pan);
  }
}

function makeNoise(seed) {
  const r = rng(seed);
  return () => r() * 2 - 1;
}

const inst = {
  kick(bus, sr, t, g = 1) {
    let ph = 0;
    voice(bus, sr, t, 0.45, (x) => {
      const f = 45 + 110 * Math.exp(-x * 28);
      ph += (TAU * f) / sr;
      return Math.sin(ph) * Math.exp(-x * 7) * g * 0.9 + (x < 0.004 ? (1 - x / 0.004) * 0.25 * g : 0);
    });
  },
  clap(bus, sr, t, g = 1, seed = 1) {
    const nz = makeNoise(seed), bp = new Biquad();
    bp.set('bp', 1500, 0.9, sr);
    voice(bus, sr, t, 0.28, (x) => {
      const env = (x < 0.03 ? 0.6 + 0.4 * Math.abs(Math.sin(x * 330)) : 1) * Math.exp(-x * 16);
      return bp.run(nz()) * env * g * 1.6;
    }, 0.05);
  },
  snare(bus, sr, t, g = 1, seed = 1) {
    const nz = makeNoise(seed), hp = new Biquad();
    hp.set('hp', 1800, 0.7, sr);
    let ph = 0;
    voice(bus, sr, t, 0.18, (x) => {
      ph += (TAU * 190) / sr;
      return (hp.run(nz()) * 0.7 + Math.sin(ph) * 0.4) * Math.exp(-x * 22) * g;
    });
  },
  hat(bus, sr, t, g = 1, open = false, seed = 1, pan = 0.25) {
    const nz = makeNoise(seed), hp = new Biquad();
    hp.set('hp', 7500, 0.7, sr);
    voice(bus, sr, t, open ? 0.22 : 0.06, (x) => hp.run(nz()) * Math.exp(-x * (open ? 14 : 60)) * g * 0.55, pan);
  },
  bass(bus, sr, t, dur, midi, g = 1) {
    const f = mtof(midi), lp = new Biquad();
    let ph = 0;
    voice(bus, sr, t, dur, (x, k) => {
      if ((k & 31) === 0) lp.set('lp', 180 + 900 * Math.exp(-x * 9), 0.9, sr);
      ph = (ph + f / sr) % 1;
      const saw = ph * 2 - 1;
      const env = Math.min(1, x / 0.004) * (0.6 + 0.4 * Math.exp(-x * 5));
      return (lp.run(saw) * 0.8 + Math.sin(ph * TAU) * 0.5) * env * g * 0.5;
    }, 0, 0.02);
  },
  pad(bus, sr, t, dur, notes, g = 1, attack = 0.4) {
    const lp = new Biquad();
    lp.set('lp', 1700, 0.6, sr);
    const ph = notes.flatMap(() => [0, 0, 0]);
    const det = [-0.12, 0, 0.11];
    voice(bus, sr, t, dur, (x) => {
      let s = 0, j = 0;
      for (const m of notes) for (const d of det) {
        ph[j] = (ph[j] + mtof(m + d) / sr) % 1;
        s += ph[j] * 2 - 1;
        j++;
      }
      const env = Math.min(1, x / attack) * Math.min(1, (dur - x) / 0.25);
      return lp.run(s / (notes.length * 3)) * env * g * 0.55;
    }, 0, 0.05);
  },
  pluck(bus, sr, t, midi, g = 1, pan = 0, decay = 9) {
    const f = mtof(midi), lp = new Biquad();
    let ph = 0;
    voice(bus, sr, t, 0.5, (x, k) => {
      if ((k & 31) === 0) lp.set('lp', 600 + 5000 * Math.exp(-x * 14), 0.8, sr);
      ph = (ph + f / sr) % 1;
      const sq = ph < 0.5 ? 1 : -1;
      return lp.run(sq * 0.6 + (ph * 2 - 1) * 0.4) * Math.exp(-x * decay) * g * 0.28;
    }, pan);
  },
};

const fx = {
  impact(bus, sr, c) {
    const g = c.gain ?? 1, size = c.size ?? 1, nz = makeNoise(7), lp = new Biquad();
    lp.set('lp', 2200, 0.7, sr);
    let ph = 0;
    voice(bus, sr, c.t, 1.6 * size, (x) => {
      const f = 38 + 70 * Math.exp(-x * 10);
      ph += (TAU * f) / sr;
      const sub = Math.sin(ph) * Math.exp(-x * (2.6 / size));
      const crack = lp.run(nz()) * Math.exp(-x * 9);
      const click = x < 0.006 ? 1 - x / 0.006 : 0;
      return (sub * 0.95 + crack * 0.55 + click * 0.4) * g;
    });
  },
  whoosh(bus, sr, c, hi = 1) {
    const len = c.len ?? 0.4, g = c.gain ?? 0.5, pan = c.pan ?? 0, nz = makeNoise(11 + Math.round(c.t * 100)), bp = new Biquad();
    voice(bus, sr, c.t, len + 0.08, (x, k) => {
      const u = clamp(x / len);
      if ((k & 15) === 0) bp.set('bp', (350 + 3200 * Math.sin(Math.PI * u)) * hi, 1.2, sr);
      return bp.run(nz()) * Math.pow(Math.sin(Math.PI * clamp(u * 1.05)), 1.5) * g * 2.2;
    }, (x) => pan * (clamp(x / len) * 2 - 1));
  },
  swish(bus, sr, c) { fx.whoosh(bus, sr, { ...c, gain: (c.gain ?? 0.4) * 0.8 }, 1.8); },
  sweep(bus, sr, c) {
    const len = c.len, g = c.gain ?? 0.6, nz = makeNoise(5), bp = new Biquad();
    let ph = 0;
    voice(bus, sr, c.t, len, (x, k) => {
      const u = x / len;
      if ((k & 15) === 0) bp.set('bp', 300 + 7000 * u * u, 0.9, sr);
      ph = (ph + (180 + 900 * u * u) / sr) % 1;
      return (bp.run(nz()) * 1.6 + (ph * 2 - 1) * 0.12) * u * g;
    }, 0, 0.012);
  },
  riser(bus, sr, c) {
    const len = c.len, g = c.gain ?? 0.5, nz = makeNoise(3), hp = new Biquad();
    let ph = 0, ph2 = 0;
    voice(bus, sr, c.t, len, (x, k) => {
      const u = x / len;
      if ((k & 15) === 0) hp.set('hp', 200 + 5000 * u * u, 0.7, sr);
      ph = (ph + (110 + 330 * u * u) / sr) % 1;
      ph2 = (ph2 + (110.7 + 331 * u * u) / sr) % 1;
      return (hp.run(nz()) * 0.7 + (ph * 2 - 1 + ph2 * 2 - 1) * 0.12) * Math.pow(u, 2) * g;
    }, 0, 0.015);
  },
  suck(bus, sr, c) {
    const len = c.len, g = c.gain ?? 0.5, nz = makeNoise(9), hp = new Biquad();
    hp.set('hp', 2500, 0.7, sr);
    voice(bus, sr, c.t, len, (x) => hp.run(nz()) * Math.pow(x / len, 3) * g * 1.4, 0, 0.01);
  },
  tick(bus, sr, c) {
    const g = c.gain ?? 0.4, nz = makeNoise(13);
    voice(bus, sr, c.t, 0.03, (x) => (Math.sin(TAU * 2100 * x) * Math.exp(-x * 260) + (x < 0.002 ? nz() * 0.6 : 0)) * g, c.pan ?? 0);
  },
  lock(bus, sr, c) {
    const g = c.gain ?? 0.8, nz = makeNoise(17), bp = new Biquad();
    bp.set('bp', 3200, 2, sr);
    voice(bus, sr, c.t, 0.25, (x) => (Math.sin(TAU * (90 + 80 * Math.exp(-x * 40)) * x) * Math.exp(-x * 18) + bp.run(nz()) * Math.exp(-x * 50) * 1.2) * g);
  },
  ding(bus, sr, c) {
    const g = c.gain ?? 0.5, f = 1318.5;
    const parts = [[1, 1, 3], [2.0, 0.4, 5], [2.76, 0.25, 7], [4.07, 0.12, 10]];
    voice(bus, sr, c.t, 1.4, (x) => parts.reduce((s, [r, a, d]) => s + Math.sin(TAU * f * r * x) * a * Math.exp(-x * d), 0) * g * 0.5, 0.15);
  },
  pop(bus, sr, c) {
    const g = c.gain ?? 0.4;
    let ph = 0;
    voice(bus, sr, c.t, 0.08, (x) => {
      ph += (TAU * (300 + 700 * Math.exp(-x * 60))) / sr;
      return Math.sin(ph) * Math.exp(-x * 45) * g;
    }, c.pan ?? 0);
  },
  shimmer(bus, sr, c) {
    const notes = [81, 84, 88, 91, 93, 96], len = c.len ?? 0.8, g = c.gain ?? 0.35;
    notes.forEach((m, i) => {
      const t = c.t + (i / notes.length) * len;
      voice(bus, sr, t, 0.9, (x) => Math.sin(TAU * mtof(m) * x) * Math.exp(-x * 4) * Math.min(1, x / 0.005) * g * 0.35, (i % 2 ? 0.5 : -0.5));
    });
  },
  sparkle(bus, sr, c) {
    const r = rng(29), g = c.gain ?? 0.3;
    for (let i = 0; i < 9; i++) {
      const t = c.t + r() * 0.6, m = 88 + Math.floor(r() * 12);
      voice(bus, sr, t, 0.4, (x) => Math.sin(TAU * mtof(m) * x) * Math.exp(-x * 9) * g * 0.3, r() * 2 - 1);
    }
  },
  glass(bus, sr, c) {
    const scale = [69, 72, 76, 79, 81, 84, 88], m = scale[(c.note ?? 0) % scale.length] + 12, g = c.gain ?? 0.3;
    voice(bus, sr, c.t, 1.0, (x) => (Math.sin(TAU * mtof(m) * x) + 0.3 * Math.sin(TAU * mtof(m) * 2.01 * x)) * Math.exp(-x * 4.5) * Math.min(1, x / 0.003) * g * 0.4, ((c.note ?? 0) % 2 ? 0.4 : -0.4));
  },
  subdrop(bus, sr, c) {
    const g = c.gain ?? 0.8;
    let ph = 0;
    voice(bus, sr, c.t, 1.1, (x) => {
      ph += (TAU * (30 + 60 * Math.exp(-x * 3.5))) / sr;
      return Math.sin(ph) * Math.min(1, x / 0.01) * Math.exp(-x * 2.2) * g;
    });
  },
};

// ------------------------------------------------------------------ music sections
function chordAt(cues, t, scene, fallback) {
  let idx = fallback ?? 0;
  for (const c of cues) if (c.type === 'chord' && c.scene === scene && c.t <= t + 1e-6) idx = c.chord;
  return CHORDS[idx % CHORDS.length];
}

function section(bus, sr, s, cues, beat) {
  const { t: t0, len, pattern } = s;
  const t1 = t0 + len;
  const beats = Math.floor(len / beat + 1e-6);
  const sixteenth = beat / 4;
  const within = (t) => t >= t0 - 1e-6 && t < t1 - 0.01;
  const ch = (t) => chordAt(cues, t, s.scene, s.chord);
  switch (pattern) {
    case 'intro': {
      inst.pad(bus, sr, t0, len, CHORDS[0].tones.map((m) => m - 12), 0.9, len * 0.6);
      for (let b = 0; b < beats; b++) if (b >= beats / 2) inst.kick(bus, sr, t0 + b * beat, 0.35 + 0.1 * (b - beats / 2));
      break;
    }
    case 'drop':
    case 'groove':
    case 'spin': {
      for (let b = 0; b <= beats; b++) {
        const t = t0 + b * beat;
        if (!within(t)) continue;
        inst.kick(bus, sr, t, 0.95);
        if (pattern !== 'spin' && b % 2 === 1) inst.clap(bus, sr, t, 0.55, b);
        inst.hat(bus, sr, t + beat / 2, 0.5, pattern === 'drop', b, 0.3);
      }
      const steps = Math.ceil(len / sixteenth);
      for (let k = 0; k < steps; k++) {
        const t = t0 + k * sixteenth;
        if (!within(t)) continue;
        const c = ch(t);
        if (pattern === 'spin') {
          inst.hat(bus, sr, t, k % 4 === 2 ? 0.45 : 0.22, false, k, -0.3);
          inst.pluck(bus, sr, t, c.tones[k % 4] + 12 + (Math.floor(k / 8) % 2) * 12, 0.75, (k % 2 ? 0.35 : -0.35), 12);
        } else if (k % 2 === 0) {
          // eighth-note bass with octave hops
          const oct = (k / 2) % 4 === 3 ? 12 : 0;
          inst.bass(bus, sr, t, Math.min(sixteenth * 1.8, t1 - t), c.root + oct, 0.85);
        }
        if (pattern === 'groove' && k % 2 === 1) inst.pluck(bus, sr, t, c.tones[(k >> 1) % 4] + 12, 0.55, (k % 4 === 1 ? -0.4 : 0.4));
        if (pattern === 'groove' && k % 4 === 3) inst.hat(bus, sr, t, 0.2, false, k + 99, -0.2);
      }
      if (pattern === 'spin') {
        // bass pulse under the reel
        for (let k = 0; k < steps; k += 2) {
          const t = t0 + k * sixteenth;
          if (within(t)) inst.bass(bus, sr, t, Math.min(sixteenth * 1.6, t1 - t), CHORDS[0].root, 0.7);
        }
      }
      // pad follows chord changes
      let segStart = t0, cur = ch(t0);
      const changes = cues.filter((c) => c.type === 'chord' && c.scene === s.scene && c.t > t0 && c.t < t1).map((c) => c.t);
      for (const ct of [...changes, t1]) {
        if (ct - segStart > 0.05) inst.pad(bus, sr, segStart, ct - segStart, cur.tones, pattern === 'drop' ? 0.55 : 0.45, 0.05);
        segStart = ct;
        cur = ch(ct + 1e-4);
      }
      break;
    }
    case 'fill': {
      const n = Math.max(2, Math.floor(len / (beat / 4)));
      for (let k = 0; k < n; k++) inst.snare(bus, sr, t0 + (k * len) / n, 0.25 + 0.6 * (k / n), k);
      inst.pad(bus, sr, t0, len, CHORDS[3].tones, 0.35, 0.02);
      break;
    }
    case 'breakdown': {
      const c = CHORDS[1];
      inst.pad(bus, sr, t0, len, c.tones, 0.75, 0.3);
      inst.bass(bus, sr, t0, len, c.root - 12, 0.6);
      for (let b = 0; b < beats * 2; b++) {
        const t = t0 + (b * beat) / 2;
        if (within(t)) inst.hat(bus, sr, t, b % 2 ? 0.28 : 0.14, false, b + 300, 0.2);
        if (within(t) && b % 3 === 0) inst.pluck(bus, sr, t, c.tones[b % 4] + 24, 0.35, b % 2 ? 0.5 : -0.5, 6);
      }
      break;
    }
    case 'pre': {
      inst.pad(bus, sr, t0, len, CHORDS[3].tones, 0.4, len * 0.8);
      const n = Math.max(2, Math.floor(len / (beat / 4)));
      for (let k = 0; k < n; k++) inst.snare(bus, sr, t0 + (k * len) / n, 0.15 + 0.5 * (k / n), k + 50);
      break;
    }
    case 'finale': {
      const c = CHORDS[4];
      inst.kick(bus, sr, t0, 1.0);
      inst.pad(bus, sr, t0, len, [...c.tones, c.tones[0] + 12], 0.85, 0.02);
      inst.bass(bus, sr, t0, len, c.root, 0.8);
      for (let b = 0; b < beats * 2; b++) {
        const t = t0 + (b * beat) / 2;
        if (within(t)) inst.pluck(bus, sr, t, c.tones[b % 4] + 12, 0.45 * (1 - b / (beats * 2)), b % 2 ? 0.4 : -0.4, 7);
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ main
export function renderAudio(project) {
  const A = project.audio;
  const sr = A.sampleRate || 48000;
  const tl = resolveTimeline(project);
  const cues = collectCues(project, tl);
  const total = tl.total;
  const n = Math.ceil(total * sr);
  const music = new Bus(n), sfx = new Bus(n);
  const beat = 60 / (A.bpm || 120);

  for (const c of cues) if (c.type === 'section') section(music, sr, { ...c, len: Math.min(c.len, total - c.t) }, cues, beat);
  for (const c of cues) if (fx[c.type]) fx[c.type](sfx, sr, c);

  reverb(music.L, music.R, sr, (A.reverb ?? 0.2) * 0.8);
  reverb(sfx.L, sfx.R, sr, (A.reverb ?? 0.2) * 1.2);

  // sidechain: duck music under impacts and locks
  const duck = new Float32Array(n).fill(1);
  for (const c of cues) {
    if (!['impact', 'lock', 'subdrop'].includes(c.type)) continue;
    const i0 = Math.round(c.t * sr), depth = (A.duck ?? 0.45) * (c.gain ?? 1);
    for (let k = 0; k < sr * 0.5 && i0 + k < n; k++) {
      const x = k / sr, g = 1 - depth * (x < 0.01 ? x / 0.01 : Math.exp(-(x - 0.01) * 7));
      duck[i0 + k] = Math.min(duck[i0 + k], g);
    }
  }
  const mg = A.musicGain ?? 0.75, sg = A.sfxGain ?? 0.9;
  for (let i = 0; i < n; i++) {
    music.L[i] *= mg * duck[i]; music.R[i] *= mg * duck[i];
    sfx.L[i] *= sg; sfx.R[i] *= sg;
  }
  const mixL = new Float32Array(n), mixR = new Float32Array(n);
  const drive = 1.25, norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    mixL[i] = Math.tanh((music.L[i] + sfx.L[i]) * drive) / norm;
    mixR[i] = Math.tanh((music.R[i] + sfx.R[i]) * drive) / norm;
  }
  // normalise to the target peak and apply edge fades
  const target = Math.pow(10, (A.peakDb ?? -1) / 20);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
  const k = target / peak;
  const fadeIn = Math.round(0.005 * sr), fadeOut = Math.round((A.tailFade ?? 0.25) * sr);
  const stems = [music.L, music.R, sfx.L, sfx.R];
  for (let i = 0; i < n; i++) {
    let g = k;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > n - fadeOut) g *= (n - i) / fadeOut;
    mixL[i] *= g; mixR[i] *= g;
    for (const s of stems) s[i] *= g;
  }
  return { sr, total, cues, mix: [mixL, mixR], music: [music.L, music.R], sfx: [sfx.L, sfx.R], gain: k };
}

/** 16-bit PCM WAV encoder */
export function encodeWav([L, R], sr) {
  const n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    o += 4;
  }
  return new Uint8Array(buf);
}
