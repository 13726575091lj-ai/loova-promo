"""blender -b work/scene.blend -P blender/render.py -- --frames 0,48 --pct 50 --samples 32 --out out/test"""
import bpy, sys, os, time, argparse
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--frames', default='0')
ap.add_argument('--range', default=None)
ap.add_argument('--pct', type=int, default=100)
ap.add_argument('--samples', type=int, default=0)
ap.add_argument('--out', default='out/frames')
ap.add_argument('--nomb', action='store_true')
ap.add_argument('--skip', action='store_true')
a = ap.parse_args(argv)
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sc = bpy.context.scene
sc.render.resolution_percentage = a.pct
sc.render.threads_mode = 'AUTO'
if a.samples:
    sc.cycles.samples = a.samples
if a.nomb:
    sc.render.use_motion_blur = False
frames = list(range(int(a.range.split(':')[0]), int(a.range.split(':')[1]) + 1)) if a.range else [int(x) for x in a.frames.split(',')]
od = a.out if a.out.startswith('/') else f'{HERE}/{a.out}'
os.makedirs(od, exist_ok=True)
for f in frames:
    path = f'{od}/{f:04d}.png'
    if a.skip and os.path.exists(path):
        continue
    t0 = time.time()
    sc.frame_set(f)
    sc.render.filepath = path + '.tmp.png'
    bpy.ops.render.render(write_still=True)
    os.replace(path + '.tmp.png', path)
    print(f'FRAME {f} {time.time() - t0:.1f}s', flush=True)
