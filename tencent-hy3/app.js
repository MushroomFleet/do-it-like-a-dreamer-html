/* ============================================================
   HY3 — Beyond the Boundaries
   WebGL2 engine · custom GLSL · scroll + pointer driven
   No frameworks. Raw WebGL2 + GLSL.
   ============================================================ */
(() => {
  "use strict";

  const veil = document.getElementById("veil");
  const veilPct = document.getElementById("veilPct");

  // Hard safety: never let the boot veil get stuck.
  const safety = setTimeout(() => veil.classList.add("gone"), 6000);

  const canvas = document.getElementById("gl");
  let gl = null;
  try {
    gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    console.error(e);
  }

  if (!gl) {
    veil.classList.add("gone");
    clearTimeout(safety);
    console.warn("WebGL2 not supported — falling back to static background.");
    return;
  }

  /* ---------------- Shaders ---------------- */
  const VERT = `#version 300 es
  in vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `#version 300 es
  precision highp float;
  precision highp int;
  out vec4 fragColor;

  uniform vec2  uRes;
  uniform float uTime;
  uniform float uScroll;   // 0..1 overall progress
  uniform float uSection;  // 0..3 active section (smooth)
  uniform vec2  uMouse;    // -1..1
  uniform float uRpm;      // 0..11000
  uniform float uIntro;    // 0..1 boot fade

  // ---- hash / noise ----
  float hash(vec3 p){
    p = fract(p*0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
  }
  float noise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                   mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                   mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    mat3 m = mat3(0.0,0.8,0.6,-0.8,0.36,-0.48,-0.6,-0.48,0.64);
    for(int i=0;i<6;i++){ v += a*noise(p); p = m*p*2.02; a *= 0.5; }
    return v;
  }

  // ---- palette ----
  vec3 palette(float t){
    vec3 a = vec3(0.04,0.06,0.12);
    vec3 b = vec3(0.45,0.35,0.55);
    vec3 c = vec3(1.0,1.0,1.0);
    vec3 d = vec3(0.10,0.45,0.85);
    return a + b*cos(6.28318*(c*t + d));
  }

  // ---- SDF: rounded box (crystal) ----
  float sdBox(vec3 p, vec3 b){
    vec3 q = abs(p)-b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
  }
  float sdOcta(vec3 p, float s){
    p = abs(p);
    return (p.x+p.y+p.z-s)*0.57735027;
  }
  mat2 rot(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }

  // scene SDF for the crystal
  float mapCrystal(vec3 p){
    p.xz *= rot(uTime*0.25 + uScroll*3.0);
    p.xy *= rot(uTime*0.18);
    float d = sdOcta(p, 0.85);
    // carve inner detail
    d = max(d, -sdOcta(p*1.4, 0.5));
    return d;
  }

  vec3 calcNormal(vec3 p){
    vec2 e = vec2(0.001,0.0);
    return normalize(vec3(
      mapCrystal(p+e.xyy)-mapCrystal(p-e.xyy),
      mapCrystal(p+e.yxy)-mapCrystal(p-e.yxy),
      mapCrystal(p+e.yyx)-mapCrystal(p-e.yyx)));
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
    vec2 m = uMouse;

    // ---- background nebula (domain warped fbm) ----
    vec3 col = vec3(0.0);
    float t = uTime*0.06 + uScroll*2.0;
    vec3 q = vec3(uv*1.6, t);
    q.xy += m*0.4;
    float warp = fbm(q + fbm(q*1.5 + t)*1.2);
    float neb = fbm(q*1.3 + warp*2.5 + vec3(0.0, uScroll*1.5, 0.0));
    neb = pow(neb, 1.6);

    // color shifts per section
    float hue = uSection*0.18 + neb*0.25 + uScroll*0.3;
    vec3 nebCol = palette(hue);
    col += nebCol * neb * 1.4;

    // glowing filaments
    float fil = smoothstep(0.55,0.95, fbm(q*2.2 + warp*3.0));
    col += palette(hue+0.3) * fil * 0.6;

    // subtle starfield
    float st = hash(vec3(floor(uv*220.0), 1.0));
    st = step(0.997, st) * (0.5+0.5*sin(uTime*3.0+st*40.0));
    col += vec3(st)*0.8;

    // ---- crystal (raymarched) ----
    vec3 ro = vec3(0.0, 0.0, 3.2);
    vec3 rd = normalize(vec3(uv*0.9 - m*0.15, -1.4));
    float td = 0.0;
    float glow = 0.0;
    bool hit = false;
    vec3 p;
    for(int i=0;i<80;i++){
      p = ro + rd*td;
      float d = mapCrystal(p);
      glow += 0.012 / (0.01 + d*d*8.0);   // volumetric halo
      if(d < 0.001){ hit = true; break; }
      if(td > 8.0) break;
      td += d*0.7;
    }
    if(hit){
      vec3 n = calcNormal(p);
      vec3 ld = normalize(vec3(0.6,0.8,0.4) + vec3(m, 0.0));
      float diff = clamp(dot(n,ld),0.0,1.0);
      float fres = pow(1.0 - clamp(dot(n,-rd),0.0,1.0), 3.0);
      vec3 refl = reflect(rd, n);
      float env = fbm(refl*3.0 + uTime*0.1);
      vec3 cCol = palette(uSection*0.2 + 0.5 + env*0.3);
      col = mix(col, cCol*(0.3+diff) + fres*vec3(0.6,0.9,1.0), 0.92);
      col += cCol * fres * 1.2;
    }
    // halo always present
    col += palette(uSection*0.2+0.4) * glow * 0.5;

    // ---- RPM energy sweep ----
    float rpmN = uRpm/11000.0;
    float sweep = sin(uv.y*6.0 - uTime*4.0*rpmN*3.0);
    col += vec3(0.1,0.6,0.9) * smoothstep(0.9,1.0,sweep) * rpmN * 0.25;

    // chromatic aberration toward edges
    float ca = length(uv)*0.04;
    col.r += ca*0.4*rpmN;
    col.b += ca*0.3;

    // vignette
    col *= 1.0 - 0.35*dot(uv,uv);

    // tone map + gamma
    col = col / (col + vec3(1.0));
    col = pow(col, vec3(0.4545));

    // intro fade
    col *= uIntro;

    fragColor = vec4(col, 1.0);
  }
  `;

  /* ---------------- GL setup ---------------- */
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      throw new Error("Shader compile failed");
    }
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, "uRes"),
    time: gl.getUniformLocation(prog, "uTime"),
    scroll: gl.getUniformLocation(prog, "uScroll"),
    section: gl.getUniformLocation(prog, "uSection"),
    mouse: gl.getUniformLocation(prog, "uMouse"),
    rpm: gl.getUniformLocation(prog, "uRpm"),
    intro: gl.getUniformLocation(prog, "uIntro"),
  };

  /* ---------------- State ---------------- */
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.floor(innerWidth * DPR);
    H = Math.floor(innerHeight * DPR);
    canvas.width = W; canvas.height = H;
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";
    gl.viewport(0, 0, W, H);
  }
  resize();
  addEventListener("resize", resize);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = -((e.clientY / innerHeight) * 2 - 1);
  });

  // scroll
  let scrollProg = 0, smoothScroll = 0;
  let sectionF = 0, smoothSection = 0;
  const sections = [...document.querySelectorAll(".panel")];
  function onScroll() {
    const max = document.body.scrollHeight - innerHeight;
    scrollProg = max > 0 ? scrollY / max : 0;
    const idx = Math.min(sections.length - 1, Math.round(scrollProg * (sections.length - 1)));
    sectionF = idx;
    // progress bar
    document.getElementById("progressBar").style.width = (scrollProg * 100).toFixed(2) + "%";
    // active nav
    document.querySelectorAll(".nav__links a").forEach((a) => {
      a.classList.toggle("active", +a.dataset.i === idx);
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // RPM — climbs toward 11000, reacts to motion
  let rpm = 0, rpmTarget = 0;
  let lastScroll = scrollY, lastT = performance.now();
  function updateRpm(now) {
    const dt = Math.max(1, now - lastT);
    const vel = Math.abs(scrollY - lastScroll) / dt; // px/ms
    lastScroll = scrollY; lastT = now;
    // base target scales with scroll progress + pointer motion + velocity
    const motion = Math.hypot(mouse.tx - mouse.x, mouse.ty - mouse.y);
    rpmTarget = 3000 + scrollProg * 5000 + vel * 600 + motion * 4000;
    rpmTarget = Math.min(11000, rpmTarget);
    rpm += (rpmTarget - rpm) * 0.06;
    document.getElementById("rpm").textContent = Math.round(rpm).toLocaleString();
  }

  /* ---------------- Boot veil ---------------- */
  let boot = 0;
  const bootTimer = setInterval(() => {
    boot = Math.min(100, boot + Math.random() * 18 + 6);
    veilPct.textContent = Math.floor(boot);
    if (boot >= 100) {
      clearInterval(bootTimer);
      setTimeout(() => veil.classList.add("gone"), 350);
    }
  }, 120);

  /* ---------------- Custom cursor ---------------- */
  const cursor = document.createElement("div");
  cursor.className = "cursor";
  document.body.appendChild(cursor);
  let cx = innerWidth / 2, cy = innerHeight / 2;
  addEventListener("pointermove", (e) => {
    cx = e.clientX; cy = e.clientY;
    cursor.style.left = cx + "px";
    cursor.style.top = cy + "px";
  });
  document.querySelectorAll("a").forEach((a) => {
    a.addEventListener("pointerenter", () => cursor.classList.add("dot"));
    a.addEventListener("pointerleave", () => cursor.classList.remove("dot"));
  });

  /* ---------------- Render loop ---------------- */
  const start = performance.now();
  let intro = 0;
  function frame(now) {
    const time = (now - start) / 1000;

    // smooth values
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    smoothScroll += (scrollProg - smoothScroll) * 0.08;
    smoothSection += (sectionF - smoothSection) * 0.06;
    intro += (1 - intro) * 0.02;
    updateRpm(now);

    gl.uniform2f(U.res, W, H);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.scroll, smoothScroll);
    gl.uniform1f(U.section, smoothSection);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.rpm, rpm);
    gl.uniform1f(U.intro, Math.min(1, intro + (boot / 100) * 0.0));

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
