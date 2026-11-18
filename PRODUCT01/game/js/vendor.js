/* 체험 1 — 사장님 (1인칭 · 5분) */
(function () {
  "use strict";
  var G = window.G, T = G.T, C = G.city, K = G.crowd, U = G.ui, PR = G.props;
  var S, ray = new T.Raycaster(), V2 = new T.Vector2(0, 0), tv = new T.Vector3();
  var TY = PR.TYPES, GX = .3, SLOTX = [-.2, .05, .3, .55, .8], CX = [-1.15, 0, 1.15], GY = 1.05, BINX = -.72, TRAYX = 1.32, FMX = 1.68;
  var LANG = PR.LANG_KEYS.map(function (k) { return [k]; });
  var g = G.games.vendor = {
    id: "vendor", time: 180, cross: true, lock: true, fov: 64, eyebrow: "체험 01 · 사장님", title: "3분 동안 닭꼬치 장사",
    goal: "지나가던 사람이 손님이 되어 찾아옵니다. 주문을 받고, 굽고, FOLD MARK 스티커를 붙여 건네세요.",
    keys: [["마우스", "둘러보기 · 가운데 점으로 겨냥해서 클릭"], ["1 ~ 5", "화구 칸의 꼬치 뒤집기 · 꺼내기 · 탄 것 버리기"], ["Space", "스티커를 트레이에 붙여 손님에게 건네기"]],
    rules: ["손님의 <b>주문서를 클릭</b>하면 접수되고 1분 타이머가 시작됩니다", "왼쪽 통(일반 · 양념 · 레전드)을 클릭하면 화구에 올라갑니다", "한 면에 10초. 게이지가 차면 숫자키로 뒤집고, 한 번 더 익으면 숫자키로 트레이에. <b>10초 안에 안 누르면 탑니다</b>", "오른쪽 끝의 <b>FOLD MARK를 클릭</b>해 스티커(테이블 번호 · 가는 길)를 뽑고 <b>Space</b>로 건넵니다", "많이 주문한 손님일수록 점수가 큽니다. 덜 주면 감점, 놓치면 더 큰 감점"]
  };
  function icon(c, x, y, len, type) {     // 꼬치 그림 하나
    c.strokeStyle = "#b8935a"; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + len); c.stroke();
    var col = ["#d9a55a", "#b53a1e", "#5a2a12"][type], n = 4, h = len * .16;
    for (var i = 0; i < n; i++) { c.fillStyle = col; rr(c, x - 9, y + 4 + i * (h + 3), 18, h, 4); c.fill(); if (type === 1) { c.fillStyle = "rgba(255,200,120,.5)"; c.fillRect(x - 6, y + 6 + i * (h + 3), 5, 3); } if (type === 2) { c.fillStyle = "#ffd866"; c.beginPath(); c.arc(x + 3, y + 8 + i * (h + 3), 2.2, 0, 7); c.fill(); c.beginPath(); c.arc(x - 4, y + 13 + i * (h + 3), 1.8, 0, 7); c.fill(); } }
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function orderTex(o, lang, no) {
    return G.canvasTex(300, 400, function (c, w, h) {
      c.fillStyle = "#fbf7ea"; c.fillRect(0, 0, w, h); c.fillStyle = "#FFD23F"; c.fillRect(0, 0, w, 62); c.fillStyle = "#14130f"; c.font = "800 34px " + G.FONT; c.textBaseline = "middle"; c.textAlign = "left"; c.fillText("주문 " + no, 18, 33); c.textAlign = "right"; c.font = "700 24px " + G.FONT; c.fillText(lang, w - 16, 34);
      var rows = [0, 1, 2].filter(function (t) { return o[t] > 0; }), rh = (h - 82) / Math.max(rows.length, 1); rows.forEach(function (t, r) { var y = 76 + r * rh, L = Math.min(rh - 34, 96);
        for (var k = 0; k < o[t]; k++) icon(c, 34 + k * 40, y, L, t);
        c.fillStyle = "#14130f"; c.textAlign = "right"; c.font = "800 44px " + G.FONT; c.fillText("×" + o[t], w - 16, y + L / 2); c.textAlign = "left"; c.font = "700 22px " + G.FONT; c.fillStyle = "#6b6657"; c.fillText(TY[t].name, 20, y + L + 16); });
      c.strokeStyle = "#14130f"; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    });
  }
  function textPlane(txt, w, h, bg, fg, fs) { var t = G.canvasTex(256, Math.round(256 * h / w), function (c, W, H) { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = "800 " + (fs || H * .7) + "px " + G.FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, W / 2, H / 2 + 2, W - 10); }); return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, toneMapped: false })); }
  function toast(t, k) { U.toast(t, k); }

  g.start = function () {
    var st = C.stalls[C.playerStall];
    S = { st: st, score: 0, max: 0, served: 0, perfect: 0, lost: 0, yaw: 0, pitch: -.38, hot: [], slots: [], tray: [], cust: [null, null, null], nextT: 2.5, no: 0, sticker: null, sel: null, smoke: [], smT: 0, bodies: [], printT: 0, fly: [] };
    if (st.group) st.group.visible = false;
    var SG = S.SG = C.makeStall(st, true); G.scene.add(SG); SG.updateMatrixWorld(true);
    var V = S.V = new T.Group(); V.rotation.y = Math.PI; V.position.set(0, 0, -1.0); SG.add(V);
    var steel = PR.M(0x8f918e, .35, .8), dark = PR.M(0x161614, .7);
    // 화구 (넓게)
    PR.mesh(new T.BoxGeometry(1.32, .1, .5), dark, GX, .98, -.95, V); var coal = PR.mesh(new T.PlaneGeometry(1.24, .4), new T.MeshBasicMaterial({ color: new T.Color(2.6, .7, .12), toneMapped: false, map: G.canvasTex(256, 64, function (c, w, h) { c.fillStyle = "#3a1204"; c.fillRect(0, 0, w, h); for (var i = 0; i < 300; i++) { c.fillStyle = "rgba(255," + Math.floor(120 + Math.random() * 120) + ",40," + Math.random() * .9 + ")"; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 7); c.fill(); } }) }), GX, 1.022, -.95, V, false); coal.rotation.x = -Math.PI / 2; S.coal = coal;
    for (var i = 0; i < 12; i++) PR.mesh(new T.BoxGeometry(1.26, .007, .007), steel, GX, 1.036, -1.17 + i * .04, V, false);   // 석쇠: 꼬치와 직각으로
    PR.mesh(new T.BoxGeometry(1.34, .05, .02), steel, GX, 1.05, -.7, V); PR.mesh(new T.BoxGeometry(1.34, .05, .02), steel, GX, 1.05, -1.2, V); [-1, 1].forEach(function (sd) { PR.mesh(new T.BoxGeometry(.02, .05, .52), steel, GX + sd * .66, 1.05, -.95, V); });
    for (i = 0; i < 4; i++) { var kn = PR.mesh(new T.CylinderGeometry(.018, .018, .02, 10), PR.M(0xc8281e, .4), GX - .5 + i * .33, .96, -.69, V); kn.rotation.x = Math.PI / 2; }
    var gl = new T.PointLight(0xff7a2a, .9, 2.2, 2); gl.position.set(GX, 1.25, -.95); V.add(gl);
    SLOTX.forEach(function (x, i) {
      var lab = textPlane(String(i + 1), .1, .08, "#14130f", "#FFD23F"); lab.rotation.x = -Math.PI / 2; lab.position.set(x, .962, -.6); V.add(lab);
      var bg = PR.mesh(new T.PlaneGeometry(.18, .034), new T.MeshBasicMaterial({ color: 0x2a2a26, toneMapped: false }), x, .962, -.665, V, false); bg.rotation.x = -Math.PI / 2;
      var fill = PR.mesh(new T.PlaneGeometry(.18, .034), new T.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }), x, .964, -.665, V, false); fill.rotation.x = -Math.PI / 2; fill.scale.x = .001;
      var hit = PR.mesh(new T.BoxGeometry(.22, .1, .5), new T.MeshBasicMaterial({ visible: false }), x, 1.06, -.95, V, false); hit.userData.act = function () { slotKey(i); }; S.hot.push(hit);
      S.slots.push({ i: i, x: x, sk: null, st: 0, g: 0, burn: 0, fill: fill, lab: lab, half: .09 });
    });
    // 생꼬치 통 3개 (왼쪽)
    [0, 1, 2].forEach(function (t) { var z = -.5 - t * .33, b = new T.Group(); b.position.set(BINX - t * .06, .96 + t * .07, z); b.rotation.x = .28; V.add(b);    // 계단식, 사장님 쪽으로 기울임
      PR.mesh(new T.BoxGeometry(.42, .05, .3), steel, 0, 0, 0, b); PR.mesh(new T.BoxGeometry(.42, .06, .01), steel, 0, .03, .15, b); PR.mesh(new T.BoxGeometry(.42, .06, .01), steel, 0, .03, -.15, b);
      if (t) PR.mesh(new T.BoxGeometry(.42, .07 * t + .02, .3), dark, 0, -.035 * t - .03, 0, b);
      for (var k = 0; k < 6; k++) { var s2 = PR.skewer(t); s2.rotation.y = Math.PI / 2 + (Math.random() - .5) * .12; s2.position.set(.01, .035 + (k > 2 ? .03 : 0), -.1 + (k % 3) * .075 + (k > 2 ? .035 : 0)); b.add(s2); }
      var l = textPlane(TY[t].name, .2, .08, ["#d9a55a", "#c8281e", "#2a1608"][t], t === 2 ? "#FFD23F" : t === 0 ? "#14130f" : "#fff"); l.position.set(-.27, .1, 0); l.rotation.set(-.28, Math.PI / 2, 0); b.add(l);
      var tag = textPlane(TY[t].name, .16, .06, ["#d9a55a", "#c8281e", "#2a1608"][t], t === 2 ? "#FFD23F" : t === 0 ? "#14130f" : "#fff"); tag.position.set(0, .035, .16); tag.rotation.x = -.6; b.add(tag);
      if (t === 2) { var halo = G.glow(0xffc040, .55, 1.1); halo.position.set(0, .07, 0); b.add(halo); S.halo = halo; }
      var hit = PR.mesh(new T.BoxGeometry(.46, .2, .32), new T.MeshBasicMaterial({ visible: false }), 0, .05, 0, b, false); hit.userData.act = function () { bin(t); }; S.hot.push(hit); });
    newTray();
    // FOLD MARK (오른쪽 끝, 매대 위)
    var tb = new T.Group(); tb.position.set(FMX, .92, -.55); V.add(tb); S.fmG = tb;
    var fl = PR.label("FOLD MARK", "#FFD23F", .5); fl.position.set(0, .62, 0); tb.add(fl);
    var hit = PR.mesh(new T.BoxGeometry(.42, .5, .42), new T.MeshBasicMaterial({ visible: false }), 0, .2, 0, tb, false); hit.userData.act = printSticker; S.hot.push(hit);
    PR.foldmark(function (m) { var s = m.userData.size, k = .34 / Math.max(s.x, s.y, s.z); m.scale.setScalar(k); m.rotation.y = -Math.PI / 2; tb.add(m); S.fm = m; });
    var fpl = new T.PointLight(0xfff0c8, 1.0, 1.8, 2); fpl.position.set(-.2, .6, .1); tb.add(fpl);
    // 매대 소품: 소스통 · 집게 · 냅킨 · 장갑 상자 · 계좌이체 판 · 메뉴판
    [[-1.42, -.5, 0xc8281e], [-1.35, -.5, 0xe8b21e], [-1.28, -.5, 0x2a2a26]].forEach(function (p) { PR.mesh(new T.CylinderGeometry(.028, .03, .17, 10), PR.M(p[2], .35), p[0], 1.0, p[1], V); PR.mesh(new T.ConeGeometry(.012, .05, 8), PR.M(0xf2f2ee, .4), p[0], 1.11, p[1], V); });
    var tg = PR.mesh(new T.BoxGeometry(.24, .012, .02), steel, 1.05, .93, -.45, V); tg.rotation.y = .4;
    PR.mesh(new T.BoxGeometry(.16, .07, .1), PR.M(0xf2f2ee, .8), -1.45, .955, -.85, V); PR.mesh(new T.BoxGeometry(.12, .06, .09), PR.M(0x2a62c8, .6), -1.45, .955, -1.2, V);
    var menu = textPlane("일반 4,000 · 양념 5,000 · 레전드 7,000", .9, .09, "#14130f", "#FFD23F", 26); menu.position.set(0, 1.62, -1.62); menu.rotation.y = Math.PI; V.add(menu); var menu2 = menu.clone(); menu2.rotation.y = 0; menu2.position.z = -1.6; V.add(menu2);
    var pay = textPlane("계좌이체 Credit transfer", .34, .08, "#fff", "#c8281e", 22); pay.position.set(-1.55, 1.15, -1.66); V.add(pay);
    // 주문서 걸이
    PR.mesh(new T.BoxGeometry(2.4, .02, .02), steel, 0, 2.05, -1.5, V, false);
    for (i = 0; i < 18; i++) { var sp = new T.Sprite(new T.SpriteMaterial({ map: G.glowTex, color: 0x9a948a, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; V.add(sp); S.smoke.push({ s: sp, t: 9 }); }
    K.init({ count: 220, max: 32, R: 32, seed: Math.floor(G.rand() * 1e4), avoid: { x: st.x, z: st.z, r: 6 }, fat: .05 });
    V.updateWorldMatrix(true, false);
    CX.forEach(function (x) { var w = V.localToWorld(new T.Vector3(x, 0, -2.3)); S.bodies.push({ x: w.x, z: w.z, r: .1, solid: false, avoid: 0, slot: true }); });
    S.focus = { x: st.x, z: st.z }; C.follow(st.x, st.z); hud();
  };
  function newTray() { var t = PR.tray(); t.scale.setScalar(1.3); t.position.set(TRAYX, .93, -.8); t.rotation.y = Math.PI / 2; S.V.add(t); S.trayG = t; S.tray = []; }
  function hud() { U.score(S.score); U.left.innerHTML = '<div class="panel">건넨 손님 <b>' + S.served + '</b> · 완벽 <b>' + S.perfect + '</b><br>놓친 손님 <b>' + S.lost + "</b></div>"; }
  function bin(t) {
    var s = null; for (var i = 0; i < 5; i++) if (!S.slots[i].sk) { s = S.slots[i]; break; }
    if (!s) return toast("화구가 가득 찼어요");
    var sk = PR.skewer(t); sk.position.set(s.x, GY, -.95); S.V.add(sk); s.sk = sk; s.type = t; s.st = 0; s.g = 0; s.burn = 0; s.flip = 0; s.drop = .25; G.snd.play("drop");
  }
  function slotKey(i) {
    var s = S.slots[i]; if (!s.sk) return;
    if (s.st === 0 || s.st === 2) return toast("아직 덜 익었어요");
    if (s.st === 1) { s.st = 2; s.g = 0; s.burn = 0; s.flip = .3; G.snd.play("flip"); }
    else if (s.st === 3) { if (S.tray.length >= 5) return toast("트레이에는 5개까지 올라갑니다", "bad"); var sk = s.sk; S.V.remove(sk); sk.rotation.set(0, Math.PI / 2, 0); sk.position.set(.01, .014, -.032 + S.tray.length * .016); sk.scale.setScalar(1 / 1.3 * .95); S.trayG.add(sk); S.tray.push(s.type); s.sk = null; G.snd.play("pick"); }
    else if (s.st === 4) { S.fly.push({ o: s.sk, t: 0, toss: true }); s.sk = null; G.snd.play("drop"); toast("탄 꼬치를 버렸어요"); }
    if (!s.sk) { s.fill.scale.x = .001; }
  }
  function printSticker() {
    if (S.sticker) return toast("스티커가 이미 나와 있어요 — Space 로 건네세요");
    var L = G.pick(PR.LANG_KEYS), no = 1 + Math.floor(G.rand() * 24), d = new Date(Date.now() + 4 * 60000), hm = [d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2), d.getHours() + ":" + ("0" + ((d.getMinutes() + 4) % 60)).slice(-2)];
    var m = PR.sticker(L, no, hm); m.position.set(-.12, .08, .1); m.rotation.set(-.5, -Math.PI / 2, 0); m.scale.setScalar(.8); S.fmG.add(m); S.sticker = { m: m, lang: L, t: 0 }; G.snd.play("print"); toast(L + " 스티커 출력 · 테이블 " + no, "good");
  }
  function pickOrder() { var o = [0, 0, 0], r = G.rand(), n = r < .2 ? 1 : r < .5 ? 2 : r < .75 ? 3 : r < .9 ? 4 : 5; if (G.rand() < .32) { o[2] = 1; n--; } for (var i = 0; i < n; i++) o[G.rand() < .55 ? 0 : 1]++; return o; }
  function spawn(slot) {
    var names = ["remy", "ch07_nonpbr", "character1", "character2", "character3", "character4"], p = G.person(G.pick(names), 1.58 + G.rand() * .24, { anim: "standardwalk" }); if (!p) return;
    var o = pickOrder(), n = o[0] + o[1] + o[2], lang = G.pick(LANG)[0], c = { slot: slot, p: p, o: o, n: n, lang: lang, st: "come", t: 0, x: (G.rand() < .5 ? -1 : 1) * (7 + G.rand() * 5), z: -2.5 - G.rand() * 1.5, no: ++S.no };
    p.root.position.set(c.x, 0, c.z); S.V.add(p.root); S.cust[slot] = c; S.max += n * 15;
  }
  function sheet(c) {
    var m = new T.Mesh(new T.PlaneGeometry(.3, .4), new T.MeshBasicMaterial({ map: orderTex(c.o, c.lang, c.no), toneMapped: false, color: new T.Color(.82, .82, .8) })); m.position.set(CX[c.slot] + .3, 1.32, -1.78); S.V.add(m); c.sheet = m; m.userData.act = function () { accept(c); }; S.hot.push(m);
    var bar = new T.Mesh(new T.PlaneGeometry(.3, .03), new T.MeshBasicMaterial({ color: 0x55d07a, toneMapped: false })); bar.position.set(0, -.225, .001); m.add(bar); c.bar = bar;
    var fr = new T.Mesh(new T.PlaneGeometry(.34, .44), new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.9, .5), toneMapped: false })); fr.position.z = -.003; fr.visible = false; m.add(fr); c.frame = fr;
  }
  function accept(c) { if (c.st === "wait") { c.st = "ok"; c.t = 60; c.mv = 0; c.from = c.sheet.position.clone(); G.snd.play("good"); toast("주문 " + c.no + " 접수! 1분 안에 건네세요", "good"); if (!S.sel) S.sel = c; } else if (c.st === "ok") { S.sel = c; G.snd.play("click"); } }
  function leave(c, happy) { c.st = "leave"; c.t = 0; if (c.sheet) { S.V.remove(c.sheet); var k = S.hot.indexOf(c.sheet); if (k >= 0) S.hot.splice(k, 1); c.sheet = null; } if (S.sel === c) S.sel = null; c.tx = (G.rand() < .5 ? -1 : 1) * (10 + G.rand() * 4); c.tz = -2.6 - G.rand() * 2; c.p.play(happy ? "standardwalk" : "strutwalking", { fade: .3 }); }
  function hand() {
    var c = S.sel; if (!c || c.st !== "ok") { c = null; S.cust.forEach(function (d) { if (d && d.st === "ok" && (!c || d.t < c.t)) c = d; }); }
    if (!c) return toast("접수된 주문이 없어요 — 주문서를 클릭하세요");
    if (!S.tray.length) return toast("트레이가 비어 있어요");
    if (!S.sticker) return toast("오른쪽 FOLD MARK 를 클릭해 스티커를 먼저 뽑으세요", "bad");
    var have = [0, 0, 0]; S.tray.forEach(function (t) { have[t]++; }); var ok = 0, miss = 0; for (var t = 0; t < 3; t++) { ok += Math.min(have[t], c.o[t]); miss += Math.max(0, c.o[t] - have[t]); }
    var pts = ok * 10 - miss * 5 + (miss === 0 ? c.n * 5 : 0); S.score += pts; S.served++; if (miss === 0) S.perfect++;
    toast(miss === 0 ? "완벽한 주문! +" + pts : (ok ? "건넸지만 " + miss + "개 부족 " + (pts >= 0 ? "+" : "") + pts : "주문과 달라요 " + pts), miss === 0 ? "good" : "bad"); G.snd.play(miss === 0 ? "great" : "bad");
    // 스티커를 트레이에 붙이고 손님에게
    var tr = S.trayG, sm = S.sticker.m; tr.attach(sm); sm.position.set(0, .0035, 0); sm.rotation.set(-Math.PI / 2, 0, 0); sm.scale.set(1.05, 1.15, 1); S.sticker = null; tr.children.forEach(function (o) { if (o.userData && o.userData.type != null) o.position.y += .004; });
    S.fly.push({ o: tr, t: 0, from: tr.position.clone(), to: new T.Vector3(CX[c.slot], 1.12, -2.02), c: c, carry: true }); newTray(); c.p.play("takingitem", { fade: .2, once: true }); c.st = "take"; c.t = 1.5; if (c.sheet) { S.V.remove(c.sheet); var k = S.hot.indexOf(c.sheet); if (k >= 0) S.hot.splice(k, 1); c.sheet = null; } if (S.sel === c) S.sel = null; hud();
  }
  g.key = function (c) { var m = /^(Digit|Numpad)([1-5])$/.exec(c); if (m) slotKey(+m[2] - 1); else if (c === "Space") hand(); };
  g.click = function () { var h = aim(); if (h) { h.object.userData.act(); } };
  function aim() { ray.setFromCamera(V2, G.cam); ray.far = 4; var h = ray.intersectObjects(S.hot, false); return h.length ? h[0] : null; }
  g.update = function (dt) {
    var V = S.V, i, s, c;
    // 시선
    S.yaw = G.clamp(S.yaw + G.mouse.dx * .0032, -2.1, 2.1); S.pitch = G.clamp(S.pitch - G.mouse.dy * .0032, -1.15, .6);
    V.updateWorldMatrix(true, false); G.cam.position.copy(V.localToWorld(tv.set(0, 1.62, 0))); G.cam.rotation.order = "YXZ"; G.cam.rotation.set(S.pitch, S.SG.rotation.y + Math.PI - S.yaw, 0);
    // 화구
    var cooking = 0, hints = [];
    for (i = 0; i < 5; i++) { s = S.slots[i]; if (!s.sk) continue;
      if (s.drop > 0) { s.drop -= dt; s.sk.position.y = GY + Math.max(0, s.drop) * .5; }
      if (s.flip > 0) { s.flip -= dt; s.sk.rotation.z = (1 - Math.max(0, s.flip) / .3) * Math.PI; s.sk.position.y = GY + Math.sin(Math.max(0, s.flip) / .3 * Math.PI) * .07; }
      if (s.st === 0 || s.st === 2) { s.g += dt / 10; cooking++; if (s.g >= 1) { s.g = 1; s.st++; s.burn = 0; G.snd.play("tick"); } s.fill.material.color.setHex(0xffd23f); s.fill.scale.x = Math.max(.001, s.g); s.fill.position.x = s.x - .09 * (1 - s.g); }
      else if (s.st === 1 || s.st === 3) { s.burn += dt / 10; cooking++; if (s.burn >= 1) { s.st = 4; G.snd.play("burn"); toast((i + 1) + "번 꼬치가 탔어요", "bad"); } var k = 1 - s.burn; s.fill.material.color.setHex(Math.sin(G.t * 14) > 0 ? 0xff4a3a : 0xffffff); s.fill.scale.x = Math.max(.001, k); s.fill.position.x = s.x - .09 * (1 - k); hints.push("<kbd>" + (i + 1) + "</kbd>" + (s.st === 1 ? "뒤집기" : "꺼내기")); }
      else { s.fill.material.color.setHex(0x444444); s.fill.scale.x = 1; s.fill.position.x = s.x; hints.push("<kbd>" + (i + 1) + "</kbd>버리기"); }
      var ck = s.st === 0 ? s.g * .5 : s.st === 1 ? .5 : s.st === 2 ? .5 + s.g * .5 : 1; s.sk.setCook(ck, s.st === 4 ? 1 : (s.st === 1 || s.st === 3) ? s.burn * .45 : 0);
    }
    G.snd.sizzle(cooking / 5); if (S.halo) S.halo.material.opacity = .55 + Math.sin(G.t * 3) * .25; S.coal.material.color.setRGB(2.4 + Math.sin(G.t * 3) * .3, .65, .12);
    // 연기
    S.smT -= dt; if (S.smT <= 0 && cooking) { S.smT = .12; var act = S.slots.filter(function (q) { return q.sk; }); if (act.length) { var q = G.pick(act); for (i = 0; i < S.smoke.length; i++) if (S.smoke[i].t > 1.6) { var m = S.smoke[i]; m.t = 0; m.s.visible = true; m.s.position.set(q.x + (Math.random() - .5) * .08, 1.1, -.95 + (Math.random() - .5) * .2); m.k = q.st === 4 ? 1.6 : 1; break; } } }
    S.smoke.forEach(function (m) { if (m.t > 1.6) { m.s.visible = false; return; } m.t += dt; m.s.position.y += dt * .45; m.s.position.x += dt * .05; var sc = .12 + m.t * .32; m.s.scale.set(sc, sc, 1); m.s.material.opacity = Math.sin(Math.min(1, m.t / 1.6) * Math.PI) * .2 * m.k; });
    // 날아가는 것들 (건네는 트레이 · 버리는 꼬치)
    for (i = S.fly.length - 1; i >= 0; i--) { var f = S.fly[i]; f.t += dt; if (f.toss) { f.o.position.x += dt * 1.2; f.o.position.y += (1.5 - f.t * 9) * dt; f.o.rotation.x += dt * 9; if (f.t > .7) { V.remove(f.o); S.fly.splice(i, 1); } } else { var k2 = G.ss(0, .45, f.t); f.o.position.lerpVectors(f.from, f.to, k2); f.o.position.y += Math.sin(k2 * Math.PI) * .2; if (f.t > .5 && f.carry && f.c.p) { f.c.p.root.attach(f.o); f.o.position.set(0, 1.02, .3); f.o.rotation.set(0, Math.PI / 2, 0); S.fly.splice(i, 1); } else if (f.t > 1.5) { V.remove(f.o); S.fly.splice(i, 1); } } }
    if (S.sticker && S.sticker.t < .5) { S.sticker.t += dt; S.sticker.m.position.y = .08 + G.ss(0, .5, S.sticker.t) * .12; }
    // 손님 오기
    S.nextT -= dt; var free = []; S.cust.forEach(function (d, j) { if (!d) free.push(j); });
    if (S.nextT <= 0 && free.length && G.main.time > 18) { spawn(G.pick(free)); var r = G.rand(); S.nextT = r < .7 ? 6 + G.rand() * 14 : r < .95 ? 20 + G.rand() * 25 : 45 + G.rand() * 45; if (S.cust.filter(Boolean).length === 0) S.nextT = Math.min(S.nextT, 20); }
    var pending = false;
    S.cust.forEach(function (c, j) { if (!c) return; var p = c.p, pos = p.root.position;
      if (c.st === "come" || c.st === "leave") { var tx = c.st === "come" ? CX[c.slot] : c.tx, tz = c.st === "come" ? -2.3 : c.tz, dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz); if (d < .08 || (c.st === "leave" && d < .5) || (c.st === "leave" && c.t > 14)) { if (c.st === "come") { c.st = "wait"; c.t = 30; pos.set(tx, 0, tz); p.root.rotation.y = 0; p.play("idle", { fade: .3 }); sheet(c); G.snd.play("pick"); } else { p.dispose(); S.cust[j] = null; return; } } else { if (c.st === "leave") c.t += dt; var sp = 1.5 * dt; pos.x += dx / d * Math.min(sp, d); pos.z += dz / d * Math.min(sp, d); p.root.rotation.y += G.angDiff(p.root.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 8); } }
      else if (c.st === "wait") { pending = true; c.t -= dt; c.sheet.position.y = 1.32 + Math.sin(G.t * 4 + j) * .015; c.sheet.scale.setScalar(1 + Math.sin(G.t * 6) * .03); c.bar.scale.x = Math.max(.001, c.t / 30); c.bar.material.color.setHex(0xffffff); if (c.t <= 0) { S.lost++; S.score -= 10; toast("주문을 안 받아 손님이 떠났어요 −10", "bad"); G.snd.play("bad"); leave(c, false); hud(); } }
      else if (c.st === "ok") { c.t -= dt; if (c.mv < 1) { c.mv = Math.min(1, c.mv + dt * 2.5); var e = G.ss(0, 1, c.mv); c.sheet.position.lerpVectors(c.from, tv.set(CX[c.slot] * .8, 1.84, -1.5), e); c.sheet.scale.setScalar(1); c.sheet.rotation.x = e * .28; } c.bar.scale.x = Math.max(.001, c.t / 60); c.bar.position.x = -.15 * (1 - c.t / 60); c.bar.material.color.setHex(c.t > 30 ? 0x55d07a : c.t > 12 ? 0xffb020 : (Math.sin(G.t * 12) > 0 ? 0xff3b30 : 0xffffff)); c.frame.visible = (S.sel === c);
        if (c.t <= 0) { S.lost++; S.score -= 10; toast("주문 " + c.no + " 손님이 기다리다 떠났어요 −10", "bad"); G.snd.play("bad"); leave(c, false); hud(); } }
      else if (c.st === "take") { c.t -= dt; if (c.t <= 0) leave(c, true); }
      p.update(dt); });
    if (!S.sel || S.sel.st !== "ok") { S.sel = null; S.cust.forEach(function (d) { if (d && d.st === "ok" && (!S.sel || d.t < S.sel.t)) S.sel = d; }); }
    // 안내
    var h = aim(); document.querySelector(".h-cross").classList.toggle("hot", !!h);
    if (pending) hints.unshift("주문서 클릭 → 주문 받기");
    if (S.tray.length && !S.sticker) hints.push("오른쪽 FOLD MARK 클릭 → 스티커"); if (S.sticker && S.tray.length) hints.push("<kbd>Space</kbd>건네기");
    U.hint(hints.slice(0, 4).join(" &nbsp;·&nbsp; ")); U.score(S.score);
    S.cust.forEach(function (d, j) { S.bodies[j].solid = !!(d && d.st !== "come" && d.st !== "leave"); S.bodies[j].r = S.bodies[j].solid ? .4 : .1; S.bodies[j].avoid = S.bodies[j].solid ? .5 : 0; });
    K.update(dt, S.focus, S.bodies);
  };
  g.result = function () {
    var done = S.served + S.lost, pct = S.max > 0 ? Math.max(0, S.score) / S.max : 0, rank = !done ? "F" : pct >= .9 ? "S" : pct >= .75 ? "A" : pct >= .55 ? "B" : pct >= .35 ? "C" : "F";
    return { eyebrow: g.eyebrow, rank: rank, head: S.score + "점", msg: rank === "S" || rank === "A" ? "오늘 장사 대성공. 스티커 덕분에 트레이도 제자리로 돌아옵니다." : "굽고, 받고, 건네고 — 사장님의 5분은 생각보다 바쁩니다.", lines: [["건넨 손님", S.served + "명"], ["완벽한 주문", S.perfect + "건"], ["놓친 손님", S.lost + "명"], ["달성률", Math.round(pct * 100) + "%"]] };
  };
  g.stop = function () { if (!S) return; S.cust.forEach(function (c) { if (c) c.p.dispose(); }); G.scene.remove(S.SG); if (S.st.group) S.st.group.visible = true; K.clear(); G.cam.rotation.order = "XYZ"; G.snd.sizzle(0); S = null; };
  g.debug = function () { return S; }; g.fn = { bin: bin, slotKey: slotKey, accept: accept, print: printSticker, hand: hand };
})();
