# QC report — loova_10s.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 10.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 unplanned spikes; 16 fast frames inside designed cuts / cued whip transitions; max change 68.7/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 1 frames with flickering blocks | PASS |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 10/10 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -1.03 dBFS, RMS -14.4 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 5/7 clearly audible transients peak within 20 ms of their frame time (median 4 ms); 12 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 19/19 transient cues start within one frame (33 ms) of their visual event; 14 within 10 ms; max 18 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| title.brandRow | LOOVA | 0.67 s | 0.57 s | PASS |
| title.line1 | SEEDANCE | 0.77 s | 0.65 s | PASS |
| title.line2 | 5.5 | 0.65 s | 0.53 s | PASS |
| slot.final | SEEDREAM 5.5 | 0.76 s | 0.75 s | PASS |
| localize.th | ภาษาไทย | 0.63 s | 0.62 s | PASS |
| localize.ja | 日本語 | 0.53 s | 0.53 s | PASS |
| localize.es | Español | 0.63 s | 0.62 s | PASS |
| localize.ko | 한국어 | 0.53 s | 0.53 s | PASS |
| localize.en | English | 0.66 s | 0.62 s | PASS |
| brand.lockup | LOOVA | 0.67 s | 0.57 s | PASS |

## Motion spikes

| t (s) | scene | change | local | at boundary | cued whip |
|---|---|---|---|---|---|
| 3.0 | slot | 68.67 | 7.22 | False | True |
| 4.233 | localize | 22.5 | 1.5 | False | True |
| 4.267 | localize | 25.35 | 1.5 | False | True |
| 4.3 | localize | 23.87 | 1.5 | False | True |
| 5.0 | localize | 21.66 | 1.32 | False | True |
| 5.033 | localize | 25.06 | 1.32 | False | True |
| 5.067 | localize | 24.35 | 1.32 | False | True |
| 5.1 | localize | 19.06 | 1.32 | False | True |
| 5.867 | localize | 21.46 | 1.34 | False | True |
| 5.9 | localize | 25.39 | 1.34 | False | True |
| 5.933 | localize | 24.86 | 1.34 | False | True |
| 5.967 | localize | 19.92 | 1.34 | False | True |
| 6.633 | localize | 20.2 | 1.58 | False | True |
| 6.667 | localize | 24.59 | 1.58 | False | True |
| 6.7 | localize | 24.89 | 1.58 | False | True |
| 6.733 | localize | 19.92 | 1.58 | False | True |

Block flicker frames (first 20): 0.567

Plot: `loova_10s_qc.png`
