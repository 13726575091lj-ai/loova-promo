"""Replace the phone-screen content in the 霸总 clip with the two clean UI images.

Screen images are never stretched: they are scaled uniformly to the screen width
(iPhone 15 Pro aspect 1179x2556) and the extra height is filled with the image's own
background colour (gap under the header and at the bottom).
"""
import cv2, numpy as np, json, os, sys
from PIL import Image, ImageDraw, ImageFont

REPO = '../loova-promo'
IMG1 = REPO + '/generate-image-1795416493733.png'   # Ready (while typing)
IMG2 = REPO + '/generate-image-1795416495267.png'   # Approved (after send)
W = 1584
H = round(W * 2556 / 1179)          # 3434
PT = W / 393.0                       # px per iOS point
HEAD = 380                           # image rows kept as fixed header
INS_FINAL = 250                      # gap inserted under header in final layout
GAP2 = 150                           # gap inserted above the bottom chat row in final layout
SPLIT = 2306                         # blank image row between "ready for review!" and the bottom row
OFF_TYPE = -120                      # content offset while keyboard is open
KT = round(516 * PT)                 # keyboard top
STRIP = (2512, 2722)                 # input-pill strip rows in image 1
F0, F1 = 46, 101
TYPED_AT = [50, 54, 58, 63, 67, 72, 77]
WORD = 'Approve'
SEND = 83                            # text cleared / message sent
KB_START, KB_END = 84, 89            # keyboard slides away

FONT = '/usr/share/fonts/google-noto-vf/NotoSans[wght].ttf'


def font(size, wght=400):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([wght])
    except Exception:
        pass
    return f


img1 = cv2.cvtColor(cv2.imread(IMG1), cv2.COLOR_BGR2RGB).astype(np.float32)
img2 = cv2.cvtColor(cv2.imread(IMG2), cv2.COLOR_BGR2RGB).astype(np.float32)
assert img1.shape[1] == W and img2.shape[1] == W


# ---------------------------------------------------------------- canvas parts
def background(img):
    """Fill canvas with the image's own background: top row-colour blended to bottom row-colour."""
    top = cv2.blur(img[HEAD + 4:HEAD + 10].mean(0, keepdims=True), (31, 1))
    bot = cv2.blur(img[-12:-4].mean(0, keepdims=True), (31, 1))
    t = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    return top * (1 - t) + bot * t


def paste(dst, src, y, alpha=1.0):
    h = src.shape[0]
    y0, y1 = max(y, 0), min(y + h, H)
    if y1 <= y0:
        return
    s = src[y0 - y:y1 - y]
    if np.isscalar(alpha):
        dst[y0:y1] = dst[y0:y1] * (1 - alpha) + s * alpha
    else:
        a = alpha[y0 - y:y1 - y]
        dst[y0:y1] = dst[y0:y1] * (1 - a) + s * a


