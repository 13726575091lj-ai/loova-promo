"""
Quality check of an exported MP4 against its render log (timeline, cues, text holds).

  python tools/qc.py dist/loova_20s            (expects dist/loova_20s.mp4 + _render-log.json)

Checks
  * container: resolution, fps, duration, audio stream
  * motion: frame-to-frame change spikes (abrupt jumps) outside designed cut points
  * flicker: A-B-A frame patterns globally and per screen block (particles / dots)
  * text: overflow + safe-area clipping per frame (from engine reports) and hold durations
  * audio: peak / clipping / RMS, and onset alignment of every transient cue (A/V sync)
Writes <base>_qc.md, <base>_qc.json and <base>_qc.png (motion + audio timeline plot).
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

FF = os.environ.get("FFMPEG", "ffmpeg")
base = sys.argv[1]
mp4 = base + ".mp4"
log = json.load(open(base + "_render-log.json"))
fps = log["fps"]

# ------------------------------------------------------------------ container
info = subprocess.run([FF, "-hide_banner", "-i", mp4], capture_output=True, text=True).stderr
res = re.search(r"Video:.* (\d{3,4})x(\d{3,4})", info)
dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
vfps = re.search(r"([\d.]+) fps", info)
container = {
    "width": int(res.group(1)), "height": int(res.group(2)),
    "duration": int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)),
    "fps": float(vfps.group(1)), "audio": "Audio:" in info,
    "audioDesc": (re.search(r"Audio: ([^\n]+)", info) or [None, ""])[1],
}

# ------------------------------------------------------------------ frames
w, h = 320, 180
raw = subprocess.run([FF, "-v", "error", "-i", mp4, "-vf", f"scale={w}:{h}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
n = len(F)
d = np.zeros(n)
d[1:] = np.abs(F[1:] - F[:-1]).mean((1, 2))
skip = np.zeros(n)
skip[1:-1] = np.abs(F[2:] - F[:-2]).mean((1, 2))

scene_at = lambda t: next((s["id"] for s in log["timeline"] if s["start"] <= t < s["end"]), log["timeline"][-1]["id"])
bounds = [s["start"] for s in log["timeline"]][1:]

# abrupt jumps: change much larger than the local motion level
jumps = []
for i in range(1, n):
    lo, hi = max(1, i - 6), min(n, i + 7)
    local = np.median(np.r_[d[lo:i], d[i + 1:hi]]) if hi - lo > 2 else 0
    if d[i] > 18 and d[i] > 3.0 * local + 6:
        t = i / fps
        near_cut = any(abs(t - b) < 1.5 / fps for b in bounds)
        jumps.append({"frame": i, "t": round(t, 3), "scene": scene_at(t), "change": round(float(d[i]), 2), "local": round(float(local), 2), "atSceneBoundary": near_cut})

# global flicker: frame i differs from both neighbours but neighbours match each other
flicker = []
for i in range(1, n - 1):
    if d[i] > 4 and d[i + 1] > 4 and skip[i] < 0.35 * min(d[i], d[i + 1]):
        flicker.append({"frame": i, "t": round(i / fps, 3), "scene": scene_at(i / fps), "change": round(float(d[i]), 2)})

# block flicker (catches small particles / dot grids)
by, bx = 9, 16
B = F.reshape(n, by, h // by, bx, w // bx).mean((2, 4))
# Flicker = brightness oscillating up/down/up over consecutive frames (A-B-A-B), which is
# what strobing particles or aliasing look like. A single object passing through a block
# (rise then fall once) is ordinary motion and is not counted.
sd = B[1:] - B[:-1]  # signed change, n-1
bs = np.abs(B[2:] - B[:-2])  # n-2
m3 = len(sd) - 2
a0, a1, a2 = sd[:m3], sd[1:m3 + 1], sd[2:m3 + 2]
mn = np.minimum(np.minimum(np.abs(a0), np.abs(a1)), np.abs(a2))
mask = (mn > 6) & (np.sign(a0) == -np.sign(a1)) & (np.sign(a1) == -np.sign(a2)) & (bs[:m3] < 0.3 * mn) & (bs[1:m3 + 1] < 0.3 * mn)
block_flicker = [
    {"frame": int(i + 1), "t": round((i + 1) / fps, 3), "scene": scene_at((i + 1) / fps), "blocks": int(c), "where": [[int(x), int(y)] for y, x in zip(*np.where(mask[i]))][:6]}
    for i, c in enumerate(mask.sum((1, 2))) if c > 0
]

# ------------------------------------------------------------------ text
issues = log["frameIssues"]
overflow = [x for x in issues if not x["fits"]]
clipped = [x for x in issues if x["clipped"]]
def min_hold(text):
    return 0.45 + 0.025 * len(text or "")
holds = []
for hd in log["holds"]:
    dt = hd["end"] - hd["start"]
    need = min_hold(hd.get("text", ""))
    holds.append({**hd, "duration": round(dt, 3), "required": round(need, 3), "ok": dt >= need})

# ------------------------------------------------------------------ audio
sr = 48000
pcm = subprocess.run([FF, "-v", "error", "-i", mp4, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
a = np.frombuffer(pcm, np.float32)
st = subprocess.run([FF, "-v", "error", "-i", mp4, "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
a2 = np.frombuffer(st, np.float32).reshape(-1, 2)
peak = float(np.abs(a2).max())
rms_db = float(20 * np.log10(np.sqrt((a2 ** 2).mean()) + 1e-12))
clips = int((np.abs(a2) > 0.999).sum())
hop = int(sr * 0.002)
frames_e = len(a) // hop
E = (a[: frames_e * hop].reshape(frames_e, hop) ** 2).mean(1)
# high-passed energy (first difference) emphasises clicks / transients over sustained music
hpE = (np.diff(a, prepend=0)[: frames_e * hop].reshape(frames_e, hop) ** 2).mean(1)
logE = 10 * np.log10(hpE + 1e-10)
onset = np.maximum(0, np.diff(logE, prepend=logE[0]))
TRANSIENT = {"impact", "tick", "lock", "pop", "ding", "subdrop"}
sync = []
tcues = [c for c in log["cues"] if c["type"] in TRANSIENT]
# cues closer than 60 ms fuse into one audible event: keep the first of each cluster
clustered = []
for c in tcues:
    if clustered and c["t"] - clustered[-1]["t"] < 0.06:
        continue
    clustered.append(c)
for c in clustered:
    k = int(c["t"] / 0.002)
    lo, hi = max(0, k - 20), min(frames_e, k + 20)  # ±40 ms
    if hi <= lo:
        continue
    j = lo + int(np.argmax(onset[lo:hi]))
    sync.append({"t": round(c["t"], 3), "type": c["type"], "scene": c["scene"], "offsetMs": round((j - k) * 2.0, 1), "strengthDb": round(float(onset[j]), 1)})

# global A/V offset introduced by encoding/muxing: cross-correlate muxed audio with the rendered mix
def read_wav_mono(p):
    import wave
    with wave.open(p) as wf:
        x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768
        return x.reshape(-1, wf.getnchannels()).mean(1)
mux_offset_ms = None
stems = base + "_stems"
if os.path.exists(os.path.join(stems, "mix.wav")):
    ref = read_wav_mono(os.path.join(stems, "mix.wav"))
    m = min(len(ref), len(a), sr * 6)
    A_ = np.fft.rfft(a[:m], 2 * m)
    R_ = np.fft.rfft(ref[:m], 2 * m)
    xc = np.fft.irfft(A_ * np.conj(R_))
    lag_max = int(0.2 * sr)
    cand = np.r_[xc[: lag_max], xc[-lag_max:]]
    lags = np.r_[np.arange(lag_max), np.arange(-lag_max, 0)]
    mux_offset_ms = float(lags[int(np.argmax(cand))] / sr * 1000)
    # every transient cue against the isolated SFX stem (not masked by music)
    sfx = read_wav_mono(os.path.join(stems, "sfx.wav"))
    fe = len(sfx) // hop
    he = (np.diff(sfx, prepend=0)[: fe * hop].reshape(fe, hop) ** 2).mean(1)
    on2 = np.maximum(0, np.diff(10 * np.log10(he + 1e-10), prepend=-100))
    stem_offs = []
    for c in clustered:
        k = int(c["t"] / 0.002)
        lo, hi = max(0, k - 10), min(fe, k + 10)
        if hi > lo:
            # first 2 ms hop whose energy rises 6 dB above the level just before the window
            pre = np.median(he[max(0, lo - 15):lo]) if lo > 0 else 0
            above = np.where(he[lo:hi] > max(pre * 4, 1e-9))[0]
            j = lo + int(above[0]) if len(above) else lo + int(np.argmax(on2[lo:hi]))
            stem_offs.append(abs((j - k) * 2.0))
    stem_sync = {"cues": len(stem_offs), "maxAbsMs": float(max(stem_offs)) if stem_offs else 0, "within10ms": int(sum(o <= 10 for o in stem_offs)), "withinFrame": int(sum(o <= 1000 / fps for o in stem_offs))}
else:
    stem_sync = None
masked = [s for s in sync if s["strengthDb"] < 6]
sync = [s for s in sync if s["strengthDb"] >= 6]
offs = np.array([abs(s["offsetMs"]) for s in sync]) if sync else np.zeros(1)
# AAC encoder priming is removed by ffmpeg on decode; report residual
sync_summary = {"cues": len(sync), "medianAbsMs": float(np.median(offs)), "p95AbsMs": float(np.percentile(offs, 95)), "maxAbsMs": float(offs.max()),
                "within20ms": int((offs <= 20).sum()), "maskedCues": masked, "muxOffsetMs": mux_offset_ms, "stem": stem_sync}

# ------------------------------------------------------------------ plot
PW, PH = 1600, 420
img = Image.new("RGB", (PW, PH), (18, 18, 20))
g = ImageDraw.Draw(img)
T = n / fps
X = lambda t: int(t / T * (PW - 20)) + 10
for s in log["timeline"]:
    g.rectangle([X(s["start"]), 0, X(s["end"]), 14], outline=(90, 90, 90))
    g.text((X(s["start"]) + 4, 2), s["id"], fill=(200, 200, 200))
dm = max(30, d.max())
pts = [(X(i / fps), 200 - int(d[i] / dm * 170)) for i in range(n)]
g.line(pts, fill=(0, 245, 160), width=1)
g.text((12, 24), "frame change (mean abs, 0-255)", fill=(0, 245, 160))
for j in jumps:
    g.line([X(j["t"]), 30, X(j["t"]), 200], fill=(255, 60, 60))
env = np.abs(a[: len(a) // 400 * 400]).reshape(-1, 400).max(1)
for i, v in enumerate(env):
    x = X(i * 400 / sr)
    g.line([x, 320 - int(v * 90), x, 320 + int(v * 90)], fill=(80, 150, 255))
for c in log["cues"]:
    if c["type"] in TRANSIENT:
        g.line([X(c["t"]), 228, X(c["t"]), 236], fill=(255, 220, 0))
g.text((12, 222), "audio waveform, yellow ticks = transient cues", fill=(80, 150, 255))
img.save(base + "_qc.png")

# ------------------------------------------------------------------ report
# fast motion inside a cued whoosh/swish/sweep window is a designed whip transition
WHIP = [(c["t"] - 0.04, c["t"] + c.get("len", 0.3) + 0.04) for c in log["cues"] if c["type"] in ("whoosh", "swish", "sweep")]
for j in jumps:
    j["designedWhip"] = any(a <= j["t"] <= b for a, b in WHIP)
unexpected = [j for j in jumps if not j["atSceneBoundary"] and not j["designedWhip"]]
report = {
    "container": container, "frames": n,
    "motion": {"maxChange": round(float(d.max()), 2), "meanChange": round(float(d.mean()), 2), "jumps": jumps, "unexpectedJumps": len(unexpected)},
    "flicker": {"global": flicker, "blockFrames": block_flicker[:200], "blockFrameCount": len(block_flicker)},
    "text": {"overflowFrames": len(overflow), "clippedFrames": len(clipped), "examples": (overflow + clipped)[:20], "holds": holds, "posterWarnings": log["posterWarnings"]},
    "audio": {"peak": round(peak, 4), "peakDb": round(20 * np.log10(peak + 1e-12), 2), "rmsDb": round(rms_db, 2), "clippedSamples": clips, "sync": sync_summary, "cueSync": sync},
}
json.dump(report, open(base + "_qc.json", "w"), indent=2, ensure_ascii=False)

ok = lambda b: "PASS" if b else "CHECK"
L = [f"# QC report — {os.path.basename(mp4)}", ""]
L += ["| Check | Result | Status |", "|---|---|---|"]
L.append(f"| Format | {container['width']}×{container['height']}, {container['fps']:.0f} fps, {container['duration']:.2f} s, audio: {container['audioDesc'].split(',')[0] if container['audio'] else 'none'} | {ok(container['width']==1920 and container['height']==1080 and container['audio'])} |")
L.append(f"| Abrupt motion | {len(unexpected)} unplanned spikes; {len(jumps)-len(unexpected)} fast frames inside designed cuts / cued whip transitions; max change {d.max():.1f}/255 | {ok(len(unexpected)==0)} |")
L.append(f"| Global flicker (A-B-A) | {len(flicker)} frames | {ok(len(flicker)==0)} |")
L.append(f"| Particle / block flicker | {len(block_flicker)} frames with flickering blocks | {ok(len(block_flicker)<=3)} |")
L.append(f"| Text overflow | {len(overflow)} frame reports | {ok(len(overflow)==0)} |")
L.append(f"| Safe-area clipping | {len(clipped)} frame reports | {ok(len(clipped)==0)} |")
bad_holds = [x for x in holds if not x["ok"]]
L.append(f"| Text hold time | {len(holds)-len(bad_holds)}/{len(holds)} holds meet 0.45 s + 25 ms/char | {ok(not bad_holds)} |")
L.append(f"| Audio level | peak {report['audio']['peakDb']} dBFS, RMS {rms_db:.1f} dBFS, {clips} clipped samples | {ok(clips==0 and peak<0.999)} |")
L.append(f"| Cue onsets in final mix (info) | {sync_summary['within20ms']}/{sync_summary['cues']} clearly audible transients peak within 20 ms of their frame time (median {sync_summary['medianAbsMs']:.0f} ms); {len(masked)} quieter cues sit under the music bed. The onset detector can lock onto a nearby kick drum, so the stem and mux checks below are the pass/fail measures | INFO |")
if mux_offset_ms is not None:
    L.append(f"| Mux A/V offset | encoded audio vs rendered mix: {mux_offset_ms:+.1f} ms | {ok(abs(mux_offset_ms) <= 10)} |")
if stem_sync:
    L.append(f"| Cue placement (SFX stem) | {stem_sync['withinFrame']}/{stem_sync['cues']} transient cues start within one frame ({1000/fps:.0f} ms) of their visual event; {stem_sync['within10ms']} within 10 ms; max {stem_sync['maxAbsMs']:.0f} ms | {ok(stem_sync['withinFrame'] == stem_sync['cues'])} |")
L += ["", "## Text holds", "", "| Element | Text | Visible hold | Required | |", "|---|---|---|---|---|"]
for x in holds:
    L.append(f"| {x['label']} | {x.get('text','')} | {x['duration']:.2f} s | {x['required']:.2f} s | {ok(x['ok'])} |")
if jumps:
    L += ["", "## Motion spikes", "", "| t (s) | scene | change | local | at boundary | cued whip |", "|---|---|---|---|---|---|"]
    for j in jumps:
        L.append(f"| {j['t']} | {j['scene']} | {j['change']} | {j['local']} | {j['atSceneBoundary']} | {j['designedWhip']} |")
if block_flicker:
    L += ["", f"Block flicker frames (first 20): {', '.join(str(b['t']) for b in block_flicker[:20])}"]
L += ["", f"Plot: `{os.path.basename(base)}_qc.png`"]
open(base + "_qc.md", "w").write("\n".join(L) + "\n")
print("\n".join(L[:14]))
