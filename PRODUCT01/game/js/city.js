/* 밤의 명동 거리 v2 — 더 넓은 지도, 사진 간판 · 가게 앞면, 층마다 띠 · 난간 · 실외기, 거리 가운데 한 줄로 늘어선 노점, 전구 감은 가로수 */
(function () {
  "use strict";
  var G = window.G, T = G.T, BGU = T.BufferGeometryUtils;
  var C = G.city = { group: new T.Group(), boxes: [], streets: [], nodes: [], edges: [], stalls: [], sfSpots: [], lights: [] };
  var MAIN_W = 16, ALLEY_W = 7, SIDE_W = 8.5, ZL = 140, XL = 96, AZ = [-110, -66, -22, 22, 66, 110], SX = [-60, 60];
  C.MAIN_W = MAIN_W; C.ALLEY_W = ALLEY_W; C.SIDE_W = SIDE_W; C.ZL = ZL; C.XL = XL; C.AZ = AZ; C.SX = SX; C.MAIN_IN = 2.5;   // 큰길에서 사람은 가운데(노점)에서 2.5m 밖으로 다님
  function rect(x0, z0, x1, z1) { return { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }; }
  C.streets.push(rect(-MAIN_W / 2, -ZL, MAIN_W / 2, ZL));
  AZ.forEach(function (z) { C.streets.push(rect(-XL, z - ALLEY_W / 2, XL, z + ALLEY_W / 2)); });
  SX.forEach(function (x) { C.streets.push(rect(x - SIDE_W / 2, -ZL, x + SIDE_W / 2, ZL)); });
  C.inStreet = function (x, z, m) { m = m || 0; for (var i = 0; i < C.streets.length; i++) { var s = C.streets[i]; if (x > s.x0 + m && x < s.x1 - m && z > s.z0 + m && z < s.z1 - m) return true; } return false; };
  /* 원(사람)과 상자들의 충돌: 밀어내기 */
  C.resolve = function (p, rad) {
    var hit = false;
    for (var i = 0; i < C.boxes.length; i++) {
      var b = C.boxes[i]; if (b.off || p.x < b.x0 - rad || p.x > b.x1 + rad || p.z < b.z0 - rad || p.z > b.z1 + rad) continue;
      var cx = G.clamp(p.x, b.x0, b.x1), cz = G.clamp(p.z, b.z0, b.z1), dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 > rad * rad) continue; hit = b;
      if (d2 > 1e-8) { var d = Math.sqrt(d2); p.x = cx + dx / d * rad; p.z = cz + dz / d * rad; }
      else { var l = p.x - b.x0, r = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z, m = Math.min(l, r, n, f); if (m === l) p.x = b.x0 - rad; else if (m === r) p.x = b.x1 + rad; else if (m === n) p.z = b.z0 - rad; else p.z = b.z1 + rad; }
    }
    return hit;
  };
  C.blocked = function (x, z, rad) { for (var i = 0; i < C.boxes.length; i++) { var b = C.boxes[i]; if (!b.off && x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) return b; } return null; };

  var R = G.rng(20301117);
  var HUES = [[255, 196, 70], [255, 96, 110], [90, 200, 255], [255, 255, 240], [140, 255, 170], [255, 140, 60], [200, 130, 255], [255, 226, 120]];
  var NAMES = ["명동 꼬치", "화장품", "COSMETIC", "명동교자", "CAFE 2030", "노래방", "EXCHANGE", "K-BEAUTY", "분식", "SHOES", "약국", "치킨 · 맥주", "GIFT SHOP", "호떡", "마라탕", "PHOTO", "안경", "네일", "DUTY FREE", "떡볶이", "빙수", "SOCKS", "편의점 24", "족발", "TEA", "HOTEL", "닭갈비", "양말", "ACC", "삼겹살"];
  function rgb(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a == null ? 1 : a) + ")"; }
  var texL = new T.TextureLoader();
  function photo(key) { var P = window.GM && GM.photo && GM.photo[key]; if (!P) return null; var t = texL.load(P.src); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return { t: t, n: P.n, cols: P.cols, rows: P.rows }; }
  function tileUV(P, k) { var c = k % P.cols, r = Math.floor(k / P.cols); return [c / P.cols + .002, 1 - (r + 1) / P.rows + .002, (c + 1) / P.cols - .002, 1 - r / P.rows - .002]; }

  /* ---- 그림 재질 ---- */
  function shopTex(i) {
    var hue = HUES[i % HUES.length], nm = NAMES[i % NAMES.length], dark = i % 3 === 0, r2 = G.rng(i * 31 + 7);
    function draw(g, w, h, em) {
      var rr = G.rng(i * 31 + 7);
      g.fillStyle = em ? "#000" : "#15140f"; g.fillRect(0, 0, w, h);
      var gr = g.createLinearGradient(0, h * .34, 0, h); gr.addColorStop(0, rgb([255, 240, 214], em ? .9 : 1)); gr.addColorStop(.6, rgb([Math.min(255, hue[0] * .45 + 130), Math.min(255, hue[1] * .45 + 120), Math.min(255, hue[2] * .45 + 100)], em ? .7 : 1)); gr.addColorStop(1, rgb([90, 72, 52], em ? .3 : 1));
      g.fillStyle = gr; g.fillRect(w * .04, h * .34, w * .92, h * .62);
      for (var q = 0; q < 3; q++) { g.fillStyle = "rgba(60,40,20,.4)"; g.fillRect(w * .05, h * (.5 + q * .13), w * .9, 3); for (var p = 0; p < 30; p++) { var hc = HUES[Math.floor(rr() * HUES.length)]; g.fillStyle = rgb(hc, em ? .5 : .85); var bw = w * (.012 + rr() * .015); g.fillRect(w * (.06 + p * .029), h * (.5 + q * .13) - h * (.04 + rr() * .05), bw, h * .09); } }
      for (var k = 0; k < 5; k++) { g.fillStyle = "rgba(20,16,10," + (.4 + rr() * .4) + ")"; var sx = w * (.08 + rr() * .8), sw = w * (.035 + rr() * .03), sh = h * (.28 + rr() * .2); g.beginPath(); g.ellipse(sx + sw / 2, h * .96 - sh + sw * .5, sw * .5, sw * .55, 0, 0, 7); g.fill(); g.fillRect(sx, h * .96 - sh + sw, sw, sh - sw); }
      g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.moveTo(w * .1, h * .34); g.lineTo(w * .3, h * .34); g.lineTo(w * .15, h * .96); g.lineTo(w * -.05, h * .96); g.fill();
      g.fillStyle = em ? "#000" : "#0c0c0a"; for (k = 1; k < 4; k++) g.fillRect(w * .04 + w * .92 * k / 4 - 2, h * .34, 4, h * .62);
      g.fillRect(0, h * .94, w, h * .06);
      g.fillStyle = dark ? (em ? "#000" : "#1b1b18") : rgb(hue, em ? .85 : 1); g.fillRect(0, h * .04, w, h * .26);
      g.font = "800 " + Math.round(h * .17) + "px " + G.FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = dark ? rgb(hue) : (em ? "rgba(40,30,10,1)" : "#1c1a12"); g.fillText(nm, w / 2, h * .18, w * .9);
    }
    return { map: G.canvasTex(512, 256, function (g, w, h) { draw(g, w, h, false); }), em: G.canvasTex(512, 256, function (g, w, h) { draw(g, w, h, true); }) };
  }
  function winTex(i) {      // 위층 창: 창틀 · 블라인드 · 켜진 창 일부
    var bases = ["#3a3833", "#46423a", "#2c2f34", "#4b443a", "#2a2b2e", "#55504a"], base = bases[i % bases.length], rr = G.rng(i * 17 + 3), cells = [];
    for (var k = 0; k < 24; k++) cells.push({ on: rr() < .45 ? HUES[[0, 3, 3, 7, 2, 3][Math.floor(rr() * 6)]] : null, blind: rr() * .7, ac: rr() < .12 });
    function draw(g, w, h, em) {
      g.fillStyle = em ? "#08090c" : base; g.fillRect(0, 0, w, h);
      if (!em) { for (var n = 0; n < 1400; n++) { g.fillStyle = "rgba(" + (rr() < .5 ? "0,0,0" : "255,255,255") + "," + rr() * .05 + ")"; g.fillRect(rr() * w, rr() * h, 2, 2); } }
      for (var y = 0; y < 6; y++) for (var x = 0; x < 4; x++) {
        var c = cells[y * 4 + x], px = x * w / 4 + w * .045, py = y * h / 6 + h * .035, pw = w / 4 - w * .09, ph = h / 6 - h * .075;
        g.fillStyle = em ? "#000" : "#1a1c1f"; g.fillRect(px - 3, py - 3, pw + 6, ph + 6);
        if (c.on) { var gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, rgb(c.on, em ? .75 : 1)); gr.addColorStop(1, rgb([c.on[0] * .7, c.on[1] * .6, c.on[2] * .5], em ? .45 : 1)); g.fillStyle = gr; g.fillRect(px, py, pw, ph); g.fillStyle = em ? "rgba(0,0,0,.55)" : "rgba(40,30,20,.55)"; g.fillRect(px, py, pw, ph * c.blind); for (var b = 0; b < c.blind * 8; b++) g.fillRect(px, py + b * ph / 8, pw, 1); }
        else { g.fillStyle = em ? "#000" : "#0d1014"; g.fillRect(px, py, pw, ph); if (!em) { var rf = g.createLinearGradient(px, py, px + pw, py + ph); rf.addColorStop(0, "rgba(120,140,170,.18)"); rf.addColorStop(.5, "rgba(0,0,0,0)"); g.fillStyle = rf; g.fillRect(px, py, pw, ph); } }
        g.fillStyle = em ? "#000" : "#202326"; g.fillRect(px + pw / 2 - 1.5, py, 3, ph); g.fillRect(px, py + ph * .55, pw, 2);
        if (!em) { g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(px - 3, py + ph + 3, pw + 6, 3); }
      }
      if (!em) { g.fillStyle = "rgba(0,0,0,.3)"; for (y = 1; y < 6; y++) g.fillRect(0, y * h / 6 - 2, w, 4); }
    }
    var o = { repeat: [1, 1] };
    return { map: G.canvasTex(256, 384, function (g, w, h) { draw(g, w, h, false); }, o), em: G.canvasTex(256, 384, function (g, w, h) { draw(g, w, h, true); }, o) };
  }
  function signTex(i, vertical) {
    var hue = HUES[(i * 3 + 1) % HUES.length], nm = NAMES[(i * 7 + 3) % NAMES.length], inv = i % 2 === 0;
    return G.canvasTex(vertical ? 128 : 512, vertical ? 512 : 128, function (g, w, h) {
      g.fillStyle = inv ? rgb(hue) : "#14130f"; g.fillRect(0, 0, w, h); g.fillStyle = inv ? "#17150f" : rgb(hue);
      g.textAlign = "center"; g.textBaseline = "middle";
      if (vertical) { var ch = nm.replace(/\s/g, "").slice(0, 6).split(""), fs = Math.min(w * .78, h / (ch.length + .6)); g.font = "800 " + fs + "px " + G.FONT; ch.forEach(function (c, k) { g.fillText(c, w / 2, h * (k + .8) / (ch.length + .6)); }); }
      else { g.font = "800 " + h * .6 + "px " + G.FONT; g.fillText(nm, w / 2, h * .54, w * .92); }
      g.strokeStyle = inv ? "#17150f" : rgb(hue); g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    });
  }
  function awnTex(i) { var cs = [["#c8281e", "#f2ede0"], ["#1d5f3a", "#f2ede0"], ["#1f3f7a", "#f2ede0"], ["#e8b21e", "#2a2a26"], ["#e46aa0", "#fff"]][i % 5]; return G.canvasTex(256, 64, function (g, w, h) { for (var k = 0; k < 16; k++) { g.fillStyle = cs[k % 2]; g.fillRect(k * w / 16, 0, w / 16 + 1, h); } g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, h * .8, w, h * .2); }, { repeat: [1, 1] }); }

  function wallTex(col, kind, i) {    // 0: 타일, 1: 콘크리트 판, 2: 벽돌
    var r = G.rng(i * 13 + 1);
    return G.canvasTex(256, 256, function (g, w, h) { g.fillStyle = col; g.fillRect(0, 0, w, h);
      if (kind === 2) { for (var y = 0; y < 16; y++) for (var x = 0; x < 9; x++) { g.fillStyle = "rgba(" + (r() < .5 ? "0,0,0," + r() * .18 : "255,255,255," + r() * .08) + ")"; g.fillRect(x * 32 - (y % 2) * 16, y * 16, 31, 15); } g.fillStyle = "rgba(0,0,0,.28)"; for (y = 0; y < 16; y++) g.fillRect(0, y * 16 + 15, w, 1); }
      else if (kind === 0) { for (var y2 = 0; y2 < 8; y2++) for (var x2 = 0; x2 < 4; x2++) { g.fillStyle = "rgba(255,255,255," + r() * .07 + ")"; g.fillRect(x2 * 64 + 1, y2 * 32 + 1, 62, 30); } g.fillStyle = "rgba(0,0,0,.22)"; for (y2 = 0; y2 <= 8; y2++) g.fillRect(0, y2 * 32, w, 2); for (x2 = 0; x2 <= 4; x2++) g.fillRect(x2 * 64, 0, 2, h); }
      else { g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(0, 127, w, 2); g.fillRect(127, 0, 2, h); for (var k = 0; k < 14; k++) { g.fillStyle = "rgba(0,0,0,.08)"; g.beginPath(); g.arc(r() * w, r() * h, 2, 0, 7); g.fill(); } }
      for (var n = 0; n < 900; n++) { g.fillStyle = "rgba(" + (r() < .5 ? "0,0,0" : "255,255,255") + "," + r() * .06 + ")"; g.fillRect(r() * w, r() * h, 2, 2); }
      var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(30,20,10,.12)"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, { repeat: [1, 1] });
  }
  /* ---- 한 재질로 묶는 사각형 모음 ---- */
  function Batch(mat) { this.mat = mat; this.p = []; this.n = []; this.u = []; this.i = []; }
  Batch.prototype.quad = function (a, b, c, d, nrm, u0, v0, u1, v1) {
    var k = this.p.length / 3; this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (var j = 0; j < 4; j++) this.n.push(nrm[0], nrm[1], nrm[2]);
    this.u.push(u0, v0, u1, v0, u1, v1, u0, v1); this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  Batch.prototype.box = function (x0, y0, z0, x1, y1, z1, top, us, vs) {
    var W = this.mat.map && this.mat.map.wrapS === T.RepeatWrapping ? .4 : 0;   // 무늬 있는 벽은 크기에 맞춰 반복
    function q(self, a, b, c, d, n, w, hh) { if (W) self.quad(a, b, c, d, n, a[0] * 0 + 0, 0, w * W, hh * W); else self.quad(a, b, c, d, n, 0, 0, us || 1, vs || 1); }
    var dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    q(this, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], dx, dy); q(this, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], dx, dy);
    q(this, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], dz, dy); q(this, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], dz, dy);
    if (top !== false) q(this, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], dx, dz);
  };
  Batch.prototype.mesh = function (shadow) {
    var g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(this.n, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i);
    var m = new T.Mesh(g, this.mat); m.castShadow = !!shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; return m;
  };
  /* 여러 모양(geometry)을 재질별로 하나로 합치기 */
  function Merger() { this.b = new Map(); }
  Merger.prototype.add = function (geo, mat, mtx) { var g = geo.index ? geo.clone() : geo.clone(); if (!g.index) { var n = g.attributes.position.count, ix = []; for (var i = 0; i < n; i++) ix.push(i); g.setIndex(ix); } ["color", "uv1", "uv2", "tangent"].forEach(function (a) { if (g.attributes[a]) g.deleteAttribute(a); }); g.applyMatrix4(mtx); if (!this.b.has(mat)) this.b.set(mat, []); this.b.get(mat).push(g); };
  Merger.prototype.flush = function (par, shadow) { this.b.forEach(function (list, mat) { var g = BGU.mergeGeometries(list, false); if (!g) return; var m = new T.Mesh(g, mat); m.castShadow = !!shadow && !mat.transparent; m.receiveShadow = true; m.matrixAutoUpdate = false; par.add(m); }); this.b.clear(); };

  /* ---- 노점 재료 ---- */
  var SM = null;
  function stallMats() {
    if (SM) return SM;
    var F = window.GM && GM.food || {};
    function img(src, cb) { var im = new Image(); im.onload = function () { cb(im); }; im.src = src; }
    var foodT = texL.load(F.texCooked || ""); foodT.colorSpace = T.SRGBColorSpace; foodT.wrapS = foodT.wrapT = T.RepeatWrapping;
    var SIGNN = [["명동 닭꼬치", "Chicken Stick"], ["왕닭꼬치", "BIG CHICKEN SKEWER"], ["치즈구이", "Grilled Cheese"], ["회오리감자", "Tornado Potato"], ["어묵꼬치", "Fish Cake"], ["닭강정", "Sweet Crispy Chicken"], ["랍스터 치즈", "LOBSTER"], ["탕후루", "Tanghulu"], ["군밤 · 호떡", "Roasted Chestnut"], ["양꼬치", "LAMB STICK"]];
    var SC = [["#c8281e", "#ffe14a"], ["#151515", "#ff3b30"], ["#e8b21e", "#1a1a1a"], ["#c8281e", "#fff"], ["#1f3f7a", "#ffe14a"], ["#7a1010", "#ffcf3a"], ["#e46aa0", "#fff"], ["#2a7a3a", "#fff"], ["#3a1a0a", "#ffcf3a"], ["#c8281e", "#fff"]];
    var signT = G.canvasTex(1024, 1024, function (g, w, h) {
      SIGNN.forEach(function (s, k) { var y = k * h / 10, hh = h / 10, c = SC[k]; g.fillStyle = c[0]; g.fillRect(0, y, w, hh); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(0, y, w, hh * .12);
        g.fillStyle = "#fff"; g.beginPath(); g.arc(hh * .62, y + hh / 2, hh * .4, 0, 7); g.fill(); g.fillStyle = c[0]; g.font = "800 " + hh * .42 + "px " + G.FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(["🐔", "🍢", "🧀", "🥔", "🍢", "🍗", "🦞", "🍓", "🌰", "🍖"][k], hh * .62, y + hh * .53);
        g.fillStyle = c[1]; g.font = "900 " + hh * .56 + "px " + G.FONT; g.textAlign = "left"; g.fillText(s[0], hh * 1.2, y + hh * .44, w * .62); g.font = "700 " + hh * .22 + "px " + G.FONT; g.fillStyle = "#fff"; g.textAlign = "right"; g.fillText(s[1], w - 20, y + hh * .76, w * .4);
        g.strokeStyle = c[1]; g.lineWidth = 4; g.strokeRect(4, y + 4, w - 8, hh - 8); });
    });
    var front = G.canvasTex(1024, 512, function (g, w, h) { g.fillStyle = "#b71c14"; g.fillRect(0, 0, w, h); });
    var tags = G.canvasTex(512, 256, function (g, w, h) {
      var items = [["소금구이", "#ffd23f"], ["매운맛", "#ff8a2a"], ["바베큐", "#ffd23f"], ["데리야끼", "#fff"], ["왕닭꼬치", "#ffd23f"], ["계좌이체", "#fff"], ["₩5,000", "#ffd23f"], ["₩4,000", "#fff"]];
      items.forEach(function (it, k) { var x = (k % 4) * w / 4, y = Math.floor(k / 4) * h / 2; g.fillStyle = k === 5 ? "#fff" : "#c8281e"; g.fillRect(x + 3, y + 3, w / 4 - 6, h / 2 - 6); g.fillStyle = it[1] === "#fff" && k !== 5 ? "#fff" : (k === 5 ? "#c8281e" : it[1]); g.fillRect(x + 6, y + 6, w / 4 - 12, h * .14); g.fillStyle = k === 5 ? "#fff" : "#c8281e"; g.font = "800 22px " + G.FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(it[0], x + w / 8, y + h * .11, w / 4 - 16); g.fillStyle = k === 5 ? "#c8281e" : "#ffe14a"; g.font = "900 30px " + G.FONT; g.fillText(k > 5 ? it[0] : "₩" + (4 + (k % 3)) + ",000", x + w / 8, y + h * .34, w / 4 - 14); });
    });
    // 앞 현수막: 음식 사진 칸 + 글자 (사진이 늦게 읽히면 그때 다시 그림)
    img(F.texCooked || "", function (ck) { img(F.texDark || "", function (dk) { img(F.texOnion || "", function (on) {
      var c = front.image, g = c.getContext("2d"), w = c.width, h = c.height;
      for (var r = 0; r < 4; r++) { var y = r * h / 4, hh = h / 4; g.fillStyle = ["#b71c14", "#151515", "#c8281e", "#1f3f7a"][r]; g.fillRect(0, y, w, hh);
        for (var k = 0; k < 4; k++) { var x = 20 + k * 150; g.drawImage([ck, dk, on, ck][(k + r) % 4], x, y + 14, 136, hh - 28); g.strokeStyle = "#ffe14a"; g.lineWidth = 3; g.strokeRect(x, y + 14, 136, hh - 28); }
        g.fillStyle = "#ffe14a"; g.font = "900 " + hh * .38 + "px " + G.FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(["닭꼬치 ₩5,000", "Chicken Skewer", "鸡肉串 焼き鳥", "명동 MYEONGDONG"][r], w * .8, y + hh / 2, w * .36); }
      front.needsUpdate = true; }); }); });
    SM = {
      steel: new T.MeshStandardMaterial({ color: 0xb4b6b4, roughness: .28, metalness: .85 }),
      dark: new T.MeshStandardMaterial({ color: 0x232427, roughness: .55, metalness: .3 }),
      glass: new T.MeshStandardMaterial({ color: 0xcfe6ff, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false }),
      sign: new T.MeshBasicMaterial({ map: signT, toneMapped: false, color: new T.Color(1.35, 1.35, 1.35) }),
      front: new T.MeshStandardMaterial({ map: front, roughness: .6, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: .35 }),
      tags: new T.MeshBasicMaterial({ map: tags, toneMapped: false, color: new T.Color(1.1, 1.1, 1.1) }),
      food: new T.MeshStandardMaterial({ map: foodT, roughness: .45, emissive: 0x401a08, emissiveIntensity: .4 }),
      bulb: new T.MeshBasicMaterial({ color: new T.Color(3.4, 2.5, 1.2), toneMapped: false }),
      red: new T.MeshStandardMaterial({ color: 0xc8281e, roughness: .35, metalness: .2 }),
      blue: new T.MeshStandardMaterial({ color: 0x2a62c8, roughness: .6 }),
      tank: new T.MeshStandardMaterial({ color: 0x8a8f94, roughness: .4, metalness: .6 }),
      tarp: [0xc8281e, 0xf2ede0, 0x1f4fa8, 0xe8b21e, 0x2a7a3a].map(function (c) { return new T.MeshStandardMaterial({ color: c, roughness: .8, side: T.DoubleSide, emissive: c, emissiveIntensity: .08 }); }),
      curtain: new T.MeshStandardMaterial({ color: 0xffffff, roughness: .2, transparent: true, opacity: .14, depthWrite: false, side: T.DoubleSide }),
      foodT: foodT
    };
    return SM;
  }
  var GEO = {};
  function geo(k, f) { return GEO[k] || (GEO[k] = f()); }
  /* 노점 한 채의 부품을 add(geometry, material, matrix) 로 내보냄. 로컬 좌표: 긴 쪽 = x, 손님 쪽 = +z */
  function stallParts(s, L, add, detail) {
    var M = stallMats(), D = 1.3, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
    var BOX = geo("box", function () { return new T.BoxGeometry(1, 1, 1); }), PLANE = geo("plane", function () { return new T.PlaneGeometry(1, 1); }), CYL = geo("cyl", function () { return new T.CylinderGeometry(.5, .5, 1, 12); }), SPH = geo("sph", function () { return new T.SphereGeometry(.5, 8, 6); });
    function put(g, mat, x, y, z, sx, sy, sz, rx, ry, rz) { e.set(rx || 0, ry || 0, rz || 0); q.setFromEuler(e); m4.compose(v.set(x, y, z), q, sc.set(sx, sy, sz)); add(g, mat, m4.clone()); }
    function uvPlane(u0, v0, u1, v1) { var g = new T.PlaneGeometry(1, 1), uv = g.attributes.uv; for (var i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); return g; }
    var v2 = s.var, sk = s.sign;
    put(BOX, M.dark, 0, .47, 0, L, .78, D);                                   // 아래 수납장
    put(BOX, M.steel, 0, .9, 0, L + .08, .05, D + .08);                         // 스테인리스 판
    put(BOX, M.steel, 0, .1, D / 2 + .01, L, .06, .02);
    put(geo("front" + Math.round(L * 10), function () { return uvPlane(0, 0, 1, 1); }), M.front, 0, .5, D / 2 + .012, L - .1, .66, 1);   // 앞 현수막 (음식 사진)
    [-1, 1].forEach(function (sx2) { [-1, 1].forEach(function (sz2) { put(CYL, M.dark, sx2 * (L / 2 - .2), .08, sz2 * (D / 2 - .15), .16, .08, .16, 0, 0, Math.PI / 2); }); });
    if (!detail) {
    // 유리 진열장 + 안의 음식
    put(BOX, M.glass, 0, 1.1, .32, L - .3, .36, .5);
    put(geo("foodp", function () { var g = uvPlane(0, 0, 3, 1); return g; }), M.food, 0, .935, .32, L - .4, .44, 1, -Math.PI / 2);
    put(BOX, M.steel, 0, 1.285, .32, L - .28, .02, .52);
    // 뒤쪽 굽는 판과 꼬치
    put(BOX, M.dark, 0, .96, -.3, L * .7, .08, .5);
    put(geo("foodg", function () { return uvPlane(0, 0, 4, 1.2); }), M.food, 0, 1.005, -.3, L * .66, .44, 1, -Math.PI / 2);
    }
    // 기둥 · 위 간판 · 지붕
    var H = 2.35; [-1, 1].forEach(function (sx2) { [-1, 1].forEach(function (sz2) { put(BOX, M.steel, sx2 * (L / 2 - .03), (H + .9) / 2, sz2 * (D / 2 - .03), .045, H - .9, .045); }); });
    put(BOX, M.dark, 0, H - .02, D / 2 - .03, L, .5, .06);
    put(geo("sign" + sk, function () { return uvPlane(.005, 1 - (sk + 1) / 10 + .004, .995, 1 - sk / 10 - .004); }), M.sign, 0, H - .02, D / 2 + .002, L - .04, .46, 1);
    put(geo("sign" + sk, function () { return uvPlane(.005, 1 - (sk + 1) / 10 + .004, .995, 1 - sk / 10 - .004); }), M.sign, 0, H - .02, D / 2 - .062, L - .04, .46, 1, 0, Math.PI);
    if (v2 % 3 !== 2) { var tp = M.tarp[(s.i * 7 + v2) % M.tarp.length]; put(BOX, tp, 0, H + .28, -.05, L + .5, .04, D + .9, -.06); }
    else { put(BOX, M.steel, 0, H + .24, 0, L, .03, D); }
    // 전구 · 가격표 · 소화기 · 가스통 · 상자
    for (var k = 0; k < Math.round(L / .9); k++) put(SPH, M.bulb, -L / 2 + .45 + k * .9, H - .32, D / 2 - .15, .1, .1, .1);
    var tagN = Math.min(6, Math.floor(L / .45)); for (k = 0; k < tagN; k++) { var ti = (k + s.i) % 8; put(geo("tag" + ti, function () { var c2 = ti % 4, r2 = Math.floor(ti / 4); return uvPlane(c2 / 4, 1 - (r2 + 1) / 2, (c2 + 1) / 4, 1 - r2 / 2); }), M.tags, -L / 2 + .3 + k * (L - .6) / Math.max(1, tagN - 1), .7, D / 2 + .03, .3, .2, 1); }
    put(CYL, M.red, L / 2 - .12, 1.12, .48, .13, .42, .13); put(CYL, M.dark, L / 2 - .12, 1.36, .48, .04, .08, .04);
    if (v2 % 2 === 0) put(CYL, M.tank, -L / 2 + .3, .5, -D / 2 - .25, .32, .6, .32);
    put(BOX, M.blue, L / 2 - .4, .16, -D / 2 - .3, .5, .3, .38);
    if (v2 % 4 === 1) { put(PLANE, M.curtain, -L / 2 - .02, 1.65, 0, D, 1.4, 1, 0, Math.PI / 2); put(PLANE, M.curtain, L / 2 + .02, 1.65, 0, D, 1.4, 1, 0, Math.PI / 2); }
  }
  C.stallParts = stallParts; C.stallMats = stallMats;

  C.build = function () {
    var grp = C.group, i;
    var PV = photo("V"), PH = photo("H"), PF = photo("F");
    var SHOP = [], WIN = [], SIGNV = [], SIGNH = [], AWN = [];
    for (i = 0; i < 14; i++) { var s = shopTex(i); SHOP.push(new Batch(new T.MeshStandardMaterial({ map: s.map, emissiveMap: s.em, emissive: 0xffffff, emissiveIntensity: 1.15, roughness: .35 }))); }
    for (i = 0; i < 6; i++) { var w = winTex(i); WIN.push(new Batch(new T.MeshStandardMaterial({ map: w.map, emissiveMap: w.em, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: .7 }))); }
    for (i = 0; i < 6; i++) { SIGNV.push(new Batch(new T.MeshBasicMaterial({ map: signTex(i, true), toneMapped: false, color: new T.Color(2, 2, 2) }))); SIGNH.push(new Batch(new T.MeshBasicMaterial({ map: signTex(i + 5, false), toneMapped: false, color: new T.Color(1.8, 1.8, 1.8) }))); }
    for (i = 0; i < 5; i++) AWN.push(new Batch(new T.MeshStandardMaterial({ map: awnTex(i), roughness: .8, side: T.DoubleSide })));
    var PVB = PV && new Batch(new T.MeshBasicMaterial({ map: PV.t, toneMapped: false, color: new T.Color(1.5, 1.5, 1.5) })), PHB = PH && new Batch(new T.MeshBasicMaterial({ map: PH.t, toneMapped: false, color: new T.Color(1.45, 1.45, 1.45) })), PFB = PF && new Batch(new T.MeshStandardMaterial({ map: PF.t, emissiveMap: PF.t, emissive: 0xffffff, emissiveIntensity: .85, roughness: .4 }));
    var WALLS = [["#8a8378", 0], ["#6d6a66", 1], ["#9b8a74", 2], ["#56504a", 1], ["#b0a898", 0], ["#7a5a48", 2]].map(function (c, i) { var t = wallTex(c[0], c[1], i); return new Batch(new T.MeshStandardMaterial({ map: t, roughness: .82, color: 0xc8c8c8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .16 })); });
    var GLS = new Batch(new T.MeshStandardMaterial({ color: 0x1a2a3a, roughness: .08, metalness: .7, transparent: true, opacity: .55, depthWrite: false })), RAIL = new Batch(new T.MeshStandardMaterial({ color: 0x9fb6c8, roughness: .1, metalness: .2, transparent: true, opacity: .35, depthWrite: false })), TANK = new Batch(new T.MeshStandardMaterial({ color: 0x5a6a72, roughness: .5, metalness: .4 }));
    var WALL = new Batch(new T.MeshStandardMaterial({ color: 0x3a3833, roughness: .85 })), TRIM = new Batch(new T.MeshStandardMaterial({ color: 0x7a756a, roughness: .7, metalness: .1, emissive: 0x2a2620, emissiveIntensity: .6 })), ROOF = new Batch(new T.MeshStandardMaterial({ color: 0x1c1c1a, roughness: 1 })), AC = new Batch(new T.MeshStandardMaterial({ color: 0x9a9c98, roughness: .55, metalness: .3 }));
    var pools = [], id = 0;
    var xs = [-XL - 16, SX[0] - SIDE_W / 2, SX[0] + SIDE_W / 2, -MAIN_W / 2, MAIN_W / 2, SX[1] - SIDE_W / 2, SX[1] + SIDE_W / 2, XL + 16];
    var zs = [-ZL - 16]; AZ.forEach(function (z) { zs.push(z - ALLEY_W / 2, z + ALLEY_W / 2); }); zs.push(ZL + 16);
    var NV = PV ? PV.n : 0, NH = PH ? PH.n : 0, NF = PF ? PF.n : 0;
    function lot(x0, z0, x1, z1, dir) {
      var k = id++, nearMain = Math.abs(dir < 2 ? (dir === 0 ? x1 : x0) : 99) <= MAIN_W / 2 + .1;
      var floors = 2 + Math.floor(R() * R() * 7) + (nearMain ? 1 : 0), sh = 4.4, hgt = sh + floors * 3.6, len = dir < 2 ? z1 - z0 : x1 - x0;
      var O, U, N; // 앞면의 원점(왼쪽 아래) · 오른쪽 방향 · 바깥 방향
      if (dir === 0) { O = [x1, z1]; U = [0, -1]; N = [1, 0]; } else if (dir === 1) { O = [x0, z0]; U = [0, 1]; N = [-1, 0]; } else if (dir === 2) { O = [x0, z1]; U = [1, 0]; N = [0, 1]; } else { O = [x1, z0]; U = [-1, 0]; N = [0, -1]; }
      function P(s0, y, off) { return [O[0] + U[0] * s0 + N[0] * off, y, O[1] + U[1] * s0 + N[1] * off]; }
      function face(b, s0, s1, y0, y1, off, uv) { uv = uv || [0, 0, 1, 1]; b.quad(P(s0, y0, off), P(s1, y0, off), P(s1, y1, off), P(s0, y1, off), [N[0], 0, N[1]], uv[0], uv[1], uv[2], uv[3]); }
      function boxF(b, s0, s1, y0, y1, d0, d1, top) { var a = P(s0, y0, d0), c = P(s1, y1, d1); b.box(Math.min(a[0], c[0]), y0, Math.min(a[2], c[2]), Math.max(a[0], c[0]), y1, Math.max(a[2], c[2]), top); }
      // 집마다 앞면 위치를 조금씩 다르게(들쭉날쭉) + 1층은 안으로 들어가고 위층은 창이 벽 안쪽에 박힘
      var sb = [0, 0, .35, .7][Math.floor(R() * 4)], RC = .55, style = Math.floor(R() * 4), WM = WALLS[k % WALLS.length];
      var mx0 = Math.min(x0, x1), mx1 = Math.max(x0, x1), mz0 = Math.min(z0, z1), mz1 = Math.max(z0, z1), cut = sb + RC;
      if (dir === 0) mx1 -= cut; else if (dir === 1) mx0 += cut; else if (dir === 2) mz1 -= cut; else mz0 += cut;
      ROOF.box(mx0, 0, mz0, mx1, hgt, mz1);
      var F0 = -sb;                                     // 이 집의 앞면 선
      if (sb > 0) { boxF(WM, -.02, .12, 0, hgt + .7, -sb - RC, 0); boxF(WM, len - .12, len + .02, 0, hgt + .7, -sb - RC, 0); }
      var usePhoto = PFB && R() < .42, top0 = sh;
      if (usePhoto) { var t = Math.floor(R() * NF), ph = Math.min(len / 1.2, 3.6 * 2 + sh, hgt - .5); face(PFB, .3, len - .3, 0, ph, F0 - RC + .02, tileUV(PF, t)); top0 = ph; }
      else face(SHOP[k % SHOP.length], .3, len - .3, 0, sh, F0 - RC + .02);
      // 1층: 양쪽 기둥 + 위 보(처마) + 처마 밑면
      boxF(WM, 0, .38, 0, top0, F0 - RC, F0 + .04); boxF(WM, len - .38, len, 0, top0, F0 - RC, F0 + .04);
      boxF(TRIM, 0, len, top0 - .38, top0 + .05, F0 - RC, F0 + .12);
      if (!usePhoto && len > 7.5) boxF(WM, len / 2 - .18, len / 2 + .18, 0, top0 - .38, F0 - RC, F0 - .1);
      // 위층
      var bays = Math.max(2, Math.round(len / 2.3)), bw = len / bays, fl0 = top0, nfl = Math.max(0, Math.floor((hgt - fl0) / 3.6 + .01)), WB = WIN[k % WIN.length];
      if (nfl > 0) {
        var ytop = fl0 + nfl * 3.6;
        if (style === 1) {          // 유리 커튼월 + 가는 세로살
          face(GLS, 0, len, fl0, ytop, F0 - .12, [0, 0, len / 3, nfl / 2]); face(WB, 0, len, fl0, ytop, F0 - .3, [0, 0, bays / 4, nfl / 6]);
          for (var m = 0; m <= bays * 2; m++) boxF(TRIM, m * bw / 2 - .04, m * bw / 2 + .04, fl0, ytop, F0 - .12, F0 + .06);
          for (var f2 = 0; f2 <= nfl; f2++) boxF(TRIM, 0, len, fl0 + f2 * 3.6 - .1, fl0 + f2 * 3.6 + .1, F0 - .12, F0 + .08);
        } else {
          face(WB, 0, len, fl0, ytop, F0 - .42, [0, 0, bays / 4, nfl / 6]);
          for (var f3 = 0; f3 < nfl; f3++) {            // 층마다 아랫벽(창턱) + 창 위 인방
            var yb = fl0 + f3 * 3.6; boxF(WM, 0, len, yb, yb + .95, F0 - .45, F0); boxF(WM, 0, len, yb + 3.6 * 5 / 6 - .05, yb + 3.6, F0 - .45, F0);
            boxF(TRIM, 0, len, yb + .9, yb + .98, F0 - .45, F0 + .1);
            if (style === 2 && f3 > 0) { boxF(TRIM, .2, len - .2, yb - .02, yb + .14, F0, F0 + .95); boxF(RAIL, .2, len - .2, yb + .14, yb + 1.05, F0 + .88, F0 + .93); }   // 발코니
          }
          for (var b5 = 0; b5 <= bays; b5++) { var bx = b5 * bw; boxF(WM, Math.max(0, bx - .2), Math.min(len, bx + .2), fl0, ytop, F0 - .45, F0 + (style === 3 && b5 % 2 ? .25 : 0)); }
          if (style === 3 && nfl > 2) { var bs = bw * Math.floor(bays / 2 - .5) + .3, be = bs + bw * 1.4; for (var f4 = 1; f4 < nfl; f4++) { var yb2 = fl0 + f4 * 3.6; boxF(WM, bs, be, yb2, yb2 + 1.0, F0, F0 + .7); face(WB, bs + .05, be - .05, yb2 + 1.0, yb2 + 3.0, F0 + .66, [.25, (f4 % 6) / 6, .5, (f4 % 6 + 1) / 6]); boxF(TRIM, bs - .05, be + .05, yb2 + 3.0, yb2 + 3.2, F0, F0 + .78); } }   // 내민 창(베이 윈도)
        }
        if (ytop < hgt) boxF(WM, 0, len, ytop, hgt, F0 - .45, F0);
      }
      // 옥상 난간 · 처마돌림
      boxF(TRIM, -.05, len + .05, hgt - .05, hgt + .2, F0 - .45, F0 + .3); boxF(WM, 0, len, hgt + .2, hgt + .9, F0 - .2, F0 + .05);
      if (R() < .5) boxF(ROOF, len * .3, len * .7, hgt, hgt + 1.6 + R() * 1.4, F0 - 5, F0 - 2.6);
      if (R() < .3) { var tx2 = len * (.2 + R() * .5); boxF(TANK, tx2, tx2 + 1.4, hgt, hgt + 1.8, F0 - 3.2, F0 - 1.8); }
      // 실외기
      for (var a2 = 0; a2 < floors && a2 < 6; a2++) if (R() < .22) { var ax = .6 + R() * (len - 1.6), ay = (top0 > sh ? top0 : sh) + a2 * 3.6 + .3; if (ay < hgt - 1) boxF(AC, ax, ax + .8, ay, ay + .55, F0 + .02, F0 + .45); }
      // 차양
      if (!usePhoto && R() < .4) { var aw = AWN[k % AWN.length]; var p0 = P(.3, sh - .4, F0 + .12), p1 = P(len - .3, sh - .4, F0 + .12), p2 = P(len - .3, sh - 1.0, F0 + 1.4), p3 = P(.3, sh - 1.0, F0 + 1.4); aw.quad(p3, p2, p1, p0, [0, 1, 0], 0, 0, Math.round(len / 1.2), 1); }
      // 가로 간판 (사진 또는 그림)
      if (R() < .65) { var hy = (usePhoto ? Math.min(top0 + .6, hgt - 2) : sh + .4 + R() * Math.max(0, hgt - sh - 3.2)), hh = 1.1 + R() * .8, wl = Math.min(len * .86, hh * 3.1);
        var sx0 = (len - wl) / 2; if (PHB && R() < .75) face(PHB, sx0, sx0 + wl, hy, hy + hh, F0 + .32, tileUV(PH, Math.floor(R() * NH))); else face(SIGNH[k % SIGNH.length], sx0, sx0 + wl, hy, hy + hh, F0 + .32);
        boxF(ROOF, sx0 - .05, sx0 + wl + .05, hy - .05, hy + hh + .05, F0 + .02, F0 + .31); }
      // 돌출 세로 간판 1~2개
      var nv = hgt > 9 ? 1 + (R() < .45 ? 1 : 0) : 0;
      for (var j = 0; j < nv; j++) {
        var at = len * (j === 0 ? .15 + R() * .12 : .7 + R() * .15), sy = (usePhoto ? top0 : sh) + .4 + R() * 2.2, shh = Math.min(3.2 + R() * 3.4, hgt - sy - .3), hw = shh / 4.2, photoV = PVB && R() < .78, B = photoV ? PVB : SIGNV[(k + j) % SIGNV.length], uv = photoV ? tileUV(PV, Math.floor(R() * NV)) : [0, 0, 1, 1];
        if (shh < 2) continue;
        var c0 = P(at, 0, F0 + .35), c1 = P(at, 0, F0 + .35 + hw * 2), ux = N[0], uz = N[1];
        // 양쪽 면 (거리 양 방향에서 보이게)
        B.quad([c0[0], sy, c0[2]], [c1[0], sy, c1[2]], [c1[0], sy + shh, c1[2]], [c0[0], sy + shh, c0[2]], [-U[0], 0, -U[1]], uv[0], uv[1], uv[2], uv[3]);
        B.quad([c1[0] + U[0] * .12, sy, c1[2] + U[1] * .12], [c0[0] + U[0] * .12, sy, c0[2] + U[1] * .12], [c0[0] + U[0] * .12, sy + shh, c0[2] + U[1] * .12], [c1[0] + U[0] * .12, sy + shh, c1[2] + U[1] * .12], [U[0], 0, U[1]], uv[0], uv[1], uv[2], uv[3]);
        boxF(ROOF, at - .02, at + .14, sy, sy + shh, F0 + .3, F0 + .35 + hw * 2 + .05, true);
        var mid = P(at + .06, 0, F0 + .35 + hw); C.lights.push([mid[0], sy + shh / 2, mid[2]]);
      }
      var fx = O[0] + U[0] * len / 2, fz = O[1] + U[1] * len / 2;
      pools.push([fx + N[0] * 2.4, fz + N[1] * 2.4, len, dir, HUES[k % HUES.length], usePhoto]);
    }
    /* v6: 블록 안쪽(길에서 안 보이던 어두운 곳)에 불 켜진 고층 건물 — 위로 솟아 밤 하늘을 채움 */
    var TOPS = [];
    function tower(ax, az, bx, bz) {
      var w = bx - ax, d = bz - az; if (w < 4 || d < 4 || G.q.notower) { ROOF.box(ax, 0, az, bx, 9, bz); return; }
      var nx = w > 26 ? 2 : 1, nz = d > 26 ? 2 : 1;
      for (var i = 0; i < nx; i++) for (var j = 0; j < nz; j++) {
        var x0 = ax + w * i / nx + 1, x1 = ax + w * (i + 1) / nx - 1, z0 = az + d * j / nz + 1, z1 = az + d * (j + 1) / nz - 1, hh = 22 + R() * R() * 55, WB = WIN[(id + i * 3 + j) % WIN.length];
        ROOF.box(x0, 0, z0, x1, hh, z1);
        var fl = hh / 3.6, ux = (x1 - x0) / 2.3 / 4, uz = (z1 - z0) / 2.3 / 4, e = .35;
        WB.quad([x0, 0, z1 + e], [x1, 0, z1 + e], [x1, hh, z1 + e], [x0, hh, z1 + e], [0, 0, 1], 0, 0, ux, fl / 6);
        WB.quad([x1, 0, z0 - e], [x0, 0, z0 - e], [x0, hh, z0 - e], [x1, hh, z0 - e], [0, 0, -1], 0, 0, ux, fl / 6);
        WB.quad([x1 + e, 0, z1], [x1 + e, 0, z0], [x1 + e, hh, z0], [x1 + e, hh, z1], [1, 0, 0], 0, 0, uz, fl / 6);
        WB.quad([x0 - e, 0, z0], [x0 - e, 0, z1], [x0 - e, hh, z1], [x0 - e, hh, z0], [-1, 0, 0], 0, 0, uz, fl / 6);
        TRIM.box(x0 - .2, hh, z0 - .2, x1 + .2, hh + .8, z1 + .2);
        if (R() < .45 && PHB) { var sw = Math.min(x1 - x0, 12) * .8, sx = (x0 + x1) / 2 - sw / 2, uv = tileUV(PH, Math.floor(R() * NH)); PHB.quad([sx, hh + 1, z1 + .3], [sx + sw, hh + 1, z1 + .3], [sx + sw, hh + 1 + sw / 3, z1 + .3], [sx, hh + 1 + sw / 3, z1 + .3], [0, 0, 1], uv[0], uv[1], uv[2], uv[3]); PHB.quad([sx + sw, hh + 1, z0 - .3], [sx, hh + 1, z0 - .3], [sx, hh + 1 + sw / 3, z0 - .3], [sx + sw, hh + 1 + sw / 3, z0 - .3], [0, 0, -1], uv[0], uv[1], uv[2], uv[3]); }
        TOPS.push([(x0 + x1) / 2, hh + 1.2, (z0 + z1) / 2]);
      }
    }
    for (var xi = 0; xi < xs.length - 1; xi++) for (var zi = 0; zi < zs.length - 1; zi++) {
      var x0 = xs[xi], x1 = xs[xi + 1], z0 = zs[zi], z1 = zs[zi + 1], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (C.inStreet(cx, cz)) continue;
      C.boxes.push({ x0: x0, z0: z0, x1: x1, z1: z1, bld: 1 });
      var D = Math.min(10, (x1 - x0) / 2 - .5, (z1 - z0) / 2 - .5), n, k2, a0, a1;
      function run(lo, hi, f) { var p = lo; while (p < hi - .5) { var l = Math.min(hi - p, 5.5 + R() * 4.5); if (hi - p - l < 3.5) l = hi - p; f(p, p + l); p += l; } }
      if (C.inStreet(x1 + 1, cz)) run(z0, z1, function (a, b) { lot(x1 - D, a, x1, b, 0); });
      if (C.inStreet(x0 - 1, cz)) run(z0, z1, function (a, b) { lot(x0, a, x0 + D, b, 1); });
      if (C.inStreet(cx, z1 + 1)) run(x0 + D, x1 - D, function (a, b) { lot(a, z1 - D, b, z1, 2); });
      if (C.inStreet(cx, z0 - 1)) run(x0 + D, x1 - D, function (a, b) { lot(a, z0, b, z0 + D, 3); });
      tower(x0 + D * .9, z0 + D * .9, x1 - D * .9, z1 - D * .9);
    }
    [ROOF, WALL, TRIM, AC, TANK, GLS, RAIL].concat(WALLS, SHOP, WIN, SIGNV, SIGNH, AWN, PVB ? [PVB] : [], PHB ? [PHB] : [], PFB ? [PFB] : []).forEach(function (b) { if (b.p.length) grp.add(b.mesh(b === ROOF || b === TRIM || WALLS.indexOf(b) >= 0)); });

    // 옥상 빨간 항공등
    var tl = new T.InstancedMesh(new T.SphereGeometry(.35, 6, 4), new T.MeshBasicMaterial({ color: new T.Color(4, .4, .3), toneMapped: false }), Math.max(1, TOPS.length)), mt = new T.Matrix4();
    TOPS.forEach(function (p, k) { mt.makeTranslation(p[0], p[1], p[2]); tl.setMatrixAt(k, mt); }); grp.add(tl);
    /* 지도 바깥: 멀리 보이는 고층 건물 숲 (그림 판) — 걸어갈 수는 없지만 어둡게 비던 곳을 채움 */
    var sky = G.canvasTex(2048, 512, function (g, w, h) {
      g.clearRect(0, 0, w, h); var r2 = G.rng(777);
      for (var layer = 0; layer < 3; layer++) {
        var x = -20; while (x < w) {
          var bw = 40 + r2() * 110, bh = h * (.25 + r2() * .6) * (1 - layer * .18), y0 = h - bh, sh = 18 + layer * 12;
          g.fillStyle = "rgb(" + sh + "," + (sh + 2) + "," + (sh + 10) + ")"; g.fillRect(x, y0, bw, bh);
          for (var yy = y0 + 8; yy < h - 6; yy += 9) for (var xx = x + 5; xx < x + bw - 6; xx += 8) if (r2() < .32) { var c = r2(); g.fillStyle = c < .7 ? "rgba(255,214,150," + (.35 + r2() * .5) + ")" : c < .85 ? "rgba(170,210,255,.55)" : "rgba(255,120,150,.5)"; g.fillRect(xx, yy, 4, 5); }
          if (layer === 2 && r2() < .25) { g.fillStyle = ["#ff4a6a", "#ffd23f", "#4ac0ff", "#9cff8a"][Math.floor(r2() * 4)]; g.fillRect(x + bw * .2, y0 - 14, bw * .6, 12); }
          if (r2() < .3) { g.fillStyle = "#ff3a2a"; g.fillRect(x + bw / 2 - 2, y0 - 4, 4, 4); }
          x += bw + r2() * 6;
        }
      }
    });
    var skm = new T.MeshBasicMaterial({ map: sky, transparent: true, toneMapped: false, color: new T.Color(.85, .85, .9), fog: false, depthWrite: false });
    [[0, -ZL - 60, 0, XL * 2 + 160], [0, ZL + 60, Math.PI, XL * 2 + 160], [-XL - 60, 0, Math.PI / 2, ZL * 2 + 160], [XL + 60, 0, -Math.PI / 2, ZL * 2 + 160]].forEach(function (q) {
      var m = new T.Mesh(new T.PlaneGeometry(q[3], q[3] / 4.5), skm); m.position.set(q[0], q[3] / 9 - 4, q[1]); m.rotation.y = q[2]; m.renderOrder = -1; grp.add(m); });
    /* 밤하늘: 위로 갈수록 짙어지는 하늘 + 별 */
    var dome = new T.SphereGeometry(380, 32, 16), dc = [], cTop = new T.Color(0x03050c), cHor = new T.Color(0x23202e), pa = dome.attributes.position;
    for (var di = 0; di < pa.count; di++) { var yv = Math.max(0, pa.getY(di) / 380), cc = cHor.clone().lerp(cTop, Math.pow(yv, .55)); dc.push(cc.r, cc.g, cc.b); }
    dome.setAttribute("color", new T.Float32BufferAttribute(dc, 3));
    var skyG = C.skyG = new T.Group(); G.scene.add(skyG); var domeM = new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); domeM.renderOrder = -3; skyG.add(domeM);
    var sp = [], scol = [], rs = G.rng(99);
    for (var si = 0; si < 1800; si++) { var th = rs() * 6.283, ph = Math.acos(1 - rs() * .92), rr = 360; sp.push(Math.sin(ph) * Math.cos(th) * rr, Math.cos(ph) * rr, Math.sin(ph) * Math.sin(th) * rr); var b = .45 + rs() * .55, tint = rs(); scol.push(b * (tint < .2 ? .8 : 1), b * (tint > .85 ? .85 : 1), b); }
    var sg = new T.BufferGeometry(); sg.setAttribute("position", new T.Float32BufferAttribute(sp, 3)); sg.setAttribute("color", new T.Float32BufferAttribute(scol, 3));
    var stars = new T.Points(sg, new T.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, opacity: .95, depthWrite: false, toneMapped: false })); stars.renderOrder = -2; skyG.add(stars); C.stars = stars;

    /* 바닥: 회색 보도블록 + 노란 페인트 표시 */
    var gt = G.canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = "#4a4844"; g.fillRect(0, 0, w, h);
      for (var y = 0; y < 16; y++) for (var x = 0; x < 9; x++) { var v = 92 + Math.floor(R() * 30), ox = (y % 2) * 32; g.fillStyle = "rgb(" + (v + 4) + "," + (v + 2) + "," + (v - 2) + ")"; g.fillRect(x * 64 + ox - 64 + 2, y * 32 + 2, 60, 28); g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(x * 64 + ox - 64 + 2, y * 32 + 2, 60, 2); }
      for (var k = 0; k < 1100; k++) { g.fillStyle = "rgba(0,0,0," + R() * .12 + ")"; g.fillRect(R() * w, R() * h, 2 + R() * 5, 2 + R() * 5); }
    }, { repeat: [1, 1] });
    var rt = G.canvasTex(256, 256, function (g, w, h) { g.fillStyle = "#b8b8b8"; g.fillRect(0, 0, w, h); for (var k = 0; k < 70; k++) { var x = R() * w, y = R() * h, r = 10 + R() * 40, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(30,30,30,.95)"); gr.addColorStop(1, "rgba(30,30,30,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }, { repeat: [1, 1] });
    rt.colorSpace = T.NoColorSpace;
    var gm = new T.MeshStandardMaterial({ map: gt, roughnessMap: rt, roughness: .9, metalness: 0, envMapIntensity: 1.2 });
    C.streets.forEach(function (s, k) {
      var w = s.x1 - s.x0, d = s.z1 - s.z0, g2 = new T.PlaneGeometry(w, d), uv = g2.attributes.uv; for (var j = 0; j < uv.count; j++) uv.setXY(j, (s.x0 + uv.getX(j) * w) / 4, (s.z0 + uv.getY(j) * d) / 4);
      var m = new T.Mesh(g2, gm); m.rotation.x = -Math.PI / 2; m.position.set((s.x0 + s.x1) / 2, k * .002, (s.z0 + s.z1) / 2); m.receiveShadow = true; grp.add(m);
    });
    // 노란 점자 블록 · 페인트 화살표 · 맨홀
    var yel = new T.MeshStandardMaterial({ color: 0xd6a92a, roughness: .7, emissive: 0x3a2a00, emissiveIntensity: .3 });
    [-1, 1].forEach(function (sd) { var ym = new T.Mesh(new T.PlaneGeometry(.4, ZL * 2), yel); ym.rotation.x = -Math.PI / 2; ym.position.set(sd * (MAIN_W / 2 - 1.1), .014, 0); grp.add(ym); });
    var paint = G.canvasTex(256, 256, function (g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = "rgba(240,200,40,.85)"; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w * .85, h * .45); g.lineTo(w * .62, h * .45); g.lineTo(w * .62, h - 10); g.lineTo(w * .38, h - 10); g.lineTo(w * .38, h * .45); g.lineTo(w * .15, h * .45); g.closePath(); g.fill(); for (var k = 0; k < 400; k++) { g.clearRect(R() * w, R() * h, 2 + R() * 6, 2 + R() * 4); } });
    var pmat = new T.MeshStandardMaterial({ map: paint, transparent: true, roughness: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), pmg = new T.PlaneGeometry(1.2, 1.6);
    for (i = 0; i < 40; i++) { var pz = -ZL + 6 + R() * (ZL * 2 - 12), px = (R() < .5 ? -1 : 1) * (3.2 + R() * 3.5); var pm2 = new T.Mesh(pmg, pmat); pm2.rotation.set(-Math.PI / 2, 0, R() < .5 ? 0 : Math.PI); pm2.position.set(px, .02, pz); grp.add(pm2); }
    var manM = new T.MeshStandardMaterial({ color: 0x2a2a28, roughness: .5, metalness: .6 }), manG = new T.CircleGeometry(.4, 20);
    for (i = 0; i < 18; i++) { var mh = new T.Mesh(manG, manM); mh.rotation.x = -Math.PI / 2; mh.position.set((R() - .5) * 12, .018, -ZL + R() * ZL * 2); grp.add(mh); }

    /* 바닥 빛 웅덩이 */
    var pg = new T.PlaneGeometry(1, 1), pm = new T.MeshBasicMaterial({ map: G.glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), pmesh = new T.InstancedMesh(pg, pm, pools.length), mm = new T.Matrix4(), qq = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)), col = new T.Color();
    pools.forEach(function (p, k) { var along = p[2] * 1.15, across = 7; mm.compose(new T.Vector3(p[0], .03 + (k % 7) * .001, p[1]), qq, p[3] < 2 ? new T.Vector3(across, along, 1) : new T.Vector3(along, across, 1)); pmesh.setMatrixAt(k, mm); col.setRGB(p[4][0] / 255, p[4][1] / 255, p[4][2] / 255).lerp(new T.Color(1, .85, .6), .55).multiplyScalar(p[5] ? .26 : .2); pmesh.setColorAt(k, col); });
    pmesh.renderOrder = 2; grp.add(pmesh);

    /* 노점: 큰길 한가운데 한 줄 (긴 쪽이 길과 나란히). 붙어 있다가, 띄엄띄엄 */
    var z = -ZL + 8, n2 = 0;
    while (z < ZL - 8) {
      var cl = 3 + Math.floor(R() * 4);
      for (var c3 = 0; c3 < cl && z < ZL - 8; c3++) {
        var L = 2.5 + R() * .7, near = AZ.some(function (a) { return Math.abs(z + L / 2 - a) < ALLEY_W / 2 + L / 2 + 1.2; });
        if (near) { z += ALLEY_W + 3; break; }
        C.stalls.push({ x: 0, z: z + L / 2, L: L, face: R() < .5 ? 1 : -1, i: C.stalls.length, var: Math.floor(R() * 12), sign: Math.floor(R() * 10) });
        z += L + .25 + R() * .6; n2++;
      }
      z += 3 + R() * 7;
    }
    // 사장님 체험용 노점: 0 근처에서 앞뒤로 6m 비워 둔 한 칸
    var best = null; C.stalls.forEach(function (s) { if (!best || Math.abs(s.z) < Math.abs(best.z)) best = s; });
    C.stalls = C.stalls.filter(function (s) { return s === best || Math.abs(s.z - best.z) > best.L / 2 + s.L / 2 + 5.5; });
    C.stalls.forEach(function (s, k) { s.i = k; }); best.L = 3.8; best.sign = 0; best.var = 0; C.playerStall = best.i;
    var MG = new Merger(), smx = new T.Matrix4();
    C.stalls.forEach(function (s, k) {
      var rot = s.face > 0 ? Math.PI / 2 : -Math.PI / 2;
      smx.compose(new T.Vector3(s.x, 0, s.z), new T.Quaternion().setFromEuler(new T.Euler(0, rot, 0)), new T.Vector3(1, 1, 1)); s.ry = rot;
      if (k === C.playerStall) { s.group = C.makeStall(s, false); grp.add(s.group); }
      else { var w0 = smx.clone(); stallParts(s, s.L, function (g, mat, m) { MG.add(g, mat, w0.clone().multiply(m)); }); }
      s.box = { x0: s.x - .78, z0: s.z - s.L / 2 - .05, x1: s.x + .78, z1: s.z + s.L / 2 + .05, stall: k }; C.boxes.push(s.box);
    });
    MG.flush(grp, true);

    /* 전구 감은 가로수 */
    var trunkM = new T.MeshStandardMaterial({ color: 0x2b2420, roughness: .95 }), tg = new T.CylinderGeometry(.13, .2, 1, 7), bg = new T.CylinderGeometry(.04, .08, 1, 5), TM = new Merger(), tb = [], tq = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    function limb(a, b, r, g) { var d = new T.Vector3().subVectors(b, a), l = d.length(); tq.setFromUnitVectors(up, d.normalize()); TM.add(g, trunkM, new T.Matrix4().compose(new T.Vector3().addVectors(a, b).multiplyScalar(.5), tq, new T.Vector3(r, l, r))); }
    for (var sd = -1; sd <= 1; sd += 2) for (z = -ZL + 10; z < ZL - 10; z += 15 + R() * 8) {
      if (AZ.some(function (a) { return Math.abs(z - a) < ALLEY_W / 2 + 2; })) continue;
      var tx = sd * (MAIN_W / 2 - .9), base = new T.Vector3(tx, 0, z), topv = new T.Vector3(tx + (R() - .5) * .4, 4 + R() * 1.2, z + (R() - .5) * .4);
      limb(base, topv, 1, tg); C.boxes.push({ x0: tx - .3, z0: z - .3, x1: tx + .3, z1: z + .3, tree: 1 });
      for (var b2 = 0; b2 < 6; b2++) { var an = R() * 6.28, a3 = topv.clone().add(new T.Vector3(0, -R() * 1.2, 0)), e3 = a3.clone().add(new T.Vector3(Math.cos(an) * (1.6 + R() * 1.6), 1 + R() * 2.2, Math.sin(an) * (1.6 + R() * 1.6)));
        if (Math.abs(e3.x) < MAIN_W / 2 - 3.2) e3.x = sd * (MAIN_W / 2 - 3.2) + (e3.x - sd * (MAIN_W / 2 - 3.2)) * .3;
        limb(a3, e3, 1, bg); for (var bb = 0; bb < 28; bb++) { var tt = R(), p = a3.clone().lerp(e3, tt); p.x += (R() - .5) * 1.4 * tt; p.y += (R() - .5) * 1.0 * tt; p.z += (R() - .5) * 1.4 * tt; tb.push(p); } }
    }
    TM.flush(grp, true);
    var tbm = new T.InstancedMesh(new T.SphereGeometry(.035, 5, 4), new T.MeshBasicMaterial({ color: new T.Color(3.6, 2.6, 1.3), toneMapped: false }), tb.length);
    tb.forEach(function (p, k) { mm.makeTranslation(p.x, p.y, p.z); tbm.setMatrixAt(k, mm); }); grp.add(tbm);

    /* 줄 전구: 골목 위를 가로지름 */
    var bulbG = new T.SphereGeometry(.07, 6, 5), bulbs = [], lines = [];
    function string(x0, y0, z0, x1, y1, z1, n) { for (var k = 0; k <= n; k++) { var t = k / n, sag = Math.sin(t * Math.PI) * .7; bulbs.push([G.lerp(x0, x1, t), G.lerp(y0, y1, t) - sag, G.lerp(z0, z1, t)]); if (k) { var q = bulbs[bulbs.length - 2], p = bulbs[bulbs.length - 1]; lines.push(q[0], q[1], q[2], p[0], p[1], p[2]); } } }
    AZ.forEach(function (z2) { for (var x = -XL + 6; x < XL - 4; x += 9) { if (Math.abs(x) < MAIN_W / 2 + 2 || SX.some(function (s2) { return Math.abs(x - s2) < SIDE_W / 2 + 2; })) continue; string(x, 5.2, z2 - ALLEY_W / 2, x + 2, 5.4, z2 + ALLEY_W / 2, 9); } });
    for (z = -ZL + 8; z < ZL - 8; z += 18) string(-MAIN_W / 2, 8, z, MAIN_W / 2, 8.3, z + 3, 18);
    var bm = new T.InstancedMesh(bulbG, new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.4, 1.2), toneMapped: false }), bulbs.length);
    bulbs.forEach(function (b, k) { mm.makeTranslation(b[0], b[1], b[2]); bm.setMatrixAt(k, mm); }); grp.add(bm);
    var lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(lines, 3)); grp.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x15140f })));

    /* STREET FOLD 를 세울 수 있는 자리: 골목 · 뒷길 벽 쪽 */
    AZ.forEach(function (z2) { [-80, -42, -24, 24, 42, 80].forEach(function (x, k) { var side = (k % 2 ? 1 : -1); C.sfSpots.push({ x: x, z: z2 + side * (ALLEY_W / 2 - .45), ry: side > 0 ? Math.PI : 0 }); }); });
    SX.forEach(function (x) { [-125, -88, -44, 0, 44, 88, 125].forEach(function (z2, k) { var side = (k % 2 ? 1 : -1); if (AZ.some(function (a) { return Math.abs(z2 - a) < ALLEY_W; })) z2 += 9; C.sfSpots.push({ x: x + side * (SIDE_W / 2 - .45), z: z2, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2 }); }); });

    /* 길 그물 */
    var nx = [SX[0], 0, SX[1]], nz = [-ZL + 3].concat(AZ, [ZL - 3]);
    nx.forEach(function (x, a) { nz.forEach(function (z2, b) { C.nodes.push({ x: x, z: z2, a: a, b: b, e: [] }); }); });
    function link(p, q, w) { C.edges.push({ a: p, b: q, w: w }); C.nodes[p].e.push(q); C.nodes[q].e.push(p); }
    for (var a4 = 0; a4 < 3; a4++) for (var b4 = 0; b4 < nz.length; b4++) { var me = a4 * nz.length + b4; if (b4 < nz.length - 1) link(me, me + 1, a4 === 1 ? MAIN_W : SIDE_W); if (a4 < 2 && b4 > 0 && b4 < nz.length - 1) link(me, me + nz.length, ALLEY_W); }

    /* 빛 */
    var sc = G.scene; sc.add(grp);
    sc.background = new T.Color(0x0b0d14); sc.fog = new T.FogExp2(0x17151c, .0095);
    sc.add(new T.HemisphereLight(0x7586b2, 0x4a3a26, 1.3));
    var moon = C.moon = new T.DirectionalLight(0xffdcb0, 1.2); moon.position.set(8, 22, 6); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -.0006; moon.shadow.normalBias = .03;
    var sc2 = moon.shadow.camera; sc2.left = -22; sc2.right = 22; sc2.top = 22; sc2.bottom = -22; sc2.near = 1; sc2.far = 70; sc.add(moon); sc.add(moon.target);
    // 가까운 노점 몇 곳에만 붙여 쓰는 진짜 빛
    C.pl = []; for (i = 0; i < 6; i++) { var l2 = new T.PointLight(0xffc27a, 0, 8, 1.8); sc.add(l2); C.pl.push(l2); }
    var es = new T.Scene(); es.add(new T.Mesh(new T.BoxGeometry(40, 24, 40), new T.MeshBasicMaterial({ color: 0x0b0c10, side: T.BackSide })));
    [[-19.9, 4, -6, 0xffb040, 2.6], [-19.9, 6, 8, 0xff5a70, 2], [19.9, 5, -3, 0x50b8ff, 2.2], [19.9, 4, 10, 0xfff0d0, 2.4], [0, 3, -19.9, 0xffd070, 2], [0, 5, 19.9, 0x8affb0, 1.2]].forEach(function (p) { var m = new T.Mesh(new T.PlaneGeometry(9, 5), new T.MeshBasicMaterial({ color: new T.Color(p[3]).multiplyScalar(p[4]), side: T.DoubleSide })); m.position.set(p[0], p[1], p[2]); m.lookAt(0, p[1], 0); es.add(m); });
    var fl = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshBasicMaterial({ color: 0x2a251c })); fl.rotation.x = -Math.PI / 2; fl.position.y = -1; es.add(fl);
    var pmr = new T.PMREMGenerator(G.r); sc.environment = pmr.fromScene(es, .04).texture; sc.environmentIntensity = .9;
  };
  /* 그림자 빛 · 노점 빛은 보는 곳을 따라다님 */
  var lastF = { x: 1e9, z: 1e9 };
  C.follow = function (x, z) {
    var m = C.moon; m.target.position.set(x, 0, z); m.position.set(x + 2.5, 30, z + 6);
    if (Math.abs(x - lastF.x) + Math.abs(z - lastF.z) < 2) return; lastF.x = x; lastF.z = z;
    var near = C.stalls.filter(function (s) { return !s.hidden; }).sort(function (a, b) { return Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z); });
    C.pl.forEach(function (l, k) { var s = near[k]; if (s && Math.hypot(s.x - x, s.z - z) < 40) { l.position.set(s.x + s.face * .9, 2.0, s.z); l.intensity = 6; } else l.intensity = 0; });
  };
  C.hideStall = function (k, on) { var s = C.stalls[k]; s.hidden = on; if (s.group) s.group.visible = !on; s.box.off = on; lastF.x = 1e9; };

  /* 노점 한 채 (group). detail = 사장님 체험용 (넓은 매대 · 화구 등은 vendor.js 가 올림) */
  C.makeStall = function (s, detail) {
    var g = new T.Group();
    var L = detail ? 3.8 : s.L;
    stallParts(detail ? { i: 0, var: 0, sign: 0 } : s, L, function (geo2, mat, m) { var o = new T.Mesh(geo2, mat); o.applyMatrix4(m); o.castShadow = !mat.transparent && mat !== SM.bulb; o.receiveShadow = true; g.add(o); }, detail);
    g.position.set(s.x, 0, s.z); g.rotation.y = s.ry != null ? s.ry : (s.face > 0 ? Math.PI / 2 : -Math.PI / 2);
    return g;
  };
})();
