"""Soundtrack for the B2 heart ident (10 s). Uses mgaudio from mg-styles-15 (MIT).
All hits come from out/events.json written by blender/scene.py, so sound and picture share one clock.
python audio.py -> out/audio.wav"""
import sys, json, os
import numpy as np
sys.path.insert(0, '/projects/sandbox/mg-styles-15/lib/audio')
import mgaudio as mg
from mgaudio import sfx, drums, synth, seq, fm, samples
from mgaudio.recipes import Form, comp_events
from mgaudio.recipes.base import LV, new_mix, place_segments

HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(f'{HERE}/out/events.json'))
FR = 1.0 / E['fps']
HIT, HOLD = E['tear_hit'], E['hold']
rng = np.random.default_rng(5)

f = Form(duration=10.0, bpm=96, drop=HIT, build=E['tear_born'], outro=HOLD, key='D', mode='major',
         prog='Imaj9 vi9 IVmaj9 V6/9', final='Imaj9', chord_beats=4, octave=4)
m = new_mix(f, music_level=-21.0, sfx_duck=3.0, master=dict(air=1.2, warmth=1.5))
g = m.grid
B, Dp, O, END = f.build, f.drop, f.outro, f.end

# --- music: warm air pad + glass, music-box kalimba; a sub enters with the tear
pad = m.track('pad', level=LV['pad'] - 1.0, sends={'big': -6}, hp=200)
place_segments(pad, f, 0.0, END, lambda v, d: synth.pad(v, d, 0.7, 'air', attack=min(0.7, d * 0.3), release=1.8))
pad.automate('lpf', [(0, 1600), (B, 2600), (Dp, 9000), (END, 9000)])
glass = m.track('glass', level=LV['pad'] - 5, sends={'shimmer': -8}, hp=300)
place_segments(glass, f, 0.0, END, lambda v, d: synth.pad([n + 12 for n in v[-3:]], d, 0.5, 'glass', attack=0.5, release=2.0))
glass.automate('gain', [(0, -9), (B, -4), (Dp, 0), (END, 0)])

kal = samples.inst('kalimba') if samples.available('kalimba') else None
kt = m.track('kalimba', level=LV['bells'] + 1.0, sends={'delay': -9, 'plate': -11})
play = lambda n, d, v: kal.play(n, None, v) if kal else fm.mallet(n, 0.6, v, 'kalimba')
for t, n, d, v in seq.arp(g, lambda t: f.chord_at(t, 12), 0.9, B, div=8, pattern='updown', octaves=1, gate=1.0, vel=0.45, accents='x...'):
    kt.add(play(n, d, v), t, pan=float(np.sin(t * 2.1)) * 0.4)
for t, n, d, v in seq.arp(g, lambda t: f.chord_at(t, 12), Dp + 0.35, O, div=8, pattern='up', octaves=2, gate=1.0, vel=0.42, accents='x..x....'):
    kt.add(play(n, d, v), t, pan=float(np.sin(t * 2.7)) * 0.5)

mar = samples.inst('marimba') if samples.available('marimba') else None
mk = m.track('marimba', level=LV['keys'] - 5, sends={'plate': -10}, hp=150)
for t, v, d, vel in comp_events(f, g, 1.0, O, 'x.......x.......', vel=0.45, gate=1.0):
    for k, n in enumerate(v[-3:]):
        mk.add(mar.play(n, None, vel * (0.8 + 0.1 * k)) if mar else fm.mallet(n, 0.8, vel, 'marimba'), t + 0.006 * k)

sub = m.track('sub', level=LV['sub'] - 3)
for a, b_, v, s in f.segments(B, END):
    sub.add(synth.bass(f.bass_at(a, 2), b_ - a, 0.6, 'sub'), a)
sub.automate('gain', [(0, -12), (B, -8), (Dp, 0), (END, -2)])

# soft heartbeat kick under the beats only (the heart IS the drum)
kk = m.track('kick', level=LV['kick'] - 4)
for tb in E['beats']:
    kk.add(drums.kick('soft', 0.8, tune=-4), tb - FR * 0.5)

