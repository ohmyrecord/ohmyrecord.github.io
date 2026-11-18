/* 2030 명동 체험 게임 — 엔진 (그리기 · 빛 번짐 · 입력 · 공통 도구)
   three.js 는 vendor 폴더의 것을 씁니다 (인터넷 없이 더블클릭으로 열림). */
(function () {
  "use strict";
  var T = window.THREE, G = window.G = { T: T, t: 0, dt: 0, keys: {}, mouse: { dx: 0, dy: 0, down: false, x: 0, y: 0 }, mode: null, q: {} };
  location.search.replace(/[?&]([^=&]+)=([^&]*)/g, function (m, k, v) { G.q[k] = decodeURIComponent(v); });
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.damp = function (a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); };
  G.ss = function (a, b, x) { var t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  G.angDiff = function (a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  // 씨앗 난수 (게임마다 다른 배치, ?seed= 로 고정 가능)
  G.rng = function (seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  G.rand = G.rng(G.q.seed ? +G.q.seed : (Date.now() & 0xfffffff));
  G.pick = function (a, r) { return a[Math.floor((r || G.rand)() * a.length)]; };

  var canvas = document.getElementById("gl");
  var r = G.r = new T.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: "high-performance" });
  r.outputColorSpace = T.LinearSRGBColorSpace; r.toneMapping = T.NoToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; r.autoClear = true;
  G.scene = new T.Scene(); G.cam = new T.PerspectiveCamera(55, 1, .05, 400);
  G.PR = Math.min(window.devicePixelRatio || 1, G.q.pr ? +G.q.pr : 1.5);

  /* ---- 후처리: 밝은 곳 번짐(블룸) + 필름 톤 + 가장자리 어둡게 + 입자 ---- */
  var rtScene, rtA = [], rtB = [], W = 0, H = 0;
  var fsGeo = new T.BufferGeometry(); fsGeo.setAttribute("position", new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  var fsCam = new T.Camera(), fsMesh = new T.Mesh(fsGeo, null), fsScene = new T.Scene(); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
  var VS = "varying vec2 vUv; void main(){ vUv = position.xy*.5+.5; gl_Position = vec4(position.xy,0.,1.); }";
  function mat(fs, u) { return new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false }); }
  var mBright = mat("uniform sampler2D t; uniform float th; varying vec2 vUv; void main(){ vec3 c = texture2D(t,vUv).rgb; float l = max(c.r,max(c.g,c.b)); c *= smoothstep(th, th*2.2, l); gl_FragColor = vec4(min(c, vec3(24.)),1.); }", { t: { value: null }, th: { value: 1.05 } });
  var mBlur = mat("uniform sampler2D t; uniform vec2 d; varying vec2 vUv; void main(){ vec3 c = texture2D(t,vUv).rgb*.227; c += (texture2D(t,vUv+d*1.385).rgb+texture2D(t,vUv-d*1.385).rgb)*.316; c += (texture2D(t,vUv+d*3.231).rgb+texture2D(t,vUv-d*3.231).rgb)*.07; gl_FragColor = vec4(c,1.); }", { t: { value: null }, d: { value: new T.Vector2() } });
  var mFinal = mat([
    "uniform sampler2D t, b0, b1, b2; uniform float time, expo, bloom, vig, fade, hit; varying vec2 vUv;",
    "vec3 aces(vec3 x){ x *= .6; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }",
    "float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }",
    "void main(){ vec2 uv = vUv; vec2 cc = uv-.5; float r2 = dot(cc,cc);",
    "  vec3 c = texture2D(t, uv).rgb; c.r = mix(c.r, texture2D(t, uv + cc*.0035).r, .6); c.b = mix(c.b, texture2D(t, uv - cc*.0035).b, .6);",   // 아주 약한 색 번짐(렌즈)
    "  vec3 bl = texture2D(b0,uv).rgb*.5 + texture2D(b1,uv).rgb*.75 + texture2D(b2,uv).rgb*1.0; c += bl*bloom;",
    "  c *= expo; c = aces(c); c = pow(c, vec3(1./2.2));",
    "  c = mix(c, c*c*(3.-2.*c), .18); c *= 1. - vig*smoothstep(.12,.62,r2);",
    "  c += (h(uv*vec2(1920.,1080.)+fract(time)*91.7)-.5)*.022;",
    "  c = mix(c, vec3(.75,.06,.04), hit*smoothstep(.05,.5,r2)); c *= 1.-fade; gl_FragColor = vec4(c,1.); }"].join("\n"),
    { t: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, time: { value: 0 }, expo: { value: 1 }, bloom: { value: .55 }, vig: { value: .55 }, fade: { value: 0 }, hit: { value: 0 } });
  G.post = mFinal.uniforms;
  function mkRT(w, h, ms) { var o = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: ms || 0, depthBuffer: !!ms }); o.texture.minFilter = o.texture.magFilter = T.LinearFilter; return o; }
  function resize() {
    var w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; if (w === W && h === H && rtScene) return; W = w; H = h;
    r.setPixelRatio(1); r.setSize(Math.round(w * G.PR), Math.round(h * G.PR), false);
    var pw = Math.round(w * G.PR), ph = Math.round(h * G.PR);
    [rtScene].concat(rtA, rtB).forEach(function (o) { if (o) o.dispose(); });
    rtScene = mkRT(pw, ph, 4); rtA = []; rtB = [];
    for (var i = 0; i < 3; i++) { var d = 4 << i; rtA.push(mkRT(Math.max(4, pw / d | 0), Math.max(4, ph / d | 0))); rtB.push(mkRT(Math.max(4, pw / d | 0), Math.max(4, ph / d | 0))); }
    G.cam.aspect = w / h; G.cam.updateProjectionMatrix(); G.W = w; G.H = h;
  }
  function pass(m, target) { fsMesh.material = m; r.setRenderTarget(target); r.render(fsScene, fsCam); }
  G.render = function () {
    if (G.city && G.city.skyG) G.city.skyG.position.copy(G.cam.position);
    resize();
    r.setRenderTarget(rtScene); r.render(G.scene, G.cam);
    mBright.uniforms.t.value = rtScene.texture; pass(mBright, rtA[0]);
    for (var i = 0; i < 3; i++) {
      if (i) { mBlur.uniforms.t.value = rtA[i - 1].texture; mBlur.uniforms.d.value.set(0, 0); pass(mBlur, rtA[i]); }
      mBlur.uniforms.t.value = rtA[i].texture; mBlur.uniforms.d.value.set(1 / rtA[i].width, 0); pass(mBlur, rtB[i]);
      mBlur.uniforms.t.value = rtB[i].texture; mBlur.uniforms.d.value.set(0, 1 / rtA[i].height); pass(mBlur, rtA[i]);
    }
    var u = mFinal.uniforms; u.t.value = rtScene.texture; u.b0.value = rtA[0].texture; u.b1.value = rtA[1].texture; u.b2.value = rtA[2].texture; u.time.value = G.t;
    pass(mFinal, null);
  };

  /* ---- 입력 ---- */
  addEventListener("keydown", function (e) { if (e.code === "Tab" || e.code === "Space") e.preventDefault(); if (!G.keys[e.code]) { G.keys[e.code] = true; if (G.onKey) G.onKey(e.code); } });
  addEventListener("keyup", function (e) { G.keys[e.code] = false; if (G.onKeyUp) G.onKeyUp(e.code); });
  addEventListener("blur", function () { G.keys = {}; });
  canvas.addEventListener("mousemove", function (e) { G.mouse.dx += e.movementX || 0; G.mouse.dy += e.movementY || 0; G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
  canvas.addEventListener("mousedown", function (e) { G.mouse.down = true; if (G.onClick) G.onClick(e); });
  addEventListener("mouseup", function () { G.mouse.down = false; });
  G.lock = function () { if (canvas.requestPointerLock && !G.q.nolock) { try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (e) {} } };
  G.unlock = function () { if (document.exitPointerLock) document.exitPointerLock(); };
  G.locked = function () { return document.pointerLockElement === canvas; };

  /* ---- 도구 ---- */
  G.canvasTex = function (w, h, draw, opt) { var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; if (opt && opt.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(opt.repeat[0], opt.repeat[1]); } return t; };
  G.glowTex = G.canvasTex(128, 128, function (g) { var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  G.glow = function (col, size, inten) { var s = new T.Sprite(new T.SpriteMaterial({ map: G.glowTex, color: new T.Color(col).multiplyScalar(inten || 1), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(size); return s; };
  G.b64buf = function (s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; };
  G.loadGLB = function (name, cb) { new T.GLTFLoader().parse(G.b64buf(window.MD_MODELS[name]), "", function (gl) { cb(gl.scene); }, function (e) { console.error(e); }); };
  G.FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

  /* ---- 돌리기 ---- */
  var last = 0, frames = 0, acc = 0; G.fps = 60;
  function loop(now) {
    requestAnimationFrame(loop);
    var dt = last ? Math.min(G.q.dtmax ? +G.q.dtmax : .05, (now - last) / 1000) : .016; last = now; G.dt = dt; G.t += dt;
    acc += dt; frames++; if (acc > .5) { G.fps = frames / acc; acc = 0; frames = 0; if (!G.q.pr) { if (G.fps < 38 && G.PR > .7) { G.PR = Math.max(.7, G.PR * .88); W = 0; } else if (G.fps > 57 && G.PR < Math.min(window.devicePixelRatio || 1, 1.5)) { G.PR = Math.min(Math.min(window.devicePixelRatio || 1, 1.5), G.PR * 1.06); W = 0; } } }
    if (G.update) G.update(dt);
    G.mouse.dx = G.mouse.dy = 0;
    G.render();
  }
  G.start = function () { requestAnimationFrame(loop); };
})();
