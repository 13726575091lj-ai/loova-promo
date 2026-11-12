"""B2 heart ident — 'a tear, softly landed'.  Builds the whole Cycles scene and saves work/scene.blend.
blender -b --factory-startup -P blender/scene.py
Everything is a pure function of time: the heart / tear / beads / camera are keyed from closed-form motion every half
frame (so Cycles motion blur sees real paths); the capsule field is Geometry Nodes driven by Scene Time.
Palette from the B2 site: cream #F0EEDF, orange #ED662E, cobalt #3154E8."""
import bpy, bmesh, math, os, json, sys
import numpy as np
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS, NF = 24, 240
C = dict(
    LAND1=0.55, LAND2=1.05, BEATS=[(2.05, 0.06), (2.32, 0.045), (3.30, 0.06), (3.57, 0.045)],
    TEAR0=3.95, TEAR1=4.65, SLIDE=(4.7, 5.85), STRETCH=(5.35, 6.0), DETACH=6.0,
    SIGH=7.15, HOLD=8.85,
)
HX = -0.25            # heart tip x
BED = 0.36            # pill top height
REST = BED - 0.08     # heart tip resting height (sinks into the capsules)
TILT = math.radians(-13)
G = 8.6               # stylised gravity (slightly floaty)


def hexcol(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], a)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def long_tail(u, p=7):          # ~80 % of the travel in the first 20 %
    u = clamp(u)
    return 1 - (1 - u) ** p


