# QC report — loova_20s.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 20.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 spikes (0 away from scene boundaries); max change 59.1/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 1 frames with flickering blocks | PASS |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 14/14 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -1.02 dBFS, RMS -15.8 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 9/12 clearly audible transients peak within 20 ms of their frame time (median 1 ms); 12 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 24/24 transient cues start within one frame (33 ms) of their visual event; 20 within 10 ms; max 20 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| intro.kicker | A LOOVA ORIGINAL | 0.95 s | 0.85 s | PASS |
| title.brandRow | LOOVA | 2.23 s | 0.57 s | PASS |
| title.line1 | SEEDANCE | 2.18 s | 0.65 s | PASS |
| title.line2 | 5.5 | 1.91 s | 0.53 s | PASS |
| slot.header | IMAGE MODELS ON LOOVA | 2.19 s | 0.97 s | PASS |
| slot.final | SEEDREAM 5.5 | 0.89 s | 0.75 s | PASS |
| localize.th | ภาษาไทย | 0.65 s | 0.62 s | PASS |
| localize.ja | 日本語 | 0.64 s | 0.53 s | PASS |
| localize.es | Español | 0.64 s | 0.62 s | PASS |
| localize.ko | 한국어 | 0.64 s | 0.53 s | PASS |
| localize.en | English | 1.15 s | 0.62 s | PASS |
| layers.caption | EVERY LAYER. EDITABLE. | 1.16 s | 1.00 s | PASS |
| brand.lockup | LOOVA | 1.50 s | 0.57 s | PASS |
| brand.tagline | SEEDANCE 5.5  ·  SEEDREAM 5.5 | 1.30 s | 1.18 s | PASS |

Block flicker frames (first 20): 4.833

Plot: `loova_20s_qc.png`
