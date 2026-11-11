"""Prepare 2.5D parallax plates for each portfolio still.

For every work cover in portfolio/assets/works/*.webp:
  <name>_bg.jpg   background plate: subject removed (OpenCV Telea inpaint over a dilated mask)
  <name>_fg.png   subject cut-out with soft alpha (rembg u2net)
  <name>_full.jpg the untouched frame (used for cards and the first/last frame of each shot)
All plates are resized to 2400 px wide so the camera can push in without upscaling.

usage: U2NET_HOME=... python portfolio/prepare.py
"""
import glob, os
import numpy as np, cv2
from PIL import Image
from rembg import remove, new_session

D = "portfolio/assets/works"
session = new_session("u2net")
for src in sorted(glob.glob(f"{D}/*.webp")):
    name = os.path.splitext(os.path.basename(src))[0]
    im = Image.open(src).convert("RGB")
    W = 2400
    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    rgba = remove(im, session=session, post_process_mask=True)
    a = np.asarray(rgba)[..., 3]
    # keep the largest subject blobs only (drops speckles in text / neon)
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 128).astype(np.uint8))
    keep = np.zeros_like(a)
    if n > 1:
        areas = st[1:, cv2.CC_STAT_AREA]
        for i in np.argsort(-areas)[:3]:
            if areas[i] > 0.01 * a.size:
                keep[lab == i + 1] = 255
    a = cv2.GaussianBlur(np.minimum(a, cv2.dilate(keep, np.ones((9, 9), np.uint8))), (5, 5), 0)
    fg = np.dstack([np.asarray(im), a])
    Image.fromarray(fg, "RGBA").save(f"{D}/{name}_fg.png", optimize=True)
    rgb = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    small = cv2.resize(rgb, (W // 2, rgb.shape[0] // 2))
    m = cv2.resize(cv2.dilate((a > 20).astype(np.uint8) * 255, np.ones((41, 41), np.uint8)), (W // 2, rgb.shape[0] // 2))
    bg = cv2.inpaint(small, m, 9, cv2.INPAINT_TELEA)
    bg = cv2.resize(bg, (W, rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    mm = cv2.GaussianBlur(cv2.resize(m, (W, rgb.shape[0])), (31, 31), 0)[..., None] / 255.0
    bg = (rgb * (1 - mm) + bg * mm).astype(np.uint8)
    cv2.imwrite(f"{D}/{name}_bg.jpg", bg, [cv2.IMWRITE_JPEG_QUALITY, 92])
    cv2.imwrite(f"{D}/{name}_full.jpg", rgb, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(name, im.size, "subject %.1f%%" % (100 * (a > 128).mean()))