# breath-hold before the tear lands, then a bloom
m.track('riser', level=LV['riser'] - 4).add(sfx.riser(Dp - E['detach'] + 0.4, 'noise', intensity=0.5), Dp)
m.track('bloom', level=LV['fx'] + 1, sends={'shimmer': -6}).add(sfx.shimmer_hit(f.chord_at(Dp)[-1] + 12), Dp)
fin = m.track('final', level=LV['bells'] + 2, sends={'hall': -6})
for k, n in enumerate(sorted(f.chord_at(O, 12))):
    fin.add(play(n, None, 0.5 - 0.05 * k), O + 0.04 * k)
m.group('music').automate('gain', [(0, -2.0), (B, -1.0), (Dp - 0.02, -1.0), (Dp, 0.5), (O, 0.0), (END, -1.0)])
for gname in list(m.groups):
    m.mute(Dp - 0.20, 0.20, group=gname)          # the world holds its breath while the tear falls

# --- sound design, frame-locked
m.sfx(sfx.whoosh(0.55, 'swish', direction=-1, peak=0.85, seed=2), at=max(0.0, E['land1'] - 0.45), gain=-9)
thud = mg.layer([(drums.kick('soft', 1.0, tune=-3).loud(-18), 0.0, 0.0, 0.0), (sfx.gloop(0.85, 0.3, seed=4), 0.0, -3.0, 0.0),
                 (sfx.squelch(0.25, seed=6), 0.012, -8.0, 0.0)])
m.sfx(thud.loud(-18), at=E['land1'] - FR * 0.5, gain=1.5, verb=-14)
m.sfx(sfx.pop('bubble', pitch=1.1), at=E['land1'] + 0.12, gain=-8)
m.sfx(mg.layer([(drums.kick('soft', 0.7, tune=0).loud(-18), 0, 0, 0), (sfx.squelch(0.15, seed=8), 0.01, -8, 0)]).loud(-18),
      at=E['land2'] - FR * 0.5, gain=-4)
for tb in E['beats']:
    m.sfx(sfx.gloop(0.6, 0.18, seed=int(tb * 10)), at=tb, gain=-14)
# tear: forms with a rising bubble + glass chime, stretches (soft creak of air), drips
m.sfx(sfx.bubble(1.3, rise=1.4), at=E['tear_born'] + 0.05, gain=-8)
m.sfx(sfx.chime([f.chord_at(E['tear_full'], 24)[i] for i in (0, 2, 3)], step=0.07, kind='celesta'), at=E['tear_full'] - 0.1, gain=-9, verb=-8)
m.sfx(sfx.drip(1.2, seed=3), at=E['detach'], gain=-5, verb=-10)
m.sfx(sfx.whoosh(0.4, 'air', direction=-1, peak=0.9, seed=9), at=E['detach'] + 0.02, gain=-14)
# HERO: the tear lands
m.sfx(sfx.impact('thud', size=1.0), at=HIT - FR * 0.5, gain=0, verb=-8)
m.sfx(sfx.gloop(1.3, 0.45, seed=12), at=HIT, gain=-2)
m.sfx(sfx.boom(1.6, 52), at=HIT, gain=-8)
for k, t in enumerate(E['bead_lands']):
    m.sfx(sfx.pop('soft', pitch=float(rng.uniform(1.8, 2.8))) if k % 2 else sfx.click('soft'), at=float(t), gain=float(-16 + rng.uniform(-3, 1)),
          pan=float(rng.uniform(-0.6, 0.6)))
m.sfx(sfx.bubbles(1.2, 16, size=(0.25, 0.6), seed=4), at=HIT + 0.15, gain=-14, verb=-12)
m.sfx(sfx.whoosh(1.2, 'air', direction=1, peak=0.3, seed=11), at=E['sigh'] - 0.2, gain=-12)
m.sfx(sfx.sparkle(1.6, 12, 'D', 'major_pentatonic', seed=2), at=HOLD + 0.05, gain=-13, verb=-10)

res = m.export(f'{HERE}/out/audio.wav', lufs=-14, tp=-1)
print({k: res[k] for k in ('duration', 'lufs', 'true_peak', 'warnings') if k in res})
print('alignment', mg.hit_alignment(f'{HERE}/out/audio.wav', [E['land1'], HIT]))