def smooth(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def out_back(u, s=1.9):
    u = clamp(u) - 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


def pulse(t, t0, w=0.07):       # fast attack, soft decay
    u = (t - t0) / w
    return 0.0 if u <= 0 else u * math.exp(1 - u)


# ================================================================== motion (closed form)
def heart_state(t):
    """tip position z, scale (sx, sz), extra roll."""
    L1, L2 = C['LAND1'], C['LAND2']
    hop_h, hop0 = 0.24, L1 + 0.09
    if t < L1:
        z = REST + 0.5 * G * (L1 - t) ** 2
        v = G * (L1 - t)
        stretch = min(0.16, 0.022 * v)          # stretches along the fall
        sz, sx = 1 + stretch, 1 / math.sqrt(1 + stretch)
        return z, sx, sz, 0.0
    z = REST
    if hop0 <= t < L2:
        u = (t - hop0) / (L2 - hop0)
        z += 4 * hop_h * u * (1 - u)
    sq = 0.0
    tau1 = t - L1
    sq += 0.30 * math.exp(-tau1 * 9) * math.cos(tau1 * 24) if tau1 < 0.6 else 0
    if t >= L2:
        tau2 = t - L2
        sq += 0.13 * math.exp(-tau2 * 8) * math.cos(tau2 * 26)
    # heartbeat, sob (tear forming), sigh after the tear lands, and the end breath
    beat = sum(a * pulse(t, tb) for tb, a in C['BEATS'])
    sob = -0.035 * smooth(seg(t, C['TEAR0'] - 0.1, C['TEAR0'] + 0.25)) * (1 - smooth(seg(t, C['TEAR1'], C['TEAR1'] + 0.4)))
    sigh = 0.05 * pulse(t, C['SIGH'], 0.12)
    breath = 0.012 * math.sin(2 * math.pi * (t - 7.6) / 2.6) * smooth(seg(t, 7.6, 8.4))
    sz = 1 - sq + sob + beat * 0.8 + sigh + breath
    sx = 1 + sq * 0.55 - sob * 0.4 + beat + sigh * 0.7 + breath
    roll = 0.10 * math.exp(-max(0, tau1) * 3.5) * math.sin(max(0, tau1) * 9.5)
    return z, sx, sz, roll


def heart_matrix(t):
    z, sx, sz, roll = heart_state(t)
    return Matrix.Translation((HX, 0, z)) @ Matrix.Rotation(TILT + roll, 4, 'Y') @ Matrix.Diagonal((sx, sx, sz, 1))


# heart outline (same curve as make_heart.py), local coords with the tip at z = 0
_tt = np.linspace(0, 2 * np.pi, 4000)
_hx = 16 * np.sin(_tt) ** 3 * (1.1 / 16)
_hz = (13 * np.cos(_tt) - 5 * np.cos(2 * _tt) - 2 * np.cos(3 * _tt) - np.cos(4 * _tt)) * (1.1 / 16)
_hz -= _hz.min()


def edge_x(z):
    # right edge of the lower right side (between the widest point and the tip)
    m = (_hx > 0) & (_tt > np.pi / 2) & (_tt <= np.pi)
    zs, xs = _hz[m], _hx[m]
    o = np.argsort(zs)
    return float(np.interp(z, zs[o], xs[o]))


ATTACH0 = Vector((edge_x(1.52) - 0.10, -0.16, 1.52))   # on the right lobe, a little in front
ATTACH1 = Vector((edge_x(1.22) - 0.07, -0.16, 1.22))
TEAR_H = 0.52                            # tear height (tip to bottom) at scale 1


def tear_state(t):
    """world position of the tear tip, scale (sxy, sz), visible."""
    if t < C['TEAR0']:
        return None
    s = out_back(seg(t, C['TEAR0'], C['TEAR1']), 2.2)
    jig = 0.08 * math.exp(-max(0, t - C['TEAR1']) * 5) * math.sin(max(0, t - C['TEAR1']) * 22)
    u = smooth(seg(t, *C['SLIDE']))
    local = ATTACH0.lerp(ATTACH1, u)
    st = smooth(seg(t, *C['STRETCH']))
    sz = s * (1 + 0.30 * st + jig)
    sxy = s * (1 - 0.10 * st - jig * 0.5)
    if t < C['DETACH']:
        p = heart_matrix(t) @ local
        return p, sxy, sz, 0.0
    # free fall from the detach point; springs back to round while falling
    p0 = heart_matrix(C['DETACH']) @ ATTACH1
    dt = t - C['DETACH']
    p = p0 - Vector((0, 0, 0.5 * G * dt * dt)) + Vector((0.05 * dt, -0.02 * dt, 0))
    rel = 1 - math.exp(-dt * 9)
    sz = 1.30 + (1.05 - 1.30) * rel + 0.06 * math.exp(-dt * 6) * math.sin(dt * 30)
    sxy = 0.90 + (0.98 - 0.90) * rel
    return p, sxy, sz, dt


def tear_hit_time():
    t = C['DETACH']
    while t < 9:
        p, sxy, sz, _ = tear_state(t)
        if p.z - TEAR_H * sz <= BED + 0.01:
            return t
        t += 1 / 960
    raise RuntimeError('tear never lands')


T_HIT = tear_hit_time()
P_HIT = tear_state(T_HIT)[0]
P_HIT = Vector((P_HIT.x, P_HIT.y, BED))
print('tear hits at', round(T_HIT, 3), tuple(round(v, 3) for v in P_HIT))

# camera: three long-tail moves; target and position keyed together
CAM = [
    (0.00, (-1.6, -5.4, 0.55), (HX + 0.1, 0.0, 0.85)),
    (2.40, (1.4, -10.6, 1.65), (HX + 0.25, 0.0, 1.05)),
    (4.25, (1.6, -10.9, 1.75), (HX + 0.3, 0.0, 1.05)),
    (6.05, (3.0, -7.6, 1.25), (P_HIT.x - 0.1, 0.0, 0.75)),
    (6.55, (3.1, -7.4, 1.20), (P_HIT.x - 0.1, 0.0, 0.70)),
    (8.80, (2.3, -12.8, 2.35), (HX + 0.45, 0.0, 0.95)),
    (10.0, (2.25, -12.9, 2.38), (HX + 0.45, 0.0, 0.95)),
]


def cam_state(t):
    for (ta, pa, qa), (tb, pb, qb) in zip(CAM, CAM[1:]):
        if t <= tb:
            u = (t - ta) / (tb - ta)
            e = long_tail(u, 6) if ta in (0.0, 6.55) else (smooth(u) * 0.35 + long_tail(u, 4) * 0.65)
            if ta in (2.40, 4.25):
                e = smooth(u)
            P = Vector(pa).lerp(Vector(pb), e)
            Q = Vector(qa).lerp(Vector(qb), e)
            return P, Q
    return Vector(CAM[-1][1]), Vector(CAM[-1][2])


def focus_point(t):
    h = heart_matrix(t) @ Vector((0.0, -0.25, 0.95))
    ts = tear_state(t)
    if ts is None:
        return h
    k = smooth(seg(t, 4.3, 5.4)) * (1 - smooth(seg(t, 7.0, 8.6)))
    tp = ts[0] if t < T_HIT else P_HIT + Vector((0, 0, 0.1))
    return h.lerp(tp, k)


# splash beads
rs = np.random.default_rng(7)
BEADS = []
for i in range(11):
    a = 2 * math.pi * i / 11 + rs.uniform(-0.25, 0.25)
    BEADS.append(dict(dir=(math.cos(a), math.sin(a) * 0.8), vh=rs.uniform(0.55, 1.15), vz=rs.uniform(1.4, 2.3),
                      r=rs.uniform(0.028, 0.055), delay=rs.uniform(0.0, 0.04)))


def bead_state(b, t):
    dt = t - T_HIT - b['delay']
    if dt <= 0:
        return None
    z = BED + 0.04 + b['vz'] * dt - 0.5 * G * dt * dt
    if z < BED - 0.02:
        return None
    x = P_HIT.x + b['dir'][0] * b['vh'] * dt
    y = P_HIT.y + b['dir'][1] * b['vh'] * dt
    return Vector((x, y, z)), b['r'] * min(1, dt / 0.04)


# events for the soundtrack
bead_lands = []
for b in BEADS:
    tt = T_HIT + b['delay'] + 0.02
    while bead_state(b, tt) is not None:
        tt += 1 / 480
    bead_lands.append(round(tt, 4))
EVENTS = dict(fps=FPS, land1=C['LAND1'], land2=C['LAND2'], beats=[b[0] for b in C['BEATS']], tear_born=C['TEAR0'],
              tear_full=C['TEAR1'], detach=C['DETACH'], tear_hit=T_HIT, sigh=C['SIGH'], hold=C['HOLD'], bead_lands=sorted(bead_lands),
              cam_moves=[[0.0, 2.4], [4.25, 6.05], [6.55, 8.8]])
os.makedirs(f'{HERE}/out', exist_ok=True)
json.dump(EVENTS, open(f'{HERE}/out/events.json', 'w'), indent=1)

# ================================================================== scene
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 0, NF - 1
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = 64
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.03
cy.adaptive_min_samples = 16
cy.use_denoising = True
cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 8; cy.diffuse_bounces = 2; cy.glossy_bounces = 3; cy.transmission_bounces = 6
cy.transparent_max_bounces = 4; cy.volume_bounces = 0
cy.caustics_reflective = False; cy.caustics_refractive = False
cy.blur_glossy = 1.0
cy.sample_clamp_indirect = 5.0
sc.render.use_persistent_data = True
sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.dither_intensity = 1.0
sc.view_settings.view_transform = 'Khronos PBR Neutral'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -0.35

# world: HDRI for light + reflections, cream for camera rays
world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
wt = world.node_tree
for n in list(wt.nodes):
    wt.nodes.remove(n)
tex = wt.nodes.new('ShaderNodeTexEnvironment'); tex.image = bpy.data.images.load(f'{HERE}/assets/studio_small_09_2k.hdr')
mp = wt.nodes.new('ShaderNodeMapping'); tc = wt.nodes.new('ShaderNodeTexCoord')
mp.inputs['Rotation'].default_value[2] = math.radians(150)
wt.links.new(tc.outputs['Generated'], mp.inputs['Vector']); wt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
bgl = wt.nodes.new('ShaderNodeBackground'); bgl.inputs['Strength'].default_value = 0.55
wt.links.new(tex.outputs['Color'], bgl.inputs['Color'])
bgc = wt.nodes.new('ShaderNodeBackground'); bgc.inputs['Color'].default_value = hexcol('#F0EEDF'); bgc.inputs['Strength'].default_value = 1.0
lp = wt.nodes.new('ShaderNodeLightPath'); mx = wt.nodes.new('ShaderNodeMixShader')
wt.links.new(lp.outputs['Is Camera Ray'], mx.inputs[0]); wt.links.new(bgl.outputs[0], mx.inputs[1]); wt.links.new(bgc.outputs[0], mx.inputs[2])
wo = wt.nodes.new('ShaderNodeOutputWorld'); wt.links.new(mx.outputs[0], wo.inputs['Surface'])


def principled(name, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m, b, nt


# heart: SSS orange gummy with a glossy candy coat
m_heart, b, nt = principled('heart', **{'Base Color': hexcol('#E0480F'), 'Subsurface Weight': 0.35, 'Subsurface Radius': (1.0, 0.28, 0.08),
                                        'Subsurface Scale': 0.12, 'Roughness': 0.30, 'Coat Weight': 0.8, 'Coat Roughness': 0.06,
                                        'Coat IOR': 1.5, 'Specular IOR Level': 0.5})
# tear: cobalt glass with a deep absorbing core
m_tear, b, nt = principled('tear', **{'Base Color': hexcol('#9DB0FF'), 'Transmission Weight': 1.0, 'IOR': 1.38, 'Roughness': 0.025,
                                      'Coat Weight': 0.5, 'Coat Roughness': 0.02})
vol = nt.nodes.new('ShaderNodeVolumeAbsorption'); vol.inputs['Color'].default_value = hexcol('#3154E8'); vol.inputs['Density'].default_value = 6.0
nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
# floor + cyc
m_cyc, b, nt = principled('cyc', **{'Base Color': hexcol('#F3EEE0'), 'Roughness': 0.9, 'Specular IOR Level': 0.2,
                                    'Emission Color': hexcol('#F0EEDF'), 'Emission Strength': 0.35})
# capsules: cream/pastel candy plastic; 'fx' (tear pool) tints them cobalt, 'kind' picks pastel accents
m_pill, b, nt = principled('pill', **{'Roughness': 0.26, 'Coat Weight': 0.7, 'Coat Roughness': 0.05, 'Specular IOR Level': 0.5,
                                      'Subsurface Weight': 0.12, 'Subsurface Radius': (1.0, 0.8, 0.6), 'Subsurface Scale': 0.05})
af = nt.nodes.new('ShaderNodeAttribute'); af.attribute_type = 'INSTANCER'; af.attribute_name = 'fx'
ak = nt.nodes.new('ShaderNodeAttribute'); ak.attribute_type = 'INSTANCER'; ak.attribute_name = 'kind'
ramp = nt.nodes.new('ShaderNodeValToRGB')
cr = ramp.color_ramp; cr.interpolation = 'CONSTANT'
cr.elements[0].position = 0.0; cr.elements[0].color = hexcol('#F4EEE1')
cr.elements[1].position = 0.975; cr.elements[1].color = hexcol('#F2B48C')
nt.links.new(ak.outputs['Fac'], ramp.inputs['Fac'])
mixc = nt.nodes.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.inputs['B'].default_value = hexcol('#2242D6')
nt.links.new(ramp.outputs['Color'], mixc.inputs['A']); nt.links.new(af.outputs['Fac'], mixc.inputs['Factor'])
nt.links.new(mixc.outputs['Result'], b.inputs['Base Color'])

# heart mesh
bpy.ops.wm.obj_import(filepath=f'{HERE}/assets/heart.obj', forward_axis='Y', up_axis='Z')
heart = bpy.context.selected_objects[0]; heart.name = 'heart'
me = heart.data
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(me); bm.free()
for p in me.polygons:
    p.use_smooth = True
me.materials.append(m_heart)
heart.rotation_mode = 'XYZ'

# tear mesh: surface of revolution, pointed tip at the origin, body hanging down -Z
def tear_mesh(name, h=TEAR_H, nr=64, nv=48):
    verts, faces = [], []
    for i in range(nv + 1):
        th = math.pi * i / nv                      # 0 = tip, pi = bottom
        r = 0.36 * h * math.sin(th) * math.sin(th / 2) ** 1.25
        z = -h * (1 - math.cos(th)) / 2
        for j in range(nr):
            a = 2 * math.pi * j / nr
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(nv):
        for j in range(nr):
            a, bq = i * nr + j, i * nr + (j + 1) % nr
            faces.append((a, bq, bq + nr, a + nr))
    m = bpy.data.meshes.new(name); m.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(m); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(m); bm.free()
    for p in m.polygons:
        p.use_smooth = True
    m.materials.append(m_tear)
    return m


tear = bpy.data.objects.new('tear', tear_mesh('tear')); sc.collection.objects.link(tear)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0)
bead_src = bpy.context.active_object; bead_src.name = 'bead_src'
for p in bead_src.data.polygons:
    p.use_smooth = True
bead_src.data.materials.append(m_tear)
beads = []
for i, bd in enumerate(BEADS):
    o = bpy.data.objects.new(f'bead{i}', bead_src.data); sc.collection.objects.link(o); beads.append(o)
bpy.data.objects.remove(bead_src)

# cyc: floor + curve + wall (seamless)
def cyc():
    prof = [(y, 0.0) for y in np.linspace(-30, 9, 40)]
    R = 6.0
    for k in range(1, 25):
        a = math.pi / 2 * k / 24
        prof.append((9 + R * math.sin(a), R * (1 - math.cos(a))))
    prof += [(9 + R, z) for z in np.linspace(R + 1, 30, 10)]
    xs = [-40, 40]
    verts = [(x, y, z) for (y, z) in prof for x in xs]
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(len(prof) - 1)]
    m = bpy.data.meshes.new('cyc'); m.from_pydata(verts, [], faces)
    for p in m.polygons:
        p.use_smooth = True
    m.materials.append(m_cyc)
    o = bpy.data.objects.new('cyc', m); sc.collection.objects.link(o)
    return o


