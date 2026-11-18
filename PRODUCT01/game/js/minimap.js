/* 미니맵 (화면 위 가운데, 가로로 작게) + Tab 을 누르는 동안 전체 지도 */
(function () {
  "use strict";
  var G = window.G, C = G.city, U = G.ui;
  var MM = G.minimap = {}, mini = null, mc, big = null, bc;
  function ensure() {
    if (mini) return;
    mini = document.createElement("canvas"); mini.className = "minimap"; mini.width = 520; mini.height = 150; U.hudEl.appendChild(mini); mc = mini.getContext("2d");
    big = document.createElement("canvas"); big.className = "map"; big.width = 520; big.height = 700; U.hudEl.appendChild(big); bc = big.getContext("2d");
  }
  MM.show = function (on) { ensure(); mini.style.display = on ? "block" : "none"; if (!on) big.classList.remove("on"); };
  function streets(c, X, Z, sc) {
    c.fillStyle = "rgba(58,58,54,.95)"; C.streets.forEach(function (s) { c.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * sc, (s.z1 - s.z0) * sc); });
    c.fillStyle = "rgba(255,210,63,.32)"; C.stalls.forEach(function (s) { c.fillRect(X(s.x - .8), Z(s.z - s.L / 2), 1.6 * sc, s.L * sc); });
  }
  function marks(c, X, Z, list, big2) {
    (list || []).forEach(function (m) {
      var x = X(m.x), z = Z(m.z), r = (m.r || 6) * (big2 ? 1.6 : 1);
      if (m.kind === "dot") { c.fillStyle = m.col || "#ddd"; c.beginPath(); c.arc(x, z, r * .45, 0, 7); c.fill(); return; }
      c.beginPath(); c.arc(x, z, r, 0, 7); c.fillStyle = m.col || "#FFD23F"; c.fill();
      if (m.txt) { c.fillStyle = "#14130f"; c.font = "800 " + Math.round(r * 1.25) + "px " + G.FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(m.txt, x, z + 1); }
    });
  }
  function me(c, x, z, rot, s) { c.save(); c.translate(x, z); c.rotate(rot); c.fillStyle = "#fff"; c.strokeStyle = "#14130f"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11 * s); c.lineTo(8 * s, 9 * s); c.lineTo(0, 4 * s); c.lineTo(-8 * s, 9 * s); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  /* p: {x, z, dir}, list: [{x, z, kind, col, txt}] */
  MM.draw = function (p, list, title) {
    ensure();
    // 작은 지도: 내가 가운데, 내가 보는 쪽이 위
    var W = 520, H = 150, sc = 2.4, c = mc; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    c.save(); c.beginPath(); c.roundRect ? c.roundRect(0, 0, W, H, 18) : c.rect(0, 0, W, H); c.clip();
    c.fillStyle = "rgba(10,10,12,.78)"; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H / 2 + 22); c.rotate(Math.PI + p.dir);
    var X = function (x) { return (x - p.x) * sc; }, Z = function (z) { return (z - p.z) * sc; };
    streets(c, X, Z, sc); marks(c, X, Z, list, false);
    c.restore();
    me(c, W / 2, H / 2 + 22, 0, 1);
    c.fillStyle = "rgba(243,240,228,.55)"; c.font = "600 12px " + G.FONT; c.textAlign = "right"; c.fillText("Tab 전체 지도", W - 14, H - 10);
    // 큰 지도 (Tab)
    var tab = !!G.keys.Tab; big.classList.toggle("on", tab);
    if (tab) {
      var BW = 520, BH = 700, s2 = Math.min((BW - 40) / (C.XL * 2 + 10), (BH - 70) / (C.ZL * 2 + 10)), ox = BW / 2, oz = BH / 2 - 10, c2 = bc;
      var X2 = function (x) { return ox + x * s2; }, Z2 = function (z) { return oz + z * s2; };
      c2.clearRect(0, 0, BW, BH); streets(c2, X2, Z2, s2); marks(c2, X2, Z2, list, true); me(c2, X2(p.x), Z2(p.z), -p.dir + Math.PI, 1.1);
      c2.fillStyle = "rgba(243,240,228,.75)"; c2.font = "600 14px " + G.FONT; c2.textAlign = "left"; c2.fillText(title || "흰 화살표 = 나", 18, BH - 18);
    }
  };
})();
