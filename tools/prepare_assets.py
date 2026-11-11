"""
Prepare standalone assets from the reference images supplied in the brief.

Outputs (assets/):
  posters/poster_{en,ja,ko,es,th}.png    full localized posters
  layers/en_*.png                         English poster split into layers
  logo/loova_icon.png, loova_wordmark.png raster logo pieces (alpha)
  logo/logo_paths.json                    traced vector outlines of icon bolt + wordmark

Usage:  python tools/prepare_assets.py   (needs pillow numpy opencv-python-headless rembg)
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "source")
OUT = os.path.join(ROOT, "assets")
for d in ("posters", "layers", "logo"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

POSTERS = {"en": "ref_2.png", "ja": "ref_3.png", "ko": "ref_4.png", "es": "ref_5.png", "th": "ref_6.png"}


def load(name):
    return np.array(Image.open(os.path.join(SRC, name)).convert("RGB"))


def save_rgba(path, rgb, alpha):
    a = np.clip(alpha, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb.astype(np.uint8), a]), "RGBA").save(path, optimize=True)


# ---------------------------------------------------------------- posters
for k, f in POSTERS.items():
    Image.fromarray(load(f)).save(os.path.join(OUT, "posters", f"poster_{k}.png"), optimize=True)

# ---------------------------------------------------------------- logo
logo = load("ref_7.png").astype(np.int32)
sat = logo.max(2) - logo.min(2)


def trace(mask, scale, ox, oy, eps):
    """Upsample a binary mask, find contours with hierarchy, return normalised polygons."""
    up = cv2.resize(mask.astype(np.float32), None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    up = cv2.GaussianBlur(up, (0, 0), scale * 0.45)
    b = (up > 0.5).astype(np.uint8)
    cnts, hier = cv2.findContours(b, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    for c in cnts:
        if cv2.contourArea(c) < (scale * scale) * 4:
            continue
        c = cv2.approxPolyDP(c, eps * scale, True)
        polys.append([[round(float(p[0][0]) / scale + ox, 3), round(float(p[0][1]) / scale + oy, 3)] for p in c])
    return polys


# icon: rounded square (saturated) with dark bolt inside
ix0, ix1, iy0, iy1 = 30, 189, 26, 185
icon = logo[iy0:iy1 + 1, ix0:ix1 + 1]
icon_sq = sat[iy0:iy1 + 1, ix0:ix1 + 1] > 60
bolt = (~icon_sq) & (cv2.erode(icon_sq.astype(np.uint8), np.ones((3, 3)), iterations=1) == 0)
# bolt = holes inside the square: fill square and subtract
filled = icon_sq.astype(np.uint8).copy()
cnts, _ = cv2.findContours(filled, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
hull = np.zeros_like(filled)
cv2.drawContours(hull, cnts, -1, 1, -1)
bolt = (hull == 1) & (~icon_sq)
W = float(ix1 - ix0 + 1)
bolt_polys = trace(bolt, 8, 0, 0, 0.6)
bolt_polys = [[[x / W, y / W] for x, y in p] for p in bolt_polys]
alpha_icon = cv2.GaussianBlur(hull.astype(np.float32), (0, 0), 0.6) * 255
save_rgba(os.path.join(OUT, "logo", "loova_icon.png"), icon, alpha_icon)

# wordmark: gradient letters on near-black card
wx0, wx1, wy0, wy1 = 282, 529, 74, 135
word = logo[wy0:wy1 + 1, wx0:wx1 + 1]
wsat = word.max(2) - word.min(2)
wmask = wsat > 70
lum = word.max(2).astype(np.float32)
alpha_word = np.clip((lum - 20) / (220 - 20), 0, 1) * 255
unpremul = np.clip(word * 255.0 / np.maximum(alpha_word[..., None], 1), 0, 255)
save_rgba(os.path.join(OUT, "logo", "loova_wordmark.png"), unpremul, alpha_word)
yy, xx = np.where(wmask)
bx0, bx1, by0, by1 = xx.min(), xx.max(), yy.min(), yy.max()
WH = float(by1 - by0 + 1)
word_polys = trace(wmask[by0:by1 + 1, bx0:bx1 + 1], 8, 0, 0, 0.35)
word_polys = [[[x / WH, y / WH] for x, y in p] for p in word_polys]

# sample brand colours from the icon gradient
c_top = logo[iy0 + 12, ix1 - 12].tolist()
c_bot = logo[iy1 - 12, ix0 + 12].tolist()
json.dump(
    {
        "note": "Traced from the supplied LOOVA logo sheet. Coordinates normalised: icon by icon width, wordmark by wordmark height. Use even-odd fill.",
        "iconCornerRadius": 0.235,
        "bolt": bolt_polys,
        "wordmark": {"aspect": round((bx1 - bx0 + 1) / WH, 4), "polys": word_polys},
        "sampledGradient": {"topRight": c_top, "bottomLeft": c_bot},
    },
    open(os.path.join(OUT, "logo", "logo_paths.json"), "w"),
)
print("logo: bolt polys", len(bolt_polys), "word polys", len(word_polys), "colors", c_top, c_bot)

# ---------------------------------------------------------------- English poster layers
from rembg import new_session, remove  # noqa: E402

img = load(POSTERS["en"])
H, Wd = img.shape[:2]
pil = Image.fromarray(img)
m_h = np.array(remove(pil, session=new_session("u2net_human_seg"), only_mask=True)).astype(np.float32) / 255
m_g = np.array(remove(pil, session=new_session("isnet-general-use"), only_mask=True)).astype(np.float32) / 255

f = img.astype(np.float32)
r, g, b = f[..., 0], f[..., 1], f[..., 2]
L = f.mean(2)
hairish = (b - r > 50) & (b > 120)

# ---- text mask (all printed type on the cover)
text = np.zeros((H, Wd), bool)
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))
blackhat = cv2.morphologyEx(L.astype(np.uint8), cv2.MORPH_BLACKHAT, k)
tophat = cv2.morphologyEx(L.astype(np.uint8), cv2.MORPH_TOPHAT, k)
person_core = m_h > 0.5
# masthead: dark or deep-blue letters in the top band, not the model
mast = ((L < 120) | ((b - r > 80) & (L < 150))) & ~person_core
mast[205:] = False
text |= mast
# date + cover lines (dark small type on right)
box = np.zeros_like(text)
box[200:440, 500:675] = True
text |= box & (blackhat > 35)
# headline + deck (white type bottom-left, over coat and backdrop)
box = np.zeros_like(text)
box[705:935, 20:440] = True
satf = f.max(2) - f.min(2)
text |= box & (tophat > 28) & (satf < 45) & (L > 170)
text = cv2.dilate(text.astype(np.uint8), np.ones((5, 5), np.uint8), iterations=1).astype(bool)
clean = cv2.inpaint(img, text.astype(np.uint8) * 255, 6, cv2.INPAINT_TELEA)
Image.fromarray(text.astype(np.uint8) * 255).save(os.path.join(OUT, "layers", "_text_mask.png"))

# ---- subject matte: human matte + flying hair strands from the general matte
# the backdrop has no blue below the masthead, so any blue below y=140 is hair
hair_a = np.clip((b - r - 25) / 55.0, 0, 1)
hair_a[:140] = 0
hair_a = cv2.morphologyEx(hair_a, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
alpha = np.maximum(m_h, hair_a)
alpha[text & ~person_core] = np.minimum(alpha[text & ~person_core], m_h[text & ~person_core])
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
save_rgba(os.path.join(OUT, "layers", "en_subject.png"), clean, alpha * 255)

# ---- crowd (small group bottom-left)
crowd = np.zeros((H, Wd), np.float32)
crowd[560:720, 0:105] = 1
crowd_a = crowd * np.clip((172 - L) / 45.0, 0, 1) * (1 - np.clip(m_h * 2, 0, 1))
crowd_a = cv2.GaussianBlur(cv2.dilate(crowd_a, np.ones((3, 3))), (0, 0), 0.8)
save_rgba(os.path.join(OUT, "layers", "en_crowd.png"), clean, crowd_a * 255)

# ---- background plate: remove subject + crowd, fill row-wise then soften
hole = (cv2.dilate(((alpha > 0.015) | (crowd_a > 0.03)).astype(np.uint8), np.ones((23, 23))) > 0)
plate = clean.astype(np.float32).copy()
for y in range(H):
    row = hole[y]
    if not row.any():
        continue
    xs = np.arange(Wd)
    good = ~row
    if good.sum() < 2:
        continue
    for c in range(3):
        plate[y, row, c] = np.interp(xs[row], xs[good], plate[y, good, c])
soft = cv2.GaussianBlur(plate, (0, 0), 9)
w = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 6)[..., None]
plate = plate * (1 - w) + soft * w
noise = np.random.default_rng(3).normal(0, 1.6, plate.shape)
plate = np.clip(plate + noise * w, 0, 255)
Image.fromarray(plate.astype(np.uint8)).save(os.path.join(OUT, "layers", "en_background.png"), optimize=True)
Image.fromarray(clean).save(os.path.join(OUT, "layers", "en_clean_no_text.png"), optimize=True)
print("layers done", img.shape)
