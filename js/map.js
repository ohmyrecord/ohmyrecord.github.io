/* =========================================================
   하늘에서 내려다본 명동 지도 (Canvas)
   - 사람 점의 위치는 "시간 t"만으로 계산됩니다.
     그래서 스크롤을 멈추면 멈추고, 올리면 거꾸로 갑니다.
   ========================================================= */
(function () {
  "use strict";
  var CFG = window.MD_CONFIG;
  var COL = CFG.colors;
  var W = 1600, H = 1000; // 지도 세계 크기

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ---------- 거리 (중심선, 폭) ---------- */
  var STREETS = [
    { id: "main",  pts: [[-60, 468], [1660, 532]], w: 96, kind: "main" },
    { id: "cross", pts: [[768, -60], [832, 1060]], w: 84, kind: "main" },
    { id: "a1", pts: [[296, -60], [318, 474]],  w: 34, kind: "alley" },
    { id: "a2", pts: [[1214, 1060], [1188, 526]], w: 34, kind: "alley" },
    { id: "a3", pts: [[522, 506], [552, 1060]], w: 34, kind: "alley" },
    { id: "a4", pts: [[1044, -60], [1028, 510]], w: 34, kind: "alley" },
    { id: "a5", pts: [[-60, 236], [776, 252]],  w: 30, kind: "alley" },
    { id: "a6", pts: [[826, 796], [1660, 818]], w: 30, kind: "alley" },
    { id: "a7", pts: [[1420, -60], [1404, 524]], w: 30, kind: "alley" }
  ];
  STREETS.forEach(function (s) {
    var a = s.pts[0], b = s.pts[1];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    s.len = Math.sqrt(dx * dx + dy * dy);
    s.ux = dx / s.len; s.uy = dy / s.len;
    s.nx = -s.uy; s.ny = s.ux;
  });
  function pointOn(st, s, lat) {
    var a = st.pts[0];
    return [a[0] + st.ux * s + st.nx * lat, a[1] + st.uy * s + st.ny * lat];
  }
  var MAIN = STREETS[0];

  /* ---------- 고정 요소 (간판, 노점, 골목 테이블) ---------- */
  var R = rng(2030);
  var SIGNS = [];
  var SIGN_TONES = [COL.dnaPale, "#B9B39F", COL.dnaCharcoal, "#D8D2BE", "#F7E9A8", "#CFC8B0"];
  STREETS.forEach(function (st) {
    var step = st.kind === "main" ? 22 : 30;
    for (var s = 40; s < st.len - 40; s += step) {
      [-1, 1].forEach(function (side) {
        if (R() < 0.18) return;
        var p = pointOn(st, s + R() * 8, side * (st.w / 2 + 6));
        SIGNS.push({ x: p[0], y: p[1], st: st, s: s, w: 7 + R() * 7, h: 4 + R() * 3,
          tone: SIGN_TONES[(R() * SIGN_TONES.length) | 0], ang: Math.atan2(st.uy, st.ux) });
      });
    }
  });
  var STALLS = [];
  for (var s0 = 90; s0 < MAIN.len - 90; s0 += 44) {
    if (Math.abs(s0 - 860) < 70) continue; // 교차로 비움
    STALLS.push({ s: s0, p: pointOn(MAIN, s0, 0) });
  }
  var TABLES = [];
  STREETS.forEach(function (st) {
    if (st.kind !== "alley") return;
    for (var s = 60; s < st.len - 60; s += 78) {
      var side = (s / 78 | 0) % 2 ? 1 : -1;
      var p = pointOn(st, s, side * (st.w / 2 - 5));
      TABLES.push({ x: p[0], y: p[1], ang: Math.atan2(st.uy, st.ux) });
    }
  });

  /* ---------- 사람 점: 2026~27 불규칙(돌아가기·꺾기·멈춤) → 2028부터 정돈된 흐름 ----------
     움직임은 "시간 t"만으로 계산됩니다. 스크롤을 멈추면 멈추고, 올리면 거꾸로 갑니다. */
  // 길끼리 만나는 지점 (꺾어 갈 수 있는 곳)
  var CROSS = STREETS.map(function () { return []; });
  (function () {
    for (var i = 0; i < STREETS.length; i++) for (var j = i + 1; j < STREETS.length; j++) {
      var A = STREETS[i], B = STREETS[j];
      var p = A.pts[0], r = [A.ux * A.len, A.uy * A.len], q = B.pts[0], s = [B.ux * B.len, B.uy * B.len];
      var den = r[0] * s[1] - r[1] * s[0];
      if (Math.abs(den) < 1e-6) continue;
      var t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den, u = ((q[0] - p[0]) * r[1] - (q[1] - p[1]) * r[0]) / den;
      if (t < -0.03 || t > 1.03 || u < -0.03 || u > 1.03) continue;
      CROSS[i].push({ s: clamp(t, 0, 1) * A.len, to: j, s2: clamp(u, 0, 1) * B.len });
      CROSS[j].push({ s: clamp(u, 0, 1) * B.len, to: i, s2: clamp(t, 0, 1) * A.len });
    }
  })();
  function nearStall(k, s) { return k === 0 && Math.abs(((s - 90) % 44 + 44) % 44 - 22) > 14; }

  function makeAgents(n, seed, switchT) {
    var r = rng(seed || 7), list = [];
    var T0 = switchT ? switchT[0] : -1, T1 = switchT ? switchT[1] : -1;
    for (var i = 0; i < n; i++) {
      var k = r() < 0.8 ? (r() < 0.75 ? 0 : 1) : 2 + ((r() * (STREETS.length - 2)) | 0);   // 2026: 대부분 큰길
      var st = STREETS[k];
      var a = { k: k, s: 20 + r() * (st.len - 40), dir: r() < 0.5 ? 1 : -1, v: 0.55 + r() * 0.9, spread: r() * 2 - 1, ph: r() * 6.283, legs: [] };
      a.tsw = T0 < 0 ? -1 : lerp(T0, T1, r());          // 이 사람이 '정돈되는' 순간
      // 정돈 전까지의 불규칙한 동선 만들기
      var t = 0, kk = k, s = a.s, dir = a.dir, lat = a.spread * STREETS[k].w * 0.42, guard = 0;
      var end = a.tsw < 0 ? 0 : a.tsw;
      while (t < end && guard++ < 400) {
        var S = STREETS[kk], toward = T1 > 0 ? clamp((t - T0 * 0.75) / (T1 - T0 * 0.75), 0, 1) : 0;
        var lat1 = (r() * 2 - 1) * S.w * 0.42, roll = r(), v = a.v * (0.7 + r() * 0.5);
        if (roll < (nearStall(kk, s) ? 0.45 : 0.2) * (1 - toward * 0.7)) {          // 멈춤 (노점 앞에서 더 자주)
          var dur = 25 + r() * 70;
          a.legs.push({ t0: t, d: dur, k: kk, s0: s, ds: 0, l0: lat, l1: lat }); t += dur; continue;
        }
        if (roll < 0.36 * (1 - toward * 0.8)) dir = -dir;                          // 돌아가기
        var dist = 40 + r() * 140, target = null;
        CROSS[kk].forEach(function (c) { var dd = (c.s - s) * dir; if (dd > 6 && dd < dist && (!target || dd < (target.s - s) * dir)) target = c; });
        var ds = target ? target.s - s : dir * dist;
        if (s + ds < 0) ds = -s; if (s + ds > S.len) ds = S.len - s;
        if (Math.abs(ds) < 4) { dir = -dir; continue; }
        var d2 = Math.abs(ds) / v;
        a.legs.push({ t0: t, d: d2, k: kk, s0: s, ds: ds, l0: lat, l1: lat1 }); t += d2; s += ds; lat = lat1;
        var turnP = 0.25 + toward * 0.5;                                            // 정돈될 무렵엔 골목으로 흩어짐
        if (target && r() < turnP) { kk = target.to; s = target.s2; var S2 = STREETS[kk]; dir = s < 20 ? 1 : s > S2.len - 20 ? -1 : (r() < 0.5 ? 1 : -1); lat = clamp(lat, -S2.w * 0.42, S2.w * 0.42); }
      }
      if (a.tsw < 0) { a.tsw = 0; }
      a.ok = kk; a.os = s; a.odir = dir; a.olat = lat; a.ot = Math.max(t, a.tsw);
      list.push(a);
    }
    return list;
  }
  // t 시점의 위치 [x, y, 길 위 거리 s, 길 번호]
  function agentAt(a, t, chaosJitter) {
    var L = a.legs;
    if (L.length && t < a.ot) {
      var lo = 0, hi = L.length - 1;
      if (t <= L[0].t0) hi = 0;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (L[mid].t0 <= t) lo = mid; else hi = mid - 1; }
      var g = L[lo], f = clamp((t - g.t0) / g.d, 0, 1), S = STREETS[g.k];
      var s = g.s0 + g.ds * f, lat = lerp(g.l0, g.l1, f);
      if (chaosJitter) lat += Math.sin(t * 0.05 + a.ph) * S.w * 0.04;
      var p = pointOn(S, s, lat); p.push(s, g.k); return p;
    }
    // 정돈된 흐름: 자기 방향 차선으로 길 끝까지 갔다가 돌아옴
    var S2 = STREETS[a.ok], len = S2.len, tt = Math.max(0, t - a.ot);
    var raw = a.os + a.odir * a.v * tt, per = 2 * len, m = ((raw % per) + per) % per;
    var s2 = m <= len ? m : per - m, dir2 = (m <= len ? 1 : -1) * (a.odir > 0 ? 1 : 1);
    var goingUp = ((raw % per) + per) % per <= len;
    var d = goingUp ? 1 : -1;
    var laneLat = d * S2.w * 0.27 + a.spread * S2.w * 0.06;
    var blend = clamp(tt / 40, 0, 1);
    var p2 = pointOn(S2, s2, lerp(a.olat, laneLat, blend)); p2.push(s2, a.ok); return p2;
  }
  var ROBOTS = [];
  (function () {
    var r = rng(29);
    for (var i = 0; i < 7; i++) {
      var st = i < 4 ? STREETS[0] : STREETS[1];
      ROBOTS.push({ st: st, s0: r() * st.len, dir: r() < 0.5 ? 1 : -1, lane: (r() < 0.5 ? -1 : 1) * st.w * 0.2 });
    }
  })();

  /* ---------- 은은히 흐르는 릴레이 빛 (도시 전체 장면) ---------- */
  var PULSES = [];
  (function () {
    var r = rng(404);
    for (var i = 0; i < 16; i++) {
      var st = STREETS[(r() * STREETS.length) | 0];
      PULSES.push({ st: st, s0: r() * st.len, dir: r() < 0.5 ? 1 : -1, v: 0.5 + r() * 0.5, lat: (r() * 2 - 1) * st.w * 0.2 });
    }
  })();

  /* ---------- 건물 배치 (2D 지도와 3D 거리가 똑같이 쓰도록 한 곳에서 만듦) ---------- */
  var BUILDINGS = (function () {
    var pts = [];
    STREETS.forEach(function (s) { for (var d = -80; d < s.len + 80; d += 7) { var p = pointOn(s, d, 0); pts.push(p[0], p[1], s.w / 2 + 3); } });
    function blocked(x0, z0, x1, z1) {
      for (var i = 0; i < pts.length; i += 3) { var m = pts[i + 2]; if (pts[i] > x0 - m && pts[i] < x1 + m && pts[i + 1] > z0 - m && pts[i + 1] < z1 + m) return true; }
      return false;
    }
    var R = rng(31), list = [];
    for (var i = 0; i < 2600 && list.length < 520; i++) {
      var w = 34 + R() * 80, d = 30 + R() * 70, x = -260 + R() * 2120, z = -220 + R() * 1440;
      if (blocked(x - w / 2, z - d / 2, x + w / 2, z + d / 2)) continue;
      list.push({ x: x, z: z, w: w, d: d, h: 70 + Math.pow(R(), 1.6) * 240, tone: (R() * 6) | 0, cap: R() < 0.35, cx: R() - 0.5, cz: R() - 0.5, ch: 8 + R() * 10 });
    }
    return list;
  })();

  /* ---------- 바탕 (무광 블록 건물 + 길) 한 번만 그려 둠 — 낮 / 밤 두 장 ---------- */
  function buildBase(scale, night) {
    var c = document.createElement("canvas");
    c.width = W * scale; c.height = H * scale;
    var g = c.getContext("2d");
    g.scale(scale, scale);
    var P = night ? { bg: "#22241E", roof: ["#34362F", "#3A3B33", "#2E3029"], street: "#46473E", edge: "rgba(0,0,0,.25)", shadow: "rgba(0,0,0,.35)", hi: "rgba(255,253,244,.05)" }
                  : { bg: "#E9E2CC", roof: ["#F3EEDD", "#EFE9D6", "#E6DFC8", "#F7F3E6"], street: COL.street, edge: "rgba(47,49,43,.07)", shadow: "rgba(47,49,43,.13)", hi: "rgba(255,255,255,.55)" };
    g.fillStyle = P.bg; g.fillRect(0, 0, W, H);
    var r = rng(11), blocks = BUILDINGS.map(function (b) { return { x: b.x - b.w / 2, y: b.z - b.d / 2, w: b.w, h: b.d, t: b.tone / 6, d: r(), lit: r(), hh: b.h }; });
    blocks.sort(function (a, b) { return a.y - b.y; });
    blocks.forEach(function (b) {
      var sh = 3 + b.hh * 0.03;
      g.fillStyle = P.shadow; roundRect(g, b.x + sh * 0.7, b.y + sh, b.w, b.h, 6); g.fill();       // 그림자 (높이감)
      var gr = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      var base = P.roof[(b.t * P.roof.length) | 0];
      gr.addColorStop(0, base); gr.addColorStop(1, night ? "#2A2C26" : "#E2DAC2");
      g.fillStyle = gr; roundRect(g, b.x, b.y, b.w, b.h, 6); g.fill();
      g.strokeStyle = P.hi; g.lineWidth = 1.2; g.beginPath(); g.moveTo(b.x + 5, b.y + 1); g.lineTo(b.x + b.w - 6, b.y + 1); g.stroke();
      if (b.d < 0.35) { g.fillStyle = night ? "rgba(255,253,244,.05)" : "rgba(47,49,43,.06)"; roundRect(g, b.x + 7, b.y + 7, b.w * 0.3, b.h * 0.3, 3); g.fill(); }
      if (night && b.lit < 0.45) { // 밤: 옥상 불빛
        g.fillStyle = "rgba(255,226,140," + (0.25 + b.lit) + ")";
        g.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.4, 3, 3); g.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, 3, 3);
      }
    });
    STREETS.forEach(function (st) {
      g.strokeStyle = P.street; g.lineWidth = st.w; g.lineCap = "round";
      g.beginPath(); g.moveTo(st.pts[0][0], st.pts[0][1]); g.lineTo(st.pts[1][0], st.pts[1][1]); g.stroke();
    });
    STREETS.forEach(function (st) {
      // 건물이 길 위에 드리운 그림자 (왼쪽 위에서 빛)
      var side = (st.nx + st.ny) < 0 ? 1 : -1;
      var a = pointOn(st, 0, side * (st.w / 2 - 5)), b = pointOn(st, st.len, side * (st.w / 2 - 5));
      g.strokeStyle = P.edge; g.lineWidth = 10; g.lineCap = "butt";
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      if (st.kind === "main") {
        var m1 = pointOn(st, 0, 0), m2 = pointOn(st, st.len, 0);
        g.setLineDash([10, 14]); g.strokeStyle = night ? "rgba(255,253,244,.06)" : "rgba(47,49,43,.05)"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.stroke(); g.setLineDash([]);
      }
    });
    return c;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  /* 빛 번짐용 동그란 빛 */
  var GLOW = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,240,170,1)"); gr.addColorStop(0.25, "rgba(242,217,75,.75)"); gr.addColorStop(1, "rgba(242,217,75,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  })();

  /* ---------- 지도 하나 만들기 ---------- */
  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var agents = makeAgents(opts.agents || 600, opts.seed || 7, opts.switchT);
    var base = null, baseN = null, dpr = 1, cw = 0, ch = 0;
    var view = { k: 1, ox: 0, oy: 0 };

    function resize() {
      // 화면에서 확대·기울이기 전의 원래 크기를 씁니다
      dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.5);
      cw = Math.max(1, canvas.clientWidth); ch = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      if (!base) { base = buildBase(1.5, false); baseN = buildBase(1.2, true); }
    }
    function setView(zoom, fx, fy) {
      var k = Math.max(cw / W, ch / H) * zoom;
      view.k = k; view.ox = cw / 2 - fx * k; view.oy = ch / 2 - fy * k;
    }
    function toScreen(x, y) { return [view.ox + x * view.k, view.oy + y * view.k]; }
    function glow(x, y, r, a) { if (a <= 0.01) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(GLOW, x - r, y - r, r * 2, r * 2); }

    function render(st) {
      if (!cw) resize();
      var t = st.t, org = st.org || 0, dark = st.dark || 0, chaos = 1 - org, trail = st.trail || 0;
      setView(st.zoom || 1, st.fx == null ? W / 2 : st.fx, st.fy == null ? H / 2 : st.fy);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.fillStyle = "#E9E2CC"; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.ox, dpr * view.oy);
      ctx.drawImage(base, 0, 0, W, H);
      if (dark > 0.01) { ctx.globalAlpha = Math.min(1, dark * 1.15); ctx.drawImage(baseN, 0, 0, W, H); ctx.globalAlpha = 1; }

      /* 사람 위치 + 큰길 밀도 */
      var bins = new Float32Array(36), n = agents.length;
      var pos = new Float32Array(n * 5);
      for (var i = 0; i < n; i++) {
        var a = agents[i];
        var alpha = 1 - 0.55 * dark;
        var p = agentAt(a, t, chaos > 0.05);
        pos[i * 5] = p[0]; pos[i * 5 + 1] = p[1]; pos[i * 5 + 2] = alpha;
        if (Math.abs(trail) > 0.5) { var q = agentAt(a, t - trail, chaos > 0.05); pos[i * 5 + 3] = q[0]; pos[i * 5 + 4] = q[1]; }
        else { pos[i * 5 + 3] = p[0]; pos[i * 5 + 4] = p[1]; }
        if (p[3] === 0) bins[Math.min(35, (p[2] / MAIN.len * 36) | 0)] += 1;
      }
      var maxBin = 0; for (var b = 0; b < 36; b++) maxBin = Math.max(maxBin, bins[b]);
      function density(s) { return maxBin ? bins[Math.min(35, (s / MAIN.len * 36) | 0)] / maxBin : 0; }

      /* 바닥 조명 (2028~): 덜 붐비는 곳이 더 밝게 */
      var floor = st.floor || 0;
      if (floor > 0.01) {
        [MAIN, STREETS[1]].forEach(function (stt) {
          for (var s = 20; s < stt.len - 20; s += 26) {
            var d = stt === MAIN ? density(s) : 0.35;
            var al = floor * (0.2 + 0.6 * (1 - d)) * (0.75 + 0.5 * dark);
            [-1, 1].forEach(function (side) {
              var p1 = pointOn(stt, s, side * (stt.w / 2 - 7)), p2 = pointOn(stt, s + 14, side * (stt.w / 2 - 7));
              if ((s / 26 | 0) % 2 === 0) glow((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 16 + 10 * dark, al * (0.35 + 0.6 * dark));
              ctx.globalAlpha = clamp(al * 1.2, 0, 1); ctx.strokeStyle = "#FFE680"; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
            });
          }
        });
        ctx.globalAlpha = 1;
      }

      /* 간판 (2027~ 밀도에 따라 노랗게 빛남) */
      var tint = st.tint || 0;
      for (var j = 0; j < SIGNS.length; j++) {
        var sg = SIGNS[j];
        var k2 = tint * clamp((sg.st === MAIN ? density(sg.s) : 0.15) * 1.4, 0, 1);
        var lit = clamp(k2 + dark * (j % 3 === 0 ? 0.9 : 0.35), 0, 1);
        if (lit > 0.05) glow(sg.x, sg.y, 16 + 6 * lit, lit * 0.8);
        ctx.save(); ctx.translate(sg.x, sg.y); ctx.rotate(sg.ang);
        ctx.globalAlpha = 1; ctx.fillStyle = sg.tone; ctx.fillRect(-sg.w / 2, -sg.h / 2, sg.w, sg.h);
        if (lit > 0.02) { ctx.globalAlpha = lit; ctx.fillStyle = "#FFE45E"; ctx.fillRect(-sg.w / 2, -sg.h / 2, sg.w, sg.h); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      /* 노점 */
      for (var q2 = 0; q2 < STALLS.length; q2++) {
        var sp = STALLS[q2].p;
        if (dark > 0.05) glow(sp[0], sp[1], 22, dark * 0.7);
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(sp[0], sp[1]); ctx.rotate(Math.atan2(MAIN.uy, MAIN.ux));
        ctx.fillStyle = "rgba(47,49,43,.18)"; roundRect(ctx, -8, -4, 18, 12, 3); ctx.fill();
        ctx.fillStyle = COL.sub; roundRect(ctx, -9, -6, 18, 12, 3); ctx.fill();
        ctx.fillStyle = COL.dnaPale; roundRect(ctx, -9, -6, 18, 4, 2); ctx.fill();
        ctx.restore();
      }

      /* 골목 테이블 (2030에 하나둘 켜짐) */
      var tables = st.tables || 0;
      if (tables > 0.01) {
        for (var u = 0; u < TABLES.length; u++) {
          var tb = TABLES[u], on = clamp(tables * 1.6 - (u / TABLES.length) * 0.6, 0, 1);
          if (on <= 0) continue;
          glow(tb.x, tb.y, 18, on * 0.7);
          ctx.save(); ctx.translate(tb.x, tb.y); ctx.rotate(tb.ang); ctx.globalAlpha = on;
          ctx.fillStyle = "#FFFFFF"; roundRect(ctx, -6, -4, 12, 8, 2); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      /* 사람: 스크롤이 빠를수록 길게 남는 잔상 (타임랩스) */
      var pc = dark > 0.5 ? "#FFF3C8" : COL.crowd;
      ctx.strokeStyle = pc; ctx.fillStyle = pc; ctx.lineCap = "round";
      for (var m2 = 0; m2 < n; m2++) {
        var al2 = pos[m2 * 5 + 2];
        if (al2 <= 0.02) continue;
        var x1 = pos[m2 * 5], y1 = pos[m2 * 5 + 1], x0 = pos[m2 * 5 + 3], y0 = pos[m2 * 5 + 4];
        var dd = Math.abs(x1 - x0) + Math.abs(y1 - y0);
        if (dd > 1.2 && dd < 140) {
          ctx.globalAlpha = al2 * 0.32; ctx.lineWidth = 4.6;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.globalAlpha = al2 * 0.88;
        ctx.beginPath(); ctx.arc(x1, y1, 3.1, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* 배송 로봇 (새벽) */
      if (dark > 0.02) {
        ROBOTS.forEach(function (rb) {
          var s = ((rb.s0 + rb.dir * 1.9 * t) % rb.st.len + rb.st.len) % rb.st.len;
          var p = pointOn(rb.st, s, rb.lane), ang = Math.atan2(rb.st.uy, rb.st.ux) + (rb.dir < 0 ? Math.PI : 0);
          glow(p[0] + Math.cos(ang) * 14, p[1] + Math.sin(ang) * 14, 26, dark);
          ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
          ctx.globalAlpha = dark;
          ctx.fillStyle = COL.bg; roundRect(ctx, -10, -6, 20, 12, 5); ctx.fill();
          ctx.fillStyle = COL.point; ctx.beginPath(); ctx.arc(8, 0, 2.6, 0, 6.283); ctx.fill();
          ctx.restore();
        });
        ctx.globalAlpha = 1;
      }

      /* 도시 전체: 은은하게 흐르는 릴레이 빛 */
      var pulses = st.pulses || 0;
      if (pulses > 0.01) {
        PULSES.forEach(function (pl, idx) {
          var s = ((pl.s0 + pl.dir * pl.v * t * 0.6) % pl.st.len + pl.st.len) % pl.st.len;
          var a = clamp(pulses * 1.5 - idx / PULSES.length * 0.5, 0, 1);
          var hp = pointOn(pl.st, s, pl.lat);
          glow(hp[0], hp[1], 20, a * 0.8);
          for (var tail = 0; tail < 9; tail++) {
            var p = pointOn(pl.st, s - pl.dir * tail * 7, pl.lat);
            ctx.globalAlpha = a * (1 - tail / 9) * 0.9; ctx.fillStyle = COL.point;
            ctx.beginPath(); ctx.arc(p[0], p[1], 4.2 - tail * 0.3, 0, 6.283); ctx.fill();
          }
        });
        ctx.globalAlpha = 1;
      }

      /* 도시 전체: 제품을 잇는 릴레이 선 */
      if (st.route && st.route.prog > 0) drawRoute(st.route.pts, st.route.prog);
      if (st.markers) {
        st.markers.forEach(function (mk) {
          if (mk.on <= 0) return;
          glow(mk.x, mk.y, 40 + 16 * mk.pulse, mk.on * 0.8);
          ctx.globalAlpha = mk.on;
          ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(mk.x, mk.y, 9, 0, 6.283); ctx.fill();
          ctx.fillStyle = "#FFE86A"; ctx.beginPath(); ctx.arc(mk.x, mk.y, 5, 0, 6.283); ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
    }

    function drawRoute(pts, prog) {
      var lens = [], tot = 0;
      for (var i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(d); tot += d; }
      var left = tot * clamp(prog, 0, 1), head = pts[0];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      [[26, hexA(COL.point, 0.14)], [12, hexA(COL.point, 0.3)], [4.5, "#FFE45E"]].forEach(function (pass) {
        ctx.strokeStyle = pass[1]; ctx.lineWidth = pass[0];
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        var rem = left;
        for (var i = 1; i < pts.length && rem > 0; i++) {
          var f = Math.min(1, rem / lens[i - 1]);
          head = [lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)];
          ctx.lineTo(head[0], head[1]); rem -= lens[i - 1];
        }
        ctx.stroke();
      });
      if (prog < 1) glow(head[0], head[1], 34, 1);
      ctx.globalAlpha = 1;
    }

    resize();
    return { resize: resize, render: render, toScreen: toScreen };
  }
  /* 도시 장면에서 쓰는 제품 위치 (지도 좌표) — 01은 골목 테이블 */
  var PRODUCT_SPOTS = [
    pointOn(STREETS[2], 330, 0),   // 01 골목 a1
    pointOn(STREETS[1], 760, 0),   // 02 교차로 남쪽
    pointOn(STREETS[0], 1250, -20),// 03 큰길 동쪽
    pointOn(STREETS[8], 290, 0)    // 04 골목 a7
  ];
  var ROUTE = [
    PRODUCT_SPOTS[0], pointOn(STREETS[2], 474, 0), pointOn(STREETS[0], 820, 0),
    PRODUCT_SPOTS[1], pointOn(STREETS[1], 560, 0), pointOn(STREETS[0], 1080, 0),
    PRODUCT_SPOTS[2], pointOn(STREETS[0], 1465, 0), pointOn(STREETS[8], 575, 0), PRODUCT_SPOTS[3]
  ];
  var ROUTE_STOPS = [0, 3, 6, 9]; // ROUTE 안에서 제품이 있는 순서

  window.MDMap = { create: create, buildings: BUILDINGS, streets: STREETS, pointOn: pointOn, signs: SIGNS, tables: TABLES, stalls: STALLS, makeAgents: makeAgents, agentAt: agentAt, W: W, H: H, spots: PRODUCT_SPOTS, route: ROUTE, routeStops: ROUTE_STOPS };
})();
