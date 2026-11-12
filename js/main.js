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
    $("cMarkers").appendChild(d); return d;
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
  var mapA = MAP.create($("mapA"), { agents: nAgents, switchT: SWITCH_T });
  var mapD = MAP.create($("mapD"), { agents: nAgents, switchT: SWITCH_T });
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
    C: { el: $("relay"), screens: CFG.scroll.relayIntro + 4 * CFG.scroll.relayPerPerson },
    D: { el: $("city"), screens: CFG.scroll.sceneD }
  };
  var relayGeo = { S: 1, X0: 0, top: 0 };
  var lastW = -1;

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
      mapA.resize(); mapD.resize(); mapS.resize();
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

    // ③ 진짜 3D 건물 사이로 내려가기 (지도와 같은 화면에서 3D로 바뀐 뒤 골목 눈높이까지)
    var d = seg(p, 0.78, 0.985);
    var use3d = d > 0 && C3D.init();
    if (use3d) {
      C3D.attach(A.h3d);
      A.h3d.style.opacity = seg(d, 0, 0.07).toFixed(3);
      A.tilt.style.opacity = (1 - seg(d, 0.04, 0.1)).toFixed(3);
      A.live = d >= 1;
      render3d("A", d, p);
    } else {
      A.h3d.style.opacity = 0; A.tilt.style.opacity = 1; A.live = false;
      if (d > 0 && !C3D.ok) A.tilt.style.opacity = (1 - seg(d, 0.6, 1)).toFixed(3);   // 3D가 안 되는 기기: 지도에서 페이드
    }
    var ar = seg(p, 0.93, 0.99);
    setT(A.arrive, "translate3d(0," + ((1 - out(ar)) * 24).toFixed(1) + "px,0)", ar.toFixed(3));

    // 스크롤 속도만큼 사람 점이 잔상을 남김 (멈추면 다시 점)
    var dt = (p - (A.lastP == null ? p : A.lastP)) * CFG.timelapseSpeed; A.lastP = p;
    A.trail = lerp(A.trail || 0, clamp(dt * 9, -110, 110), 0.35);
    if (d < 0.12) {
      mapA.render({
        t: p * CFG.timelapseSpeed, trail: reduced ? 0 : A.trail,
        org: smooth(2027.6, 2029.6, y), tint: smooth(2026.55, 2027, y), floor: smooth(2027.55, 2028, y),
        dark: Math.exp(-Math.pow((y - 2029) / 0.38, 2)), tables: smooth(2029.6, 2030, y),
        zoom: lerp(1, 1.08, seg(p, 0.1, 0.78)), fx: 800, fy: 500
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
  var ACT = { tA: actor("r-tA", 1.5), tB: actor("r-tB", 1.42), pA: actor("r-pA", 1.52), pB: actor("r-pB", 1.48), owner: actor("r-owner", 1.45) };
  // 사람들의 움직임 (u = 0~4, 구간 번호 / 값 = 무대 위 x 위치)
  var PATH = {
    tA: [[0, 585], [0.2, 585], [0.44, 868]],
    tB: [[0, 478], [0.22, 478], [0.46, 948]],
    pA: [[0.3, -160], [0.6, 420], [1.0, 2010], [1.32, 2380], [1.62, 2380], [2.0, 3530], [2.32, 3905], [2.62, 3905], [3.0, 5000], [3.3, 5560], [3.66, 6620]],
    pB: [[2.7, 6760], [3.0, 6280], [3.3, 5862]]
  };
  var FOCUS = [[0, 600, 600], [0.16, 600, 600], [0.44, 1020, 680], [0.62, 1020, 680], [1.0, 2200, 640], [1.32, 2560, 660], [1.62, 2560, 660],
               [2.0, 3800, 640], [2.32, 4150, 660], [2.62, 4150, 660], [3.0, 5520, 650], [3.3, 5700, 660], [4, 5700, 660]];
  var FX = FOCUS.map(function (r) { return [r[0], r[1]]; }), FY = FOCUS.map(function (r) { return [r[0], r[2]]; });
  var PULSE = [null, [1.36, 1.64], [2.34, 2.64], [3.33, 4.1]];

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
      $("capName").textContent = p.name; $("capIn").textContent = p.input; $("capAi").textContent = p.ai; $("capAct").textContent = p.act;
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

  function sceneC(p) {
    var per = CFG.scroll.relayPerPerson, intro = CFG.scroll.relayIntro;
    var s = p * (intro + 4 * per);
    var u = clamp((s - intro) / per, 0, 4);
    var i = Math.min(3, Math.floor(u)), fr = u - i;
    var e = i < 3 ? inOut(seg(fr, 0.6, 1)) : 0;
    var camX = (i + e) * R.seg;
    var S = relayGeo.S, X0 = relayGeo.X0, top = relayGeo.top;

    setT(C.track, "translate3d(" + (X0 - camX * S).toFixed(1) + "px,0,0)");
    setT(C.bg, "translate3d(" + (X0 - camX * S * 0.6).toFixed(1) + "px,0,0)");
    var io = 1 - seg(s, 0.4, 0.85);
    setT(C.intro, "translate3d(0," + (-(1 - io) * 30).toFixed(1) + "px,0)", io.toFixed(3));
    var co = seg(s, 0.45, 0.85);
    setT(C.cap, "translate3d(0," + ((1 - out(co)) * 20).toFixed(1) + "px,0)", co.toFixed(3));
    setCaption(Math.min(3, i + (e > 0.5 ? 1 : 0)));

    /* 01: 노점에서 스티커와 음식을 받고 → 골목 테이블로 → 테이블이 내려오고 → 음식을 연다 */
    var giveCup = seg(u, 0.05, 0.1) * (1 - seg(u, 0.14, 0.19));
    ART.poseSide(ACT.owner, { x: R.stall.x + 150, y: G - 58, dir: 1, s: ACT.owner.s, walk: 0, reach: giveCup, reachAng: -70 });
    var holdA = seg(u, 0.16, 0.2);
    var hA = walker(ACT.tA, PATH.tA, u, G, u < 0.19 ? -1 : 0, { hold: holdA * 0.9, reach: seg(u, 0.12, 0.16) * (1 - seg(u, 0.17, 0.2)), reachAng: -60 });
    var holdB = seg(u, 0.13, 0.17) * (1 - seg(u, 0.46, 0.5));
    var hB = walker(ACT.tB, PATH.tB, u, G - 14, u < 0.21 ? -1 : 0, { hold: holdB, reach: seg(u, 0.08, 0.12) * (1 - seg(u, 0.13, 0.16)) + seg(u, 0.46, 0.5) * (1 - seg(u, 0.53, 0.58)), reachAng: -64 });

    var stickUp = seg(u, 0.04, 0.1), stickFly = inOut(seg(u, 0.12, 0.18));
    var sx0 = R.foldmark.x - 4, sy0 = R.foldmark.y - 30 - 24 * out(stickUp);
    var sx = lerp(sx0, hA.hx, stickFly), sy = lerp(sy0, hA.hy, stickFly) - Math.sin(Math.PI * stickFly) * 50;
    place(rq("r-sticker"), sx, sy, stickFly * -14, 1 - 0.3 * stickFly, stickUp > 0 ? 1 : 0);
    rq("r-fmlight").setAttribute("opacity", (0.6 + 0.4 * Math.abs(Math.sin(u * 70)) * seg(u, 0.02, 0.04) * (1 - seg(u, 0.1, 0.12))).toFixed(2));

    var tbl = inOut(seg(u, 0.32, 0.44));
    rq("r-table").setAttribute("transform", "rotate(" + (-90 * tbl).toFixed(1) + " " + R.hinge.x + " " + R.hinge.y + ")");
    rq("r-light").setAttribute("opacity", seg(u, 0.4, 0.5).toFixed(3));
    rq("r-smoke").setAttribute("transform", "translate(0," + (-((s * 40) % 30)).toFixed(1) + ")");

    // 음식 컵: 계산대 → 손님 손 → 테이블 위 → 뚜껑 열림
    var cupTake = inOut(seg(u, 0.1, 0.15)), cupPut = inOut(seg(u, 0.48, 0.53));
    var counter = [R.stall.x + 330, 618], tableTop = [R.hinge.x - 70, R.hinge.y];
    var cx = lerp(counter[0], hB.hx, cupTake), cy = lerp(counter[1], hB.hy + 4, cupTake) - Math.sin(Math.PI * cupTake) * 20;
    cx = lerp(cx, tableTop[0], cupPut); cy = lerp(cy, tableTop[1], cupPut);
    place(rq("r-cup"), cx, cy, 0, 0.95);
    var lid = out(seg(u, 0.54, 0.6));
    place(rq("r-lid"), lid * 22, -lid * 18, lid * 28, null);
    rq("r-steam").setAttribute("opacity", (seg(u, 0.56, 0.62) * (0.75 + 0.25 * Math.sin(s * 9))).toFixed(2));
    rq("r-steam").setAttribute("transform", "translate(0," + (-((s * 30) % 14)).toFixed(1) + ")");

    /* 02~04: 지나가던 사람이 이어서 사용 */
    var pAy = G + 30 * seg(u, 2.62, 2.9);
    walker(ACT.pA, PATH.pA, u, pAy, 0, { reach: seg(u, 1.34, 1.42) * (1 - seg(u, 1.58, 1.64)) + seg(u, 2.32, 2.4) * (1 - seg(u, 2.56, 2.62)), reachAng: -72 });
    ACT.pA.g.setAttribute("opacity", (seg(u, 0.3, 0.36) * (1 - seg(u, 3.55, 3.66))).toFixed(2));
    walker(ACT.pB, PATH.pB, u, G - 10, -1, { reach: seg(u, 3.32, 3.4), reachAng: -70 });
    ACT.pB.g.setAttribute("opacity", seg(u, 2.7, 2.8).toFixed(2));
    for (var k = 1; k < 4; k++) {
      var w = PULSE[k], env = seg(u, w[0], w[0] + 0.04) * (1 - seg(u, w[1] - 0.04, w[1])), bx = R.products[k].box;
      var pcx = bx[0] + bx[2] / 2, pcy = bx[1] + bx[2] / 2, ph = (u - w[0]) * 5;
      pulseRing(rq("r-pulse" + k + "a"), pcx, pcy, ph, env);
      pulseRing(rq("r-pulse" + k + "b"), pcx, pcy, ph + 0.5, env);
      var bump = 1 + 0.035 * env * Math.abs(Math.sin(ph * Math.PI));
      rq("r-prod" + k).setAttribute("transform", "translate(" + pcx + " " + (bx[1] + bx[2]) + ") scale(" + bump.toFixed(4) + ") translate(" + (-pcx) + " " + (-(bx[1] + bx[2])) + ")");
    }

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

    /* 영상 프레임이 준비된 제품이면 그 장면 위에 덮음 */
    var sq = SEQ[i];
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
    if (k < 1 && C3D.init()) {
      C3D.attach(D.h3d);
      D.h3d.style.opacity = (1 - seg(k, 0.9, 1)).toFixed(3);
      D.tilt.style.opacity = seg(k, 0.86, 0.97).toFixed(3);
      render3d("D", 1 - k, p);
    } else { D.h3d.style.opacity = 0; D.tilt.style.opacity = C3D.ok ? 1 : seg(k, 0.3, 1).toFixed(3); }
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
    if (k > 0.8) mapD.render({ t: CFG.timelapseSpeed + p * 1400, org: 1, tint: 1, floor: 1, dark: 0, tables: 1, zoom: zoom, fx: fx, fy: fy,
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
  var SEL = { stage: $("sStage"), h3d: $("s3d"), detail: $("sDetail"), list: $("sList"), mode: "overview", j: -1, target: -1, u: 0, keys: null, hot: -1 };
  var N_PROD = TXT.products.length;
  // 지도 위 이름표
  var selMarkers = TXT.products.map(function (p, j) {
    var b = doc.createElement("button"); b.type = "button"; b.className = "sel-mk";
    b.innerHTML = '<i></i><span><b></b><em></em></span>';
    b.querySelector("b").textContent = p.no.replace(/[^0-9]/g, ""); b.querySelector("em").textContent = p.name;
    b.addEventListener("click", function () { selGo(j); });
    b.addEventListener("mouseenter", function () { selHot(j); }); b.addEventListener("mouseleave", function () { selHot(-1); });
    $("sMarkers").appendChild(b); return b;
  });
  // 왼쪽 목록 (한눈에 보고 바로 고르기)
  var selItems = TXT.products.map(function (p, j) {
    var li = doc.createElement("li"), b = doc.createElement("button"); b.type = "button"; b.className = "sel-item";
    b.innerHTML = '<img alt=""><span class="si-txt"><span class="si-no"></span><b></b><small></small></span><span class="arr">↘</span>';
    b.querySelector("img").src = p.card; b.querySelector(".si-no").textContent = p.no; b.querySelector("b").textContent = p.name; b.querySelector("small").textContent = p.line;
    b.addEventListener("click", function () { selGo(j); });
    b.addEventListener("mouseenter", function () { selHot(j); }); b.addEventListener("mouseleave", function () { selHot(-1); });
    b.addEventListener("focus", function () { selHot(j); }); b.addEventListener("blur", function () { selHot(-1); });
    li.appendChild(b); $("sItems").appendChild(li); return b;
  });
  // 상세 화면의 01~04 바로가기
  var selDots = TXT.products.map(function (p, j) {
    var b = doc.createElement("button"); b.type = "button"; b.className = "sel-dot"; b.textContent = "0" + (j + 1);
    b.setAttribute("aria-label", p.no + " " + p.name);
    b.addEventListener("click", function () { if (j !== SEL.j) selGo(j); });
    $("sDots").appendChild(b); return b;
  });
  function selHot(j) {
    SEL.hot = j;
    selMarkers.forEach(function (m, k) { m.classList.toggle("is-hot", k === j); });
    selItems.forEach(function (m, k) { m.classList.toggle("is-hot", k === j); });
    if (SEL.mode === "overview") C3D.spotOn = j + 1;
  }
  function selFill(j) {
    var p = TXT.products[j];
    $("sNo").textContent = p.no; $("sCount").textContent = "0" + (j + 1) + " / 0" + N_PROD;
    $("sName").textContent = p.name; $("sLine").textContent = p.line; $("sIn").textContent = p.input; $("sAi").textContent = p.ai; $("sAct").textContent = p.act;
    $("sGo").href = p.page; $("sImg").src = p.card; $("sImg").alt = p.name;
    selDots.forEach(function (d, k) { d.classList.toggle("is-on", k === j); });
  }
  function overview() {
    var sz = C3D.size(), name = sz[0] + "x" + sz[1];
    if (SEL.ovName !== name) {
      var lr = SEL.list.getBoundingClientRect(), sr = SEL.stage.getBoundingClientRect(), hh = $("hd").offsetHeight;
      var r = mobile ? { x0: 34, x1: sz[0] - 150, y0: hh + 60, y1: (lr.top - sr.top) - 46 }
                     : { x0: (lr.right - sr.left) + 70, x1: sz[0] - 210, y0: hh + 90, y1: sz[1] - 110 };
      SEL.ov = C3D.overviewFit(r, mobile); SEL.ovName = name;
    }
    return SEL.ov;
  }
  function selShowDetail(on) {
    SEL.detail.classList.toggle("is-on", on); SEL.detail.setAttribute("aria-hidden", on ? "false" : "true");
    SEL.stage.classList.toggle("is-blur", on);
  }
  function selGo(j) {
    if (!C3D.init()) { location.href = TXT.products[j].page; return; }   // 3D가 안 되는 기기: 바로 제품 페이지로
    if (SEL.mode === "fly") return;
    var from = SEL.mode === "overview" ? overview() : C3D.cameraKey();
    SEL.keys = C3D.flyKeys(from, j); SEL.target = j; SEL.u = 0; SEL.dur = SEL.mode === "overview" ? CFG.selectFly : CFG.selectFly * 0.8;
    SEL.mode = "fly"; selShowDetail(false); SEL.stage.classList.add("is-3d"); C3D.spotOn = j + 1;
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
    C3D.attach(SEL.h3d); SEL.h3d.style.opacity = 1;
    if (SEL.mode === "overview") {
      C3D.render(overview(), tLive);
      MAP.spots.forEach(function (sp, j) {
        var pt = C3D.project(sp[0], 22, sp[1]);
        selMarkers[j].style.transform = "translate3d(" + pt[0].toFixed(1) + "px," + pt[1].toFixed(1) + "px,0)";
      });
      return;
    }
    if (SEL.mode === "detail") { C3D.render(C3D.eyeKey(SEL.j), tLive); return; }
    // 날아가는 중
    SEL.u = clamp(SEL.u + dt / SEL.dur, 0, 1);
    C3D.render(C3D.path(SEL.keys, inOut(SEL.u)), tLive);
    if (SEL.u >= 1) {
      if (SEL.target >= 0) { SEL.j = SEL.target; selFill(SEL.j); SEL.mode = "detail"; selShowDetail(true); }
      else { SEL.mode = "overview"; SEL.j = -1; SEL.stage.classList.remove("is-3d"); C3D.spotOn = 0; selHot(SEL.hot); }
    }
  }

  /* =========================================================
     8. 움직임 줄이기: 단계별로 나눠서 페이드로만 바꿈
     ========================================================= */
  function quantA(p) { if (p < 0.05) return 0; if (p >= 0.8) return 1; return 0.1 + Math.round(seg(p, 0.1, 0.78) * 4) * 0.17; }
  function quantC(p) {
    var per = CFG.scroll.relayPerPerson, intro = CFG.scroll.relayIntro, N = intro + 4 * per, s = p * N;
    if (s < intro) return 0;
    var i = Math.min(3, Math.floor((s - intro) / per));
    return (intro + (i + (i < 3 ? 0.58 : 0.9)) * per) / N;
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
    var dtms = lastTime ? Math.min(100, now - lastTime) : 16; 
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
  window.addEventListener("load", function () { layout(true); });
  layout(true);
  requestAnimationFrame(frame);
})();
