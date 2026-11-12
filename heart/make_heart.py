"""Inflated 3D heart mesh (marching cubes over an inflation field) -> assets/heart.obj
Units: heart ~2.2 wide. Front faces -Y (toward camera), up +Z. Origin at the bottom tip."""
import numpy as np
from scipy import ndimage
from skimage import measure

N = 420                      # 2D raster
ext = 1.35                   # half-extent of the raster in heart units
xs = np.linspace(-ext, ext, N)
X, Z = np.meshgrid(xs, xs)
# parametric heart outline (classic), scaled to ~2.2 wide
t = np.linspace(0, 2 * np.pi, 4000)
hx = 16 * np.sin(t) ** 3
hz = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
s = 1.1 / 16.0
hx, hz = hx * s, hz * s + 0.05
from matplotlib.path import Path
inside = Path(np.c_[hx, hz]).contains_points(np.c_[X.ravel(), Z.ravel()]).reshape(N, N)
px = xs[1] - xs[0]
d = ndimage.distance_transform_edt(inside) * px            # distance to edge (inside)
d = ndimage.gaussian_filter(d, 1.2)
R = 0.42                                                   # rounding radius of the pillow edge
T = 0.36 * np.sqrt(np.clip(1 - (1 - np.minimum(d, R) / R) ** 2, 0, 1)) + 0.10 * np.sqrt(np.clip(d / d.max(), 0, 1))
T[~inside] = 0
# 3D field: f = |y| - T(x,z)  (negative inside)
ny = 90
ys = np.linspace(-0.55, 0.55, ny)
step = 2                                                   # downsample 2D for the volume
Ts = T[::step, ::step]
F = np.abs(ys)[None, None, :] - Ts[:, :, None]            # (z, x, y)
F = ndimage.gaussian_filter(F, 0.8)
verts, faces, normals, _ = measure.marching_cubes(F, 0.0, spacing=(px * step, px * step, ys[1] - ys[0]))
vz = verts[:, 0] - ext; vx = verts[:, 1] - ext; vy = verts[:, 2] - 0.55
zmin = vz.min()
V = np.c_[vx, vy, vz - zmin]
with open('assets/heart.obj', 'w') as f:
    for v in V: f.write(f'v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n')
    for fc in faces: f.write(f'f {fc[0]+1} {fc[2]+1} {fc[1]+1}\n')
print('verts', len(V), 'faces', len(faces), 'size', V.max(0) - V.min(0))
