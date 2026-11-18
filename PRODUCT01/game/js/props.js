/* 소품: 꼬치 · 트레이 · 청소 카트 · 쓰레기 · STREET FOLD · 가짜 목적지 · 빛기둥 */
(function () {
  "use strict";
  var G = window.G, T = G.T, P = G.props = {};
  function M(col, rough, metal, extra) { var m = new T.MeshStandardMaterial({ color: col, roughness: rough == null ? .7 : rough, metalness: metal || 0 }); if (extra) for (var k in extra) m[k] = extra[k]; return m; }
  function mesh(geo, mat, x, y, z, par, sh) { var o = new T.Mesh(geo, mat); o.position.set(x || 0, y || 0, z || 0); o.castShadow = sh !== false; o.receiveShadow = true; if (par) par.add(o); return o; }
  P.M = M; P.mesh = mesh;
  /* ---- 닭꼬치 (사진 질감을 입힌 덩어리 + 대파, 가운데 꼬챙이가 보이게) ---- type: 0 일반, 1 양념, 2 레전드 */
  P.TYPES = [{ key: "plain", name: "일반", done: [1.0, .86, .7] }, { key: "sauce", name: "양념", done: [.95, .42, .24] }, { key: "legend", name: "레전드", done: [.62, .3, .16] }];
  var FT = {}, tl = new T.TextureLoader();
  function ftex(k) { if (FT[k]) return FT[k]; var src = window.GM && GM.food && GM.food[k]; var t = src ? tl.load(src) : null; if (t) { t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; } return (FT[k] = t); }
  var CHUNK = [0, 1, 2].map(function (v) { var g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, r = G.rng(v * 91 + 5), vv = new T.Vector3(); var ph = [r() * 6, r() * 6, r() * 6];
    for (var i = 0; i < p.count; i++) { vv.fromBufferAttribute(p, i); var n = 1 + .16 * Math.sin(vv.x * 3.1 + ph[0]) * Math.sin(vv.y * 2.7 + ph[1]) + .1 * Math.sin(vv.z * 4.3 + ph[2]); vv.multiplyScalar(n); vv.y *= .78; p.setXYZ(i, vv.x, vv.y, vv.z); } g.computeVertexNormals(); return g; });
  var ONION = new T.CylinderGeometry(1, 1, 1, 14, 1), stickG = new T.CylinderGeometry(.0028, .0028, .36, 6), tipG = new T.ConeGeometry(.0028, .02, 6), stickM = M(0xd8bd86, .75), flakeG = new T.SphereGeometry(1, 4, 3), sesM = M(0xf4e6c0, .5), pepM = M(0xb8200e, .5);
  P.skewer = function (type) {
    var t = P.TYPES[type], g = new T.Group(), mats = [], big = type === 2 ? 1.22 : 1;
    var st = mesh(stickG, stickM, 0, 0, .02, g); st.rotation.x = Math.PI / 2; var tp = mesh(tipG, stickM, 0, 0, -.17, g); tp.rotation.x = -Math.PI / 2;
    var meatM = new T.MeshStandardMaterial({ map: ftex("texCooked"), roughness: type === 1 ? .32 : .55, metalness: 0 }), onM = new T.MeshStandardMaterial({ map: ftex("texOnion"), roughness: .45 });
    meatM.userData = { raw: new T.Color(1.2, .74, .72), done: new T.Color(t.done[0], t.done[1], t.done[2]) }; onM.userData = { raw: new T.Color(1.05, 1.15, 1.0), done: new T.Color(.95, .9, .6) }; mats.push(meatM, onM);
    var zs = [-.118, -.078, -.042, -.004, .034, .072], k = 0;
    zs.forEach(function (z, i) {
      var on = (i === 1 || i === 4) && type !== 2 || (type === 2 && i === 3);
      if (on) { var o = mesh(ONION, onM, 0, 0, z * big, g); o.rotation.x = Math.PI / 2; o.scale.set(.0105, .024, .0105); }
      else { var c = mesh(CHUNK[k % 3], meatM, (Math.random() - .5) * .003, (Math.random() - .5) * .003, z * big, g); c.scale.set(.017 * big, .015 * big, .016 * big); c.rotation.set(Math.random(), Math.random() * 6, Math.random()); k++; }
    });
    if (type !== 0) for (var f = 0; f < (type === 2 ? 22 : 12); f++) { var fl = mesh(flakeG, type === 2 && f % 2 ? pepM : sesM, (Math.random() - .5) * .028, .012 + Math.random() * .006, -.13 + Math.random() * .22, g, false); fl.scale.set(.0024, .0012, .0034); }
    // 양념: 은은한 붉은 빛 / 레전드: 금빛이 감돌고 반짝임
    var EM = [null, [new T.Color(.55, .07, .03), .55], [new T.Color(1, .62, .14), .75]][type], glow = null;
    if (EM) { meatM.emissive.copy(EM[0]); meatM.emissiveIntensity = EM[1]; }
    if (type === 1) { glow = G.glow(0xff3a20, .2, .55); glow.scale.set(.42, .12, 1); g.add(glow); }
    if (type === 2) { glow = G.glow(0xffc040, .26, 1.0); glow.scale.set(.5, .18, 1); g.add(glow);
      for (var sp = 0; sp < 5; sp++) { var s3 = G.glow(0xfff0b0, .03, 1.6); s3.position.set((Math.random() - .5) * .05, .02 + Math.random() * .03, -.12 + Math.random() * .24); s3.userData.ph = Math.random() * 6; g.add(s3); (g.spark || (g.spark = [])).push(s3); } }
    if (glow) { glow.position.y = .006; glow.userData.base = glow.material.color.clone(); glow.onBeforeRender = function () { var k = type === 2 ? .7 + Math.sin(G.t * 3.2 + g.id) * .3 : .85 + Math.sin(G.t * 1.6 + g.id) * .15; glow.material.color.copy(glow.userData.base).multiplyScalar(k * (g.glowK == null ? 1 : g.glowK)); if (g.spark) g.spark.forEach(function (q) { var w = Math.max(0, Math.sin(G.t * 4 + q.userData.ph)); q.scale.setScalar(.012 + w * .03); }); }; }
    g.userData = { type: type, mats: mats };
    g.setCook = function (c, burnt) { mats.forEach(function (m) { m.color.copy(m.userData.raw).lerp(m.userData.done, G.clamp(c, 0, 1)); if (burnt) m.color.lerp(BURNT, burnt); }); var k = (.55 + .45 * G.clamp(c, 0, 1)) * (1 - (burnt || 0)); if (EM) meatM.emissiveIntensity = EM[1] * k; g.glowK = k; };
    g.setCook(0, 0); return g;
  };
  var BURNT = new T.Color(.08, .06, .05);
  /* 포장 트레이: 길쭉한 종이 배 모양 */
  P.tray = function () {
    var g = new T.Group(), m = M(0xf6f3ea, .85, 0, { side: T.DoubleSide }), L = .36, W = .085, H = .022;
    mesh(new T.BoxGeometry(L - .04, .003, W), m, 0, .0015, 0, g);
    [-1, 1].forEach(function (s) { var w = mesh(new T.PlaneGeometry(L - .04, H * 1.15), m, 0, H / 2, s * (W / 2 + .004), g); w.rotation.x = s * .22; });
    [-1, 1].forEach(function (s) { var e = mesh(new T.PlaneGeometry(W + .01, H * 2.1), m, s * (L / 2 - .005), H * .9, 0, g); e.rotation.set(0, Math.PI / 2, s * .95); e.rotation.order = "YXZ"; e.rotation.set(-s * .85, Math.PI / 2, 0); });
    g.userData.L = L; g.userData.W = W; return g;
  };
  /* ---- FOLD MARK 스티커 (트레이 인쇄 띠): 테이블 번호 · 가는 길 · 도착 시각 · QR ---- */
  var LANGS = {
    EN: { yt: "Your table", l1: "Stall at your back,", l2: "go left", p1: "① Pharmacy", p1s: "keep straight", p2: "② Café corner", p2s: "turn left", st: "Stall", walk: "1 min walk", arr: "Arrive", valid: "Valid until", route: "On your route", dest: "toward Myeongdong Stn.", tap: "Tap at the table" },
    JA: { yt: "あなたのテーブル", l1: "屋台を背にして", l2: "右へ", p1: "① ドラッグストア", p1s: "を過ぎて直進", p2: "② カフェの角", p2s: "を右へ", st: "屋台", walk: "徒歩 2分", arr: "到着", valid: "まで有効", route: "食べたあとに", dest: "雑貨店まで 徒歩1分", tap: "テーブルにかざす" },
    KO: { yt: "내 테이블", l1: "노점을 등지고", l2: "왼쪽으로", p1: "① 약국", p1s: "지나서 직진", p2: "② 카페 모퉁이", p2s: "에서 좌회전", st: "노점", walk: "걸어서 1분", arr: "도착", valid: "까지 유효", route: "가는 길에", dest: "명동역 방향", tap: "테이블에 대 주세요" },
    ZH: { yt: "您的餐桌", l1: "背对摊位,", l2: "向左走", p1: "① 药店", p1s: "直行", p2: "② 咖啡店拐角", p2s: "左转", st: "摊位", walk: "步行 1 分钟", arr: "到达", valid: "前有效", route: "沿途", dest: "往明洞站方向", tap: "在餐桌上扫码" }
  };
  P.LANG_KEYS = ["EN", "JA", "KO", "ZH"];
  P.stickerTex = function (lang, no, hm) {
    var L = LANGS[lang] || LANGS.EN, F = G.FONT;
    return G.canvasTex(1120, 224, function (c, w, h) {
      c.fillStyle = "#fbfaf6"; c.fillRect(0, 0, w, h); c.strokeStyle = "#d9d6cc"; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
      c.strokeStyle = "#e6bf5a"; c.lineWidth = 4; rr(c, 28, 20, 164, 184, 14); c.stroke();
      function dome(x, y, s) { c.fillStyle = "#e6bf5a"; c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.fill(); c.fillStyle = "#2a2a26"; c.fillRect(x - s * 1.2, y, s * 2.4, s * .35); }
      dome(110, 52, 15); c.fillStyle = "#444"; c.font = "500 15px " + F; c.textAlign = "center"; c.fillText(L.yt, 110, 78);
      c.fillStyle = "#222"; c.font = "800 92px " + F; c.fillText(("0" + no).slice(-2), 110, 172);
      c.textAlign = "left"; c.font = "600 15px " + F; c.fillText(L.l1, 228, 58); c.font = "800 17px " + F; c.fillText(L.l2, 228, 80);
      c.textAlign = "center"; c.font = "700 15px " + F; c.fillText(L.p1, 421, 58); c.fillText(L.p2, 575, 58); c.font = "500 13px " + F; c.fillStyle = "#666"; c.fillText(L.p1s, 421, 77); c.fillText(L.p2s, 575, 77);
      c.strokeStyle = "#2a2a26"; c.lineWidth = 6; c.beginPath(); c.moveTo(240, 120); c.lineTo(650, 120); c.stroke();
      c.fillStyle = "#fff"; c.lineWidth = 4; c.beginPath(); c.arc(240, 120, 7, 0, 7); c.fill(); c.stroke(); c.fillRect(408, 106, 26, 26); c.strokeRect(408, 106, 26, 26); c.fillStyle = "#222"; c.font = "700 12px " + F; c.fillText("1", 421, 124);
      c.fillStyle = "#fff"; c.beginPath(); c.arc(566, 120, 15, 0, 7); c.fill(); c.stroke(); c.fillStyle = "#222"; c.font = "800 16px " + F; c.fillText(lang === "JA" ? "↱" : "↰", 566, 126);
      dome(674, 116, 18); c.fillStyle = "#333"; c.font = "500 16px " + F; c.textAlign = "left"; c.fillText(L.st, 228, 157); c.textAlign = "center"; c.fillStyle = "#777"; c.fillText(L.walk, 492, 157); c.fillStyle = "#222"; c.font = "800 18px " + F; c.fillText(("0" + no).slice(-2), 674, 160);
      c.textAlign = "left"; c.fillStyle = "#666"; c.font = "500 15px " + F; c.fillText(L.arr, 737, 72); c.fillStyle = "#222"; c.font = "800 38px " + F; c.fillText(hm[0], lang === "EN" ? 796 : 778, 72);
      c.font = "500 14px " + F; c.fillText(lang === "EN" ? L.valid + " " + hm[1] : hm[1] + " " + L.valid, 737, 104); c.strokeStyle = "#ddd"; c.lineWidth = 1; c.beginPath(); c.moveTo(737, 124); c.lineTo(927, 124); c.stroke();
      c.fillStyle = "#777"; c.fillText(L.route, 737, 148); c.fillStyle = "#222"; c.font = "700 16px " + F; c.fillText(L.dest, 737, 176, 190);
      var r = G.rng(no * 7 + 3), qx = 958, qy = 30, u = 6; c.fillStyle = "#222"; for (var a = 0; a < 21; a++) for (var b = 0; b < 21; b++) if (r() < .5) c.fillRect(qx + a * u, qy + b * u, u, u);
      [[0, 0], [14, 0], [0, 14]].forEach(function (f) { c.fillStyle = "#fbfaf6"; c.fillRect(qx + f[0] * u - 2, qy + f[1] * u - 2, 7 * u + 4, 7 * u + 4); c.fillStyle = "#222"; c.fillRect(qx + f[0] * u, qy + f[1] * u, 7 * u, 7 * u); c.fillStyle = "#fbfaf6"; c.fillRect(qx + (f[0] + 1) * u, qy + (f[1] + 1) * u, 5 * u, 5 * u); c.fillStyle = "#222"; c.fillRect(qx + (f[0] + 2) * u, qy + (f[1] + 2) * u, 3 * u, 3 * u); });
      c.font = "500 14px " + F; c.textAlign = "center"; c.fillText(L.tap, 1022, 185);
    });
  };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  P.sticker = function (lang, no, hm) { var m = new T.Mesh(new T.PlaneGeometry(.3, .06), new T.MeshStandardMaterial({ map: P.stickerTex(lang, no, hm), roughness: .6, side: T.DoubleSide, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 })); m.userData = { lang: lang, no: no }; return m; };
  /* ---- 전동 청소차 (걸으며 미는 초록 전동 수거차) ---- */
  P.cart = function () {
    var g = new T.Group(), body = M(0x3fae4a, .42, .1), white = M(0xf2f2ee, .5), dark = M(0x151614, .6), steel = M(0x9da09c, .35, .8), glassM = M(0x223040, .1, .2), amber = new T.MeshBasicMaterial({ color: new T.Color(3, 1.6, .3), toneMapped: false }), head = new T.MeshBasicMaterial({ color: new T.Color(3, 3, 2.6), toneMapped: false });
    mesh(new T.BoxGeometry(.86, .78, 1.22), body, 0, .62, .12, g);                       // 몸통
    mesh(new T.BoxGeometry(.9, .12, 1.26), white, 0, 1.06, .12, g);                       // 흰 뚜껑
    mesh(new T.BoxGeometry(.7, .04, 1.0), dark, 0, 1.13, .12, g);
    mesh(new T.BoxGeometry(.9, .14, .1), dark, 0, .26, .76, g); mesh(new T.BoxGeometry(.9, .14, .1), dark, 0, .26, -.52, g);   // 범퍼
    for (var k = 0; k < 6; k++) mesh(new T.BoxGeometry(.02, .3, .02), dark, -.25 + k * .1, .62, .735, g, false);                 // 앞 통풍구
    [-1, 1].forEach(function (s) { var l = mesh(new T.CircleGeometry(.05, 14), head, s * .3, .86, .735, g, false); });
    [[-1, .5], [1, .5], [-1, -.3], [1, -.3]].forEach(function (p) { var w = mesh(new T.CylinderGeometry(.17, .17, .1, 18), dark, p[0] * .42, .17, p[1], g); w.rotation.z = Math.PI / 2; w.name = "wheel"; var h = mesh(new T.CylinderGeometry(.08, .08, .11, 10), steel, p[0] * .42, .17, p[1], g); h.rotation.z = Math.PI / 2; });
    // 뒤쪽 손잡이 + 조작판(화면)
    [-1, 1].forEach(function (s) { var b = mesh(new T.CylinderGeometry(.018, .018, .6, 8), steel, s * .3, 1.0, -.72, g); b.rotation.x = -.7; });
    var hb = mesh(new T.CylinderGeometry(.022, .022, .7, 8), dark, 0, 1.22, -.92, g); hb.rotation.z = Math.PI / 2;
    mesh(new T.BoxGeometry(.3, .16, .05), dark, 0, 1.18, -.55, g); mesh(new T.PlaneGeometry(.24, .1), new T.MeshBasicMaterial({ color: new T.Color(.3, 1.4, 1.1), toneMapped: false }), 0, 1.18, -.577, g, false).rotation.y = Math.PI;
    // 경광등
    mesh(new T.CylinderGeometry(.05, .06, .04, 12), dark, .3, 1.2, .55, g); g.beacon = mesh(new T.CylinderGeometry(.045, .05, .08, 12), amber, .3, 1.26, .55, g, false);
    var tx = G.canvasTex(512, 256, function (c, w, h) { c.fillStyle = "#3fae4a"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.font = "800 70px " + G.FONT; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText("중구 클린", 34, h * .36); c.font = "600 32px " + G.FONT; c.fillText("MYEONGDONG CLEAN · 전동 수거차", 36, h * .66); c.fillStyle = "#2a8a36"; c.fillRect(0, h - 26, w, 26); });
    [-1, 1].forEach(function (s) { var p = mesh(new T.PlaneGeometry(1.0, .48), new T.MeshStandardMaterial({ map: tx, roughness: .5 }), s * .432, .66, .12, g, false); p.rotation.y = s * Math.PI / 2; });
    g.load = new T.Group(); g.load.position.set(0, 1.15, .12); g.add(g.load);
    return g;
  };
  /* ---- 쓰레기 ---- */
  var TG = [new T.IcosahedronGeometry(.07, 0), new T.CylinderGeometry(.033, .033, .12, 10), new T.CylinderGeometry(.045, .032, .13, 10), new T.SphereGeometry(.11, 8, 6), new T.BoxGeometry(.16, .035, .11)];
  var TM = [M(0xe8e4d8, .9), M(0xc8281e, .35, .6), M(0xd9c7a0, .8), M(0x23262a, .5), M(0xb98a52, .85)];
  P.trash = function (k) { k = k == null ? Math.floor(Math.random() * 5) : k % 5; var o = mesh(TG[k], TM[k]); o.userData.kind = k; if (k === 1) o.rotation.z = Math.PI / 2; if (k === 3) o.scale.y = .7; o.position.y = [.06, .034, .065, .075, .02][k]; o.rotation.y = Math.random() * 6; return o; };
  /* ---- STREET FOLD (실제 모델) ---- */
  var sfTpl = null, sfWait = [];
  function fix(o) { o.traverse(function (c) { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; var m = c.material; if (m && m.transmission) { m = c.material = m.clone(); m.transmission = 0; m.transparent = true; m.opacity = .45; m.depthWrite = false; } } }); }
  P.streetfold = function (cb) {
    if (sfTpl) return cb(wrap(sfTpl.clone(true)));
    sfWait.push(cb); if (sfWait.length > 1) return;
    G.loadGLB("streetfold", function (sc) { fix(sc); var b = new T.Box3().setFromObject(sc), s = new T.Vector3(); b.getSize(s); var c = new T.Vector3(); b.getCenter(c); sc.position.set(-c.x, -b.min.y, -c.z); sfTpl = new T.Group(); sfTpl.add(sc); sfTpl.userData.size = s; sfWait.forEach(function (f) { f(wrap(sfTpl.clone(true))); }); sfWait = []; });
  };
  function wrap(o) { var g = new T.Group(); g.add(o); g.userData.size = sfTpl.userData.size; return g; }
  P.foldmark = function (cb) { G.loadGLB("foldmark", function (sc) { fix(sc); var b = new T.Box3().setFromObject(sc), s = new T.Vector3(); b.getSize(s); var c = new T.Vector3(); b.getCenter(c); sc.position.set(-c.x, -b.min.y, -c.z); var g = new T.Group(); g.add(sc); g.userData.size = s; cb(g); }); };
  /* ---- 가짜 목적지 ---- */
  P.decoy = function (k) {
    var g = new T.Group(), t;
    if (k % 4 === 0) { t = G.canvasTex(256, 512, function (c, w, h) { c.fillStyle = "#c8281e"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.fillRect(20, 30, w - 40, h * .5); for (var i = 0; i < 12; i++) { c.fillStyle = ["#e33", "#2a6", "#36c", "#fa0"][i % 4]; c.fillRect(34 + (i % 4) * 50, 50 + Math.floor(i / 4) * 80, 34, 60); } c.fillStyle = "#fff"; c.font = "800 40px " + G.FONT; c.textAlign = "center"; c.fillText("DRINK", w / 2, h * .72); });
      mesh(new T.BoxGeometry(.9, 1.85, .7), M(0xa8201a, .5), 0, .925, 0, g); var f = mesh(new T.PlaneGeometry(.86, 1.8), new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .9 }), 0, .925, .352, g, false); }
    else if (k % 4 === 1) { mesh(new T.CylinderGeometry(.28, .24, .9, 14), M(0x3a3f44, .5, .5), 0, .45, 0, g); mesh(new T.CylinderGeometry(.3, .3, .06, 14), M(0x1c1e20, .5), 0, .93, 0, g); }
    else if (k % 4 === 2) { t = G.canvasTex(256, 256, function (c, w, h) { c.fillStyle = "#0d3b8c"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.font = "800 70px " + G.FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ATM", w / 2, h / 2); });
      mesh(new T.BoxGeometry(1.0, 2.1, .8), M(0xd8dbe0, .5), 0, 1.05, 0, g); mesh(new T.PlaneGeometry(.9, .5), new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.1 }), 0, 1.75, .402, g, false); mesh(new T.BoxGeometry(.6, .5, .1), M(0x20242a, .3), 0, 1.15, .4, g); }
    else { mesh(new T.BoxGeometry(.6, 1.1, .45), M(0x2b6a3a, .6), 0, .55, 0, g); mesh(new T.BoxGeometry(.6, 1.1, .45), M(0x2a4f8a, .6), .65, .55, 0, g); mesh(new T.BoxGeometry(1.3, .04, .5), M(0x1a1c1e, .6), .325, 1.12, 0, g); }
    return g;
  };
  /* ---- 멀리서도 보이는 빛기둥 ---- */
  var beamTex = G.canvasTex(8, 128, function (c, w, h) { var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(255,255,255,1)"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
  P.beam = function (col, h, r) { var m = new T.Mesh(new T.CylinderGeometry(r || .5, r || .5, h || 14, 16, 1, true), new T.MeshBasicMaterial({ map: beamTex, color: new T.Color(col).multiplyScalar(1.4), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false, opacity: .55 })); m.position.y = (h || 14) / 2; m.renderOrder = 5; return m; };
  /* 글자 팻말 (공중에 뜨는 표시) */
  P.label = function (txt, col, w) { var t = G.canvasTex(512, 128, function (c, W, H) { c.fillStyle = col || "#FFD23F"; var r = 28; c.beginPath(); c.moveTo(r, 4); c.arcTo(W - 4, 4, W - 4, H - 4, r); c.arcTo(W - 4, H - 4, 4, H - 4, r); c.arcTo(4, H - 4, 4, 4, r); c.arcTo(4, 4, W - 4, 4, r); c.fill(); c.fillStyle = "#14130f"; c.font = "800 62px " + G.FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, W / 2, H / 2 + 4, W - 40); });
    var s = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false })); s.scale.set(w || 1.6, (w || 1.6) / 4, 1); s.renderOrder = 30; return s; };
})();
