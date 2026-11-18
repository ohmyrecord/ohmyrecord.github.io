/* 전체 흐름: 고르기 → 방법 안내 → 체험 → 결과 */
(function () {
  "use strict";
  var G = window.G, T = G.T, U = G.ui, C = G.city, K = G.crowd;
  var M = G.main = { state: "boot", cur: null, time: 0, paused: false, t: 0 };
  C.build();
  function attract() { K.init({ count: 300, max: 40, seed: 5 }); M.t = 0; G.cam.fov = 50; G.cam.updateProjectionMatrix(); G.post.vig.value = 1.25; }
  M.menu = function () { if (M.cur) { M.cur.stop(); M.cur = null; } G.unlock(); G.snd.amb(.6); G.snd.sizzle(0); attract(); M.state = "menu"; U.menu(M.pick); };
  M.pick = function (id) { var g = G.games[id]; M.state = "how"; U.howto(g, function () { M.play(id); }, function () { M.state = "menu"; U.menu(M.pick); }); };
  M.play = function (id) {
    if (M.cur) M.cur.stop(); var g = M.cur = G.games[id]; M.id = id; M.time = g.time; M.paused = false; M.over = false;
    U.hide(); U.pause(false); U.hud(true, !!g.cross); G.post.vig.value = 1; G.cam.fov = g.fov || 55; G.cam.updateProjectionMatrix();
    g.start(); M.state = "play"; if (g.lock) G.lock(); G.snd.play("start"); G.snd.amb(1); U.time(M.time);
  };
  M.finish = function () {
    if (M.state !== "play") return; M.state = "result"; G.unlock(); G.snd.sizzle(0); var r = M.cur.result(); G.snd.play(/^[SAB]/.test(r.rank) ? "great" : "lose");
    U.hud(false); U.result(r, function (a) { if (a === "retry") M.play(M.id); else if (a === "other") M.menu(); else M.product(); });
  };
  function pauseCb(a) { if (a === "resume") M.resume(); else if (a === "retry") { U.pause(false); M.play(M.id); } else if (a === "other") { U.pause(false); M.menu(); } else if (a === "exit") { U.pause(false); M.exit(); } }
  M.pauseOn = function () { if (M.state !== "play" || M.paused) return; M.paused = true; G.keys = {}; U.pnote("ESC 를 누르면 언제든 이 메뉴가 나옵니다"); U.pause(true, pauseCb); G.snd.sizzle(0); };
  M.resume = function () { if (M.cur.lock && !G.q.nolock) { G.lock(); setTimeout(function () { if (M.paused) U.pnote("잠시 뒤 다시 눌러 주세요 (브라우저가 마우스를 잠깐 막아 둡니다)"); }, 600); } else { M.paused = false; U.pause(false); } };
  M.exit = function () { G.unlock(); if (G.q.back) location.href = G.q.back; else if (window.parent !== window) window.parent.postMessage({ md: "exit" }, "*"); else location.href = "../index.html#play"; };
  M.product = function () { if (G.q.back) location.href = G.q.back; else if (window.parent === window) location.href = "../index.html#foldmark"; else if (window.parent !== window) window.parent.postMessage({ md: "product" }, "*"); else M.menu(); };
  G.onKey = function (c) { if (c === "KeyM") G.snd.toggle(); if (c === "Escape" && M.state === "play") { if (M.paused) M.resume(); else M.pauseOn(); return; } if (M.state === "play" && !M.paused && M.cur.key) M.cur.key(c); };
  G.onClick = function (e) { if (M.state !== "play" || M.paused) return; if (M.cur.lock && !G.locked() && !G.q.nolock) { G.lock(); return; } if (M.cur.click) M.cur.click(e); };
  document.addEventListener("pointerlockchange", function () { if (M.state !== "play" || !M.cur.lock || G.q.nolock) return; if (G.locked()) { if (M.paused) { M.paused = false; U.pause(false); } } else M.pauseOn(); });
  var ang = 0;
  G.update = function (dt) {
    if (M.state === "play") {
      if (M.paused) return;
      M.time -= dt; U.time(M.time); M.cur.update(dt);
      if (M.time <= 0 && M.state === "play") M.finish();
    } else if (M.state === "menu" || M.state === "how") {      // 배경: 거리를 천천히 훑는 카메라
      M.t += dt; var z = -30 + Math.sin(M.t * .05) * 34, x = 4.6 + Math.sin(M.t * .09) * 1.2;
      G.cam.position.set(x, 2.3, z); G.cam.lookAt(x * .5 + Math.sin(M.t * .07) * 2, 2.6, z - 14); C.follow(x, z - 6);
      K.update(dt, { x: x, z: z - 10 }, null);
    } else if (M.state === "result" && M.cur && M.cur.idle) M.cur.idle(dt);
  };
  G.games = G.games || {};
  window.addEventListener("load", function () {
    G.start();
    var bt = document.getElementById("boot"); if (bt) { bt.classList.add("out"); setTimeout(function () { bt.remove(); }, 700); }
    if (G.q.game) { M.play(G.q.game); } else { M.menu(); if (G.q.pick && G.games[G.q.pick]) M.pick(G.q.pick); }
    window.READY = 1;
  });
})();
