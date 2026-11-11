# QC report — loova_10s.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 10.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 unplanned spikes; 12 fast frames inside designed cuts / cued whip transitions; max change 32.4/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 1 frames with flickering blocks | PASS |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 10/10 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -0.74 dBFS, RMS -14.5 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 5/9 clearly audible transients peak within 20 ms of their frame time (median 2 ms); 12 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 21/21 transient cues start within one frame (33 ms) of their visual event; 19 within 10 ms; max 16 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| open.brandRow | LOOVA | 0.98 s | 0.57 s | PASS |
| open.line1 | SEEDREAM | 0.78 s | 0.65 s | PASS |
| open.line2 | 5.5 | 0.70 s | 0.53 s | PASS |
| slot.final | SEEDREAM 5.5 | 0.77 s | 0.75 s | PASS |
| localize.th | ภาษาไทย | 0.63 s | 0.62 s | PASS |
| localize.ja | 日本語 | 0.53 s | 0.53 s | PASS |
| localize.es | Español | 0.63 s | 0.62 s | PASS |
| localize.ko | 한국어 | 0.53 s | 0.53 s | PASS |
| localize.en | English | 0.64 s | 0.62 s | PASS |
| brand.lockup | LOOVA | 0.59 s | 0.57 s | PASS |

## Motion spikes

| t (s) | scene | change | local | at boundary | cued whip |
|---|---|---|---|---|---|
| 1.867 | open | 24.84 | 1.31 | False | True |
| 1.9 | open | 22.7 | 1.86 | False | True |
| 4.733 | localize | 22.48 | 0.25 | False | True |
| 4.767 | localize | 22.33 | 0.25 | False | True |
| 5.467 | localize | 22.64 | 0.35 | False | True |
| 5.5 | localize | 23.42 | 0.35 | False | True |
| 6.3 | localize | 22.86 | 0.59 | False | True |
| 6.333 | localize | 23.53 | 0.59 | False | True |
| 6.367 | localize | 18.43 | 0.6 | False | True |
| 7.033 | localize | 21.64 | 1.0 | False | True |
| 7.067 | localize | 23.07 | 1.0 | False | True |
| 7.1 | localize | 18.27 | 1.0 | False | True |

Block flicker frames (first 20): 4.733

Plot: `loova_10s_qc.png`
