"""Contact sheet of rendered stills:  python tools/contact.py build/stills build/qc/sheet.jpg [cols] [thumb_w]"""
import os
import sys

from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 480
files = sorted(f for f in os.listdir(src) if f.endswith((".jpg", ".png")))
th = tw * 9 // 16
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * (th + 18)), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(src, f)).convert("RGB").resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 18)
    sheet.paste(im, (x, y + 18))
    d.text((x + 4, y + 3), f, fill=(255, 255, 0))
sheet.save(dst, quality=88)
print(dst, sheet.size)
