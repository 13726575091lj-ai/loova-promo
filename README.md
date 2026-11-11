# LOOVA — Seedream 5.5 launch film (v4, 12 s, flag drop)

**Latest master: `LOOVA_12s_v4.mp4`** (1920×1080, 30 fps, 12.00 s). Smaller copy: `LOOVA_12s_v4_small.mp4`.
QC, stems, project snapshot and contact sheet: `dist/v4/`. v3 timeline kept as `project_12s_v3.json`.

| # | Scene (type) | Time | What happens |
|---|---|---|---|
| 1 | `open` (`open3`) | 0.00–2.00 | Runway clip with glitch / colour-fringe / light-leak FX at both cuts. LOOVA / SEEDREAM / 5.5 fly in from the lens with 3D extrusion, sit on a fan-shaped arch, breathe, and carry a flowing gradient + light band (cyan/blue and mint, no black type); fly back out through the lens |
| 2 | `slot` (`slot3`) | 2.00–3.70 | White. Curved pink reel IMAGE 2.6 / SEEDREAM 5.0 PRO / SOUL 2.0 spins and locks on SEEDREAM 5.5; drifting hot-pink glow + glint; exits on pink halftone |
| 3 | `drag` | 3.70–4.65 | Cursor drags the blue-haired model to centre; a clean (no-text) poster grows around her and stays centred |
| 4 | `flags` (`flagdrop`) | 4.65–9.35 | Flags tossed into the poster TH → JP → ES → KR → US. Each hit: dot splash in the flag colours, close-up punch, halftone wave turns the poster into that language. No canvas text |
| 5 | `layers` (`layers3`) | 9.35–10.95 | English poster splits into 6 layers, three camera angles |
| 6 | `brand` | 10.95–12.00 | Poster → LOOVA icon + wordmark with a flowing teal/mint gradient |

Scenes 3–6 share one white flowing-light background (`drawFlowBg`, driven by global time).
v4 QC: 0 unplanned motion spikes, 0 global flicker, 0 text overflow / clipping, 10/10 holds readable,
0 clipped samples, A/V offset 0 ms, 19/19 SFX cues within one frame. Block flicker: 8 frames (CHECK),
all inside the title fly-in/out, the reel blur and the flag trails.

---

# LOOVA — Seedream 5.5 launch film (v3, 12 s, all white)

**Latest master: `LOOVA_12s_v3.mp4`** (1920×1080, 30 fps, 12.00 s, H.264 + AAC, 8-sample motion blur).
Smaller copy: `LOOVA_12s_v3_small.mp4`. QC, stems, project snapshot and contact sheet: `dist/v3/`.
v1 / v2 files are unchanged; the v2 timeline is kept as `project_10s_v2.json`.
Reference studied: `参考222323.mp4` (per-letter 3D fly-in / fly-out title, curved pink reel).

| # | Scene (type) | Time | What happens | Hand-off |
|---|---|---|---|---|
| 1 | `open` (`open3`) | 0.00–2.20 | Runway clip from 0 s. Glitch slices + colour fringe + light-leak sweep at both footage cuts (blonde→red, red→blue). Footage washes to white; LOOVA / **SEEDREAM** / **5.5** letters fly in from the lens with 3D extrusion trails, ring + speed-line burst on landing, breathing scale wave while held, 5.5 in a flowing mint gradient | Every letter flies back out through the lens; frame goes white |
| 2 | `slot` (`slot3`) | 2.20–3.95 | White. Pink curved cylinder reel IMAGE 2.6 / SEEDREAM 5.0 PRO / SOUL 2.0 spins fast and locks on **SEEDREAM 5.5**; wobble + breathing; pointers turn into dots and fly out | Pink polka dots grow from the word |
| 3 | `drag` | 3.95–5.10 | Dots shrink back; cursor drags the blue-haired model to centre (selection box, snap guides); the poster grows around her | Card glides to the localize slot |
| 4 | `localize` | 5.10–9.30 | White. Flags + language on the left, TH → JP → ES → KR → **US English** | English card to centre |
| 5 | `layers` (`layers3`) | 9.30–10.95 | English poster splits into 6 layers; camera visits three angles (left ¾, right ¾, high) | Closes flat |
| 6 | `brand` | 10.95–12.00 | Poster → LOOVA icon, wordmark with flowing mint band, breathing; white | — |

v3 QC (`dist/v3/qc.md`): 0 unplanned motion spikes, 0 global flicker, 0 text overflow / clipping,
10/10 text holds readable, peak −0.9 dBFS, 0 clipped samples, A/V offset 0 ms, SFX cues within one frame.
"Block flicker" reports 10 frames (CHECK): all inside the designed fly-through, the reel spin blur and
the card swings, where the motion blur samples stack; no strobing particles.

---

# LOOVA — Seedream 5.5 launch film (v2, 10 s, runway open)

**Latest master: `LOOVA_10s_v2.mp4`** (1920×1080, 30 fps, 10.00 s, H.264 + AAC, 8-sample motion blur).
Smaller copy: `LOOVA_10s_v2_small.mp4`. QC, stems, render log and contact sheet: `dist/v2/`.
The earlier cut (v1, `LOOVA_10s.mp4`) is kept unchanged for comparison.