cyc()

# capsule prototype (hidden, used by the instancer)
PR, PH = 0.098, 0.36
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=PR)
cap = bpy.context.active_object; cap.name = 'capsule'
bm = bmesh.new(); bm.from_mesh(cap.data)
for v in bm.verts:
    v.co.z = v.co.z + (PH - 2 * PR) if v.co.z > 0 else v.co.z
    v.co.z += PR
bm.to_mesh(cap.data); bm.free()
for p in cap.data.polygons:
    p.use_smooth = True
cap.data.materials.append(m_pill)
cap.hide_render = True; cap.hide_viewport = True
cap.location = (0, 0, -50)

# ================================================================== capsule field (Geometry Nodes, closed form in Scene Time)
field = bpy.data.objects.new('field', bpy.data.meshes.new('field_base')); sc.collection.objects.link(field)
ng = bpy.data.node_groups.new('CapsuleField', 'GeometryNodeTree')
ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
N_ = ng.nodes; L_ = ng.links
gin = N_.new('NodeGroupInput'); gout = N_.new('NodeGroupOutput')


def node(kind, **inputs):
    n = N_.new(kind)
    for k, v in inputs.items():
        if isinstance(v, bpy.types.NodeSocket):
            L_.new(v, n.inputs[k])
        else:
            n.inputs[k].default_value = v
    return n