def typing_strip(text, cursor, src):
    """Input pill from image 1 with the placeholder replaced by typed text."""
    s = src[STRIP[0]:STRIP[1]].copy()
    if text or cursor:
        # erase placeholder with the pill interior colour (copied per column from a clean row)
        y0, y1 = 2568 - STRIP[0], 2668 - STRIP[0]
        clean = s[2575 - STRIP[0]:2580 - STRIP[0], 310:780].mean(0, keepdims=True)
        s[y0:y1, 310:780] = clean
    pil = Image.fromarray(np.clip(s, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)
    f = font(74, 400)
    x = 325
    cy = 2618 - STRIP[0]
    if text:
        d.text((x, cy), text, font=f, fill=(24, 24, 24), anchor='lm')
        x = x + d.textlength(text, font=f) + 4
        # send button instead of voice button
        cx, cyb, r = 1347, 2613 - STRIP[0], 62
        green = tuple(int(v) for v in src[2613, 1300])
        d.ellipse((cx - r - 4, cyb - r - 4, cx + r + 4, cyb + r + 4), fill=tuple(int(v) for v in s[cyb, 1260]))
        d.ellipse((cx - r, cyb - r, cx + r, cyb + r), fill=green)
        d.line((cx, cyb + 30, cx, cyb - 30), fill=(255, 255, 255), width=11)
        d.line((cx - 26, cyb - 6, cx, cyb - 32), fill=(255, 255, 255), width=11)
        d.line((cx + 26, cyb - 6, cx, cyb - 32), fill=(255, 255, 255), width=11)
    if cursor:
        d.rectangle((x, cy - 40, x + 6, cy + 40), fill=(16, 163, 127))
    return np.asarray(pil).astype(np.float32)


SUGG = {
    '': ['I', 'The', "I'm"],
    'A': ['"A"', 'And', 'At'],
    'Ap': ['"Ap"', 'App', 'Apple'],
    'App': ['"App"', 'Apply', 'Apps'],
    'Appr': ['"Appr"', 'Approve', 'Approach'],
    'Appro': ['"Appro"', 'Approve', 'Approach'],
    'Approv': ['"Approv"', 'Approve', 'Approved'],
    'Approve': ['"Approve"', 'Approved', 'Approves'],
}


def keyboard(prefix, shift):
    kh = H - KT
    p = lambda v: int(round(v * PT))
    im = Image.new('RGB', (W, kh), (209, 212, 219))
    d = ImageDraw.Draw(im)
    # suggestions
    sf = font(p(16.5), 400)
    words = SUGG.get(prefix, SUGG[''])
    for k, w in enumerate(words):
        cx = p(393 / 6 * (2 * k + 1))
        d.text((cx, p(22)), w, font=sf, fill=(20, 20, 20), anchor='mm')
    for k in (1, 2):
        x = p(393 / 3 * k)
        d.line((x, p(10), x, p(34)), fill=(178, 180, 186), width=max(2, p(0.5)))

    def key(x0, y0, x1, y1, label='', fill=(255, 255, 255), size=22.5, wght=400, icon=None):
        r = p(5)
        d.rounded_rectangle((p(x0), p(y0) + p(1), p(x1), p(y1) + p(1)), r, fill=(137, 138, 141))
        d.rounded_rectangle((p(x0), p(y0), p(x1), p(y1)), r, fill=fill)
        cx, cy = p((x0 + x1) / 2), p((y0 + y1) / 2)
        if label:
            d.text((cx, cy - p(1)), label, font=font(p(size), wght), fill=(0, 0, 0), anchor='mm')
        if icon == 'shift':
            filled = shift
            pts = [(0, -10), (9, -1), (4.5, -1), (4.5, 8), (-4.5, 8), (-4.5, -1), (-9, -1)]
            pts = [(cx + p(a), cy + p(b)) for a, b in pts]
            if filled:
                d.polygon(pts, fill=(0, 0, 0))
            else:
                d.polygon(pts, outline=(0, 0, 0), width=p(1.4))
        if icon == 'back':
            pts = [(-11, 0), (-5, -8), (10, -8), (10, 8), (-5, 8)]
            d.polygon([(cx + p(a), cy + p(b)) for a, b in pts], outline=(0, 0, 0), width=p(1.4))
            d.line((cx - p(1), cy - p(3.5), cx + p(6), cy + p(3.5)), fill=(0, 0, 0), width=p(1.4))
            d.line((cx - p(1), cy + p(3.5), cx + p(6), cy - p(3.5)), fill=(0, 0, 0), width=p(1.4))
        if icon == 'emoji':
            rr = p(10)
            d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(0, 0, 0), width=p(1.4))
            for dx in (-3.5, 3.5):
                d.ellipse((cx + p(dx) - p(1.3), cy - p(4) - p(1.3), cx + p(dx) + p(1.3), cy - p(4) + p(1.3)), fill=(0, 0, 0))
            d.arc((cx - p(6), cy - p(5), cx + p(6), cy + p(6)), 20, 160, fill=(0, 0, 0), width=p(1.4))

    rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
    kw, gap, top = 33.3, 6.0, 52.0
    rh, rg = 42.0, 11.5
    dark = (171, 176, 188)
    for r, keys in enumerate(rows):
        y0 = top + r * (rh + rg)
        if r == 0:
            x = 3.0
        elif r == 1:
            x = 3 + (kw + gap) / 2
        else:
            x = 3 + 42 + 14.0
        for c in keys:
            key(x, y0, x + kw, y0 + rh, c.upper() if shift else c)
            x += kw + gap
    y2 = top + 2 * (rh + rg)
    key(3, y2, 45, y2 + rh, fill=(255, 255, 255) if shift else dark, icon='shift')
    key(348, y2, 390, y2 + rh, fill=dark, icon='back')
    y3 = top + 3 * (rh + rg)
    key(3, y3, 45, y3 + rh, '123', fill=dark, size=16)
    key(51, y3, 93, y3 + rh, fill=dark, icon='emoji')
    key(99, y3, 294, y3 + rh, 'space', size=16)
    key(300, y3, 390, y3 + rh, 'return', fill=dark, size=16)
    # globe + mic row
    gy = p(y3 + rh + 26)
    gx = p(28)
    rr = p(11)
    d.ellipse((gx - rr, gy - rr, gx + rr, gy + rr), outline=(80, 80, 85), width=p(1.4))
    d.line((gx - rr, gy, gx + rr, gy), fill=(80, 80, 85), width=p(1.2))
    d.ellipse((gx - p(5), gy - rr, gx + p(5), gy + rr), outline=(80, 80, 85), width=p(1.2))
    mx = p(365)
    d.rounded_rectangle((mx - p(4.5), gy - p(11), mx + p(4.5), gy + p(3)), p(4.5), outline=(80, 80, 85), width=p(1.5))
    d.arc((mx - p(8), gy - p(8), mx + p(8), gy + p(7)), 0, 180, fill=(80, 80, 85), width=p(1.5))
    d.line((mx, gy + p(7), mx, gy + p(11)), fill=(80, 80, 85), width=p(1.5))
    return np.asarray(im).astype(np.float32)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def screen_canvas(f):
    a = 1.0 if f >= SEND else 0.0                      # Ready -> Approved (hard UI update)
    s = ease((f - KB_START) / float(KB_END - KB_START))  # keyboard gone
    img = img1 * (1 - a) + img2 * a
    off = OFF_TYPE + (INS_FINAL - OFF_TYPE) * s
    cv_ = background(img)
    # extra screen height is split: part under the header, part above the bottom
    # (approve bubble / input bar). Gaps are filled by repeating a blank image row.
    off2 = off + GAP2 * s
    y1 = int(round(HEAD + off))
    y2 = int(round(SPLIT + off2))
    gap_top = np.repeat(img[HEAD + 6:HEAD + 7], max(y1 - HEAD, 0) + 2, 0)
    paste(cv_, gap_top, HEAD)
    paste(cv_, img[HEAD:SPLIT], y1)
    gap_mid = np.repeat(img[SPLIT:SPLIT + 1], max(y2 - (SPLIT + int(round(off))), 0) + 2, 0)
    paste(cv_, gap_mid, SPLIT + int(round(off)))
    paste(cv_, img[SPLIT:], y2)
    # header on top, soft bottom edge so content slides under it
    hdr = img[:HEAD + 24]
    al = np.ones((hdr.shape[0], 1, 1), np.float32)
    al[HEAD - 8:] = np.linspace(1, 0, hdr.shape[0] - (HEAD - 8))[:, None, None]
    bgh = background(img)[:hdr.shape[0]]
    hdr_full = hdr.copy()
    hdr_full[HEAD:] = bgh[HEAD:]  # rows under the header line are background
    paste(cv_, hdr_full, 0, al)
    # typing pill + keyboard
    if s < 1:
        n = sum(f >= t for t in TYPED_AT)
        text = WORD[:n] if f < SEND else ''
        cursor = f < SEND and (f // 6) % 2 == 0 or (f < SEND and n > 0)
        strip = typing_strip(text, cursor, img)
        # blank rows below the pill down to the keyboard top (hides the image's own pill)
        blank = np.repeat(img[STRIP[1] - 2:STRIP[1] - 1], H, 0)
        strip = np.concatenate([strip, blank], 0)
        sh = STRIP[1] - STRIP[0]
        ytype = KT - sh
        yfin = STRIP[0] + INS_FINAL + GAP2
        ys = int(round(ytype + (yfin - ytype) * s))
        paste(cv_, strip, ys)
        if f >= SEND:
            # sent bubble + scroll button ride just above the input pill, fading in
            ov = img[SPLIT:STRIP[0]]
            ref = img[SPLIT:SPLIT + 1]
            m = (np.abs(ov - ref).max(2) > 6).astype(np.uint8)
            m = cv2.dilate(m, np.ones((15, 15), np.uint8)).astype(np.float32)
            m = cv2.GaussianBlur(m, (0, 0), 4)[..., None] * ease((s - 0.35) / 0.4)
            paste(cv_, ov, ys - (STRIP[0] - SPLIT), m)
        kb = keyboard(text, shift=(len(text) == 0))
        paste(cv_, kb, int(round(KT + (H - KT) * s)))
    return np.clip(cv_, 0, 255)


# ---------------------------------------------------------------- compositing
quads = {int(k): np.array(v) for k, v in json.load(open('quads_raw.json')).items()}
# light temporal smoothing of the corners (3-tap)
sm = {}
for i in range(F0, F1 + 1):
    nb = [quads[j] for j in (i - 1, i, i + 1) if j in quads]
    w = [1, 2, 1][:len(nb)] if len(nb) == 3 else [1] * len(nb)
    sm[i] = sum(q * ww for q, ww in zip(nb, w)) / sum(w)

DS = 2  # canvas downscale before warp (anti-aliasing)
cw, ch = W // DS, H // DS
src_pts = np.float32([[0, 0], [cw, 0], [cw, ch], [0, ch]])

# rounded-corner screen alpha in canvas space
corner = np.zeros((ch, cw), np.uint8)
R = int(55 * PT / DS)
cv2.rectangle(corner, (R, 0), (cw - R, ch), 255, -1)
cv2.rectangle(corner, (0, R), (cw, ch - R), 255, -1)
for cx, cy in [(R, R), (cw - R, R), (R, ch - R), (cw - R, ch - R)]:
    cv2.circle(corner, (cx, cy), R, 255, -1, cv2.LINE_AA)
corner = corner.astype(np.float32) / 255

# zones (canvas fraction) where original very dark pixels (dynamic island, home bar) are kept
keep_zone = np.zeros((ch, cw), np.float32)
keep_zone[:int(0.075 * ch), int(0.30 * cw):int(0.75 * cw)] = 1
keep_zone[int(0.965 * ch):, int(0.30 * cw):int(0.70 * cw)] = 1

# lighting: plane fit of original screen background brightness in final frames
def fit_light():
    us, vs, vals = [], [], []
    for i in range(92, F1 + 1, 3):
        fr = cv2.cvtColor(cv2.imread('frames/%04d.png' % i), cv2.COLOR_BGR2RGB).astype(np.float32)
        Hm = cv2.getPerspectiveTransform(src_pts, np.float32(sm[i]))
        Hinv = np.linalg.inv(Hm)
        back = cv2.warpPerspective(fr, Hinv, (cw, ch), flags=cv2.INTER_LINEAR)
        hsv = cv2.cvtColor(np.clip(back, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
        loc = cv2.blur(back.mean(2), (9, 9))
        var = cv2.blur((back.mean(2) - loc) ** 2, (9, 9))
        m = (hsv[..., 1] < 30) & (back.mean(2) > 120) & (var < 6) & (corner > 0.99)
        m[:int(0.1 * ch)] = False
        yy, xx = np.nonzero(m)
        sel = np.random.default_rng(i).choice(len(yy), min(4000, len(yy)), replace=False)
        us.append(xx[sel] / cw); vs.append(yy[sel] / ch); vals.append(back[yy[sel], xx[sel]])
    u, v, val = np.concatenate(us), np.concatenate(vs), np.concatenate(vals)
    A = np.stack([np.ones_like(u), u, v, u * v, v * v], 1)
    coef = np.linalg.lstsq(A, val, rcond=None)[0]
    return coef

coef = fit_light()
uu, vv = np.meshgrid(np.linspace(0, 1, cw), np.linspace(0, 1, ch))
Abig = np.stack([np.ones_like(uu), uu, vv, uu * vv, vv * vv], -1)
light = np.clip(Abig @ coef, 0, 255).astype(np.float32)   # expected colour of "white" (bg ~248)
LIFT = 10.0
print('light coef', coef.round(1).tolist())


def skin_mask(fr_bgr, quad):
    hsv = cv2.cvtColor(fr_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hue_ok = ((h <= 25) | (h >= 170)).astype(np.float32)
    soft = hue_ok * np.clip((s - 38) / 30, 0, 1) * np.clip((v - 55) / 25, 0, 1) * np.clip((175 - s) / 20, 0, 1)
    binm = (soft > 0.5).astype(np.uint8)
    binm = cv2.morphologyEx(binm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab = cv2.connectedComponents(binm, connectivity=8)
    inside = np.zeros(binm.shape, np.uint8)
    cv2.fillConvexPoly(inside, np.round(quad).astype(np.int32), 1)
    outside_ring = (cv2.dilate(inside, np.ones((25, 25), np.uint8)) - cv2.erode(inside, np.ones((3, 3), np.uint8))) > 0
    outside_ring &= inside == 0
    keep_labels = np.unique(lab[outside_ring & (binm > 0)])
    keep_labels = keep_labels[keep_labels > 0]
    comp = np.isin(lab, keep_labels).astype(np.uint8)
    comp = cv2.dilate(comp, np.ones((5, 5), np.uint8))
    m = np.maximum(soft, 0) * comp
    # fill holes inside the thumb (specular highlights / low-sat patches)
    filled = cv2.morphologyEx((m > 0.35).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    m = np.maximum(m, filled.astype(np.float32) * 0.999)
    m = cv2.GaussianBlur(m, (0, 0), 1.2)
    return np.clip(m, 0, 1)


def composite(i, debug=False):
    fr_bgr = cv2.imread('frames/%04d.png' % i)
    fr = cv2.cvtColor(fr_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    canvas = screen_canvas(i)
    small = cv2.resize(canvas, (cw, ch), interpolation=cv2.INTER_AREA)
    # map clean colours into the shot's lighting (white -> fitted screen white, black -> lift)
    lit = LIFT + (light - LIFT) * (small / 248.0)
    q = np.float32(sm[i])
    Hm = cv2.getPerspectiveTransform(src_pts, q)
    hh, ww = fr.shape[:2]
    # supersample warp: warp at 2x then downscale
    S2 = 2
    Hs = np.diag([S2, S2, 1]) @ Hm
    warped = cv2.warpPerspective(lit, Hs, (ww * S2, hh * S2), flags=cv2.INTER_LINEAR)
    warped = cv2.resize(warped, (ww, hh), interpolation=cv2.INTER_AREA)
    alpha = cv2.warpPerspective(corner, Hs, (ww * S2, hh * S2), flags=cv2.INTER_LINEAR)
    alpha = cv2.resize(alpha, (ww, hh), interpolation=cv2.INTER_AREA)
    kz = cv2.warpPerspective(keep_zone, Hm, (ww, hh), flags=cv2.INTER_LINEAR)
    # match the camera's softness
    warped = cv2.GaussianBlur(warped, (0, 0), 0.75)
    # keep physical dark features (island / home bar) from the plate
    gray = fr.mean(2)
    dark_keep = kz * np.clip((80 - gray) / 30, 0, 1)
    dark_keep = cv2.GaussianBlur(dark_keep, (0, 0), 0.8)
    sk = skin_mask(fr_bgr, q)
    a = alpha * (1 - np.maximum(sk, dark_keep))
    out = fr * (1 - a[..., None]) + warped * a[..., None]
    # light grain to sit in the compressed plate
    rng = np.random.default_rng(i)
    out = out + rng.normal(0, 1.2, out.shape).astype(np.float32) * a[..., None]
    out = np.clip(out, 0, 255).astype(np.uint8)
    if debug:
        return out, canvas, sk
    return out


if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        for i in [int(x) for x in sys.argv[2:]]:
            out, canvas, sk = composite(i, True)
            cv2.imwrite('test_%03d.jpg' % i, cv2.cvtColor(out, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 92])
            cv2.imwrite('canvas_%03d.jpg' % i, cv2.cvtColor(cv2.resize(canvas, (W // 3, H // 3)).astype(np.uint8), cv2.COLOR_RGB2BGR))
            cv2.imwrite('skin_%03d.png' % i, (sk * 255).astype(np.uint8))
        sys.exit()
    for i in range(1, 122):
        if F0 <= i <= F1:
            out = composite(i)
            cv2.imwrite('out/%04d.png' % i, cv2.cvtColor(out, cv2.COLOR_RGB2BGR))
        else:
            cv2.imwrite('out/%04d.png' % i, cv2.imread('frames/%04d.png' % i))
    print('done')
