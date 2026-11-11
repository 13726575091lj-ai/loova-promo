# QC report — B2_portfolio_20s.mp4

| Check | Result | Status |
|---|---|---|
| Format | 1920×1080, 30 fps, 20.00 s, audio: aac (LC) (mp4a / 0x6134706D) | PASS |
| Abrupt motion | 0 unplanned spikes; 16 fast frames inside designed cuts / cued whip transitions; max change 45.3/255 | PASS |
| Global flicker (A-B-A) | 0 frames | PASS |
| Particle / block flicker | 1 frames with flickering blocks | PASS |
| Text overflow | 0 frame reports | PASS |
| Safe-area clipping | 0 frame reports | PASS |
| Text hold time | 14/14 holds meet 0.45 s + 25 ms/char | PASS |
| Audio level | peak -0.93 dBFS, RMS -15.3 dBFS, 0 clipped samples | PASS |
| Cue onsets in final mix (info) | 15/17 clearly audible transients peak within 20 ms of their frame time (median 2 ms); 16 quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |
| Mux A/V offset | encoded audio vs rendered mix: +0.0 ms | PASS |
| Cue placement (SFX stem) | 33/33 transient cues start within one frame (33 ms) of their visual event; 30 within 10 ms; max 20 ms | PASS |

## Text holds

| Element | Text | Visible hold | Required | |
|---|---|---|---|---|
| intro.sub | FILMS & MOVING IMAGES | 1.03 s | 0.97 s | PASS |
| statement.l1 | A LITTLE STRANGE. | 1.35 s | 0.88 s | PASS |
| statement.l2 | A LOT OF IMAGINATION. | 1.15 s | 0.97 s | PASS |
| statement.hand | Welcome to my world. | 0.95 s | 0.95 s | PASS |
| work.candy-mutiny | CANDY MUTINY | 1.55 s | 0.75 s | PASS |
| work.candy-mutiny.meta | 01 / 04 — ANIMATION MUSIC VIDEO | 1.72 s | 1.23 s | PASS |
| work.ashbound | ASHBOUND | 1.55 s | 0.65 s | PASS |
| work.ashbound.meta | 02 / 04 — ANIMATION | 1.89 s | 0.93 s | PASS |
| work.my-block | MY BLOCK | 1.55 s | 0.65 s | PASS |
| work.my-block.meta | 03 / 04 — ANIMATION | 1.89 s | 0.93 s | PASS |
| work.moms-home | MOM’S HOME | 1.55 s | 0.70 s | PASS |
| work.moms-home.meta | 04 / 04 — LIVE ACTION | 1.86 s | 0.97 s | PASS |
| grid.heading | SELECTED WORLDS. | 1.05 s | 0.85 s | PASS |
| end.stay | STAY curious. | 0.85 s | 0.78 s | PASS |

## Motion spikes

| t (s) | scene | change | local | at boundary | cued whip |
|---|---|---|---|---|---|
| 2.0 | intro | 30.43 | 7.58 | False | True |
| 4.867 | statement | 33.75 | 8.13 | False | True |
| 4.9 | statement | 33.8 | 8.13 | False | True |
| 7.667 | work1 | 32.61 | 1.46 | False | True |
| 7.7 | work1 | 30.06 | 1.6 | False | True |
| 7.933 | work2 | 23.44 | 1.94 | False | True |
| 7.967 | work2 | 25.17 | 1.76 | False | True |
| 10.467 | work2 | 22.35 | 1.32 | False | True |
| 10.5 | work2 | 24.37 | 1.38 | False | True |
| 10.733 | work3 | 26.93 | 1.84 | False | True |
| 10.767 | work3 | 24.61 | 1.84 | False | True |
| 13.267 | work3 | 23.25 | 1.23 | False | True |
| 13.3 | work3 | 24.86 | 1.35 | False | True |
| 13.533 | work4 | 39.85 | 2.05 | False | True |
| 13.567 | work4 | 39.12 | 2.05 | False | True |
| 17.933 | grid | 29.1 | 6.67 | False | True |

Block flicker frames (first 20): 16.5

Plot: `B2_portfolio_20s_qc.png`