def M(op, a, b=None, c=None):
    n = N_.new('ShaderNodeMath'); n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, bpy.types.NodeSocket):
            L_.new(v, n.inputs[i])
        else:
            n.inputs[i].default_value = float(v)
    return n.outputs[0]


add = lambda a, b: M('ADD', a, b)
mul = lambda a, b: M('MULTIPLY', a, b)
sub = lambda a, b: M('SUBTRACT', a, b)
def gauss(x, w):                       # exp(-(x/w)^2)
    q = mul(x, 1.0 / w)
    return M('EXPONENT', M('MULTIPLY', mul(q, q), -1.0))


PITCH = 0.25
ROWH = PITCH * math.sqrt(3) / 2
XW, Y0, Y1 = 16.0, -7.0, 8.2
nx = int(XW / PITCH); ny = int((Y1 - Y0) / (2 * ROWH))
grids = []
for k in range(2):
    g = node('GeometryNodeMeshGrid', **{'Size X': nx * PITCH, 'Size Y': ny * 2 * ROWH, 'Vertices X': nx + 1, 'Vertices Y': ny + 1})
    tr = N_.new('GeometryNodeTransform')
    L_.new(g.outputs['Mesh'], tr.inputs['Geometry'])
    tr.inputs['Translation'].default_value = (k * PITCH / 2, (Y0 + Y1) / 2 + k * ROWH, 0)
    grids.append(tr.outputs['Geometry'])
