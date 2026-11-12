/* =========================================================
   3D 명동 (Three.js) — 하늘에서 골목으로 실제 건물 사이를 내려가는 장면
   지도(map.js)와 같은 길·간판·사람 데이터를 써서, 2D 지도와 3D 거리가 이어집니다.
   ========================================================= */
(function () {
  "use strict";
  var MAP = window.MDMap, CFG = window.MD_CONFIG;
  var T = window.THREE;
  var api = { ok: false };
  window.City3D = api;
  if (!T) return;

  var COL = CFG.colors;
  function rng(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var ST = MAP.streets;

  var renderer, scene, camera, canvas, people, peopleAgents, dummy, glowBig, glowSmall, built = false, W0 = 0, H0 = 0;
  var EYE = 13;                     // 사람 눈높이 (지도 단위, 약 1.6m)

  function hex(c) { return new T.Color(c); }

  /* ---------- 여러 도형을 하나로 합치기 (가볍게 그리기 위해) ---------- */
  function Builder() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  Builder.prototype.quad = function (a, b, c, d, nrm, col, uvs) {
    var P = this.p, N = this.n, C = this.c, U = this.uv;
    [a, b, c, a, c, d].forEach(function (v, i) {
      P.push(v[0], v[1], v[2]); N.push(nrm[0], nrm[1], nrm[2]);
      var cc = col[[0, 1, 2, 0, 2, 3][i]] || col[0]; C.push(cc.r, cc.g, cc.b);
      var uu = uvs ? uvs[[0, 1, 2, 0, 2, 3][i]] : [0.01, 0.01]; U.push(uu[0], uu[1]);
    });
  };
  // 상자: 중심 x,z / 크기 w(x방향),d(z방향) / y0~y1, 회전 ang
  Builder.prototype.box = function (cx, cz, w, d, y0, y1, ang, colTop, colSide, opt) {
    opt = opt || {};
    var ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
    function P(x, y, z) { return [cx + x * ca - z * sa, y, cz + x * sa + z * ca]; }
    var hw = w / 2, hd = d / 2, h = y1 - y0;
    var bot = colSide.clone().multiplyScalar(opt.ao == null ? 0.78 : opt.ao), top = colSide;
    var faces = [
      [[-hw, -hd], [hw, -hd], [0, 0, -1], w], [[hw, -hd], [hw, hd], [1, 0, 0], d],
      [[hw, hd], [-hw, hd], [0, 0, 1], w], [[-hw, hd], [-hw, -hd], [-1, 0, 0], d]
    ];
    var self = this;
    faces.forEach(function (f, i) {
      var a = P(f[0][0], y0, f[0][1]), b = P(f[1][0], y0, f[1][1]), c = P(f[1][0], y1, f[1][1]), e = P(f[0][0], y1, f[0][1]);
      var nx = f[2][0] * ca - f[2][2] * sa, nz = f[2][0] * sa + f[2][2] * ca;
      var uvs = opt.win ? [[0, y0 / 30], [f[3] / 26, y0 / 30], [f[3] / 26, y1 / 30], [0, y1 / 30]] : (opt.sideUV ? [opt.sideUV, opt.sideUV, opt.sideUV, opt.sideUV] : null);
      var cols = [bot, bot, top, top];
      if (opt.faceUV && opt.faceUV[i]) { uvs = opt.faceUV[i]; var wh = new T.Color(1, 1, 1); cols = [wh, wh, wh, wh]; }
      self.quad(a, b, c, e, [nx, 0, nz], cols, uvs);
    });
    if (!opt.noTop) self.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), [0, 1, 0], [colTop, colTop, colTop, colTop], opt.sideUV ? [opt.sideUV, opt.sideUV, opt.sideUV, opt.sideUV] : null);
  };
  Builder.prototype.mesh = function (mat) {
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
    return new T.Mesh(g, mat);
  };

  /* ---------- 질감: 창문 / 간판 글자 / 빛 ---------- */
  function windowTex() {
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#D9D1BA"; g.fillRect(18, 22, 92, 70);
    g.fillStyle = "#C9C0A6"; g.fillRect(18, 22, 92, 8);
    g.fillStyle = "#EDE6D2"; g.fillRect(62, 22, 4, 70);
    g.fillStyle = "#F4EFE2"; g.fillRect(0, 118, 128, 10);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }
  var WORDS = ["명동", "분식", "환전", "약국", "카페", "만두", "안경", "의류", "호떡", "꼬치", "서점", "사진", "떡볶이", "커피", "화장품", "노래"];
  var STYLES = [[COL.point, COL.ink, 1], [COL.dnaPale, COL.ink, 0], [COL.dnaIvory, COL.ink, 0], [COL.dnaCharcoal, COL.dnaIvory, 0], ["#ECE5CF", COL.sub, 0], [COL.ink, COL.point, 1], [COL.point, COL.ink, 1], ["#FFF3C4", COL.ink, 1]];
  var ATLAS_COLS = 16, ATLAS_ROWS = 4; // 64개 칸 (스타일 x 글자)
  function signAtlas() {
    var cw = 64, ch = 256, c = document.createElement("canvas"); c.width = cw * ATLAS_COLS; c.height = ch * ATLAS_ROWS + 16;
    var g = c.getContext("2d");
    function draw() {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, ch * ATLAS_ROWS, c.width, 16);   // 간판 옆면용 흰 칸
    for (var row = 0; row < ATLAS_ROWS; row++) for (var col = 0; col < ATLAS_COLS; col++) {
      var st = STYLES[(row * 3 + col) % STYLES.length], word = WORDS[(col + row * 5) % WORDS.length];
      var x = col * cw, y = row * ch;
      g.fillStyle = st[0]; g.fillRect(x, y, cw, ch);
      g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x, y, cw, ch * 0.45);
      g.fillStyle = st[1]; g.font = "700 34px Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      var chars = word.split(""), gap = 42, y0 = y + ch / 2 - (chars.length - 1) * gap / 2;
      chars.forEach(function (chh, i) { g.fillText(chh, x + cw / 2, y0 + i * gap); });
      g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
    }
    }
    draw();
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    api.redrawSigns = function () { draw(); t.needsUpdate = true; };
    return { tex: t, style: function (row, col) { return STYLES[(row * 3 + col) % STYLES.length]; } };
  }
  function glowTex() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,244,190,1)"); gr.addColorStop(0.25, "rgba(242,217,75,.55)"); gr.addColorStop(1, "rgba(242,217,75,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  function build() {
    built = true;
    scene = new T.Scene();
    var sky = hex("#F3EBD2");
    scene.background = sky;
    scene.fog = new T.Fog(sky, 520, 2600);
    scene.add(new T.HemisphereLight(0xFFF8E6, 0xBFB59A, 1.35));
    var sun = new T.DirectionalLight(0xFFEFD0, 1.5); sun.position.set(-0.6, 1, -0.35); scene.add(sun);

    var R = rng(31);
    // 바닥 + 길
    var ground = new T.Mesh(new T.PlaneGeometry(6000, 6000), new T.MeshLambertMaterial({ color: 0xD9CFB3 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(800, -0.2, 500); scene.add(ground);
    var road = new Builder(), roadCol = hex("#FBF7EA"), roadEdge = hex("#E5DCC4");
    ST.forEach(function (s) {
      var a0 = MAP.pointOn(s, -80, -s.w / 2), a1 = MAP.pointOn(s, s.len + 80, -s.w / 2), b1 = MAP.pointOn(s, s.len + 80, s.w / 2), b0 = MAP.pointOn(s, -80, s.w / 2);
      road.quad([a0[0], 0.05, a0[1]], [b0[0], 0.05, b0[1]], [b1[0], 0.05, b1[1]], [a1[0], 0.05, a1[1]], [0, 1, 0], [roadEdge, roadEdge, roadEdge, roadEdge]);
      var c0 = MAP.pointOn(s, -80, -s.w / 2 + 6), c1 = MAP.pointOn(s, s.len + 80, -s.w / 2 + 6), d1 = MAP.pointOn(s, s.len + 80, s.w / 2 - 6), d0 = MAP.pointOn(s, -80, s.w / 2 - 6);
      road.quad([c0[0], 0.12, c0[1]], [d0[0], 0.12, d0[1]], [d1[0], 0.12, d1[1]], [c1[0], 0.12, c1[1]], [0, 1, 0], [roadCol, roadCol, roadCol, roadCol]);
    });
    var roadMesh = road.mesh(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); scene.add(roadMesh);

    // 건물 (무광 블록 + 창문)
    var bld = new Builder(), tones = ["#F3EEDD", "#EFE9D6", "#E8E0C8", "#F7F3E6", "#E2D9BF", "#DCD2B6"];
    MAP.buildings.forEach(function (b) {
      var base = hex(tones[b.tone]);
      bld.box(b.x, b.z, b.w, b.d, 0, b.h, 0, base.clone().multiplyScalar(1.04), base, { win: true });
      if (b.cap) bld.box(b.x + b.cx * b.w * 0.4, b.z + b.cz * b.d * 0.4, b.w * 0.3, b.d * 0.3, b.h, b.h + b.ch, 0, base, base, { ao: 0.9 });
    });
    var wt = windowTex();
    var bldMesh = bld.mesh(new T.MeshLambertMaterial({ vertexColors: true, map: wt })); scene.add(bldMesh);

    // 1층 가게 불빛 + 세로 간판
    var atlas = signAtlas(), shop = new Builder(), sgn = new Builder(), glowPts = [], bulbPts = [];
    ST.forEach(function (s, si) {
      var ang = Math.atan2(s.uy, s.ux);
      for (var dd = 10; dd < s.len - 10; dd += 26 + R() * 18) {
        [-1, 1].forEach(function (side) {
          var p = MAP.pointOn(s, dd, side * (s.w / 2 + 1.2));
          if (R() < (s.kind === "main" ? 0.55 : 0.42)) {
            var sp = MAP.pointOn(s, dd + 6, side * (s.w / 2 - 6)), hgt = 34 + R() * 46, y0 = 24 + R() * 40;
            var row = (R() * ATLAS_ROWS) | 0, col = (R() * ATLAS_COLS) | 0, sty = atlas.style(row, col);
            var HH = ATLAS_ROWS * 256 + 16, u0 = col / ATLAS_COLS + 0.002, u1 = (col + 1) / ATLAS_COLS - 0.002, v1 = 1 - (row * 256 + 2) / HH, v0 = 1 - ((row + 1) * 256 - 2) / HH;
            var face = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], faceR = [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
            var cc = hex(sty[0]);
            // 간판: 길 쪽으로 튀어나온 얇은 판 (앞뒤 면에 글자)
            sgn.box(sp[0], sp[1], 2.2, 14, y0, y0 + hgt, ang, cc, cc, { ao: 0.92, faceUV: [null, faceR, null, face], sideUV: [0.5, 8 / (ATLAS_ROWS * 256 + 16)] });
            if (sty[2]) { var gp = MAP.pointOn(s, dd + 6, side * (s.w / 2 - 6)); glowPts.push(gp[0], y0 + hgt / 2, gp[1]); }
          }
        });
      }
      // 골목을 가로지르는 줄 전구
      if (s.kind === "alley" || si < 2) {
        for (var ld = 40; ld < s.len - 40; ld += 120) {
          var a = MAP.pointOn(s, ld, -s.w / 2), b = MAP.pointOn(s, ld + 30, s.w / 2), yy = 70 + (si % 3) * 6;
          for (var k = 0; k <= 8; k++) {
            var t = k / 8, sag = Math.sin(Math.PI * t) * 10;
            bulbPts.push(lerp(a[0], b[0], t), yy - sag, lerp(a[1], b[1], t));
          }
        }
      }
    });
    var signMat = new T.MeshBasicMaterial({ vertexColors: true, map: atlas.tex });
    var sMesh = sgn.mesh(signMat); scene.add(sMesh);

    // 노점 + 골목 테이블
    var misc = new Builder(), stallC = hex(COL.sub), awnY = hex(COL.point), awnP = hex(COL.dnaPale), tblC = hex("#FFFFFF");
    MAP.stalls.forEach(function (st, i) {
      var main = ST[0], ang = Math.atan2(main.uy, main.ux);
      misc.box(st.p[0], st.p[1], 20, 10, 0, 10, ang, stallC, stallC);
      misc.box(st.p[0], st.p[1], 24, 14, 17, 19, ang, i % 2 ? awnY : awnP, i % 2 ? awnY : awnP, { ao: 0.95 });
      glowPts.push(st.p[0], 14, st.p[1]);
    });
    MAP.tables.forEach(function (tb) { misc.box(tb.x, tb.y, 12, 7, 6, 7, tb.ang, tblC, tblC, { ao: 0.95 }); glowPts.push(tb.x, 9, tb.y); });
    scene.add(misc.mesh(new T.MeshLambertMaterial({ vertexColors: true })));

    // 바닥 조명 (노란 줄)
    var fl = new Builder(), flc = hex("#FFE680");
    ST.forEach(function (s) {
      var ang = Math.atan2(s.uy, s.ux);
      for (var dd = 16; dd < s.len - 10; dd += 26) [-1, 1].forEach(function (side) {
        var p = MAP.pointOn(s, dd, side * (s.w / 2 - 8)); fl.box(p[0], p[1], 13, 1.6, 0.1, 0.5, ang, flc, flc, { ao: 1 });
      });
    });
    scene.add(fl.mesh(new T.MeshBasicMaterial({ vertexColors: true })));

    // 빛 번짐 (간판·전구·테이블)
    var gt = glowTex();
    function points(arr, size, op) {
      var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
      var m = new T.PointsMaterial({ map: gt, size: size, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, color: 0xffffff });
      var pts = new T.Points(g, m); scene.add(pts); return pts;
    }
    glowBig = points(glowPts, 46, 0.38);
    glowSmall = points(bulbPts, 16, 0.9);
    var bulbGeo = new T.BufferGeometry(); bulbGeo.setAttribute("position", new T.Float32BufferAttribute(bulbPts, 3));
    scene.add(new T.Points(bulbGeo, new T.PointsMaterial({ color: 0xFFF6CF, size: 2.2, sizeAttenuation: true })));

    // 사람 (실제 비율, 2030년의 정돈된 흐름)
    function cyl(r0, r1, h, x, y, z, rz) { var c = new T.CylinderGeometry(r0, r1, h, 7); if (rz) c.rotateZ(rz); c.translate(x, y, z); return c; }
    var hd = new T.SphereGeometry(1.45, 10, 8); hd.scale(1, 1.15, 1.05); hd.translate(0, 15.3, 0);
    var g = mergeGeos([
      cyl(0.95, 0.7, 7.6, -1.0, 3.8, 0), cyl(0.95, 0.7, 7.6, 1.0, 3.8, 0),          // 다리
      cyl(2.2, 1.75, 6.6, 0, 10.6, 0),                                               // 몸통
      cyl(0.6, 0.5, 6.0, -2.55, 10.4, 0, 0.08), cyl(0.6, 0.5, 6.0, 2.55, 10.4, 0, -0.08), // 팔
      cyl(0.6, 0.6, 1.2, 0, 13.9, 0), hd                                             // 목, 머리
    ]);
    var n = (CFG.agents3d || 520);
    people = new T.InstancedMesh(g, new T.MeshLambertMaterial({ color: 0xffffff }), n);
    peopleAgents = MAP.makeAgents(n, 77, null);
    var pc = [COL.ink, "#3B3D36", COL.sub, COL.dnaCharcoal, "#4A4C44", "#2A2C26", "#8C7B4C"];
    for (var j = 0; j < n; j++) people.setColorAt(j, hex(pc[(R() * pc.length) | 0]));
    people.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(people);
    dummy = new T.Object3D();

    // 제품 자리 (빛 웅덩이)
    api.spotGlow = [];
    MAP.spots.forEach(function (sp) {
      var m = new T.Mesh(new T.CircleGeometry(26, 32), new T.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(sp[0], 0.4, sp[1]); scene.add(m); api.spotGlow.push(m);
    });

    camera = new T.PerspectiveCamera(32, 1, 2, 6000);
  }

  function mergeGeos(list) {
    var pos = [], nrm = [];
    list.forEach(function (g) {
      var gg = g.index ? g.toNonIndexed() : g;
      pos.push.apply(pos, gg.attributes.position.array); nrm.push.apply(nrm, gg.attributes.normal.array);
    });
    var out = new T.BufferGeometry();
    out.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
    return out;
  }

  /* ---------- 사람 움직이기 ---------- */
  function updatePeople(t) {
    var n = peopleAgents.length;
    for (var i = 0; i < n; i++) {
      var a = peopleAgents[i], p = MAP.agentAt(a, t, false), q = MAP.agentAt(a, t + 2, false);
      var dx = q[0] - p[0], dz = q[1] - p[1], moving = Math.abs(dx) + Math.abs(dz) > 0.01;
      dummy.position.set(p[0], moving ? Math.abs(Math.sin(t * 0.35 + i)) * 0.6 : 0, p[1]);
      dummy.rotation.set(0, moving ? Math.atan2(dx, dz) : 0, 0);
      var sc = 0.92 + (i % 7) * 0.025;
      var cx = p[0] - camera.position.x, cz = p[1] - camera.position.z;
      if (camera.position.y < 80 && cx * cx + cz * cz < 55 * 55) sc = 0;          // 카메라 바로 앞 사람은 숨김 (화면 가림 방지)
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix(); people.setMatrixAt(i, dummy.matrix);
    }
    people.instanceMatrix.needsUpdate = true;
  }

  /* ---------- 카메라 ---------- */
  var tmpCam;
  // 2D 지도의 화면과 똑같이 보이는 '바로 위' 카메라
  function topDown(fx, fy, k, ch, fov) {
    fov = fov || 32;
    var hgt = (ch / k) / 2 / Math.tan(fov * Math.PI / 360);
    return { pos: new T.Vector3(fx, hgt, fy), look: new T.Vector3(fx, 0, fy), up: new T.Vector3(0, 0, -1), fov: fov };
  }
  function key(pos, look, up, fov) { return { pos: pos, look: look, up: up || new T.Vector3(0, 1, 0), fov: fov }; }
  function quatOf(kf) {
    if (!tmpCam) tmpCam = new T.PerspectiveCamera();
    tmpCam.position.copy(kf.pos); tmpCam.up.copy(kf.up); tmpCam.lookAt(kf.look); return tmpCam.quaternion.clone();
  }
  // 여러 지점을 부드럽게 잇는 카메라 길 (0~1)
  function path(keys, t) {
    var n = keys.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    var p0 = keys[Math.max(0, i - 1)].pos, p1 = keys[i].pos, p2 = keys[i + 1].pos, p3 = keys[Math.min(n, i + 2)].pos;
    var pos = new T.Vector3(), f2 = f * f, f3 = f2 * f;
    ["x", "y", "z"].forEach(function (c) {
      pos[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * f + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * f3);
    });
    keys[i].q = keys[i].q || quatOf(keys[i]); keys[i + 1].q = keys[i + 1].q || quatOf(keys[i + 1]);
    var q = keys[i].q.clone().slerp(keys[i + 1].q, f);
    return { pos: pos, q: q, fov: lerp(keys[i].fov, keys[i + 1].fov, f) };
  }

  /* ---------- 밖에서 쓰는 기능 ---------- */
  api.init = function () {
    if (api.ok) return true;
    try {
      canvas = document.createElement("canvas"); canvas.className = "c3d";
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      build(); api.ok = true;
      if (document.fonts && document.fonts.load) document.fonts.load("700 34px Pretendard", "명동분식").then(function () { if (api.redrawSigns) api.redrawSigns(); });
    } catch (e) { api.ok = false; }
    return api.ok;
  };
  api.attach = function (parent) {
    if (!api.ok) return;
    if (canvas.parentNode !== parent) parent.appendChild(canvas);
    api.resize();
  };
  api.resize = function () {
    if (!api.ok || !canvas.parentNode) return;
    var w = canvas.parentNode.clientWidth, h = canvas.parentNode.clientHeight;
    if (w === W0 && h === H0) return;
    W0 = w; H0 = h; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  };
  api.size = function () { return [W0, H0]; };
  api.topDown = topDown; api.key = key; api.V = function (x, y, z) { return new T.Vector3(x, y, z); };
  api.EYE = EYE;
  // 카메라 놓고 그리기
  api.render = function (cam, t) {
    if (!api.ok) return;
    api.resize();
    camera.position.copy(cam.pos);
    if (cam.q) camera.quaternion.copy(cam.q); else { camera.up.copy(cam.up); camera.lookAt(cam.look); }
    if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    var dist = cam.pos.y;                                    // 높이 올라갈수록 안개를 멀리 (전체 지도가 또렷하게)
    scene.fog.near = Math.max(520, dist * 1.1); scene.fog.far = Math.max(2600, dist * 3.2);
    updatePeople(t);
    var pulse = 0.55 + 0.15 * Math.sin(t * 0.08);
    api.spotGlow.forEach(function (m, i) { m.material.opacity = api.spotOn ? (api.spotOn === i + 1 ? 1 : 0.35) : pulse * 0.6; });
    renderer.render(scene, camera);
  };
  api.path = path;
  api.canvas = function () { return canvas; };

  /* 장면별 카메라 길 */
  // 하늘(2D 지도와 같은 화면) → 골목 a3 눈높이 (북쪽 큰길을 바라봄)
  api.descentKeys = function (fx, fy, k, ch) {
    var a3 = ST[4], e = MAP.pointOn(a3, 430, 0), look = MAP.pointOn(a3, 40, 0);
    return [
      topDown(fx, fy, k, ch, 32),
      key(new T.Vector3(e[0] + 20, 380, e[1] + 220), new T.Vector3(look[0], 0, look[1] + 120), null, 40),
      key(new T.Vector3(e[0] + 4, 60, e[1] + 30), new T.Vector3(look[0], 30, look[1]), null, 52),
      key(new T.Vector3(e[0], EYE, e[1]), new T.Vector3(look[0], EYE + 6, look[1]), null, 58)
    ];
  };
  // 제품 고르기: 네 제품이 한눈에 보이는 비스듬한 하늘 시점 (shift = 화면 왼쪽 목록만큼 지도를 오른쪽으로)
  api.overviewKey = function (shift, isMobile) {
    var c = isMobile ? new T.Vector3(860, 0, 480) : new T.Vector3(860 - (shift || 0), 0, 440);
    var off = isMobile ? new T.Vector3(0, 1900, 900) : new T.Vector3(0, 1080, 760);
    return key(c.clone().add(off), c, null, isMobile ? 46 : 42);
  };
  // 네 제품이 화면의 정해진 영역(px) 안에 꼭 들어오도록 하늘 시점을 자동으로 맞춤
  api.overviewFit = function (r, isMobile) {
    if (!tmpCam) tmpCam = new T.PerspectiveCamera();
    var dir = (isMobile ? new T.Vector3(0, 1900, 900) : new T.Vector3(0, 1080, 760)).normalize();
    var fov = isMobile ? 46 : 42, elev = Math.asin(dir.y);
    var c = new T.Vector3(0, 0, 0); MAP.spots.forEach(function (sp) { c.x += sp[0] / 4; c.z += sp[1] / 4; });
    var d = 1600, v = new T.Vector3();
    tmpCam.fov = fov; tmpCam.aspect = W0 / Math.max(1, H0); tmpCam.near = 2; tmpCam.far = 8000; tmpCam.updateProjectionMatrix();
    for (var it = 0; it < 10; it++) {
      tmpCam.position.copy(c).addScaledVector(dir, d); tmpCam.up.set(0, 1, 0); tmpCam.lookAt(c); tmpCam.updateMatrixWorld();
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      MAP.spots.forEach(function (sp) {
        v.set(sp[0], 22, sp[1]).project(tmpCam);
        var sx = (v.x + 1) / 2 * W0, sy = (1 - v.y) / 2 * H0;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      });
      var sc = Math.max((x1 - x0) / Math.max(40, r.x1 - r.x0), (y1 - y0) / Math.max(40, r.y1 - r.y0));
      var wpp = 2 * d * Math.tan(fov * Math.PI / 360) / H0;
      c.x += ((x0 + x1) / 2 - (r.x0 + r.x1) / 2) * wpp;
      c.z += ((y0 + y1) / 2 - (r.y0 + r.y1) / 2) * wpp / Math.sin(elev);
      d = clamp(d * clamp(sc, 0.6, 1.6), 500, 6000);
    }
    return key(c.clone().addScaledVector(dir, d), c.clone(), null, fov);
  };
  // 제품 j 를 바라보는 눈높이 시점
  api.eyeKey = function (j) {
    var ss = SPOT_STREET[j], s = ST[ss[0]], from = ss[1] + 150 <= s.len ? ss[1] + 150 : ss[1] - 150;
    var lane = s.kind === "main" ? 30 : 0, e = MAP.pointOn(s, from, lane), sp = MAP.spots[j];
    return key(new T.Vector3(e[0], EYE + 4, e[1]), new T.Vector3(sp[0], EYE, sp[1]), null, 46);
  };
  // 아무 시점 → 제품 j (중간에 살짝 떠올라 골목 위를 날아감)
  api.flyKeys = function (from, j) {
    var to = api.eyeKey(j), mid = from.pos.clone().lerp(to.pos, 0.5), sp = MAP.spots[j];
    var high = Math.max(260, Math.min(520, from.pos.distanceTo(to.pos) * 0.45));
    if (from.pos.y > 400) high = Math.min(from.pos.y * 0.55, 600);
    return [from, key(new T.Vector3(mid.x, high, mid.z), new T.Vector3(sp[0], 0, sp[1]), null, 44), to];
  };
  // 화면 좌표 (3D 위치 → 화면 px)
  var pv = null;
  api.project = function (x, y, z) {
    if (!pv) pv = new T.Vector3();
    pv.set(x, y, z).project(camera);
    return [(pv.x + 1) / 2 * W0, (1 - pv.y) / 2 * H0, pv.z < 1];
  };
  api.cameraKey = function () {
    var k = key(camera.position.clone(), camera.position.clone().add(new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)), null, camera.fov);
    k.q = camera.quaternion.clone(); return k;
  };
  api.backKeys = function (from, to) {
    var mid = from.pos.clone().lerp(to.pos, 0.35); mid.y = Math.max(mid.y, 420);
    return [from, key(mid, to.look.clone(), null, (from.fov + to.fov) / 2), to];
  };

  // 제품 자리로 내려가기 (j = 0~3)
  var SPOT_STREET = [[2, 330], [1, 760], [0, 1250], [8, 290]];
  api.spotKeys = function (j, fx, fy, k, ch) {
    var ss = SPOT_STREET[j], s = ST[ss[0]], from = ss[1] + 150 <= s.len ? ss[1] + 150 : ss[1] - 150;
    var lane = s.kind === "main" ? 30 : 0, e = MAP.pointOn(s, from, lane), sp = MAP.spots[j];
    var midA = MAP.pointOn(s, (from + ss[1]) / 2, 0);
    return [
      topDown(fx, fy, k, ch, 32),
      key(new T.Vector3(midA[0], 300, midA[1]), new T.Vector3(sp[0], 0, sp[1]), null, 40),
      key(new T.Vector3(e[0], EYE + 4, e[1]), new T.Vector3(sp[0], EYE, sp[1]), null, 46)
    ];
  };
})();