## v2 structure (`project.json`)

| # | Scene | Time | What happens | Hand-off |
|---|---|---|---|---|
| 1 | `open` | 0.00–2.00 | Supplied runway clip (`2323232.mp4`, from 0.8 s: red-hair → blue-hair look). Camera pushes in; exposure drops under the type (no plate). Kinetic title after the 4 s "Content Factory" card: row 1 LOOVA icon + wordmark, row 2 **SEEDREAM** letters cascade down with motion trails and a landing squash, row 3 **5.5** rises from below in a flowing mint→cyan gradient, chrome shine sweep | Pink polka dots grow out of "5.5" until they cover the frame |
| 2 | `slot` | 2.00–3.75 | Same dot grid shrinks back to soft pink polka dots on white; pink kinetic reel IMAGE 2.6 / SEEDREAM 5.0 PRO spins and locks on **SEEDREAM 5.5** + NEW badge | Lock frame grows into the first poster card; a white wipe clears the dots |
| 3 | `localize` | 3.75–8.15 | White field, blue poster card fan. Left: flag + country, the language in its own script; market list shows only flags until each market is reached, the active one opens to its language. TH → JP → ES → KR → **US English** | English card glides to centre |
| 4 | `layers` | 8.15–8.95 | English poster explodes into 6 depth layers with wireframes and labels, camera orbit | Recombines flat |
| 5 | `brand` | 8.95–10.00 | Poster shrinks into the LOOVA icon, particle burst, wordmark wipe; ends on the logo | — |

Built following the `higgsfield-motion` skills in this repo: footage as an image sequence, no
opacity-only transitions (halftone growth, shape morph, wipe), entries with move + scale + blur,
sub-frame motion blur, synthesized score with cues from the same keyframes, QA on the encoded file.

Flags are drawn in code (`src/flags.js`). Footage frames: `assets/footage/runway/` (source in
`assets/footage/runway_source.mp4`); `clipIn`, `playbackRate`, `darken` are editable in the `open` scene.

v2 QC (`dist/v2/loova_10s_qc.md`): 0 unplanned motion spikes, 0 global flicker, 0 text overflow /
clipping, 10/10 text holds readable, 0 clipped samples, A/V mux offset 0 ms, 21/21 SFX cues within one frame.

---

# LOOVA — Seedance 5.5 / Seedream 5.5 launch film

Code-built motion graphics film, 1920×1080, 16:9, 30 fps, with a procedural soundtrack.
Every scene, layer, text, colour, font, duration and sound cue is driven from `project.json`
through one shared timeline.

## Deliverables (`dist/`)

| File | What it is |
|---|---|
| `loova_10s.mp4` | **Final master**, 10.0 s, 1920×1080, 30 fps, H.264 High (CRF 16) + AAC 256 kb/s 48 kHz, 7-sample motion blur |
| `loova_10s_stems/` | `mix.wav`, `music.wav`, `sfx.wav` (48 kHz / 16-bit stereo) |
| `loova_10s_qc.md / .json / .png` | QC report of the exported file, raw metrics, motion + audio plot |
| `loova_10s_render-log.json` | Resolved timeline, every audio/visual cue, text holds, per-frame layout checks |
| `layers/` | English poster split into 6 layers at 2× (1370×2048 PNG) + flattened composite |
| `review/loova_10s_sheet.jpg` | Contact sheet, 3 frames per second |
| `loova_20s.*` | Earlier 20 s long version (from `project_20s.json`), kept for reference |

Standalone source assets live in `assets/`: localized posters, poster layer plates
(`assets/layers`), the LOOVA icon/wordmark as PNG and as traced vector outlines
(`assets/logo/logo_paths.json`), and the OFL fonts used.

`project.json` is the 10 s master. `project_20s.json` is the long version with the same scenes.

## Film structure (10 s master)

| # | Scene | Time | What happens | Hand-off |
|---|---|---|---|---|
| 1 | `intro` | 0.0–0.4 | Particle sphere over a moving dot floor collapses into a point of light | White-out → shockwave ring |
| 2 | `title` | 0.4–1.7 | Row 1 LOOVA icon + wordmark, row 2 chrome **SEEDANCE**, row 3 brand-gradient **5.5**, slamming in over a rotating 3D fan | Fan opens and floods the frame pink |
| 3 | `slot` | 1.7–3.2 | Pink reel: IMAGE 2.6 / SEEDREAM 5.0 PRO spin and lock on **SEEDREAM 5.5** + NEW badge | Lock frame grows into the first poster card, circular wipe to navy |
| 4 | `localize` | 3.2–7.8 | Blue poster card fan; left panel: TH ภาษาไทย → JP 日本語 → ES Español → KR 한국어 → **US English** | English card glides to centre |
| 5 | `layers` | 7.8–8.8 | English poster explodes into 6 labelled depth layers with wireframes, camera orbit | Layers recombine flat |
| 6 | `brand` | 8.8–10.0 | Poster shrinks into the LOOVA icon, particle burst, wordmark wipe | Ends on the logo |