join = N_.new('GeometryNodeJoinGeometry')
for gsock in reversed(grids):
    L_.new(gsock, join.inputs[0])
pts = node('GeometryNodeMeshToPoints'); L_.new(join.outputs[0], pts.inputs['Mesh'])
# jitter rest positions slightly (hand-placed, not a CAD grid)
rj = N_.new('FunctionNodeRandomValue'); rj.data_type = 'FLOAT_VECTOR'
rj.inputs['Min'].default_value = (-0.012, -0.012, 0); rj.inputs['Max'].default_value = (0.012, 0.012, 0); rj.inputs['Seed'].default_value = 3
sp0 = node('GeometryNodeSetPosition'); L_.new(pts.outputs[0], sp0.inputs['Geometry']); L_.new(rj.outputs['Value'], sp0.inputs['Offset'])

pos = N_.new('GeometryNodeInputPosition')
sep = N_.new('ShaderNodeSeparateXYZ'); L_.new(pos.outputs[0], sep.inputs[0])
X_, Y_ = sep.outputs['X'], sep.outputs['Y']
tm = N_.new('GeometryNodeInputSceneTime')
T_ = tm.outputs['Seconds']

# ambient effector wave + the opening sweep
amb = add(mul(M('SINE', add(mul(X_, 1.15), mul(T_, 2.1))), mul(M('SINE', add(mul(Y_, 0.85), mul(T_, 1.5))), 0.026)),
          mul(M('SINE', sub(mul(add(X_, Y_), 0.62), mul(T_, 2.6))), 0.016))
