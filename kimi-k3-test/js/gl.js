/* ═══════════════════════════════════════════════════════════════
   DREAM SKY — WebGL2 domain-warped fbm nebula
   palettes blend across scroll sections · velocity = redline FX
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var VERT = '#version 300 es\n' +
    'void main(){' +
    '  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));' +
    '  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);' +
    '}';

  var FRAG = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform vec2  uRes;\n' +
    'uniform float uTime;\n' +
    'uniform float uScroll;\n' +   // 0..1 page progress
    'uniform float uVel;\n' +      // 0..1 normalized scroll velocity
    'uniform vec2  uMouse;\n' +    // -1..1
    'uniform float uDuality;\n' +  // 0..1 right/wrong seam
    'out vec4 frag;\n' +

    'float hash(vec2 p){' +
    '  p = fract(p * vec2(123.34, 456.21));' +
    '  p += dot(p, p + 45.32);' +
    '  return fract(p.x * p.y);' +
    '}\n' +

    'float noise(vec2 p){' +
    '  vec2 i = floor(p), f = fract(p);' +
    '  f = f * f * (3.0 - 2.0 * f);' +
    '  float a = hash(i);' +
    '  float b = hash(i + vec2(1.0, 0.0));' +
    '  float c = hash(i + vec2(0.0, 1.0));' +
    '  float d = hash(i + vec2(1.0, 1.0));' +
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);' +
    '}\n' +

    'float fbm(vec2 p){' +
    '  float v = 0.0, a = 0.5;' +
    '  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);' +
    '  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }' +
    '  return v;' +
    '}\n' +

    // one gradient stop set: base → mid → accent
    'vec3 palSet(float t, vec3 b, vec3 m, vec3 a){' +
    '  vec3 c = mix(b, m, smoothstep(0.15, 0.70, t));' +
    '  return mix(c, a, smoothstep(0.60, 0.98, t));' +
    '}\n' +

    // 5 section palettes blended by continuous section float
    'vec3 pal(float t, float s){' +
    '  vec3 c = palSet(t, vec3(0.008,0.000,0.050), vec3(0.310,0.110,0.780), vec3(0.220,0.900,1.000));' + // P0 hero: deep violet/cyan
    '  c = mix(c, palSet(t, vec3(0.050,0.008,0.130), vec3(0.720,0.180,0.950), vec3(1.000,0.480,0.850)), clamp(s,       0.0, 1.0));' + // P1 believe: magenta bloom
    '  c = mix(c, palSet(t, vec3(0.020,0.020,0.060), vec3(0.160,0.300,0.750), vec3(1.000,0.620,0.250)), clamp(s - 1.0, 0.0, 1.0));' + // P2 duality: steel/ember
    '  c = mix(c, palSet(t, vec3(0.000,0.030,0.030), vec3(0.050,0.420,0.400), vec3(0.500,1.000,0.830)), clamp(s - 2.0, 0.0, 1.0));' + // P3 unknown: ghost teal
    '  c = mix(c, palSet(t, vec3(0.070,0.010,0.060), vec3(0.950,0.160,0.500), vec3(1.000,0.820,0.400)), clamp(s - 3.0, 0.0, 1.0));' + // P4 arrival: sunrise
    '  return c;' +
    '}\n' +

    'float stars(vec2 uv, float t){' +
    '  vec2 g = uv * vec2(uRes.x / uRes.y, 1.0) * 34.0;' +
    '  vec2 id = floor(g);' +
    '  float h = hash(id);' +
    '  vec2 f = fract(g) - 0.5;' +
    '  vec2 off = (vec2(hash(id + 1.3), hash(id + 2.7)) - 0.5) * 0.6;' +
    '  float d = length(f - off);' +
    '  float s = smoothstep(0.07, 0.0, d) * step(0.90, h);' +
    '  float tw = 0.5 + 0.5 * sin(t * (1.0 + h * 3.0) + h * 40.0);' +
    '  return s * tw;' +
    '}\n' +

    'void main(){' +
    '  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);' +
    '  float t = uTime * 0.055;' +
    '  float vel = clamp(uVel, 0.0, 1.0);' +
    '  vec2 p = uv + uMouse * 0.16;' +

    // triple domain warp — the dream fold
    '  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.7));' +
    '  vec2 r = vec2(fbm(p + 2.2 * q + vec2(1.7, 9.2) + t * 0.5), fbm(p + 2.2 * q + vec2(8.3, 2.8) - t * 0.3));' +
    '  float f = fbm(p + 2.5 * r * (1.0 + vel * 1.6));' +

    '  float sect = clamp(uScroll * 4.0, 0.0, 4.0);' +

    // velocity-driven chromatic aberration on palette lookups (cheap)
    '  float da = 0.018 + vel * 0.11;' +
    '  vec3 cR = pal(f + da, sect);' +
    '  vec3 cG = pal(f, sect);' +
    '  vec3 cB = pal(f - da, sect);' +
    '  vec3 col = vec3(cR.r, cG.g, cB.b);' +

    // duality seam: warm <-> cool global tint
    '  col *= mix(vec3(0.92, 1.00, 1.14), vec3(1.14, 1.02, 0.86), uDuality);' +

    // ridge highlights
    '  col += vec3(0.90, 0.85, 1.00) * pow(max(0.0, f - 0.62) * 2.2, 2.5) * 0.35;' +

    // starfield, hidden inside bright nebula
    '  col += vec3(0.80, 0.90, 1.00) * stars(uv, uTime) * (1.0 - smoothstep(0.40, 0.90, f)) * 0.85;' +

    // vignette
    '  float vig = smoothstep(1.65, 0.35, length(uv * vec2(0.85, 1.0)));' +
    '  col *= mix(0.50, 1.06, vig);' +

    // redline bloom push
    '  col += col * vel * 0.35;' +

    // grain
    '  col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.045;' +

    '  frag = vec4(col, 1.0);' +
    '}';

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('DreamGL shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var DreamGL = {
    gl: null,
    canvas: null,
    prog: null,
    uni: {},
    ok: false,
    scale: 0.75,

    init: function (canvas) {
      this.canvas = canvas;
      var gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance'
      });
      if (!gl) { console.warn('WebGL2 unavailable — sky offline.'); return false; }
      this.gl = gl;

      var vs = compile(gl, gl.VERTEX_SHADER, VERT);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return false;

      var prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.error('DreamGL link error:', gl.getProgramInfoLog(prog));
        return false;
      }
      this.prog = prog;
      gl.useProgram(prog);

      var names = ['uRes', 'uTime', 'uScroll', 'uVel', 'uMouse', 'uDuality'];
      for (var i = 0; i < names.length; i++) {
        this.uni[names[i]] = gl.getUniformLocation(prog, names[i]);
      }

      this.resize();
      this.ok = true;
      return true;
    },

    resize: function () {
      if (!this.gl) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * this.scale;
      var w = Math.max(1, Math.floor(window.innerWidth * dpr));
      var h = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
      }
    },

    frame: function (s) {
      if (!this.ok) return;
      var gl = this.gl;
      gl.uniform2f(this.uni.uRes, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uni.uTime, s.time);
      gl.uniform1f(this.uni.uScroll, s.progress);
      gl.uniform1f(this.uni.uVel, s.vel);
      gl.uniform2f(this.uni.uMouse, s.mx, s.my);
      gl.uniform1f(this.uni.uDuality, s.duality);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };

  window.DreamGL = DreamGL;
})();
