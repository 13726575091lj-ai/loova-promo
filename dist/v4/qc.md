# QC report — LOOVA_12s_v4.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 12.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 unplanned spikes; 6 fast frames inside designed cuts / cued whip transitions; max change 92.1/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 8 frames with flickering blocks | CHECK |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 10/10 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -0.65 dBFS, RMS -14.4 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 11/14 clearly audible transients peak within 20 ms of their frame time (median 0 ms); 5 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 19/19 transient cues start within one frame (33 ms) of their visual event; 16 within 10 ms; max 16 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| open.brandRow | LOOVA | 0.89 s | 0.57 s | PASS |
| open.line1 | SEEDREAM | 0.85 s | 0.65 s | PASS |
| open.line2 | 5.5 | 0.76 s | 0.53 s | PASS |
| slot.final | SEEDREAM 5.5 | 0.80 s | 0.75 s | PASS |
| flags.th | ภาษาไทย | 0.64 s | 0.62 s | PASS |
| flags.ja | 日本語 | 0.54 s | 0.53 s | PASS |
| flags.es | Español | 0.64 s | 0.62 s | PASS |
| flags.ko | 한국어 | 0.54 s | 0.53 s | PASS |
| flags.en | English | 0.68 s | 0.62 s | PASS |
| brand.lockup | LOOVA | 0.59 s | 0.57 s | PASS |

## Motion spikes

| t (s) | scene | change | local | at boundary | cued whip |
|---|---|---|---|---|---|
| 2.0 | slot | 92.12 | 16.34 | True | True |
| 3.5 | slot | 25.94 | 0.49 | False | True |
| 3.533 | slot | 38.74 | 0.49 | False | True |
| 3.567 | slot | 32.82 | 0.49 | False | True |
| 3.833 | drag | 44.14 | 10.74 | False | True |
| 3.867 | drag | 47.45 | 10.74 | False | True |

Block flicker frames (first 20): 0.667, 1.567, 1.867, 1.9, 1.933, 2.233, 8.367, 8.433

Plot: `LOOVA_12s_v4_qc.png`