sweep_x = add(-7.5, mul(T_, 11.0))
sweep = mul(mul(gauss(sub(X_, sweep_x), 0.55), 0.085), M('LESS_THAN', T_, 1.25))
zoff = add(amb, sweep)

# impacts: (t0, x, y, amp, speed, decay, width)
heart_tip = Vector((HX, 0, 0))
IMP = [(C['LAND1'], HX, 0.0, 0.17, 3.4, 1.5, 0.38), (C['LAND2'], HX, 0.0, 0.08, 3.4, 2.0, 0.32)]
IMP += [(tb, HX, 0.0, 0.035 * a / 0.06, 3.0, 2.4, 0.28) for tb, a in C['BEATS']]
IMP += [(T_HIT, P_HIT.x, P_HIT.y, 0.13, 2.7, 1.25, 0.30), (C['SIGH'], HX, 0.0, 0.03, 3.0, 2.4, 0.28)]
for (t0, cx, cy_, A, v, dec, w) in IMP:
    dt = M('MAXIMUM', sub(T_, t0), 0.0)
    on = M('GREATER_THAN', T_, t0)
    dx, dy = sub(X_, cx), sub(Y_, cy_)
    r = M('SQRT', add(mul(dx, dx), mul(dy, dy)))
    env = mul(M('EXPONENT', mul(dt, -dec)), on)
    crest = mul(mul(gauss(sub(r, mul(dt, v)), w), env), A)
    dip = mul(mul(gauss(r, 0.45), M('EXPONENT', mul(dt, -7.0))), mul(on, -A * 0.9))
    zoff = add(zoff, add(crest, dip))
