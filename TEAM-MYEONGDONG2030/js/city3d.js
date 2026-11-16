/* =========================================================
   3D 명동 (Three.js) — v4
   - 지도(map.js)와 같은 길·건물·간판·사람 데이터를 씁니다.
   - assets/models 의 실제 3D 모델(대표 건물 4채, 돌출 간판 6종, 사진 기반 사람 5명,
     STREET FOLD · FOLD MARK)을 불러와 거리에 놓습니다. (js/models/*.js 에 글자로 담겨 있어 인터넷 없이 열림)
   - 릴레이 01 장면(노점 → 골목 테이블)을 실제 비율의 3D 로 그립니다.
   ========================================================= */
(function () {
  "use strict";
  var MAP = window.MDMap, CFG = window.MD_CONFIG;
  var T = window.THREE;
  var api = { ok: false, modelsReady: false };
  window.City3D = api;
  if (!T) return;

  var COL = CFG.colors;
  var M = 9.43;                       // 1m = 9.43 지도 단위 (사람 키 1.75m ≈ 16.5)
  function rng(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function sstep(a, b, v) { var t = seg(v, a, b); return t * t * (3 - 2 * t); }
  var ST = MAP.streets;

  var renderer, scene, camera, canvas, people, people2, peopleAgents, dummy, glowBig, glowSmall, built = false, W0 = 0, H0 = 0;
  var EYE = 13;                     // 사람 눈높이 (지도 단위, 약 1.6m)

  function hex(c) { return new T.Color(c); }

  /* ---------- 여러 도형을 하나로 합치기 (가볍게 그리기 위해) ---------- */
  function Builder() { this.p = []; this.n = []; this.c = []; this.uv = []; }
  Builder.prototype.quad = function (a, b, c, d, nrm, col, uvs, flip) {
    var P = this.p, N = this.n, C = this.c, U = this.uv, V = [a, b, c, d], ord = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    ord.forEach(function (k) {
      var v = V[k]; P.push(v[0], v[1], v[2]); N.push(nrm[0], nrm[1], nrm[2]);
      var cc = col[k] || col[0]; C.push(cc.r, cc.g, cc.b);
      var uu = uvs ? uvs[k] : [0.01, 0.01]; U.push(uu[0], uu[1]);
    });
  };
  // 상자: 중심 x,z / 크기 w(x방향),d(z방향) / y0~y1, 회전 ang
  Builder.prototype.box = function (cx, cz, w, d, y0, y1, ang, colTop, colSide, opt) {
    opt = opt || {};
    var ca = Math.cos(ang || 0), sa = Math.sin(ang || 0);
    function P(x, y, z) { return [cx + x * ca - z * sa, y, cz + x * sa + z * ca]; }
    var hw = w / 2, hd = d / 2;
    var bot = colSide.clone().multiplyScalar(opt.ao == null ? 0.78 : opt.ao), top = colSide;
    var faces = [
      [[-hw, -hd], [hw, -hd], [0, 0, -1], w], [[hw, -hd], [hw, hd], [1, 0, 0], d],
      [[hw, hd], [-hw, hd], [0, 0, 1], w], [[-hw, hd], [-hw, -hd], [-1, 0, 0], d]
    ];
    var self = this;
    faces.forEach(function (f, i) {
      if (opt.only && opt.only.indexOf(i) < 0) return;
      var a = P(f[0][0], y0, f[0][1]), b = P(f[1][0], y0, f[1][1]), c = P(f[1][0], y1, f[1][1]), e = P(f[0][0], y1, f[0][1]);
      var nx = f[2][0] * ca - f[2][2] * sa, nz = f[2][0] * sa + f[2][2] * ca;
      var uvs = opt.win ? [[0, y0 / 32], [f[3] / 26, y0 / 32], [f[3] / 26, y1 / 32], [0, y1 / 32]] : (opt.sideUV ? [opt.sideUV, opt.sideUV, opt.sideUV, opt.sideUV] : null);
      var cols = [bot, bot, top, top];
      if (opt.faceUV && opt.faceUV[i]) { uvs = opt.faceUV[i]; var wh = opt.faceCol || new T.Color(1, 1, 1); cols = [wh, wh, wh, wh]; }
      self.quad(a, b, c, e, [nx, 0, nz], cols, uvs, true);      // 바깥을 향하도록 감는 방향을 뒤집음
    });
    if (!opt.noTop) self.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), [0, 1, 0], [colTop, colTop, colTop, colTop], opt.topUV || (opt.sideUV ? [opt.sideUV, opt.sideUV, opt.sideUV, opt.sideUV] : null));
  };
  // 임의의 도형을 정점색과 함께 더함
  Builder.prototype.addGeo = function (g, col) {
    g.computeVertexNormals(); var gg = g.index ? g.toNonIndexed() : g;           // 부드러운 면 (각지지 않게)
    var P = gg.attributes.position, N = gg.attributes.normal, U = gg.attributes.uv;
    for (var i = 0; i < P.count; i++) {
      this.p.push(P.getX(i), P.getY(i), P.getZ(i)); this.n.push(N.getX(i), N.getY(i), N.getZ(i));
      this.c.push(col.r, col.g, col.b); this.uv.push(U ? 0.3 : 0.01, U ? 0.05 : 0.01);
    }
  };
  Builder.prototype.geometry = function () { return this.mesh(null).geometry; };
  Builder.prototype.mesh = function (mat) {
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(this.uv, 2));
    return new T.Mesh(g, mat);
  };

  /* ---------- 질감: 창문 / 간판 / 빛 ---------- */
  function canvasTex(c, rep) {
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8;
    if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  }
  // 한 칸 = 폭 26 x 높이 32 (약 2.7m x 3.4m 한 층). 블루그레이 유리 + 아이보리 프레임 (대표 건물과 같은 재료)
  function windowTex() {          // 한 칸 = 폭 26 x 높이 32 (약 2.7m x 3.4m 한 층). 벽색은 정점색으로 곱해짐
    var c = document.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#E6E3DC"; g.fillRect(0, 106, 128, 22);                 // 층 띠
    var gr = g.createLinearGradient(0, 20, 0, 98);
    gr.addColorStop(0, "#6F7A80"); gr.addColorStop(0.6, "#56616A"); gr.addColorStop(1, "#4B545C");
    g.fillStyle = "#BDB8AE"; g.fillRect(12, 16, 104, 86);                  // 창틀
    g.fillStyle = gr; g.fillRect(16, 20, 96, 78);                          // 유리
    g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.moveTo(16, 20); g.lineTo(70, 20); g.lineTo(30, 98); g.lineTo(16, 98); g.fill();
    g.fillStyle = "#BDB8AE"; g.fillRect(62, 20, 4, 78);                    // 창살
    g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(12, 100, 104, 4);
    return canvasTex(c, true);
  }
  // 밤에 불 켜진 창 (건물 블록용 빛 지도)
  function windowLitTex() {
    var c = document.createElement("canvas"); c.width = 512; c.height = 512;
    var g = c.getContext("2d"), r = rng(77);
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) {
      var on = r(); if (on > 0.42) continue;
      var warm = r() < 0.75, a = 0.45 + r() * 0.55;
      g.fillStyle = warm ? "rgba(255,214,150," + a + ")" : "rgba(214,232,255," + a + ")";
      g.fillRect(x * 128 + 16, y * 128 + 20, 96, 78);
    }
    return canvasTex(c, true);
  }

  /* ---------- 명동 사진을 참고한 세로 돌출 간판 ----------
     원색 아크릴 + 세로 한글 + 작은 영문 + 위아래로 나뉜 칸 (실제 명동 간판처럼 빽빽하게) */
  var SIGN_WORDS = [["약국", "PHARMACY"], ["환전", "EXCHANGE"], ["화장품", "COSMETICS"], ["분식", "SNACK"], ["카페", "CAFE"], ["의류", "FASHION"], ["안경", "OPTICAL"], ["만두", "DUMPLING"],
                    ["떡볶이", "TTEOKBOKKI"], ["커피", "COFFEE"], ["면세", "DUTY FREE"], ["기념품", "SOUVENIR"], ["스킨케어", "SKIN CARE"], ["치킨", "CHICKEN"], ["김밥", "GIMBAP"], ["호텔", "HOTEL"],
                    ["노래방", "KARAOKE"], ["한의원", "CLINIC"], ["피부과", "DERMA"], ["네일", "NAIL"], ["식당", "RESTAURANT"], ["마스크팩", "MASK PACK"], ["양말", "SOCKS"], ["명동", "MYEONGDONG"],
                    ["편의점", "24 HOURS"], ["고기", "BBQ"], ["라면", "RAMEN"], ["모자", "CAPS"], ["치과", "DENTAL"], ["게스트", "GUEST"], ["향수", "PERFUME"], ["잡화", "GOODS"]];
  // 바탕, 글자, 띠(보조)  — 사진 속 명동 간판 색 (조금 차분하게)
  var SIGN_COL = [["#C8262C", "#FFFFFF", "#F4C21B"], ["#F1BE12", "#1E1F21", "#C8262C"], ["#1F4E9E", "#FFFFFF", "#F1BE12"], ["#D6327A", "#FFFFFF", "#FFE3EF"],
                  ["#15804B", "#FFFFFF", "#F1BE12"], ["#E8761C", "#FFFFFF", "#1E1F21"], ["#FFFFFF", "#C8262C", "#C8262C"], ["#1B1C1E", "#F1BE12", "#F1BE12"],
                  ["#FFFFFF", "#1F4E9E", "#1F4E9E"], ["#6E2A86", "#FFFFFF", "#E8B9F2"], ["#0A9AAA", "#FFFFFF", "#FFFFFF"], ["#F4EEDF", "#1E1F21", "#C8262C"]];
  var ATLAS_COLS = 16, ATLAS_ROWS = 4, CW = 128, CH = 512, SIDE_PX = 16;
  var KFONT = "'Malgun Gothic', 'Apple SD Gothic Neo', Pretendard, 'Noto Sans KR', sans-serif";
  function signAtlas() {
    var c = document.createElement("canvas"); c.width = CW * ATLAS_COLS; c.height = CH * ATLAS_ROWS + SIDE_PX;
    var g = c.getContext("2d");
    function vtext(word, x, y0, y1, col, size) {        // 세로로 한 글자씩
      var ch = word.split(""), n = ch.length, gap = Math.min(size * 1.08, (y1 - y0) / n);
      var fs = Math.min(size, gap * 0.94), yy = (y0 + y1) / 2 - (n - 1) * gap / 2;
      g.fillStyle = col; g.font = "800 " + fs.toFixed(0) + "px " + KFONT; g.textAlign = "center"; g.textBaseline = "middle";
      ch.forEach(function (cc, i) { g.fillText(cc, x, yy + i * gap); });
    }
    function panel(x, y, w, h, word, sc, kind, r) {
      g.fillStyle = sc[0]; g.fillRect(x, y, w, h);
      if (kind === 1) { g.fillStyle = sc[2]; g.fillRect(x, y, w, 34); g.fillRect(x, y + h - 10, w, 10); }      // 위 띠
      if (kind === 2) { g.strokeStyle = sc[2]; g.lineWidth = 5; g.strokeRect(x + 9, y + 9, w - 18, h - 18); }   // 안쪽 테두리
      var top = y + (kind === 1 ? 44 : 22), bot = y + h - (h > 260 ? 52 : 20);
      vtext(word[0], x + w / 2, top, bot, sc[1], w * 0.62);
      if (h > 260) {
        g.save(); g.globalAlpha = 0.85; g.fillStyle = sc[1]; g.font = "700 " + (word[1].length > 9 ? 10 : 12) + "px Pretendard, Arial, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(word[1], x + w / 2, y + h - 30); g.restore();
      }
      if (kind === 1) { g.fillStyle = sc[0]; g.beginPath(); g.arc(x + w / 2, y + 17, 9, 0, 6.3); g.fill(); }
    }
    function draw() {
      var r = rng(905);
      g.fillStyle = "#2A2B2D"; g.fillRect(0, CH * ATLAS_ROWS, c.width, SIDE_PX);   // 간판 옆면 (짙은 금속)
      for (var row = 0; row < ATLAS_ROWS; row++) for (var col = 0; col < ATLAS_COLS; col++) {
        var x = col * CW, y = row * CH, k = row * ATLAS_COLS + col;
        g.fillStyle = "#2A2B2D"; g.fillRect(x, y, CW, CH);                          // 금속 테
        var split = r(), ix = x + 6, iy = y + 6, iw = CW - 12, ih = CH - 12;
        if (split < 0.55) panel(ix, iy, iw, ih, SIGN_WORDS[k % SIGN_WORDS.length], SIGN_COL[(k * 5) % SIGN_COL.length], (k % 3), r);
        else {                                                                     // 두세 칸으로 나뉜 간판 (한 건물 여러 가게)
          var n = split < 0.85 ? 2 : 3, hh = (ih - (n - 1) * 6) / n;
          for (var q = 0; q < n; q++) panel(ix, iy + q * (hh + 6), iw, hh, SIGN_WORDS[(k * 3 + q * 7) % SIGN_WORDS.length], SIGN_COL[(k * 7 + q * 3) % SIGN_COL.length], (k + q) % 3, r);
        }
        var sh = g.createLinearGradient(x, y, x + CW, y); sh.addColorStop(0, "rgba(255,255,255,.12)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(0,0,0,.08)");
        g.fillStyle = sh; g.fillRect(ix, iy, iw, ih);
      }
    }
    draw();
    var t = canvasTex(c);
    api.redrawSigns = function () { draw(); t.needsUpdate = true; ads.redraw(); };
    return { tex: t };
  }
  /* 건물 벽 큰 광고판 (사진 속 세로 대형 광고 — 얼굴 없이 제품 · 글자 위주) */
  var ads = (function () {
    var AW = 256, AH = 640, N = 6, c = document.createElement("canvas"); c.width = AW * N; c.height = AH;
    var g = c.getContext("2d"), t = null;
    var SET = [["#F4D9DF", "#C8262C", "SALE", "30~80%"], ["#1F2A44", "#F1BE12", "K-BEAUTY", "명동 본점"], ["#E9E2CC", "#1E1F21", "NEW", "수분 크림"],
               ["#C8262C", "#FFFFFF", "1+1", "마스크팩"], ["#0E0F11", "#FFFFFF", "MYEONGDONG", "2030"], ["#F1BE12", "#1E1F21", "OPEN", "24H"]];
    function draw() {
      SET.forEach(function (s, i) {
        var x = i * AW;
        var gr = g.createLinearGradient(x, 0, x, AH); gr.addColorStop(0, s[0]); gr.addColorStop(1, shade(s[0], -0.12));
        g.fillStyle = gr; g.fillRect(x, 0, AW, AH);
        // 제품 실루엣 (병 · 튜브)
        g.fillStyle = shade(s[0], s[0] === "#0E0F11" ? 0.22 : -0.18);
        rr(x + AW * 0.3, AH * 0.36, AW * 0.22, AH * 0.4, 18); rr(x + AW * 0.55, AH * 0.46, AW * 0.17, AH * 0.3, 14);
        g.fillStyle = s[1]; rr(x + AW * 0.355, AH * 0.31, AW * 0.11, AH * 0.06, 6);
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = s[1];
        g.font = "900 " + (s[2].length > 6 ? 30 : 64) + "px Pretendard, Arial, sans-serif"; g.fillText(s[2], x + AW / 2, AH * 0.14);
        g.font = "800 30px " + KFONT; g.fillText(s[3], x + AW / 2, AH * 0.86);
        g.fillRect(x + AW / 2 - 30, AH * 0.22, 60, 4);
      });
      if (t) t.needsUpdate = true;
    }
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); }
    function shade(h, k) { var c2 = new T.Color(h); c2.offsetHSL(0, 0, k); return "#" + c2.getHexString(); }
    draw(); t = canvasTex(c);
    return { tex: t, n: N, redraw: draw };
  })();
  /* 회색 돌 보도 (사진 속 명동 바닥) */
  function paveTex() {
    var c = document.createElement("canvas"); c.width = c.height = 256;
    var g = c.getContext("2d"), r = rng(12);
    g.fillStyle = "#8F8C86"; g.fillRect(0, 0, 256, 256);
    for (var row = 0; row < 16; row++) for (var col = -1; col < 9; col++) {
      var x = col * 32 + (row % 2) * 16, y = row * 16, v = (r() - 0.5) * 0.12;
      var base = new T.Color("#B4B1AA"); base.offsetHSL(0, 0, v);
      g.fillStyle = "#" + base.getHexString(); g.fillRect(x + 1, y + 1, 30, 14);
    }
    var t = canvasTex(c, true); return t;
  }
  function glowTex() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,244,190,1)"); gr.addColorStop(0.25, "rgba(242,217,75,.55)"); gr.addColorStop(1, "rgba(242,217,75,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return canvasTex(c);
  }
  // STREET FOLD 디스플레이 화면 (주변 안내 지도 + 번호)
  function displayTex(num, guest) {
    var c = document.createElement("canvas"); c.width = 280; c.height = 490;
    var g = c.getContext("2d");
    g.fillStyle = "#FFFDF4"; g.fillRect(0, 0, 280, 490);
    g.fillStyle = "#2F312B"; g.font = "700 20px Pretendard, sans-serif"; g.textBaseline = "top";
    g.fillText(guest ? "ようこそ" : "명동 2030", 20, 20);
    g.fillStyle = "#E9BE5F"; g.beginPath(); g.arc(250, 32, 12, 0, 6.3); g.fill();
    g.fillStyle = "#2F312B"; g.font = "800 13px Pretendard, sans-serif"; g.textAlign = "center"; g.fillText(num, 250, 26); g.textAlign = "left";
    g.fillStyle = "#EFE9D6"; g.fillRect(20, 64, 240, 250);
    g.strokeStyle = "#FFFDF4"; g.lineWidth = 16; g.beginPath(); g.moveTo(20, 200); g.lineTo(260, 214); g.moveTo(130, 64); g.lineTo(138, 314); g.stroke();
    g.strokeStyle = "#2F312B"; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(134, 290); g.lineTo(134, 206); g.lineTo(220, 210); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#F2D94B"; g.beginPath(); g.arc(134, 290, 9, 0, 6.3); g.fill(); g.fillStyle = "#2F312B"; g.beginPath(); g.arc(220, 210, 6, 0, 6.3); g.fill();
    g.fillStyle = "#2F312B"; g.font = "600 14px Pretendard, sans-serif";
    g.fillText(guest ? "食べたあとに" : "주변 안내", 20, 334);
    g.font = "700 18px Pretendard, sans-serif"; g.fillText(guest ? "雑貨店まで 徒歩1分" : "카페 · 서점 · 약국", 20, 356);
    g.fillStyle = "#F2D94B"; g.fillRect(20, 400, 240, 54);
    g.fillStyle = "#2F312B"; g.font = "700 17px Pretendard, sans-serif"; g.fillText(guest ? "テーブル " + num : "QR 을 대 주세요", 34, 418);
    return canvasTex(c);
  }

  /* ---------- 은은한 환경광 (금속·유리 재질이 어둡게 보이지 않도록) ---------- */
  function makeEnv(rr) {
    var es = new T.Scene(), geo = new T.SphereGeometry(50, 32, 16), cols = [];
    var p = geo.attributes.position, top = hex("#FFF6DF"), mid = hex("#F1E7CC"), bot = hex("#B8AE95");
    for (var i = 0; i < p.count; i++) { var y = p.getY(i) / 50, c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y); cols.push(c.r, c.g, c.b); }
    geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    var lamp = new T.Mesh(new T.PlaneGeometry(30, 12), new T.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(-10, 35, -25); lamp.lookAt(0, 0, 0); es.add(lamp);
    var pm = new T.PMREMGenerator(rr || renderer), rt = pm.fromScene(es, 0.02);
    pm.dispose(); return rt.texture;
  }

  /* =========================================================
     장면 만들기
     - 길가 건물: 실제 거리 3D 키트(kit_street)의 건물 16종을 길을 따라 빈틈없이 줄지어 세움
       (모델이 오기 전에는 같은 자리에 단순한 상자)
     - 블록 안쪽: 옥상이 이어지도록 상자로 채움 → 위에서 본 지도와 같은 모양
     - 바깥: 큰 유리 오피스 타워
     ========================================================= */
  var GROUP = {}, MATS = {}, FRONT = [], OCC = [], TOWERS = [], LOOK = { dark: -1, floor: 1, tables: 1, tint: 1 };
  var MW = 5.98 * M, MDEP = 6.0 * M;                                   // 키트 건물 한 칸: 폭 5.98m, 깊이 6m
  var KIT_H = [14, 16, 12, 17, 14, 18, 15, 17, 16, 12, 17, 14, 18, 15, 17, 14];   // 16종 높이 (m)
  var WALL_TONES = ["#E4E1D8", "#CFCBC1", "#B8B4AA", "#A29D92", "#8C8880", "#77756F", "#D3C6B0", "#B9A58C", "#9E8E7A", "#5D5F5C", "#E9E6DE", "#C2BDB2"];
  var STALL_TOP = 0.895 * M;                                           // 노점 상판 높이 (직접 만든 포장마차 0.895m)
  function aabbR(cx, cz, w, d, ry, pad) {
    var c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (c * w + s * d) / 2 + (pad || 0), hz = (s * w + c * d) / 2 + (pad || 0);
    return [cx - hx, cz - hz, cx + hx, cz + hz];
  }
  function boxHit(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
  function inStreet(x, z, pad, skip, ext) {
    for (var i = 0; i < ST.length; i++) {
      var o = ST[i]; if (o === skip) continue;
      var dx = x - o.pts[0][0], dz = z - o.pts[0][1], al = dx * o.ux + dz * o.uy, lt = dx * o.nx + dz * o.ny;
      if (al > -ext && al < o.len + ext && Math.abs(lt) < o.w / 2 + pad) return true;
    }
    return false;
  }
  function rectInStreet(bb, skip, pad, ext) {
    for (var a = 0; a <= 4; a++) for (var b = 0; b <= 4; b++)
      if (inStreet(lerp(bb[0], bb[2], a / 4), lerp(bb[1], bb[3], b / 4), pad, skip, ext)) return true;
    return false;
  }
  var ROAD_EXT = 420;                                                   // 지도 밖으로도 길이 이어지게

  function build() {
    built = true;
    scene = new T.Scene();
    var sky = hex("#E8E6DF");
    scene.background = sky.clone();
    scene.fog = new T.Fog(sky.clone(), 520, 2600);
    GROUP.hemi = new T.HemisphereLight(0xF2F3F2, 0x8F8A80, 0.7); scene.add(GROUP.hemi);
    GROUP.sun = new T.DirectionalLight(0xFFF0D8, 1.9); scene.add(GROUP.sun); scene.add(GROUP.sun.target);
    // 그림자 (한 번만 그려 두는 고정 그림자 — 건물 사이 깊이감)
    var sd = new T.Vector3(-0.42, 1, 0.36).normalize(), sc0 = new T.Vector3(800, 0, 520);
    GROUP.sun.target.position.copy(sc0); GROUP.sun.position.copy(sc0).addScaledVector(sd, 3200);
    GROUP.sun.castShadow = true;
    var shc = GROUP.sun.shadow.camera; shc.left = -1750; shc.right = 1750; shc.top = 1500; shc.bottom = -1500; shc.near = 200; shc.far = 7000; shc.updateProjectionMatrix();
    GROUP.sun.shadow.mapSize.set(window.MD_LITE ? 2048 : 4096, window.MD_LITE ? 2048 : 4096);
    GROUP.sun.shadow.bias = -0.0004; GROUP.sun.shadow.normalBias = 0.6; GROUP.sun.shadow.radius = 2;
    try { scene.environment = makeEnv(); } catch (e) { }

    var R = rng(31);
    /* --- 바닥 · 길 (회색 돌 보도) --- */
    var ground = new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshLambertMaterial({ color: 0x8E8B85 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(800, -0.3, 500); scene.add(ground); GROUP.ground = ground;
    var pv = paveTex(), road = { p: [], uv: [], n: [] };
    function rq(a, b, c, d, y) {
      [a, b, c, a, c, d].forEach(function (v) { road.p.push(v[0], y, v[1]); road.n.push(0, 1, 0); road.uv.push(v[0] / 26, v[1] / 26); });
    }
    ST.forEach(function (s) {
      var e = ROAD_EXT;
      rq(MAP.pointOn(s, -e, -s.w / 2), MAP.pointOn(s, -e, s.w / 2), MAP.pointOn(s, s.len + e, s.w / 2), MAP.pointOn(s, s.len + e, -s.w / 2), s.kind === "main" ? 0.08 : 0.06);
    });
    var rg = new T.BufferGeometry();
    rg.setAttribute("position", new T.Float32BufferAttribute(road.p, 3)); rg.setAttribute("normal", new T.Float32BufferAttribute(road.n, 3)); rg.setAttribute("uv", new T.Float32BufferAttribute(road.uv, 2));
    MATS.road = new T.MeshStandardMaterial({ map: pv, roughness: 0.92, metalness: 0, envMapIntensity: 0.5, side: T.DoubleSide });
    scene.add(new T.Mesh(rg, MATS.road));
    // 배수 줄 (큰길 가운데 금속 줄)
    var drain = new Builder(), dc = hex("#6E6C67");
    ST.forEach(function (s) { if (s.kind !== "main") return; var m = MAP.pointOn(s, s.len / 2, 0); drain.box(m[0], m[1], s.len + 2 * ROAD_EXT, 1.0, 0.09, 0.2, Math.atan2(s.uy, s.ux), dc, dc, { ao: 1 }); });
    scene.add(drain.mesh(new T.MeshLambertMaterial({ vertexColors: true })));

    /* --- 길가 건물 자리 (키트 건물 16종) --- */
    OCC = []; FRONT = [];
    MAP.landmarks.forEach(function (lm) { OCC.push(aabbR(lm.x, lm.z, lm.w, lm.d, lm.rot, 2)); });
    var order = ST.map(function (s, i) { return i; }).sort(function (a, b) { return (ST[a].kind === "main" ? 0 : 1) - (ST[b].kind === "main" ? 0 : 1) || a - b; });
    var RF = rng(4242);
    order.forEach(function (si) {
      var s = ST[si];
      [-1, 1].forEach(function (side) {
        for (var d = -90; d < s.len + 90 - MW * 0.4; d += MW) {
          var mid = d + MW / 2, lat = side * (s.w / 2 + 5);
          var f = MAP.pointOn(s, mid, lat), b = MAP.pointOn(s, mid, lat + side * MDEP);
          var ry = Math.atan2(-side * s.nx, -side * s.ny), bb = aabbR((f[0] + b[0]) / 2, (f[1] + b[1]) / 2, MW, MDEP, ry, -1.5);
          if (rectInStreet(bb, s, 2, 90) || OCC.some(function (o) { return boxHit(o, bb); })) continue;
          OCC.push(bb);
          var m = (RF() * 16) | 0;
          FRONT.push({ x: f[0], z: f[1], ry: ry, st: s, side: side, along: mid, m: m, h: KIT_H[m] * M, tone: WALL_TONES[(RF() * WALL_TONES.length) | 0], r: RF() });
        }
      });
    });
    // 바깥 큰 유리 타워 자리 (사진 속 명동을 둘러싼 오피스 빌딩)
    TOWERS = [];
    if (!window.MD_LITE) [[-330, 40], [-350, 760], [1950, 140], [1990, 690], [380, -330], [1260, -350], [640, 1380], [1480, 1370], [-330, 1330], [1960, 1290], [2060, -300], [-420, -330]].forEach(function (p, i) {
      var w = 28 * M, d = 22 * M, ry = (i % 2) * Math.PI / 2, bb = aabbR(p[0], p[1], w, d, ry, 6);
      if (rectInStreet(bb, null, 4, ROAD_EXT) || OCC.some(function (o) { return boxHit(o, bb); })) return;
      OCC.push(bb); TOWERS.push({ x: p[0], z: p[1], w: w, d: d, ry: ry, h: (44 + (i * 37) % 28) * M });
    });

    /* --- 블록 안쪽 채우기 (옥상이 이어지게) + 모델 전 임시 상자 --- */
    var fill = new Builder(), roofB = new Builder(), ph = new Builder(), C = 28, wt = windowTex(), wl = windowLitTex();
    var roofT = ["#A9A69F", "#B6B3AB", "#9C998F", "#BEBBB2", "#929089"];
    for (var gx = -560; gx < 2160; gx += C) for (var gz = -520; gz < 1580; gz += C) {
      var bb = [gx + 0.5, gz + 0.5, gx + C - 0.5, gz + C - 0.5];
      if (rectInStreet(bb, null, 3, ROAD_EXT)) continue;
      if (OCC.some(function (o) { return boxHit(o, bb); })) continue;
      var hr = rng(Math.floor((gx + 560) / 84) * 131 + Math.floor((gz + 520) / 84) * 7919 + 17), h0 = hr(), h1 = hr();
      var h = 92 + Math.pow(h0, 1.8) * 200, tone = hex(WALL_TONES[(h1 * WALL_TONES.length) | 0]), top = hex(roofT[(h1 * 50 | 0) % roofT.length]);
      fill.box(gx + C / 2, gz + C / 2, C, C, 0, h, 0, top, tone, { win: true, ao: 0.82 });
      var rr = R();
      if (rr < 0.16) { var hv = hex("#8B8984"); roofB.box(gx + 6 + R() * 16, gz + 6 + R() * 16, 7 + R() * 5, 5 + R() * 4, h, h + 3.5 + R() * 3, 0, hv.clone().multiplyScalar(1.1), hv, { ao: 0.9 }); }
      else if (rr < 0.2) { var wtc = hex("#A7A39A"); roofB.box(gx + C / 2, gz + C / 2, 9, 9, h, h + 9, Math.PI / 4, wtc, wtc, { ao: 0.85 }); }
    }
    MATS.fill = new T.MeshStandardMaterial({ vertexColors: true, map: wt, emissiveMap: wl, emissive: 0xFFE2B0, emissiveIntensity: 0, roughness: 0.88, metalness: 0, envMapIntensity: 0.5 });
    scene.add(fill.mesh(MATS.fill));
    scene.add(roofB.mesh(new T.MeshLambertMaterial({ vertexColors: true })));
    FRONT.forEach(function (f) {
      var c = MAP.pointOn(f.st, f.along, f.side * (f.st.w / 2 + 5 + MDEP / 2)), tone = hex(f.tone);
      ph.box(c[0], c[1], MW - 1, MDEP, 0, f.h, f.ry, tone, tone, { win: true, ao: 0.85 });
    });
    GROUP.ph = ph.mesh(MATS.fill); scene.add(GROUP.ph);
    var phT = new Builder();
    TOWERS.forEach(function (tw) { var c = hex("#9AA4AA"); phT.box(tw.x, tw.z, tw.w, tw.d, 0, tw.h, tw.ry, c, c, { win: true }); });
    GROUP.phT = phT.mesh(MATS.fill); scene.add(GROUP.phT);

    /* --- 세로 돌출 간판 (건물 칸 사이 경계마다 1~2개, 위아래로 쌓임) --- */
    var atlas = signAtlas(), sgn = new Builder(), brk = new Builder(), H2 = ATLAS_ROWS * CH + SIDE_PX, graphite = hex("#3A3B3D");
    var glowPts = [], bulbPts = [];
    GROUP.signSlots = [];
    var RS = rng(606);
    FRONT.forEach(function (f, fi) {
      var s = f.st, main = s.kind === "main";
      if (RS() > (main ? 0.92 : 0.75)) return;
      var along = f.along - MW / 2 + 0.5;                            // 칸 경계 (키트 간판과 겹치지 않음)
      var wallLat = f.side * (s.w / 2 + 5);
      var maxY = f.h - 4, y = 34 + RS() * 14, stack = main ? 1 + (RS() < 0.6 ? 1 : 0) : 1 + (RS() < 0.3 ? 1 : 0);
      for (var q = 0; q < stack && y < maxY - 30; q++) {
        var hgt = Math.min(maxY - y, (main ? 44 : 34) + RS() * (main ? 46 : 30)), w2 = clamp(hgt * CW / CH * 1.0, 8, 16);
        if (hgt < 26) break;
        var lat = wallLat - f.side * (w2 / 2 + 2.2), sp = MAP.pointOn(s, along, lat), ang = Math.atan2(s.uy, s.ux);
        if (main && q === 0 && RS() < 0.28 && GROUP.signSlots.length < 70) { GROUP.signSlots.push({ x: sp[0], z: sp[1], y: y, s: s, side: f.side }); y += 70; continue; }
        var col = (RS() * ATLAS_COLS) | 0, row = (RS() * ATLAS_ROWS) | 0;
        var u0 = col / ATLAS_COLS + 0.0008, u1 = (col + 1) / ATLAS_COLS - 0.0008, v1 = 1 - (row * CH + 1) / H2, v0 = 1 - ((row + 1) * CH - 1) / H2;
        var face = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], faceR = [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], wh = hex("#FFFFFF");
        sgn.box(sp[0], sp[1], 2.2, w2, y, y + hgt, ang, wh, wh, { ao: 1, faceUV: [null, faceR, null, faceR], faceCol: wh, sideUV: [0.5, (SIDE_PX / 2) / H2] });
        [y + hgt * 0.12, y + hgt * 0.88].forEach(function (yy) {
          var bp = MAP.pointOn(s, along, wallLat - f.side * 1.1);
          brk.box(bp[0], bp[1], 0.8, 2.6, yy - 0.5, yy + 0.5, ang, graphite, graphite, { ao: 1 });
        });
        glowPts.push(sp[0], y + hgt / 2, sp[1]);
        y += hgt + 3 + RS() * 6;
      }
    });
    MATS.sign = new T.MeshStandardMaterial({ vertexColors: true, map: atlas.tex, emissiveMap: atlas.tex, emissive: 0xFFFFFF, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 });
    scene.add(sgn.mesh(MATS.sign));
    scene.add(brk.mesh(new T.MeshLambertMaterial({ vertexColors: true })));

    /* --- 큰 벽 광고 (큰길 · 교차로) --- */
    var adB = new Builder(), RA = rng(808);
    FRONT.forEach(function (f) {
      if (f.st.kind !== "main" || RA() > 0.2) return;
      var k = (RA() * ads.n) | 0, u0 = k / ads.n + 0.001, u1 = (k + 1) / ads.n - 0.001;
      var wdt = MW * 0.46, y0 = 4.3 * M, y1 = Math.min(f.h - 1.2 * M, y0 + wdt * 2.5);
      var c = MAP.pointOn(f.st, f.along, f.side * (f.st.w / 2 + 5 - 0.42 * M)), ang = Math.atan2(f.st.uy, f.st.ux);
      // 길 쪽 면만 그림 (face 0: -z, face 2: +z)
      var fn = f.side > 0 ? 0 : 2, fu = [null, null, null, null]; fu[fn] = [[u1, 0], [u0, 0], [u0, 1], [u1, 1]];
      adB.box(c[0], c[1], wdt, 0.6, y0, y1, ang, hex("#2A2B2D"), hex("#2A2B2D"), { ao: 1, faceUV: fu, faceCol: hex("#FFFFFF"), sideUV: [0.0, 0.0], noTop: true });
      glowPts.push(c[0], (y0 + y1) / 2, c[1]);
    });
    MATS.ad = new T.MeshStandardMaterial({ vertexColors: true, map: ads.tex, emissiveMap: ads.tex, emissive: 0xFFFFFF, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0 });
    scene.add(adB.mesh(MATS.ad));

    /* --- 노점: 레퍼런스 사진을 보고 만든 포장마차 (모델 파일 없이 바로) --- */
    buildStalls();
    for (var gi = 0; gi < GROUP.stallGlow.length; gi++) glowPts.push(GROUP.stallGlow[gi]);

    /* --- 바닥 조명 (2028~ 노란 줄) --- */
    var fl = new Builder(), flc = hex("#FFE680");
    ST.forEach(function (s) {
      var ang = Math.atan2(s.uy, s.ux);
      for (var dd = 16; dd < s.len - 10; dd += 26) [-1, 1].forEach(function (side) {
        var p = MAP.pointOn(s, dd, side * (s.w / 2 - 8)); fl.box(p[0], p[1], 13, 1.4, 0.1, 0.45, ang, flc, flc, { ao: 1 });
      });
    });
    GROUP.floor = fl.mesh(new T.MeshBasicMaterial({ vertexColors: true, transparent: true })); scene.add(GROUP.floor);

    // 골목을 가로지르는 줄 전구
    ST.forEach(function (s, si) {
      if (s.kind !== "alley") return;
      for (var ld = 40; ld < s.len - 40; ld += 110) {
        var a = MAP.pointOn(s, ld, -s.w / 2 - 2), b = MAP.pointOn(s, ld + 24, s.w / 2 + 2), yy = 62 + (si % 3) * 6;
        for (var k = 0; k <= 9; k++) { var t = k / 9, sag = Math.sin(Math.PI * t) * 8; bulbPts.push(lerp(a[0], b[0], t), yy - sag, lerp(a[1], b[1], t)); }
      }
    });

    /* --- 빛 번짐 --- */
    var gt = glowTex(); GROUP.glowTex = gt;
    function points(arr, size, op) {
      var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
      var m = new T.PointsMaterial({ map: gt, size: size, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, color: 0xffffff });
      var pts = new T.Points(g, m); scene.add(pts); return pts;
    }
    glowBig = points(glowPts, 46, 0.12);
    glowSmall = points(bulbPts, 14, 0.5);
    var bulbGeo = new T.BufferGeometry(); bulbGeo.setAttribute("position", new T.Float32BufferAttribute(bulbPts, 3));
    GROUP.bulbs = new T.Points(bulbGeo, new T.PointsMaterial({ color: 0xFFF2C4, size: 1.8, sizeAttenuation: true })); scene.add(GROUP.bulbs);
    // 줄 전구 전선
    var wire = []; for (var wi = 0; wi + 3 < bulbPts.length; wi += 3) { if ((wi / 3) % 10 === 9) continue; wire.push(bulbPts[wi], bulbPts[wi + 1], bulbPts[wi + 2], bulbPts[wi + 3], bulbPts[wi + 4], bulbPts[wi + 5]); }
    var wg = new T.BufferGeometry(); wg.setAttribute("position", new T.Float32BufferAttribute(wire, 3));
    scene.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0x2A2B2D, transparent: true, opacity: 0.7 })));

    /* --- 사람 (멀리: 가벼운 실루엣 / 가까이: 실제 사람 몸의 실루엣) --- */
    function cyl(r0, r1, h, x, y, z, rz) { var c = new T.CylinderGeometry(r0, r1, h, 7); if (rz) c.rotateZ(rz); c.translate(x, y, z); return c; }
    var hd = new T.SphereGeometry(1.4, 10, 8); hd.scale(1, 1.15, 1.05); hd.translate(0, 15.3, 0);
    var g = mergeGeos([
      cyl(0.85, 0.65, 7.8, -0.95, 3.9, 0), cyl(0.85, 0.65, 7.8, 0.95, 3.9, 0),
      cyl(2.0, 1.7, 6.6, 0, 10.6, 0),
      cyl(0.55, 0.45, 6.0, -2.4, 10.4, 0, 0.08), cyl(0.55, 0.45, 6.0, 2.4, 10.4, 0, -0.08),
      cyl(0.55, 0.55, 1.2, 0, 13.9, 0), hd
    ]);
    var n = (CFG.agents3d || 520);
    MATS.crowd = silhouetteMat("#2F312D");
    // 사진 기반 사람 2명을 줄인 가벼운 몸 (없으면 단순한 몸)
    function crowdGeo(b64) {
      var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var cg = new T.BufferGeometry(); cg.setAttribute("position", new T.BufferAttribute(new Float32Array(u.buffer), 3)); cg.computeVertexNormals(); return cg;
    }
    var gB = g;
    if (window.MD_CROWD) { try { g = crowdGeo(window.MD_CROWD.a); gB = crowdGeo(window.MD_CROWD.b); } catch (e) { } }
    var half = Math.ceil(n / 2);
    people = new T.InstancedMesh(g, MATS.crowd, half);
    people2 = new T.InstancedMesh(gB, MATS.crowd, half);
    peopleAgents = MAP.makeAgents(n, 77, window.MD_SWITCH_T || null);
    var pc = ["#2C2E2A", "#34362F", "#3B3D38", "#26282A", "#40423C", "#2F3133"];
    for (var j = 0; j < n; j++) (j & 1 ? people2 : people).setColorAt(j >> 1, hex(pc[(R() * pc.length) | 0]));
    [people, people2].forEach(function (pm) { pm.instanceMatrix.setUsage(T.DynamicDrawUsage); pm.frustumCulled = false; scene.add(pm); });
    dummy = new T.Object3D();

    // 제품 자리 (빛 웅덩이)
    api.spotGlow = [];
    MAP.spots.forEach(function (sp) {
      var m = new T.Mesh(new T.CircleGeometry(26, 32), new T.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(sp[0], 0.4, sp[1]); scene.add(m); api.spotGlow.push(m);
    });

    camera = new T.PerspectiveCamera(32, 1, 0.5, 9000);
    shadowSetup();
    setLook({ dark: 0, floor: 1, tables: 1, tint: 1 });
    if (MODELS_PARSED) addModels();
  }

  function shadowSetup() {
    if (!renderer || !renderer.shadowMap.enabled) return;
    scene.traverse(function (o) {
      if (!o.isMesh || o === people || o === people2 || o.isSkinnedMesh) return;
      var m = o.material; if (!m || m.isMeshBasicMaterial || m.transparent || m.isShaderMaterial) return;
      o.castShadow = true; o.receiveShadow = true;
    });
    renderer.shadowMap.needsUpdate = true;
  }
  /* 실루엣 재질: 짙은 무광 + 가장자리 빛 (얼굴 · 옷 무늬 대신 몸의 형태만 보임) */
  function silhouetteMat(col) {
    var m = new T.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0, envMapIntensity: 0.35, side: T.DoubleSide });   // 손을 떼어 낸 자리도 비어 보이지 않게
    m.userData.rim = { value: new T.Color(0xE9E2CC).multiplyScalar(0.36) };
    m.onBeforeCompile = function (sh) {
      sh.uniforms.rimCol = m.userData.rim;
      sh.fragmentShader = "uniform vec3 rimCol;\n" + sh.fragmentShader.replace("#include <opaque_fragment>",
        "float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);\noutgoingLight += rimCol * rimF;\n#include <opaque_fragment>");
    };
    return m;
  }

  /* 낮 → 밤, 바닥 조명, 테이블 (연도 흐름에 맞춰) */
  var DAY_SKY = hex("#E8E6DF"), NIGHT_SKY = hex("#141720"), tmpC = new T.Color();
  function setLook(o) {
    if (!scene) return;
    var d = o.dark == null ? LOOK.dark : clamp(o.dark, 0, 1);
    if (o.floor != null) LOOK.floor = o.floor;
    if (o.tables != null) LOOK.tables = o.tables;
    if (d !== LOOK.dark) {
      LOOK.dark = d;
      tmpC.copy(DAY_SKY).lerp(NIGHT_SKY, d); scene.background.copy(tmpC); scene.fog.color.copy(tmpC);
      GROUP.hemi.intensity = lerp(0.7, 0.16, d); GROUP.sun.intensity = lerp(2.1, 0.0, d);
      GROUP.hemi.color.set(0xF2F3F2).lerp(tmpC.set(0x9FB0D8), d);
      if ("environmentIntensity" in scene) scene.environmentIntensity = lerp(0.75, 0.15, d);
      MATS.fill.emissiveIntensity = 0.95 * d;
      MATS.sign.emissiveIntensity = lerp(0.35, 1.25, d); MATS.ad.emissiveIntensity = lerp(0.3, 1.1, d);
      if (MATS.kitSigns) MATS.kitSigns.forEach(function (m) { m.emissiveIntensity = lerp(m.userData.e0, m.userData.e0 * 2.6 + 0.4, d); });
      if (MATS.inside) MATS.inside.emissiveIntensity = lerp(0.05, 0.9, d);
      if (MATS.light) MATS.light.color.setScalar(lerp(0.92, 1.35, d));
      glowBig.material.opacity = lerp(0.1, 0.55, d); glowSmall.material.opacity = lerp(0.35, 1, d);
      MATS.road.color.setScalar(lerp(1, 0.8, d));
      [MATS.crowd, MATS.person].forEach(function (m) { if (m && m.userData.rim) m.userData.rim.value.set(0xE9E2CC).multiplyScalar(lerp(0.36, 0.2, d)); });
      GROUP.ground.material.color.set(0x8E8B85).multiplyScalar(lerp(1, 0.35, d));
    }
    GROUP.floor.visible = LOOK.floor > 0.01; GROUP.floor.material.opacity = clamp(LOOK.floor, 0, 1);
    if (PROD.tablesIM) PROD.tablesIM.forEach(function (im) { im.visible = LOOK.tables > 0.01; });
  }
  api.setLook = setLook;

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

  /* =========================================================
     3D 모델 불러오기 (js/models/*.js → GLB)
     ========================================================= */
  var MODEL_NAMES = ["01_bld", "02_bld", "03_bld", "04_bld", "sign_01", "sign_02", "sign_03", "sign_04", "sign_05", "sign_06",
                     "streetfold", "foldmark", "rig_person_01", "rig_person_02", "rig_person_03", "rig_person_04", "rig_person_05", "sticker", "kit_street", "tower",
                     "floway", "staygap_1", "staygap_2", "staygap_3", "naviar"];   // v4.5 팀원 제품
  if (window.MD_LITE) MODEL_NAMES = MODEL_NAMES.filter(function (n) { return /bld|sign|streetfold|kit_street|floway|staygap_1|naviar/.test(n); });   // 휴대폰용: 가볍게
  var MD = {}, MODELS_PARSED = false, loadStarted = false;
  function b64buf(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function loadModels() {
    if (loadStarted || !T.GLTFLoader) return; loadStarted = true;
    var store = window.MD_MODELS = window.MD_MODELS || {}, i = 0, loader = new T.GLTFLoader(), left = 0;
    function parseAll() {
      MODEL_NAMES.forEach(function (n) {
        if (!store[n] || n === "sticker") return;
        left++;
        loader.parse(b64buf(store[n]), "", function (g) { MD[n] = g; store[n] = null; if (--left === 0) done(); }, function () { if (--left === 0) done(); });
      });
      if (left === 0) done();
    }
    function done() { MODELS_PARSED = true; if (built) addModels(); }
    (function next() {
      if (i >= MODEL_NAMES.length) { parseAll(); return; }
      var n = MODEL_NAMES[i++];
      if (store[n]) { next(); return; }
      var s = document.createElement("script"); s.src = (window.MD_MODEL_BASE || "./js/models/") + n + ".js"; s.onload = s.onerror = function () { next(); };
      document.head.appendChild(s);
    })();
  }

  // 모델의 모든 조각을 같은 재질끼리 합침 → 그리는 횟수를 줄임
  function flatten(root, filter, extra) {
    root.updateMatrixWorld(true);
    var groups = {};
    root.traverse(function (o) {
      if (!o.isMesh || (filter && !filter(o))) return;
      var g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      if (extra) g.applyMatrix4(extra);
      Object.keys(g.attributes).forEach(function (k) { if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k); });
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.index) { var idx = []; for (var i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
      ["position", "normal", "uv"].forEach(function (k) { var a = g.attributes[k]; if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) { var arr = new Float32Array(a.count * a.itemSize); for (var i = 0; i < a.count; i++) for (var c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c); g.setAttribute(k, new T.BufferAttribute(arr, a.itemSize)); } });
      var key = o.material.uuid; (groups[key] = groups[key] || { m: o.material, list: [] }).list.push(g);
    });
    return Object.keys(groups).map(function (k) { return { mat: groups[k].m, geo: T.BufferGeometryUtils.mergeGeometries(groups[k].list, false) }; });
  }
  function instanced(parts, mats, parent) {
    return parts.map(function (p) {
      var im = new T.InstancedMesh(p.geo, p.mat, mats.length);
      mats.forEach(function (m, i) { im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.frustumCulled = false;
      (parent || scene).add(im); return im;
    });
  }
  function matte(m) {   // 팀 무드: 무광 플라스틱이 메인 (유리·금속은 보조)
    if (m && m.isMeshStandardMaterial) { m.envMapIntensity = 0.9; if (!/glass|glazing|Curtain/i.test(m.name || "")) m.roughness = Math.max(m.roughness, 0.55); }
    return m;
  }
  function trs(x, y, z, ry, s, sy) {
    var m = new T.Matrix4(); m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), new T.Vector3(s, sy || s, s)); return m;
  }

  /* =========================================================
     거리 키트 (kit_street): 건물 16종 · 노점 수레를 뽑아 길가에 줄지어 세움
     재질은 몇 가지로 묶어(벽 · 몸체 · 유리 · 불빛 · 실내) 그리는 횟수를 줄임
     ========================================================= */
  function prepGeo(o, mtx, withUV) {
    var g = o.geometry.clone(); g.applyMatrix4(mtx);
    Object.keys(g.attributes).forEach(function (k) { if (k !== "position" && k !== "normal" && !(withUV && k === "uv")) g.deleteAttribute(k); });
    if (!g.attributes.normal) g.computeVertexNormals();
    if (withUV && !g.attributes.uv) g.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { var idx = []; for (var i = 0; i < g.attributes.position.count; i++) idx.push(i); g.setIndex(idx); }
    Object.keys(g.attributes).forEach(function (k) {
      var a = g.attributes[k];
      if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
        var arr = new Float32Array(a.count * a.itemSize); for (var i = 0; i < a.count; i++) for (var c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
        g.setAttribute(k, new T.BufferAttribute(arr, a.itemSize));
      }
    });
    if (g.index.array instanceof Uint16Array === false && g.index.array instanceof Uint32Array === false) g.setIndex(Array.prototype.slice.call(g.index.array));
    return g;
  }
  function paint(g, col) {
    var n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    g.setAttribute("color", new T.BufferAttribute(a, 3)); return g;
  }
  function bucketOf(m) {
    var n = m.name || "";
    if (m.map || m.emissiveMap) return "tex";
    if (/Neutral exterior/i.test(n)) return "wall";
    if (m.transparent || m.opacity < 0.99 || /Clear shopfront glass/i.test(n)) return "glassT";
    if (/glaz|glass/i.test(n)) return "glass";
    if (/interior/i.test(n) && !/ceiling|strip/i.test(n)) return "inside";
    var e = m.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0;
    if (e > 0.25 || /lamp|strip|lettering|ceiling|diffuser|Stall lighting/i.test(n)) return "light";
    return "solid";
  }
  function kitMats() {
    if (MATS.kit) return;
    MATS.kit = true;
    MATS.wall = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.55 });
    MATS.solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12, envMapIntensity: 0.7 });
    MATS.glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0.3, envMapIntensity: 1.25 });
    MATS.glassT = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.2, transparent: true, opacity: 0.32, depthWrite: false });
    MATS.inside = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, emissive: 0xFFD9A8, emissiveIntensity: 0.05 });
    MATS.light = new T.MeshBasicMaterial({ vertexColors: true });
    MATS.kitSigns = [];
  }
  // 한 묶음(모듈) → { 재질묶음: geometry }
  function bundle(meshes, norm) {
    kitMats();
    var B = {}, TX = {};
    meshes.forEach(function (o) {
      var m = o.material, k = bucketOf(m), mtx = new T.Matrix4().multiplyMatrices(norm, o.matrixWorld);
      if (k === "tex") {
        if (!TX[m.uuid]) {
          matte(m); m.userData.e0 = m.emissiveIntensity == null ? 1 : m.emissiveIntensity;
          if (MATS.kitSigns.indexOf(m) < 0) MATS.kitSigns.push(m);
          TX[m.uuid] = { mat: m, list: [] };
        }
        TX[m.uuid].list.push(prepGeo(o, mtx, true)); return;
      }
      var col = m.color ? m.color.clone() : new T.Color(1, 1, 1);
      if (k === "light" && m.emissive && m.emissive.r + m.emissive.g + m.emissive.b > 0.25) col = m.emissive.clone().multiplyScalar(Math.min(1.2, m.emissiveIntensity || 1));
      if (k === "wall") col.setScalar(1);
      (B[k] = B[k] || []).push(paint(prepGeo(o, mtx, false), col));
    });
    var out = [];
    Object.keys(B).forEach(function (k) { out.push({ mat: MATS[k], geo: T.BufferGeometryUtils.mergeGeometries(B[k], false), wall: k === "wall" }); });
    Object.keys(TX).forEach(function (k) { out.push({ mat: TX[k].mat, geo: T.BufferGeometryUtils.mergeGeometries(TX[k].list, false) }); });
    return out;
  }
  var KIT_SKIP = /cable|screw|bolt|mounting[ _]plate|standoff|Vent[ _]slots|handle|caster|fastener/i;
  function setupKit(root) {
    root.updateMatrixWorld(true);
    var shells = [], carts = [], all = [];
    root.traverse(function (o) {
      var mm = /^Building[ _]shell[ _](-?1)[ _](\d+)$/.exec(o.name || "");
      if (mm && !(o.parent && /^Building[ _]shell/.test(o.parent.name || ""))) { var b = new T.Box3().setFromObject(o); shells.push({ side: +mm[1], i: +mm[2], b: b, list: [] }); }
      if (/^Street[ _]food[ _]cart[._]?\d*$/.test(o.name || "") && !(o.parent && /^Street[ _]food[ _]cart/.test(o.parent.name || ""))) { var bc = new T.Box3().setFromObject(o); carts.push({ c: bc.getCenter(new T.Vector3()), list: [] }); }
      if (o.isMesh) all.push(o);
    });
    shells.sort(function (a, b) { return a.side - b.side || a.i - b.i; });
    var tmpB = new T.Box3(), c = new T.Vector3();
    all.forEach(function (o) {
      tmpB.setFromObject(o); tmpB.getCenter(c);
      if (KIT_SKIP.test(o.name || "") || (o.parent && KIT_SKIP.test(o.parent.name || ""))) return;   // 나사 · 전선 같은 아주 작은 부품은 생략 (가볍게)
      if (Math.abs(c.x) > 3.3 && Math.abs(c.x) < 11) {
        for (var i = 0; i < shells.length; i++) { var s = shells[i]; if (Math.sign(c.x) === s.side && c.z > s.b.min.z - 0.06 && c.z < s.b.max.z + 0.06) { s.list.push(o); return; } }
      } else if (Math.abs(c.x) <= 3.3 && c.y < 3) {
        for (var j = 0; j < carts.length; j++) { var k = carts[j]; if (Math.abs(c.x - k.c.x) < 1.15 && Math.abs(c.z - k.c.z) < 1.7) { k.list.push(o); return; } }
      }
    });
    // 모듈: 정면(길 쪽)이 +z, 정면 가운데 바닥이 원점이 되도록
    var mods = shells.map(function (s) {
      var zc = (s.b.min.z + s.b.max.z) / 2, fx = s.side < 0 ? s.b.max.x : s.b.min.x;
      var norm = new T.Matrix4().makeRotationY(s.side < 0 ? -Math.PI / 2 : Math.PI / 2).multiply(new T.Matrix4().makeTranslation(-fx, 0, -zc));
      var lite = s.list.filter(function (o) { return !/Shop[ _]name|Air[ _]conditioning|Roller[ _]shutter|plinth/i.test((o.name || "") + " " + (o.parent ? o.parent.name : "")); });
      return { parts: bundle(s.list, norm), partsLite: bundle(lite, norm), h: s.b.max.y };   // 골목: 글자 · 실외기 같은 잔부품 생략
    });
    // 키트 높이표가 실제와 다르면 바로잡음 (간판 위치가 건물 위로 나가지 않게)
    mods.forEach(function (m, i) { KIT_H[i] = m.h; });
    if (!mods.length) throw new Error("kit: 건물 모듈을 찾지 못함");
    var slotsBy = [];
    FRONT.forEach(function (f) { var k = (f.m % mods.length) * 2 + (f.st.kind === "main" ? 0 : 1); (slotsBy[k] = slotsBy[k] || []).push(f); });
    var LITE = !!window.MD_LITE;
    slotsBy.forEach(function (list, k) {
      if (!list || !list.length) return;
      var md = mods[k >> 1], partsK = ((k & 1) || window.MD_LITE) ? md.partsLite : md.parts;
      var mats = list.map(function (f) { return trs(f.x, 0, f.z, f.ry, M); });
      partsK.forEach(function (p) {
        if (LITE && (p.mat === MATS.inside || p.mat === MATS.glassT)) return;
        var im = new T.InstancedMesh(p.geo, p.mat, mats.length);
        mats.forEach(function (m, k) { im.setMatrixAt(k, m); if (p.wall) im.setColorAt(k, hex(list[k].tone)); });
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.frustumCulled = false; scene.add(im);
      });
    });
    if (GROUP.ph) { scene.remove(GROUP.ph); GROUP.ph.geometry.dispose(); GROUP.ph = null; }
    // 노점 수레 (첫 번째 수레를 기준으로)
    var cart = carts.filter(function (k) { return k.list.length > 4; })[0];
    if (cart) {
      var cn = new T.Matrix4().makeTranslation(-cart.c.x, 0, -cart.c.z);
      var parts = bundle(cart.list, cn), main = ST[0], ry = Math.atan2(main.ux, main.uy);
      PROD.cart = parts;      // (v4.2: 노점은 직접 만든 포장마차를 씀 — 키트 수레는 쓰지 않음)
    }
    setLook({ dark: LOOK.dark < 0 ? 0 : LOOK.dark + 1e-6 });
  }
  function setupTowers(root) {
    if (!TOWERS.length) return;
    var box = new T.Box3().setFromObject(root), parts = flatten(root), sz = box.getSize(new T.Vector3());
    parts.forEach(function (p) { if (p.mat.isMeshStandardMaterial) { p.mat.envMapIntensity = 1.1; p.mat.roughness = Math.min(p.mat.roughness, 0.5); } });
    var base = new T.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    instanced(parts, TOWERS.map(function (tw) {
      var s = tw.h / sz.y, m = new T.Matrix4().compose(new T.Vector3(tw.x, 0, tw.z), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), tw.ry), new T.Vector3(tw.w / sz.x, s, tw.d / sz.z));
      return m.multiply(base);
    }));
    if (GROUP.phT) { scene.remove(GROUP.phT); GROUP.phT = null; }
  }

  /* =========================================================
     명동 포장마차 (레퍼런스 사진 기준으로 직접 만든 3D)
     - 바퀴 달린 짙은 철제 수레, 스테인리스 상판, 숯불 그릴 + 석쇠, 진열 쟁반
     - 기둥 · 지붕 틀 · 앞쪽 큰 간판(종류 4가지) · 옆 메뉴판 · 백열 갓등 3개
     - 닭꼬치(고기 + 대파), 양념 병, 종이컵 · 종이 트레이 더미
     좌표: m 단위, x = 길 방향(길이), z = +면 사장님 쪽, y = 위. 놓을 때 M 배로 키움
     ========================================================= */
  var STALL_TOP_M = 0.895;
  var STALL_KIND = [
    { ko: "명동 닭꼬치", en: "CHICKEN SKEWERS", price: "4,000", bg: "#C8242B", fg: "#FFFFFF", ac: "#F4C21B" },
    { ko: "문어꼬치", en: "GRILLED OCTOPUS", price: "8,000", bg: "#F6F3EA", fg: "#1E2A4A", ac: "#C8242B" },
    { ko: "치즈 닭꼬치", en: "CHEESE CHICKEN", price: "5,000", bg: "#F2BE18", fg: "#1E1F21", ac: "#C8242B" },
    { ko: "숯불 꼬치", en: "CHARCOAL SKEWERS", price: "4,500", bg: "#1E1F21", fg: "#F4C21B", ac: "#E8761C" }
  ];
  function stallTex() {                                    // 간판 4종 + 앞판 메뉴 그림 + 옆 메뉴판 (한 장에)
    var c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
    var g = c.getContext("2d");
    function skewerPic(x, y, w, h, glaze) {                // 메뉴 사진 같은 꼬치 그림
      var bg = g.createLinearGradient(x, y, x, y + h); bg.addColorStop(0, "#3A2A20"); bg.addColorStop(1, "#1A1310");
      g.fillStyle = bg; g.fillRect(x, y, w, h);
      for (var k = 0; k < 3; k++) {
        var yy = y + h * (0.28 + k * 0.24);
        g.strokeStyle = "#D9B77E"; g.lineWidth = h * 0.03; g.beginPath(); g.moveTo(x + w * 0.04, yy); g.lineTo(x + w * 0.96, yy); g.stroke();
        for (var q = 0; q < 6; q++) {
          var cx = x + w * (0.16 + q * 0.13), onion = q % 2 === 1;
          g.fillStyle = onion ? "#E4E8C8" : (glaze ? "#8E3B1C" : "#C98B4E");
          g.beginPath(); g.ellipse(cx, yy, w * (onion ? 0.035 : 0.06), h * (onion ? 0.07 : 0.1), 0, 0, 6.3); g.fill();
          if (onion) { g.fillStyle = "#7FA34A"; g.fillRect(cx - w * 0.01, yy - h * 0.07, w * 0.02, h * 0.14); }
          else { g.fillStyle = "rgba(255,230,190,.35)"; g.beginPath(); g.ellipse(cx - w * 0.015, yy - h * 0.035, w * 0.025, h * 0.03, 0, 0, 6.3); g.fill(); }
        }
      }
    }
    // 1) 간판 4종: 각 1024 x 128 (위에서부터 4줄)
    STALL_KIND.forEach(function (k, i) {
      var y = i * 128;
      g.fillStyle = k.bg; g.fillRect(0, y, 1024, 128);
      g.fillStyle = k.ac; g.fillRect(0, y, 1024, 10); g.fillRect(0, y + 118, 1024, 10);
      g.fillStyle = k.ac; g.beginPath(); g.arc(80, y + 64, 40, 0, 6.3); g.fill();
      g.fillStyle = k.bg; g.font = "900 34px " + KFONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("生", 80, y + 66);
      g.fillStyle = k.fg; g.font = "900 70px " + KFONT; g.textAlign = "left"; g.fillText(k.ko, 140, y + 60);
      g.font = "700 20px Pretendard, Arial, sans-serif"; g.globalAlpha = 0.85; g.fillText(k.en, 146, y + 104); g.globalAlpha = 1;
      skewerPic(700, y + 18, 170, 92, i % 2 === 0);
      g.fillStyle = k.ac; g.fillRect(884, y + 26, 124, 76); g.fillStyle = k.bg === "#F2BE18" ? "#FFFFFF" : k.fg;
      g.font = "900 34px Pretendard, Arial, sans-serif"; g.textAlign = "center"; g.fillText(k.price, 946, y + 66);
    });
    // 2) 수레 앞판 (손님 쪽): 1024 x 256, y 512~768
    var y0 = 512; g.fillStyle = "#26282A"; g.fillRect(0, y0, 1024, 256);
    g.fillStyle = "#C8242B"; g.fillRect(0, y0, 1024, 54);
    g.fillStyle = "#FFFFFF"; g.font = "900 36px " + KFONT; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("명동 길거리 꼬치 · STREET FOOD", 24, y0 + 28);
    for (var m = 0; m < 4; m++) {
      var mx = 24 + m * 250; skewerPic(mx, y0 + 70, 230, 120, m % 2 === 1);
      g.fillStyle = "#F4C21B"; g.fillRect(mx, y0 + 196, 230, 44);
      g.fillStyle = "#1E1F21"; g.font = "800 24px " + KFONT; g.textAlign = "center";
      g.fillText(["닭꼬치 4,000", "양념 4,500", "치즈 5,000", "파닭 4,500"][m], mx + 115, y0 + 219);
    }
    // 3) 옆 메뉴판 (세로): 256 x 256, y 768~1024, x 0~256  / 4) 숯불 빛: x 256~512
    g.fillStyle = "#FFFDF4"; g.fillRect(0, 768, 256, 256);
    g.fillStyle = "#C8242B"; g.fillRect(0, 768, 256, 44); g.fillStyle = "#FFFFFF"; g.font = "900 26px " + KFONT; g.textAlign = "center"; g.fillText("MENU 메뉴", 128, 791);
    ["닭꼬치", "양념꼬치", "치즈꼬치", "파닭꼬치", "음료"].forEach(function (t, i) {
      g.fillStyle = "#1E1F21"; g.font = "700 22px " + KFONT; g.textAlign = "left"; g.fillText(t, 18, 838 + i * 36);
      g.textAlign = "right"; g.fillText(["4,000", "4,500", "5,000", "4,500", "2,000"][i], 238, 838 + i * 36);
    });
    var gr = g.createRadialGradient(384, 896, 6, 384, 896, 128); gr.addColorStop(0, "#FFD27A"); gr.addColorStop(0.35, "#FF7A1E"); gr.addColorStop(0.7, "#8A1E0A"); gr.addColorStop(1, "#1A0A06");
    g.fillStyle = gr; g.fillRect(256, 768, 256, 256);
    for (var e = 0; e < 140; e++) { g.fillStyle = "rgba(255," + (120 + (e * 37) % 120) + ",40," + (0.25 + (e % 5) * 0.12) + ")"; g.fillRect(256 + (e * 53) % 256, 768 + (e * 97) % 256, 6, 4); }
    var t = canvasTex(c); return t;
  }
  // UV 구역 (캔버스 1024 기준, three 는 v 를 아래에서부터 셈)
  function uvRect(x0, y0, x1, y1) { return [[x0 / 1024, 1 - y1 / 1024], [x1 / 1024, 1 - y1 / 1024], [x1 / 1024, 1 - y0 / 1024], [x0 / 1024, 1 - y0 / 1024]]; }
  function uvSide(x0, y0, x1, y1) { return [[x1 / 1024, 1 - y1 / 1024], [x0 / 1024, 1 - y1 / 1024], [x0 / 1024, 1 - y0 / 1024], [x1 / 1024, 1 - y0 / 1024]]; }   // 옆면용 (글자가 뒤집히지 않게)

  function stallParts(hi) {
    var B = { steel: new Builder(), stain: new Builder(), dark: new Builder(), wood: new Builder(), meat: new Builder(), onion: new Builder(), print: new Builder(), lamp: new Builder(), roof: new Builder(), coal: new Builder(), bulb: new Builder() };
    var C = function (h) { return hex(h); };
    function bx(b, x, z, w, d, y0, y1, col, o) { B[b].box(x, z, w, d, y0, y1, 0, col, col, o || { ao: 0.9 }); }
    var L = 2.0, D = 0.9, top = STALL_TOP_M;
    // 수레 몸통 (짙은 철판) + 아래 틀 + 바퀴
    bx("steel", 0, 0, L, D, 0.2, top - 0.035, C("#3A3D3F"), { ao: 0.85 });
    bx("dark", 0, 0, L + 0.04, D + 0.04, 0.17, 0.21, C("#1F2123"));
    [[-0.82, -0.36], [0.82, -0.36], [-0.82, 0.36], [0.82, 0.36]].forEach(function (p) {
      var wg = new T.CylinderGeometry(0.085, 0.085, 0.05, 14); wg.rotateZ(Math.PI / 2); wg.translate(p[0], 0.09, p[1]);
      B.dark.addGeo(wg, C("#151617")); bx("stain", p[0], p[1], 0.04, 0.03, 0.09, 0.18, C("#8C9090"));
    });
    // 앞판 메뉴 그림 (손님 쪽 = -z 면)
    B.print.box(0, -D / 2 - 0.006, L * 0.96, 0.01, 0.26, 0.8, 0, C("#FFFFFF"), C("#FFFFFF"), { ao: 1, faceUV: [uvSide(0, 512, 1024, 768), null, null, null], faceCol: C("#FFFFFF"), sideUV: [0.3, 0.02] });
    // 스테인리스 상판 + 앞 가장자리
    bx("stain", 0, 0, L + 0.1, D + 0.1, top - 0.035, top, C("#C9CCCB"), { ao: 1 });
    bx("stain", 0, -D / 2 - 0.05, L + 0.1, 0.02, top - 0.07, top + 0.012, C("#B9BCBB"), { ao: 1 });
    // 숯불 그릴 (사장님 쪽 절반) — 불통 · 숯불 빛 · 석쇠
    var gx0 = -0.95, gx1 = 0.25, gz = 0.2, gd = 0.42;
    bx("steel", (gx0 + gx1) / 2, gz, gx1 - gx0, gd, top, top + 0.11, C("#2A2C2E"), { ao: 0.8 });
    B.coal.box((gx0 + gx1) / 2, gz, gx1 - gx0 - 0.04, gd - 0.04, top + 0.06, top + 0.112, 0, C("#FFFFFF"), C("#FFFFFF"), { ao: 1, topUV: uvRect(256, 768, 512, 1024), sideUV: [0.35, 0.05], only: [] });
    for (var b = 0; b <= 16; b++) { var bz = gz - gd / 2 + 0.02 + b * (gd - 0.04) / 16; bx("stain", (gx0 + gx1) / 2, bz, gx1 - gx0 - 0.02, 0.005, top + 0.118, top + 0.124, C("#6E7272"), { ao: 1 }); }
    // 진열 쟁반 (손님 쪽, 살짝 기울어진 단)
    bx("stain", -0.3, -0.26, 1.3, 0.3, top, top + 0.03, C("#D6D8D7"), { ao: 0.95 });
    bx("stain", -0.3, -0.26, 1.26, 0.26, top + 0.03, top + 0.034, C("#E3E4E3"), { ao: 1 });
    // 꼬치: 석쇠 위 + 진열 쟁반 위
    var R = rng(hi ? 17 : 5), nG = hi ? 16 : 10, nD = hi ? 14 : 8;
    function skewer(x, z, y, ang, glaze, cook) {
      var cosA = Math.cos(ang), sinA = Math.sin(ang);
      function P(t) { return [x + sinA * t, z + cosA * t]; }      // 꼬치 방향 (z 쪽)
      var sg = new T.CylinderGeometry(0.0028, 0.0028, 0.27, 5); sg.rotateX(Math.PI / 2); sg.rotateY(ang); var p0 = P(0.02); sg.translate(p0[0], y, p0[1]);
      B.wood.addGeo(sg, C(cook ? "#B98A4E" : "#D9B77E"));
      for (var k = 0; k < 7; k++) {
        var t = -0.085 + k * 0.03, p = P(t), onion = k % 2 === 1;
        if (onion) {
          var og = new T.CylinderGeometry(0.0095, 0.0095, 0.024, hi ? 9 : 6); og.rotateX(Math.PI / 2); og.rotateY(ang); og.translate(p[0], y + 0.002, p[1]);
          B.onion.addGeo(og, C(R() < 0.5 ? "#E6E9C8" : "#C9D99A"));
        } else {
          var mg = new T.IcosahedronGeometry(0.019, hi ? 1 : 0); mg.scale(1 + R() * 0.25, 0.75 + R() * 0.2, 0.9 + R() * 0.2); mg.rotateY(R() * 3); mg.translate(p[0], y + 0.004, p[1]);
          var base = glaze ? C("#8A3818") : (cook ? C("#C2834A") : C("#E7C3A4"));
          base.offsetHSL(0, 0, (R() - 0.5) * 0.06);
          B.meat.addGeo(mg, base);
        }
      }
    }
    for (var i = 0; i < nG; i++) skewer(gx0 + 0.08 + i * (gx1 - gx0 - 0.16) / (nG - 1), gz, top + 0.14, 0, i % 3 === 0, true);
    for (var j = 0; j < nD; j++) skewer(-0.88 + j * (1.16 / (nD - 1)), -0.26, top + 0.052, 0.12, j % 2 === 0, j % 3 !== 2);
    // 양념 병 · 붓 통 · 종이컵 · 트레이 더미 (오른쪽 끝, FOLD MARK 자리는 비움)
    [["#C8242B", 0.42], ["#F2BE18", 0.5], ["#F6F3EA", 0.58]].forEach(function (b2) {
      var bg = new T.CylinderGeometry(0.028, 0.032, 0.2, 10); bg.translate(b2[1], top + 0.1, 0.32); B.lamp.addGeo(bg, C(b2[0]));
      var cg = new T.CylinderGeometry(0.006, 0.014, 0.04, 8); cg.translate(b2[1], top + 0.22, 0.32); B.lamp.addGeo(cg, C(b2[0]).multiplyScalar(0.8));
    });
    var cup = new T.CylinderGeometry(0.045, 0.035, 0.24, 12); cup.translate(0.92, top + 0.12, -0.32); B.lamp.addGeo(cup, C("#F4F0E6"));
    bx("lamp", 0.4, -0.32, 0.22, 0.08, top, top + 0.07, C("#EFEBE0"));
    // 기둥 · 지붕 틀 · 지붕판
    var PH = 2.15;
    [[-L / 2, -D / 2], [L / 2, -D / 2], [-L / 2, D / 2], [L / 2, D / 2]].forEach(function (p) { bx("dark", p[0], p[1], 0.035, 0.035, top, PH, C("#2B2D2F")); });
    bx("dark", 0, -D / 2, L + 0.04, 0.035, PH - 0.035, PH, C("#2B2D2F")); bx("dark", 0, D / 2, L + 0.04, 0.035, PH - 0.035, PH, C("#2B2D2F"));
    bx("dark", -L / 2, 0, 0.035, D, PH - 0.035, PH, C("#2B2D2F")); bx("dark", L / 2, 0, 0.035, D, PH - 0.035, PH, C("#2B2D2F"));
    bx("dark", 0, 0, L, 0.03, PH - 0.12, PH - 0.09, C("#2B2D2F"));                                  // 등 거는 가운데 봉
    B.roof.box(0, 0.05, L + 0.24, D + 0.4, PH, PH + 0.025, 0, C("#E7E3D8"), C("#BDB8AC"), { ao: 1 });
    // 앞 간판 (종류별로 따로 → sign 0~3) : 위쪽 손님 방향
    var sign = [];
    STALL_KIND.forEach(function (k, i) {
      var sb = new Builder();
      sb.box(0, -D / 2 - 0.1, L + 0.12, 0.05, PH - 0.42, PH + 0.02, 0, hex("#FFFFFF"), hex("#FFFFFF"),
        { ao: 1, faceUV: [uvSide(0, i * 128, 1024, i * 128 + 128), null, uvSide(0, i * 128, 1024, i * 128 + 128), null], faceCol: hex("#FFFFFF"), sideUV: [0.68, 0.05] });
      sign.push(sb);
    });
    // 옆 메뉴판 (손님 쪽 오른 기둥)
    B.print.box(L / 2 + 0.03, -D / 2 + 0.12, 0.01, 0.26, top + 0.35, top + 0.62, 0, C("#FFFFFF"), C("#FFFFFF"), { ao: 1, faceUV: [null, uvSide(0, 768, 256, 1024), null, uvSide(0, 768, 256, 1024)], faceCol: C("#FFFFFF"), sideUV: [0.1, 0.1] });
    // 백열 갓등 3개 (가운데 봉에 매달림) + 전구
    var bulbs = [];
    [-0.6, 0, 0.6].forEach(function (x) {
      var sh = new T.CylinderGeometry(0.03, 0.1, 0.11, 14, 1, true); sh.translate(x, PH - 0.42, 0); B.dark.addGeo(sh, C("#2E2A24"));
      var cd = new T.CylinderGeometry(0.004, 0.004, 0.32, 4); cd.translate(x, PH - 0.25, 0); B.dark.addGeo(cd, C("#111111"));
      var bu = new T.SphereGeometry(0.035, 10, 8); bu.translate(x, PH - 0.47, 0); B.bulb.addGeo(bu, C("#FFF1CF"));
      bulbs.push([x, PH - 0.5, 0]);
    });
    return { B: B, sign: sign, bulbs: bulbs, top: top };
  }
  function stallMats() {
    if (MATS.stall) return MATS.stall;
    var tex = stallTex();
    MATS.stall = {
      steel: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }),
      stain: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.1 }),
      dark: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4, side: T.DoubleSide }),
      wood: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
      meat: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0, envMapIntensity: 0.9 }),
      onion: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }),
      print: new T.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.6, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.12 }),
      lamp: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }),
      roof: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: T.DoubleSide }),
      coal: new T.MeshBasicMaterial({ vertexColors: true, map: tex }),
      bulb: new T.MeshBasicMaterial({ vertexColors: true }),
      sign: new T.MeshStandardMaterial({ vertexColors: true, map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 })
    };
    return MATS.stall;
  }
  // 모든 노점 (멀리용: 가벼운 꼬치) + 릴레이 노점 (가까이용: 고운 꼬치) 을 길에 놓음
  function buildStalls() {
    var Ms = stallMats(), main = ST[0], ry = Math.atan2(main.nx, main.ny), rs = relayStall();
    var lo = stallParts(false), hi = stallParts(true), glow = [];
    var mats = [], kinds = [[], [], [], []];
    MAP.stalls.forEach(function (st, i) {
      var m = trs(st.p[0], 0, st.p[1], ry, M);
      if (st === rs) return;
      mats.push(m); kinds[i % 4].push(m);
      lo.bulbs.forEach(function (b) { var v = new T.Vector3(b[0], b[1], b[2]).applyMatrix4(m); glow.push(v.x, v.y, v.z); });
    });
    var parts = [];
    Object.keys(lo.B).forEach(function (k) { if (lo.B[k].p.length) parts.push({ geo: lo.B[k].geometry(), mat: Ms[k] }); });
    instanced(parts, mats);
    lo.sign.forEach(function (sb, i) { if (kinds[i].length) instanced([{ geo: sb.geometry(), mat: Ms.sign }], kinds[i]); });
    // 릴레이 노점 (한 대, 고운 모델)
    var g = new T.Group(); g.position.set(rs.p[0], 0, rs.p[1]); g.rotation.y = ry; g.scale.setScalar(M);
    Object.keys(hi.B).forEach(function (k) { if (hi.B[k].p.length) g.add(new T.Mesh(hi.B[k].geometry(), Ms[k])); });
    g.add(new T.Mesh(hi.sign[0].geometry(), Ms.sign));
    scene.add(g); GROUP.relayStall = g;
    hi.bulbs.forEach(function (b) { var v = new T.Vector3(b[0], b[1], b[2]).applyMatrix4(trs(rs.p[0], 0, rs.p[1], ry, M)); glow.push(v.x, v.y, v.z); });
    GROUP.stallGlow = glow;
  }

  var RIGS = {}, POOL = [], PROD = {};
  function addModels() {
    if (api.modelsReady) return;
    try {
      // 0) 거리 키트 (길가 건물 · 노점 수레) + 바깥 타워
      if (MD.kit_street) setupKit(MD.kit_street.scene);
      if (MD.tower) setupTowers(MD.tower.scene);
      // 1) 대표 건물
      MAP.landmarks.forEach(function (lm) {
        var g = MD[lm.model]; if (!g) return;
        var box = new T.Box3().setFromObject(g.scene), parts = flatten(g.scene);
        parts.forEach(function (p) { matte(p.mat); });
        var m = new T.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
        instanced(parts, [trs(lm.x, 0, lm.z, lm.rot, M).multiply(m)]);
      });
      // 2) 돌출 간판 6종 (큰길)
      var signParts = [];
      for (var k = 1; k <= 6; k++) { var gs = MD["sign_0" + k]; if (gs) signParts.push({ parts: flatten(gs.scene), box: new T.Box3().setFromObject(gs.scene), mats: [] }); }
      if (signParts.length) {
        GROUP.signSlots.forEach(function (sl, i) {
          var sp = signParts[i % signParts.length], s = sl.s, inward = new T.Vector3(sl.side * s.nx, 0, sl.side * s.ny);   // 벽 → 길 반대 방향
          var ry = Math.atan2(inward.z, -inward.x);                       // 모델의 -x(브래킷 쪽)를 벽으로
          var sc = M * 2.6, cy = -(sp.box.min.y + sp.box.max.y) / 2;
          sp.mats.push(trs(sl.x, sl.y + (sp.box.max.y - sp.box.min.y) * sc / 2 + 6, sl.z, ry, sc).multiply(new T.Matrix4().makeTranslation(0, cy, 0)));
        });
        signParts.forEach(function (sp) { sp.parts.forEach(function (p) { matte(p.mat); }); if (sp.mats.length) instanced(sp.parts, sp.mats); });
      }
      // 3) STREET FOLD — 골목 테이블 자리 (대부분 접힌 상태, 몇 개는 펼침)
      if (MD.streetfold) setupStreetFold(MD.streetfold.scene);
      // 4) FOLD MARK — 노점 상판 위
      if (MD.foldmark) setupFoldMark(MD.foldmark.scene);
      // 5) 사진 기반 사람 (뼈대를 코드로 심어 걷게 함)
      var pv = ["person_01", "person_02", "person_03", "person_04", "person_05"];
      pv.forEach(function (n, vi) {
        var hgt = 16.3 + (vi % 3) * 0.4;
        if (window.MD_RIGS && window.MD_RIGS[n]) RIGS[n] = makeRigCC(n, hgt);          // AccuRIG 뼈대 (손·주머니 정리됨)
        else if (MD[n]) RIGS[n] = makeRig(MD[n].scene, hgt, n);
      });
      Object.keys(RIGS).forEach(function (n) {
        if (WALKERS.indexOf(n) < 0) return;
        for (var c = 0; c < 5; c++) { var r = cloneRig(RIGS[n]); r.root.visible = false; scene.add(r.root); POOL.push({ rig: r, model: n, agent: -1 }); }
      });
      setupTeam();
      if (PROD.fm && PROD.sf) { buildRelay(); api.relayReady = true; }
      api.modelsReady = true;
      shadowSetup();
    } catch (e) { if (window.console) console.warn("3D 모델을 넣는 중 문제:", e); }
  }

  /* ---------- STREET FOLD / FOLD MARK ---------- */
  // 판(위·아래·옆면·앞 테두리·고리 받침)과 가방 걸이: 판 높이(0.89~1.003 m) 앞쪽에 있는 '페인트 (6)' / '페인트 (7)' 조각 전부
  function sfBox(o) { return new T.Box3().setFromObject(o); }
  var SF_PLATE = function (o) { var n = (o.material && o.material.name) || "", b = sfBox(o); return n === "페인트 (6)" && b.min.y > 0.96 && b.max.y < 1.004 && b.max.z > 0.05; };
  var SF_HOOK = function (o) { var n = (o.material && o.material.name) || "", b = sfBox(o); return n === "페인트 (7)" && b.min.y > 0.89 && b.max.y < 0.99 && b.max.z > 0.1; };
  var SF_HINGE = new T.Vector3(0, 0.977, 0.0);
  function setupStreetFold(root) {
    var body = flatten(root, function (o) { return !SF_PLATE(o) && !SF_HOOK(o); });
    var plate = flatten(root, function (o) { return SF_PLATE(o) || SF_HOOK(o); });
    var plateOnly = flatten(root, SF_PLATE);                               // 거리의 여러 대는 가방 걸이 없이 (가볍게)
    var disp = displayTex("12", false);
    body.forEach(function (p) { matte(p.mat); p.mat = p.mat.clone(); });
    // 화면 재질 (검은 판 → 안내 화면)
    root.traverse(function (o) {
      if (!o.isMesh) return; var b = new T.Box3().setFromObject(o), s = b.getSize(new T.Vector3());
      if (Math.abs(s.x - 0.28) < 0.01 && Math.abs(s.y - 0.49) < 0.01) PROD.screenMesh = o;
    });
    plate.forEach(function (p) { matte(p.mat); });
    PROD.sf = { body: body, plate: plate, disp: disp, root: root };
    var bodyM = [], plateM = [];
    MAP.tables.forEach(function (tb, i) {
      var s = nearestStreet(tb.x, tb.y), side = s.lat > 0 ? 1 : -1;
      if (s.st === ST[2] && Math.abs(s.along - 330) < 50) return;     // 01번 자리는 릴레이용 (움직이는 STREET FOLD)
      var p = MAP.pointOn(s.st, s.along, side * (s.st.w / 2 - 1.8));   // 기둥 뒤가 골목 벽에 닿도록
      var ry = Math.atan2(-side * s.st.nx, -side * s.st.ny);           // 정면이 골목 가운데를 보도록
      var base = trs(p[0], 0, p[1], ry, M);
      bodyM.push(base);
      var open = (i % 5 === 2), fold = new T.Matrix4().makeTranslation(SF_HINGE.x, SF_HINGE.y, SF_HINGE.z)
        .multiply(new T.Matrix4().makeRotationX(open ? 0 : -Math.PI / 2)).multiply(new T.Matrix4().makeTranslation(-SF_HINGE.x, -SF_HINGE.y, -SF_HINGE.z));
      plateM.push(base.clone().multiply(fold));
    });
    PROD.tablesIM = instanced(body, bodyM).concat(instanced(plateOnly, plateM));
    // 화면만 따로 (안내 지도)
    if (PROD.screenMesh) {
      var sg = new T.PlaneGeometry(0.28, 0.49); sg.translate(0, 1.655, 0.0012 + 0.0);
      var sm = new T.MeshBasicMaterial({ map: disp });
      var screenIM = new T.InstancedMesh(sg, sm, bodyM.length);
      bodyM.forEach(function (m, i) { screenIM.setMatrixAt(i, m); }); screenIM.frustumCulled = false; scene.add(screenIM); PROD.tablesIM.push(screenIM);
    }
  }
  function relayStall() { return MAP.stalls.reduce(function (b, s) { return !b || Math.abs(s.p[0] - 300) < Math.abs(b.p[0] - 300) ? s : b; }, null); }
  function setupFoldMark(root) {
    var parts = flatten(root, function (o) { var b = new T.Box3().setFromObject(o), s = b.getSize(new T.Vector3()); return !(s.x < 0.04 && s.y < 0.045 && s.z > 0.05); });  // 스티커 판 제외
    parts.forEach(function (p) { matte(p.mat); });
    PROD.fm = { parts: parts, root: root };
    var main = ST[0], mats = [];
    var rs = relayStall();
    MAP.stalls.forEach(function (st, i) {
      if (i % 9 !== 4 || st === rs) return;     // 몇 곳만 (작은 제품이라 멀리서는 안 보임)
      var p = MAP.pointOn(main, st.s + 0.78 * M, 0.08 * M);
      mats.push(trs(p[0], STALL_TOP, p[1], Math.atan2(-main.ny, main.nx), M));        // 흰 앞면(빛 선)이 사장님 쪽
    });
    instanced(parts, mats);
  }
  /* ---------- v4.5 팀원 제품: FLOWAY · STAY-GAP · NAVIAR (실제 치수, m 단위 모델 × M) ---------- */
  function teamObj(name) {
    var g = MD[name]; if (!g) return null;
    var o = g.scene.clone(true);
    o.traverse(function (m) { if (m.isMesh) { m.material = m.material.clone(); matte(m.material); if (m.material.transparent) m.material.depthWrite = false; m.castShadow = true; m.receiveShadow = true; } });
    var w = new T.Group(); w.add(o); w.scale.setScalar(M); return w;
  }
  function faceIn(st, lat) { var sd = lat < 0 ? 1 : -1; return Math.atan2(sd * st.nx, sd * st.ny); }   // 보도에서 길 가운데를 봄
  function setupTeam() {
    var main = ST[0], a1 = ST[2], sp = MAP.spots;
    PROD.team = {};
    // 01 FLOWAY — 입구 키오스크
    var fw = teamObj("floway");
    if (fw) { fw.position.set(sp[0][0], 0, sp[0][1]); fw.rotation.y = faceIn(main, -38); scene.add(fw); PROD.team.floway = fw; }
    // 02 STAY-GAP — 전봇대 (모델 1.8 m 위로 기둥을 이어 올림) + 큰길 전봇대 몇 곳 더
    var poles = [[190, -44], [520, -44], [980, 44]];
    poles.forEach(function (pp, i) {
      var g = new T.Group(), p = MAP.pointOn(main, pp[0], pp[1]);
      var states = i === 0 ? ["staygap_1", "staygap_2", "staygap_3"] : ["staygap_1"];
      states.forEach(function (n, k) { var o = teamObj(n); if (!o) return; o.visible = k === 0; o.userData.state = k; g.add(o); });
      var pole = new T.Mesh(new T.CylinderGeometry(0.13 * M, 0.14 * M, 5.4 * M, 16), new T.MeshStandardMaterial({ color: 0x3d3e39, roughness: 0.7 }));
      pole.position.y = (1.8 + 2.7) * M - 0.02 * M; pole.castShadow = true; g.add(pole);
      g.position.set(p[0], 0, p[1]); g.rotation.y = faceIn(main, pp[1]); scene.add(g);
      if (i === 0) PROD.team.staygap = g;
    });
    // 04 NAVIAR — 골목 뒤편의 환경미화원 (바이저를 머리에 씀) + 수레
    var vz = teamObj("naviar");
    if (vz) PROD.team.visor = vz;
    var R0 = RIGS.person_03 || RIGS.person_01;
    if (R0 && vz) {
      var wk = cloneRig(R0), p3 = sp[3];
      wk.root.position.set(p3[0], 0, p3[1]); wk.root.rotation.y = Math.atan2(a1.ux, a1.uy);   // 골목 아래(큰길) 쪽을 봄
      scene.add(wk.root); poseWalk(wk, 0, 0); wk.sync && wk.sync();
      scene.add(vz); PROD.team.worker = wk;
      var cart = new T.Group(), cm = new T.MeshStandardMaterial({ color: 0x5b5d55, roughness: 0.7 }), cy = new T.MeshStandardMaterial({ color: 0xF2D94B, roughness: 0.5 });
      var bx = new T.Mesh(new T.BoxGeometry(0.55 * M, 0.7 * M, 0.45 * M), cm); bx.position.y = 0.45 * M; cart.add(bx);
      var lip = new T.Mesh(new T.BoxGeometry(0.57 * M, 0.07 * M, 0.47 * M), cy); lip.position.y = 0.82 * M; cart.add(lip);
      var cp = MAP.pointOn(a1, 120, 5); cart.position.set(cp[0], 0, cp[1]); cart.rotation.y = 0.3; scene.add(cart); PROD.team.cart = cart;
      placeVisor();
    }
  }
  // 바이저를 미화원 머리 높이 · 앞쪽에 맞춤 (사람이 움직이면 매 장면 다시 부름)
  var V_TMP = new T.Vector3();
  function placeVisor() {
    var t = PROD.team, wk = t && t.worker, vz = t && t.visor; if (!wk || !vz) return;
    // 머리 가운데: 사람 키(H) 기준 비율로 (뼈 위치는 목뒤라 얼굴과 어긋남)
    var ry0 = wk.root.rotation.y, H = wk.H, hd = wk.root.position;
    vz.position.set(hd.x + Math.sin(ry0) * 0.012 * H, hd.y + 0.835 * H, hd.z + Math.cos(ry0) * 0.012 * H);
    vz.scale.setScalar(M * 1.22);
    vz.rotation.y = wk.root.rotation.y + VISOR_YAW;
  }
  var VISOR_YAW = Math.PI / 2;   // 바이저의 얼굴 가림막(모델의 -x)을 사람 앞쪽(+z)으로
  api.placeVisor = placeVisor;
  function nearestStreet(x, z) {
    var best = null;
    ST.forEach(function (s) {
      var dx = x - s.pts[0][0], dz = z - s.pts[0][1], along = dx * s.ux + dz * s.uy, lat = dx * s.nx + dz * s.ny;
      var d = Math.abs(lat) + Math.max(0, -along, along - s.len);
      if (!best || d < best.d) best = { d: d, st: s, along: along, lat: lat };
    });
    return best;
  }

  /* =========================================================
     사진 기반 사람에게 걷는 뼈대 심기 (코드로 자동)
     다리·팔·몸통 영역을 높이와 좌우로 나눠 뼈에 붙임 → 걷기 / 손 뻗기 동작
     ========================================================= */
  var ARM_FREE = { person_02: { L: 1, R: 1 }, person_04: { R: 1 }, person_05: { L: 1, R: 1 } };   // 팔이 몸에서 떨어져 있는 모델 (나머지는 손이 주머니에)
  function makeRig(root, height, name) {
    root.updateMatrixWorld(true);
    var src = null; root.traverse(function (o) { if (o.isMesh && !src) src = o; });
    var geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld);
    geo.computeBoundingBox(); var bb = geo.boundingBox, k = height / (bb.max.y - bb.min.y);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(k, k, k);
    var H = height, pos = geo.attributes.position, n = pos.count, i;
    // 생성기가 붙여 둔 발밑 바닥판(큰 평평한 삼각형) 제거 → 걸을 때 다리 사이에 막이 생기지 않게
    if (geo.index) {
      var ix = geo.index.array, keep = [];
      for (i = 0; i < ix.length; i += 3) {
        var ya = pos.getY(ix[i]), yb = pos.getY(ix[i + 1]), yc = pos.getY(ix[i + 2]);
        if (Math.max(ya, yb, yc) < 0.012 * H) {
          var ex1 = Math.hypot(pos.getX(ix[i]) - pos.getX(ix[i + 1]), pos.getZ(ix[i]) - pos.getZ(ix[i + 1])), ex2 = Math.hypot(pos.getX(ix[i]) - pos.getX(ix[i + 2]), pos.getZ(ix[i]) - pos.getZ(ix[i + 2]));
          if (Math.max(ex1, ex2) > 0.03 * H) continue;
        }
        keep.push(ix[i], ix[i + 1], ix[i + 2]);
      }
      geo.setIndex(keep);
    }
    // 팔 찾기: 손끝(가장 바깥) → 어깨를 잇는 축에서 가까운 점 = 팔. 주머니에 손을 넣은 팔은 움직이지 않음
    var CAP = 0.71, armOf = new Int8Array(n), armInfo = {}, freeSet = ARM_FREE[name] || {};
    [["L", 1], ["R", -1]].forEach(function (sd) {
      var tip = -1, best = -1;
      for (i = 0; i < n; i++) { var y = pos.getY(i) / H, x = pos.getX(i) * sd[1]; if (y > 0.4 && y < 0.56 && x > best) { best = x; tip = i; } }
      var free = !!freeSet[sd[0]] && tip >= 0, cx = 0, cn = 0;
      if (free) {
        var Tx = pos.getX(tip), Ty = pos.getY(tip), Tz = pos.getZ(tip), Sx = Tx * 0.85, Sy = 0.79 * H, Sz = Tz * 0.5;
        var k2 = (Ty - 0.42 * H) / (Sy - Ty), Bx = Tx - (Sx - Tx) * k2, By = 0.42 * H, Bz = Tz - (Sz - Tz) * k2;   // 축을 손 아래까지 연장
        var dx = Sx - Bx, dy = Sy - By, dz = Sz - Bz, dd = dx * dx + dy * dy + dz * dz;
        for (i = 0; i < n; i++) {
          var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
          if (py / H > CAP || px * sd[1] <= 0) continue;
          var t = clamp(((px - Bx) * dx + (py - By) * dy + (pz - Bz) * dz) / dd, 0, 1);
          var ex = px - (Bx + dx * t), ey = py - (By + dy * t), ez = pz - (Bz + dz * t);
          if (Math.sqrt(ex * ex + ey * ey + ez * ez) / H < 0.05) { armOf[i] = sd[1]; if (py / H > CAP - 0.05) { cx += px; cn++; } }
        }
      }
      armInfo[sd[0]] = { free: free, x: cn ? Math.abs(cx / cn) / H : 0.13 };
    });
    // 두 다리가 붙어 있는지 (붙어 있으면 보폭을 줄여 천이 늘어나 보이지 않게)
    var mid = 0, legs = 0;
    for (i = 0; i < n; i++) { var y3 = pos.getY(i) / H; if (y3 > 0.12 && y3 < 0.36) { legs++; if (Math.abs(pos.getX(i)) / H < 0.012) mid++; } }
    var legsJoined = legs ? mid / legs > 0.15 : false;
    // 뼈
    var J = { hip: [0, 0.52], spine: [0, 0.64], head: [0, 0.85], legL: [0.055, 0.5], kneeL: [0.06, 0.28], legR: [-0.055, 0.5], kneeR: [-0.06, 0.28],
              armL: [armInfo.L.x, 0.79], elbL: [armInfo.L.x + 0.01, 0.6], armR: [-armInfo.R.x, 0.79], elbR: [-armInfo.R.x - 0.01, 0.6] };
    var PARENT = { spine: "hip", head: "spine", legL: "hip", kneeL: "legL", legR: "hip", kneeR: "legR", armL: "spine", elbL: "armL", armR: "spine", elbR: "armR" };
    var ORDER = ["hip", "spine", "head", "legL", "kneeL", "legR", "kneeR", "armL", "elbL", "armR", "elbR"], IDX = {};
    ORDER.forEach(function (b, j) { IDX[b] = j; });
    var si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (i = 0; i < n; i++) {
      var x = pos.getX(i), y = pos.getY(i) / H, ax = Math.abs(x) / H, sd = x >= 0 ? "L" : "R", w = {};
      function add(b, v) { if (v > 0.001) w[b] = (w[b] || 0) + v; }
      if (y < 0.53) {                                                        // 다리
        var wl = 1 - sstep(0.44, 0.53, y);
        if (y > 0.34) wl *= sstep(0.004, 0.03, ax);                          // 가랑이 가운데는 골반
        var wk = 1 - sstep(0.25, 0.32, y);
        add("leg" + sd, wl * (1 - wk)); add("knee" + sd, wl * wk); add("hip", 1 - wl);
      } else {
        var wa = armOf[i] ? 1 - sstep(CAP - 0.06, CAP, y) : 0;
        var we = 1 - sstep(0.58, 0.63, y);
        add("arm" + sd, wa * (1 - we)); add("elb" + sd, wa * we);
        var rest = 1 - wa, ws = sstep(0.54, 0.62, y), wh = sstep(0.84, 0.88, y);
        add("hip", rest * (1 - ws)); add("spine", rest * ws * (1 - wh)); add("head", rest * ws * wh);
      }
      var list = Object.keys(w).map(function (b) { return [IDX[b], w[b]]; }).sort(function (p, q) { return q[1] - p[1]; }).slice(0, 4), sum = 0;
      list.forEach(function (l) { sum += l[1]; });
      list.forEach(function (l, c) { si[i * 4 + c] = l[0]; sw[i * 4 + c] = l[1] / sum; });
    }
    geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(si, 4));
    geo.setAttribute("skinWeight", new T.Float32BufferAttribute(sw, 4));
    var mat = MATS.person || (MATS.person = silhouetteMat("#2E302C"));   // 실제 사람 몸 → 짙은 실루엣 (제품에 시선이 가도록)
    return { geo: geo, mat: mat, J: J, PARENT: PARENT, ORDER: ORDER, H: H, armFree: { L: armInfo.L.free, R: armInfo.R.free }, stride: legsJoined ? 0.45 : 1 };
  }
  /* ---------- AccuRIG 뼈대 사람 ----------
     원본 FBX 의 뼈대(CC_Base)를 그대로 쓰고, 예전 코드가 쓰던 이름(hip · legL · armR ...)으로 움직일 수 있게 이어 줌.
     회전은 '몸 기준 축'(x: 앞뒤로 흔들기)으로 넣으면 각 뼈의 실제 축으로 바꿔서 적용 */
  var CC_MAP = { hip: "Hip", spine: "Waist", head: "Head", legL: "L_Thigh", kneeL: "L_Calf", legR: "R_Thigh", kneeR: "R_Calf",
                 armL: "L_Upperarm", elbL: "L_Forearm", armR: "R_Upperarm", elbR: "R_Forearm" };
  var CC_LIVE = [];
  function makeRigCC(name, height) {
    var D = window.MD_RIGS[name], m = D.meta;
    if (!D.geo) {
      var bin = atob(D.bin), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var o = 0, pos = new Float32Array(u.buffer, o, m.n * 3); o += m.n * 12;
      var idx = new Uint16Array(u.buffer.slice(o, o + m.ni * 2)); o += m.ni * 2;
      var si = new Uint8Array(u.buffer, o, m.n * 4); o += m.n * 4;
      var sw = new Uint8Array(u.buffer, o, m.n * 4);
      var g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
      g.setAttribute("skinIndex", new T.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4, true));
      g.computeVertexNormals(); g.computeBoundingSphere();
      D.geo = g; D.bin = null;
    }
    var mat = MATS.person || (MATS.person = silhouetteMat("#2E302C"));
    return { cc: true, name: name, geo: D.geo, mat: mat, meta: m, H: height, armFree: ARM_FREE[name] || {}, stride: 1 };
  }
  function cloneRigCC(R0) {
    var m = R0.meta, W = [], bones = m.bones.map(function (b) {
      var bone = new T.Bone(); bone.name = b.n;
      W.push(new T.Matrix4().compose(new T.Vector3().fromArray(b.t), new T.Quaternion().fromArray(b.q), new T.Vector3(1, 1, 1)));
      return bone;
    });
    var box = new T.Group(); box.scale.setScalar(R0.H);
    var BY = {}, tmpM = new T.Matrix4();
    bones.forEach(function (bone, i) {
      var p = m.bones[i].p;
      if (p < 0) { W[i].decompose(bone.position, bone.quaternion, bone.scale); box.add(bone); }
      else { tmpM.copy(W[p]).invert().multiply(W[i]); tmpM.decompose(bone.position, bone.quaternion, bone.scale); bones[p].add(bone); }
      BY[m.bones[i].n] = i;
    });
    var mesh = new T.SkinnedMesh(R0.geo, R0.mat); mesh.frustumCulled = false; box.add(mesh);
    box.updateMatrixWorld(true);
    mesh.bind(new T.Skeleton(bones), mesh.matrixWorld);
    var root = new T.Group(); root.add(box);
    var vb = {}, ctl = [];
    Object.keys(CC_MAP).forEach(function (k) {
      var i = BY[CC_MAP[k]], v = new T.Object3D(); vb[k] = v;
      if (i === undefined) return;
      var qw = new T.Quaternion().fromArray(m.bones[i].q);
      ctl.push({ v: v, bone: bones[i], q0: bones[i].quaternion.clone(), qw: qw, qwi: qw.clone().invert(), p0: bones[i].position.clone() });
    });
    var hipY = m.bones[BY.Hip] ? m.bones[BY.Hip].t[1] * R0.H : R0.H * 0.5;
    vb.hip.position.y = hipY;
    var tq = new T.Quaternion();
    var r = { root: root, mesh: mesh, b: vb, H: R0.H, hipY: hipY, armFree: R0.armFree, stride: R0.stride, cc: true,
      sync: function () {
        for (var c = 0; c < ctl.length; c++) {
          var k = ctl[c]; tq.setFromEuler(k.v.rotation);
          k.bone.quaternion.copy(k.q0).multiply(k.qwi.clone().multiply(tq).multiply(k.qw));
          if (k.v === vb.hip) k.bone.position.y = k.p0.y + (vb.hip.position.y - hipY) / R0.H;
        }
      },
      handPos: function (side, out) {
        var h = bones[BY[side + "_Hand"]], f = bones[BY[side + "_Forearm"]];
        var a = h.getWorldPosition(new T.Vector3()), b = f.getWorldPosition(new T.Vector3());
        return (out || new T.Vector3()).copy(a).addScaledVector(a.clone().sub(b).normalize(), 0.045 * R0.H);
      } };
    CC_LIVE.push(r);
    return r;
  }
  function syncRigs() { for (var i = 0; i < CC_LIVE.length; i++) { var r = CC_LIVE[i]; if (r.root.visible && r.root.parent) r.sync(); } }
  function cloneRig(R0) {
    if (R0.cc) return cloneRigCC(R0);
    var bones = {}, list = [];
    R0.ORDER.forEach(function (b) {
      var bone = new T.Bone(), j = R0.J[b], p = R0.PARENT[b], pj = p ? R0.J[p] : [0, 0];
      bone.position.set((j[0] - pj[0]) * R0.H, (j[1] - pj[1]) * R0.H, 0);
      bones[b] = bone; list.push(bone);
      if (p) bones[p].add(bone);
    });
    var mesh = new T.SkinnedMesh(R0.geo, R0.mat);
    mesh.add(bones.hip); mesh.bind(new T.Skeleton(list));
    mesh.frustumCulled = false;
    var root = new T.Group(); root.add(mesh);
    return { root: root, mesh: mesh, b: bones, H: R0.H, hipY: bones.hip.position.y, armFree: R0.armFree, stride: R0.stride, J: R0.J };
  }
  /* ---------- 릴레이용 마네킹 (팀 무드보드: 무광 플라스틱) ----------
     관절마다 따로 움직이는 인형이라 손을 뻗거나 걸어도 모양이 찌그러지지 않음 */
  var MQ_J = { hip: [0, 0.52], spine: [0, 0.6], head: [0, 0.83], legL: [0.06, 0.5], kneeL: [0.06, 0.28], legR: [-0.06, 0.5], kneeR: [-0.06, 0.28],
               armL: [0.125, 0.79], elbL: [0.13, 0.6], armR: [-0.125, 0.79], elbR: [-0.13, 0.6] };
  function makeMannequin(c) {
    var H = 16.4, J = MQ_J, PARENT = { spine: "hip", head: "spine", legL: "hip", kneeL: "legL", legR: "hip", kneeR: "legR", armL: "spine", elbL: "armL", armR: "spine", elbR: "armR" };
    function mat(col) { return new T.MeshStandardMaterial({ color: col, roughness: 0.82, metalness: 0, envMapIntensity: 0.8 }); }
    var body = mat(c.body), limb = mat(c.limb || c.body), joint = mat(c.joint || "#3B3D38"), head = mat(c.head || c.body), hand = mat(c.hand || c.limb || c.body);
    var b = {}, root = new T.Group();
    Object.keys(J).forEach(function (k) {
      var o = new T.Object3D(), p = PARENT[k], pj = p ? J[p] : [0, 0];
      o.position.set((J[k][0] - pj[0]) * H, (J[k][1] - pj[1]) * H, 0); b[k] = o;
    });
    Object.keys(PARENT).forEach(function (k) { b[PARENT[k]].add(b[k]); });
    root.add(b.hip);
    function seg(parent, y0, y1, r0, r1, m, sz) {    // 부모 뼈 기준, 아래로 뻗는 원통 (y 는 H 비율)
      var g = new T.CylinderGeometry(r0 * H, r1 * H, Math.abs(y1 - y0) * H, 18); g.translate(0, (y0 + y1) / 2 * H, 0);
      if (sz) g.scale(1, 1, sz);
      var mm = new T.Mesh(g, m); parent.add(mm); return mm;
    }
    function ball(parent, y, r, m, sy) { var g = new T.SphereGeometry(r * H, 18, 12); g.scale(1, sy || 1, 1); g.translate(0, y * H, 0); var mm = new T.Mesh(g, m); parent.add(mm); return mm; }
    // 골반 · 몸통 · 목 · 머리
    seg(b.hip, -0.06, 0.06, 0.088, 0.1, body, 0.62);
    seg(b.spine, -0.02, 0.19, 0.092, 0.118, body, 0.6);
    ball(b.spine, 0.19, 0.118, body, 0.42);
    seg(b.head, 0.0, 0.035, 0.026, 0.03, joint);
    ball(b.head, 0.085, 0.06, head, 1.18);
    // 다리
    ["L", "R"].forEach(function (sd) {
      ball(b["leg" + sd], 0, 0.04, joint);
      seg(b["leg" + sd], -0.21, -0.01, 0.031, 0.042, limb);
      ball(b["knee" + sd], 0, 0.031, joint);
      seg(b["knee" + sd], -0.25, -0.01, 0.024, 0.031, limb);
      var f = new T.BoxGeometry(0.06 * H, 0.03 * H, 0.13 * H); f.translate(0, -0.265 * H, 0.03 * H); b["knee" + sd].add(new T.Mesh(f, joint));
      ball(b["arm" + sd], 0, 0.032, joint);
      seg(b["arm" + sd], -0.18, -0.01, 0.022, 0.03, limb);
      ball(b["elb" + sd], 0, 0.023, joint);
      seg(b["elb" + sd], -0.14, -0.01, 0.018, 0.022, limb);
      ball(b["elb" + sd], -0.165, 0.028, hand, 1.25);
    });
    if (c.apron) { var ap = new T.BoxGeometry(0.17 * H, 0.3 * H, 0.012 * H); ap.translate(0, 0.02 * H, 0.068 * H); b.spine.add(new T.Mesh(ap, mat(c.apron))); }
    root.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    return { root: root, b: b, H: H, hipY: b.hip.position.y, armFree: { L: 1, R: 1 }, stride: 1, J: J };
  }

  // 걷기 자세 (ph: 걸음 위상, amt: 0 서 있음 ~ 1 걷기)
  function poseWalk(r, ph, amt) {
    var s = Math.sin(ph), b = r.b, H = r.H, st = r.stride;
    b.legL.rotation.x = -0.42 * st * s * amt; b.legR.rotation.x = 0.42 * st * s * amt;
    b.kneeL.rotation.x = 0.6 * st * Math.max(0, Math.sin(ph - 1.3)) * amt;
    b.kneeR.rotation.x = 0.6 * st * Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * amt;
    b.armL.rotation.set((r.armFree.L ? 0.3 : 0) * s * amt, 0, 0); b.armR.rotation.set(-(r.armFree.R ? 0.3 : 0) * s * amt, 0, 0);
    b.elbL.rotation.x = 0; b.elbR.rotation.x = 0;
    b.hip.position.y = r.hipY + (Math.abs(Math.cos(ph)) - 0.5) * 0.018 * H * amt;
    b.hip.rotation.set(0, 0.07 * s * amt, 0); b.spine.rotation.set(0.03 * amt, -0.1 * s * amt, 0); b.head.rotation.set(0, 0.04 * s * amt, 0);
  }
  // 손 끝 위치 (세계 좌표)
  var tmpV = new T.Vector3();
  function handPos(r, side, out) {
    if (r.handPos) { r.sync(); r.root.updateMatrixWorld(true); return r.handPos(side, out); }
    var e = r.b["elb" + side]; e.updateWorldMatrix(true, false);
    return (out || new T.Vector3()).set(0, -(r.J["elb" + side][1] - 0.44) * r.H, 0.012 * r.H).applyMatrix4(e.matrixWorld);
  }

  /* ---------- 사람 움직이기 ---------- */
  var WALKERS = ["person_01", "person_02", "person_03", "person_05"];   // 짝다리 자세(person_04)는 걷는 사람으로 쓰지 않음 (서 있는 역할만)
  var hideAround = [], relayMode = false;   // 릴레이 장면에서 사람을 비워 둘 곳 [x, z, r]
  function updatePeople(t) {
    var n = peopleAgents.length, cam = camera.position, near = [], i;
    var usePool = POOL.length && cam.y < 420;
    for (i = 0; i < n; i++) {
      var a = peopleAgents[i], p = MAP.agentAt(a, t, false), q = MAP.agentAt(a, t + 2, false);
      var dx = q[0] - p[0], dz = q[1] - p[1], moving = Math.abs(dx) + Math.abs(dz) > 0.01;
      a._x = p[0]; a._z = p[1]; a._ry = moving ? Math.atan2(dx, dz) : (a._ry || 0); a._mv = moving;
      var cx = p[0] - cam.x, cz = p[1] - cam.z, d2 = cx * cx + cz * cz, hide = false;
      for (var h = 0; h < hideAround.length; h++) { var o = hideAround[h], ex = p[0] - o[0], ez = p[1] - o[1]; if (ex * ex + ez * ez < o[2] * o[2]) { hide = true; break; } }
      if (cam.y < 80 && d2 < 60 * 60) hide = true;                         // 카메라 바로 앞 (화면 가림 방지)
      a._hide = hide; a._d2 = d2;
      if (usePool && !hide && d2 < 520 * 520) near.push(i);
    }
    // 가까운 사람 → 사진 기반 3D 사람
    near.sort(function (x, y) { return peopleAgents[x]._d2 - peopleAgents[y]._d2; });
    var used = {}, taken = {};
    POOL.forEach(function (pp) { pp.next = -1; });
    near.forEach(function (ai) {
      var want = WALKERS[ai % WALKERS.length];
      for (var k = 0; k < POOL.length; k++) { var pp = POOL[k]; if (pp.next < 0 && pp.model === want && !pp.busy) { pp.next = ai; taken[ai] = true; break; } }
    });
    POOL.forEach(function (pp) {
      if (pp.busy) return;
      if (pp.next < 0) { pp.rig.root.visible = false; return; }
      var a = peopleAgents[pp.next], r = pp.rig;
      r.root.visible = true; r.root.position.set(a._x, 0, a._z); r.root.rotation.y = a._ry;
      var dist = a.v * t * 0.62 + a.ph * 3;
      poseWalk(r, dist * 0.55, a._mv ? 1 : 0);
    });
    for (i = 0; i < n; i++) {
      var a2 = peopleAgents[i], sc = 0.92 + (i % 7) * 0.025;
      if (a2._hide || taken[i]) sc = 0;
      dummy.position.set(a2._x, a2._mv ? Math.abs(Math.sin(t * 0.35 + i)) * 0.6 : 0, a2._z);
      dummy.rotation.set(0, a2._ry, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix(); (i & 1 ? people2 : people).setMatrixAt(i >> 1, dummy.matrix);
    }
    people.instanceMatrix.needsUpdate = true; people2.instanceMatrix.needsUpdate = true;
  }

  /* =========================================================
     초점 흐림 (릴레이 장면: 사람 → 제품으로 초점이 옮겨감)
     ========================================================= */
  var post = null;
  function makePost() {
    var rt = new T.WebGLRenderTarget(4, 4, { samples: 4, type: T.HalfFloatType });
    rt.depthTexture = new T.DepthTexture(4, 4); rt.depthTexture.type = T.UnsignedIntType;
    var mat = new T.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, res: { value: new T.Vector2(1, 1) },
                  focus: { value: 50 }, range: { value: 30 }, maxB: { value: 10 }, near: { value: 0.5 }, far: { value: 6000 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: [
        "#include <common>",
        "varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float focus, range, maxB, near, far;",
        "float vz(vec2 uv){ float d = texture2D(tDepth, uv).x; return (near * far) / ((far - near) * d - far); }",
        "float coc(vec2 uv){ return clamp(abs(-vz(uv) - focus) / range, 0.0, 1.0); }",
        "void main(){",
        "  float c0 = coc(vUv); float rad = c0 * maxB; vec4 acc = texture2D(tColor, vUv); float wsum = 1.0;",
        "  if (rad > 0.5) {",
        "    for (int i = 1; i < 28; i++) { float fi = float(i); float r = sqrt(fi / 28.0) * rad; float a = fi * 2.39996;",
        "      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res; float cs = coc(uv); float w = mix(0.25, 1.0, cs);",
        "      acc += texture2D(tColor, uv) * w; wsum += w; }",
        "  }",
        "  gl_FragColor = acc / wsum;",
        "  #include <tonemapping_fragment>",
        "  #include <colorspace_fragment>",
        "}"].join("\n"),
      depthTest: false, depthWrite: false
    });
    var quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat), sc = new T.Scene(); sc.add(quad);
    var oc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    post = { rt: rt, mat: mat, scene: sc, cam: oc };
  }
  function renderDOF(focus, range, maxB) {
    if (!post) makePost();
    syncRigs();
    var sz = renderer.getDrawingBufferSize(new T.Vector2());
    if (post.rt.width !== sz.x || post.rt.height !== sz.y) { post.rt.setSize(sz.x, sz.y); }
    var u = post.mat.uniforms; u.res.value.copy(sz); u.focus.value = focus; u.range.value = range; u.maxB.value = maxB * (sz.y / 900);
    u.near.value = camera.near; u.far.value = camera.far;
    renderer.setRenderTarget(post.rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(post.scene, post.cam);
  }

  /* =========================================================
     릴레이 01 — 노점(FOLD MARK) → 커플 → 골목(STREET FOLD)
     ========================================================= */
  var RL = null;
  function buildRelay() {
    var main = ST[0], a1 = ST[2];
    // 골목 a1 입구에 가장 가까운 노점
    var st = relayStall();
    var P = function (ds, lat, y) { var p = MAP.pointOn(main, st.s + ds, lat); return new T.Vector3(p[0], y || 0, p[1]); };
    var A = function (s, lat, y) { var p = MAP.pointOn(a1, s, lat); return new T.Vector3(p[0], y || 0, p[1]); };
    var faceN = Math.atan2(-main.nx, -main.ny), faceS = Math.atan2(main.nx, main.ny);   // 북쪽(골목 쪽)을 봄 / 남쪽을 봄
    RL = { st: st, P: P, A: A, faceN: faceN, faceS: faceS };

    // 사람: 사장님(회색 맨투맨, 두 팔이 자유로움) · 커플(흰 상의 + 검정 터틀넥)
    // 실제 사람 몸(사진 기반 3D)을 짙은 실루엣으로 — 사람은 형태만, 시선은 제품으로
    function mq(c, model) { var r = RIGS[model] ? cloneRig(RIGS[model]) : makeMannequin(c); scene.add(r.root); return r; }
    RL.boss = mq({ body: "#4A4C47", limb: "#5A5C56", head: "#E9E2CC", hand: "#2A2B28", apron: "#F2D94B" }, "person_02");   // 사장님
    RL.boss.root.position.copy(P(7.6, 6.0));        // 수레 뒤 15cm — 팔꿈치를 굽혀 FOLD MARK 에 닿는 거리
    var toFM = P(7.4, 0.0).sub(RL.boss.root.position); RL.bossRy = Math.atan2(toFM.x, toFM.z);   // 수레 · FOLD MARK 쪽을 봄
    RL.boss.root.rotation.y = RL.bossRy; poseWalk(RL.boss, 0, 0);
    RL.her = mq({ body: "#F1ECDD", limb: "#E6DFCB", head: "#F7F3E6", joint: "#C9C1AA" }, "person_05");            // 커플 (걷는 모습이 자연스러운 사람)
    if (RIGS.person_04) { RL.wait = cloneRig(RIGS.person_04); scene.add(RL.wait.root); RL.wait.root.position.copy(P(-16, -9)); RL.wait.root.rotation.y = faceS + Math.PI + 0.5; poseWalk(RL.wait, 0, 0); }   // 짝다리 손님: 서 있기만
    RL.him = mq({ body: "#B9B39F", limb: "#A9A38F", head: "#EFE9D6", joint: "#646661" }, "person_01");   // 검정 터틀넥
    RL.her.root.visible = RL.him.root.visible = false;

    // FOLD MARK (움직이는 한 대)
    var fmRoot = new T.Group(), fmParts = PROD.fm ? PROD.fm.parts : [];
    fmParts.forEach(function (p) { fmRoot.add(new T.Mesh(p.geo, p.mat)); });
    fmRoot.scale.setScalar(M); fmRoot.position.copy(P(0.78 * M, 3.4, STALL_TOP));   // 상판 오른쪽 끝 (양념 병과 진열 쟁반 사이 빈 자리)
    fmRoot.rotation.y = Math.atan2(-main.ny, main.nx);   // 흰 앞면(+x, 빛 선)이 사장님 쪽 — 주먹으로 치고 스티커를 뽑는 쪽
    // FOLD MARK 앞쪽 빛 선을 따로 밝히기
    fmRoot.traverse(function (o) { if (o.isMesh && o.material.emissive && o.material.emissive.r > 0.5) { o.material = o.material.clone(); RL.fmLight = o.material; } });
    scene.add(fmRoot); RL.fm = fmRoot;
    // 스티커 (트레이 옆면 띠 20 x 4 cm) — FOLD MARK 윗면 틈에서 위로 나옴
    var stickerImg = window.MD_MODELS && window.MD_MODELS.sticker;
    var stex = null;
    if (stickerImg) { var im = new Image(); stex = new T.Texture(im); stex.colorSpace = T.SRGBColorSpace; im.onload = function () { stex.needsUpdate = true; }; im.src = stickerImg; }
    var sMat = new T.MeshLambertMaterial({ map: stex, color: 0xffffff, side: T.DoubleSide });
    var sg = new T.PlaneGeometry(0.2, 0.04); sg.translate(0.1, 0, 0);                       // 한쪽 끝이 기준
    RL.sticker = new T.Mesh(sg, sMat); RL.sticker.scale.setScalar(M); scene.add(RL.sticker);
    RL.slot = new T.Vector3(0.082, 0.072, 0).applyMatrix4(new T.Matrix4().compose(fmRoot.position, fmRoot.quaternion, fmRoot.scale)); // 윗면 틈

    // 종이 트레이 (20 x 6 x 4 cm, 위가 넓은 사다리꼴)
    RL.tray = makeTray(sMat); RL.tray.scale.setScalar(M); scene.add(RL.tray);
    // 꼬치
    var skew = new T.Group(), meat = new T.MeshLambertMaterial({ color: 0xA9692F }), stick = new T.MeshLambertMaterial({ color: 0xD9B77E });
    for (var q = 0; q < 2; q++) {
      var s1 = new T.Mesh(new T.CylinderGeometry(0.002, 0.002, 0.26, 5), stick); s1.rotation.z = Math.PI / 2; s1.position.set(0.02, 0.028, -0.012 + q * 0.024); skew.add(s1);
      for (var c = 0; c < 5; c++) { var mm = new T.Mesh(new T.BoxGeometry(0.026, 0.02, 0.02), meat); mm.position.set(-0.05 + c * 0.028, 0.028, -0.012 + q * 0.024); mm.rotation.x = c * 0.7; skew.add(mm); }
    }
    RL.tray.add(skew);

    // STREET FOLD (움직이는 한 대) — 골목 a1, 01번 자리 서쪽 벽
    var sfRoot = new T.Group(), plateG = new T.Group();
    if (PROD.sf) {
      PROD.sf.body.forEach(function (p) { sfRoot.add(new T.Mesh(p.geo, p.mat)); });
      plateG.position.copy(SF_HINGE);
      // 가방 걸이는 판 안의 따로 된 축에 달아, 판이 돌아도 무게로 늘 아래를 향하게 (판을 올리면 걸이 홈 안으로)
      var hookG = new T.Group(); hookG.position.set(0, 0.977 - SF_HINGE.y, 0.17 - SF_HINGE.z); plateG.add(hookG); RL.hook = hookG;
      PROD.sf.plate.forEach(function (p) {
        var m = new T.Mesh(p.geo, p.mat);
        if (p.mat && p.mat.name === "페인트 (7)") { m.position.set(0, -0.977, -0.17); hookG.add(m); }
        else { m.position.copy(SF_HINGE).negate(); plateG.add(m); }
      });
      sfRoot.add(plateG);
      var scr = new T.Mesh(new T.PlaneGeometry(0.28, 0.49), new T.MeshBasicMaterial({ map: displayTex("12", true) })); scr.position.set(0, 1.655, 0.0012); sfRoot.add(scr);
      // 홈 안 흰 조명 + 호박색 캡 빛
      RL.led = new T.Mesh(new T.BoxGeometry(0.3, 0.008, 0.01), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true }));
      RL.led.position.set(0, 1.19, 0.02); sfRoot.add(RL.led);
      var glowM = new T.SpriteMaterial({ map: GROUP.glowTex, color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
      RL.ledGlow = new T.Sprite(glowM); RL.ledGlow.scale.set(0.9, 0.5, 1); RL.ledGlow.position.set(0, 1.05, 0.18); sfRoot.add(RL.ledGlow);
      RL.capGlow = new T.Sprite(new T.SpriteMaterial({ map: GROUP.glowTex, color: 0xFFC94A, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      RL.capGlow.scale.set(1.2, 0.8, 1); RL.capGlow.position.set(0, 2.02, 0.12); sfRoot.add(RL.capGlow);
    }
    var side = 1, sp = A(330, side * (a1.w / 2 - 1.8));
    sfRoot.position.copy(sp); sfRoot.rotation.y = Math.atan2(-side * a1.nx, -side * a1.ny); sfRoot.scale.setScalar(M);
    scene.add(sfRoot); RL.sf = sfRoot; RL.plate = plateG;
    // 같은 자리에 겹쳐 놓인 '거리용' STREET FOLD(판이 펼쳐진 것)는 숨김 — 릴레이 한 대만 보이고, 판은 접힌 채 시작
    (PROD.tablesIM || []).forEach(function (im) {
      if (!im || !im.isInstancedMesh) return; var mt = new T.Matrix4(), v = new T.Vector3(), hid = false;
      for (var i = 0; i < im.count; i++) { im.getMatrixAt(i, mt); v.setFromMatrixPosition(mt); if (Math.hypot(v.x - sp.x, v.z - sp.z) < 25) { mt.makeScale(0, 0, 0); im.setMatrixAt(i, mt); hid = true; } }
      if (hid) im.instanceMatrix.needsUpdate = true;
    });
    RL.sfFront = A(324, side * (a1.w / 2 - 1.8) - side * 6.5);          // 테이블 옆 앞 (손님이 서는 곳, 카메라에서 테이블이 가리지 않게)
    RL.plateTop = A(330, side * (a1.w / 2 - 1.8) - side * 1.6, 1.001 * M + 0.02);
    RL.capPos = A(330, side * (a1.w / 2 - 1.8), 2.05 * M);
    setRelayIdle();
  }
  function makeTray(sideMat) {
    var g = new T.Group(), paper = new T.MeshLambertMaterial({ color: 0xF4F1E8, side: T.DoubleSide }), blank = paper.clone();
    var L0 = 0.17, L1 = 0.2, W0 = 0.045, W1 = 0.06, Hh = 0.04;
    function quad(a, b, c, d, mat, uv) {
      var geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute([].concat(a, b, c, a, c, d), 3));
      geo.setAttribute("uv", new T.Float32BufferAttribute(uv ? [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 2));
      geo.computeVertexNormals(); g.add(new T.Mesh(geo, mat));
    }
    quad([-L0 / 2, 0, -W0 / 2], [L0 / 2, 0, -W0 / 2], [L0 / 2, 0, W0 / 2], [-L0 / 2, 0, W0 / 2], paper);
    quad([-L0 / 2, 0, W0 / 2], [L0 / 2, 0, W0 / 2], [L1 / 2, Hh, W1 / 2], [-L1 / 2, Hh, W1 / 2], blank, true);      // 스티커가 붙는 옆면 (+z)
    quad([L0 / 2, 0, -W0 / 2], [-L0 / 2, 0, -W0 / 2], [-L1 / 2, Hh, -W1 / 2], [L1 / 2, Hh, -W1 / 2], paper);
    quad([L0 / 2, 0, W0 / 2], [L0 / 2, 0, -W0 / 2], [L1 / 2, Hh, -W1 / 2], [L1 / 2, Hh, W1 / 2], paper);
    quad([-L0 / 2, 0, -W0 / 2], [-L0 / 2, 0, W0 / 2], [-L1 / 2, Hh, W1 / 2], [-L1 / 2, Hh, -W1 / 2], paper);
    g.userData.side = g.children[1]; g.userData.blank = blank; g.userData.stuck = sideMat;
    return g;
  }
  function setRelayIdle() {
    if (!RL) return;
    RL.her.root.visible = RL.him.root.visible = false; RL.tray.visible = false; RL.sticker.visible = false;
    RL.plate.rotation.x = -Math.PI / 2; if (RL.hook) RL.hook.rotation.x = Math.PI / 2; if (RL.led) { RL.led.material.opacity = 0; RL.ledGlow.material.opacity = 0; RL.capGlow.material.opacity = 0.5; }
    poseWalk(RL.boss, 0, 0);
  }

  // 길을 따라 걷는 위치 (점들 사이를 거리 비율로)
  function along(pts, f) {
    var L = [0], i; for (i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
    var d = clamp(f, 0, 1) * L[L.length - 1];
    for (i = 1; i < pts.length; i++) if (d <= L[i] || i === pts.length - 1) {
      var k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), p = pts[i - 1].clone().lerp(pts[i], clamp(k, 0, 1));
      var dir = pts[i].clone().sub(pts[i - 1]); return { p: p, ry: Math.atan2(dir.x, dir.z), d: d };
    }
  }
  function kfv(list, u) {          // [[u, 값(숫자 또는 Vector3)], ...] 부드럽게
    if (u <= list[0][0]) return list[0][1];
    for (var i = 1; i < list.length; i++) if (u <= list[i][0]) {
      var f = sstep(list[i - 1][0], list[i][0], u), a = list[i - 1][1], b = list[i][1];
      return a.isVector3 ? a.clone().lerp(b, f) : lerp(a, b, f);
    }
    return list[list.length - 1][1];
  }

  // 카메라용: 키 사이를 멈춤 없이 이어 주는 곡선 (Catmull-Rom) — 구간마다 멈췄다 가는 딱딱한 느낌을 없앰
  function kcr(list, u) {
    var n = list.length;
    if (u <= list[0][0]) return list[0][1].isVector3 ? list[0][1].clone() : list[0][1];
    if (u >= list[n - 1][0]) return list[n - 1][1].isVector3 ? list[n - 1][1].clone() : list[n - 1][1];
    var i = 1; while (i < n - 1 && u > list[i][0]) i++;
    var f = (u - list[i - 1][0]) / (list[i][0] - list[i - 1][0]);
    var p0 = list[Math.max(0, i - 2)][1], p1 = list[i - 1][1], p2 = list[i][1], p3 = list[Math.min(n - 1, i + 1)][1];
    function cr(a, b, c, d) { var f2 = f * f, f3 = f2 * f; return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3); }
    if (!p1.isVector3) return cr(p0, p1, p2, p3);
    return new T.Vector3(cr(p0.x, p1.x, p2.x, p3.x), cr(p0.y, p1.y, p2.y, p3.y), cr(p0.z, p1.z, p2.z, p3.z));
  }
  // u: 0 ~ 1 (릴레이 01 구간)
  api.relay = function (u, t) {
    if (!api.ok || !RL || !api.relayReady) return false;
    api.resize();
    var P = RL.P, A = RL.A, st = RL.st;
    teamHide();
    RL.her.root.visible = RL.him.root.visible = true; RL.tray.visible = true;

    /* --- 사람 --- */
    // 커플: 큰길을 따라 노점으로 → 주문 · 받기 → 골목 a1 로 → STREET FOLD 앞
    var herPath = [P(-150, -24), P(-28, -12), P(6, -9.4)], herPath2 = [P(6, -9.4), P(16, -22), A(486, 2), A(380, 6), RL.sfFront];
    var himPath = [P(-158, -30), P(-36, -17), P(-1, -11)], himPath2 = [P(-1, -11), P(10, -26), A(492, -4), A(386, 0), A(317, 5)];
    var w1 = seg(u, 0.0, 0.2), w2 = seg(u, 0.4, 0.62);
    function walk(r, p1, p2, ryStop, ryEnd) {
      var a = w2 > 0 ? along(p2, w2) : along(p1, w1), mv = (w1 > 0 && w1 < 1) || (w2 > 0 && w2 < 1);
      r.root.position.copy(a.p);
      var ry = a.ry; if (w1 >= 1 && w2 <= 0) ry = ryStop; if (w2 >= 1) ry = ryEnd;
      r.root.rotation.y = ry;
      poseWalk(r, (w2 > 0 ? 300 + a.d : a.d) * 0.55, mv ? 1 : 0);
    }
    walk(RL.her, herPath, herPath2, RL.faceS, RL.sf.rotation.y + Math.PI);
    walk(RL.him, himPath, himPath2, RL.faceS + 0.3, RL.sf.rotation.y + Math.PI + 0.4);

    // 사장님: 트레이를 놓고 → FOLD MARK 를 주먹으로 누름 → 스티커를 뽑아 트레이 옆면에 붙임 → 건넴
    var B = RL.boss.b; poseWalk(RL.boss, 0, 0);
    var press = sstep(0.08, 0.12, u) * (1 - sstep(0.14, 0.17, u)), pull = sstep(0.19, 0.22, u) * (1 - sstep(0.27, 0.3, u)), give = sstep(0.3, 0.34, u) * (1 - sstep(0.38, 0.42, u));
    var reach = Math.max(press, pull, give);
    // 어깨보다 팔꿈치를 굽혀 뻗음 (사진 기반 몸이라 팔을 크게 들면 옷이 늘어남)
    B.armR.rotation.x = -0.42 * reach; B.elbR.rotation.x = -1.25 * reach + 0.3 * press;
    B.armR.rotation.z = 0.08 * reach; B.spine.rotation.x = 0.2 * reach;

    // 주문하는 손 (그녀가 노점 쪽으로 손을 뻗음)
    var order = sstep(0.2, 0.24, u) * (1 - sstep(0.26, 0.3, u)), take = sstep(0.33, 0.37, u);
    var hold = take * (1 - sstep(0.66, 0.7, u)), qr = sstep(0.64, 0.68, u) * (1 - sstep(0.72, 0.76, u));
    var Hb = RL.her.b; Hb.armR.rotation.x += -0.3 * Math.max(order, hold * 0.75, qr); Hb.elbR.rotation.x = -0.95 * Math.max(order, hold, qr * 0.8);

    /* --- FOLD MARK: 빛 선 깜빡 → 스티커가 위로 나옴 --- */
    var out = sstep(0.12, 0.19, u);
    if (RL.fmLight) RL.fmLight.emissiveIntensity = 0.6 + 1.6 * press + 0.8 * Math.abs(Math.sin(u * 220)) * seg(u, 0.11, 0.12) * (1 - seg(u, 0.18, 0.19));
    // 트레이 위치: 계산대 → 그녀의 손 → 테이블 위
    var trayCounter = P(6.4, -2.6, STALL_TOP + 0.05), handH = handPos(RL.her, "R"), trayHand = handH.clone().add(new T.Vector3(0, 0.15, 0));
    var tf = sstep(0.34, 0.38, u), tp = trayCounter.clone().lerp(trayHand, tf);
    tp.y = Math.max(tp.y, STALL_TOP + 0.05) + Math.sin(Math.PI * tf) * 2.2;          // 상판 가장자리 위로 들어서 건넴
    var putT = sstep(0.72, 0.78, u); tp.lerp(RL.plateTop, putT);
    RL.tray.position.copy(tp);
    RL.tray.rotation.y = lerp(RL.faceS - Math.PI / 2 + Math.PI, RL.her.root.rotation.y + Math.PI / 2, sstep(0.36, 0.42, u));
    if (putT > 0) RL.tray.rotation.y = lerp(RL.tray.rotation.y, RL.sf.rotation.y + Math.PI / 2, putT);
    RL.tray.rotation.x = -0.35 * qr;
    // 스티커: 틈에서 위로 → 사장님 손 → 트레이 옆면
    var stuck = sstep(0.25, 0.29, u);
    RL.sticker.visible = out > 0.01 && stuck < 1;
    RL.tray.userData.side.material = stuck >= 1 ? RL.tray.userData.stuck : RL.tray.userData.blank;
    RL.tray.updateMatrixWorld(true);
    if (RL.sticker.visible) {
      var slot = RL.slot.clone(), bh = handPos(RL.boss, "R");
      var sideP = new T.Vector3(-0.1, 0.02, 0.031).applyMatrix4(RL.tray.matrixWorld);
      RL.sticker.scale.set(M * Math.max(0.02, out), M, M);
      RL.sticker.position.copy(slot);
      RL.sticker.rotation.set(0, RL.fm.rotation.y, Math.PI / 2 - 0.25);
      var toHand = sstep(0.2, 0.23, u), toTray = sstep(0.23, 0.27, u);
      if (toHand > 0) { RL.sticker.position.lerp(bh, toHand); RL.sticker.rotation.z = lerp(RL.sticker.rotation.z, 0.2, toHand); }
      if (toTray > 0) { RL.sticker.position.lerp(sideP, toTray); RL.sticker.rotation.set(0, RL.tray.rotation.y, lerp(0.2, 0, toTray)); }
      // 노점 안으로 파고들지 않게: 상판 위로 띄우고, 건네는 동안은 둥글게 넘어감
      var arc = Math.sin(Math.PI * toTray) * 3.2 + Math.sin(Math.PI * toHand) * 1.2;
      RL.sticker.position.y = Math.max(RL.sticker.position.y, STALL_TOP + 0.9) + arc;
    }

    /* --- STREET FOLD: 호박색 캡이 위치를 알림 → QR → 판이 내려오고 흰 조명 --- */
    var near2 = sstep(0.46, 0.6, u);
    RL.capGlow.material.opacity = 0.35 + 0.65 * near2 * (0.6 + 0.4 * Math.abs(Math.sin(u * 60)));
    var drop = sstep(0.68, 0.74, u);
    RL.plate.rotation.x = -Math.PI / 2 * (1 - drop);
    if (RL.hook) RL.hook.rotation.x = -RL.plate.rotation.x;
    RL.led.material.opacity = sstep(0.72, 0.76, u); RL.ledGlow.material.opacity = 0.75 * sstep(0.72, 0.76, u);
    // 먹는 동안 손이 오감 (빠르게)
    var eat = sstep(0.78, 0.8, u);
    if (eat > 0) { RL.her.b.elbR.rotation.x = -1.3 * eat * (0.7 + 0.3 * Math.sin(u * 140)); RL.her.b.armR.rotation.x = -0.25 * eat; }

    /* --- 카메라 (옆에서 보는 시점이 바뀌어 감) + 초점 --- */
    var fmP = RL.fm.position.clone().add(new T.Vector3(0, 0.5, 0));
    var herP = RL.her.root.position.clone().add(new T.Vector3(0, 12, 0));
    var sfP = RL.sf.position.clone().add(new T.Vector3(0, 11, 0));
    var cams = [
      // u, 카메라 위치, 바라보는 곳, 화각
      [0.00, P(62, -10, 16.5), P(6, 1, 12), 34],        // 노점 전체 + 사장님
      [0.08, P(20, -7, 14.5), P(9, 1.8, STALL_TOP + 0.5), 30],   // FOLD MARK 가까이 (누르기 · 스티커)
      [0.2, P(19, -7.5, 14.6), P(8.6, 1.2, STALL_TOP + 0.7), 32],
      [0.3, P(36, -15, 15), P(5, -4, 12), 34],          // 커플이 받음
      [0.4, P(52, -30, 16), P(4, -14, 11), 36],
      [0.5, A(486, -14, 17), A(410, 4, 11), 38],
      [0.6, A(382, 4, 15), A(330, 15, 11), 34],
      [0.68, A(352, -12, 14), A(327, 12, 11), 36],       // STREET FOLD 가까이 (커플은 테이블 너머)
      [0.86, A(348, -11, 13.5), A(327, 12, 10.5), 34]
    ];
    var cpos = kcr(cams.map(function (c) { return [c[0], c[1]]; }), u), clook = kcr(cams.map(function (c) { return [c[0], c[2]]; }), u), fov = kcr(cams.map(function (c) { return [c[0], c[3]]; }), u);
    // 골목으로 들어가는 동안은 커플을 비스듬히 뒤따름
    var fw = sstep(0.4, 0.46, u) * (1 - sstep(0.58, 0.66, u));
    if (fw > 0) {
      var hp = RL.her.root.position, ry = RL.her.root.rotation.y, fwd = new T.Vector3(Math.sin(ry), 0, Math.cos(ry)), sideV = new T.Vector3(fwd.z, 0, -fwd.x);
      var fpos = hp.clone().addScaledVector(fwd, -46).addScaledVector(sideV, -14); fpos.y = 19;
      var flook = hp.clone().addScaledVector(fwd, 28); flook.y = 9;
      cpos.lerp(fpos, fw); clook.lerp(flook, fw); fov = lerp(fov, 36, fw);
    }
    camera.position.copy(cpos); camera.up.set(0, 1, 0); camera.lookAt(clook);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // 초점: 사장님/FOLD MARK → 커플 → STREET FOLD
    var fTarget = kfv([[0, fmP], [0.26, fmP], [0.32, herP], [0.48, herP], [0.58, sfP]], u);
    var focus = camera.position.distanceTo(fTarget);
    var hc = P(0, -1), hk = P(2, -11), hb = P(7.6, 6);
    hideAround = [[hc.x, hc.z, 13], [hk.x, hk.z, 10], [hb.x, hb.z, 6], [RL.sf.position.x, RL.sf.position.z, 30]];   // 사장님 뒤로는 사람들이 지나감
    scene.fog.near = 520; scene.fog.far = 2600;
    relayMode = true; updatePeople(t); relayMode = false;
    hideAround = [];
    setLook({ dark: 0, floor: 1, tables: 1 });
    renderDOF(focus, Math.max(8, focus * 0.6), 4.5);       // 초점 흐림은 가볍게
    return true;
  };
  api.relayIdle = function () { setRelayIdle(); teamHide(); };

  /* =========================================================
     v4.5 릴레이 01 · 02 · 04 (3D) — 팀원 제품 장면
     01 FLOWAY: 관광객이 언어 → 경로 → QR    02 STAY-GAP: 빨강에 기대기 → 초록 → 앉기    04 NAVIAR: 환경미화원이 경로를 따라 옴 → '작업 중'
     ========================================================= */
  var TM = null;
  function uiCanvas() { var c = document.createElement("canvas"); c.width = 512; c.height = 620; return c; }
  function drawKiosk(c, st, k) {
    var g = c.getContext("2d"), W = c.width, H = c.height, F = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    g.fillStyle = "#F4F1E6"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#2F312B"; g.font = "700 30px " + F; g.fillText("FLOWAY", 34, 62);
    if (st === 0) {
      g.font = "600 26px " + F; g.fillStyle = "#61645D"; g.fillText("언어를 고르세요 · Language", 34, 120);
      ["English", "日本語", "中文", "한국어"].forEach(function (t, i) {
        var y = 160 + i * 100, on = k > 0.5 && i === 0; g.fillStyle = on ? "#2F312B" : "#FFFFFF"; g.beginPath(); g.roundRect ? g.roundRect(60, y, 392, 72, 36) : g.rect(60, y, 392, 72); g.fill();
        g.fillStyle = on ? "#F2D94B" : "#2F312B"; g.font = "700 32px " + F; g.textAlign = "center"; g.fillText(t, 256, y + 47); g.textAlign = "left";
      });
    } else if (st === 1) {
      g.strokeStyle = "#DDD6C2"; g.lineWidth = 26; [[40, 200, 470, 200], [40, 400, 470, 400], [170, 100, 170, 580], [350, 100, 350, 580]].forEach(function (l) { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
      g.fillStyle = "rgba(229,87,79,.3)"; g.beginPath(); g.arc(350, 200, 54, 0, 6.3); g.fill(); g.fillStyle = "#E5574F"; g.beginPath(); g.arc(350, 200, 16, 0, 6.3); g.fill();
      g.strokeStyle = "#E2B23A"; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
      var pts = [[70, 540], [170, 540], [170, 400], [450, 400], [450, 120]], L = 0, seg = [];
      for (var i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
      var left = L * k; g.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < pts.length && left > 0; i++) { var f = Math.min(1, left / seg[i - 1]); g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); left -= seg[i - 1]; }
      g.stroke(); g.fillStyle = "#2F312B"; g.font = "700 26px " + F; g.fillText("붐비는 곳을 피한 길", 34, 104);
    } else {
      g.fillStyle = "#FFFFFF"; g.fillRect(146, 130, 220, 220); var r = 7;
      for (var a = 0; a < 11; a++) for (var b = 0; b < 11; b++) { r = (r * 16807) % 2147483647; if ((a < 3 && b < 3) || (a > 7 && b < 3) || (a < 3 && b > 7) || r % 100 > 52) { g.fillStyle = "#2F312B"; g.fillRect(156 + a * 18, 140 + b * 18, 18, 18); } }
      g.fillStyle = "#2F312B"; g.font = "700 30px " + F; g.textAlign = "center"; g.fillText("휴대폰으로 보냈어요", 256, 420); g.textAlign = "left";
      g.fillStyle = "#7CCB62"; g.beginPath(); g.arc(256, 480, 22, 0, 6.3); g.fill();
    }
  }
  function hudCanvas() { var c = document.createElement("canvas"); c.width = 512; c.height = 200; return c; }
  function drawHud(c, st) {
    var g = c.getContext("2d"), F = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"; g.clearRect(0, 0, 512, 200);
    g.fillStyle = "rgba(47,49,43,.92)"; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 496, 184, 40) : g.rect(8, 8, 496, 184); g.fill();
    g.fillStyle = st ? "#F2D94B" : "#FFB547"; g.beginPath(); g.arc(78, 100, 26, 0, 6.3); g.fill();
    g.fillStyle = "#FFFDF4"; g.font = "700 48px " + F; g.fillText(st ? "작업 중" : "경로 재탐색 중", 128, 118);
  }
  function teamInit() {
    if (TM || !PROD.team) return TM;
    var t = PROD.team; TM = { ok: !!(t.floway || t.staygap || t.worker) };
    if (RIGS.person_02) { TM.tour = cloneRig(RIGS.person_02); TM.tour.root.visible = false; scene.add(TM.tour.root); }
    if (RIGS.person_05) { TM.elder = cloneRig(RIGS.person_05); TM.elder.root.visible = false; TM.elder.root.rotation.order = "YXZ"; scene.add(TM.elder.root); }
    if (t.floway) {
      TM.kc = uiCanvas(); TM.kt = new T.CanvasTexture(TM.kc); TM.kt.colorSpace = T.SRGBColorSpace; TM.kst = -1;
      var scr = new T.Mesh(new T.PlaneGeometry(0.42, 0.5), new T.MeshBasicMaterial({ map: TM.kt, toneMapped: false }));
      scr.position.set(0, 1.36, 0.262); scr.rotation.x = -0.12; t.floway.children[0].add(scr); TM.kscr = scr;
    }
    if (t.worker) {
      TM.hc = hudCanvas(); TM.ht = new T.CanvasTexture(TM.hc); TM.ht.colorSpace = T.SRGBColorSpace; TM.hst = -1;
      TM.hud = new T.Sprite(new T.SpriteMaterial({ map: TM.ht, transparent: true, depthWrite: false, toneMapped: false })); TM.hud.scale.set(0.9 * M, 0.35 * M, 1); TM.hud.visible = false; scene.add(TM.hud);
      if (t.visor) t.visor.traverse(function (o) { if (o.isMesh && /Yellow/i.test(o.material.name || "")) { o.material.emissive = new T.Color(0xF2D94B); TM.led = o.material; } });
      TM.w0 = t.worker.root.position.clone(); TM.c0 = t.cart.position.clone(); TM.wry = t.worker.root.rotation.y;
    }
    return TM;
  }
  function teamHide() { if (!TM) return; if (TM.tour) TM.tour.root.visible = false; if (TM.elder) TM.elder.root.visible = false; if (TM.hud) TM.hud.visible = false;
    var t = PROD.team; if (t && t.worker && TM.w0) { t.worker.root.position.copy(TM.w0); t.worker.root.rotation.y = TM.wry; poseWalk(t.worker, 0, 0); t.cart.position.copy(TM.c0); placeVisor(); }
    if (t && t.staygap) t.staygap.children.forEach(function (c) { if (c.userData.state != null) c.visible = c.userData.state === 0; }); }
  api.teamReady = function () { return !!(api.ok && api.modelsReady && PROD.team && teamInit() && TM.ok); };
  api.relayTeam = function (k, u, t) {
    if (!api.teamReady()) return false;
    api.resize(); setRelayIdle(); teamHide();
    var T3 = PROD.team, cpos, clook, fov = 36, focusP, hide = [];
    function fr(ry) { return new T.Vector3(Math.sin(ry), 0, Math.cos(ry)); }
    if (k === 0 && T3.floway && TM.tour) {
      var K = T3.floway, ry = K.rotation.y, f = fr(ry), sd = new T.Vector3(f.z, 0, -f.x), base = K.position.clone();
      var stand = base.clone().addScaledVector(f, 0.62 * M), start = stand.clone().addScaledVector(sd, -7 * M), end = stand.clone().addScaledVector(sd, 9 * M);
      var w1 = sstep(0.0, 0.18, u), w2 = sstep(0.72, 1.0, u), r = TM.tour; r.root.visible = true;
      if (w2 > 0) { r.root.position.copy(stand).lerp(end, w2); r.root.rotation.y = Math.atan2(sd.x, sd.z); poseWalk(r, w2 * 30, 1); }
      else { r.root.position.copy(start).lerp(stand, w1); r.root.rotation.y = w1 < 1 ? Math.atan2(sd.x, sd.z) : ry + Math.PI; poseWalk(r, w1 * 22, w1 < 1 ? 1 : 0); }
      var pr = Math.max(sstep(0.18, 0.22, u) * (1 - sstep(0.27, 0.3, u)), sstep(0.32, 0.36, u) * (1 - sstep(0.43, 0.46, u)), sstep(0.5, 0.53, u) * (1 - sstep(0.56, 0.59, u)));
      var ph = sstep(0.58, 0.62, u) * (1 - sstep(0.7, 0.74, u));
      r.b.armR.rotation.x = -0.5 * pr - 0.35 * ph; r.b.elbR.rotation.x = -0.9 * pr - 1.5 * ph; r.b.spine.rotation.x = 0.12 * pr;
      var st = u < 0.31 ? 0 : u < 0.5 ? 1 : 2, kk = st === 0 ? sstep(0.19, 0.22, u) : st === 1 ? sstep(0.35, 0.47, u) : 1;
      var key2 = st * 100 + Math.round(kk * 20); if (key2 !== TM.kst) { TM.kst = key2; drawKiosk(TM.kc, st, kk); TM.kt.needsUpdate = true; }
      var far = base.clone().addScaledVector(f, 3.1 * M).addScaledVector(sd, 1.9 * M); far.y = 1.55 * M;
      var near = base.clone().addScaledVector(f, 2.0 * M).addScaledVector(sd, 1.15 * M); near.y = 1.72 * M;
      var lk = base.clone().addScaledVector(f, 0.3 * M); lk.y = 1.25 * M;
      var zin = sstep(0.16, 0.26, u) * (1 - sstep(0.66, 0.78, u));
      cpos = far.clone().lerp(near, zin); clook = lk; fov = lerp(34, 30, zin); focusP = base.clone().setY(1.3 * M);
      hide.push([base.x, base.z, 22]);
    } else if (k === 1 && T3.staygap && TM.elder) {
      var Pg = T3.staygap, ry1 = Pg.rotation.y, f1 = fr(ry1), s1 = new T.Vector3(f1.z, 0, -f1.x), b1 = Pg.position.clone(), re = TM.elder; re.root.visible = true;
      var green = sstep(0.4, 0.44, u), unfold = sstep(0.5, 0.56, u), sit = sstep(0.55, 0.66, u), lean = sstep(0.16, 0.22, u) * (1 - sstep(0.44, 0.48, u));
      var stateIx = unfold <= 0 ? (green > 0.5 ? 1 : 0) : (unfold < 0.5 ? 1 : 2);
      Pg.children.forEach(function (c) { if (c.userData.state != null) c.visible = c.userData.state === stateIx; });
      var stand1 = b1.clone().addScaledVector(f1, 0.3 * M), from1 = stand1.clone().addScaledVector(s1, -6 * M).addScaledVector(f1, 0.6 * M);
      var wk1 = sstep(0.0, 0.15, u);
      re.root.position.copy(from1).lerp(stand1, wk1);
      if (sit > 0) re.root.position.addScaledVector(f1, -0.1 * M * sit);
      re.root.rotation.set(-0.1 * lean, wk1 < 1 ? Math.atan2(s1.x, s1.z) : ry1, 0);
      poseWalk(re, wk1 * 18, wk1 < 1 ? 1 : 0);
      var press1 = sstep(0.46, 0.49, u) * (1 - sstep(0.52, 0.55, u));
      re.b.armR.rotation.x = 0.35 * press1; re.b.elbR.rotation.x = -0.4 * press1;
      if (sit > 0) { re.b.legL.rotation.x = -1.45 * sit; re.b.legR.rotation.x = -1.4 * sit; re.b.kneeL.rotation.x = 1.45 * sit; re.b.kneeR.rotation.x = 1.4 * sit; re.b.hip.position.y = lerp(re.hipY, 0.64 * M, sit); }
      var cp1 = b1.clone().addScaledVector(s1, 2.6 * M).addScaledVector(f1, 1.9 * M); cp1.y = 1.35 * M;
      var cl1 = b1.clone().addScaledVector(f1, 0.35 * M); cl1.y = 1.05 * M;
      var cp1b = b1.clone().addScaledVector(s1, 1.4 * M).addScaledVector(f1, 1.5 * M); cp1b.y = 1.2 * M;
      var z1 = sstep(0.4, 0.6, u);
      cpos = cp1.lerp(cp1b, z1); clook = cl1; fov = 36; focusP = b1.clone().setY(1.0 * M);
      hide.push([b1.x, b1.z, 12 + 30 * green]);   // 초록이 되면 사람들이 흩어짐
    } else if (k === 3 && T3.worker) {
      var wr = T3.worker, a1 = ST[2], fa = new T.Vector3(a1.ux, 0, a1.uy), w0 = TM.w0;
      var walkW = sstep(0.0, 0.42, u), from3 = w0.clone().addScaledVector(fa, -9 * M);
      wr.root.position.copy(from3).lerp(w0, walkW); wr.root.rotation.y = Math.atan2(fa.x, fa.z); poseWalk(wr, walkW * 40, walkW < 1 ? 1 : 0);
      T3.cart.position.copy(wr.root.position).addScaledVector(fa, 0.85 * M).add(new T.Vector3(0.2 * M, 0, 0));
      var working = sstep(0.42, 0.48, u);
      var rch = sstep(0.55, 0.6, u) * (1 - sstep(0.72, 0.78, u)); wr.b.armR.rotation.x = -0.6 * rch; wr.b.elbR.rotation.x = -0.8 * rch;   // 허리는 굽히지 않음 (바이저가 머리에서 어긋나지 않게)
      placeVisor();
      if (TM.led) TM.led.emissiveIntensity = 0.1 + 1.4 * working * (0.75 + 0.25 * Math.sin(u * 120));
      var hs = working > 0.5 ? 1 : 0; if (hs !== TM.hst) { TM.hst = hs; drawHud(TM.hc, hs); TM.ht.needsUpdate = true; }
      TM.hud.visible = u > 0.06 && u < 0.95; TM.hud.position.copy(wr.root.position).add(new T.Vector3(0, 2.15 * M, 0)).addScaledVector(fa, 0.2 * M);
      var cp3 = w0.clone().addScaledVector(fa, 2.6 * M).add(new T.Vector3(0.9 * M, 0, 0)); cp3.y = 1.6 * M;
      var cl3 = wr.root.position.clone(); cl3.y = 1.45 * M;
      cpos = cp3; clook = cl3; fov = 38; focusP = cl3;
      hide.push([w0.x, w0.z, 45]);
    } else return false;
    camera.position.copy(cpos); camera.up.set(0, 1, 0); camera.lookAt(clook);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    hideAround = hide; scene.fog.near = 520; scene.fog.far = 2600;
    relayMode = true; updatePeople(t); relayMode = false; hideAround = [];
    setLook({ dark: 0, floor: 1, tables: 1 });
    var focus = camera.position.distanceTo(focusP);
    renderDOF(focus, Math.max(8, focus * 0.6), 4.5);
    return true;
  };
  api._rig = { makeRig: makeRig, makeRigCC: makeRigCC, cloneRig: cloneRig, poseWalk: poseWalk, handPos: handPos };   // 점검용

  /* ---------- 카메라 ---------- */
  var tmpCam;
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
  // 카메라 경로: 위치 · 바라보는 점 · 화각을 모두 같은 곡선(Catmull-Rom)으로 이어서
  // 중간 키에서 회전 속도가 갑자기 바뀌는 '툭' 끊김이 없게 함
  function cr4(a, b, c, d, f) { var f2 = f * f, f3 = f2 * f; return 0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3); }
  function lookOf(kf) {
    if (kf.look) return kf.look;
    var d = new T.Vector3(0, 0, -1).applyQuaternion(kf.q); return kf.pos.clone().addScaledVector(d, 200);
  }
  function path(keys, t) {
    var n = keys.length - 1, x = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    var K = [keys[Math.max(0, i - 1)], keys[i], keys[i + 1], keys[Math.min(n, i + 2)]];
    var pos = new T.Vector3(), look = new T.Vector3(), up = new T.Vector3();
    var L = K.map(lookOf);
    ["x", "y", "z"].forEach(function (c) {
      pos[c] = cr4(K[0].pos[c], K[1].pos[c], K[2].pos[c], K[3].pos[c], f);
      look[c] = cr4(L[0][c], L[1][c], L[2][c], L[3][c], f);
    });
    up.copy(K[1].up || V_UP).lerp(K[2].up || V_UP, f * f * (3 - 2 * f)).normalize();
    if (!tmpCam) tmpCam = new T.PerspectiveCamera();
    tmpCam.position.copy(pos); tmpCam.up.copy(up); tmpCam.lookAt(look);
    return { pos: pos, q: tmpCam.quaternion.clone(), fov: cr4(K[0].fov, K[1].fov, K[2].fov, K[3].fov, f) };
  }
  var V_UP = new T.Vector3(0, 1, 0);

  /* ---------- 밖에서 쓰는 기능 ---------- */
  api.init = function () {
    if (api.ok) return true;
    try {
      canvas = document.createElement("canvas"); canvas.className = "c3d";
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
      build(); api.ok = true;
      loadModels();
      if (document.fonts && document.fonts.load) document.fonts.load("700 34px Pretendard", "명동분식").then(function () { if (api.redrawSigns) api.redrawSigns(); });
    } catch (e) { api.ok = false; }
    return api.ok;
  };
  api.preload = loadModels;
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
  api.render = function (cam, t) {
    if (!api.ok) return;
    api.resize();
    draw(cam, t);
  };
  function draw(cam, t) {
    if (RL && RL.her.root.visible) setRelayIdle();
    camera.position.copy(cam.pos);
    if (cam.q) camera.quaternion.copy(cam.q); else { camera.up.copy(cam.up); camera.lookAt(cam.look); }
    if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    var dist = cam.pos.y;
    scene.fog.near = Math.max(520, dist * 1.1); scene.fog.far = Math.max(2600, dist * 3.2);
    camera.near = dist > 300 ? 2 : 0.5; camera.updateProjectionMatrix();
    updatePeople(t);
    var pulse = 0.55 + 0.15 * Math.sin(t * 0.08);
    api.spotGlow.forEach(function (m, i) { m.material.opacity = api.spotOn ? (api.spotOn === i + 1 ? 1 : 0.35) : pulse * 0.6; });
    people.visible = people2.visible = cam.pos.y < 1100;                 // 아주 높이서는 2D 사람 점이 대신함
    if (RT) RT.group.visible = !!api.routeOn;                             // 동선은 제품 고르기 화면에서만
    syncRigs();
    renderer.render(scene, camera);
    api.routeOn = false;
  }
  /* 한 장면을 따로 그려 2D 캔버스에 옮김 (마지막 명동 야경처럼 멈춰 있는 그림) */
  api.snapshot = function (cv, cam, look, t) {
    if (!api.ok) return false;
    var w = Math.max(2, cv.clientWidth), h = Math.max(2, cv.clientHeight), prev = { dark: LOOK.dark, floor: LOOK.floor, tables: LOOK.tables };
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    setLook(look); draw(cam, t);
    var pr = renderer.getPixelRatio(); cv.width = Math.round(w * pr); cv.height = Math.round(h * pr);
    cv.getContext("2d").drawImage(canvas, 0, 0, cv.width, cv.height);
    setLook(prev); W0 = H0 = 0;                        // 다음 그림에서 원래 크기로
    return true;
  };
  api.nightKey = function () {
    var m = ST[0], p = MAP.pointOn(m, 430, 34), q = MAP.pointOn(m, 860, -6);
    return key(new T.Vector3(p[0], 21, p[1]), new T.Vector3(q[0], 42, q[1]), null, 50);
  };


  /* =========================================================
     제품 동선 (제품 고르기 화면) — 제품에서 다음 제품까지 구간마다 무드보드 색 하나씩
     노랑(포인트) → 아이보리(빛) → 차콜. 땅 위에 빛나는 띠 + 부드러운 번짐
     ========================================================= */
  var ROUTE_COL = ["#F2D94B", "#FFFDF4", "#2F312B"];
  var RT = null;
  function filletPath(raw, r) {                     // 꺾이는 곳을 둥글게
    var out = [raw[0].clone()];
    for (var i = 1; i < raw.length - 1; i++) {
      var a = raw[i - 1], b = raw[i], c = raw[i + 1];
      var d1 = b.clone().sub(a), d2 = c.clone().sub(b), l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
      var rr = Math.min(r, l1 * 0.45, l2 * 0.45), p0 = b.clone().addScaledVector(d1, -rr), p1 = b.clone().addScaledVector(d2, rr);
      for (var k = 0; k <= 8; k++) { var t = k / 8, q = p0.clone().multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(p1, t * t); out.push(q); }
    }
    out.push(raw[raw.length - 1].clone());
    // 고르게 다시 나눔 (4 단위마다)
    var even = [out[0]], acc = 0;
    for (var j = 1; j < out.length; j++) {
      var seg0 = out[j].distanceTo(out[j - 1]), steps = Math.max(1, Math.ceil(seg0 / 4));
      for (var s2 = 1; s2 <= steps; s2++) even.push(out[j - 1].clone().lerp(out[j], s2 / steps));
    }
    return even;
  }
  function ribbon(path, w, y) {
    var p = [], n = [];
    for (var i = 0; i < path.length - 1; i++) {
      var a = path[i], b = path[i + 1], d = b.clone().sub(a).normalize(), s = new T.Vector3(-d.z, 0, d.x).multiplyScalar(w / 2);
      var a0 = a.clone().add(s), a1 = a.clone().sub(s), b0 = b.clone().add(s), b1 = b.clone().sub(s);
      [a0, b0, a1, a1, b0, b1].forEach(function (v) { p.push(v.x, y, v.z); n.push(0, 1, 0); });
    }
    var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(n, 3));
    return g;
  }
  function buildRoute() {
    if (RT) return RT;
    var pts = MAP.route, stops = MAP.routeStops;
    RT = { segs: [], group: new T.Group(), len: 0, all: [] };
    for (var k = 0; k < stops.length - 1; k++) {
      var raw = pts.slice(stops[k], stops[k + 1] + 1).map(function (q) { return new T.Vector3(q[0], 0, q[1]); });
      var path = filletPath(raw, 34), col = hex(ROUTE_COL[k % ROUTE_COL.length]), dark = k === 2;
      var line = new T.Mesh(ribbon(path, 3.6, 0.9), new T.MeshBasicMaterial({ color: col, toneMapped: false }));
      var halo = new T.Mesh(ribbon(path, 14, 0.7), new T.MeshBasicMaterial({ color: dark ? hex("#FFFDF4") : col, transparent: true, opacity: dark ? 0.55 : 0.32, depthWrite: false, toneMapped: false }));
      line.renderOrder = 3; halo.renderOrder = 2;
      RT.group.add(halo); RT.group.add(line);
      var L = 0; for (var i = 1; i < path.length; i++) L += path[i].distanceTo(path[i - 1]);
      RT.segs.push({ line: line, halo: halo, path: path, len: L, start: RT.len, col: col, n: path.length - 1 });
      RT.len += L; RT.all = RT.all.concat(k ? path.slice(1) : path);
    }
    // 진행 끝의 빛 점
    RT.head = new T.Sprite(new T.SpriteMaterial({ map: GROUP.glowTex, color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    RT.head.scale.set(70, 70, 1); RT.group.add(RT.head);
    RT.group.visible = false; scene.add(RT.group);
    // 따라가는 카메라 (미리 계산 후 부드럽게)
    var N = 360, cum = [0]; for (var i2 = 1; i2 < RT.all.length; i2++) cum.push(cum[i2 - 1] + RT.all[i2].distanceTo(RT.all[i2 - 1]));
    function at(d) { d = clamp(d, 0, cum[cum.length - 1]); var i = 1; while (i < cum.length - 1 && cum[i] < d) i++; var f = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return RT.all[i - 1].clone().lerp(RT.all[i], clamp(f, 0, 1)); }
    var cp = [], lk = [];
    for (var s3 = 0; s3 <= N; s3++) {
      var d0 = s3 / N * RT.len, H = at(d0), A2 = at(d0 + 70), B2 = at(d0 - 70), tg = A2.clone().sub(B2).setY(0).normalize();
      if (tg.lengthSq() < 0.5) tg.set(1, 0, 0);
      var side = new T.Vector3(-tg.z, 0, tg.x);
      cp.push(H.clone().addScaledVector(tg, -300).addScaledVector(side, 110).setY(560));   // 건물 위에서 비스듬히 (휴대폰판처럼 따라감)
      lk.push(H.clone().addScaledVector(tg, 130).setY(0));
    }
    function smooth(arr, sig) {
      var out = [];
      for (var i = 0; i < arr.length; i++) {
        var acc = new T.Vector3(), ws = 0;
        for (var k = -3 * sig; k <= 3 * sig; k++) { var j = clamp(i + k, 0, arr.length - 1), w = Math.exp(-k * k / (2 * sig * sig)); acc.addScaledVector(arr[j], w); ws += w; }
        out.push(acc.multiplyScalar(1 / ws));
      }
      return out;
    }
    RT.cam = smooth(cp, 16); RT.look = smooth(lk, 10); RT.at = at;
    return RT;
  }
  api.routeStopFrac = function () { var r = buildRoute(); return r.segs.map(function (s) { return s.start / r.len; }).concat([1]); };
  api.routeColors = ROUTE_COL;
  // p: 0 ~ 1 (그려진 길이 비율), headOn: 끝 빛 점
  api.routeSet = function (p, headOn) {
    var r = buildRoute(), d = clamp(p, 0, 1) * r.len;
    r.segs.forEach(function (s) {
      var f = clamp((d - s.start) / s.len, 0, 1), cnt = Math.floor(f * s.n) * 6;
      s.line.geometry.setDrawRange(0, cnt); s.halo.geometry.setDrawRange(0, cnt);
      s.line.visible = s.halo.visible = cnt > 0;
    });
    var hp = r.at(d); r.head.position.set(hp.x, 6, hp.z);
    var si = 0; while (si < r.segs.length - 1 && d > r.segs[si].start + r.segs[si].len) si++;
    r.head.material.color.copy(r.segs[si].col); r.head.visible = !!headOn && p > 0 && p < 1;
    api.routeOn = true;
  };
  api.tourKey = function (p) {
    var r = buildRoute(), x = clamp(p, 0, 1) * (r.cam.length - 1), i = Math.min(r.cam.length - 2, Math.floor(x)), f = x - i;
    return key(r.cam[i].clone().lerp(r.cam[i + 1], f), r.look[i].clone().lerp(r.look[i + 1], f), null, 40);
  };

  /* =========================================================
     제품 3D 보기 (제품 고르기 화면) — 마우스 · 손가락으로 잡고 돌림, 놓으면 관성으로 천천히 멈춤
     ========================================================= */
  var VW = null;
  function viewerInit() {
    var r = new T.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.setClearColor(0x000000, 0);
    var sc = new T.Scene(); try { sc.environment = makeEnv(r); } catch (e) { }
    sc.add(new T.HemisphereLight(0xFFFFFF, 0x9A948A, 0.9));
    var key1 = new T.DirectionalLight(0xFFF4E2, 2.2); key1.position.set(-1.2, 2, 2.2); sc.add(key1);
    var rim = new T.DirectionalLight(0xDCE6FF, 1.1); rim.position.set(1.5, 1.2, -2); sc.add(rim);
    var cam = new T.PerspectiveCamera(26, 1, 0.01, 50);
    var spin = new T.Group(); sc.add(spin);
    // 바닥 그림자 (부드러운 원)
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(20,22,18,.42)"); gr.addColorStop(1, "rgba(20,22,18,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var sh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sc.add(sh);
    VW = { r: r, sc: sc, cam: cam, spin: spin, sh: sh, rotY: -0.6, rotX: 0.1, vy: 0, vx: 0, drag: false, idle: 0, models: {}, on: false, name: "" };
    var el = r.domElement, lx = 0, ly = 0, lt = 0;
    el.style.touchAction = "pan-y"; el.style.cursor = "grab";
    el.addEventListener("pointerdown", function (e) { VW.drag = true; lx = e.clientX; ly = e.clientY; lt = performance.now(); VW.vy = VW.vx = 0; el.setPointerCapture(e.pointerId); el.style.cursor = "grabbing"; });
    el.addEventListener("pointermove", function (e) {
      if (!VW.drag) return;
      var now = performance.now(), dt = Math.max(8, now - lt), dx = (e.clientX - lx) * 0.009, dy = (e.clientY - ly) * 0.006;
      VW.rotY += dx; VW.rotX = clamp(VW.rotX + dy, -0.25, 0.7);
      VW.vy = dx * 16 / dt; VW.vx = dy * 16 / dt; lx = e.clientX; ly = e.clientY; lt = now; VW.idle = 0;
    });
    function up(e) { if (!VW.drag) return; VW.drag = false; el.style.cursor = "grab"; if (performance.now() - lt > 80) VW.vy = VW.vx = 0; }
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    (function loop(now) {
      requestAnimationFrame(loop);
      if (!VW.on || !el.parentNode) return;
      var w = el.parentNode.clientWidth, h = el.parentNode.clientHeight;
      if (w !== VW.w || h !== VW.h) { VW.w = w; VW.h = h; r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
      if (!VW.drag) {
        VW.rotY += VW.vy; VW.rotX = clamp(VW.rotX + VW.vx, -0.25, 0.7); VW.vy *= 0.93; VW.vx *= 0.88;
        VW.idle += 1; if (VW.idle > 150 && Math.abs(VW.vy) < 0.002) VW.rotY += 0.0022 * Math.min(1, (VW.idle - 150) / 60);   // 가만히 두면 천천히 돎
        VW.rotX = lerp(VW.rotX, 0.1, VW.idle > 150 ? 0.01 : 0);
      }
      VW.spin.rotation.set(VW.rotX, VW.rotY, 0, "XYZ");
      r.render(sc, cam);
    })();
  }
  api.viewer = function (holder, name) {
    var g = MD[name]; if (!g || !T.WebGLRenderer) return false;
    try { if (!VW) viewerInit(); } catch (e) { return false; }
    if (!VW.models[name]) {
      var root = g.scene.clone(true), box = new T.Box3().setFromObject(root), sz = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
      root.position.sub(ctr); root.traverse(function (o) { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.envMapIntensity = 1; } });
      var wrap = new T.Group(); wrap.add(root); wrap.userData = { h: sz.y, r: Math.max(sz.x, sz.z), d: sz.length() };
      VW.models[name] = wrap;
    }
    VW.spin.children.slice().forEach(function (c) { VW.spin.remove(c); });
    var m = VW.models[name]; VW.spin.add(m);
    var H = m.userData.h, fit = Math.max(H * 0.62, m.userData.d * 0.5) / Math.tan(VW.cam.fov * Math.PI / 360);   // 넓은 물건(안경)도 화면 안에 다 들어오게
    VW.cam.position.set(0, H * 0.06, fit); VW.cam.lookAt(0, 0, 0);
    VW.sh.position.y = -H / 2 - 0.002; VW.sh.scale.setScalar(m.userData.r * 2.4);
    if (VW.r.domElement.parentNode !== holder) holder.appendChild(VW.r.domElement);
    VW.r.domElement.style.width = "100%"; VW.r.domElement.style.height = "100%"; VW.r.domElement.style.display = "block";
    VW.on = true; VW.name = name; VW.rotY = -0.6; VW.rotX = 0.1; VW.vy = 0.05; VW.idle = 0; VW.w = 0;
    return true;
  };
  api.viewerHide = function () { if (VW) VW.on = false; };
  api.path = path;
  api._scene = function () { return scene; }; api._renderer = function () { return renderer; }; api._group = GROUP;
  api.info = function () { return renderer ? { tris: renderer.info.render.triangles, calls: renderer.info.render.calls } : null; };
  api.canvas = function () { return canvas; };

  /* 장면별 카메라 길 */
  api.descentKeys = function (fx, fy, k, ch) {
    var a3 = ST[4], e = MAP.pointOn(a3, 430, 0), look = MAP.pointOn(a3, 40, 0);
    return [
      topDown(fx, fy, k, ch, 32),
      key(new T.Vector3(e[0] + 20, 380, e[1] + 220), new T.Vector3(look[0], 0, look[1] + 120), null, 40),
      key(new T.Vector3(e[0] + 4, 60, e[1] + 30), new T.Vector3(look[0], 30, look[1]), null, 52),
      key(new T.Vector3(e[0], EYE, e[1]), new T.Vector3(look[0], EYE + 6, look[1]), null, 58)
    ];
  };
  api.overviewKey = function (shift, isMobile) {
    var c = isMobile ? new T.Vector3(860, 0, 480) : new T.Vector3(860 - (shift || 0), 0, 440);
    var off = isMobile ? new T.Vector3(0, 1900, 900) : new T.Vector3(0, 1080, 760);
    return key(c.clone().add(off), c, null, isMobile ? 46 : 42);
  };
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
  api.eyeKey = function (j) {
    var ss = SPOT_STREET[j], s = ST[ss[0]], from = ss[1] + 150 <= s.len ? ss[1] + 150 : ss[1] - 150;
    var lane = s.kind === "main" ? 30 : 0, e = MAP.pointOn(s, from, lane), sp = MAP.spots[j];
    return key(new T.Vector3(e[0], EYE + 4, e[1]), new T.Vector3(sp[0], EYE, sp[1]), null, 46);
  };
  api.flyKeys = function (from, j) {
    var to = api.eyeKey(j), mid = from.pos.clone().lerp(to.pos, 0.5), sp = MAP.spots[j];
    var high = Math.max(260, Math.min(520, from.pos.distanceTo(to.pos) * 0.45));
    if (from.pos.y > 400) high = Math.min(from.pos.y * 0.55, 600);
    return [from, key(new T.Vector3(mid.x, high, mid.z), new T.Vector3(sp[0], 0, sp[1]), null, 44), to];
  };
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
  var SPOT_STREET = [[0, 40], [0, 190], [2, 330], [2, 150]];   // 제품마다 (길, 길 위 위치) — 눈높이 카메라용
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
