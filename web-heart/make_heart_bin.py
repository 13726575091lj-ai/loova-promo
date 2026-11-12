"""Inflated heart (same recipe as heart/make_heart.py, lower res) -> heart.bin
Layout: uint32 nv, uint32 nf, float32[6] bbox(min xyz, max xyz), uint16 pos[nv*3] (quantised to bbox), uint16 idx[nf*3].
Axes for three.js: x right, y up (tip at y=0), z toward the viewer."""
import struct, numpy as np
from scipy import ndimage
from skimage import measure
from matplotlib.path import Path
N, ext = 170, 1.35
xs = np.linspace(-ext, ext, N); X, Z = np.meshgrid(xs, xs)
t = np.linspace(0, 2 * np.pi, 3000)
hx = 16 * np.sin(t) ** 3 * 1.1 / 16
hz = (13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)) * 1.1 / 16 + 0.05
inside = Path(np.c_[hx, hz]).contains_points(np.c_[X.ravel(), Z.ravel()]).reshape(N, N)
px = xs[1] - xs[0]
d = ndimage.gaussian_filter(ndimage.distance_transform_edt(inside) * px, 1.0)
R = 0.42
T = 0.36 * np.sqrt(np.clip(1 - (1 - np.minimum(d, R) / R) ** 2, 0, 1)) + 0.10 * np.sqrt(np.clip(d / d.max(), 0, 1))
T[~inside] = 0
ny = 44; ys = np.linspace(-0.55, 0.55, ny)
F = ndimage.gaussian_filter(np.abs(ys)[None, None, :] - T[:, :, None], 0.8)
v, f, _, _ = measure.marching_cubes(F, 0.0, spacing=(px, px, ys[1] - ys[0]))
vz, vx, vy = v[:, 0] - ext, v[:, 1] - ext, v[:, 2] - 0.55
P = np.c_[vx, vz - vz.min(), -vy].astype(np.float32)        # (x, up, toward viewer)
faces = f[:, [0, 2, 1]].astype(np.uint16)
assert len(P) < 65536
lo, hi = P.min(0), P.max(0)
q = np.round((P - lo) / (hi - lo) * 65535).astype(np.uint16)
with open('heart.bin', 'wb') as fh:
    fh.write(struct.pack('<II6f', len(P), len(faces), *lo, *hi)); fh.write(q.tobytes()); fh.write(faces.tobytes())
print(len(P), len(faces), hi - lo)