# heart footprint: capsules under the heart are pressed down once it rests
rest_k = M('MINIMUM', M('MAXIMUM', mul(sub(T_, C['LAND1']), 6.0), 0.0), 1.0)
fdx, fdy = sub(X_, HX + 0.05), Y_
foot = M('EXPONENT', mul(add(mul(mul(fdx, fdx), 1 / 0.42 ** 2), mul(mul(fdy, fdy), 1 / 0.36 ** 2)), -1.0))
zoff = add(zoff, mul(mul(foot, rest_k), -0.11))
# tear pool: cobalt disc grows from the impact, with a brighter ring at its edge
dtp = M('MAXIMUM', sub(T_, T_HIT), 0.0)
onp = M('GREATER_THAN', T_, T_HIT)
pdx, pdy = sub(X_, P_HIT.x), sub(Y_, P_HIT.y)
rp = M('SQRT', add(mul(pdx, pdx), mul(pdy, pdy)))
Rp = mul(sub(1.0, M('EXPONENT', mul(dtp, -1.5))), 1.75)
fx = mul(M('MINIMUM', M('MAXIMUM', mul(sub(Rp, rp), 1 / 0.32), 0.0), 1.0), onp)
fx = mul(fx, add(0.72, mul(M('EXPONENT', mul(dtp, -1.2)), 0.28)))

cz = N_.new('ShaderNodeCombineXYZ'); L_.new(zoff, cz.inputs['Z'])
sp1 = node('GeometryNodeSetPosition'); L_.new(sp0.outputs[0], sp1.inputs['Geometry']); L_.new(cz.outputs[0], sp1.inputs['Offset'])
st1 = N_.new('GeometryNodeStoreNamedAttribute'); st1.data_type = 'FLOAT'; st1.domain = 'POINT'; st1.inputs['Name'].default_value = 'fx'
L_.new(sp1.outputs[0], st1.inputs['Geometry']); L_.new(fx, st1.inputs['Value'])
rk = N_.new('FunctionNodeRandomValue'); rk.data_type = 'FLOAT'; rk.inputs['Seed'].default_value = 11
st2 = N_.new('GeometryNodeStoreNamedAttribute'); st2.data_type = 'FLOAT'; st2.domain = 'POINT'; st2.inputs['Name'].default_value = 'kind'
L_.new(st1.outputs[0], st2.inputs['Geometry']); L_.new(rk.outputs[1], st2.inputs['Value'])
# scale: crests stretch the capsules a touch (squash & stretch in the crowd)
sc_ = add(1.0, mul(M('MAXIMUM', zoff, -0.05), 1.6))
rr = N_.new('FunctionNodeRandomValue'); rr.data_type = 'FLOAT_VECTOR'; rr.inputs['Seed'].default_value = 5
rr.inputs['Min'].default_value = (-0.07, -0.07, 0); rr.inputs['Max'].default_value = (0.07, 0.07, 6.283)
oi = N_.new('GeometryNodeObjectInfo'); oi.inputs['Object'].default_value = cap; oi.transform_space = 'ORIGINAL'
iop = N_.new('GeometryNodeInstanceOnPoints')
L_.new(st2.outputs[0], iop.inputs['Points']); L_.new(oi.outputs['Geometry'], iop.inputs['Instance'])
L_.new(rr.outputs['Value'], iop.inputs['Rotation'])
csc = N_.new('ShaderNodeCombineXYZ'); csc.inputs['X'].default_value = 1.0; csc.inputs['Y'].default_value = 1.0
L_.new(sc_, csc.inputs['Z']); L_.new(csc.outputs[0], iop.inputs['Scale'])
L_.new(iop.outputs[0], gout.inputs[0])
mod = field.modifiers.new('field', 'NODES'); mod.node_group = ng

