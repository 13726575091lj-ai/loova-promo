"""Build a JianYing (剪映) draft from a rendered cut.

The film is rendered by code, so the draft carries the rendered result split at the shared
timeline's scene boundaries (one clip per scene on the main track), plus the music and SFX
stems on separate audio tracks. Material paths are rewritten to a fixed Windows location
(TARGET) so the draft opens without relinking when unzipped there.

usage: python tools/jianying.py build/v8/LOOVA_12s_v4 project.json build/jianying
"""
import json, os, shutil, subprocess, sys

import pyJianYingDraft as draft
from pyJianYingDraft import Timerange, TrackSpec, TrackType

base, proj_file, out_root = sys.argv[1], sys.argv[2], sys.argv[3]
import os as _o
DRAFT = _o.environ.get("DRAFT", "LOOVA_v4")
TARGET = _o.environ.get("TARGET", "C:/LOOVA_jianying/素材")
FFMPEG = os.environ["FFMPEG"]
NAMES = {"open": "01_开场标题", "slot": "02_粉色滚轮", "drag": "03_拖动模特", "flags": "04_国旗投放", "layers": "05_分层展示", "brand": "06_品牌收尾", "intro": "01_B2开场", "statement": "02_宣言", "work1": "03_CANDY_MUTINY", "work2": "04_ASHBOUND", "work3": "05_MY_BLOCK", "work4": "06_MOMS_HOME", "grid": "07_作品墙", "end": "08_收尾"}

P = json.load(open(proj_file))
fps = P["meta"]["fps"]
scenes, t = [], 0.0
for s in P["scenes"]:
    if s.get("enabled") is False:
        continue
    scenes.append((s["id"], t, t + s["duration"]))
    t += s["duration"]
total_f = round(t * fps)

shutil.rmtree(out_root, ignore_errors=True)
mat = os.path.join(out_root, "素材")
os.makedirs(mat)

# frame-exact cuts: boundaries rounded to whole frames so the clips tile the 12 s exactly
clips = []
bounds = [round(a * fps) for _, a, _ in scenes] + [total_f]
for i, (sid, _, _) in enumerate(scenes):
    f0, f1 = bounds[i], bounds[i + 1]
    name = f"{NAMES.get(sid, sid)}.mp4"
    dst = os.path.join(mat, name)
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", base + ".mp4", "-vf", f"trim=start_frame={f0}:end_frame={f1},setpts=PTS-STARTPTS",
                    "-an", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(fps), dst], check=True)
    clips.append((name, f0, f1))
for stem, cn in (("music", "配乐_music.wav"), ("sfx", "音效_sfx.wav"), ("mix", "混音_mix.wav")):
    shutil.copy(f"{base}_stems/{stem}.wav", os.path.join(mat, cn))
shutil.copy(base + ".mp4", os.path.join(mat, "成片.mp4"))

us = lambda f: round(f * 1_000_000 / fps)
folder = draft.DraftFolder(out_root)
script = folder.create_draft(DRAFT, P["meta"]["width"], P["meta"]["height"], fps, allow_replace=True)
script.append_track(TrackSpec(TrackType.video, name="主画面"))
script.append_track(TrackSpec(TrackType.audio, name="配乐"))
script.append_track(TrackSpec(TrackType.audio, name="音效"))
for name, f0, f1 in clips:
    script.add_segment(draft.VideoSegment(os.path.join(mat, name), Timerange(us(f0), us(f1 - f0)), volume=0.0), "主画面")
dur = us(total_f)
script.add_segment(draft.AudioSegment(os.path.join(mat, "配乐_music.wav"), Timerange(0, dur)), "配乐")
script.add_segment(draft.AudioSegment(os.path.join(mat, "音效_sfx.wav"), Timerange(0, dur)), "音效")
script.save()

# move materials beside the draft and point every path at the fixed install location
dpath = os.path.join(out_root, DRAFT)
local = os.path.abspath(mat).replace("\\", "/")
for fn in os.listdir(dpath):
    if fn.endswith(".json"):
        fp = os.path.join(dpath, fn)
        s = open(fp, encoding="utf-8").read()
        open(fp, "w", encoding="utf-8").write(s.replace(local, TARGET))
print("clips:", [(n, f1 - f0) for n, f0, f1 in clips], "frames total", sum(f1 - f0 for _, f0, f1 in clips))
