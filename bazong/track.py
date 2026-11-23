"""Track the phone screen quad (inner edge of the black bezel) in frames 46..101."""
import cv2, numpy as np, json

F0, F1 = 46, 101
REF = 60
# rough initial quad for frame 60 (TL, TR, BR, BL)
init = np.array([[703, 33], [997, 52], [968, 668], [662, 648]], float)


def load(i):
    return cv2.cvtColor(cv2.imread('frames/%04d.png' % i), cv2.COLOR_BGR2GRAY).astype(np.float32)


def sample(g, pts):
    return cv2.remap(g, pts[..., 0].astype(np.float32), pts[..., 1].astype(np.float32), cv2.INTER_LINEAR)


# which part of each edge to sample (t ranges), avoiding rounded corners / home bar / dynamic island
EDGE_T = {
    0: [(0.12, 0.33), (0.67, 0.88)],          # top (avoid island zone)
    1: [(0.10, 0.90)],                         # right
    2: [(0.10, 0.36), (0.64, 0.90)],          # bottom (avoid home indicator)
    3: [(0.08, 0.92)],                         # left
}


def fit_edges(g, quad):
    lines = []
    c = quad.mean(0)
    for e in range(4):
        A, B = quad[e], quad[(e + 1) % 4]
        d = (B - A) / np.linalg.norm(B - A)
        n = np.array([d[1], -d[0]])
        if np.dot(n, (A + B) / 2 - c) < 0:
            n = -n
        ts = np.concatenate([np.linspace(a, b, 40) for a, b in EDGE_T[e]])
        P = A[None] + ts[:, None] * (B - A)[None]
        ss = np.arange(-14, 14.01, 0.5)
        pts = P[:, None, :] + ss[None, :, None] * n[None, None, :]
        prof = sample(g, pts)
        found = []
        for k in range(len(ts)):
            p = prof[k]
            # going outward: first index where value < 55 after being > 90
            hit = None
            for j in range(1, len(ss)):
                if p[j] < 55 and p[:j].max() > 90:
                    # back off to threshold crossing between bright and dark
                    jj = j
                    while jj > 0 and p[jj - 1] < 90:
                        jj -= 1
                    lvl = (p[max(jj - 1, 0)] + p[j]) / 2
                    # sub-pixel crossing
                    for q in range(max(jj - 1, 0), j):
                        if p[q] >= lvl > p[q + 1]:
                            fr = (p[q] - lvl) / (p[q] - p[q + 1] + 1e-6)
                            hit = ss[q] + fr * 0.5
                            break
                    break
            if hit is not None:
                found.append(P[k] + hit * n)
        found = np.array(found)
        # robust line fit
        pts_ = found
        for _ in range(4):
            vx, vy, x0, y0 = cv2.fitLine(pts_.astype(np.float32), cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            nn = np.array([-vy, vx])
            r = np.abs((found - [x0, y0]) @ nn)
            pts_ = found[r < 1.5]
        lines.append((np.array([x0, y0]), np.array([vx, vy]), len(pts_), len(found)))
    q = []
    for e in range(4):
        (p1, d1, *_), (p2, d2, *_) = lines[(e - 1) % 4], lines[e]
        M = np.array([d1, -d2]).T
        t = np.linalg.solve(M, p2 - p1)
        q.append(p1 + t[0] * d1)
    return np.array(q), [l[2:] for l in lines]


quads = {}
q = init.copy()
for _ in range(3):
    q, info = fit_edges(load(REF), q)
quads[REF] = q
print(REF, q.round(1).tolist(), info)
for rng in (range(REF + 1, F1 + 1), range(REF - 1, F0 - 1, -1)):
    q = quads[REF].copy()
    for i in rng:
        g = load(i)
        for _ in range(2):
            q, info = fit_edges(g, q)
        quads[i] = q.copy()
        print(i, q.round(1).tolist(), info)

json.dump({k: v.tolist() for k, v in quads.items()}, open('quads_raw.json', 'w'))