# ================================================================== lights
def area(name, loc, target, size, energy, color='#FFFFFF', shape='RECTANGLE', sy=None):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = hexcol(color)[:3]
    ld.shape = shape; ld.size = size; ld.size_y = sy or size
    o = bpy.data.objects.new(name, ld); sc.collection.objects.link(o); o.location = loc
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return o


area('key', (-5.5, -6.5, 7.5), (0, 0, 0.8), 6.0, 2100, '#FFF1E4', sy=4.0)
area('top', (0.5, -1.0, 6.5), (0, 0, 0.8), 3.5, 900, '#FFFFFF')
area('rim', (4.5, 5.0, 3.6), (0, 0, 1.0), 3.0, 1300, '#FFE2CC')
area('fill', (7.0, -8.0, 2.6), (0, 0, 0.8), 7.0, 420, '#E8ECFF')

# ================================================================== camera
camd = bpy.data.cameras.new('cam'); camd.lens = 85; camd.sensor_width = 36
camd.dof.use_dof = True; camd.dof.aperture_fstop = 2.2; camd.dof.aperture_blades = 7
cam = bpy.data.objects.new('cam', camd); sc.collection.objects.link(cam); sc.camera = cam
cam.rotation_mode = 'QUATERNION'

# ================================================================== keyframes (every half frame)
def key_all():
    steps = [k / 2 for k in range(-2, 2 * NF + 3)]
    for f in steps:
        t = f / FPS
        M_ = heart_matrix(t)
        loc, rot, scl = M_.decompose()
        heart.location = loc; heart.rotation_euler = rot.to_euler('XYZ'); heart.scale = scl
        for p in ('location', 'rotation_euler', 'scale'):
            heart.keyframe_insert(p, frame=f)
        ts = tear_state(t)
        if ts is None or t > T_HIT + 0.85:
            tear.location = (P_HIT.x, P_HIT.y, -5) if ts is not None else heart_matrix(t) @ ATTACH0
            tear.scale = (1e-4, 1e-4, 1e-4)
        elif t < T_HIT:
            p, sxy, sz, _ = ts
            tear.location = p; tear.scale = (sxy, sxy, sz)
        else:
            # splat: squash into a puddle on the capsules, wobble, then sink into the field
            u = t - T_HIT
            sq = 1 - math.exp(-u * 18)
            wob = 0.12 * math.exp(-u * 6) * math.sin(u * 28)
            sink = smooth(seg(u, 0.25, 0.85))
            sz = (1.05 + (0.22 - 1.05) * sq + wob) * (1 - sink)
            sxy = (0.98 + (1.95 - 0.98) * sq - wob * 0.6) * (1 - 0.6 * sink)
            tear.location = (P_HIT.x, P_HIT.y, BED - 0.01 + TEAR_H * sz)
            tear.scale = (sxy, sxy, max(sz, 1e-4))
        tear.keyframe_insert('location', frame=f); tear.keyframe_insert('scale', frame=f)
        for o, bd in zip(beads, BEADS):
            s = bead_state(bd, t)
            if s is None:
                o.location = (P_HIT.x, P_HIT.y, -5); o.scale = (1e-4,) * 3
            else:
                o.location = s[0]; o.scale = (s[1],) * 3
            o.keyframe_insert('location', frame=f); o.keyframe_insert('scale', frame=f)
        P, Q = cam_state(t)
        cam.location = P
        cam.rotation_quaternion = (Q - P).to_track_quat('-Z', 'Y')
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_quaternion', frame=f)
        camd.dof.focus_distance = (focus_point(t) - P).length
        camd.dof.keyframe_insert('focus_distance', frame=f)
    for o in [heart, tear, cam, camd] + beads:
        ad = o.animation_data
        if ad and ad.action:
            for fc in ad.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'


key_all()
os.makedirs(f'{HERE}/work', exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=f'{HERE}/work/scene.blend')
print('saved', len(BEADS), 'beads; field', nx, ny)
