/* =========================================================
   ⑦ Choose a Product — 명동 미니어처 (v8.1)
   - 두툼한 팔각 받침대 위의 작은 명동: 명동역 출구 · 명동길(노점 줄) · 중앙로 · 골목 · 명동성당
   - 제품은 실제로 놓일 만한 자리에: FLOWAY=명동역 출구 앞 / STAY:GAP=명동길 가게 벽 /
     STREET FOLD=노점 옆 골목 / NAVIAR=노점 거리 끝 수거 지점
   - 들어오면 건물이 하나둘 솟아오르고(로딩을 가림), 도시 밖에서 스크롤해 나가면 하나둘 땅으로 들어감
   - 도시 위에서 휠 = 확대·축소 (가까이 가면 사람들이 걸어 다님) / 끌기 = 360° 회전
   - 낮/밤 버튼: 받침대가 180° 돌며 건물이 다시 솟고, 밤의 명동으로 바뀜
   ========================================================= */
(function () {
  "use strict";
  var T = window.THREE;
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function outBack(t) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function inOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

  var api = window.MDSelect = {};
  var O = null;          // 바깥에서 넘겨받는 것 (문구, 3D 모델, 기기 정보)
  var R = 21;            // 받침대 반지름 (1 = 약 10 m)
  var ok = false, renderer, scene, camera, world, holder;
  var S = { yaw: -.55, pitch: .82, dist: 96, distT: 96, tx: 0, tz: 0, ty: 0, vyaw: 0,
            rise: 0, risen: false, sink: 0, night: false, swap: 0, swapping: false, swapDir: 1,
            hot: -1, focus: -1, mode: "overview", inView: false, built: false, tLive: 0 };

  /* ---------- 팔레트 (낮 / 밤) ---------- */
  var PAL = {
    day:   { hemiSky: 0xFFF6E2, hemiGround: 0xB8AE96, hemi: 1.35, sun: 0xFFF0D2, sunI: 2.4, amb: 0xffffff, ambI: .18,
             ground: 0xEFE6CF, paving: 0xC7BCA3, street: 0x9E9A90, curb: 0xBDB39C, soil1: 0x8F7F64, soil2: 0x6E604A, soil3: 0x4D4334, rim: 0xF2D94B, rimI: .0,
             win: 0x4E5A63, glowI: 0, lamp: 0xFFF1C8, lampI: 0, sky: null },
    night: { hemiSky: 0x7A8CE0, hemiGround: 0x2A2440, hemi: 1.05, sun: 0xA9BEFF, sunI: .8, amb: 0x9AA4ff, ambI: .25,
             ground: 0x4A4C66, paving: 0x5A5870, street: 0x34364A, curb: 0x6A6880, soil1: 0x2E2A36, soil2: 0x221F2A, soil3: 0x16141C, rim: 0xF2D94B, rimI: 2.2,
             win: 0x20242E, glowI: 1, lamp: 0xFFD98A, lampI: 2.6, sky: null }
  };

  /* ---------- 공용 재질 (낮/밤 바꿀 때 색만 바꿈) ---------- */
  var M = {};
  function std(c, r, extra) { var m = new T.MeshStandardMaterial({ color: c, roughness: r == null ? .85 : r, metalness: 0 }); if (extra) for (var k in extra) m[k] = extra[k]; return m; }
  function canvasTex(w, h, draw) { var c = doc.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }

  // 창문: 한 장 = 가로 4칸 × 세로 3층. 낮에는 유리, 밤에는 불 켜진 창(빛 지도)
  var WIN_DAY, WIN_NIGHT;
  function makeWindowTex() {
    WIN_DAY = canvasTex(128, 96, function (g, w, h) {
      g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
      for (var fy = 0; fy < 3; fy++) for (var fx = 0; fx < 4; fx++) {
        var x = fx * 32 + 6, y = fy * 32 + 7;
        g.fillStyle = "#7D8A93"; g.fillRect(x, y, 20, 17);
        g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y, 20, 4);
        g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x, y + 17, 20, 2);
      }
    });
    WIN_NIGHT = canvasTex(256, 192, function (g, w, h) {
      g.fillStyle = "#000"; g.fillRect(0, 0, w, h); var r = rng(77);
      for (var fy = 0; fy < 6; fy++) for (var fx = 0; fx < 8; fx++) {
        var x = fx * 32 + 6, y = fy * 32 + 7, on = r();
        if (on < .58) { var c = r(); g.fillStyle = c < .7 ? "rgb(255," + (190 + (r() * 40 | 0)) + ",120)" : c < .9 ? "#BFE3FF" : "#FF9BC4"; g.globalAlpha = .55 + r() * .45; g.fillRect(x, y, 20, 17); g.globalAlpha = 1; }
      }
    });
    [WIN_DAY, WIN_NIGHT].forEach(function (t) { t.wrapS = t.wrapT = T.RepeatWrapping; });
    WIN_NIGHT.repeat.set(.5, .5);
  }
  var FACADES = [0xF1EBDD, 0xE3D6BF, 0xD5D2CB, 0xC9B79B, 0xB9C2C7, 0xE8DCCB, 0xCDBCA6, 0xA9B4B8];
  function facadeMat(i) {
    var key = "fac" + i; if (M[key]) return M[key];
    var m = std(FACADES[i % FACADES.length], .82); m.map = WIN_DAY; m.emissiveMap = WIN_NIGHT; m.emissive = new T.Color(0xffffff); m.emissiveIntensity = 0;
    M[key] = m; return m;
  }

  /* ---------- 받침대 · 땅 · 길 ---------- */
  var STREETS = [
    { id: "main",  a: [-R, 0],    b: [R, 0],      w: 3.4, kind: "main",  name: "명동길" },
    { id: "cross", a: [4.6, -R],  b: [4.6, R],    w: 2.8, kind: "road",  name: "중앙로" },
    { id: "alA",   a: [-7.6, -R], b: [-7.6, 0],   w: 1.25, kind: "alley" },
    { id: "alB",   a: [13, 0],    b: [13, R],     w: 1.25, kind: "alley" },
    { id: "alC",   a: [-R, -9],   b: [4.6, -9],   w: 1.15, kind: "alley" },
    { id: "alD",   a: [-R, 9.5],  b: [4.6, 9.5],  w: 1.15, kind: "alley" }
  ];
  function octagon(r) { var pts = []; for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } return pts; }
  function inOct(x, z, r) { var p = octagon(r); for (var i = 0; i < 8; i++) { var a = p[i], b = p[(i + 1) % 8]; if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; } return true; }
  function onStreet(x, z, pad) {
    for (var i = 0; i < STREETS.length; i++) {
      var s = STREETS[i], hw = s.w / 2 + (pad || 0);
      var minx = Math.min(s.a[0], s.b[0]) - hw, maxx = Math.max(s.a[0], s.b[0]) + hw, minz = Math.min(s.a[1], s.b[1]) - hw, maxz = Math.max(s.a[1], s.b[1]) + hw;
      if (x > minx && x < maxx && z > minz && z < maxz) return s;
    }
    return null;
  }
  function plinth() {
    var g = new T.Group(), pts = octagon(R + .6);
    function slabShape(r) { var sh = new T.Shape(), p = octagon(r); sh.moveTo(p[0][0], -p[0][1]); for (var i = 1; i < 8; i++) sh.lineTo(p[i][0], -p[i][1]); sh.closePath(); return sh; }
    function layer(r, y0, h, mat, bevel) {
      var geo = new T.ExtrudeGeometry(slabShape(r), { depth: h, bevelEnabled: !!bevel, bevelSize: .25, bevelThickness: .2, bevelSegments: 2, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2); geo.translate(0, y0, 0);
      var m = new T.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
    }
    M.soil1 = std(PAL.day.soil1, .95); M.soil2 = std(PAL.day.soil2, .95); M.soil3 = std(PAL.day.soil3, .95);
    M.ground = std(PAL.day.ground, .92); M.rim = std(0x222222, .4, { emissive: new T.Color(PAL.day.rim), emissiveIntensity: 0 });
    layer(R + .9, -4.2, 1.3, M.soil3);
    layer(R + .75, -2.9, 1.25, M.soil2);
    layer(R + .65, -1.65, 1.2, M.soil1);
    // 밤에 빛나는 띠 (받침대 옆면)
    var band = layer(R + .78, -1.95, .1, M.rim);
    layer(R + .55, -.66, .45, M.ground, true);   // 윗면 = y 0 (모서리 둥글림 .2 포함)
    // 아래로 뾰족한 흙 덩어리 (떠 있는 섬처럼)
    var cone = new T.Mesh(new T.CylinderGeometry(R * .82, R * .25, 5, 8, 1), M.soil3); cone.rotation.y = Math.PI / 8; cone.position.y = -6.6; g.add(cone);
    return g;
  }

  /* 길 · 보도 블록 */
  function streets(group) {
    M.street = std(PAL.day.street, .9); M.paving = std(PAL.day.paving, .9); M.curb = std(PAL.day.curb, .9);
    M.line = std(0xF2D94B, .6, { emissive: new T.Color(0xF2D94B), emissiveIntensity: 0 });
    var paveTex = canvasTex(64, 64, function (g, w, h) { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(0,0,0,.09)"; g.lineWidth = 1.5; for (var i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 16 + (i % 2) * 0); g.lineTo(w, i * 16); g.stroke(); } });
    paveTex.wrapS = paveTex.wrapT = T.RepeatWrapping; M.paving.map = paveTex; M.street.map = paveTex;
    STREETS.forEach(function (s, si) {
      var dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
      var geo = new T.BoxGeometry(len, .06, s.w);
      var uv = geo.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len * .7, uv.getY(i) * s.w * .7);
      var m = new T.Mesh(geo, s.kind === "road" ? M.street : M.paving);
      // v9.2 z-fighting: 길이 겹치는 교차로에서 윗면이 같은 높이라 지글거림 → 길마다 높이를 아주 조금씩 다르게 (중앙로가 가장 위)
      var yOff = s.kind === "road" ? .022 : si * .0045;
      m.position.set((s.a[0] + s.b[0]) / 2, .03 + yOff, (s.a[1] + s.b[1]) / 2); m.rotation.y = -ang; m.receiveShadow = true;
      clipToOct(m, s); group.add(m);
      if (s.kind === "road") {   // 중앙로: 가운데 노란 점선
        for (var d = -R + 1; d < R - 1; d += 1.6) { var l = new T.Mesh(new T.BoxGeometry(.12, .02, .7), M.line); l.position.set(s.a[0], .092, d); if (inOct(l.position.x, l.position.z, R - .5)) group.add(l); }
      }
    });
  }
  function clipToOct(m, s) {   // 받침대 밖으로 나가는 길은 잘라냄 (간단히: 길이를 줄임)
    var a = s.a.slice(), b = s.b.slice(), steps = 60;
    for (var i = 0; i < steps && !inOct(a[0], a[1], R - .2); i++) { a[0] += (b[0] - a[0]) / steps * 2; a[1] += (b[1] - a[1]) / steps * 2; }
    for (i = 0; i < steps && !inOct(b[0], b[1], R - .2); i++) { b[0] += (a[0] - b[0]) / steps * 2; b[1] += (a[1] - b[1]) / steps * 2; }
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]), full = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    m.scale.x = len / full; m.position.set((a[0] + b[0]) / 2, m.position.y, (a[1] + b[1]) / 2);
  }

  /* ---------- 건물 (하나씩 솟아오를 수 있게 따로따로) ---------- */
  var BLD = [];   // { g, h, delay, x, z }
  function boxGeoUV(w, h, d) {
    var geo = new T.BoxGeometry(w, h, d), uv = geo.attributes.uv, nrm = geo.attributes.normal;
    for (var i = 0; i < uv.count; i++) {
      var nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
      if (ny > .5) { uv.setXY(i, 0, 0); continue; }                       // 지붕: 창문 없음 (흰 칸)
      var across = nx > .5 ? d : w;
      uv.setXY(i, uv.getX(i) * across / 1.25, uv.getY(i) * h / .95);
    }
    geo.translate(0, h / 2, 0); return geo;
  }
  var SIGN_COLORS = [0xE8473C, 0xF2D94B, 0x2F7FE0, 0x36B37E, 0xF07AB0, 0xFF8A2A, 0x8E5BE8, 0x1FB8C9];
  var signMats = [];
  function signMat(c) { var m = std(c, .5, { emissive: new T.Color(c), emissiveIntensity: .05 }); signMats.push(m); return m; }
  function building(group, x, z, w, d, h, face, r, opt) {
    opt = opt || {};
    var g = new T.Group(); g.position.set(x, 0, z);
    var fm = facadeMat((r() * FACADES.length) | 0);
    var body = new T.Mesh(boxGeoUV(w, h, d), fm); body.castShadow = true; body.receiveShadow = true; g.add(body);
    // 1층 가게 (밝은 유리 + 차양)
    var shopH = Math.min(.55, h * .3), fx = face[0], fz = face[1];
    var glass = new T.Mesh(new T.BoxGeometry(fx ? .04 : w * .86, shopH, fx ? d * .86 : .04), M.shop); glass.position.set(fx * (w / 2 + .02), shopH / 2 + .02, fz * (d / 2 + .02)); g.add(glass);
    var awnC = SIGN_COLORS[(r() * SIGN_COLORS.length) | 0];
    var awn = new T.Mesh(new T.BoxGeometry(fx ? .32 : w * .9, .05, fx ? d * .9 : .32), signMat(awnC)); awn.position.set(fx * (w / 2 + .16), shopH + .06, fz * (d / 2 + .16)); awn.rotation.set(fz * .25, 0, -fx * .25); awn.castShadow = true; g.add(awn);
    // 세로 간판 (명동 느낌: 건물마다 1~2개)
    var ns = h > 1.6 ? 1 + (r() < .5 ? 1 : 0) : (r() < .5 ? 1 : 0);
    for (var k = 0; k < ns; k++) {
      var sh = Math.min(h * .55, .8 + r() * 1.2), sc = SIGN_COLORS[(r() * SIGN_COLORS.length) | 0];
      var sg = new T.Mesh(new T.BoxGeometry(fx ? .34 : .07, sh, fx ? .07 : .34), signMat(sc));
      var off = (k ? -1 : 1) * (r() * .3 + .15);
      sg.position.set(fx ? fx * (w / 2 + .2) : off * w, shopH + .25 + sh / 2 + r() * Math.max(0, h - shopH - sh - .5), fz ? fz * (d / 2 + .2) : off * d);
      sg.castShadow = true; g.add(sg);
    }
    // 지붕 소품 (실외기 · 물탱크)
    var nr = 1 + (r() * 3 | 0);
    for (var q = 0; q < nr; q++) { var bx = new T.Mesh(new T.BoxGeometry(.25 + r() * .3, .16 + r() * .2, .25 + r() * .3), M.roofBox); bx.position.set((r() - .5) * w * .6, h + .1, (r() - .5) * d * .6); bx.castShadow = true; g.add(bx); }
    if (opt.billboard) { var bb = new T.Mesh(new T.BoxGeometry(fx ? .06 : w * .8, .9, fx ? d * .8 : .06), signMat(opt.billboard)); bb.position.set(fx * (w / 2 + .05), h * .72, fz * (d / 2 + .05)); g.add(bb); }
    g.userData.h = h; group.add(g);
    BLD.push({ g: g, delay: 0, x: x, z: z });
    return g;
  }

  /* 블록 채우기: 길 사이 빈 땅을 건물로 */
  function fillBlocks(group) {
    var r = rng(2030), step = 2.3;
    for (var gx = -R + 1.2; gx < R - 1; gx += step) for (var gz = -R + 1.2; gz < R - 1; gz += step) {
      var w = 1.6 + r() * 1.3, d = 1.6 + r() * 1.3, x = gx + (r() - .5) * .5, z = gz + (r() - .5) * .5;
      if (!inOct(x, z, R - 1.2)) continue;
      // 받침대 가장자리: 네 모서리가 다 땅 안에 들어오도록 줄이고, 그래도 안 되면 작은 화단으로 바꿈
      var fits = function (ww, dd) { return inOct(x - ww / 2 - .25, z - dd / 2 - .25, R - .35) && inOct(x + ww / 2 + .25, z - dd / 2 - .25, R - .35) && inOct(x - ww / 2 - .25, z + dd / 2 + .25, R - .35) && inOct(x + ww / 2 + .25, z + dd / 2 + .25, R - .35); };
      if (!fits(w, d)) { w *= .7; d *= .7; }
      if (!fits(w, d)) { if (!onStreet(x, z, .7)) planter(group, x, z); continue; }
      if (onStreet(x, z, Math.max(w, d) / 2 + .25)) continue;
      if (RESERVED.some(function (q) { return Math.hypot(q[0] - x, q[1] - z) < q[2] + Math.max(w, d) * .5; })) continue;   // v8: 건물 크기까지 보고 비켜 섬
      // 가장 가까운 길을 향하도록 (가게 앞면)
      var best = null, bd = 1e9;
      STREETS.forEach(function (s) {
        var horiz = s.a[1] === s.b[1], dd = horiz ? Math.abs(z - s.a[1]) : Math.abs(x - s.a[0]);
        if (dd < bd) { bd = dd; best = s; }
      });
      var face = best.a[1] === best.b[1] ? [0, z < best.a[1] ? 1 : -1] : [x < best.a[0] ? 1 : -1, 0];
      var nearMain = Math.abs(z) < 7 && best.id === "main";
      var h = nearMain ? 1.4 + r() * 2.6 : (best.kind === "alley" ? 1 + r() * 1.8 : 1.6 + r() * 3.6);
      if (Math.hypot(x, z) > R * .72) h *= .8;
      building(group, x, z, w, d, h, face, r, { billboard: h > 3.4 && r() < .4 ? SIGN_COLORS[(r() * 8) | 0] : 0 });
    }
  }
  // 제품 자리 · 명동역 · 성당 자리는 비워 둠
  var RESERVED = [[-16.5, 3.4, 2.2], [999, 999, 0], [-12, 12.2, 3.0],
                  [-13.6, 2.2, 1.7], [1.2, -2.15, 1.5], [-8.35, -3.6, 1.6], [11.2, 2.4, 1.7]];   // 명동역 · 성당 · 백화점 · 제품 4곳
  function nearSpot(x, z, r) { return RESERVED.slice(3).some(function (q) { return Math.hypot(q[0] - x, q[1] - z) < (r || 1.7); }); }

  /* ---------- 명소 ---------- */
  function cathedral(group) {   // 명동성당 (언덕 위 붉은 벽돌 + 첨탑)
    var g = new T.Group(); g.position.set(11, 0, -11.6);
    var brick = M.brick, roof = M.slate;
    var hill = new T.Mesh(new T.CylinderGeometry(3.7, 4.1, .5, 8), M.grass); hill.position.y = .25; hill.receiveShadow = true; g.add(hill);
    var nave = new T.Mesh(new T.BoxGeometry(5.2, 1.9, 2.2), brick); nave.position.set(0, 1.45, 0); nave.castShadow = true; g.add(nave);
    var rf = new T.Mesh(new T.CylinderGeometry(.01, 1.35, 5.4, 4, 1), roof); rf.rotation.set(0, Math.PI / 4, Math.PI / 2); rf.scale.set(1, 1, .8); rf.position.set(0, 2.75, 0); g.add(rf);
    var tower = new T.Mesh(new T.BoxGeometry(1.05, 3.3, 1.05), brick); tower.position.set(-3, 2.15, 0); tower.castShadow = true; g.add(tower);
    var spire = new T.Mesh(new T.ConeGeometry(.62, 2.6, 8), roof); spire.position.set(-3, 5.1, 0); spire.castShadow = true; g.add(spire);
    var cross = new T.Mesh(new T.BoxGeometry(.06, .45, .06), M.gold); cross.position.set(-3, 6.6, 0); g.add(cross);
    var crossH = new T.Mesh(new T.BoxGeometry(.25, .06, .06), M.gold); crossH.position.set(-3, 6.65, 0); g.add(crossH);
    var rose = new T.Mesh(new T.CircleGeometry(.28, 16), signMat(0xF2D94B)); rose.position.set(-3, 2.6, .53); g.add(rose);
    group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: 11, z: -11.6, landmark: true });
    // 성당 앞 나무
    [[-1.5, 2.6], [1.8, 2.7], [3.4, 1.8]].forEach(function (p) { tree(group, 11 + p[0], -11.6 + p[1], 1.1); });
  }
  function station(group) {   // 명동역 출구 (지하철 4호선 — 파란 원 표지 + 유리 지붕 + 내려가는 계단)
    var g = new T.Group(); g.position.set(-16.5, 0, 3.4);
    var wall = new T.Mesh(new T.BoxGeometry(2.6, .5, 1.2), M.stone); wall.position.set(0, .25, 0); wall.castShadow = true; g.add(wall);
    var stairs = new T.Group();
    for (var i = 0; i < 6; i++) { var st = new T.Mesh(new T.BoxGeometry(1.9, .08, .16), M.paving); st.position.set(0, .45 - i * .08, -.45 + i * .16); stairs.add(st); }
    g.add(stairs);
    var roof = new T.Mesh(new T.BoxGeometry(2.8, .08, 1.5), M.glass); roof.position.set(0, 1.15, 0); g.add(roof);
    [-1.3, 1.3].forEach(function (x) { var p = new T.Mesh(new T.BoxGeometry(.08, 1.1, .08), M.metal); p.position.set(x, .6, -.6); g.add(p); var p2 = p.clone(); p2.position.z = .6; g.add(p2); });
    var ring = new T.Mesh(new T.CylinderGeometry(.32, .32, .06, 24), signMat(0x2F7FE0)); ring.rotation.x = Math.PI / 2; ring.position.set(1.6, 1.25, .2); g.add(ring);
    var post = new T.Mesh(new T.CylinderGeometry(.04, .04, 1.25, 8), M.metal); post.position.set(1.6, .62, .2); g.add(post);
    var four = new T.Mesh(new T.CircleGeometry(.2, 20), M.white); four.position.set(1.6, 1.25, .235); g.add(four);
    group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: -16.5, z: 3.4, landmark: true });
  }
  function tree(group, x, z, s) {
    s = s || 1;
    var g = new T.Group(); g.position.set(x, 0, z);
    var tr = new T.Mesh(new T.CylinderGeometry(.06 * s, .08 * s, .6 * s, 6), M.trunk); tr.position.y = .3 * s; g.add(tr);
    var cr = new T.Mesh(new T.IcosahedronGeometry(.42 * s, 0), M.leaf); cr.position.y = .85 * s; cr.castShadow = true; g.add(cr);
    var cr2 = new T.Mesh(new T.IcosahedronGeometry(.3 * s, 0), M.leaf2); cr2.position.set(.18 * s, 1.1 * s, .05 * s); cr2.castShadow = true; g.add(cr2);
    group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: x, z: z, small: true });
  }
  function planter(group, x, z) {
    if (nearSpot(x, z, 1.9)) return;   // 가장자리 빈자리: 낮은 화단 + 작은 나무 (받침대 밖으로 안 나감)
    var g = new T.Group(); g.position.set(x, 0, z);
    var bed = new T.Mesh(new T.BoxGeometry(1.1, .22, 1.1), M.stone); bed.position.y = .11; bed.receiveShadow = true; g.add(bed);
    var soil = new T.Mesh(new T.BoxGeometry(.95, .04, .95), M.grass); soil.position.y = .23; g.add(soil);
    group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: x, z: z, small: true });
    tree(group, x, z, .75);
  }
  // 마지막 점검: 무엇이든 팔각 받침대 밖으로 튀어나오면 → 명소는 안쪽으로 옮기고, 나머지는 빼고 화단으로
  function keepInside(group) {
    var box = new T.Box3(), keep = [], add = [];
    function out(b) { box.setFromObject(b.g); var m = .3; return !(inOct(box.min.x, box.min.z, R - m) && inOct(box.max.x, box.min.z, R - m) && inOct(box.min.x, box.max.z, R - m) && inOct(box.max.x, box.max.z, R - m)); }
    BLD.forEach(function (b) {
      if (!out(b)) { keep.push(b); return; }
      if (b.landmark) { for (var i = 0; i < 30 && out(b); i++) { b.g.position.x *= .96; b.g.position.z *= .96; } b.x = b.g.position.x; b.z = b.g.position.z; keep.push(b); return; }
      group.remove(b.g);
      if (!b.small && inOct(b.x, b.z, R - 1.4)) add.push([b.x, b.z]);
    });
    BLD = keep;
    add.forEach(function (p) { var n = BLD.length; planter(group, p[0], p[1]); for (var k = n; k < BLD.length; k++) if (out(BLD[k])) { group.remove(BLD[k].g); BLD.splice(k, 1); k--; } });
  }
  var LAMPS = [];
  function lamp(group, x, z) {
    var g = new T.Group(); g.position.set(x, 0, z);
    var p = new T.Mesh(new T.CylinderGeometry(.03, .04, 1.1, 6), M.metal); p.position.y = .55; g.add(p);
    var h = new T.Mesh(new T.SphereGeometry(.09, 8, 6), M.lampHead); h.position.y = 1.12; g.add(h);
    group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: x, z: z, small: true }); LAMPS.push(g);
  }
  // 노점 (명동길 가운데 한 줄 — 빨간 차양)
  var STALLS = [];
  function stalls(group) {
    var r = rng(5);
    for (var x = -5.6; x < 10.2; x += 1.45) {
      var g = new T.Group(); g.position.set(x, 0, 0);
      var cart = new T.Mesh(new T.BoxGeometry(1.05, .42, .55), M.cart); cart.position.y = .25; cart.castShadow = true; g.add(cart);
      var top = new T.Mesh(new T.BoxGeometry(1.05, .03, .55), M.white); top.position.y = .47; g.add(top);
      var c = r() < .7 ? 0xD8382F : (r() < .5 ? 0xF2D94B : 0x2F7FE0);
      var can = new T.Mesh(new T.BoxGeometry(1.2, .05, .8), signMat(c)); can.position.y = 1.02; can.castShadow = true; g.add(can);
      [-.5, .5].forEach(function (dx) { var pl = new T.Mesh(new T.CylinderGeometry(.02, .02, .58, 5), M.metal); pl.position.set(dx, .74, -.22); g.add(pl); });
      var food = new T.Mesh(new T.BoxGeometry(.8, .05, .3), M.food); food.position.set(0, .5, 0); g.add(food);
      group.add(g); g.userData.h = 1; BLD.push({ g: g, delay: 0, x: x, z: 0, small: true }); STALLS.push(g);
    }
  }

  /* ---------- 제품 (크게 과장해서 보이게) ---------- */
  var SPOTS = [
    { x: -13.6, z: 2.2,  ry: Math.PI,       where: "명동역 6번 출구 앞" },     // 01 FLOWAY
    { x: 1.2,   z: -2.15, ry: 0,            where: "명동길 가게 벽면" },      // 02 STAY:GAP
    { x: -8.35, z: -3.6, ry: Math.PI / 2,   where: "노점 바로 옆 골목" },     // 03 STREET FOLD
    { x: 11.2,  z: 2.4,  ry: -Math.PI / 2,  where: "노점 거리 끝 수거 지점" }  // 04 NAVIAR
  ];
  var PROD = [];   // { g, ring, holder, model, name }
  function productSpot(group, j) {
    var sp = SPOTS[j], g = new T.Group(); g.position.set(sp.x, 0, sp.z);
    var ring = new T.Mesh(new T.RingGeometry(.85, 1.08, 40), new T.MeshBasicMaterial({ color: 0xF2D94B, transparent: true, opacity: .85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .09; g.add(ring);
    var disc = new T.Mesh(new T.CircleGeometry(.85, 40), new T.MeshBasicMaterial({ color: 0xF2D94B, transparent: true, opacity: .18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = .085; g.add(disc);
    var beam = new T.Mesh(new T.CylinderGeometry(.7, .85, 4.2, 24, 1, true), new T.MeshBasicMaterial({ color: 0xF2D94B, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    beam.position.y = 2.1; g.add(beam);
    var holder = new T.Group(); holder.rotation.y = sp.ry; g.add(holder);
    group.add(g);
    PROD[j] = { g: g, ring: ring, disc: disc, beam: beam, holder: holder, model: null, fallback: null };
    fallbackProduct(j);
  }
  function fallbackProduct(j) {   // 진짜 3D 모델을 아직 못 받았을 때 쓰는 단순한 모양 (실제 비율)
    var P = PROD[j], f = new T.Group();
    if (j === 0) { var k = new T.Mesh(new T.BoxGeometry(.45, 1.5, .3), M.white); k.position.y = .75; f.add(k); var sc = new T.Mesh(new T.BoxGeometry(.36, .5, .02), M.screen); sc.position.set(0, 1.05, .16); f.add(sc); }
    else if (j === 1) { var pl = new T.Mesh(new T.BoxGeometry(.5, 1.3, .12), M.white); pl.position.y = .65; f.add(pl); var seat = new T.Mesh(new T.BoxGeometry(.5, .05, .4), M.wood); seat.position.set(0, .55, .2); f.add(seat); }
    else if (j === 2) { var col = new T.Mesh(new T.BoxGeometry(.34, 2.08, .16), M.white); col.position.y = 1.04; f.add(col); var ringL = new T.Mesh(new T.TorusGeometry(.06, .015, 6, 16), M.white); ringL.position.set(0, 1.32, .09); f.add(ringL); }
    else { var cart = new T.Mesh(new T.BoxGeometry(.55, .7, .45), M.cart); cart.position.y = .45; f.add(cart); var lip = new T.Mesh(new T.BoxGeometry(.57, .07, .47), signMat(0xF2D94B)); lip.position.y = .82; f.add(lip); }
    f.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    f.scale.setScalar(PSCALE[j]); P.holder.add(f); P.fallback = f;
  }
  var PSCALE = [1.15, 1.15, 1.0, 1.1];   // 실제 크기(m)×(1/10)×과장 — 작은 도시에서도 알아보게
  var MODEL_FOR = ["floway", "staygap_motion_v7", "streetfold", "naviar"];
  function tryRealModels() {
    if (!O || !O.C3D || !O.C3D.productRoot) return;
    for (var j = 0; j < 4; j++) {
      var P = PROD[j]; if (!P || P.model) continue;
      var gl = O.C3D.productRoot(MODEL_FOR[j]); if (!gl || !gl.scene) continue;
      var SU = T.SkeletonUtils, m = SU && SU.clone ? SU.clone(gl.scene) : gl.scene.clone(true);
      if (gl.animations && gl.animations.length) {   // STAY:GAP: 레일에서 의자가 펼쳐진 모습으로 멈춰 둠
        try { var mx = new T.AnimationMixer(m), ac = mx.clipAction(gl.animations[0]); ac.play(); ac.paused = true; ac.time = Math.min(gl.animations[0].duration, 184 / 24); mx.update(0); } catch (er) {}
      }
      var box = new T.Box3().setFromObject(m), sz = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      var wrap = new T.Group(), inner = new T.Group(); inner.add(m);
      m.position.set(-c.x, -box.min.y, -c.z);
      m.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) o.material = Array.isArray(o.material) ? o.material.map(function (q) { return q.clone(); }) : o.material.clone(); } });
      // 실제 높이 → 도시 크기: 1 = 10 m 이지만 제품은 6~8배로 크게 (작은 도시에서 알아보도록)
      var targetH = [1.5, 1.35, 2.0, .55][j], s = targetH / Math.max(.001, sz.y);
      if (j === 3) {   // NAVIAR: 바이저만 있으면 작아서 — 환경미화원 + 수레 위에 씌워 보여 줌
        var person = new T.Group(), body = new T.Mesh(new T.CapsuleGeometry(.16, .62, 4, 10), M.vest); body.position.y = .55; person.add(body);
        var head = new T.Mesh(new T.SphereGeometry(.14, 12, 10), M.skin); head.position.y = 1.08; person.add(head);
        var cart = new T.Mesh(new T.BoxGeometry(.5, .55, .4), M.cart); cart.position.set(.5, .3, 0); person.add(cart);
        var lip = new T.Mesh(new T.BoxGeometry(.52, .06, .42), signMat(0xF2D94B)); lip.position.set(.5, .6, 0); person.add(lip);
        person.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
        inner.scale.setScalar(.36 / Math.max(.001, Math.max(sz.x, sz.z))); inner.position.set(0, 1.03, .05);
        wrap.add(person); wrap.add(inner); wrap.scale.setScalar(1.15);
      } else { inner.scale.setScalar(s); wrap.add(inner); }
      if (P.fallback) P.holder.remove(P.fallback);
      P.holder.add(wrap); P.model = wrap;
    }
  }

  /* ---------- 사람 (가까이 확대하면 걸어 다님) ---------- */
  var PEOPLE = null, PN = 220, PDATA = [];
  function people(group) {
    var body = new T.CapsuleGeometry(.07, .2, 3, 6); body.translate(0, .17, 0);
    var mat = std(0xffffff, .8);
    PEOPLE = new T.InstancedMesh(body, mat, PN); PEOPLE.castShadow = true; PEOPLE.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var cols = [0x2F312B, 0x5B6B7A, 0xC9A27E, 0x8A3B3B, 0x3E5A44, 0xE7E1D2, 0x2C3E66, 0xB25C2F];
    var r = rng(9), col = new T.Color();
    for (var i = 0; i < PN; i++) {
      var s = STREETS[r() < .45 ? 0 : r() < .5 ? 1 : 2 + ((r() * 4) | 0)];
      PDATA.push({ s: s, u: r(), v: (r() < .5 ? -1 : 1) * (.012 + r() * .02), lat: (r() - .5) * s.w * .7, ph: r() * 6.28 });
      col.setHex(cols[(r() * cols.length) | 0]); PEOPLE.setColorAt(i, col);
    }
    group.add(PEOPLE);
  }
  var tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3(), UP = new T.Vector3(0, 1, 0);
  function movePeople(dt, show) {
    if (!PEOPLE) return;
    PEOPLE.visible = show > .01;
    if (!PEOPLE.visible) return;
    for (var i = 0; i < PN; i++) {
      var p = PDATA[i], s = p.s, len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      p.u += p.v * dt * 28 / len; if (p.u > 1) p.u -= 1; if (p.u < 0) p.u += 1;
      var ux = (s.b[0] - s.a[0]) / len, uz = (s.b[1] - s.a[1]) / len;
      var x = s.a[0] + ux * p.u * len - uz * p.lat, z = s.a[1] + uz * p.u * len + ux * p.lat;
      var inside = inOct(x, z, R - 1), sc = show * (inside ? 1 : 0) * sstep(.75, 1, S.lvl || 0);
      if (s.id === "main" && Math.abs(p.lat) < .5 && x > -6.3 && x < 10.9) sc = 0;
      if (nearSpot(x, z, 1.0)) sc = 0;   // 제품 자리에는 사람이 겹쳐 서지 않음   // 노점 줄 안에는 안 걸음
      var bob = Math.abs(Math.sin(S.tLive * 9 + p.ph)) * .03;
      tmpP.set(x, bob, z); tmpQ.setFromAxisAngle(UP, Math.atan2(ux * p.v, uz * p.v)); tmpS.setScalar(sc);
      tmpM.compose(tmpP, tmpQ, tmpS); PEOPLE.setMatrixAt(i, tmpM);
    }
    PEOPLE.instanceMatrix.needsUpdate = true;
  }

  /* ---------- 빛 ---------- */
  var L = {};
  function lights() {
    L.hemi = new T.HemisphereLight(PAL.day.hemiSky, PAL.day.hemiGround, PAL.day.hemi); scene.add(L.hemi);
    L.sun = new T.DirectionalLight(PAL.day.sun, PAL.day.sunI); L.sun.position.set(-18, 30, 14); L.sun.castShadow = true;
    var sc = L.sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    L.sun.shadow.mapSize.set(2048, 2048); L.sun.shadow.bias = -.0008; L.sun.shadow.normalBias = .03;
    scene.add(L.sun); scene.add(L.sun.target);
    L.amb = new T.AmbientLight(0xffffff, PAL.day.ambI); scene.add(L.amb);
    // 밤에만: 명동길을 따라 따뜻한 점 조명 몇 개 (그림자 없음)
    L.pts = [];
    [[-12, 0], [-3, 0], [6, 0], [4.6, -8], [4.6, 8], [11, -9]].forEach(function (p) {
      var pl = new T.PointLight(0xFFC76B, 0, 10, 1.6); pl.position.set(p[0], 1.6, p[1]); scene.add(pl); L.pts.push(pl);
    });
  }

  /* ---------- 낮 / 밤 바꾸기 ---------- */
  function applyPalette(night) {
    var P = night ? PAL.night : PAL.day;
    L.hemi.color.setHex(P.hemiSky); L.hemi.groundColor.setHex(P.hemiGround); L.hemi.intensity = P.hemi;
    L.sun.color.setHex(P.sun); L.sun.intensity = P.sunI; L.amb.color.setHex(P.amb); L.amb.intensity = P.ambI;
    L.pts.forEach(function (pl) { pl.intensity = night ? 16 : 0; pl.visible = !!night; });   // v9.2 최적화: 낮에는 밤 조명을 계산에서 뺌
    M.ground.color.setHex(P.ground); M.paving.color.setHex(P.paving); M.street.color.setHex(P.street); M.curb.color.setHex(P.curb);
    M.soil1.color.setHex(P.soil1); M.soil2.color.setHex(P.soil2); M.soil3.color.setHex(P.soil3);
    M.rim.emissiveIntensity = P.rimI;
    Object.keys(M).forEach(function (k) { if (/^fac/.test(k)) { M[k].emissiveIntensity = night ? 1.7 : 0; M[k].color.copy(new T.Color(FACADES[+k.slice(3) % FACADES.length]).multiplyScalar(night ? .62 : 1)); } });
    signMats.forEach(function (m) { m.emissiveIntensity = night ? 2.4 : .05; });
    M.grass.color.setHex(night ? 0x3B5A45 : 0x8DAA6B); M.brick.color.setHex(night ? 0x8A4A3A : 0xA4553E);
    M.lampHead.emissiveIntensity = night ? 3 : 0; M.shop.emissiveIntensity = night ? 1.4 : .05; M.line.emissiveIntensity = night ? 1.2 : 0;
    M.leaf.color.setHex(night ? 0x2F4A3A : 0x7FA06A); M.leaf2.color.setHex(night ? 0x27402F : 0x93B07A);
    if (holder) holder.classList.toggle("is-night", night);
    var st = $("sStage"); if (st) st.classList.toggle("is-night", night);
    var b = $("sNight"); if (b) { b.setAttribute("aria-pressed", night ? "true" : "false"); b.querySelector("span").textContent = night ? "낮으로 보기" : "밤으로 보기"; }
  }

  /* ---------- 만들기 ---------- */
  function build() {
    makeWindowTex();
    M.shop = std(0xFFF4D6, .3, { emissive: new T.Color(0xFFD27A), emissiveIntensity: .05 });
    M.roofBox = std(0xB9B3A6, .9); M.white = std(0xF7F4EC, .55); M.metal = std(0x5F625C, .5, { metalness: .4 });
    M.glass = std(0xBFD6DF, .15, { transparent: true, opacity: .55 }); M.stone = std(0xC8BFAE, .9);
    M.brick = std(0xA4553E, .85); M.slate = std(0x3E4A52, .7); M.gold = std(0xF2D94B, .4, { emissive: new T.Color(0xF2D94B), emissiveIntensity: .4 });
    M.grass = std(0x8DAA6B, .95); M.trunk = std(0x6B5340, .9); M.leaf = std(0x7FA06A, .9, { flatShading: true }); M.leaf2 = std(0x93B07A, .9, { flatShading: true });
    M.lampHead = std(0xFFF4D6, .4, { emissive: new T.Color(0xFFD98A), emissiveIntensity: 0 });
    M.cart = std(0x3A3C38, .6); M.food = std(0xC8742E, .7); M.screen = std(0x1B2530, .3);
    M.wood = std(0xC79A64, .7); M.vest = std(0xFF7A1A, .7); M.skin = std(0xE8C3A0, .8);

    world = new T.Group(); scene.add(world);
    world.add(plinth());
    var top = new T.Group(); world.add(top); S.top = top;
    streets(top);
    station(top);   // v9: 명동성당 모형은 어설퍼 보여서 뺌 → 그 자리는 반듯한 건물로 채움
    // 큰 백화점 블록 (남서쪽)
    var r0 = rng(8);
    var dept = building(top, -12, 12.2, 4.4, 3.4, 3.4, [1, 0], r0, { billboard: 0xE8473C });
    stalls(top);
    fillBlocks(top);
    // 중앙로 · 명동길 가로수 · 가로등
    for (var z = -R + 3; z < R - 3; z += 2.6) { if (Math.abs(z) < 2.4) continue; if (!nearSpot(4.6 - 1.75, z)) tree(top, 4.6 - 1.75, z, .8); if (!nearSpot(4.6 + 1.75, z + 1.3)) tree(top, 4.6 + 1.75, z + 1.3, .8); }
    for (var x = -R + 3; x < R - 3; x += 3.2) { if (Math.abs(x - 4.6) < 2.2) continue; if (!nearSpot(x, 1.95)) lamp(top, x, 1.95); if (!nearSpot(x + 1.6, -1.95)) lamp(top, x + 1.6, -1.95); }
    keepInside(top);
    for (var j = 0; j < 4; j++) productSpot(top, j);
    people(top);
    // 솟아오르는 순서: 가운데에서 바깥으로 + 조금씩 섞음 (명소는 마지막)
    var r = rng(3);
    BLD.forEach(function (b) {
      var d = Math.hypot(b.x, b.z) / R;
      b.delay = clamp((b.small ? .25 + d * .7 : d * .85) + r() * .12, 0, 1);   // v9.1: 가운데에서 바깥으로 하나둘 (작은 소품은 조금 늦게)
      var bb = new T.Box3().setFromObject(b.g); b.h = Math.max(.3, bb.max.y);
    });
    applyPalette(false);
    S.built = true;
  }

  /* ---------- 카메라 · 화면 ---------- */
  function resize() {
    if (!renderer) return;
    var w = holder.clientWidth || innerWidth, h = holder.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    S.fitDist = (O.isMobile() ? 118 : 96) * Math.max(1, 1.5 / Math.max(.5, camera.aspect));
    if (S.mode === "overview" && !S.userZoom) S.distT = S.fitDist;
  }
  function placeCamera() {
    var cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    camera.position.set(S.tx + Math.sin(S.yaw) * cp * S.dist, S.ty + sp * S.dist, S.tz + Math.cos(S.yaw) * cp * S.dist);
    camera.lookAt(S.tx, S.ty - (S.mode === "overview" ? 2.6 : 0), S.tz);
  }
  var tmpV = new T.Vector3();
  function project(x, y, z) {   // world 안의 점 → 화면 좌표 (world 회전 포함)
    tmpV.set(x, y, z); S.top.localToWorld(tmpV); tmpV.project(camera);
    return [(tmpV.x * .5 + .5) * holder.clientWidth, (-tmpV.y * .5 + .5) * holder.clientHeight, tmpV.z];
  }
  // 마우스가 도시(받침대) 위에 있는지: 화면 → 땅 높이의 평면과 만나는 점이 팔각형 안
  var ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitP = new T.Vector3();
  function overCity(cx, cy) {
    if (!holder) return false;
    var r = holder.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hitP)) return false;
    world.worldToLocal(hitP);
    if (inOct(hitP.x, hitP.z, R + .5)) return true;
    // 높은 건물 위쪽을 가리켜도 도시로 봄 (화면에서 받침대 둘레 안쪽이면)
    plane.constant = -3; var in2 = ray.ray.intersectPlane(plane, hitP); plane.constant = 0;
    if (in2) { world.worldToLocal(hitP); return inOct(hitP.x, hitP.z, R); }
    return false;
  }

  /* ---------- 바깥 연결 (main.js 가 부름) ---------- */
  api.setup = function (opts) {
    O = opts; holder = $("s3d");
    if (!T || !T.WebGLRenderer || !holder) return false;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, O.isMobile() ? 1.5 : 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
    renderer.domElement.className = "sel-canvas"; holder.innerHTML = ""; holder.appendChild(renderer.domElement);
    scene = new T.Scene(); camera = new T.PerspectiveCamera(30, 1, 2, 400);   // v9.2: 가까운 면을 2로 → 깊이 정밀도 올려 z-fighting 줄임
    lights();
    ok = true;
    resize(); addEventListener("resize", resize);
    bindUI();
    return true;
  };
  api.ok = function () { return ok; };
  api.project = function (j) { var sp = SPOTS[j]; return project(sp.x, 2.6, sp.z); };

  /* ---------- 입력 ---------- */
  var drag = null;
  function bindUI() {
    var el = renderer.domElement;
    el.style.touchAction = "pan-y";
    el.addEventListener("pointerdown", function (e) { if (S.mode !== "overview" || S.swapping) return; drag = { x: e.clientX, y: e.clientY, moved: false }; S.vyaw = 0; try { el.setPointerCapture(e.pointerId); } catch (er) {} });
    el.addEventListener("pointermove", function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        S.yaw -= dx * .0052; S.vyaw = -dx * .0052; if (drag.moved) S.used = true; S.pitch = clamp(S.pitch + dy * .003, .42, 1.18);
        el.style.cursor = "grabbing"; return;
      }
      var j = pickNear(e.clientX, e.clientY); O.hover(j, "map"); el.style.cursor = j >= 0 ? "pointer" : "grab";
    });
    function end() { drag = null; el.style.cursor = "grab"; }
    el.addEventListener("pointerup", function (e) { var d = drag; end(); if (d && !d.moved) { var j = pickNear(e.clientX, e.clientY); if (j >= 0) O.pick(j); } });
    el.addEventListener("pointercancel", end);
    el.addEventListener("pointerleave", function () { O.hover(-1, "map"); });
    // 휠: 도시 위에 있을 때만 확대·축소 (도시 밖에서는 평소처럼 페이지가 내려감)
    addEventListener("wheel", function (e) {
      if (!S.inView || S.mode !== "overview" || S.swapping || !S.risen) return;
      if (!overCity(e.clientX, e.clientY)) return;
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      var next = clamp(S.distT * Math.exp(d * .0011), 16, S.fitDist);
      if (d > 0 && S.distT >= S.fitDist - .01) return;   // 다 줄인 상태에서 더 내리면 → 평소처럼 페이지가 내려감
      e.preventDefault(); S.distT = next; S.userZoom = true; S.used = true;
      // 확대할수록 마우스가 가리키는 곳으로 조금씩 다가감
      if (d < 0) { var hp = hitP.clone(); S.ttx = clamp(lerp(S.ttx || 0, hp.x * .6, .18), -10, 10); S.ttz = clamp(lerp(S.ttz || 0, hp.z * .6, .18), -10, 10); }
      else if (next > S.fitDist * .75) { S.ttx = lerp(S.ttx || 0, 0, .25); S.ttz = lerp(S.ttz || 0, 0, .25); }
    }, { passive: false });
    var nb = $("sNight"); if (nb) nb.addEventListener("click", function () { toggleNight(); S.used = true; });
  }
  function pickNear(cx, cy) {
    if (!S.risen) return -1;
    var r = holder.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, best = -1, bd = 1e9;
    for (var j = 0; j < 4; j++) { var p = project(SPOTS[j].x, 1, SPOTS[j].z), d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = j; } }
    return bd < Math.max(34, 900 / S.dist) ? best : -1;
  }

  /* ---------- 낮/밤: 받침대가 180° 돌면서 건물이 내려갔다가 다시 솟음 ---------- */
  function toggleNight() {
    if (S.swapping || !S.risen || S.mode !== "overview") return;
    S.swapping = true; S.swapPhase = "down"; S.swapFrom = world.rotation.y; S.swapped = false;
  }
  api.isNight = function () { return S.night; };
  /* v9.2 조작 버튼용: 돌리기 · 확대/축소 · 낮/밤 */
  api.ready = function () { return !!(S.risen && S.mode === "overview" && !S.swapping); };
  api.rotateBy = function (d) { if (!api.ready()) return; S.vyaw += d; S.used = true; };
  api.zoomBy = function (f) { if (!api.ready()) return; S.distT = clamp(S.distT * f, 16, S.fitDist); S.userZoom = S.distT < S.fitDist - .01; if (!S.userZoom) { S.ttx = 0; S.ttz = 0; } S.used = true; };
  api.toggleNight = function () { toggleNight(); S.used = true; };

  /* ---------- 제품으로 다가가기 / 돌아오기 ---------- */
  api.focus = function (j) {
    S.mode = j >= 0 ? "focus" : "overview"; S.focus = j;
    if (j >= 0) {
      var sp = SPOTS[j], v = new T.Vector3(sp.x, 0, sp.z); world.localToWorld(v);
      S.ttx = v.x; S.ttz = v.z; S.distT = 20; S.pitchT = .62;
      // 제품 정면 쪽에서 보이게 (조금 비스듬히)
      var face = sp.ry + world.rotation.y; S.yawT = face + .5;
    } else { S.ttx = 0; S.ttz = 0; S.distT = S.fitDist; S.pitchT = .82; S.yawT = null; S.userZoom = false; }
  };
  api.setHot = function (j) { S.hot = j; };

  /* ---------- 매 프레임 ---------- */
  var last = 0;
  api.frame = function (dt, stageRect, vh) {
    if (!ok) return;
    S.inView = stageRect.bottom > 0 && stageRect.top < vh;
    if (!S.inView) return;
    if (!S.built) { build(); }
    var stg = $("sStage"); if (stg) { var rd = api.ready(); if (rd !== S._rd) { S._rd = rd; stg.classList.toggle("is-risen", rd); } if (S.used && !S._usedC) { S._usedC = true; stg.classList.add("is-used"); } }
    tryRealModels();
    S.tLive += dt;
    /* v9.1 솟기 · 들어가기 — 하나의 값(S.lvl: 0 = 모두 땅속, 1 = 모두 솟음)만 시간에 따라 부드럽게 움직임
       · 섹션 안으로 들어오면 1로, 섹션을 벗어나기 시작하면(위·아래 어느 쪽이든) 0으로
       · 낮/밤: 0까지 내려간 뒤 → 바꾸고 → 다시 1로 (같은 모양 · 같은 속도)
       · 건물은 크기를 줄이지 않고 땅속에서 '밀려 올라옴' (창문이 찌그러지지 않게, 튕김 없이) */
    var sec = holder.closest(".select"), sr = sec ? sec.getBoundingClientRect() : stageRect;
    /* v9.1b 스크롤 연동: 섹션이 화면에 들어오는 만큼 솟고(위 → 0.1vh 지점에서 완성), 떠나는 만큼 내려감 */
    /* v9.2: 섹션 전체 진행도 t (0 = 섹션 윗변이 화면 아래 끝, 1 = 판이 고정에서 풀리는 순간)
       들어오는 여백에서 솟기 시작 → 고정된 동안 다 솟아 있음 → 고정이 풀리기 전에(아직 화면 가운데에 있을 때) 하나둘 들어감 */
    var H = Math.max(vh * 1.5, sr.height), t = clamp((vh - sr.top) / H, 0, 1);
    var ss = function (a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
    var scr = Math.min(ss(.16, .42, t), 1 - ss(.8, .97, t)), inside = scr > .02;
    var want = scr;
    if (S.swapping) {
      if (S.swapPhase === "down") { want = 0; if ((S.lvl || 0) <= .001) { S.night = !S.night; applyPalette(S.night); S.swapPhase = "up"; } }
      else { want = scr; if ((S.lvl || 0) >= scr - .001 || !inside) { S.swapping = false; S.pulse = 0; } }
      var sp = S.swapPhase === "down" ? (1 - (S.lvl || 0)) * .5 : .5 + (S.lvl || 0) * .5;
      world.rotation.y = S.swapFrom + Math.PI * inOut(sp);
    }
    var lv = S.lvl == null ? 0 : S.lvl;
    if (S.swapping) { lv += Math.sign(want - lv) * Math.min(Math.abs(want - lv), dt / (O.reduced ? .25 : 1.1)); }
    else { lv += (want - lv) * (1 - Math.exp(-dt * (O.reduced ? 30 : 7))); if (Math.abs(want - lv) < .0005) lv = want; }
    S.lvl = lv;
    S.risen = lv >= .999;
    var SPREAD = .85;
    for (var i = 0; i < BLD.length; i++) {
      var b = BLD[i];
      var e = sstep(0, 1, lv * (1 + SPREAD) - b.delay * SPREAD);   // 각자 자기 차례에 0 → 1
      var D = Math.min(b.h, 3.8), sc = b.h > D ? lerp(D * .95 / b.h, 1, e) : 1;
      b.g.position.y = -D * (1 - e); b.g.scale.y = sc; b.g.visible = e > .001;
      if (b.small) b.g.scale.x = b.g.scale.z = 1;
    }
    // 제품: 건물이 다 솟은 뒤 마지막에 올라오고, 내려갈 땐 가장 먼저 들어감
    var pr = sstep(.86, 1, lv);
    if (!S.swapping && S.pulse != null) S.pulse = Math.min(3, S.pulse + dt);
    for (var j = 0; j < 4; j++) {
      var P = PROD[j]; if (!P) continue;
      var hot = S.hot === j || S.focus === j;
      P.holder.scale.setScalar(Math.max(.0001, pr)); P.holder.visible = pr > .002;
      P.ring.scale.setScalar(.6 + .4 * pr + (hot ? .25 + .06 * Math.sin(S.tLive * 6) : 0)); P.ring.material.opacity = .85 * pr;
      P.disc.material.opacity = (hot ? .42 : .18) * pr;
      var beamOn = (S.pulse != null && S.pulse < 2.4 ? Math.sin(Math.min(1, S.pulse / 2.4) * Math.PI) : 0) * .55 + (hot ? .38 : 0) + (S.night ? .3 : .12);
      P.beam.material.opacity = beamOn * pr * .55; P.beam.scale.y = .4 + .6 * pr;
      P.holder.position.y = hot ? .12 + .05 * Math.sin(S.tLive * 5) : 0;
    }
    if (S.risen && S.pulse == null) S.pulse = 0;
    if (!S.risen && !S.swapping) S.pulse = null;
    // 카메라
    if (S.mode === "overview" && !drag && !S.swapping) { S.yaw += S.vyaw; S.vyaw *= Math.pow(.05, dt); if (!O.reduced && S.hot < 0 && !S.userZoom && !O.pointerInside()) S.yaw += dt * .045; }
    if (S.yawT != null) { var dy = ((S.yawT - S.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; S.yaw += dy * Math.min(1, dt * 3); }
    if (S.pitchT != null) S.pitch = lerp(S.pitch, S.pitchT, Math.min(1, dt * 3));
    S.dist = lerp(S.dist, S.distT, Math.min(1, dt * 5));
    S.tx = lerp(S.tx, S.ttx || 0, Math.min(1, dt * 4)); S.tz = lerp(S.tz, S.ttz || 0, Math.min(1, dt * 4));
    placeCamera();
    // 해(그림자)는 받침대와 함께
    // 사람: 가까이 갈수록 보임
    movePeople(dt, sstep(52, 34, S.dist));
    renderer.render(scene, camera);
    // 이름표 위치 (main.js 가 그림)
    if (O.markers) {
      var pts = [];
      for (j = 0; j < 4; j++) { var q = project(SPOTS[j].x, (j === 2 ? 2.4 : 1.9), SPOTS[j].z); pts.push({ x: q[0], y: q[1], on: pr * (q[2] < 1 ? 1 : 0) }); }
      O.markers(pts);
    }
  };
  api.state = S;
})();
