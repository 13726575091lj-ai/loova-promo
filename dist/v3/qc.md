# QC report — LOOVA_12s_v3.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 12.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 unplanned spikes; 16 fast frames inside designed cuts / cued whip transitions; max change 118.7/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 10 frames with flickering blocks | CHECK |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 10/10 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -0.91 dBFS, RMS -15.0 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 7/11 clearly audible transients peak within 20 ms of their frame time (median 12 ms); 11 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 22/22 transient cues start within one frame (33 ms) of their visual event; 14 within 10 ms; max 20 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| open.brandRow | LOOVA | 0.97 s | 0.57 s | PASS |
| open.line1 | SEEDREAM | 0.94 s | 0.65 s | PASS |
| open.line2 | 5.5 | 0.83 s | 0.53 s | PASS |
| slot.final | SEEDREAM 5.5 | 0.83 s | 0.75 s | PASS |
| localize.th | ภาษาไทย | 0.63 s | 0.62 s | PASS |
| localize.ja | 日本語 | 0.53 s | 0.53 s | PASS |
| localize.es | Español | 0.63 s | 0.62 s | PASS |
| localize.ko | 한국어 | 0.53 s | 0.53 s | PASS |
| localize.en | English | 0.64 s | 0.62 s | PASS |
| brand.lockup | LOOVA | 0.59 s | 0.57 s | PASS |

## Motion spikes

| t (s) | scene | change | local | at boundary | cued whip |
|---|---|---|---|---|---|
| 2.2 | slot | 118.66 | 22.96 | True | True |
| 3.767 | slot | 33.41 | 0.91 | False | True |
| 3.8 | slot | 38.89 | 0.91 | False | True |
| 3.833 | slot | 21.05 | 0.91 | False | True |
| 4.967 | drag | 18.62 | 4.12 | False | True |
| 6.033 | localize | 23.57 | 0.23 | False | True |
| 6.067 | localize | 23.99 | 0.23 | False | True |
| 6.733 | localize | 22.99 | 0.24 | False | True |
| 6.767 | localize | 23.98 | 0.24 | False | True |
| 6.8 | localize | 19.69 | 0.24 | False | True |
| 7.533 | localize | 21.37 | 0.22 | False | True |
| 7.567 | localize | 23.7 | 0.23 | False | True |
| 7.6 | localize | 21.4 | 0.22 | False | True |
| 8.233 | localize | 18.22 | 0.25 | False | True |
| 8.267 | localize | 23.46 | 0.25 | False | True |
| 8.3 | localize | 22.66 | 0.25 | False | True |

Block flicker frames (first 20): 0.667, 1.567, 2.0, 2.067, 2.1, 2.433, 2.467, 2.5, 4.867, 9.133

Plot: `LOOVA_12s_v3_qc.png`
