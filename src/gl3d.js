// Minimal WebGL2 renderer for perspective-correct textured planes (posters, layers).
// Vertices are projected with the same camera as the 2D overlay (fx.js), so
// outlines drawn in 2D line up exactly with the GL planes.
import { toView, W, H } from './fx.js';

const VS = `#version 300 es
in vec4 aPos; in vec2 aUV; out vec2 vUV;
void main(){ vUV=aUV; gl_Position=aPos; }`;
const FS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uSize; uniform float uRadius; uniform float uAlpha;
uniform vec4 uTint; uniform float uFeather;
void main(){
  vec4 c = texture(uTex, vUV);
  vec2 p = (vUV - 0.5) * uSize;
  vec2 q = abs(p) - (uSize*0.5 - vec2(uRadius));
  float d = length(max(q,0.0)) + min(max(q.x,q.y),0.0) - uRadius;
  float m = 1.0 - smoothstep(-uFeather, uFeather, d);
  c.rgb = mix(c.rgb, uTint.rgb * c.a, uTint.a);
  o = c * m * uAlpha;
}`;

export class PlaneRenderer {
  constructor() {
    this.canvas = new OffscreenCanvas(W, H);
    const gl = (this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true }));
    if (!gl) throw new Error('WebGL2 unavailable');
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = (this.prog = gl.createProgram());
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    this.loc = {
      aPos: gl.getAttribLocation(p, 'aPos'), aUV: gl.getAttribLocation(p, 'aUV'),
      uTex: gl.getUniformLocation(p, 'uTex'), uSize: gl.getUniformLocation(p, 'uSize'), uRadius: gl.getUniformLocation(p, 'uRadius'),
      uAlpha: gl.getUniformLocation(p, 'uAlpha'), uTint: gl.getUniformLocation(p, 'uTint'), uFeather: gl.getUniformLocation(p, 'uFeather'),
    };
    this.buf = gl.createBuffer();
    this.tex = new Map();
  }

  texture(source, version = 0) {
    const gl = this.gl;
    let e = this.tex.get(source);
    if (e && e.version === version) return e.tex;
    if (!e) {
      e = { tex: gl.createTexture(), version: -1 };
      this.tex.set(source, e);
    }
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.version = version;
    return e.tex;
  }

  /** corners of a plane in world space: centre (x,y,z), size w×h, rotated by yaw/pitch about its centre */
  static corners(pl) {
    const { x, y, z, w, h, yaw = 0, pitch = 0 } = pl;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([u, v]) => {
      let px = u * w, py = v * h, pz = 0;
      let y1 = py * cp - pz * sp, z1 = py * sp + pz * cp;
      const x1 = px * cy + z1 * sy, z2 = -px * sy + z1 * cy;
      return [x + x1, y + y1, z + z2];
    });
  }

  /** Draw planes (sorted far→near by caller or automatically) and return the GL canvas. */
  render(cam, planes, { sort = true } = {}) {
    const gl = this.gl;
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const items = planes
      .filter((p) => p.source && (p.alpha ?? 1) > 0.001)
      .map((p) => {
        const cs = PlaneRenderer.corners(p).map((c) => toView(cam, c[0], c[1], c[2]));
        const depth = cs.reduce((s, c) => s + c[2], 0) / 4;
        return { p, cs, depth };
      });
    if (sort) items.sort((a, b) => b.depth - a.depth);
    for (const { p, cs } of items) {
      if (cs.some((c) => c[2] < 5)) continue;
      const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const v = [];
      for (const i of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z] = cs[i];
        const sx = W / 2 + (cam.f * x) / z, sy = H / 2 + (cam.f * y) / z;
        v.push(((sx / W) * 2 - 1) * z, (1 - (sy / H) * 2) * z, 0, z, uv[i][0], uv[i][1]);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.loc.aPos);
      gl.vertexAttribPointer(this.loc.aPos, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(this.loc.aUV);
      gl.vertexAttribPointer(this.loc.aUV, 2, gl.FLOAT, false, 24, 16);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture(p.source, p.version ?? 0));
      gl.uniform1i(this.loc.uTex, 0);
      gl.uniform2f(this.loc.uSize, p.w, p.h);
      gl.uniform1f(this.loc.uRadius, p.radius ?? 0);
      gl.uniform1f(this.loc.uAlpha, p.alpha ?? 1);
      const t = p.tint || [0, 0, 0, 0];
      gl.uniform4f(this.loc.uTint, t[0], t[1], t[2], t[3]);
      gl.uniform1f(this.loc.uFeather, p.feather ?? 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return this.canvas;
  }
}