Each market's hold is computed from its text length (`holdMode: "auto"` in the localize scene),
so every language stays on screen long enough to read even at this pace.

## Run it

Requirements: Node 18+, `npm install` (Playwright), `npx playwright install chromium`, ffmpeg on PATH
(or `FFMPEG=/path/to/ffmpeg`), Python 3 with `numpy pillow` for QC (plus `opencv-python-headless rembg`
only if you regenerate the poster layer plates).

```bash
npm run preview                         # editor at http://127.0.0.1:5173/index.html
node tools/render.mjs project.json --out dist/loova_10s --mb 7 --shutter 0.6   # 10 s master (≈7 min)
node tools/render.mjs project_20s.json --out dist/loova_20s                     # long version
python tools/qc.py dist/loova_10s       # QC report of an export
node tools/stills.mjs --times 2.5,9,15  # review stills
node tools/export-layers.mjs --out dist/layers
python tools/prepare_assets.py          # rebuild posters/layers/logo from assets/source
```

## Editor and controls (`index.html`)

Live canvas preview with play/scrub, the scene strip (proportional to duration, cue ticks in yellow),
soundtrack preview (rendered in a Web Worker with the same code as the export), and a control panel
generated from `project.json`:

* **Scenes**: enable/disable, duration, reorder (up/down), every text parameter, model list for the reel,
  market list (code, country, language, font, hold weight), and per-layer `visible / scale / x / y / opacity`.
* **Palette**: every named colour (brand mint `#00F5A0`, cyan, pink, blue …).
* **Fonts**: role → family (display, ui, serif, posterSans, th, ja, ko).
* **Brand**: name, gradient start/end colour, angle.
* **English poster**: layer visibility/transform, layer labels, and each text element
  (text, font, colour, size, weight, position, max width, masthead accent colour).
* **Sound**: bpm, music/SFX gain, sidechain duck depth, reverb, peak level.
* Download / load / reset `project.json`. The status line lists any text overflow, safe-area clipping or
  too-short text hold for the current edit.

Text containers size themselves from measured text: the slot lock frame and NEW badge, market code badges,
layer labels, caption pill and tagline pill. Text that would overflow its box shrinks to fit and is reported.

## Shared timeline

`src/timeline.js` resolves scene start/end times from the ordered scene list, so changing one duration
shifts every later scene. Each scene module (`src/scenes/*.js`) exports:

* `draw(ctx, S)`: renders the frame at local time `S.t`
* `cues(scene, project, dur)`: music sections and SFX cues **derived from the same keyframes the visuals use**
  (for example, one tick per reel row crossing the centre line, a whoosh per card swing, an impact per slam)
* `holds(...)`: when each text element is fully readable, used by QC and by the editor warnings

`src/audio.js` turns the resolved cues into the soundtrack: A-minor progression at 120 bpm, kick/clap/hats,
bass, pads and plucks per section (intro, drop, spin, groove with one chord per market, breakdown, finale),
synthesized SFX (impact, whoosh, sweep, riser, tick, lock, ding, pop, shimmer, glass, sub drop), reverb,
sidechain ducking under impacts, soft limiting and normalisation to −1 dBFS. Keyframes inside a scene
compress when the scene gets shorter than its reference length, so hand-offs still line up.

## QC results (10 s master)

| Check | Result |
|---|---|
| Format | 1920×1080, 30 fps, 10.00 s, AAC — PASS |
| Abrupt motion | 0 unplanned spikes (fast frames only inside cued whip transitions and cuts) — PASS |
| Flicker | 0 global, 1 block frame (the one-off shockwave ring at 0.57 s) — PASS |
| Text overflow / safe-area clipping | 0 / 0 — PASS |
| Text holds ≥ 0.45 s + 25 ms per character | 10 / 10 — PASS |
| Audio | peak −1.0 dBFS, RMS −14.4 dBFS, 0 clipped samples — PASS |
| A/V sync | mux offset 0.0 ms; 19 / 19 SFX cues within one frame of their visual event — PASS |

To fit 10 s, the slot header, the layer caption and the end tagline are hidden (layer toggles in
`project.json`); turn them back on in the editor if you lengthen those scenes.

## Notes and assumptions

* Row 2 reads **SEEDANCE** (the brief wrote "seedace"); it is one text field in the title scene.
* The brief gives the gradient start `#00F5A0`; the end colour `#00D9F5` was sampled from the supplied icon.
* The X post's video could not be played from this environment (the page loads, but the video needs a
  logged-in session). The title card follows the supplied 4 s screenshot; the pink 9 s effect is an
  original take (3D slot reel with outlined echo rows).
* English poster layers: the subject was cut out with rembg (u2net_human_seg + hair colour key),
  the printed type was removed by inpainting, and all English type is re-set live in Libre Bodoni + Jost
  so it is editable. The other four posters are used as supplied.
* Fonts: Archivo Black, Montserrat, Libre Bodoni, Bodoni Moda, Jost, Anton, Unbounded, Noto Sans Thai/JP/KR,
  all SIL Open Font License (Google Fonts).
