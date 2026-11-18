/* =========================================================
   MYEONGDONG 2030 — 스크롤 연출
   스크롤 위치(0~1)를 읽어서 장면을 그립니다. 스크롤을 멈추면 장면도 멈추고,
   위로 올리면 거꾸로 재생됩니다. (스크롤을 강제로 넘기지 않습니다)
   ========================================================= */
(function () {
  "use strict";
  var CFG = window.MD_CONFIG, TXT = window.MD_CONTENT, ART = window.MDArt, MAP = window.MDMap;
  var doc = document, root = doc.documentElement;
  try {
    if (sessionStorage.getItem("md-restart")) { sessionStorage.removeItem("md-restart"); if ("scrollRestoration" in history) history.scrollRestoration = "manual"; window.scrollTo(0, 0); }
  } catch (er) {}
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) root.classList.add("rm");

  /* ---------- 작은 도구들 ---------- */
  function $(id) { return doc.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function smooth(a, b, v) { var t = seg(v, a, b); return t * t * (3 - 2 * t); }
  function bezier(p) { // cubic-bezier → 함수
    var x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    function bx(t) { return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t; }
    function by(t) { return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t; }
    function dx(t) { return 3 * (1 - 3 * x2 + 3 * x1) * t * t + 2 * (3 * x2 - 6 * x1) * t + 3 * x1; }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) { var d = dx(t); if (Math.abs(d) < 1e-6) break; t -= (bx(t) - x) / d; }
      return by(clamp(t, 0, 1));
    };
  }
  var inOut = bezier(CFG.easing.inOut), out = bezier(CFG.easing.out);
  function kf(list, u) { // [[u, 값], ...] 사이를 이어 줌
    if (u <= list[0][0]) return list[0][1];
    for (var i = 1; i < list.length; i++) {
      if (u <= list[i][0]) { var a = list[i - 1], b = list[i]; return lerp(a[1], b[1], (u - a[0]) / (b[0] - a[0])); }
    }
    return list[list.length - 1][1];
  }
  function get(obj, path) { return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, obj); }
  function setT(el, tf, op) { if (tf != null) el.style.transform = tf; if (op != null) el.style.opacity = op; }

  var vw = 0, vh = 0, mobile = false;

  /* =========================================================
     1. 문구 채우기 (content.js → 화면)
     ========================================================= */
  Array.prototype.forEach.call(doc.querySelectorAll("[data-t]"), function (el) {
    var v = get(TXT, el.getAttribute("data-t"));
    if (v != null) el.textContent = v;
  });
  (function () {
    var lines = TXT.outro.line.split("\n"), last = lines.pop();
    var o = $("oLine"); o.textContent = lines.join("\n") + (lines.length ? "\n" : "");
    var em = doc.createElement("em"); em.textContent = last; o.appendChild(em);
  })();

  /* 연도 막대 */
  var ticks = [];
  for (var ti = 0; ti < 5; ti++) {
    var sp = doc.createElement("span"), b = doc.createElement("b");
    sp.appendChild(b); $("ticks").appendChild(sp); ticks.push(b);
  }

  /* What Changed 간판 6개 */
  var SIGN_LAYOUT = [
    { c: "h f-yellow", l: 0,  t: 4,  w: 30, hang: 5,  d: .18 },
    { c: "v f-ink",    l: 37, t: 0,  hang: 3,  d: .42 },
    { c: "h f-pale",   l: 52, t: 16, w: 24, hang: 10, d: .28 },
    { c: "v f-char",   l: 87, t: 4,  hang: 4,  d: .5 },
    { c: "h f-sand",   l: 8,  t: 50, w: 26, hang: 7,  d: .34 },
    { c: "v f-yellow", l: 62, t: 54, hang: 6,  d: .22 }
  ];
  var signEls = [];
  TXT.world.signs.forEach(function (text, i) {
    var L = SIGN_LAYOUT[i % SIGN_LAYOUT.length];
    var el = doc.createElement("div");
    el.className = "sign " + L.c.split(" ")[0];
    el.style.left = L.l + "%"; el.style.top = L.t + "%";
    
    if (L.w) el.style.setProperty("--w", L.w + "vw");
    var inner = doc.createElement("div");
    inner.className = "sign-in rv " + L.c.split(" ")[1];
    inner.style.setProperty("--i", i % 3);
    inner.style.setProperty("--hang", L.hang + "vw");
    var sm = doc.createElement("small"); sm.textContent = (i < 9 ? "0" : "") + (i + 1);
    inner.appendChild(sm); inner.appendChild(doc.createTextNode(text));
    el.appendChild(inner); $("signs").appendChild(el);
    signEls.push({ el: el, inner: inner, d: L.d, top: 0, h: 0 });
  });

  /* 제품 카드 */
  var FACES = ["#F5E7B6", "#EFE9D6", "#F7F5E8", "#E6DFC8"];
  TXT.products.forEach(function (p, i) {
    var a = doc.createElement("a");
    a.className = "card rv"; a.href = p.page; a.style.background = FACES[i % 4]; a.style.setProperty("--i", i);
    var img = doc.createElement("img"); img.src = p.card; img.alt = p.name; img.loading = "lazy";
    var info = doc.createElement("div"); info.className = "card-info";
    var no = doc.createElement("div"); no.className = "card-no"; no.textContent = p.no;
    var nm = doc.createElement("div"); nm.className = "card-name";
    var nmt = doc.createElement("span"); nmt.textContent = p.name;
    var ar = doc.createElement("span"); ar.className = "arr"; ar.textContent = "↗";
    nm.appendChild(nmt); nm.appendChild(ar);
    var ln = doc.createElement("div"); ln.className = "card-line"; ln.textContent = p.line;
    info.appendChild(no); info.appendChild(nm); info.appendChild(ln);
    a.appendChild(img); a.appendChild(info); $("grid").appendChild(a);
  });

  /* 그림 넣기 */
  $("oArt").innerHTML = ART.street({ seed: 41, night: true });
  var O = { cv: null, done: "" };                        // v4.1: 마지막 야경은 실제 3D 거리 (밤)
  function outroNight() {
    if (!C3D.ok || !C3D.modelsReady) return;
    var el = $("oArt"), key = el.clientWidth + "x" + el.clientHeight;
    if (O.done === key) return;
    if (!O.cv) { O.cv = doc.createElement("canvas"); O.cv.className = "o-3d"; el.appendChild(O.cv); }
    if (C3D.snapshot(O.cv, C3D.nightKey(), { dark: 1, floor: 1, tables: 1 }, 9400)) {
      O.done = key; requestAnimationFrame(function () { O.cv.classList.add("is-on"); });
    }
  }
  $("rBg").innerHTML = ART.relayBg();
  $("rTrack").innerHTML = ART.relayTrack(TXT.products);

  /* 도시 지도 위 제품 이름표 */
  var markerEls = TXT.products.map(function (p) {
    var d = doc.createElement("div"); d.className = "mk";
    var a = doc.createElement("a"); a.href = p.page;
    var b = doc.createElement("b"); b.textContent = p.no.replace(/[^0-9]/g, "");
    var s = doc.createElement("span"); s.textContent = p.name;
    var arr = doc.createElement("span"); arr.className = "arr"; arr.textContent = "↗";
    a.appendChild(b); a.appendChild(s); a.appendChild(arr); d.appendChild(a);
    if ($("cMarkers")) $("cMarkers").appendChild(d); return d;
  });

  /* =========================================================
     2. 지도 두 개 (① ② ③ 장면, ⑥ 장면)
     ========================================================= */
  mobile = window.innerWidth <= CFG.mobileWidth;
  var nAgents = mobile ? CFG.agents.mobile : CFG.agents.desktop;
  /* 연도: 각 해에서 잠깐 머문 뒤 다음 해로 (사람들은 계속 움직임) */
  function yearAt(p) {
    var u = seg(p, 0.1, 0.78) * 4.5, k = Math.min(3, Math.floor(u)), f = Math.min(1, u - k);   // 마지막 0.5 = 2030에 머묾
    return CFG.yearStart + k + inOut(seg(f, 1 - CFG.yearMove, 1));
  }
  function tAtYear(y) { for (var q = 0; q <= 1; q += 0.0005) if (yearAt(q) >= y) return q * CFG.timelapseSpeed; return CFG.timelapseSpeed; }
  var SWITCH_T = [tAtYear(2027.75), tAtYear(2029.55)];   // 이 사이에 사람들이 하나둘 정돈됨
  window.MD_SWITCH_T = SWITCH_T;                           // 3D 거리의 사람들도 같은 시점에 정돈됨
  var mapA = MAP.create($("mapA"), { agents: nAgents, switchT: SWITCH_T });
  var mapD = $("mapD") ? MAP.create($("mapD"), { agents: nAgents, switchT: SWITCH_T }) : null;
  var mapS = MAP.create($("mapS"), { agents: nAgents, switchT: SWITCH_T, seed: 19 });   // 3D가 안 되는 기기용

  /* 릴레이 경로의 길이 비율 (제품 위치까지 얼마나 왔는지) */
  var routeLens = [0];
  for (var ri = 1; ri < MAP.route.length; ri++) {
    routeLens.push(routeLens[ri - 1] + Math.hypot(MAP.route[ri][0] - MAP.route[ri - 1][0], MAP.route[ri][1] - MAP.route[ri - 1][1]));
  }
  var routeTotal = routeLens[routeLens.length - 1];
  var stopFrac = MAP.routeStops.map(function (k) { return routeLens[k] / routeTotal; });
  function routePoint(fr) {
    var d = clamp(fr, 0, 1) * routeTotal;
    for (var i = 1; i < routeLens.length; i++) if (d <= routeLens[i]) {
      var t = (d - routeLens[i - 1]) / (routeLens[i] - routeLens[i - 1] || 1);
      return [lerp(MAP.route[i - 1][0], MAP.route[i][0], t), lerp(MAP.route[i - 1][1], MAP.route[i][1], t)];
    }
    return MAP.route[MAP.route.length - 1];
  }

  /* =========================================================
     3. 크기 맞추기
     ========================================================= */
  var scenes = {
    A: { el: $("top"), screens: CFG.scroll.sceneA },
    C: { el: $("relay"), screens: CFG.scroll.relayIntro + relayTotal() },
    D: { el: $("city"), screens: CFG.scroll.sceneD }
  };
  if (!scenes.D.el) delete scenes.D;                       // v4.2: 동선 장면은 제품 고르기 화면으로 합침
  var relayGeo = { S: 1, X0: 0, top: 0 };
  // 릴레이 01 은 실제 3D (노점 → 골목 테이블) 라서 조금 더 길게
  // 릴레이 보기 방식: 기본은 2D 실루엣, 원하면 3D (선택은 이 브라우저에 기억)
  var RELAY_MODE = "3d";   // v6: 기본은 3D (2D 를 고르면 기억)
  try { if (localStorage.getItem("md_relay") === "2d") RELAY_MODE = "2d"; } catch (e) {}
  function relay3dCan() { return !reduced && !window.MD_LITE && !!window.THREE && !!window.City3D; }
  function relay3dOn() { return RELAY_MODE === "3d" && relay3dCan(); }
  // v4.5: 구간 순서 01 FLOWAY · 02 STAY-GAP · 03 FOLD MARK → STREET FOLD · 04 NAVIAR — 3D 를 고르면 03 구간이 길어짐
  var SF_SEG = 2;
  function relayLens() { var on3 = relay3dOn(), per = on3 ? (CFG.scroll.relay3dPer || 6) : CFG.scroll.relayPerPerson, L = [per, per, per, per]; if (on3) L[SF_SEG] = CFG.scroll.relayFirst || 6; return L; }
  function relayTotal() { return relayLens().reduce(function (a, b) { return a + b; }, 0); }
  function relayLen0() { return relayLens()[SF_SEG]; }
  function relayU(s) {   // 스크롤 → 구간 (0~4)
    var L = relayLens(), x = s - CFG.scroll.relayIntro;
    if (x <= 0) return 0;
    for (var k = 0; k < 4; k++) { if (x < L[k] || k === 3) return clamp(k + x / L[k], 0, 4); x -= L[k]; }
    return 4;
  }
  scenes.C.screens = CFG.scroll.relayIntro + relayTotal();   // v6: 기본이 3D 라서, 3D 길이로 다시 계산
  var lastW = -1;
  (function () {
    var box = $("rMode"); if (!box) return;
    var bs = Array.prototype.slice.call(box.querySelectorAll("[data-rmode]"));
    if (!relay3dCan()) { box.style.display = "none"; return; }
    function paint() { bs.forEach(function (b) { var on = b.getAttribute("data-rmode") === RELAY_MODE; b.classList.toggle("is-on", on); b.setAttribute("aria-checked", on); }); }
    paint();
    bs.forEach(function (b) { b.addEventListener("click", function () {
      var m = b.getAttribute("data-rmode"); if (m === RELAY_MODE) return;
      // 지금 릴레이 안에서 어디쯤인지 기억했다가, 길이가 바뀐 뒤 같은 비율 자리로
      var sc = scenes.C, f = sc.h ? clamp((window.pageYOffset - sc.top) / Math.max(1, sc.h - vh), 0, 1) : 0;
      RELAY_MODE = m; try { localStorage.setItem("md_relay", m); } catch (e) {}
      paint();
      if (m === "3d") C3D.init();
      sc.screens = CFG.scroll.relayIntro + relayTotal();
      layout(true);
      doc.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, Math.round(sc.top + f * (sc.h - vh)));
      doc.documentElement.style.scrollBehavior = "";
      if (m === "2d" && R3.el) R3.el.style.opacity = 0;
    }); });
  })();

  function layout(force) {
    var w = window.innerWidth;
    vh = window.innerHeight; vw = w;
    mobile = w <= CFG.mobileWidth;
    // 모바일에서 주소창이 접혔다 펴질 때 높이만 바뀌면 다시 계산하지 않습니다 (화면이 튀지 않게)
    if (force || w !== lastW) {
      lastW = w;
      Object.keys(scenes).forEach(function (k) {
        scenes[k].el.style.height = Math.round((scenes[k].screens + 1) * vh) + "px";
      });
      mapA.resize(); if (mapD) mapD.resize(); mapS.resize();
      if (C3D.ok) C3D.resize(); keyCache = {};
      // 릴레이 무대 크기 (데스크톱: 한 구간 1600 전체 / 모바일: 가운데 700만 크게)
      var W0 = mobile ? 480 : -260, Wn = mobile ? 800 : 1600;
      var S = Math.min(w / Wn, vh / 900);
      relayGeo.S = S; relayGeo.X0 = (w - Wn * S) / 2 - W0 * S; relayGeo.top = vh - 900 * S;
      [$("rTrack"), $("rBg")].forEach(function (el) { el.style.width = 6400 * S + "px"; el.style.height = 900 * S + "px"; });
    }
    Object.keys(scenes).forEach(function (k) {
      var r = scenes[k].el.getBoundingClientRect();
      scenes[k].top = r.top + window.pageYOffset; scenes[k].h = scenes[k].el.offsetHeight;
    });
    signEls.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      s.top = r.top + window.pageYOffset - (parseFloat(s.el.dataset.ty) || 0); s.h = r.height;
    });
    var o = $("outro").getBoundingClientRect();
    outroTop = o.top + window.pageYOffset; outroBottom = outroTop + o.height;
    dirty = true;
  }
  var outroTop = 0, outroBottom = 0;

  function progress(sc, y) { return clamp((y - sc.top) / Math.max(1, sc.h - vh), 0, 1); }

  /* ---------- 3D 장면 공통 ---------- */
  var C3D = window.City3D, keyCache = {}, idle = { t: 0, last: 0 };
  function mapView(zoom) {              // 2D 지도가 쓰는 확대 비율과 똑같이
    var sz = C3D.size(); return Math.max(sz[0] / MAP.W, sz[1] / MAP.H) * zoom;
  }
  function render3d(which, d, p) {
    var sz = C3D.size(), keyName = which + sz[0] + "x" + sz[1];
    if (!keyCache[keyName]) {
      keyCache[keyName] = which === "A" ? C3D.descentKeys(800, 500, mapView(1.08), sz[1]) : C3D.descentKeys(D.fx, D.fy, mapView(D.zoom), sz[1]);
    }
    var t = (which === "A" ? p : 1) * CFG.timelapseSpeed + idle.t;
    if (which === "A" && d >= 1) C3D.setLook({ dark: 0, floor: 1, tables: 1 });
    C3D.render(C3D.path(keyCache[keyName], inOut(d)), t);
  }

  /* =========================================================
     4. 장면 A — 인트로 · 시간 흐름 · 거리로 내려앉기
     ========================================================= */
  var A = { head: $("aHead"), map: $("aMap"), tilt: $("aTilt"), h3d: $("a3d"), intro: $("aIntro"),
            year: $("aYear"), num: $("yearNum"), cap: $("yearCap"), arrive: $("aArrive"), lastYear: -1 };
  function sceneA(p) {
    var k = inOut(seg(p, 0, 0.1));
    var s0 = mobile ? 0.5 : 0.36, s1 = 1.1, dy0 = (mobile ? 0.06 : 0.07) * vh;
    setT(A.map, "translate3d(0," + (dy0 * (1 - k)).toFixed(1) + "px,0) scale(" + lerp(s0, s1, k).toFixed(4) + ")");
    setT(A.head, "translate3d(0," + (-k * 0.06 * vh).toFixed(1) + "px,0)", (1 - seg(p, 0.015, 0.075)).toFixed(3));
    A.intro.style.opacity = (1 - seg(p, 0, 0.035)).toFixed(3);

    var y = yearAt(p);
    var yi = Math.min(4, Math.floor(y - CFG.yearStart + 1e-6));
    if (yi !== A.lastYear) {
      A.lastYear = yi; A.num.textContent = CFG.yearStart + yi;
      var item = TXT.years[yi]; A.cap.textContent = item ? item.text : "";
    }
    var yfrac = (y - CFG.yearStart) / (CFG.yearEnd - CFG.yearStart) * 5;
    ticks.forEach(function (b, i) { b.style.transform = "scaleX(" + clamp(yfrac - i, 0, 1).toFixed(3) + ")"; });
    var yo = seg(p, 0.08, 0.13) * (1 - seg(p, 0.78, 0.84));
    setT(A.year, mobile ? "translate3d(0," + ((1 - yo) * 12).toFixed(1) + "px,0)" : "translate3d(0,calc(-50% + " + ((1 - yo) * 12).toFixed(1) + "px),0)", yo.toFixed(3));

    // v4.1: 처음부터 3D 도시를 위에서 내려다봄 (2D 지도는 사람 점 · 빛만 투명하게 위에 얹음)
    //       → 내려앉을 때 지도에서 3D로 바뀌는 순간이 없음
    var y2 = yearAt(p);
    var look = { dark: Math.exp(-Math.pow((y2 - 2029) / 0.38, 2)), floor: smooth(2027.55, 2028, y2), tables: smooth(2029.6, 2030, y2) };
    var zoom2 = lerp(1, 1.08, seg(p, 0.1, 0.78));
    var d = seg(p, 0.78, 0.985);
    var use3d = C3D.init();
    if (use3d) {
      C3D.attach(A.h3d);
      A.h3d.style.opacity = 1;
      C3D.setLook(look);
      A.live = d >= 1;
      if (d > 0) render3d("A", d, p);
      else { var sz = C3D.size(); C3D.render(C3D.topDown(800, 500, mapView(zoom2), sz[1], 32), p * CFG.timelapseSpeed + idle.t); }
      A.tilt.style.opacity = (1 - seg(d, 0, 0.06)).toFixed(3);   // 내려가기 시작하면 사람 점이 3D 사람으로 바뀜
    } else {
      A.h3d.style.opacity = 0; A.tilt.style.opacity = 1; A.live = false;
      if (d > 0) A.tilt.style.opacity = (1 - seg(d, 0.6, 1)).toFixed(3);   // 3D가 안 되는 기기: 지도에서 페이드
    }
    var ar = seg(p, 0.93, 0.99);
    setT(A.arrive, "translate3d(0," + ((1 - out(ar)) * 24).toFixed(1) + "px,0)", ar.toFixed(3));

    // 스크롤 속도만큼 사람 점이 잔상을 남김 (멈추면 다시 점)
    var dt = (p - (A.lastP == null ? p : A.lastP)) * CFG.timelapseSpeed; A.lastP = p;
    A.trail = lerp(A.trail || 0, clamp(dt * 9, -55, 55), 0.25);
    if (d < 0.08) {
      mapA.render({
        overlay: use3d,
        t: p * CFG.timelapseSpeed, trail: reduced ? 0 : A.trail,
        org: smooth(2027.6, 2029.6, y), tint: smooth(2026.55, 2027, y), floor: smooth(2027.55, 2028, y),
        dark: Math.exp(-Math.pow((y - 2029) / 0.38, 2)), tables: smooth(2029.6, 2030, y),
        zoom: zoom2, fx: 800, fy: 500
      });
    }
  }

  /* =========================================================
     5. 장면 B — What Changed 간판 (깊이에 따라 다르게 움직임)
     ========================================================= */
  function sceneB(y) {
    if (mobile || reduced) return;
    var mid = y + vh / 2;
    signEls.forEach(function (s) {
      var c = s.top + s.h / 2, off = (c - mid) * -s.d * 0.35;
      if (Math.abs(c - mid) > vh * 1.8) return;
      s.el.dataset.ty = off.toFixed(1);
      s.el.style.transform = "translate3d(0," + off.toFixed(1) + "px,0)";
    });
  }

  /* =========================================================
     6. 장면 C — 사람에서 사람으로, 제품에서 제품으로
     ========================================================= */
  var R = ART.RELAY, G = R.ground;
  var rq = function (id) { return doc.getElementById(id); };
  var C = { track: $("rTrack"), bg: $("rBg"), veil: $("rVeil"), baton: $("rBaton"), intro: $("rIntro"), cap: $("rCap"), seq: $("rSeq"), seqImg: $("rSeqImg"), idx: -1 };
  function actor(id, s) { var a = ART.bindSide(id); a.s = s; return a; }
  var ACT = { tA: actor("r-tA", 1.5), tB: actor("r-tB", 1.42), pA: actor("r-pA", 1.52), pB: actor("r-pB", 1.48), owner: actor("r-owner", 1.45),
              tour: actor("r-tour", 1.5), elder: actor("r-elder", 1.4), worker: actor("r-worker", 1.52) };
  // 사람들의 움직임 (u = 0~4, 구간 번호 / 값 = 무대 위 x 위치)
  var PATH = {
    tour: [[0, 140], [0.16, 600], [0.68, 600], [1.0, 1560], [1.45, 2640], [1.75, 3200]],                 // 01 관광객: 키오스크 → 어르신 곁을 지나감
    elder: [[0.8, 1820], [1.08, 2330], [4, 2330]],                                                   // 02 어르신: 전봇대에 기댐 → 앉음
    tA: [[1.55, 1700], [2.0, 3785], [2.2, 3785], [2.44, 4185]],                                       // 03 커플 (노점 → 골목 테이블)
    tB: [[1.58, 1610], [2.0, 3678], [2.22, 3678], [2.46, 4268]],
    worker: [[2.86, 6620], [3.24, 5545], [3.74, 5545], [4.0, 6400]]                                    // 04 환경미화원 (오른쪽에서 들어옴)
  };
  var FOCUS = [[0, 560, 600], [0.16, 660, 600], [0.66, 660, 600], [1.0, 2150, 640], [1.18, 2340, 640], [1.8, 2340, 680],
               [2.0, 3800, 600], [2.16, 3800, 600], [2.44, 4220, 680], [2.62, 4220, 680], [3.0, 5600, 660], [3.24, 5520, 650], [4, 5520, 650]];
  var FX = FOCUS.map(function (r) { return [r[0], r[1]]; }), FY = FOCUS.map(function (r) { return [r[0], r[2]]; });

  /* 뒤쪽을 지나가는 사람들 (분위기) */
  var amb = [];
  (function () {
    var holder = rq("r-amb"), html = "", fill = ART.mix(CFG.colors.ink, "#E3DBC2", 0.55);
    var looks = [{ style: "coat", hair: "long" }, { style: "pants", hair: "cap", acc: "pack" }, { style: "skirt", hair: "bun" }, { style: "pants", hair: "short", acc: "tote" }, { style: "coat", hair: "pony" }];
    for (var i = 0; i < 14; i++) {
      var o = looks[i % 5]; html += ART.personSide("r-amb" + i, { style: o.style, hair: o.hair, acc: o.acc, fill: fill, back: ART.mix(fill, "#E3DBC2", 0.25), accColor: ART.mix(fill, "#E3DBC2", 0.2), shadow: false });
    }
    holder.innerHTML = html;
    for (var j = 0; j < 14; j++) amb.push({ a: actor("r-amb" + j, 0.82), base: j * 480 + (j % 3) * 110, dir: j % 2 ? 1 : -1, v: 240 + (j % 4) * 50 });
  })();

  function walker(a, path, u, y, dirFixed, extra) {
    var x = kf(path, u), dx = kf(path, u + 0.004) - kf(path, u - 0.004);
    var dir = dirFixed || (dx < -0.01 ? -1 : 1);
    var p = { x: x, y: y, dir: dir, s: a.s, walk: clamp(Math.abs(dx) / 3, 0, 1), phase: dir * x / (150 * a.s) * 2 * Math.PI };
    if (extra) for (var k in extra) p[k] = extra[k];
    var h = ART.poseSide(a, p); h.x = x; return h;
  }
  function pulseRing(el, cx, cy, ph, env) {
    var f = ph - Math.floor(ph), sc = 0.55 + 0.9 * f;
    el.setAttribute("transform", "translate(" + cx + " " + cy + ") scale(" + sc.toFixed(3) + ") translate(" + (-cx) + " " + (-cy) + ")");
    el.setAttribute("opacity", ((1 - f) * env).toFixed(3));
  }
  function setCaption(i) {
    if (i === C.idx) return;
    var first = C.idx < 0; C.idx = i;
    var p = TXT.products[i];
    function fill() {
      $("capNo").textContent = p.no; $("capCount").textContent = "0" + (i + 1) + " / 0" + TXT.products.length;
      $("capName").textContent = p.name; if ($("capLine")) $("capLine").textContent = p.line;
      $("capLink").href = p.page;
    }
    if (first) { fill(); return; }
    var kids = C.cap.children;
    Array.prototype.forEach.call(kids, function (k) { k.style.transition = "opacity .2s linear"; k.style.opacity = 0; });
    clearTimeout(C.tm);
    C.tm = setTimeout(function () { fill(); Array.prototype.forEach.call(kids, function (k) { k.style.opacity = 1; }); }, 200);
  }
  function place(el, x, y, rot, sc, op) {
    el.setAttribute("transform", "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ")" + (rot ? " rotate(" + rot.toFixed(1) + ")" : "") + (sc != null ? " scale(" + sc.toFixed(3) + ")" : ""));
    if (op != null) el.setAttribute("opacity", op);
  }

  /* 영상 프레임 (config.js 의 sequences 에 장수를 적으면 그 제품 장면 대신 이미지가 넘어감) */
  var SEQ = (CFG.sequences || []).map(function (sq) {
    if (!sq || !sq.count) return null;
    var list = [];
    for (var n = 1; n <= sq.count; n++) {
      var num = String(n); while (num.length < (sq.digits || 3)) num = "0" + num;
      var im = new Image(); im.src = sq.path + num + (sq.ext || ".jpg"); list.push(im.src);
    }
    return list;
  });

  var R3 = { el: $("r3d"), on: false };
  function sceneC(p) {
    var per = CFG.scroll.relayPerPerson, intro = CFG.scroll.relayIntro;
    var s = p * (intro + relayTotal());
    var u = relayU(s);
    var i = Math.min(3, Math.floor(u)), fr = u - i;
    var mode3 = relay3dOn() && C3D.init();
    // v6: 3D 를 고르면 구간 사이에 2D 그림이 끼어들지 않게 — 한 구간이 끝나면 어둡게 잠깐 닫혔다가 다음 3D 장면이 열림
    var TR = 0.9, cur = i, uu = fr, dip = 0;
    if (mode3 && i < 3 && fr > TR) { var k = (fr - TR) / (1 - TR); if (k < .5) { dip = k * 2; uu = 1; } else { cur = i + 1; uu = 0; dip = (1 - k) * 2; } }
    var ready3 = function (q) { return q === SF_SEG ? C3D.relayReady : (C3D.teamReady && C3D.teamReady()); };
    var use3d = mode3 && ready3(cur);
    var e = i < 3 ? inOut(seg(fr, mode3 ? 0.88 : 0.6, 1)) : 0;
    var camX = (i + e) * R.seg;
    var S = relayGeo.S, X0 = relayGeo.X0, top = relayGeo.top;

    setT(C.track, "translate3d(" + (X0 - camX * S).toFixed(1) + "px,0,0)");
    setT(C.bg, "translate3d(" + (X0 - camX * S * 0.6).toFixed(1) + "px,0,0)");
    var io = 1 - seg(s, 0.4, 0.85);
    var rm = $("rMode"); if (rm) rm.classList.toggle("is-mini", s > 0.9);
    setT(C.intro, "translate3d(0," + (-(1 - io) * 30).toFixed(1) + "px,0)", io.toFixed(3));
    var co = seg(s, 0.45, 0.85);
    setT(C.cap, "translate3d(0," + ((1 - out(co)) * 20).toFixed(1) + "px,0)", co.toFixed(3));
    setCaption(Math.min(3, i + (e > 0.5 ? 1 : 0)));

    /* ===== 01 FLOWAY: 관광객이 언어를 고르고 → 붐비지 않는 길을 받고 → QR 로 휴대폰에 옮겨 떠남 ===== */
    var pressL = seg(u, 0.18, 0.22) * (1 - seg(u, 0.26, 0.3)), pressD = seg(u, 0.32, 0.36) * (1 - seg(u, 0.42, 0.46)), pressQ = seg(u, 0.5, 0.53) * (1 - seg(u, 0.56, 0.59));
    var phone = seg(u, 0.58, 0.62) * (1 - seg(u, 0.74, 0.8));
    var hT = walker(ACT.tour, PATH.tour, u, G, u > 0.15 && u < 0.69 ? 1 : 0, { reach: Math.max(pressL, pressD, pressQ), reachAng: -58, hold: phone });
    ACT.tour.g.setAttribute("opacity", (1 - seg(u, 1.62, 1.75)).toFixed(2));
    place(rq("r-phone"), hT.hx, hT.hy - 6, 0, null, phone.toFixed(2));
    var ui = seg(u, 0.17, 0.21) * (1 - seg(u, 0.66, 0.72));
    rq("r-fw-ui").setAttribute("opacity", ui.toFixed(2));
    rq("r-fw-s1").setAttribute("opacity", (seg(u, 0.17, 0.2) * (1 - seg(u, 0.31, 0.34))).toFixed(2));
    rq("r-fw-s2").setAttribute("opacity", (seg(u, 0.32, 0.35) * (1 - seg(u, 0.5, 0.53))).toFixed(2));
    rq("r-fw-route").setAttribute("stroke-dashoffset", (420 * (1 - seg(u, 0.35, 0.47))).toFixed(0));
    rq("r-fw-s3").setAttribute("opacity", seg(u, 0.51, 0.54).toFixed(2));
    rq("r-fw-glow").setAttribute("opacity", (0.25 + 0.35 * ui).toFixed(2));
    rq("r-fw-dial").setAttribute("transform", "rotate(" + (pressD * 30 * Math.sin(u * 60)).toFixed(1) + " " + (R.kiosk.x - 7) + " " + (G - 165) + ")");

    /* ===== 02 STAY-GAP: 붐빌 땐 빨강(기대기만) → 사람들이 흩어지면 초록 → 아래 버튼 → 판이 펼쳐지고 앉음 ===== */
    // STEP poses: upper link 0 / 45 / 90 degrees; lower panel 0 / -30.8 / -50.8 degrees in side view.
    var perch = inOut(seg(u, 1.27, 1.35)), seated = inOut(seg(u, 1.55, 1.64));
    var upperAngle = 45 * (perch + seated), lowerAngle = -30.8 * perch - 20 * seated;
    var upperGreen = seg(u, 1.20, 1.23), lowerGreen = seg(u, 1.47, 1.50);
    var ringC = upperGreen > .5 ? "#8acc5c" : "#ce3953";
    rq("r-sg-ring").setAttribute("fill", ringC); rq("r-sg-glow").setAttribute("fill", ringC);
    rq("r-sg-glow").setAttribute("opacity", .22);
    ["sg-led-u-front","sg-led-u-back"].forEach(function(id){rq(id).setAttribute("fill", ringC);});
    ["sg-led-l-front","sg-led-l-back"].forEach(function(id){rq(id).setAttribute("fill", lowerGreen > .5 ? "#8acc5c" : "#ce3953");});
    rq("r-sg-tagR").setAttribute("opacity", 1-upperGreen); rq("r-sg-tagG").setAttribute("opacity", upperGreen);
    rq("r-sg-tagG").querySelector("text").textContent = lowerGreen > .5 ? "앉기 가능" : "걸터앉기 가능";
    rq("r-crowd").setAttribute("opacity", (.95-.45*upperGreen-.35*lowerGreen).toFixed(2));
    rq("r-sg-upper").setAttribute("transform", "rotate("+upperAngle+" 0 -110.05040624)");
    rq("r-sg-seat").setAttribute("transform", "rotate("+(lowerAngle-upperAngle)+" 0 -65.25040624)");
    var lean = seg(u,1.09,1.14)*(1-seg(u,1.23,1.26));
    var pressUpper=seg(u,1.23,1.25)*(1-seg(u,1.27,1.29));
    var pressLower=seg(u,1.50,1.52)*(1-seg(u,1.55,1.57));
    var sitK=.45*seg(u,1.35,1.40)+.55*seg(u,1.64,1.70);
    walker(ACT.elder, PATH.elder, u, G, u>1.08?-1:0, {tilt:-7*lean,reach:Math.max(pressUpper,pressLower),reachAng:-20,sit:sitK,seatY:G-(.687815-.22*Math.cos(upperAngle*Math.PI/180)+.02)*160,seatWeight:seg(u,1.35,1.40),x:lerp(kf(PATH.elder,u),R.pole.x-.14*160-.22*Math.sin(upperAngle*Math.PI/180)*160,seg(u,1.35,1.40))});
    ACT.elder.g.setAttribute("opacity", seg(u,.8,.9).toFixed(2));

    /* ===== 03 FOLD MARK → STREET FOLD: 노점에서 스티커와 음식을 받고 → 골목 테이블로 → 테이블이 내려오고 → 음식을 연다 ===== */
    var v = u - SF_SEG;
    var giveCup = seg(v, 0.05, 0.1) * (1 - seg(v, 0.14, 0.19));
    ART.poseSide(ACT.owner, { x: R.stall.x + 150, y: G - 58, dir: 1, s: ACT.owner.s, walk: 0, reach: giveCup, reachAng: -70 });
    var holdA = seg(v, 0.16, 0.2);
    var hA = walker(ACT.tA, PATH.tA, u, G, v > 0 && v < 0.19 ? -1 : 0, { hold: holdA * 0.9, reach: seg(v, 0.12, 0.16) * (1 - seg(v, 0.17, 0.2)), reachAng: -60 });
    var holdB = seg(v, 0.13, 0.17) * (1 - seg(v, 0.46, 0.5));
    var hB = walker(ACT.tB, PATH.tB, u, G - 14, v > 0 && v < 0.21 ? -1 : 0, { hold: holdB, reach: seg(v, 0.08, 0.12) * (1 - seg(v, 0.13, 0.16)) + seg(v, 0.46, 0.5) * (1 - seg(v, 0.53, 0.58)), reachAng: -64 });
    ACT.tA.g.setAttribute("opacity", seg(u, 1.55, 1.62).toFixed(2)); ACT.tB.g.setAttribute("opacity", seg(u, 1.58, 1.65).toFixed(2));

    var stickUp = seg(v, 0.04, 0.1), stickFly = inOut(seg(v, 0.12, 0.18));
    var sx0 = R.foldmark.x + 2.8, sy0 = R.foldmark.y - 10 - 12 * out(stickUp);
    var sx = lerp(sx0, hA.hx, stickFly), sy = lerp(sy0, hA.hy, stickFly) - Math.sin(Math.PI * stickFly) * 50;
    place(rq("r-sticker"), sx, sy, stickFly * -14, 1 - 0.3 * stickFly, stickUp > 0 ? 1 : 0);
    rq("r-fmlight").setAttribute("opacity", (0.6 + 0.4 * Math.abs(Math.sin(v * 70)) * seg(v, 0.02, 0.04) * (1 - seg(v, 0.1, 0.12))).toFixed(2));

    var tbl = inOut(seg(v, 0.32, 0.44));
    rq("r-table").setAttribute("transform", "rotate(" + (-90 * tbl).toFixed(1) + " " + R.hinge.x + " " + R.hinge.y + ")");
    // 걸이: 판이 어떻게 돌든 무게로 늘 아래를 향함 (판을 올리면 홈 안에 쏙, 내리면 다시 늘어짐)
    var hk = rq("r-hook"); if (hk) { var hx = R.hinge.x + 0.4, hy = R.hinge.y - 0.17 * 160; hk.setAttribute("transform", "rotate(" + (90 * tbl).toFixed(1) + " " + hx + " " + hy + ")"); }
    rq("r-light").setAttribute("opacity", seg(v, 0.4, 0.5).toFixed(3));
    var rg = rq("r-ring"); if (rg) rg.setAttribute("opacity", (0.3 + 0.2 * Math.sin(v * 90) * (1 - seg(v, 0.28, 0.32)) + 0.55 * seg(v, 0.28, 0.32)).toFixed(3));   // 흰 원형 조명: 숨쉬다가 트레이를 대면 밝게
    rq("r-smoke").setAttribute("transform", "translate(0," + (-((s * 40) % 30)).toFixed(1) + ")");

    // 음식 컵: 계산대 → 손님 손 → 테이블 위 → 뚜껑 열림
    var cupTake = inOut(seg(v, 0.1, 0.15)), cupPut = inOut(seg(v, 0.48, 0.53));
    var counter = [R.stall.x + 330, 618], tableTop = [R.hinge.x - 18, R.hinge.y - 3];
    var cx = lerp(counter[0], hB.hx, cupTake), cy = lerp(counter[1], hB.hy + 4, cupTake) - Math.sin(Math.PI * cupTake) * 20;
    cx = lerp(cx, tableTop[0], cupPut); cy = lerp(cy, tableTop[1], cupPut);
    place(rq("r-cup"), cx, cy, 0, 0.62);
    var lid = out(seg(v, 0.54, 0.6));
    place(rq("r-lid"), lid * 22, -lid * 18, lid * 28, null);
    rq("r-steam").setAttribute("opacity", (seg(v, 0.56, 0.62) * (0.75 + 0.25 * Math.sin(s * 9))).toFixed(2));
    rq("r-steam").setAttribute("transform", "translate(0," + (-((s * 30) % 14)).toFixed(1) + ")");

    /* ===== 04 NAVIAR: 가득 찬 통(호박색 선 깜박) → 바이저에 경로 → 도착 · '작업 중' → 카드 태그 → 통이 기울어 나옴 → 비움 ===== */
    var full = 1 - seg(u, 3.7, 3.74);
    var blink = full * (Math.sin(u * 160) > 0 ? 1 : 0.15);
    rq("r-amb2").setAttribute("opacity", (0.35 + 0.65 * blink).toFixed(2)); rq("r-amb2g").setAttribute("opacity", (0.25 + 0.75 * blink).toFixed(2));
    var tapC = seg(u, 3.3, 3.34) * (1 - seg(u, 3.38, 3.42));
    var tilt2 = inOut(seg(u, 3.36, 3.44)) * (1 - inOut(seg(u, 3.64, 3.7)));
    rq("r-bin2").setAttribute("transform", "rotate(" + (-16 * tilt2).toFixed(1) + " " + (R.sf2.x - 0.15 * 160) + " " + G + ")");
    rq("r-tag2").setAttribute("stroke-width", (1.4 + 2.5 * tapC).toFixed(1));
    var liftB = seg(u, 3.46, 3.5) * (1 - seg(u, 3.58, 3.62));
    var hW = walker(ACT.worker, PATH.worker, u, G, u > 3.24 && u < 3.74 ? -1 : 0, { reach: Math.max(tapC, seg(u, 3.44, 3.48) * (1 - seg(u, 3.5, 3.54))), reachAng: -40, hold: liftB });
    ACT.worker.g.setAttribute("opacity", seg(u, 2.86, 2.95).toFixed(2));
    var wx = kf(PATH.worker, u), wdir = (u > 3.24 && u < 3.74) || kf(PATH.worker, u + 0.004) < wx ? -1 : 1;
    rq("r-visor").setAttribute("transform", "translate(" + wx.toFixed(1) + "," + G + ") scale(" + (wdir * ACT.worker.s).toFixed(3) + "," + ACT.worker.s + ")");
    rq("r-visor").setAttribute("opacity", seg(u, 2.86, 2.95).toFixed(2));
    var working = seg(u, 3.26, 3.3);
    rq("r-visor-led").setAttribute("opacity", (0.25 + 0.75 * working * (0.7 + 0.3 * Math.sin(u * 50))).toFixed(2));
    var cartX = wx + wdir * 70 * ACT.worker.s / 1.5;
    place(rq("r-cart"), u < 3.74 ? Math.min(cartX, wx - 60) : wx + 62, G, null, null, seg(u, 2.86, 2.95).toFixed(2));
    var nvui = seg(u, 3.02, 3.08) * (1 - seg(u, 3.74, 3.8));
    rq("r-nv-ui").setAttribute("opacity", nvui.toFixed(2));
    rq("r-nv-s1").setAttribute("opacity", (1 - working).toFixed(2)); rq("r-nv-s2").setAttribute("opacity", working.toFixed(2));
    // 쓰레기 봉투: 통 → 손 → 수레
    var bagT = seg(u, 3.5, 3.6), bagX = lerp(R.sf2.x + 10, hW.hx, seg(u, 3.46, 3.5)), bagY = lerp(G - 40, hW.hy + 26, seg(u, 3.46, 3.5));
    bagX = lerp(bagX, Math.min(cartX, wx - 60), seg(u, 3.58, 3.62)); bagY = lerp(bagY, G - 60, seg(u, 3.58, 3.62));
    place(rq("r-trash"), bagX, bagY, null, null, (seg(u, 3.45, 3.48) * (1 - seg(u, 3.74, 3.8))).toFixed(2));
    // 쓰지 않는 예전 지나가는 사람
    ACT.pA.g.setAttribute("opacity", 0); ACT.pB.g.setAttribute("opacity", 0);

    /* 뒤쪽 행인 */
    amb.forEach(function (m) {
      var x = ((m.base + m.dir * m.v * s) % 6800 + 6800) % 6800 - 200;
      ART.poseSide(m.a, { x: x, y: G - 40, dir: m.dir, s: m.a.s, walk: 1, phase: m.dir * x / (150 * m.a.s) * 2 * Math.PI });
    });

    /* 초점 (주변을 흐리게, 노란 바통) */
    var fx = X0 + (kf(FX, u) - camX) * S, fy = top + kf(FY, u) * S;
    setT(C.veil, "translate3d(" + fx.toFixed(1) + "px," + fy.toFixed(1) + "px,0)", (seg(s, 0.3, 0.8)).toFixed(3));
    var bo = i < 3 ? Math.sin(Math.PI * seg(fr, 0.62, 0.98)) : 0;
    setT(C.baton, "translate3d(" + fx.toFixed(1) + "px," + (fy - bo * 0.22 * vh - 0.12 * vh).toFixed(1) + "px,0) scale(" + (0.6 + 0.6 * bo).toFixed(3) + ")", bo.toFixed(3));

    /* 01: 실제 3D 장면 (노점의 FOLD MARK → 커플 → 골목의 STREET FOLD) */
    if (mode3) {
      // 3D 모드: 2D 무대(길 · 사람 그림 · 초점 · 바통)는 아예 숨김
      C.track.style.visibility = C.bg.style.visibility = "hidden"; C.veil.style.opacity = 0; C.baton.style.opacity = 0;
      C3D.attach(R3.el); R3.on = true;
      if (use3d) {
        var u3 = clamp(uu / TR, 0, 1);
        if (cur === SF_SEG) C3D.relay(u3, 9000 + u3 * 900); else C3D.relayTeam(cur, u3, 9000 + u3 * 900);
      }
      R3.el.style.opacity = 1;
      R3.dim = R3.dim || (function () { var d = doc.createElement("div"); d.className = "r3d-dim"; d.innerHTML = '<span>3D 장면을 준비하는 중…</span>'; R3.el.appendChild(d); return d; })();
      var dimV = use3d ? dip : 1; R3.dim.style.opacity = dimV.toFixed(3); R3.dim.classList.toggle("is-wait", !use3d);
    } else {
      C.track.style.visibility = C.bg.style.visibility = "";
      if (R3.on) { R3.el.style.opacity = 0; R3.on = false; }
    }

    /* 영상 프레임이 준비된 제품이면 그 장면 위에 덮음 */
    var sq = mode3 ? null : SEQ[i];
    if (sq) {
      var holdEnd = i < 3 ? 0.6 : 1, a2 = seg(fr, 0, holdEnd);
      var src = sq[Math.round(a2 * (sq.length - 1))];
      if (C.seqImg.getAttribute("src") !== src) C.seqImg.setAttribute("src", src);
      C.seq.style.opacity = ((i === 0 ? 1 : seg(fr, 0, 0.06)) * (i < 3 ? 1 - seg(fr, 0.62, 0.78) : 1)).toFixed(3);
    } else if (C.seq.style.opacity !== "0") C.seq.style.opacity = 0;
  }

  /* =========================================================
     7. 장면 D — 명동 전체로 (제품이 이어진 지도)
     ========================================================= */
  var D = { tilt: $("cTilt"), h3d: $("d3d"), head: $("cHead"), cam: null, fx: 730, fy: 460, zoom: 1 };
  function sceneD(p) {
    // 골목 눈높이 → 하늘로 올라가며 3D에서 지도로
    var k = seg(p, 0, 0.3);
    if (mobile) { D.zoom = 0.82; D.fx = MAP.spots[0][0]; D.fy = MAP.spots[0][1]; }
    var d3 = C3D.init();
    if (d3) {
      C3D.attach(D.h3d); D.h3d.style.opacity = 1;
      C3D.setLook({ dark: 0, floor: 1, tables: 1 });
      D.tilt.style.opacity = seg(k, 0.9, 1).toFixed(3);                    // 위에 다 올라오면 릴레이 선 · 이름표만 얹음
    } else { D.h3d.style.opacity = 0; D.tilt.style.opacity = seg(k, 0.3, 1).toFixed(3); }
    var ho = seg(p, 0.22, 0.32);
    setT(D.head, "translate3d(0," + ((1 - out(ho)) * 24).toFixed(1) + "px,0)", ho.toFixed(3));

    var rp = seg(p, 0.34, 0.84);
    var fx = D.fx, fy = D.fy, zoom = D.zoom;
    if (mobile) { // 모바일: 카메라가 릴레이 선 끝을 따라감
      var head = routePoint(rp);
      D.cam = D.cam ? [lerp(D.cam[0], head[0], 0.5), lerp(D.cam[1], head[1], 0.5)] : head;
      if (k >= 1) { fx = D.cam[0]; fy = D.cam[1]; }
    }
    var markers = MAP.spots.map(function (sp, j) {
      var on = j === 0 ? seg(p, 0.3, 0.36) : seg(rp, stopFrac[j] - 0.05, stopFrac[j]);
      return { x: sp[0], y: sp[1], on: on, pulse: 0.5 + 0.5 * Math.sin(p * 40 + j) };
    });
    if (d3) {
      if (k < 1) render3d("D", 1 - k, p);
      else { var szD = C3D.size(); C3D.render(C3D.topDown(fx, fy, mapView(zoom), szD[1], 32), CFG.timelapseSpeed + idle.t); }
    }
    if (k > 0.8) mapD.render({ overlay: d3, t: CFG.timelapseSpeed + p * 1400, org: 1, tint: 1, floor: 1, dark: 0, tables: 1, zoom: zoom, fx: fx, fy: fy,
      pulses: seg(p, 0.55, 0.8), route: { pts: MAP.route, prog: rp }, markers: markers });
    markers.forEach(function (m, j) {
      var pt = mapD.toScreen(m.x, m.y), on = m.on * seg(k, 0.95, 1);
      setT(markerEls[j], "translate3d(" + pt[0].toFixed(1) + "px," + pt[1].toFixed(1) + "px,0) translate(-50%,-100%) scale(" + (0.85 + 0.15 * out(on)).toFixed(3) + ")", on.toFixed(3));
      markerEls[j].style.pointerEvents = on > 0.5 ? "auto" : "none";
    });
  }

  /* =========================================================
     7-2. 제품 고르기 — 지도에서 고르면 그 골목으로 내려가 제품을 가운데에
     ========================================================= */
  var SEL = { stage: $("sStage"), h3d: $("s3d"), detail: $("sDetail"), list: $("sList"), mode: "pre", j: -1, target: -1, u: 0, keys: null, hot: -1, tu: 0, yaw: 0, vyaw: 0, drag: null, dragged: false, idleRot: 0 };
  /* 동선 따라가기: 화면에 들어오면 01 → 02 → 03 → 04 로 카메라가 길을 따라 이동 (구간마다 무드보드 색 하나씩) */
  var TOUR = { dur: 12, el: $("sTour"), txt: $("sTourTxt"), dot: $("sTourDot"), bar: $("sTourBar"), seg: -1 };
  /* 동선 연출 중에는 스크롤을 잠금 — 끝나거나 '건너뛰기'를 눌러야 풀림 */
  var LOCK = { on: false, y: 0 };
  function lockKey(e) { if (LOCK.on && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| |Spacebar)$/.test(e.key) && e.target === doc.body || (LOCK.on && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(e.key))) e.preventDefault(); }
  function lockStop(e) { if (LOCK.on) e.preventDefault(); }
  function lockHold() { if (LOCK.on && Math.abs(window.pageYOffset - LOCK.y) > 2) window.scrollTo(0, LOCK.y); }
  addEventListener("wheel", lockStop, { passive: false });
  addEventListener("touchmove", lockStop, { passive: false });
  addEventListener("keydown", lockKey);
  addEventListener("scroll", lockHold, { passive: true });
  function scrollLock(on) {
    if (on === LOCK.on) return;
    LOCK.on = on;
    if (on) {
      var r = SEL.stage.getBoundingClientRect();
      LOCK.y = Math.round(window.pageYOffset + r.top + (r.height - vh) / 2);   // 무대가 화면에 꽉 차게 맞추고 잠금
      doc.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, LOCK.y); doc.documentElement.style.scrollBehavior = "";
      doc.documentElement.classList.add("is-locked");
    } else doc.documentElement.classList.remove("is-locked");
  }
  doc.addEventListener("click", function (e) { if (LOCK.on && e.target.closest && e.target.closest("a[href]")) { if (SEL.mode === "tour") tourEnd(); else scrollLock(false); } }, true);
  function tourStart() {
    if (!C3D.init()) return;
    if (!reduced) scrollLock(true);
    SEL.mode = "tour"; SEL.tu = reduced ? 1 : 0; TOUR.seg = -1; selShowDetail(false); SEL.stage.classList.remove("is-3d");
    SEL.stage.classList.add("is-touring"); C3D.spotOn = 0;
  }
  function tourEnd() {
    SEL.stage.classList.remove("is-touring");
    scrollLock(false);
    SEL.keys = C3D.backKeys(C3D.cameraKey(), overview()); SEL.target = -1; SEL.u = reduced ? 1 : 0; SEL.dur = 2.2; SEL.mode = "fly";
  }
  $("sTourSkip").addEventListener("click", function () { if (SEL.mode === "tour") tourEnd(); });
  $("sReplay").addEventListener("click", function () { if (SEL.mode === "overview") tourStart(); });
  var N_PROD = TXT.products.length;
  // 지도 위 이름표
  var selMarkers = TXT.products.map(function (p, j) {
    var b = doc.createElement("button"); b.type = "button"; b.className = "sel-mk";
    b.innerHTML = '<i></i><span><b></b><em></em></span><strong class="go">눌러서 골목으로 <span aria-hidden="true">↘</span></strong>';
    b.querySelector("b").textContent = p.no.replace(/[^0-9]/g, ""); b.querySelector("em").textContent = p.name;
    b.addEventListener("click", function (e) { e.stopPropagation(); selGo(j); });
    b.addEventListener("mouseenter", function () { hotIn(j); }); b.addEventListener("mouseleave", hotOut);
    $("sMarkers").appendChild(b); return b;
  });
  // 왼쪽 목록 (한눈에 보고 바로 고르기)
  var selItems = TXT.products.map(function (p, j) {
    var li = doc.createElement("li"), b = doc.createElement("button"); b.type = "button"; b.className = "sel-item";
    b.innerHTML = '<span class="si-no"></span><b></b>';
    b.querySelector(".si-no").textContent = p.no.replace(/[^0-9]/g, ""); b.querySelector("b").textContent = p.name;
    b.addEventListener("click", function () { selGo(j); });
    b.addEventListener("mouseenter", function () { hotIn(j); }); b.addEventListener("mouseleave", hotOut);
    b.addEventListener("focus", function () { hotIn(j); }); b.addEventListener("blur", hotOut);
    li.appendChild(b); $("sItems").appendChild(li); return b;
  });
  // 상세 화면의 01~04 바로가기
  var selDots = TXT.products.map(function (p, j) {
    var b = doc.createElement("button"); b.type = "button"; b.className = "sel-dot"; b.textContent = "0" + (j + 1);
    b.setAttribute("aria-label", p.no + " " + p.name);
    b.addEventListener("click", function () { if (j !== SEL.j) selGo(j); });
    $("sDots").appendChild(b); return b;
  });
  /* 지도 전체가 버튼: 마우스가 가장 가까운 제품을 밝히고, 지도 어디를 눌러도 그 제품으로 들어감 */
  SEL.mpos = []; var INV = { t: 0, idle: false };
  // v4.5.1: 지도 전체가 버튼이던 것을 없앰 — 이름표(와 그 점 바로 주변 36px)만 반응
  function nearestMk(e) {
    var r = SEL.stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = -1, bd = 1e9;
    SEL.mpos.forEach(function (p, j) { if (!p) return; var d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = j; } });
    return bd < 36 ? best : -1;
  }
  // 마우스가 잠깐 벗어나도 바로 꺼지지 않게 (작은 설명 창의 버튼까지 손이 닿도록)
  var hotTimer = 0;
  function hotIn(j) { clearTimeout(hotTimer); if (j !== SEL.hot) selHot(j); }
  function hotOut() { clearTimeout(hotTimer); hotTimer = setTimeout(function () { selHot(-1); }, 650); }
  // 끌면 지도가 돌고, 그냥 누르면 가장 가까운 제품으로 들어감
  SEL.h3d.addEventListener("pointerdown", function (e) {
    if (SEL.mode !== "overview") return;
    SEL.drag = { x: e.clientX, t: performance.now() }; SEL.dragged = false; SEL.vyaw = 0;
    try { SEL.h3d.setPointerCapture(e.pointerId); } catch (er) {}
  });
  SEL.h3d.addEventListener("pointermove", function (e) {
    if (SEL.mode !== "overview") return; SEL.idleRot = 0;
    if (SEL.drag) {
      var dx = e.clientX - SEL.drag.x; SEL.drag.x = e.clientX;
      if (Math.abs(dx) > 0 || SEL.dragged) { SEL.yaw -= dx * 0.0045; SEL.vyaw = -dx * 0.0045; if (Math.abs(dx) > 2) SEL.dragged = true; }
      SEL.h3d.style.cursor = "grabbing"; return;
    }
    var j = nearestMk(e); if (j >= 0) hotIn(j); else if (SEL.hot >= 0) hotOut(); SEL.h3d.style.cursor = j >= 0 ? "pointer" : "grab";
  });
  function dragEnd() { SEL.drag = null; SEL.h3d.style.cursor = "grab"; }
  SEL.h3d.addEventListener("pointerup", dragEnd); SEL.h3d.addEventListener("pointercancel", dragEnd);
  SEL.h3d.addEventListener("pointerleave", function () { if (SEL.hot >= 0) hotOut(); });
  // 마우스가 화면 안에 있으면 지도가 저절로 돌지 않음 (누르려는 이름표가 미끄러져 가지 않게)
  SEL.stage.addEventListener("pointerenter", function () { SEL.inside = true; });
  SEL.stage.addEventListener("pointerleave", function () { SEL.inside = false; });
  SEL.h3d.addEventListener("click", function (e) { if (SEL.mode !== "overview" || SEL.dragged) { SEL.dragged = false; return; } var j = nearestMk(e); if (j >= 0) selGo(j); });
  var POP = { el: $("sPop"), no: $("sPopNo"), name: $("sPopName"), line: $("sPopLine"), go: $("sPopGo") };
  if (POP.go) POP.go.addEventListener("click", function () { selGo(SEL.hot >= 0 ? SEL.hot : (POP.j >= 0 ? POP.j : 0)); });
  if (POP.el) { POP.el.addEventListener("mouseenter", function () { clearTimeout(hotTimer); }); POP.el.addEventListener("mouseleave", hotOut); }
  function selHot(j) {
    SEL.hot = j;
    selMarkers.forEach(function (m, k) { m.classList.toggle("is-hot", k === j); });
    selItems.forEach(function (m, k) { m.classList.toggle("is-hot", k === j); });
    // 밝혀진 제품의 작은 설명 (도크 위)
    if (POP.el && j >= 0) {
      POP.j = j; var p = TXT.products[j]; POP.no.textContent = p.no + (p.maker ? " · " + p.maker : ""); POP.name.textContent = p.name; POP.line.textContent = p.line;
      var ir = selItems[j].getBoundingClientRect(), sr = SEL.stage.getBoundingClientRect();
      POP.el.style.left = (ir.left - sr.left + ir.width / 2) + "px";
    }
    if (POP.el) POP.el.classList.toggle("is-on", j >= 0 && SEL.mode === "overview");
    if (SEL.mode === "overview") C3D.spotOn = j + 1;
  }
  function selFill(j) {
    var p = TXT.products[j];
    $("sNo").textContent = p.no; $("sCount").textContent = "0" + (j + 1) + " / 0" + N_PROD;
    $("sName").textContent = p.name; $("sLine").textContent = p.line; $("sIn").textContent = p.input; $("sAi").textContent = p.ai; $("sAct").textContent = p.act;
    $("sGo").href = p.page; $("sImg").src = p.card; $("sImg").alt = p.name;
    // 3D 모델이 있는 제품은 잡고 돌려 볼 수 있는 3D 로 (없으면 사진)
    var v3 = !!(p.model && C3D.viewer && C3D.viewer($("sView"), p.model));
    $("sImgWrap").classList.toggle("is-3d", v3);
    selDots.forEach(function (d, k) { d.classList.toggle("is-on", k === j); });
  }
  // 지도 360° 돌리기: 내려다보는 카메라를 가운데(바라보는 점)를 축으로 돌림
  function rotKey(k, yaw) {
    if (!yaw) return k;
    var d = k.pos.clone().sub(k.look), c = Math.cos(yaw), sn = Math.sin(yaw), p = k.look.clone();
    p.x += d.x * c + d.z * sn; p.y += d.y; p.z += -d.x * sn + d.z * c;
    return { pos: p, look: k.look.clone(), up: k.up.clone(), fov: k.fov };
  }
  function overview() {
    var sz = C3D.size(), name = sz[0] + "x" + sz[1];
    if (SEL.ovName !== name) {
      var lr = SEL.list.getBoundingClientRect(), sr = SEL.stage.getBoundingClientRect(), hh = $("hd").offsetHeight;
      var r = mobile ? { x0: 40, x1: sz[0] - 40, y0: hh + 130, y1: (lr.top - sr.top) - 90 }
                     : { x0: sz[0] * 0.2, x1: sz[0] * 0.8, y0: hh + 170, y1: (lr.top - sr.top) - 150 };
      SEL.ov = C3D.overviewFit(r, mobile); SEL.ovName = name;
    }
    return rotKey(SEL.ov, SEL.yaw);
  }
  function selShowDetail(on) {
    if (!on && C3D.viewerHide) C3D.viewerHide();
    SEL.detail.classList.toggle("is-on", on); SEL.detail.setAttribute("aria-hidden", on ? "false" : "true");
    SEL.stage.classList.toggle("is-blur", on);
  }
  function selGo(j) {
    if (!C3D.init()) { location.href = TXT.products[j].page; return; }   // 3D가 안 되는 기기: 바로 제품 페이지로
    if (SEL.mode === "fly") return;
    if (SEL.mode === "tour") { SEL.stage.classList.remove("is-touring"); scrollLock(false); }
    var from = SEL.mode === "overview" ? overview() : C3D.cameraKey();
    SEL.keys = C3D.flyKeys(from, j); SEL.target = j; SEL.u = 0; SEL.dur = SEL.mode === "overview" ? CFG.selectFly : CFG.selectFly * 0.8;
    SEL.mode = "fly"; selShowDetail(false); SEL.stage.classList.add("is-3d"); C3D.spotOn = j + 1; if (POP.el) POP.el.classList.remove("is-on");
    if (reduced) SEL.u = 1;
  }
  function selBack() {
    if (SEL.mode !== "detail") return;
    SEL.keys = C3D.backKeys(C3D.cameraKey(), overview()); SEL.target = -1; SEL.u = 0; SEL.dur = CFG.selectFly * 0.8;
    SEL.mode = "fly"; selShowDetail(false);
    if (reduced) SEL.u = 1;
  }
  function selStep(d) { if (SEL.mode === "detail") selGo((SEL.j + d + N_PROD) % N_PROD); }
  $("sBack").addEventListener("click", selBack);
  $("sPrev").addEventListener("click", function () { selStep(-1); });
  $("sNext").addEventListener("click", function () { selStep(1); });
  doc.addEventListener("keydown", function (e) {
    if (SEL.mode !== "detail") return;
    if (e.key === "Escape") selBack(); else if (e.key === "ArrowRight") selStep(1); else if (e.key === "ArrowLeft") selStep(-1);
  });
  function selFrame(dt, inView) {
    if (!inView) return;
    var tLive = CFG.timelapseSpeed + idle.t + 900;
    if (!C3D.init()) {      // 3D가 안 될 때: 2D 지도 + 목록만
      mapS.render({ t: tLive, org: 1, tint: 1, floor: 1, dark: 0, tables: 1, zoom: 0.9, fx: 700, fy: 470 });
      return;
    }
    C3D.attach(SEL.h3d); SEL.h3d.style.opacity = 1; C3D.setLook({ dark: 0, floor: 1, tables: 1 });
    var SF = C3D.routeStopFrac();
    if (SEL.mode === "pre") {                       // 화면에 반 이상 들어오면 동선 따라가기 시작
      var r0 = SEL.stage.getBoundingClientRect();
      C3D.routeSet(0, false); C3D.render(C3D.tourKey(0), tLive);
      if (r0.top < vh * 0.35 && r0.bottom > vh * 0.65) tourStart();
      return;
    }
    if (SEL.mode === "tour") {
      SEL.tu = clamp(SEL.tu + dt / TOUR.dur, 0, 1);
      if (TOUR.bar) TOUR.bar.style.transform = "scaleX(" + SEL.tu.toFixed(3) + ")";
      var tp = inOut(SEL.tu);
      C3D.routeSet(tp, true); C3D.render(C3D.tourKey(tp), tLive);
      var si = 0; while (si < 2 && tp > SF[si + 1]) si++;
      if (si !== TOUR.seg) {
        TOUR.seg = si; TOUR.dot.style.background = C3D.routeColors[si];
        TOUR.txt.textContent = TXT.products[si].no.replace("PRODUCT ", "") + " " + TXT.products[si].name + "  →  " + TXT.products[si + 1].no.replace("PRODUCT ", "") + " " + TXT.products[si + 1].name;
      }
      MAP.spots.forEach(function (sp, j) {
        var pt = C3D.project(sp[0], 22, sp[1]), on = clamp((tp - SF[j] + 0.02) / 0.03, 0, 1);
        selMarkers[j].style.transform = "translate3d(" + pt[0].toFixed(1) + "px," + pt[1].toFixed(1) + "px,0) scale(" + (0.85 + 0.15 * on).toFixed(3) + ")";
        selMarkers[j].style.opacity = on.toFixed(3);
      });
      if (SEL.tu >= 1) tourEnd();
      return;
    }
    C3D.routeSet(1, false);
    if (SEL.mode === "overview") {
      if (!SEL.drag) { SEL.yaw += SEL.vyaw; SEL.vyaw *= Math.pow(0.04, dt); SEL.idleRot = Math.min(1, SEL.idleRot + dt * 0.25); if (!reduced && !SEL.inside && SEL.hot < 0) SEL.yaw += dt * 0.035 * SEL.idleRot; }
      C3D.render(overview(), tLive);
      // 이름표끼리 겹치면 아래쪽 것을 살짝 내려 겹치지 않게 (점 위치는 그대로)
      var pts = MAP.spots.map(function (sp, j) { var pt = C3D.project(sp[0], 22, sp[1]); SEL.mpos[j] = pt; return { j: j, x: pt[0], y: pt[1], w: selMarkers[j].offsetWidth || 150, h: (selMarkers[j].offsetHeight || 36) + 6 }; });
      pts.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (a, i, arr) {
        for (var k = 0; k < i; k++) { var b = arr[k]; if (Math.abs(a.x - b.x) < Math.max(a.w, b.w) && Math.abs(a.y - b.y) < b.h) a.y = b.y + b.h; }
      });
      pts.forEach(function (a) { selMarkers[a.j].style.transform = "translate3d(" + a.x.toFixed(1) + "px," + a.y.toFixed(1) + "px,0)"; });
      return;
    }
    if (SEL.mode === "detail") { C3D.render(C3D.eyeKey(SEL.j), tLive); return; }
    // 날아가는 중
    SEL.u = clamp(SEL.u + dt / SEL.dur, 0, 1);
    C3D.render(C3D.path(SEL.keys, inOut(SEL.u)), tLive);
    if (SEL.u >= 1) {
      if (SEL.target >= 0) { SEL.j = SEL.target; selFill(SEL.j); SEL.mode = "detail"; selShowDetail(true); }
      else { SEL.mode = "overview"; SEL.j = -1; SEL.stage.classList.remove("is-3d"); C3D.spotOn = 0; selHot(SEL.hot); selMarkers.forEach(function (m) { m.style.opacity = ""; }); }
    }
  }

  /* =========================================================
     8. 움직임 줄이기: 단계별로 나눠서 페이드로만 바꿈
     ========================================================= */
  function quantA(p) { if (p < 0.05) return 0; if (p >= 0.8) return 1; return 0.1 + Math.round(seg(p, 0.1, 0.78) * 4) * 0.17; }
  function quantC(p) {
    var intro = CFG.scroll.relayIntro, L = relayLens(), N = intro + relayTotal(), s = p * N;
    if (s < intro) return 0;
    var u = relayU(s), i = Math.min(3, Math.floor(u)), f = i < 3 ? 0.58 : 0.9, acc = intro;
    for (var k = 0; k < i; k++) acc += L[k];
    return (acc + f * L[i]) / N;
  }
  function quantD(p) { return p < 0.3 ? 0 : 1; }
  var QUANT = { A: quantA, C: quantC, D: quantD };
  var RENDER = { A: sceneA, C: sceneC, D: sceneD };
  var shown = { A: -1, C: -1, D: -1 };
  function applyScene(key, p) {
    if (!reduced) { RENDER[key](p); return; }
    var q = QUANT[key](p);
    if (q === shown[key]) return;
    var stage = scenes[key].el.querySelector(".stage");
    if (shown[key] < 0) { shown[key] = q; RENDER[key](q); return; }
    shown[key] = q;
    stage.style.transition = "opacity .3s linear"; stage.style.opacity = 0;
    clearTimeout(stage._tm);
    stage._tm = setTimeout(function () { RENDER[key](shown[key]); stage.style.opacity = 1; }, 300);
  }

  /* =========================================================
     9. 매 프레임
     ========================================================= */
  var cur = window.pageYOffset, last = -1, dirty = true;
  var hd = $("hd"), toTop = $("toTop");
  var lastTime = 0;
  function frame(now) {
    var target = window.pageYOffset;
    var dtms = lastTime ? Math.min(window.MD_DTMAX || 100, now - lastTime) : 16; 
    var dtf = lastTime ? Math.min(4, (now - lastTime) / 16.67) : 1; lastTime = now;
    idle.t += dtms * 0.04;                       // 실제 시간에 따라 사람들이 계속 걷는 장면용
    var k = reduced ? 1 : 1 - Math.pow(1 - CFG.smoothing, dtf);   // 화면이 느려도 같은 속도로 따라감
    cur = Math.abs(target - cur) < 0.5 ? target : lerp(cur, target, k);
    if (cur !== last || dirty) {
      last = cur; dirty = false;
      Object.keys(scenes).forEach(function (key) {
        var sc = scenes[key];
        if (cur + vh < sc.top - vh * 0.5 || cur > sc.top + sc.h + vh * 0.5) return; // 화면 밖이면 쉬기
        applyScene(key, progress(sc, cur));
      });
      sceneB(cur);
      var hy = target + (hd.offsetHeight / 2);
      hd.classList.toggle("is-dark", hy > outroTop && hy < outroBottom);
      toTop.classList.toggle("is-on", target > vh * 1.2);
    }
    // 골목에 도착한 뒤에는 스크롤을 멈춰도 사람들이 계속 걸음
    if (A.live && !reduced && cur >= scenes.A.top && cur <= scenes.A.top + scenes.A.h) render3d("A", 1, 1);
    if (cur > outroTop - vh * 2.2) outroNight();
    var sr = SEL.stage.getBoundingClientRect();
    selFrame(dtms / 1000, sr.bottom > 0 && sr.top < vh);
    requestAnimationFrame(frame);
  }

  /* 나타나기 */
  var rvs = doc.querySelectorAll(".rv");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(rvs, function (el) { io.observe(el); });
  } else Array.prototype.forEach.call(rvs, function (el) { el.classList.add("is-in"); });

  /* 조 로고: 누르면 처음(2026 인트로)부터 다시 시작 */
  $("teamLogo").addEventListener("click", function (e) {
    e.preventDefault();
    try { sessionStorage.setItem("md-restart", "1"); } catch (er) {}
    location.href = location.href.split("#")[0];
  });

  /* 모바일 메뉴 */
  $("menuOpen").addEventListener("click", function () { $("mnav").classList.add("is-open"); });
  $("menuClose").addEventListener("click", function () { $("mnav").classList.remove("is-open"); });
  Array.prototype.forEach.call(doc.querySelectorAll("#mnav a"), function (a) {
    a.addEventListener("click", function () { $("mnav").classList.remove("is-open"); });
  });

  var rT;
  window.addEventListener("resize", function () { clearTimeout(rT); rT = setTimeout(function () { layout(false); }, 120); });
  /* v5: 발표용 바로가기 — 주소 끝에 ?view=streetfold (또는 floway · staygap · naviar · relay · select · world) 를 붙이면 그 장면에서 시작. &mode=3d 를 더하면 3D 릴레이로 */
  function goView() {
    var m = /[?&]view=([a-z0-9-]+)/i.exec(location.search); if (!m) return;
    layout(true);
    var md = /[?&]mode=(2d|3d)/i.exec(location.search), v = m[1].toLowerCase(), y = null;
    if (md && relay3dCan()) { var bt = doc.querySelector('[data-rmode="' + md[1].toLowerCase() + '"]'); if (bt) bt.click(); }
    var seg = { floway: 0, staygap: 1, "stay-gap": 1, streetfold: 2, "street-fold": 2, sf: 2, naviar: 3 }[v];
    if (seg != null || v === "relay") {
      var sc = scenes.C, L = relayLens(), acc = CFG.scroll.relayIntro; if (seg == null) acc *= .5; else { for (var k = 0; k < seg; k++) acc += L[k]; acc += L[seg] * .5; }
      y = sc.top + acc / sc.screens * (sc.h - vh);
    } else { var el = doc.getElementById(v === "world" ? "top" : v); if (el) y = el.getBoundingClientRect().top + window.pageYOffset; }
    if (y != null) { doc.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, Math.round(y)); doc.documentElement.style.scrollBehavior = ""; }
  }
  window.addEventListener("load", function () { setTimeout(goView, 350); });
  window.addEventListener("load", function () { layout(true); setTimeout(function () { if (C3D && C3D.preload) C3D.preload(); }, 900); });
  layout(true);
  requestAnimationFrame(frame);
})();
