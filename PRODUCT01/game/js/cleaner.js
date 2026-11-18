/* 체험 3 — 환경미화원 (3인칭 · 3분) */
(function () {
  "use strict";
  var G = window.G, T = G.T, C = G.city, K = G.crowd, U = G.ui, PR = G.props;
  var S, CAP = 1e9, SF_PTS = 5, SF_CD = 30, OUTLAW = 15;
  var g = G.games.cleaner = {
    id: "cleaner", time: 180, lock: true, eyebrow: "체험 03 · 환경미화원", title: "3분 동안 거리를 깨끗하게",
    goal: "전동 수거차를 밀고 다니며 거리의 쓰레기를 줍습니다. 곳곳의 STREET FOLD를 들르면 보너스, 쓰레기를 버리는 사람은 수거차로 혼내 주세요.",
    keys: [["마우스", "둘러보기 · 방향 돌리기"], ["W / S", "앞으로 · 뒤로"], ["A / D", "왼쪽 · 오른쪽으로 방향 돌리기"], ["Space", "수거차 돌진 (무단투기범 잡기)"], ["Tab", "누르고 있는 동안 전체 지도"], ["ESC", "일시정지 메뉴"]],
    rules: ["쓰레기 위로 수거차를 밀면 줍습니다 <b>+1</b>", "노란 빛기둥의 STREET FOLD에 들르면 <b>+5</b> (같은 곳은 30초 뒤 다시)", "쓰레기를 버린 사람은 몇 초 동안 빨간 <b>!</b> 표시 — 돌진으로 치면 <b>+2</b>", "표시 없는 시민을 치면 <b>−2</b> · 15명을 치면 점수와 상관없이 ‘무법자’", "50점 이상 S · 40점 A · 30점 B · 20점 C · 19점 이하 ‘직무유기’", "무단투기범을 15명 이상 잡으면 등급과 함께 <b>‘다크나이트’</b> 칭호"]
  };
  function spawnTrash(x, z, drop) { var m = PR.trash(); m.position.x = x; m.position.z = z; var by = m.position.y; if (drop) { m.userData.vy = 2.2; m.position.y = 1.1; } m.userData.by = by; S.grp.add(m); S.trash.push(m); return m; }
  function randStreet(minD, maxD) { for (var i = 0; i < 60; i++) { var a = G.rand() * 6.283, d = minD + G.rand() * (maxD - minD), x = S.p.x + Math.sin(a) * d, z = S.p.z + Math.cos(a) * d; if (C.inStreet(x, z, .8) && !C.blocked(x, z, .5)) return [x, z]; } return null; }
  g.start = function () {
    S = { score: 0, load: 0, picked: 0, dumps: 0, caught: 0, hits: 0, trash: [], grp: new T.Group(), stations: [], litterT: 4, dash: 0, cd: 0, bodies: [{ x: 0, z: 0, r: .4, solid: true, avoid: .5 }, { x: 0, z: 0, r: .55, solid: true, avoid: .6 }], dumpT: 0, fullT: 0, lit: [] };
    G.scene.add(S.grp);
    S.p = G.Player({ name: "character5", h: 1.76, x: 4.5, z: 12, dir: Math.PI, walk: 2.9, back: 1.2, turn: 2.2, anims: { idle: "idle", walk: "push", run: "push", walkSp: 1.9, runSp: 3.6 }, camD: 5.4, camH: 3.0, extra: { d: 1.5, r: .55 } });
    S.cart = PR.cart(); S.cart.position.set(0, 0, 1.55); S.p.m.root.add(S.cart);
    K.init({ count: 300, max: 38, R: 40, seed: Math.floor(G.rand() * 1e4), avoid: { x: 4.5, z: 12, r: 5 }, fat: .05 });
    for (var i = 0; i < 70; i++) { var q = randStreet(3, 70); if (q) spawnTrash(q[0], q[1]); }
    // STREET FOLD 분리배출함 3곳
    var spots = C.sfSpots.slice().sort(function (a, b) { return Math.hypot(a.x, a.z - 12) - Math.hypot(b.x, b.z - 12); }), pick = [spots[0], spots[3], spots[7], spots[12]];
    pick.forEach(function (sp) { var st = { x: sp.x, z: sp.z, g: new T.Group() }; st.g.position.set(sp.x, 0, sp.z); st.g.rotation.y = sp.ry; st.g.add(PR.beam(0xffc832, 16, .55)); var l = PR.label("STREET FOLD +5", "#FFD23F", 2.0); st.lab = l; st.cd = 0; l.position.y = 2.75; st.g.add(l); var pl = new T.PointLight(0xffd070, 6, 7, 1.6); pl.position.set(0, 2.3, .8); st.g.add(pl); PR.streetfold(function (m) { st.g.add(m); }); S.grp.add(st.g); S.stations.push(st); C.boxes.push(st.box = { x0: sp.x - .45, z0: sp.z - .45, x1: sp.x + .45, z1: sp.z + .45 }); });
    hud(); G.minimap.show(true); U.hudEl.classList.add("has-mm");
  };
  function hud() { U.score(S.score); U.left.innerHTML = '<div class="panel">주운 쓰레기 <b>' + S.picked + '</b> · STREET FOLD <b>' + S.dumps + '</b><br>검거 <b>' + S.caught + '</b> · 시민 사고 <b>' + S.hits + " / " + OUTLAW + "</b></div>"; }
  function add(n, txt, kind) { S.score += n; U.toast(txt + " " + (n > 0 ? "+" : "") + n, kind || (n > 0 ? "good" : "bad")); hud(); }
  g.key = function (c) { if (c === "Space" && S.cd <= 0) { S.dash = .5; S.cd = 1.5; G.snd.play("flip"); } };
  g.update = function (dt) {
    var p = S.p, i, a; S.cd -= dt; S.dash -= dt; p.boost = S.dash > 0 ? 7.8 : 0;
    p.update(dt);
    var sx = Math.sin(p.dir), cz = Math.cos(p.dir), cx = p.x + sx * 1.6, cz2 = p.z + cz * 1.6;
    S.bodies[0].x = p.x; S.bodies[0].z = p.z; S.bodies[1].x = cx; S.bodies[1].z = cz2;
    // 수레 바퀴 굴리기
    S.cart.children.forEach(function (o) { if (o.name === "wheel") o.rotation.x += p.v * dt / .27; });
    S.cart.rotation.x = G.damp(S.cart.rotation.x, S.dash > 0 ? -.05 : 0, 8, dt); if (S.cart.beacon) S.cart.beacon.material.color.setRGB(Math.sin(G.t * 9) > 0 ? 3 : .4, Math.sin(G.t * 9) > 0 ? 1.6 : .2, .2);
    // 사람 치기
    var fast = Math.abs(p.v) > 4.2, list = K.touch(cx + sx * .2, cz2 + cz * .2, .62);
    for (i = 0; i < list.length; i++) { a = list[i]; if (fast && a.state !== "down") {
        K.knock(a, sx, cz, 4.5); G.shake = .3; G.snd.play("bump"); a.over = 0;
        if (a.mark > 0) { a.mark = 0; S.caught++; add(2, "무단투기범 검거!"); } else { S.hits++; add(-2, "일반 시민을 쳤어요 (" + S.hits + "/" + OUTLAW + ")"); U.flash(); if (S.hits === OUTLAW) U.toast("무법자 타이틀 획득…", "bad"); }
      } }
    // 쓰러진 사람을 밟고 지나가면 덜커덩
    var near = K.near(cx, cz2, .5); for (i = 0; i < near.length; i++) { a = near[i]; if (a.state === "down" && Math.abs(p.v) > 1 && (a.over || 0) <= 0 && a.t < 6.6) { a.over = 1.2; G.bumpY = .16; G.shake = .12; G.snd.play("bump2"); } }
    K.list.forEach(function (b) { if (b.over > 0) b.over -= dt; });
    K.update(dt, p, S.bodies);
    // 쓰레기 줍기
    for (i = S.trash.length - 1; i >= 0; i--) { var t = S.trash[i]; if (t.userData.vy != null) { t.userData.vy -= 9 * dt; t.position.y += t.userData.vy * dt; if (t.position.y <= t.userData.by) { t.position.y = t.userData.by; t.userData.vy = null; } continue; }
      var dx = t.position.x - cx, dz = t.position.z - cz2; if (dx * dx + dz * dz < .62) {
        
        S.trash.splice(i, 1); S.grp.remove(t); if (S.cart.load.children.length < 24) { t.position.set((Math.random() - .5) * .5, .04 + Math.min(S.load, 24) * .006, (Math.random() - .5) * .8); S.cart.load.add(t); } S.load++; S.picked++; G.snd.play("pick"); add(1, "쓰레기", "");
      } }
    S.fullT -= dt;
    while (S.trash.length < 34) { var q = randStreet(14, 60); if (!q) break; spawnTrash(q[0], q[1]); }
    // 비우기
    var hint = S.cd <= 0 ? "<kbd>Space</kbd> 돌진 · 노란 빛기둥 = STREET FOLD <b>+5</b>" : "";
    S.stations.forEach(function (st) { st.cd -= dt; var d = Math.min(Math.hypot(st.x - cx, st.z - cz2), Math.hypot(st.x - p.x, st.z - p.z)); st.lab.material.opacity = st.cd > 0 ? .35 : 1;
      if (d < 2.6) { if (st.cd <= 0) { st.cd = SF_CD; S.dumps++; G.snd.play("great"); add(SF_PTS, "STREET FOLD 들름"); } else hint = "이 STREET FOLD는 " + Math.ceil(st.cd) + "초 뒤 다시 +5"; } });
    U.hint(hint);
    // 무단투기
    S.litterT -= dt;
    if (S.litterT <= 0) { S.litterT = 4.5 + G.rand() * 4.5; var c = K.list.filter(function (b) { if (!b.model || b.state !== "walk" || b.mark > 0) return false; var d = Math.sqrt(b.d2); if (d < 5 || d > 20) return false; return (b.x - p.x) * sx + (b.z - p.z) * cz > -2; });
      if (c.length) { a = G.pick(c); K.setState(a, "litter", 2.1, { back: "walk" }); a.mark = 9; a.fleeSp = 2.3; S.lit.push({ a: a, t: .8, done: false }); } }
    for (i = S.lit.length - 1; i >= 0; i--) { var L = S.lit[i]; L.t -= dt; if (!L.done && L.t <= 0) { L.done = true; spawnTrash(L.a.x + Math.cos(L.a.dir) * .45, L.a.z - Math.sin(L.a.dir) * .45, true); G.snd.play("drop"); }
      if (L.done && L.a.state === "walk" && L.a.mark > 0) { K.setState(L.a, "flee", L.a.mark); S.lit.splice(i, 1); } else if (L.done && L.a.mark <= 0) S.lit.splice(i, 1); }
    var mk = S.stations.map(function (st) { return { x: st.x, z: st.z, txt: "+5", col: st.cd > 0 ? "#777" : "#FFD23F", r: 9 }; });
    S.trash.forEach(function (t) { mk.push({ x: t.position.x, z: t.position.z, kind: "dot", col: "#d8d4c6", r: 5 }); });
    K.list.forEach(function (a) { if (a.mark > 0) mk.push({ x: a.x, z: a.z, txt: "!", col: "#ff3b30", r: 8 }); });
    G.minimap.draw(p, mk, "흰 화살표 = 나 · 노란 = STREET FOLD · 빨간 ! = 무단투기범 · 점 = 쓰레기");
    p.cam(dt);
  };
  g.result = function () {
    G.minimap.show(false);
    var s = S.score, rank = S.hits >= OUTLAW ? "무법자" : s >= 50 ? "S" : s >= 40 ? "A" : s >= 30 ? "B" : s >= 20 ? "C" : "직무유기";
    var dk = S.caught >= 15;
    return { eyebrow: g.eyebrow, rank: rank, title: dk ? "다크나이트" : null, head: s + "점", msg: rank === "무법자" ? "시민 " + S.hits + "명이 쓰러졌습니다. 거리보다 사람이 먼저입니다." : rank === "직무유기" ? "거리에 쓰레기가 그대로 남았습니다." : rank === "S" ? "오늘 밤 명동이 가장 깨끗합니다." : "수고하셨습니다. STREET FOLD가 가까울수록 일이 쉬워집니다.",
      lines: [["주운 쓰레기", S.picked + "개"], ["STREET FOLD 들름", S.dumps + "번"], ["무단투기범 검거", S.caught + "명"], ["시민 사고", S.hits + "건"]] };
  };
  g.stop = function () { G.minimap.show(false); U.hudEl.classList.remove("has-mm"); if (!S) return; S.stations.forEach(function (st) { var k = C.boxes.indexOf(st.box); if (k >= 0) C.boxes.splice(k, 1); }); G.scene.remove(S.grp); S.p.dispose(); K.clear(); S = null; };
  g.debug = function () { return S; };
})();
