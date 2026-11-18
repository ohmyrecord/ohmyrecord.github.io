/* 체험 2 — 손님 (3인칭 · 최대 3분) */
(function () {
  "use strict";
  var G = window.G, T = G.T, C = G.city, K = G.crowd, U = G.ui, PR = G.props;
  var S, mapEl, mapC;
  var g = G.games.customer = {
    id: "customer", time: 180, lock: true, eyebrow: "체험 02 · 손님", title: "닭꼬치를 지키며 STREET FOLD까지",
    goal: "노점에서 방금 닭꼬치를 샀습니다. 걸으면서 먹기는 힘드니, 트레이를 올려놓고 편하게 먹을 수 있는 STREET FOLD를 찾아가세요.",
    keys: [["마우스", "둘러보기 · 방향 돌리기"], ["W / S", "앞으로 · 뒤로"], ["A / D", "왼쪽 · 오른쪽으로 방향 돌리기"], ["Shift", "달리기 (부딪히기 쉬워요)"], ["Tab", "누르고 있는 동안 지도 보기"], ["Space", "도착해서 QR 스캔 · 트레이 올리기"], ["ESC", "일시정지 메뉴"]],
    rules: ["왼쪽 위 닭꼬치의 고기 5조각이 생명입니다. 사람과 부딪히면 <b>−1</b>, 덩치 큰 사람은 <b>−2</b>", "고기가 0이 되면 바로 끝납니다", "지도의 <b>?</b> 중 한 곳만 진짜 STREET FOLD입니다. 나머지는 자판기 · ATM 같은 가짜", "도착하면 QR을 찍고, 내려온 판에 트레이를 올려 먹습니다", "남은 고기와 걸린 시간으로 등급이 정해집니다"]
  };
  var CH = window.GM && GM.food && GM.food.chunkA;
  function hud(hit) { var h = '<div class="lives"><span>닭꼬치</span><div class="stick"></div>'; for (var i = 0; i < 5; i++) h += '<i class="' + (i < S.lives ? "" : "off") + (hit && i >= S.lives && i < S.lives + hit ? " hit" : "") + '" style="' + (i < S.lives && CH ? "background-image:url(" + CH + ");transform:rotate(" + [-8, 6, -3, 9, -6][i] + "deg)" : "") + '"></i>'; U.left.innerHTML = h + "</div>"; }
  function setMeat() { S.meat.forEach(function (m, i) { m.visible = i < S.lives || i >= 5; }); }
  g.start = function () {
    S = { lives: 5, inv: 0, grp: new T.Group(), spots: [], stage: 0, st: 0, dead: 0, done: false, bodies: [{ x: 0, z: 0, r: .33, avoid: .22 }], found: {}, hits: 0 };
    G.scene.add(S.grp);
    var sz = G.rand() < .5 ? 122 : -122; S.p = G.Player({ name: "character3", h: 1.64, x: (G.rand() - .5) * 6, z: sz, dir: sz > 0 ? Math.PI : 0, walk: 1.9, run: 4.3, back: 1, turn: 2.5, anims: { idle: "idle", walk: "standardwalk", run: "running", walkSp: 1.35, runSp: 3.5 }, camD: 4.2, camH: 2.6 });
    // 손에 든 트레이 + 꼬치
    var tr = S.tray = new T.Group(); var tt = PR.tray(); tt.rotation.y = Math.PI / 2; tr.add(tt); var sk = PR.skewer(1); sk.setCook(1, 0); sk.position.set(0, .03, 0); sk.scale.setScalar(1.25); tr.add(sk); var sk2 = PR.skewer(0); sk2.setCook(1, 0); sk2.position.set(.022, .03, 0); sk2.scale.setScalar(1.25); tr.add(sk2); S.meat = sk.children.slice(2, 8);
    tr.position.set(0, 1.0, .36); tr.scale.setScalar(1.3); S.p.m.root.add(tr);
    // 목적지 5곳 (진짜 1 + 가짜 4)
    var cand = C.sfSpots.filter(function (s) { return Math.hypot(s.x - S.p.x, s.z - S.p.z) > 45; }), chosen = [];
    for (var t = 0; t < 400 && chosen.length < 5; t++) { var c = G.pick(cand); if (chosen.every(function (o) { return Math.hypot(o.x - c.x, o.z - c.z) > 30; })) chosen.push(c); }
    var real = Math.floor(G.rand() * chosen.length);
    if (G.q.near) { chosen[real] = C.sfSpots.slice().sort(function (a, b) { return Math.hypot(a.x - S.p.x, a.z - S.p.z) - Math.hypot(b.x - S.p.x, b.z - S.p.z); })[0]; }
    chosen.forEach(function (sp, i) { var st = { x: sp.x, z: sp.z, ry: sp.ry, real: i === real, g: new T.Group(), i: i }; st.g.position.set(sp.x, 0, sp.z); st.g.rotation.y = sp.ry; st.g.add(PR.beam(0xffc832, 15, .45));
      if (st.real) { PR.streetfold(function (m) { st.g.add(m); var s = m.userData.size; st.plate = PR.mesh(new T.BoxGeometry(.52, .025, .36), PR.M(0xe9e6dc, .4, .3), 0, 0, 0, null); st.hinge = new T.Group(); st.hinge.position.set(0, 1.08, s.z / 2 + .02); st.plate.position.set(0, 0, .18); st.hinge.add(st.plate); st.hinge.rotation.x = -Math.PI / 2; st.g.add(st.hinge);
          var qr = G.canvasTex(64, 64, function (c2, w) { c2.fillStyle = "#fff"; c2.fillRect(0, 0, w, w); c2.fillStyle = "#111"; for (var a = 0; a < 8; a++) for (var b = 0; b < 8; b++) if ((a * 7 + b * 13 + a * b) % 3 === 0 || (a < 3 && b < 3) || (a > 4 && b < 3) || (a < 3 && b > 4)) c2.fillRect(a * 8, b * 8, 8, 8); }); qr.magFilter = T.NearestFilter;
          st.qr = PR.mesh(new T.PlaneGeometry(.16, .16), new T.MeshBasicMaterial({ map: qr, toneMapped: false }), 0, 1.38, s.z / 2 + .012, st.g, false); });
        var pl = new T.PointLight(0xffd070, 7, 7, 1.6); pl.position.set(0, 2.3, .9); st.g.add(pl); }
      else { var d = PR.decoy(i); st.g.add(d); }
      C.boxes.push(st.box = { x0: sp.x - .5, z0: sp.z - .5, x1: sp.x + .5, z1: sp.z + .5 }); S.grp.add(st.g); S.spots.push(st); });
    K.init({ count: 420, max: 50, R: 34, seed: Math.floor(G.rand() * 1e4), avoid: { x: S.p.x, z: S.p.z, r: 4 }, fat: .09, stand: .1 });
    G.minimap.show(true); U.hudEl.classList.add("has-mm");
    hud(); setMeat(); U.score(null);
  };
  function drawMap() {
    var c = mapC, W = 460, H = 640, sc = 2.1, ox = W / 2, oz = H / 2 - 4; function X(x) { return ox + x * sc; } function Z(z) { return oz + z * sc; }
    c.clearRect(0, 0, W, H); c.fillStyle = "#3a3a36"; C.streets.forEach(function (s) { c.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * sc, (s.z1 - s.z0) * sc); });
    c.fillStyle = "rgba(255,210,63,.25)"; C.stalls.forEach(function (s) { c.fillRect(X(s.x - .8), Z(s.z - s.L / 2), 1.6 * sc, s.L * sc); });
    S.spots.forEach(function (st) { var f = S.found[st.i]; c.beginPath(); c.arc(X(st.x), Z(st.z), 13, 0, 7); c.fillStyle = f === "x" ? "#555" : "#FFD23F"; c.fill(); c.fillStyle = "#14130f"; c.font = "800 17px " + G.FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(f === "x" ? "✕" : "?", X(st.x), Z(st.z) + 1); });
    var p = S.p; c.save(); c.translate(X(p.x), Z(p.z)); c.rotate(-p.dir + Math.PI); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.fill(); c.restore();
    c.fillStyle = "rgba(243,240,228,.7)"; c.font = "600 13px " + G.FONT; c.textAlign = "left"; c.fillText("흰 화살표 = 나 · 노란 ? = STREET FOLD 후보", 14, H - 16);
  }
  g.key = function (c) {
    if (c !== "Space" || !S.near || S.dead) return;
    if (S.stage === 0) { S.stage = 1; S.st = 0; S.p.frozen = true; G.snd.play("print"); }
    else if (S.stage === 2) { S.stage = 3; S.st = 0; G.snd.play("drop"); }
  };
  g.update = function (dt) {
    var p = S.p, i, a; S.inv -= dt;
    if (S.dead) { S.dead += dt; p.m.update(dt); K.update(dt, p, null); p.cam(dt); if (S.dead > 2.4) G.main.finish(); return; }
    p.update(dt); S.bodies[0].x = p.x; S.bodies[0].z = p.z;
    // 손에 든 트레이가 걸음에 맞춰 살짝 흔들림
    S.tray.position.y = 1.02 + Math.sin(G.t * (p.running ? 16 : 9)) * .008 * Math.min(1, Math.abs(p.v)); S.tray.rotation.z = Math.sin(G.t * (p.running ? 8 : 4.5)) * .03 * Math.min(1, Math.abs(p.v));
    K.update(dt, p, S.bodies);
    // 부딪힘
    var list = K.touch(p.x, p.z, p.r);
    for (i = 0; i < list.length; i++) { a = list[i]; var dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz) || .01, pen = p.r + a.r - d; if (pen <= 0) continue;
      p.x += dx / d * pen; p.z += dz / d * pen;
      if (S.inv <= 0 && S.stage === 0 && pen > .03) { S.inv = 1.4; S.hits++; var n = a.fat ? 2 : 1; S.lives = Math.max(0, S.lives - n); K.bump(a, -dx / d, -dz / d, a.fat ? "reaction" : "shovereaction"); p.v *= -.4; G.shake = a.fat ? .35 : .2; U.flash(); G.snd.play("hit"); U.toast(a.fat ? "덩치 큰 사람과 쾅! 고기 −2" : "부딪혔어요! 고기 −1", "bad"); hud(n); setMeat();
        if (S.lives <= 0) { S.dead = .01; p.frozen = true; p.animLock = true; p.m.play("death", { once: true, fade: .15 }); S.tray.visible = false; G.snd.play("lose"); } } }
    // 목적지
    S.near = null; var hint = "";
    S.spots.forEach(function (st) { var d = Math.hypot(st.x - p.x, st.z - p.z); if (d < 3.2 && !st.real && S.found[st.i] !== "x") { S.found[st.i] = "x"; U.toast("여기는 STREET FOLD가 아니에요", "bad"); G.snd.play("bad"); } if (st.real && d < 2.6) S.near = st; });
    if (S.near) { var st = S.near; S.st += dt;
      if (S.stage === 0) hint = "<kbd>Space</kbd> QR 코드 스캔";
      else if (S.stage === 1) { hint = "QR 스캔 중… 플레이트가 내려옵니다"; if (st.hinge) st.hinge.rotation.x = -Math.PI / 2 * (1 - G.ss(.5, 1.5, S.st)); if (S.st > 1.6) { S.stage = 2; G.snd.play("good"); } }
      else if (S.stage === 2) hint = "<kbd>Space</kbd> 트레이 올리기";
      else if (S.stage === 3) { if (!S.moved) { S.moved = true; st.hinge.attach(S.tray); S.from = S.tray.position.clone(); S.fromQ = S.tray.quaternion.clone(); } var k = G.ss(0, .7, S.st); S.tray.position.lerpVectors(S.from, new T.Vector3(0, .014, .18), k); S.tray.position.y += Math.sin(k * Math.PI) * .12; S.tray.quaternion.slerpQuaternions(S.fromQ, new T.Quaternion(), k); if (S.st > 1.3 && !S.done) { S.done = true; G.main.finish(); } }
    }
    U.hint(hint);
    var mk = S.spots.map(function (st) { return { x: st.x, z: st.z, txt: S.found[st.i] === "x" ? "✕" : "?", col: S.found[st.i] === "x" ? "#666" : "#FFD23F", r: 8 }; });
    G.minimap.draw(p, mk, "흰 화살표 = 나 · 노란 ? = STREET FOLD 후보 (한 곳만 진짜)");
    p.cam(dt);
  };
  g.result = function () {
    G.minimap.show(false); var left = Math.max(0, G.main.time), used = 180 - left, pts = S.lives * 14 + 30 * left / 180, rank;
    if (!S.done) return { eyebrow: g.eyebrow, rank: "F", head: S.lives <= 0 ? "닭꼬치를 전부 잃었습니다" : "시간이 다 됐습니다", msg: S.lives <= 0 ? "사람이 이렇게 많은 거리에서는 서서 먹을 자리가 꼭 필요합니다." : "STREET FOLD가 더 가까이, 더 많이 있었다면 어땠을까요.", lines: [["남은 고기", S.lives + " / 5"], ["부딪힌 횟수", S.hits + "번"]] };
    rank = pts >= 85 ? "S" : pts >= 68 ? "A" : pts >= 50 ? "B" : "C";
    return { eyebrow: g.eyebrow, rank: rank, head: "STREET FOLD 도착", msg: "플레이트에 트레이를 올리고, 이제 두 손으로 편하게 먹습니다.", lines: [["남은 고기", S.lives + " / 5"], ["걸린 시간", Math.floor(used / 60) + "분 " + Math.round(used % 60) + "초"], ["부딪힌 횟수", S.hits + "번"]] };
  };
  g.stop = function () { if (!S) return; S.spots.forEach(function (st) { var k = C.boxes.indexOf(st.box); if (k >= 0) C.boxes.splice(k, 1); }); G.scene.remove(S.grp); S.p.dispose(); K.clear(); G.minimap.show(false); U.hudEl.classList.remove("has-mm"); S = null; };
  g.debug = function () { return S; };
})();
