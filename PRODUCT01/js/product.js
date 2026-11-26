/* =========================================================
   PRODUCT 01 · STREET FOLD & FOLD MARK — 개인 제품 사이트 v2
   - 화면 연출: 저녁 불빛(보케) · 이야기 문장 바뀜 · 읽으며 밝아지는 문장 · 연결선 채움
   - 3D: 한 개의 WebGL 화면을 '지금 가장 많이 보이는 칸'으로 옮겨 가며 씀
       hero      : 저녁 명동, 두 제품
       fmSteps   : FOLD MARK 작동 4단계 (스크롤로 바뀜)
       fmStudio  : FOLD MARK 직접 조작 — 360° 회전 · 확대/축소 · 주먹 홈 누르면 스티커 출력
       sf        : STREET FOLD 부위 탐색 — 번호등 · 디스플레이 · 대는 곳 · 판 · 쓰레기통 · 카드 태그
   - 재질: 스튜디오 조명(빛 반사판)을 직접 만들어 무광 플라스틱 느낌을 살림
   ========================================================= */
(function () {
  "use strict";
  /* ---------- v6: 첫 시나리오 실사 영상 (js/film-cuts.js 목록) — 스크롤 위치에 맞춰 앞뒤로 재생 ---------- */
  var FILMV = (function () {
    var cuts = (window.PP_FILM_CUTS || []).filter(function (c) { return c && c.src; }), box = null, made = false, FADE = .012;
    function make() {
      made = true; box = document.getElementById("ppVideo"); if (!box) return;
      cuts.forEach(function (c, i) {
        var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = i < 2 ? "auto" : "metadata";
        if (c.poster) v.poster = c.poster; v.src = c.src; v.className = "pp-cut"; box.appendChild(v); c.v = v; c.want = -1;
        v.addEventListener("seeked", function () { c.busy = false; }); v.addEventListener("loadeddata", function () { c.ok = true; });
      });
    }
    function nextOf(c) { return cuts.filter(function (d) { return Math.abs(d.a - c.b) < 1e-4; })[0]; }
    function prevOf(c) { return cuts.filter(function (d) { return Math.abs(d.b - c.a) < 1e-4; })[0]; }
    return {
      update: function (p, host) {
        if (!cuts.length) return false;
        if (!made) make(); if (!box) return false;
        var full = false;
        cuts.forEach(function (c, i) {
          var on = p >= c.a - FADE && p < c.b + FADE, op = 0;
          if (on) {
            op = 1;
            if (!prevOf(c) && c.a > 0) op = Math.min(op, (p - (c.a - FADE)) / (FADE * 2));     // 앞이 3D 면 서서히 나타남
            if (!nextOf(c) && c.b < 1) op = Math.min(op, ((c.b + FADE) - p) / (FADE * 2));     // 뒤가 3D 면 서서히 사라짐
            op = Math.max(0, Math.min(1, op)); if (op >= .999 && p >= c.a && p < c.b) full = true;
            var k = Math.max(0, Math.min(1, (p - c.a) / (c.b - c.a))), t = c.from + (c.to - c.from) * k, v = c.v;
            if (v.preload !== "auto") v.preload = "auto";
            if (v.readyState >= 1 && !c.busy && Math.abs(v.currentTime - t) > 1 / 30) { c.busy = true; try { v.currentTime = t; } catch (e) { c.busy = false; } }
            var nx = cuts[i + 1]; if (nx && nx.v.preload !== "auto") nx.v.preload = "auto";
          }
          c.v.style.opacity = op.toFixed(3); c.v.style.visibility = op > 0 ? "visible" : "hidden";
        });
        if (host) host.style.opacity = full ? "0" : "";
        return full;
      }
    };
  })();

  var doc = document, T = window.THREE, TXT = window.MD_CONTENT;
  var reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, k, dt) { return lerp(a, b, 1 - Math.exp(-k * dt)); }
  function eio(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function eout(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function vis(el) { var r = el.getBoundingClientRect(); return Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) * Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)); }
  function inView(el, m) { var r = el.getBoundingClientRect(); m = m || 0; return r.bottom > -m && r.top < innerHeight + m; }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(d) { return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }

  var E = { r: null, active: null, ok: false, pick: function () {}, stickerTex: null }, STAGES = {};

  /* ---------- 문구 ---------- */
  if (TXT && TXT.products && TXT.products[1]) { var nn = $("#ppNextName"); if (nn) nn.textContent = TXT.products[1].no + " · " + TXT.products[1].name; }
  requestAnimationFrame(function () { requestAnimationFrame(function () { doc.body.classList.add("is-ready"); }); });

  /* =========================================================
     1. 저녁 불빛 (흐릿한 빛 망울) — 콘티의 '배경 blur'
     ========================================================= */
  var BOKEH = [];
  (function () {
    var cols = ["255,206,92", "255,170,70", "255,228,150", "242,217,75", "255,120,140", "120,200,230", "255,255,235"];
    var spr = {};
    function sprite(c) {
      if (spr[c]) return spr[c];
      var s = doc.createElement("canvas"); s.width = s.height = 128; var g = s.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(" + c + ",1)"); gr.addColorStop(.55, "rgba(" + c + ",.55)"); gr.addColorStop(.8, "rgba(" + c + ",.18)"); gr.addColorStop(1, "rgba(" + c + ",0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return (spr[c] = s);
    }
    $$("[data-bokeh]").forEach(function (cv, ci) {
      var g = cv.getContext("2d"), P = [], seed = 7 + ci * 13;
      function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
      for (var i = 0; i < 46; i++) P.push({ x: rnd(), y: rnd() * .85, r: 14 + Math.pow(rnd(), 2.2) * 120, c: cols[Math.floor(rnd() * cols.length)], a: .05 + rnd() * .22, vx: (rnd() - .5) * .006, ph: rnd() * 6.28, sp: .3 + rnd() * .7 });
      BOKEH.push({ cv: cv, g: g, P: P, on: false, w: 0, h: 0 });
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { BOKEH.forEach(function (b) { if (b.cv === e.target) b.on = e.isIntersecting; }); }); });
      BOKEH.forEach(function (b) { io.observe(b.cv); });
    } else BOKEH.forEach(function (b) { b.on = true; });
    var last = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      var dt = last ? Math.min(.05, (now - last) / 1000) : .016; last = now;
      BOKEH.forEach(function (b) {
        if (!b.on) return;
        var w = Math.round(b.cv.clientWidth / 2), h = Math.round(b.cv.clientHeight / 2);
        if (w !== b.w || h !== b.h) { b.w = b.cv.width = w; b.h = b.cv.height = h; }
        var g = b.g; g.clearRect(0, 0, w, h); g.globalCompositeOperation = "lighter";
        b.P.forEach(function (p) {
          if (!reduced) { p.x += p.vx * dt; p.ph += dt * p.sp; if (p.x < -.1) p.x = 1.1; if (p.x > 1.1) p.x = -.1; }
          var a = p.a * (.75 + .25 * Math.sin(p.ph)), r = p.r * (h / 520);
          g.globalAlpha = a; g.drawImage(sprite(p.c), p.x * w - r, p.y * h - r, r * 2, r * 2);
        });
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      });
    })(0);
  })();

  /* =========================================================
     2. 스크롤 연출 (머리 색 · 진행 막대 · 이야기 · 읽기 · 단계 · 연결선)
     ========================================================= */
  var hd = $("#ppHd"), bar = $("#ppBar"), navA = $$("[data-nav]"), secs = $$("[data-sec]");
  var story = $("#story"), storyLi = $$("#ppStory li"), storyDots = $$("#ppStoryDots i");
  var read = $("#ppRead"), readW = [];
  if (read) {
    read.innerHTML = read.textContent.trim().split(/\s+/).map(function (w) { return "<span>" + w + "</span>"; }).join(" ");
    readW = $$("span", read);
  }
  var fmLis = $$("#ppFmSteps li"), FM_STEP = 0, tray = $("#ppTray"), stepNo = $("#ppStepNo b");
  var flow = $("#ppFlow"), flowFill = $("#ppFlowFill"), flowCols = $$(".pp-flow-col");
  var wave = $("#ppWave"), waveP = $("#ppWaveP");
  /* ---------- 글자가 뒤섞였다 제자리를 찾음 (첫 화면 제목 · 장 제목) ---------- */
  function scramble(el, dur) {
    if (reduced || el._scr) return; el._scr = 1;
    var txt = el.textContent, AB = "ABCDEFGHIKLMNORSTUVXZ&", t0 = performance.now();
    (function f(now) {
      var k = clamp((now - t0) / (dur || 900), 0, 1), n = Math.floor(k * txt.length), o = "";
      for (var i = 0; i < txt.length; i++) o += i < n || txt[i] === " " || !/[A-Z&]/.test(txt[i]) ? txt[i] : AB[Math.floor(Math.random() * AB.length)];
      el.textContent = o; if (k < 1) requestAnimationFrame(f); else el.textContent = txt;
    })(t0);
  }
  setTimeout(function () { $$("[data-scramble]").forEach(function (el, i) { setTimeout(function () { scramble(el, 1000); }, i * 160); }); }, 250);
  function onScroll() {
    var H = doc.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = "scaleX(" + (H > 0 ? scrollY / H : 0).toFixed(4) + ")";
    // 머리: 아래 깔린 칸이 어두우면 밝은 글자
    var under = null; secs.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= 34 && r.bottom > 34) under = s; });
    var dark = under && under.classList.contains("night");
    hd.classList.toggle("is-light", !dark && scrollY > 10);
    hd.classList.toggle("is-dark", !!dark && scrollY > innerHeight * .6);
    var cur = under ? under.getAttribute("data-sec") : "";
    navA.forEach(function (a) { a.classList.toggle("is-on", a.getAttribute("data-nav") === cur); });
    // 이야기
    if (story) {
      var rs = story.getBoundingClientRect(), p = clamp(-rs.top / Math.max(1, rs.height - innerHeight), 0, .999), k = Math.floor(p * storyLi.length);
      storyLi.forEach(function (li, i) { li.classList.toggle("is-on", i === k); li.classList.toggle("is-past", i < k); });
      storyDots.forEach(function (d, i) { d.classList.toggle("is-on", i === k); });
      var sm = $$("#ppStoryMedia > *"); sm.forEach(function (m, i) { m.classList.toggle("is-on", i === k); });
    }
    // 노란 물결 막 (영상 끝 → 다음 장)
    if (wave) {
      var rw = wave.getBoundingClientRect(), wk = clamp((innerHeight - rw.top) / (rw.height + innerHeight * .25), 0, 1), ey = lerp(100, 0, wk), cy = ey - 80 * Math.sin(Math.PI * Math.min(1, wk * 1.15));
      waveP.setAttribute("d", "M0 100 L0 " + ey.toFixed(2) + " Q50 " + cy.toFixed(2) + " 100 " + ey.toFixed(2) + " L100 100Z");
    }
    // 읽으며 밝아지는 문장
    if (read) {
      var rr = read.getBoundingClientRect(), q = clamp((innerHeight * .82 - rr.top) / (rr.height + innerHeight * .3), 0, 1), n = Math.round(q * readW.length);
      readW.forEach(function (w, i) { w.classList.toggle("on", i < n); });
    }
    // FOLD MARK 단계
    if (fmLis.length) {
      var best = 0, bd = 1e9;
      fmLis.forEach(function (li, i) { var r = li.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - innerHeight / 2); if (d < bd) { bd = d; best = i; } });
      if (best !== FM_STEP) { FM_STEP = best; if (STAGES.fmSteps) STAGES.fmSteps.setStep(best); }
      fmLis.forEach(function (li, i) { li.classList.toggle("is-on", i === FM_STEP); });
      if (tray) tray.classList.toggle("is-on", FM_STEP === 3);
      if (stepNo) stepNo.textContent = pad2(FM_STEP + 1);
    }
    // 연결선
    if (flow) {
      var rf = flow.getBoundingClientRect(), f = clamp((innerHeight * .8 - rf.top) / (innerHeight * .55), 0, 1);
      flowFill.style.transform = "scaleX(" + f.toFixed(3) + ")";
      flowCols.forEach(function (c, i) { c.classList.toggle("is-on", f > i * .42 + .02); });
    }
    E.pick();
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);

  /* ---------- 나타나기 ---------- */
  var rvio = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); rvio.unobserve(e.target); } }); }, { rootMargin: "0px 0px -12% 0px" }) : null;
  $$(".pp-sec-hd > *, .pp-why-pair, .pp-studio-hd, .pp-print, .pp-sys .pp-h2, .pp-flow-col, .pp-draw, .pp-spec-list > div, .pp-next-in > *").forEach(function (el, i) {
    el.classList.add("rv"); el.style.transitionDelay = ((i % 3) * 0.08) + "s"; if (rvio) rvio.observe(el); else el.classList.add("is-in");
  });

  /* ---------- 3D 칸이 둥근 창처럼 열리며 등장 ---------- */
  $$(".pp-studio-view, .pp-fm-stage .pp-stage-box, .pp-explore").forEach(function (el) {
    el.classList.add("pp-reveal"); if (rvio) rvio.observe(el); else el.classList.add("is-in");
  });

  /* ---------- 흐르는 글자 띠: 평소엔 천천히, 스크롤하면 그 속도만큼 빨라짐 ---------- */
  (function () {
    var m = $("#ppMarq"); if (!m || reduced) return;
    var x = 0, v = 0, lastY = scrollY, lt = 0;
    (function f(now) {
      requestAnimationFrame(f);
      var dt = lt ? Math.min(.05, (now - lt) / 1000) : .016; lt = now;
      var dy = scrollY - lastY; lastY = scrollY; v = damp(v, dy / Math.max(dt, .001), 6, dt);
      if (!inView(m, 100)) return;
      x -= (60 + Math.min(Math.abs(v), 3000) * .35) * dt * (v < -20 ? -1 : 1);
      var w = m.firstElementChild.offsetWidth; if (w) { x = ((x % w) + w) % w - w; }
      m.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0) skewX(" + clamp(-v / 300, -8, 8).toFixed(2) + "deg)";
    })(0);
  })();

  /* ---------- 도면 바꾸기 ---------- */
  $$("[data-draw]").forEach(function (b) { b.addEventListener("click", function () {
    $$("[data-draw]").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-selected", x === b); });
    var im = $("#ppDraw"), n = b.getAttribute("data-draw");
    im.style.opacity = 0; setTimeout(function () { im.src = "./assets/images/drawing-" + n + ".webp"; im.alt = (n === "foldmark" ? "FOLD MARK" : "STREET FOLD") + " 치수 도면"; im.style.opacity = 1; }, 230);
  }); });

  /* ---------- 조작 안내 (거슬리지 않게) ----------
     - 평소엔 기본 마우스 모양(손바닥)만, 3D 칸 왼쪽 아래에 작은 안내 한 줄
     - 누를 수 있는 곳(주먹 홈) 위에서만 마우스 옆에 작은 말풍선 */
  var tip = $("#ppTip"), tipOn = false;
  var ROT_ICO = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M15.5 7.5A6 6 0 1 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16.4 3.6v4.3h-4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  $$("[data-cursor]").forEach(function (h) {
    var d = doc.createElement("p"); d.className = "pp-drag"; d.innerHTML = ROT_ICO + "<span>" + h.getAttribute("data-cursor") + "</span>"; h.appendChild(d);
    h.addEventListener("pointerdown", function () { setTimeout(function () { d.classList.add("is-used"); }, 400); });
  });
  if (tip) addEventListener("pointermove", function (e) { if (tipOn) tip.style.transform = "translate(" + (e.clientX + 16) + "px," + (e.clientY + 18) + "px)"; }, { passive: true });
  function cursorText(s) { if (!tip) return; tipOn = !!s; if (s) tip.textContent = s; tip.classList.toggle("is-on", tipOn); }

  /* =========================================================
     3. 약도 스티커 (한국어 · English · 日本語) — 상민님 스티커 배치를 그대로 따라 그림
     ========================================================= */
  var LANG = {
    ko: { table: "내 테이블", h1: "노점을 등지고,", h2: "왼쪽으로", s1: "약국", s1b: "직진", s2: "카페 모퉁이", s2b: "왼쪽으로", start: "노점", walk: "걸어서 {m}분", arrive: "도착", valid: "{t}까지 유효", route: "가는 길에", route2: "명동역 방향", tap: "테이블에 대 주세요" },
    en: { table: "Your table", h1: "Stall at your back,", h2: "go left", s1: "Pharmacy", s1b: "keep straight", s2: "Café corner", s2b: "turn left", start: "Stall", walk: "{m} min walk", arrive: "Arrive", valid: "Valid until {t}", route: "On your route", route2: "toward Myeongdong Stn.", tap: "Tap at the table" },
    ja: { table: "あなたのテーブル", h1: "屋台を背にして", h2: "左へ", s1: "ドラッグストア", s1b: "を過ぎて直進", s2: "カフェの角", s2b: "を左へ", start: "屋台", walk: "徒歩{m}分", arrive: "到着", valid: "{t}まで有効", route: "帰り道に", route2: "明洞駅方面", tap: "テーブルにかざす" }
  };
  var ST = { lang: "ko", num: 12, mins: 1, at: new Date(), n: 0 };
  var FONT = '"Pretendard", "Apple SD Gothic Neo", "Hiragino Sans", "Yu Gothic", "Meiryo", "Malgun Gothic", sans-serif';
  function drawSticker(cv, o) {
    var g = cv.getContext("2d"), L = LANG[o.lang], s = cv.width / 1120, ink = "#2B2C28", grey = "#6E6F69", gold = "#E8C25A";
    g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 1120, 224);
    function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function txt(t, x, y, size, w, col, al) { g.font = (w || 500) + " " + size + "px " + FONT; g.fillStyle = col || ink; g.textAlign = al || "left"; g.textBaseline = "alphabetic"; g.fillText(t, x, y); }
    function lamp(x, y, k) { k = k || 1; g.fillStyle = gold; g.beginPath(); g.moveTo(x - 16 * k, y); g.quadraticCurveTo(x - 15 * k, y - 15 * k, x, y - 15 * k); g.quadraticCurveTo(x + 15 * k, y - 15 * k, x + 16 * k, y); g.closePath(); g.fill(); g.fillStyle = ink; rr(x - 19 * k, y, 38 * k, 4 * k, 2); g.fill(); }
    g.fillStyle = "#fff"; rr(1, 1, 1118, 222, 6); g.fill(); g.strokeStyle = "#E3E1D8"; g.lineWidth = 2; g.stroke();
    // 1 번호 칸
    g.fillStyle = "#FFFCF3"; rr(28, 20, 166, 184, 14); g.fill(); g.strokeStyle = gold; g.lineWidth = 3; g.stroke();
    lamp(111, 54); txt(L.table, 111, 82, o.lang === "ja" ? 14 : 16, 500, grey, "center");
    var num = pad2(o.num); txt(num, 111, 172, 86, 700, ink, "center");
    // 2 가는 길
    txt(L.h1, 226, 54, 15, 600); txt(L.h2, 226, 77, 17, 700);
    g.strokeStyle = ink; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.moveTo(238, 120); g.lineTo(652, 120); g.stroke();
    g.fillStyle = "#fff"; g.lineWidth = 4; g.beginPath(); g.arc(238, 120, 8, 0, 6.283); g.fill(); g.stroke();
    // 꺾는 곳 1
    g.fillStyle = "#fff"; rr(409, 108, 24, 24, 5); g.fill(); g.lineWidth = 3; g.stroke(); txt("1", 421, 126, 13, 700, ink, "center");
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(421, 84); g.lineTo(421, 106); g.stroke();
    txt("① " + L.s1, 421, 56, 15, 700, ink, "center"); txt(L.s1b, 421, 76, 13, 500, grey, "center");
    // 꺾는 곳 2
    g.fillStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(566, 120, 15, 0, 6.283); g.fill(); g.stroke();
    g.lineWidth = 2.6; g.beginPath(); g.moveTo(571, 130); g.lineTo(571, 117); g.quadraticCurveTo(571, 112, 566, 112); g.lineTo(560, 112); g.stroke();
    g.beginPath(); g.moveTo(563, 107); g.lineTo(558, 112); g.lineTo(563, 117); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.moveTo(566, 84); g.lineTo(566, 104); g.stroke();
    txt("② " + L.s2, 566, 56, 15, 700, ink, "center"); txt(L.s2b, 566, 76, 13, 500, grey, "center");
    lamp(672, 120, 1.05); txt(num, 672, 158, 17, 700, ink, "center");
    txt(L.start, 242, 158, 15, 500, ink, "center"); txt(L.walk.replace("{m}", o.mins), 493, 158, 15, 500, grey, "center");
    // 3 시각
    var at = o.at, va = new Date(at.getTime() + 4 * 60000);
    txt(L.arrive, 737, 70, 15, 500, grey); g.font = "700 38px " + FONT; var aw = g.measureText(L.arrive).width;
    txt(hhmm(at), 795, 74, 38, 700, ink);
    txt(L.valid.replace("{t}", hhmm(va)), 737, 104, 14, 600, ink);
    g.strokeStyle = "#E3E1D8"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(737, 124); g.lineTo(927, 124); g.stroke();
    txt(L.route, 737, 150, 13, 500, grey); txt(L.route2, 737, 184, 15, 600, ink);
    // 4 QR (모양만)
    var sd = o.num * 97 + o.n * 13 + 5; function rnd() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    var q = 25, cs = 5.4, qx = 958, qy = 24; g.fillStyle = ink;
    for (var i = 0; i < q; i++) for (var j = 0; j < q; j++) {
      var f = (i < 7 && j < 7) || (i > q - 8 && j < 7) || (i < 7 && j > q - 8);
      if (f) { var a = i > q - 8 ? i - (q - 7) : i, b = j > q - 8 ? j - (q - 7) : j; var on = (a === 0 || a === 6 || b === 0 || b === 6) || (a > 1 && a < 5 && b > 1 && b < 5); if (on) g.fillRect(qx + i * cs, qy + j * cs, cs + .3, cs + .3); }
      else if (!((i === 7 || j === 7) && (i < 8 || j < 8)) && rnd() > .52) g.fillRect(qx + i * cs, qy + j * cs, cs + .3, cs + .3);
    }
    txt(L.tap, 1025, 188, o.lang === "ja" ? 12 : 13, 600, ink, "center");
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  var stickerCv = $("#ppSticker"), paper = $("#ppPaper"), note = $("#ppPrintNote");
  var texCv = doc.createElement("canvas"); texCv.width = 1120; texCv.height = 224;
  function nextSticker() {
    var nums = [12, 7, 3, 15, 9, 4, 11], m = [1, 2, 1, 3, 2, 1, 2];
    ST.n++; ST.num = nums[ST.n % nums.length]; ST.mins = m[ST.n % m.length]; ST.at = new Date(Date.now() + ST.mins * 60000);
    drawSticker(texCv, ST); if (E.stickerTex) E.stickerTex.needsUpdate = true;
  }
  function showPaper() {
    if (!stickerCv) return; drawSticker(stickerCv, ST);
    paper.classList.remove("is-new"); void paper.offsetWidth; paper.classList.add("is-new");
    var Lw = { ko: "한국어", en: "English", ja: "日本語" }[ST.lang];
    note.textContent = pad2(ST.num) + "번 테이블 · 걸어서 " + ST.mins + "분 · " + Lw + " 스티커가 나왔습니다. 다시 누르면 다음 손님의 스티커가 나옵니다.";
  }
  function redrawAll() { drawSticker(texCv, ST); if (stickerCv) drawSticker(stickerCv, ST); if (E.stickerTex) E.stickerTex.needsUpdate = true; }
  redrawAll();
  if (doc.fonts && doc.fonts.load) Promise.all([doc.fonts.load('700 40px "Pretendard"'), doc.fonts.load('500 16px "Pretendard"'), doc.fonts.load('600 16px "Pretendard"')]).then(function () { redrawAll(); if (E.redrawScreens) E.redrawScreens(); }, function () {});
  $$("[data-lang]").forEach(function (b) { b.addEventListener("click", function () {
    ST.lang = b.getAttribute("data-lang");
    $$("[data-lang]").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
    redrawAll(); if (stickerCv) { paper.classList.remove("is-new"); void paper.offsetWidth; paper.classList.add("is-new"); }
  }); });

  /* =========================================================
     4. 3D 엔진
     ========================================================= */
  function initE() {
    if (!T || !T.GLTFLoader || !window.MD_MODELS) return;
    var r;
    try {
      r = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
    } catch (e) { return; }
    E.r = r;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;   // v6: 명암 대비를 살려 실제 사진처럼
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFShadowMap; r.setClearColor(0x000000, 0);
    r.domElement.setAttribute("tabindex", "-1");

    /* ---- 스튜디오 환경광 (빛 반사판) ---- */
    var pm = new T.PMREMGenerator(r);
    function envScene(night) {
      var s = new T.Scene(), room = new T.Mesh(new T.BoxGeometry(20, 12, 20), new T.MeshBasicMaterial({ color: night ? 0x0b0b0a : 0xcfc9ba, side: T.BackSide }));
      room.position.y = 4; s.add(room);
      function panel(w, h, x, y, z, rx, ry, cr, cg, cb) { var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ side: T.DoubleSide })); m.material.color.setRGB(cr, cg, cb); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); s.add(m); }
      if (!night) {
        panel(7, 7, 0, 9.9, 0, Math.PI / 2, 0, 6, 5.9, 5.6);          // 위 큰 반사판
        panel(1.4, 8, -9.9, 4, 1, 0, Math.PI / 2, 4.2, 3.9, 3.4);      // 왼쪽 길쭉한 빛
        panel(1.2, 8, 9.9, 4, -2, 0, -Math.PI / 2, 2.2, 2.3, 2.5);     // 오른쪽 차가운 빛
        panel(10, 2.4, 0, 1.4, 9.9, 0, Math.PI, 1.6, 1.55, 1.45);       // 앞 아래 채움
        var fl = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshBasicMaterial({ color: 0xb9b3a3 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -1.99; s.add(fl);
      } else {
        panel(2.4, 5, -9.9, 3, -2, 0, Math.PI / 2, 3.2, 2.2, .55);     // 노란 간판
        panel(1.6, 3.4, -9.9, 4, 4, 0, Math.PI / 2, 2.6, .5, 1.1);     // 분홍 간판
        panel(2.2, 4, 9.9, 3.5, -3, 0, -Math.PI / 2, .35, 1.4, 2.0);   // 푸른 간판
        panel(3, 2, 6, 3, -9.9, 0, 0, 2.6, 1.6, .5);                  // 뒤 노점 불빛
        panel(8, 8, 0, 9.9, 0, Math.PI / 2, 0, .35, .33, .3);
        panel(10, 1.6, 0, 1.2, 9.9, 0, Math.PI, .7, .55, .35);
      }
      return pm.fromScene(s, .035).texture;
    }
    var ENV_DAY = envScene(false), ENV_NIGHT = envScene(true);

    /* ---- 모델 읽기 ---- */
    var BUF = {}, loader = new T.GLTFLoader();
    function b64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
    function getModel(name, cb) {
      if (BUF[name]) return cb(BUF[name].clone(true));
      loader.parse(b64(window.MD_MODELS[name]), "", function (gl) {
        gl.scene.traverse(function (o) { if (o.isMesh) o.userData.mn = (o.material && o.material.name) || ""; });
        BUF[name] = gl.scene; cb(gl.scene.clone(true));
      }, function (e) { console.warn(e); });
    }
    // 재질: 라이노에서 넘어온 '거울 같은 광택(거칠기 0)'을 무광 플라스틱으로 바로잡음
    var ROUGH = { "페인트": .62, "플라스틱": .48, "페인트 (1)": .16, "페인트 (7)": .36, "플라스틱 (2)": .58, "페인트 (6)": .55, "페인트 (3)": .6, "플라스틱 (1)": .4, "페인트 (4)": .7, "페인트 (5)": .5, "페인트 (8)": .5, "발광": .4 };
    function upgrade(root, fm) {
      root.traverse(function (o) {
        if (!o.isMesh) return;
        var m0 = o.material, n = o.userData.mn, m = new T.MeshPhysicalMaterial({ color: m0.color ? m0.color.clone() : new T.Color(1, 1, 1), side: T.DoubleSide });
        m.roughness = ROUGH[n] != null ? ROUGH[n] : .55; m.metalness = 0;
        if (fm && n === "플라스틱") m.roughness = .5;
        if (fm && n === "플라스틱 (1)") m.roughness = .66;
        if (n === "페인트 (1)" && !fm) { m.clearcoat = 1; m.clearcoatRoughness = .08; }
        if (fm && n === "페인트 (1)") { m.roughness = .48; m.clearcoat = .25; m.clearcoatRoughness = .5; }   // v9 새 FOLD MARK: 아이보리 몸체 (무광에 가까운 단단한 플라스틱)
        if (fm && n === "페인트") { m.roughness = .78; }                                                      // v9: 차콜 주먹 패드 (고무 느낌)
        if (n === "플라스틱" && !fm) { m.clearcoat = .2; m.clearcoatRoughness = .4; }
        if (m0.emissive && (m0.emissive.r + m0.emissive.g + m0.emissive.b) > 0) { m.emissive = m0.emissive.clone(); m.emissiveIntensity = .8; m.color.set(0x2a2a20); }
        m.name = n; o.material = m; o.castShadow = true; o.receiveShadow = true;
      });
    }
    function boxOf(list) { var b = new T.Box3(); list.forEach(function (o) { b.expandByObject(o); }); return b; }
    function reparent(o, pivot) { o.updateMatrixWorld(true); var m = o.matrixWorld.clone(); pivot.updateMatrixWorld(true); m.premultiply(new T.Matrix4().copy(pivot.matrixWorld).invert()); o.parent.remove(o); m.decompose(o.position, o.quaternion, o.scale); pivot.add(o); }

    /* ---- 화면 그림 (디스플레이 · 번호) ---- */
    function screenCanvas(w, h) { var c = doc.createElement("canvas"); c.width = w; c.height = h; return c; }
    function drawScreen(c, mode, num) {
      var g = c.getContext("2d"), w = c.width, h = c.height; g.fillStyle = "#0e0f0d"; g.fillRect(0, 0, w, h);
      var Y = "#F2D94B", W = "#F3F0E4", S = "rgba(243,240,228,.55)";
      function t(s, x, y, size, wt, col) { g.font = wt + " " + size + "px " + FONT; g.fillStyle = col; g.textAlign = "left"; g.fillText(s, x, y); }
      g.fillStyle = mode === "use" ? "rgba(243,240,228,.1)" : Y; g.fillRect(36, 40, w - 72, 8);
      t("TABLE", 40, 112, 28, 600, S); t(pad2(num), 34, 300, 210, 700, mode === "use" ? W : Y);
      if (mode === "idle") { t("비어 있어요", 40, 420, 54, 700, W); t("트레이 스티커를", 40, 520, 36, 500, S); t("아래 원에 대 주세요", 40, 568, 36, 500, S); }
      if (mode === "wait") { t("도착 예정 " + hhmm(ST.at), 40, 420, 48, 700, W); t("약도 스티커 손님을", 40, 520, 36, 500, S); t("기다리고 있어요", 40, 568, 36, 500, S); }
      if (mode === "ok") { t("확인됐어요", 40, 420, 54, 700, Y); t("판이 내려옵니다", 40, 520, 36, 500, W); t("천천히 드세요", 40, 568, 36, 500, S); }
      if (mode === "use") { t("사용 중", 40, 420, 54, 700, W); t("남은 시간 14분", 40, 520, 36, 500, S); g.fillStyle = "rgba(243,240,228,.15)"; g.fillRect(40, 600, w - 80, 10); g.fillStyle = Y; g.fillRect(40, 600, (w - 80) * .62, 10); }
      g.fillStyle = S; g.font = "500 26px " + FONT; g.fillText("얼굴·이름은 표시하지 않습니다", 40, h - 52);
    }
    function lampCanvas(num) { var c = screenCanvas(512, 200), g = c.getContext("2d"); g.clearRect(0, 0, 512, 200); g.font = "700 150px " + FONT; g.fillStyle = "#2B2C28"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(pad2(num), 256, 108); return c; }

    /* ---- STREET FOLD 만들기 ---- */
    function buildSF(cb, opt) {
      getModel("streetfold", function (root) {
        upgrade(root, false);
        var wrap = new T.Group(); wrap.add(root); root.updateMatrixWorld(true);
        var meshes = []; root.traverse(function (o) { if (o.isMesh) meshes.push(o); });
        function C(o) { return new T.Box3().setFromObject(o).getCenter(new T.Vector3()); }
        // 판 + 고리
        var plate = new T.Group(); plate.position.set(0, .9766, 0); root.add(plate);
        var pl = meshes.filter(function (o) { var c = C(o); return (o.userData.mn === "페인트 (6)" || o.userData.mn === "페인트 (7)") && c.y > .85 && c.y < 1.06; });
        pl.forEach(function (o) { reparent(o, plate); });
        // 판 아래 걸이: 판이 어떻게 돌든 무게로 늘 아래로 늘어짐 → 판을 올리면 기둥의 걸이 홈 안으로 쏙, 내리면 다시 늘어짐
        var hookM = pl.filter(function (o) { return o.userData.mn === "페인트 (7)"; }), hook = new T.Group();
        if (hookM.length) {
          var hb = boxOf(hookM); hook.position.set((hb.min.x + hb.max.x) / 2, hb.max.y - plate.position.y, (hb.min.z + hb.max.z) / 2); plate.add(hook);
          hookM.forEach(function (o) { reparent(o, hook); });
        }
        // 쓰레기통 앞판 → 아래 앞 모서리를 축으로 기울어 나옴
        var binM = meshes.filter(function (o) { return o.userData.mn === "플라스틱 (2)"; });
        var bb = boxOf(binM), bin = new T.Group(); bin.position.set(0, bb.min.y, bb.max.z); root.add(bin);
        binM.forEach(function (o) { reparent(o, bin); });
        // 쓰레기통 몸통(모델에 없어서 같은 크기로 만들어 붙임): 기울면 보이는 부분
        var bodyM = new T.MeshPhysicalMaterial({ color: 0x3b3d37, roughness: .62 }), lin = new T.MeshPhysicalMaterial({ color: 0x23241f, roughness: .8 });
        var bw = bb.max.x - bb.min.x - .006, bh = bb.max.y - bb.min.y - .03, bd = .118, th = .006;
        [[th, bh, bd, -bw / 2 + th / 2, bh / 2, -bd / 2, bodyM], [th, bh, bd, bw / 2 - th / 2, bh / 2, -bd / 2, bodyM], [bw, th, bd, 0, th / 2, -bd / 2, bodyM], [bw, bh, th, 0, bh / 2, -bd + th / 2, bodyM], [bw - .02, .004, bd - .02, 0, bh * .55, -bd / 2, lin]].forEach(function (q) {
          var m = new T.Mesh(new T.BoxGeometry(q[0], q[1], q[2]), q[6]); m.position.set(q[3], q[4], q[5] - .004); m.castShadow = m.receiveShadow = true; bin.add(m);
        });
        // 디스플레이 화면
        var dM = meshes.filter(function (o) { return o.userData.mn === "페인트 (1)" && C(o).y > 1.4; }), db = boxOf(dM), dsz = db.getSize(new T.Vector3()), dc = db.getCenter(new T.Vector3());
        var scv = screenCanvas(512, Math.round(512 * dsz.y / dsz.x)), stex = new T.CanvasTexture(scv); stex.colorSpace = T.SRGBColorSpace; stex.anisotropy = 4;
        var scr = new T.Mesh(new T.PlaneGeometry(dsz.x * .94, dsz.y * .96), new T.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 1.15, roughness: .2 }));
        scr.position.set(dc.x, dc.y, db.max.z + .0012); root.add(scr);
        // 대는 곳 (원)
        var rM = meshes.filter(function (o) { var c = C(o); return (o.userData.mn === "플라스틱 (1)" || o.userData.mn === "페인트 (1)") && c.y > 1.2 && c.y < 1.42; }), rb = boxOf(rM), rc = rb.getCenter(new T.Vector3());
        rM.forEach(function (o) { if (o.userData.mn === "플라스틱 (1)") { o.material.emissive = new T.Color(0xFFFFFF); o.material.emissiveIntensity = 0; } });   // 홈 원형 조명: 화이트
        // 번호등 (노란 머리) + 번호
        var capM = meshes.filter(function (o) { return o.userData.mn === "플라스틱" && C(o).y > 1.9; });
        capM.forEach(function (o, i) { if (i) o.material = capM[0].material; }); var capMat = capM[0] ? capM[0].material : null;
        if (capMat) { capMat.emissive = new T.Color(0xF2C94B); capMat.emissiveIntensity = .15; }
        var lcv = lampCanvas(12), ltex = new T.CanvasTexture(lcv); ltex.colorSpace = T.SRGBColorSpace;
        var lampN = new T.Group(); root.add(lampN);   // 확정본: 꼭대기에 번호는 넣지 않음 (빛으로만 알림)
        // 카드 태그 (옆면)
        var tM = meshes.filter(function (o) { var c = C(o); return o.userData.mn === "플라스틱" && c.x > .16 && c.y < .8; }), tc = boxOf(tM).getCenter(new T.Vector3());
        tM.forEach(function (o, i) { if (i) o.material = tM[0].material; }); var tagMat = tM[0] ? tM[0].material : null; if (tagMat) { tagMat.emissive = new T.Color(0xF2D94B); tagMat.emissiveIntensity = 0; }
        // 모듈 아래 조명선 (호박색) — 맨 아래 앞의 얇은 선
        var amb = meshes.filter(function (o) { var c = C(o); return o.userData.mn === "플라스틱" && c.y < .2; }), ambM = amb[0] ? amb[0].material : null;
        amb.forEach(function (o) { o.material = ambM; }); if (ambM) { ambM.color.set(0x6b4a14); ambM.emissive = new T.Color(0xFFB547); ambM.emissiveIntensity = .35; }
        // 상태 점 (쓰레기통 위)
        var dot = meshes.filter(function (o) { var c = C(o); return o.userData.mn === "페인트 (1)" && c.y > .6 && c.y < .8; });
        dot.forEach(function (o) { o.material.emissive = new T.Color(0x9BE07A); o.material.emissiveIntensity = 0; });
        var M = {
          group: wrap, root: root, plate: plate, bin: bin, scr: scr, stex: stex, scv: scv, capMat: capMat, tagMat: tagMat, rM: rM, dot: dot, lampN: lampN,
          fold: opt && opt.open ? 1 : 0, tFold: opt && opt.open ? 1 : 0, tilt: 0, tTilt: 0, mode: "idle", pulse: 0, tagPulse: 0, readerPulse: 0, lampOn: 0, tLampOn: opt && opt.lamp ? 1 : .2,
          P: { lamp: [.125, 2.0, .01, 0, 0, 1], display: [dc.x + dsz.x * .36, dc.y + dsz.y * .4, db.max.z + .01, 0, 0, 1], reader: [rc.x, rc.y, rb.max.z + .01, 0, 0, 1], plate: null, bin: null, tag: [tc.x + .006, tc.y, tc.z, 1, 0, 0] }
        };
        M.ha = opt && opt.open ? 0 : Math.PI / 2; M.hv = 0;
        // 분해해서 보기: 부위별로 묶어 앞 · 위 · 옆으로 띄움
        function grp(list) { var g = new T.Group(); root.add(g); list.forEach(function (o) { if (o.parent) reparent(o, g); }); return g; }
        var XG = { lamp: grp(capM.concat([lampN])), display: grp(dM.concat([scr])), reader: grp(rM), tag: grp(tM) };
        var XO = { lamp: [0, .26, .06], display: [0, .05, .3], reader: [0, 0, .42], tag: [.3, 0, 0], plate: [0, 0, .5], bin: [0, -.02, .38] };
        var PB = { plate: plate.position.clone(), bin: bin.position.clone() };
        M.ex = 0; M.tEx = 0; M.P0 = JSON.parse(JSON.stringify(M.P)); M.XO = XO;
        M.applyEx = function () {
          var e = eio(M.ex);
          Object.keys(XG).forEach(function (k) { XG[k].position.set(XO[k][0] * e, XO[k][1] * e, XO[k][2] * e); var b = M.P0[k]; M.P[k] = [b[0] + XO[k][0] * e, b[1] + XO[k][1] * e, b[2] + XO[k][2] * e, b[3], b[4], b[5]]; });
          plate.position.set(PB.plate.x, PB.plate.y + XO.plate[1] * e, PB.plate.z + XO.plate[2] * e);
          bin.position.set(PB.bin.x, PB.bin.y + XO.bin[1] * e, PB.bin.z + XO.bin[2] * e);
          // v9: 조립 연출 — 부품이 멀리서 날아와 제자리에 맞물림 (M.asm[k] = [dx, dy, dz, 회전])
          if (M.asm) Object.keys(M.asm).forEach(function (k) { var a = M.asm[k], o = k === "plate" ? plate : k === "bin" ? bin : XG[k]; if (!o || !a) return; o.position.x += a[0]; o.position.y += a[1]; o.position.z += a[2]; o.rotation.y = a[3] || 0; });
        };
        M.setScreen = function (mode) { M.mode = mode; drawScreen(scv, mode, 12); stex.needsUpdate = true; };
        M.redraw = function () { drawScreen(scv, M.mode, 12); stex.needsUpdate = true; var c2 = lampCanvas(12); lcv.getContext("2d").clearRect(0, 0, 512, 200); lcv.getContext("2d").drawImage(c2, 0, 0); ltex.needsUpdate = true; };
        M.setScreen(opt && opt.screen || "idle");
        M.update = function (dt, t) {
          M.fold = reduced ? M.tFold : damp(M.fold, M.tFold, 3.2, dt);
          M.ex = reduced ? M.tEx : damp(M.ex, M.tEx, 2.6, dt); M.applyEx();
          var f = M.fold; plate.rotation.x = -Math.PI / 2 * (1 - eio(f));
          // 걸이: 진자처럼 살짝 늦게 따라와 흔들리다 멈춤
          var want = -plate.rotation.x; M.hv = (M.hv || 0) + ((want - (M.ha || 0)) * 60 - (M.hv || 0) * 9) * dt; M.ha = (M.ha || 0) + M.hv * dt;
          if (reduced) M.ha = want; hook.rotation.x = M.ha;
          M.tilt = reduced ? M.tTilt : damp(M.tilt, M.tTilt, 3.4, dt); bin.rotation.x = .28 * M.tilt;
          M.lampOn = damp(M.lampOn, M.tLampOn, 3, dt);
          if (capMat) capMat.emissiveIntensity = .08 + M.lampOn * (.55 + .12 * Math.sin(t * 2.2)) + M.pulse * .8;
          M.pulse = Math.max(0, M.pulse - dt * .9);
          if (tagMat) tagMat.emissiveIntensity = M.tagPulse * (1.2 + .5 * Math.sin(t * 14)); M.tagPulse = Math.max(0, M.tagPulse - dt * .5);
          rM.forEach(function (o) { if (o.userData.mn === "플라스틱 (1)") o.material.emissiveIntensity = Math.max(M.readerPulse * 1.8, M.fold < .05 ? .25 + .2 * Math.sin(t * 2.4) : .15); }); M.readerPulse = Math.max(0, M.readerPulse - dt * .5);   // 숨쉬듯 '여기에 대세요' → 대면 밝게
          // 모듈 아래 호박색 조명선: 판이 내려오는 동안 흐르듯, 쓰레기통이 가득 차면 깜박
          if (ambM) { var moving = Math.abs(M.fold - M.tFold) > .01; ambM.emissiveIntensity = M.full ? (Math.sin(t * 8) > 0 ? 1.6 : .05) : moving ? .6 + .9 * Math.abs(Math.sin(t * 6)) : .35; }
          dot.forEach(function (o) { o.material.emissiveIntensity = (M.tilt > .05 ? 1.2 : .25) + .2 * Math.sin(t * 3); });
          scr.material.emissiveIntensity = 1.05 + M.pulse * .3;
        };
        cb(M);
      });
    }

    /* ---- FOLD MARK 만들기 (스티커 띠 포함) ---- */
    function buildFM(cb, opt) {
      getModel("foldmark", function (root) {
        upgrade(root, true);
        var wrap = new T.Group(), squash = new T.Group(); wrap.add(squash); squash.add(root);
        root.position.set(-.085, 0, 0);   // v9 새 모델: 길이 170 mm (뒤 x=0 → 앞 빛 띠 x=.17)
        var pad = [], band = [];
        root.traverse(function (o) {
          if (!o.isMesh) return;
          if (o.userData.mn === "페인트" || o.userData.mn === "플라스틱 (1)") pad.push(o);
          if (o.userData.mn === "발광") band.push(o);
          if (!o.userData.mn) { var b = new T.Box3().setFromObject(o); if (b.max.y > .052) o.visible = false; } // 모델 안 임시 스티커 면은 숨김
        });
        var bandMat = band[0] ? band[0].material : null; band.forEach(function (o) { o.material = bandMat; });
        if (bandMat) { bandMat.emissive = new T.Color(0xFFB547); bandMat.emissiveIntensity = .25; bandMat.color.set(0x3a3a2a); }   // 조명 띠: 호박색
        // 주먹 홈 = 아이보리 윗면의 움푹 파인 곳 (도면: 약 82 × 66 mm, 깊이 6) — 위에서 쏴서 홈 바닥 높이를 찾음
        root.updateMatrixWorld(true);
        var REC = new T.Vector3(.118, .03, 0), rcY = new T.Raycaster(new T.Vector3(.118 - .085, .3, 0), new T.Vector3(0, -1, 0));   // v9: 차콜 패드 가운데 (앞으로 기울어진 면)
        var SLOPE = -.27;   // 패드 면의 기울기 (뒤 높이 48 mm → 앞 24 mm)
        var hy = rcY.intersectObject(root, true).filter(function (h) { return h.object.visible; })[0]; if (hy) REC.y = hy.point.y;
        var gcv = screenCanvas(128, 128), gg = gcv.getContext("2d"), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, "rgba(242,217,75,.85)"); gr.addColorStop(.6, "rgba(242,217,75,.35)"); gr.addColorStop(1, "rgba(242,217,75,0)"); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
        var glow = new T.Mesh(new T.PlaneGeometry(.085, .07), new T.MeshBasicMaterial({ map: new T.CanvasTexture(gcv), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        var padTilt = new T.Group(); padTilt.position.set(REC.x - .085, REC.y + .0025, 0); padTilt.rotation.z = SLOPE; squash.add(padTilt);
        glow.rotation.x = -Math.PI / 2; padTilt.add(glow);
        // 스티커 띠: 윗면 틈(x .0605, y .0498)에서 앞쪽(+x)으로 비스듬히 나오며 끝이 처짐
        var strip = null;
        if (!opt || !opt.noStrip) {
          var N = 48, geo = new T.BufferGeometry(), pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
          for (var i = 0; i < N; i++) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          geo.setIndex(idx); geo.setAttribute("position", new T.BufferAttribute(pos, 3)); geo.setAttribute("uv", new T.BufferAttribute(uv, 2));
          if (!E.stickerTex) { E.stickerTex = new T.CanvasTexture(texCv); E.stickerTex.colorSpace = T.SRGBColorSpace; E.stickerTex.anisotropy = 8; }
          var sm = new T.MeshPhysicalMaterial({ map: E.stickerTex, roughness: .5, side: T.DoubleSide, sheen: .3 });
          strip = new T.Mesh(geo, sm); strip.castShadow = true; strip.receiveShadow = true; strip.frustumCulled = false; root.add(strip);
          strip.userData = { N: N, e: 0, L: .29, W: .058, U: 1, lift: 0, fade: 1 };
        }
        function layStrip() {
          if (!strip) return;
          var u = strip.userData, N = u.N, e = Math.max(u.e, .0005), P = strip.geometry.attributes.position.array, UV = strip.geometry.attributes.uv.array;
          var x = .0614, y = .0498, ph = 50 * Math.PI / 180, ds = e / N, half = u.W / 2;   // v9.1: 이전 FOLD MARK 와 같은 방향·각도 — 패드 뒤 틈에서 앞쪽(주먹 친 방향)으로 50°
          for (var i = 0; i <= N; i++) {
            var s = i * ds;
            if (i) { var a = ph - Math.min(Math.max(0, s - .05) * 7, 1.9) * (1 - .25 * u.lift) * (1 - (u.taut || 0)); x += Math.cos(a) * ds; y += Math.sin(a) * ds; }   // 처음 5 cm 는 50° 로 곧게(친 각도 = 뽑는 각도), 그다음은 길게 나오며 무게로 휨
            var j = i * 6; P[j] = x; P[j + 1] = y + u.lift * .06; P[j + 2] = -half; P[j + 3] = x; P[j + 4] = y + u.lift * .06; P[j + 5] = half;
            var uu = u.U * clamp(1 - (e - s) / u.L, 0, 1), q = i * 4; UV[q] = uu; UV[q + 1] = 1; UV[q + 2] = uu; UV[q + 3] = 0;
          }
          strip.geometry.attributes.position.needsUpdate = true; strip.geometry.attributes.uv.needsUpdate = true; strip.geometry.computeVertexNormals(); strip.geometry.boundingSphere = null; strip.geometry.boundingBox = null;
          strip.visible = u.e > .001 && u.fade > .01; strip.material.opacity = u.fade; strip.material.transparent = u.fade < .999;
        }
        // 누름 파문
        var ring = new T.Mesh(new T.RingGeometry(.02, .024, 48), new T.MeshBasicMaterial({ color: 0xF2D94B, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, .0005, 0); padTilt.add(ring);
        var M = { group: wrap, root: root, pad: pad, strip: strip, ring: ring, glowM: glow, hover: 0, tHover: 0, bandMat: bandMat, sq: 0, rip: 1, blink: 0, glow: .25, tGlow: .25, job: null, busy: false, rec: REC };
        M.isPad = function (pw) { var q = root.worldToLocal(pw.clone()); return q.x > .074 && q.x < .17 && Math.abs(q.z) < .034 && q.y > .018; };
        M.recWorld = function () { return root.localToWorld(REC.clone()); };
        // 툭 → 고르기 → 인쇄
        M.tap = function (onPrinted) {
          if (M.busy) return false; M.busy = true;
          var old = strip ? strip.userData.e > .01 : false;
          M.job = { t: 0, old: old, done: false, cb: onPrinted };
          M.sq = 1; M.rip = 0; return true;
        };
        M.sig = "idle"; M.sigT = 0; M.onSig = null;
        M.setSig = function (k) { M.sig = k; M.sigT = 0; if (M.onSig) M.onSig(k); };
        // v9.1: 출력된 스티커를 눌러서 떼기 (패드를 다시 누르지 않아도 됨)
        M.isStrip = function (obj) { return !!strip && obj === strip && strip.visible && strip.userData.e > .01; };
        M.tear = function (cb) {
          if (!strip || M.busy || strip.userData.e < .01 || M.tearing) return false;
          M.tearing = { t: 0, cb: cb }; return true;
        };
        M.resetStrip = function () { if (strip) { strip.userData.e = 0; strip.userData.lift = 0; strip.userData.fade = 1; layStrip(); } };
        M.update = function (dt, t) {
          // 눌림 (스프링)
          M.sq = Math.max(0, M.sq - dt * 5); var s = 1 - .045 * Math.sin(Math.min(1, 1 - M.sq) * Math.PI) * (M.sq > 0 ? 1 : 0);
          squash.scale.set(1 + (1 - s) * .4, s, 1 + (1 - s) * .4);
          M.hover = damp(M.hover, M.tHover, 8, dt); glow.material.opacity = Math.max(M.hover * .55, M.sq * .9, (1 - M.rip) * .5);
          M.rip = Math.min(1, M.rip + dt * 1.4); ring.scale.setScalar(1 + M.rip * 1.3); ring.material.opacity = (1 - M.rip) * .85;
          var J = M.job;
          if (J) {
            J.t += dt;
            if (J.old && strip) { var k = clamp(J.t / .45, 0, 1); strip.userData.lift = eout(k); strip.userData.fade = 1 - k; if (k >= 1) { strip.userData.e = 0; strip.userData.lift = 0; strip.userData.fade = 1; J.old = false; J.t0 = J.t; } }
            var tt = J.t - (J.t0 || 0) - (J.t0 != null ? 0 : 0);
            if (!J.old) {
              var b = tt; // 0~.9 고르기(빛 깜박), .9~3.1 인쇄
              if (b < .9) { if (!J.pick) { J.pick = true; nextSticker(); M.setSig("pick"); } M.tGlow = .2 + 1.5 * (Math.sin(b * 22) > 0 ? 1 : 0); }
              else if (strip && b < 3.1) { M.tGlow = 1.3; strip.userData.e = strip.userData.L * eio((b - .9) / 2.2); }
              else if (!J.done) { J.done = true; M.setSig("done"); if (strip) strip.userData.e = strip.userData.L; M.busy = false; M.job = null; if (J.cb) J.cb(); }
            }
          } else {
            // 빛 띠 신호: 대기(은은) · 고르는 중(빠른 깜박) · 출력 완료(밝게) · 빈자리 없음(두 번 깜박 후 꺼짐)
            M.sigT += dt; var g0 = M.idleGlow != null ? M.idleGlow : .3;
            if (M.sig === "pick") { M.tGlow = .2 + 1.5 * (Math.sin(M.sigT * 22) > 0 ? 1 : 0); if (M.sigT > 1.8) M.setSig("idle"); }
            else if (M.sig === "done") { M.tGlow = 1.7; if (M.sigT > 2.6) M.setSig("idle"); }
            else if (M.sig === "full") { var q = M.sigT; M.tGlow = (q < .2 || (q > .4 && q < .6)) ? 1.7 : (q < 3 ? 0 : g0); if (q > 3.2) M.setSig("idle"); }
            else M.tGlow = damp(M.tGlow, g0, 2, dt);
          }
          if (M.tearing && strip) {   // 떼기: 위로 살짝 들리며 사라짐 → 틈은 다시 비어 있음
            var tw = M.tearing; tw.t += dt; var kk = clamp(tw.t / .5, 0, 1);
            strip.userData.taut = eout(kk); strip.userData.lift = eout(kk); strip.userData.fade = 1 - kk;
            if (kk >= 1) { strip.userData.e = 0; strip.userData.lift = 0; strip.userData.fade = 1; strip.userData.taut = 0; M.tearing = null; if (tw.cb) tw.cb(); }
          }
          M.glow = damp(M.glow, M.tGlow, 14, dt);
          if (bandMat) bandMat.emissiveIntensity = M.glow;
          layStrip();
        };
        layStrip(); cb(M);
      });
    }

    /* ---- 바닥 그림자 · 빛 ---- */
    function blobTex() { var c = screenCanvas(256, 256), g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, "rgba(30,28,22,.55)"); gr.addColorStop(.5, "rgba(30,28,22,.2)"); gr.addColorStop(1, "rgba(30,28,22,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); var t = new T.CanvasTexture(c); return t; }
    var BLOB = blobTex();
    function ground(sc, w, d, op, blob) {
      var gm = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: op || .2 })); gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; sc.add(gm);
      if (blob) { var b = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, opacity: blob })); b.rotation.x = -Math.PI / 2; b.position.y = .0008; sc.add(b); }
    }
    // v6: 뒤쪽 가장자리 빛(윤곽) + 아래에서 살짝 받쳐 주는 반사광 → 실제 촬영 조명처럼 명암이 또렷하게
    function realLight(sc, size) {
      var rim = new T.DirectionalLight(0xEAF0FF, 1.25); rim.position.set(1.2 * size, 1.1 * size, -1.6 * size); sc.add(rim);
      var bounce = new T.HemisphereLight(0xffffff, 0x8a7e66, .22); sc.add(bounce);
    }
    function keyLight(sc, col, inten, pos, size, target) {
      var L = new T.DirectionalLight(col, inten); L.position.copy(pos); L.castShadow = true;
      L.shadow.mapSize.set(2048, 2048); var c = L.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = .1; c.far = 20;
      L.shadow.bias = -.0004; L.shadow.normalBias = .02; L.shadow.radius = 4; if (target) { L.target.position.copy(target); sc.add(L.target); }
      sc.add(L); return L;
    }

    /* ---- 궤도 카메라 (돌리기 · 확대 · 부드러운 이동) ---- */
    function Orbit(o) {
      this.c = { yaw: o.yaw, pitch: o.pitch, dist: o.dist, x: o.t[0], y: o.t[1], z: o.t[2] };
      this.g = { yaw: o.yaw, pitch: o.pitch, dist: o.dist, x: o.t[0], y: o.t[1], z: o.t[2] };
      this.home = { yaw: o.yaw, pitch: o.pitch, dist: o.dist, t: o.t.slice() };
      this.min = o.min || .2; this.max = o.max || 10; this.pmin = o.pmin != null ? o.pmin : -.15; this.pmax = o.pmax != null ? o.pmax : 1.2;
      this.tw = null; this.vy = 0; this.spin = false; this.base = o.dist;
    }
    Orbit.prototype.to = function (q, dur) {
      var c = this.c, y = q.yaw != null ? q.yaw : c.yaw; y = c.yaw + (((y - c.yaw) % 6.2832) + 9.4248) % 6.2832 - 3.1416;
      var g = { yaw: y, pitch: q.pitch != null ? q.pitch : c.pitch, dist: q.dist != null ? q.dist : c.dist, x: q.t ? q.t[0] : c.x, y: q.t ? q.t[1] : c.y, z: q.t ? q.t[2] : c.z };
      if (reduced || !dur) { this.c = Object.assign({}, g); this.g = Object.assign({}, g); this.tw = null; return; }
      this.tw = { a: Object.assign({}, c), b: g, t: 0, d: dur || 1.4 }; this.g = Object.assign({}, g); this.vy = 0;
    };
    Orbit.prototype.drag = function (dx, dy) {
      if (this.tw) { this.g = Object.assign({}, this.c); this.tw = null; }
      this.g.yaw -= dx * .0085; this.g.pitch = clamp(this.g.pitch + dy * .006, this.pmin, this.pmax); this.vy = -dx * .0085;
    };
    Orbit.prototype.zoom = function (f) { if (this.tw) { this.g = Object.assign({}, this.c); this.tw = null; } this.g.dist = clamp(this.g.dist * f, this.min, this.max); };
    Orbit.prototype.update = function (dt, dragging) {
      var c = this.c, g = this.g;
      if (this.tw) { var w = this.tw; w.t += dt / w.d; var k = eio(w.t); ["yaw", "pitch", "dist", "x", "y", "z"].forEach(function (n) { c[n] = lerp(w.a[n], w.b[n], k); }); if (w.t >= 1) this.tw = null; return; }
      if (!dragging) { if (Math.abs(this.vy) > .0002) { g.yaw += this.vy; this.vy *= Math.pow(.02, dt); } if (this.spin && !reduced) g.yaw += dt * .4; }
      ["yaw", "pitch", "dist", "x", "y", "z"].forEach(function (n) { c[n] = damp(c[n], g[n], dragging ? 22 : 9, dt); });
    };
    Orbit.prototype.apply = function (cam) {
      var c = this.c, cp = Math.cos(c.pitch), d = c.dist * Math.max(1, Math.pow((this.wide || 1.15) / Math.max(.3, cam.aspect), .85));
      cam.position.set(c.x + Math.sin(c.yaw) * cp * d, c.y + Math.sin(c.pitch) * d, c.z + Math.cos(c.yaw) * cp * d); cam.lookAt(c.x, c.y, c.z);
    };

    /* ---------------- 무대 0 (v5): 스크롤 영상 — 손그림 콘티 1~10 ----------------
       옆에서 본 3D. 모든 것은 진행도 p(0~1) 하나로 정해져서, 어디서 멈춰도 그 순간이 정확히 보입니다.
       손은 사진 대신 손 모양을 따라 만든 3D 모델 (사장님: 목장갑 + 비닐장갑 / 손님: 맨손 + 소매)  */
    function V(a) { return new T.Vector3(a[0], a[1], a[2]); }
    function basisQ(x, y) { var X = V(x).normalize(), Y = V(y), Z = new T.Vector3().crossVectors(X, Y).normalize(); Y.crossVectors(Z, X); return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z)); }
    function ramp(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
    function sstep(k) { return k * k * (3 - 2 * k); }
    function track(keys, p) {
      var n = keys.length; if (p <= keys[0][0]) return keys[0][1].slice(); if (p >= keys[n - 1][0]) return keys[n - 1][1].slice();
      for (var i = 0; i < n - 1; i++) if (p < keys[i + 1][0]) { var a = keys[i], b = keys[i + 1], k = sstep((p - a[0]) / (b[0] - a[0])); return a[1].map(function (v, j) { return v + (b[1][j] - v) * k; }); }
    }
    function poseAt(keys, p) {
      var n = keys.length, a = keys[0], b = keys[0], k = 0;
      if (p >= keys[n - 1].p) a = b = keys[n - 1];
      else for (var i = 0; i < n - 1; i++) if (p >= keys[i].p && p < keys[i + 1].p) { a = keys[i]; b = keys[i + 1]; k = sstep((p - a.p) / (b.p - a.p)); break; }
      function L(u, v) { return u.map(function (x, j) { return x + (v[j] - x) * k; }); }
      return { q: a.q.clone().slerp(b.q, k), at: L(a.at, b.at), loc: L(a.loc, b.loc), c: L(a.c, b.c), th: a.th + (b.th - a.th) * k };
    }
    function knitTex(base, dot) {
      var c = screenCanvas(128, 128), g = c.getContext("2d"); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
      var sd = 11; function rn() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
      for (var i = 0; i < 1500; i++) { g.fillStyle = rn() > .5 ? dot : "rgba(255,255,255,.18)"; g.fillRect(rn() * 128, rn() * 128, 1.6, 2.4); }
      for (var y = 0; y < 128; y += 4) { g.fillStyle = "rgba(0,0,0,.10)"; g.fillRect(0, y, 128, 1); }
      var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 3); t.colorSpace = T.SRGBColorSpace; return t;
    }
    /* 손 모델: js/hand.js (뼈대를 부드럽게 이어 만든 한 덩어리 손 + 뼈 16개). 맨손은 살색 · 손톱 광택, 장갑은 우윳빛 라텍스 */
    var HANDG = null;
    function noiseTex(kind) {
      var c = screenCanvas(256, 256), g = c.getContext("2d"), sd = 5; function rn() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
      g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
      if (kind === "pore") { for (var i = 0; i < 9000; i++) { var v = 110 + rn() * 40 | 0; g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(rn() * 256, rn() * 256, 1.4, 1.4); } for (i = 0; i < 260; i++) { g.strokeStyle = "rgba(60,60,60,.16)"; g.lineWidth = .7; g.beginPath(); var x = rn() * 256, y = rn() * 256, a = rn() * 6.28; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); } }
      else { for (var k = 0; k < 150; k++) { var x0 = rn() * 256, y0 = rn() * 256, len = 20 + rn() * 70, dk = rn() > .5; g.strokeStyle = dk ? "rgba(30,30,30," + (.1 + rn() * .22) + ")" : "rgba(235,235,235," + (.1 + rn() * .2) + ")"; g.lineWidth = 1 + rn() * 3.5; g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(x0 + (rn() - .5) * 16, y0 + len * .3, x0 + (rn() - .5) * 22, y0 + len * .7, x0 + (rn() - .5) * 12, y0 + len); g.stroke(); } g.filter = "blur(1.2px)"; g.drawImage(c, 0, 0); }
      var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
    }
    function handGeo() {
      if (HANDG) return HANDG; var D = window.PP_HAND; if (!D) return null;
      function dec(s2, Ty) { var b = atob(s2), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Ty(u.buffer); }
      var n = D.n, q = dec(D.pos, Uint16Array), nr = dec(D.nor, Int8Array), cl = dec(D.col, Uint8Array), gl = dec(D.gl, Uint8Array), bi = dec(D.bi, Uint8Array), bw = dec(D.bw, Uint8Array);
      var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), gcol = new Float32Array(n * 3), uv = new Float32Array(n * 2), glf = new Float32Array(n), sw = new Float32Array(n * 4), si = new Uint16Array(n * 4);
      for (var i = 0; i < n * 3; i++) { pos[i] = D.lo[i % 3] + q[i] / 65535 * (D.hi[i % 3] - D.lo[i % 3]); nor[i] = nr[i] / 127; col[i] = Math.pow(cl[i] / 255, 2.2); gcol[i] = lerp([.9, .9, .88][i % 3], col[i] * 1.6, .13); }
      for (i = 0; i < n; i++) { uv[i * 2] = pos[i * 3] / .05; uv[i * 2 + 1] = (pos[i * 3 + 2] + pos[i * 3 + 1] * .7) / .05; glf[i] = gl[i] / 255; }
      for (i = 0; i < n * 4; i++) { sw[i] = bw[i] / 255; si[i] = bi[i]; }
      function mk(c) { var g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("normal", new T.BufferAttribute(nor, 3)); g.setAttribute("color", new T.BufferAttribute(c, 3)); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); g.setAttribute("gl", new T.BufferAttribute(glf, 1)); g.setAttribute("skinIndex", new T.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new T.BufferAttribute(sw, 4)); g.setIndex(new T.BufferAttribute(dec(D.idx, D.i32 ? Uint32Array : Uint16Array), 1)); g.computeBoundingSphere(); return g; }
      var pore = noiseTex("pore"); pore.repeat.set(3, 3); var wr = noiseTex("wrinkle");
      var skin = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .5, sheen: .55, sheenColor: new T.Color(0xffa58c), sheenRoughness: .42, bumpMap: pore, bumpScale: .9, emissive: 0x5a1c10, emissiveIntensity: .1 });
      skin.onBeforeCompile = function (sh) {   // 손톱만 매끈하게
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float gl; varying float vGl;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvGl = gl;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vGl;").replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .14, vGl);");
      };
      var glove = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .36, sheen: .5, sheenColor: new T.Color(0xffffff), sheenRoughness: .3, clearcoat: .3, clearcoatRoughness: .3, bumpMap: wr, bumpScale: .7, emissive: 0x3a2c22, emissiveIntensity: .12 });
      HANDG = { D: D, skin: mk(col), glove: mk(gcol), mSkin: skin, mGlove: glove };
      return HANDG;
    }
    function makeHand(kind) {
      var G = new T.Group(), H = new T.Group(); G.add(H);
      var HD = handGeo(), D = HD.D, mesh = new T.SkinnedMesh(kind === "glove" ? HD.glove : HD.skin, kind === "glove" ? HD.mGlove : HD.mSkin);
      mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; H.add(mesh);
      var tmp = new T.Group(), B = D.bones.map(function (b) { var o = new T.Bone(); o.position.set(b.p[0], b.p[1], b.p[2]); o.quaternion.copy(basisQ(b.x, b.y)); tmp.add(o); return o; });
      tmp.updateMatrixWorld(true); D.bones.forEach(function (b, i) { if (b.par >= 0) B[b.par].attach(B[i]); });
      mesh.add(B[0]); mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(B));
      B.forEach(function (o) { o.userData.q0 = o.quaternion.clone(); });
      var F = D.chains.slice(0, 4).map(function (c) { return c.map(function (i) { return B[i]; }); }), TB = D.chains[4].map(function (i) { return B[i]; });
      var eu = new T.Euler(), qq = new T.Quaternion();
      function rot(o, x, y, z) { eu.set(x, y, z, "YXZ"); qq.setFromEuler(eu); o.quaternion.copy(o.userData.q0).multiply(qq); }
      function add(m) { m.castShadow = m.receiveShadow = true; H.add(m); return m; }
      function tube(r1, r2, len, x0, mat, sy) { var g = new T.CylinderGeometry(r1, r2, len, 32, 1); g.rotateZ(Math.PI / 2); g.translate(x0 - len / 2, 0, 0); var m = new T.Mesh(g, mat); m.scale.set(1, sy || .84, 1); return add(m); }
      if (kind === "glove") {
        var rim = new T.Mesh(new T.TorusGeometry(.0305, .0026, 10, 40), HD.mGlove.clone()); rim.material.vertexColors = false; rim.material.color.set(0xefe9dc); rim.rotation.y = Math.PI / 2; rim.position.x = -.056; rim.scale.set(1, .83, 1); add(rim);   // 장갑 끝 말린 테
        var arm = new T.MeshPhysicalMaterial({ color: 0xcf9a7c, roughness: .55, sheen: .4, sheenColor: new T.Color(0xff9a7a) });
        tube(.036, .075, 1.1, -.062, new T.MeshPhysicalMaterial({ map: knitTex("#2a2c28", "rgba(90,96,90,.5)"), bumpMap: HD.mGlove.bumpMap, bumpScale: 3, roughness: .92, sheen: .5, sheenColor: new T.Color(0x70766e) }));   // 걷어 올린 작업복 소매
      } else {
        var slv = new T.MeshPhysicalMaterial({ map: knitTex("#d9d2bf", "rgba(140,130,105,.35)"), bumpMap: HD.mGlove.bumpMap, bumpScale: 4, roughness: .95, sheen: .7, sheenColor: new T.Color(0xfff6e0) });
        tube(.036, .075, 1.1, -.052, slv); tube(.039, .037, .03, -.05, slv);
      }
      G.hand = H;
      G.setPose = function (c, th, sp) {
        for (var i = 0; i < 4; i++) { var k = c[i]; rot(F[i][0], 0, (i - 1.4) * .07 * (sp || 0) * (1 - k), -k * 1.52 + .04); rot(F[i][1], 0, 0, -k * 1.85 - .06); rot(F[i][2], 0, 0, -k * 1.2 - .05); }
        rot(TB[0], -.55 * th, .55 * th, -.42 * th); rot(TB[1], 0, 0, -.12 - th * .55); rot(TB[2], 0, 0, -.1 - th * .75);
      };
      G.place = function (P) { G.quaternion.copy(P.q); var o = V(P.loc); o.applyQuaternion(P.q); G.position.set(P.at[0] - o.x, P.at[1] - o.y, P.at[2] - o.z); G.setPose(P.c, P.th); };
      // 자세를 잡았을 때 손의 한 점(손끝 등)이 손 좌표로 어디인지 재어 둠 → 그 점을 물건에 정확히 맞춤
      G.probe = function (c, th, fi, ji, off) { G.setPose(c, th); G.position.set(0, 0, 0); G.quaternion.identity(); G.updateMatrixWorld(true); var o = (fi < 0 ? TB[ji] : F[fi][ji]).localToWorld(V(off)); o = H.worldToLocal(o); o.z *= H.scale.z; return [o.x, o.y, o.z]; };
      G.setPose([0, 0, 0, 0], 0);
      return G;
    }

    function stageFilm(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .03, 60), S = { host: host, sc: sc, cam: cam, blurK: 1, p: 0 };
      var sec = host.closest(".pp-film"), elTitle = $("#ppFilmTitle"), elBig = $("#ppBig"), elLens = $("#ppLens"), elBar = $("#ppFilmBar"), caps = $$("#ppCaps li"), elScroll = $("#ppFilmScroll"), elStreak = $(".pp-film-streak", sec);
      var forceP = (/[?&]p=([\d.]+)/.exec(location.search) || [])[1]; forceP = forceP != null ? clamp(+forceP, 0, 1) : null;
      if (forceP != null) setTimeout(function () { var r = sec.getBoundingClientRect(); scrollTo(0, scrollY + r.top + forceP * (r.height - innerHeight)); }, 300);
      sc.environment = ENV_NIGHT; sc.environmentIntensity = .85;
      var key = keyLight(sc, 0xFFF1DE, 2.2, new T.Vector3(0, 3, 5), 2.6); sc.add(key.target); key.shadow.radius = 6;
      var rim = new T.DirectionalLight(0x9FB8E8, 1.1); rim.position.set(3, 2.4, -3.5); sc.add(rim);
      var warm = new T.DirectionalLight(0xFF9A52, .8); warm.position.set(-4, 1.4, -1.5); sc.add(warm);
      var stall = new T.PointLight(0xFFD29A, .7, 2.4, 1.8); sc.add(stall);
      var ringL = new T.PointLight(0xFFF6E6, 0, 1.3, 1.6); sc.add(ringL);
      var ambL = new T.PointLight(0xFFB547, .25, 1.6, 1.8); sc.add(ambL);
      var capL = new T.PointLight(0xF2C94B, 1.2, 2.6, 2); sc.add(capL);
      var bandL = new T.PointLight(0xFFB547, 0, .35, 2); sc.add(bandL);
      [key, rim, warm, stall, ringL, ambL, capL, bandL].forEach(function (l) { l.layers.enableAll(); });
      function glowSprite(col, sz, layer) {
        var c = screenCanvas(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, col.replace("A", "1")); gr.addColorStop(.3, col.replace("A", ".38")); gr.addColorStop(1, col.replace("A", "0")); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0 }));
        sp.scale.setScalar(sz); sp.layers.set(layer); sc.add(sp); return sp;
      }
      var gCap = glowSprite("rgba(255,214,90,A)", .8, 1), gRing = glowSprite("rgba(255,250,236,A)", .34, 1), gAmb = glowSprite("rgba(255,181,71,A)", .6, 1), gBand = glowSprite("rgba(255,196,84,A)", .2, 0);

      /* ---- 세트 ---- */
      var FMP = new T.Vector3(-.5, .9, 4.3), SFP = new T.Vector3(1.35, 0, 1), TRAY0 = [.02, .9, 4.3], D50 = [Math.cos(50 * Math.PI / 180), Math.sin(50 * Math.PI / 180)];
      var BASE = [FMP.x - .085 + .0614, FMP.y + .0498, FMP.z], REC = [FMP.x + .033, FMP.y + .03, FMP.z];   // v9 새 FOLD MARK
      // 노점 카운터 (FOLD MARK 가 놓인 곳)
      var ctop = new T.Mesh(new T.BoxGeometry(4, .04, .66), new T.MeshPhysicalMaterial({ color: 0x34352f, roughness: .6, clearcoat: .08, clearcoatRoughness: .6 })); ctop.position.set(-1.5, .88, 4.3); ctop.receiveShadow = ctop.castShadow = true; sc.add(ctop);
      var cbody = new T.Mesh(new T.BoxGeometry(3.96, .86, .6), new T.MeshPhysicalMaterial({ color: 0x1f201b, roughness: .8 })); cbody.position.set(-1.5, .43, 4.3); cbody.receiveShadow = true; sc.add(cbody);
      var cline = new T.Mesh(new T.BoxGeometry(3.96, .008, .004), new T.MeshBasicMaterial({ color: 0xF2D94B, toneMapped: false })); cline.position.set(-1.5, .8, 4.602); sc.add(cline);
      // 골목 바닥 (그림자 받기) — 기둥과 같은 층
      var gm = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: .45 })); gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true; gm.layers.set(1); sc.add(gm);
      var bl = new T.Mesh(new T.PlaneGeometry(1.5, 1.1), new T.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, opacity: .6 })); bl.rotation.x = -Math.PI / 2; bl.position.set(SFP.x - .1, .001, SFP.z); bl.layers.set(1); sc.add(bl);
      // 트레이 (길쭉한 종이 트레이 + 꼬치) — 옆면에 약도 스티커
      var tray = new T.Group(), TL = .3, TH = .04, TD = .066, paper = new T.MeshPhysicalMaterial({ color: 0xe6dfc6, roughness: .9, sheen: .3 });
      [[TL, .003, TD, 0, .0015, 0], [TL, TH, .003, 0, TH / 2, TD / 2], [TL, TH, .003, 0, TH / 2, -TD / 2], [.003, TH, TD, TL / 2, TH / 2, 0], [.003, TH * .55, TD, -TL / 2, TH * .275, 0]].forEach(function (q) { var m = new T.Mesh(new T.BoxGeometry(q[0], q[1], q[2]), paper); m.position.set(q[3], q[4], q[5]); m.castShadow = m.receiveShadow = true; tray.add(m); });
      var meat = new T.MeshPhysicalMaterial({ color: 0x8a4a22, roughness: .45, clearcoat: .5, clearcoatRoughness: .3 }), stickM = new T.MeshStandardMaterial({ color: 0xd9c38c, roughness: .8 });
      [-.014, .014].forEach(function (z, r) {
        var st = new T.Mesh(new T.CylinderGeometry(.0016, .0016, .25, 6), stickM); st.rotation.z = Math.PI / 2; st.position.set(-.015, .024, z); st.castShadow = true; tray.add(st);
        for (var i = 0; i < 5; i++) { var c = new T.Mesh(new T.SphereGeometry(.0125, 14, 10), meat); c.scale.set(1.25, .8, 1); c.position.set(.11 - i * .033 - r * .008, .026, z); c.castShadow = true; tray.add(c); }
      });
      if (!E.stickerTex) { E.stickerTex = new T.CanvasTexture(texCv); E.stickerTex.colorSpace = T.SRGBColorSpace; E.stickerTex.anisotropy = 8; }
      var stMat = new T.MeshPhysicalMaterial({ map: E.stickerTex, roughness: .5, side: T.DoubleSide, transparent: true, opacity: 0 });
      var SL = .25, SW = .034, traySt = new T.Mesh(new T.PlaneGeometry(SL, SW), stMat); traySt.position.set(0, TH / 2, TD / 2 + .0022); tray.add(traySt);
      sc.add(tray);
      // 손에 들린 스티커 (틈에서 뽑혀 트레이로 가는 동안)
      var hsG = new T.PlaneGeometry(SL, SW * 1.5); hsG.translate(-SL / 2, 0, 0);
      var handSt = new T.Mesh(hsG, new T.MeshPhysicalMaterial({ map: E.stickerTex, roughness: .5, side: T.DoubleSide })); handSt.castShadow = true; handSt.visible = false; sc.add(handSt);
      var QS1 = basisQ([D50[0], D50[1], 0], [0, 0, 1]), QS2 = basisQ([1, 0, 0], [0, 1, 0]);
      // 손
      var vh = makeHand("glove"); vh.hand.scale.z = -1; sc.add(vh);
      var ch = makeHand("skin"); sc.add(ch);
      var QV = basisQ([-.77, -.64, 0], [0, 0, -1]), QP = basisQ([-.55, -.84, 0], [0, 0, -1]), QP2 = basisQ([-.75, -.66, 0], [0, .25, -1]);
      var QOUT = basisQ([1, .25, 0], [.25, -1, 0]), QU = basisQ([1, 0, 0], [0, -1, 0]), QD = basisQ([1, -.12, 0], [0, 1, 0]);
      var cFist = [1, 1, 1, 1], cPinch = [.52, .95, 1, 1], cCup = [.2, .2, .22, .28], cFlat = [.03, 0, .03, .08];
      function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
      var PINV = mid(vh.probe(cPinch, .62, 0, 2, [.02, -.007, 0]), vh.probe(cPinch, .62, -1, 2, [.026, -.008, 0])), PINC = mid(ch.probe(cPinch, .62, 0, 2, [.02, -.007, 0]), ch.probe(cPinch, .62, -1, 2, [.026, -.008, 0]));
      var FISTB = vh.probe(cFist, 1, 3, 0, [.02, .0, -.014]), PALM = [.06, -.014, 0], TIP = ch.probe(cFlat, .12, 1, 2, [.022, -.008, 0]);

      buildFM(function (m) { S.fm = m; m.group.position.copy(FMP); sc.add(m.group); m.idleGlow = .3; });
      buildSF(function (m) {
        S.sf = m; m.group.position.copy(SFP); m.group.rotation.y = -Math.PI / 2; sc.add(m.group); m.group.traverse(function (o) { o.layers.set(1); });
        m.group.updateMatrixWorld(true); m.plate.rotation.x = 0; m.plate.updateMatrixWorld(true);
        var hb = new T.Box3().setFromObject(m.plate), hinge = m.root.localToWorld(m.plate.position.clone());
        S.hinge = [hinge.x, hinge.y, hinge.z]; S.Lp = Math.max(.18, hinge.x - hb.min.x - .004);
        var rd = m.group.localToWorld(new T.Vector3(m.P.reader[0], m.P.reader[1], m.P.reader[2])); S.reader = [rd.x, rd.y, rd.z];
        var bb = new T.Box3().setFromObject(m.bin); S.binTop = bb.max.y; S.frontX = rd.x;
        m.setScreen("wait");
      }, { screen: "wait", lamp: true });

      /* ---- 흐린 배경: 기둥 층만 작게 그렸다가 키워 붙임 (콘티의 '배경 blur') ---- */
      var rt = null, qSc = new T.Scene(), qCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      var qM = new T.MeshBasicMaterial({ transparent: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, depthTest: false, depthWrite: false });
      qSc.add(new T.Mesh(new T.PlaneGeometry(2, 2), qM));
      S.render = function (r) {
        if (S.videoOn) return;
        var k = S.blurK, kq = k < 1.2 ? 1 : k < 3 ? 2 : k < 6 ? 4 : 8;
        if (kq === 1) { cam.layers.enableAll(); r.render(sc, cam); return; }
        var sz = r.getDrawingBufferSize(new T.Vector2()), w = Math.max(8, Math.round(sz.x / kq / 2)), h = Math.max(8, Math.round(sz.y / kq / 2));
        if (!rt || rt.width !== w || rt.height !== h) { if (rt) rt.dispose(); rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType }); qM.map = rt.texture; qM.needsUpdate = true; }
        cam.layers.set(1); r.setRenderTarget(rt); r.clear(); r.render(sc, cam); r.setRenderTarget(null);
        r.clear(); var ac = r.autoClear; r.autoClear = false; r.render(qSc, qCam); cam.layers.set(0); r.render(sc, cam); r.autoClear = ac; cam.layers.enableAll();
      };

      var CAM = [[0, [-.2, 1.05, 5.25]], [.06, [-.22, 1.04, 5.2]], [.16, [-.42, .962, 4.75]], [.3, [-.42, .962, 4.76]], [.385, [-.33, 1, 5.02]], [.45, [-.02, .97, 4.92]], [.5, [.03, 1, 4.94]],
        [.57, [.9, 2.2, 3.3]], [.64, [.95, 1.25, 3.2]], [.68, [1.2, 1.16, 2.3]], [.76, [1.2, 1.12, 2.3]], [.8, [1.2, .62, 2.3]], [.855, [1.2, .62, 2.3]], [.89, [.9, 1.05, 3]], [.945, [.9, 1.05, 3]], [1, [.9, -.5, 3]]];
      var FOC = [[0, [.4, 1, 2.6]], [.07, [.4, 1, 2.6]], [.16, [-.4, .9, 4.3]], [.5, [-.3, .9, 4.3]], [.6, [1.1, 1.2, 1]], [1, [1.1, .9, 1]]];
      var BLUR = [[0, [1]], [.07, [1]], [.13, [8]], [.5, [8]], [.56, [2.5]], [.585, [1]]];
      var tmpV = new T.Vector3(), lastP = -1;

      S.update = function (dt, t) {
        if (!S.sf || !S.fm) return;
        var r0 = sec.getBoundingClientRect(), tgt = forceP != null ? forceP : clamp(-r0.top / Math.max(1, r0.height - innerHeight), 0, 1);
        // v6: 휠 한 번에 장면이 툭 넘어가지 않게, 스크롤 위치를 부드럽게 따라감
        if (S.ps == null || forceP != null || Math.abs(tgt - S.ps) > .25) S.ps = tgt; else S.ps += (tgt - S.ps) * (1 - Math.exp(-dt * 3.2));
        var p = S.ps; S.p = p; window.PP_FILM_P = p;   // v9.1: 자막(단어씩 나타나기 · 큰 낱말)이 같은 시간을 씀
        S.videoOn = FILMV.update(p, host);       // v6: 실사 영상이 있는 컷은 영상으로 (3D 는 쉬게 함)
        var W = S.w || 1, Hh = S.h || 1, asp = W / Hh, narrow = asp < 1.25;
        cam.fov = clamp(30 * Math.pow(1.6 / asp, .8), 30, 60); cam.updateProjectionMatrix();
        var m = S.sf, fm = S.fm;

        /* 카메라 · 빛 */
        var c = track(CAM, p), sway = reduced ? 0 : Math.sin(t * .35) * .004;
        cam.position.set(c[0] + sway, c[1] + sway * .6, c[2]); cam.rotation.set(0, 0, 0);
        if (narrow && p < .14) { var nk = 1 - sstep(ramp(p, .04, .14)); cam.position.x = lerp(cam.position.x, .3, nk); cam.position.y = lerp(cam.position.y, 1.2, nk); cam.position.z = lerp(cam.position.z, 6.7, nk); }
        var f = track(FOC, p); key.target.position.set(f[0], f[1], f[2]); key.position.set(f[0] - 1.3, f[1] + 2.5, f[2] + 2.1);
        S.blurK = track(BLUR, p)[0];
        stall.position.set(FMP.x + .32, FMP.y + .42, FMP.z + .35);

        /* FOLD MARK: 툭 (.222) → 고르는 빛 → 스티커 */
        var hit = ramp(p, .214, .222) * (1 - ramp(p, .222, .25));
        fm.sq = hit * .95; fm.rip = p > .222 && p < .27 ? ramp(p, .222, .27) : 1;
        var picking = p > .224 && p < .272, printing = p >= .272 && p < .39;
        fm.sig = "idle"; fm.idleGlow = picking ? (Math.sin(p * 900) > 0 ? 1.7 : .15) : printing ? 1.5 : .3 + .12 * Math.sin(t * 2);
        var u = fm.strip.userData, e = p < .272 ? 0 : p < .33 ? .12 * sstep(ramp(p, .272, .33)) : p < .385 ? .12 + (u.L - .12) * sstep(ramp(p, .33, .385)) : 0;
        u.e = e; u.taut = ramp(p, .325, .345); u.lift = 0; u.fade = 1;
        fm.update(dt, t);
        var bw = new T.Vector3(.07, .016, 0); fm.root.parent.localToWorld(bw); gBand.position.copy(bw); gBand.material.opacity = clamp(fm.glow * .55, .15, 1); bandL.position.copy(bw); bandL.position.x += .03; bandL.intensity = fm.glow * .06;

        /* 손에 들린 스티커 → 트레이 옆면 */
        var grip = [BASE[0] + D50[0] * Math.max(.06, e - .035), BASE[1] + D50[1] * Math.max(.06, e - .035), BASE[2]];
        var stEnd = [TRAY0[0] + SL / 2, TRAY0[1] + TH / 2, TRAY0[2] + TD / 2 + .004];
        var mv = sstep(ramp(p, .385, .44)), carry = p >= .385 && p < .445;
        handSt.visible = carry;
        var pull = [BASE[0] + D50[0] * (u.L - .035), BASE[1] + D50[1] * (u.L - .035), BASE[2]];
        var hsP = [lerp(pull[0], stEnd[0], mv), lerp(pull[1], stEnd[1], mv) + Math.sin(mv * Math.PI) * .03, lerp(pull[2], stEnd[2], mv)];
        if (carry) { handSt.position.set(hsP[0], hsP[1], hsP[2]); handSt.quaternion.copy(QS1).slerp(QS2, sstep(ramp(mv, .15, .85))); handSt.scale.y = lerp(1, 1 / 1.5, mv); }
        stMat.opacity = p >= .445 ? 1 : 0;

        /* 트레이 */
        var hg = S.hinge, Lp = S.Lp, rd = S.reader, plateC = [hg[0] - Lp * .5 - .03, hg[1] + .013, hg[2]], slot = [S.frontX + .015, S.binTop - .045, SFP.z];
        var TR = [[.455, [TRAY0[0], TRAY0[1], TRAY0[2], 0]], [.475, [TRAY0[0], TRAY0[1] + .05, TRAY0[2], 0]], [.5, [TRAY0[0] + .02, TRAY0[1] + .07, TRAY0[2], 0]], [.57, [.45, 2.5, 1.6, 0]], [.64, [.82, 1.2, 1, 0]],
          [.67, [rd[0] - TL / 2 - .035, rd[1] - .02, rd[2], 0]], [.7, [rd[0] - TL / 2 - .035, rd[1] - .02, rd[2], 0]], [.735, [plateC[0] - .2, plateC[1] + .03, plateC[2], 0]], [.755, [plateC[0], plateC[1], plateC[2], 0]], [.795, [plateC[0], plateC[1], plateC[2], 0]],
          [.825, [slot[0] - Math.cos(.95) * TL / 2 - .02, slot[1] + Math.sin(.95) * TL / 2 + .03, slot[2], -.95]], [.855, [slot[0] + Math.cos(.95) * TL * .55, slot[1] - Math.sin(.95) * TL * .55, slot[2], -.95]]];
        var tp = track(TR, p); tray.position.set(tp[0], tp[1], tp[2]); tray.rotation.z = tp[3]; tray.visible = p < .853;
        tray.traverse(function (o) { o.layers.set(0); });

        /* STREET FOLD: 인식 → 판 내려옴 → (사람 손으로) 올림 */
        var heroFold = reduced ? 1 : .5 - .5 * Math.cos(t * .7);
        var fold = p < .12 ? heroFold * (1 - ramp(p, .05, .12)) : p < .695 ? 0 : p < .73 ? sstep(ramp(p, .695, .73)) : p < .885 ? 1 : 1 - sstep(ramp(p, .885, .94));
        m.fold = m.tFold = fold; m.tTilt = 0; m.tLampOn = 1;
        var read = ramp(p, .668, .69) * (1 - ramp(p, .74, .78)); m.readerPulse = Math.max(read, .001) * 1.1;
        var want = p < .69 ? "wait" : p < .93 ? (p < .745 ? "ok" : "use") : "idle"; if (m.mode !== want) m.setScreen(want);
        m.update(dt, t);
        var cw = new T.Vector3(0, 2.02, .1); m.group.localToWorld(cw); capL.position.copy(cw); gCap.position.copy(cw); gCap.material.opacity = .5 + .08 * Math.sin(t * 2.2);
        gRing.position.set(rd[0] - .012, rd[1], rd[2]); gRing.material.opacity = .12 + read * .9; ringL.position.set(rd[0] - .12, rd[1] - .05, rd[2]); ringL.intensity = .1 + read * 1.6;
        var moving = (p > .695 && p < .73) || (p > .885 && p < .94);
        gAmb.position.set(S.frontX - .02, .1, SFP.z); gAmb.material.opacity = moving ? .35 + .4 * Math.abs(Math.sin(p * 260)) : .28; ambL.position.set(S.frontX - .2, .14, SFP.z); ambL.intensity = moving ? .9 : .3;

        /* 사장님 손 (목장갑 + 비닐장갑) */
        var off = [REC[0] + .55, REC[1] + .6, REC[2]];
        var VK = [{ p: .13, q: QV, at: off, loc: FISTB, c: cFist, th: 1 }, { p: .19, q: QV, at: [REC[0] + .03, REC[1] + .1, REC[2]], loc: FISTB, c: cFist, th: 1 }, { p: .212, q: QV, at: [REC[0] + .02, REC[1] + .075, REC[2]], loc: FISTB, c: cFist, th: 1 },
          { p: .222, q: QV, at: [REC[0], REC[1] + .002, REC[2]], loc: FISTB, c: cFist, th: 1 }, { p: .25, q: QV, at: [REC[0] + .02, REC[1] + .06, REC[2]], loc: FISTB, c: cFist, th: 1 }, { p: .295, q: QP, at: [REC[0] + .13, REC[1] + .17, REC[2]], loc: PINV, c: [.2, .6, .8, .9], th: .25 },
          { p: .33, q: QP, at: grip, loc: PINV, c: cPinch, th: .62 }, { p: .385, q: QP, at: pull, loc: PINV, c: cPinch, th: .62 }, { p: .44, q: QP2, at: hsP, loc: PINV, c: cPinch, th: .62 }, { p: .456, q: QP2, at: [stEnd[0] + .03, stEnd[1], stEnd[2] - .03], loc: PINV, c: cPinch, th: .62 },
          { p: .5, q: QP2, at: [TRAY0[0] + SL / 2 + .05, TRAY0[1] + TH / 2 + .07, TRAY0[2]], loc: PINV, c: cPinch, th: .62 }, { p: .54, q: QV, at: off, loc: PINV, c: [.3, .5, .6, .7], th: .3 }];
        if (p > .33 && p < .385) { VK[7].p = p + .0001; VK[7].at = grip; VK.splice(6, 1); }   // 뽑는 동안은 스티커 끝을 그대로 따라감
        vh.visible = p > .13 && p < .54; if (vh.visible) vh.place(poseAt(VK, p));

        /* 손님 손 (맨손) */
        var phi = Math.PI / 2 * (1 - sstep(fold)), tip = [hg[0] - Lp * Math.cos(phi), hg[1] + Lp * Math.sin(phi), hg[2]];
        var tc = [tp[0], tp[1], tp[2]], under = [tc[0] - .06, tc[1], tc[2]], endL = [tc[0] - Math.cos(tp[3]) * (TL / 2 - .02), tc[1] - Math.sin(tp[3]) * (TL / 2 - .02) + TH * .6, tc[2]];
        var a2 = .42 + phi * .75, QF = basisQ([Math.cos(a2), Math.sin(a2), 0], [Math.sin(a2), -Math.cos(a2), 0]);
        var CK = [{ p: .45, q: QU, at: [TRAY0[0] - .7, TRAY0[1] - .12, TRAY0[2]], loc: PALM, c: cCup, th: .15 }, { p: .49, q: QU, at: under, loc: PALM, c: cCup, th: .15 }, { p: .7, q: QU, at: under, loc: PALM, c: cCup, th: .15 },
          { p: .735, q: QU, at: [tc[0] - .11, tc[1], tc[2]], loc: PALM, c: cCup, th: .15 }, { p: .756, q: QU, at: [tc[0] - .12, tc[1] - .004, tc[2]], loc: PALM, c: cCup, th: .15 }, { p: .775, q: QD, at: [tc[0] - .36, tc[1] + .05, tc[2]], loc: PINC, c: [.25, .4, .5, .6], th: .3 },
          { p: .795, q: QD, at: endL, loc: PINC, c: cPinch, th: .62 }, { p: .845, q: QD, at: endL, loc: PINC, c: cPinch, th: .62 }, { p: .862, q: QD, at: [slot[0] - .32, slot[1] + .2, slot[2]], loc: PINC, c: [.2, .3, .4, .5], th: .25 },
          { p: .885, q: QF, at: [tip[0] - .012, tip[1] - .012, tip[2]], loc: TIP, c: cFlat, th: .12 }, { p: .925, q: QF, at: [tip[0] - .012, tip[1] - .012, tip[2]], loc: TIP, c: cFlat, th: .12 }, { p: .975, q: QOUT, at: [hg[0] - 1.0, hg[1] - .25, hg[2]], loc: TIP, c: [.15, .15, .2, .25], th: .2 }];
        if (p > .49 && p < .7) { CK[1].p = p - .0001; CK[1].at = under; CK[2].p = p + .0001; CK[2].at = under; }
        if (p > .795 && p < .845) { CK[6].p = p - .0001; CK[7].p = p + .0001; }
        if (p > .885 && p < .925) { CK[9].p = p - .0001; CK[10].p = p + .0001; }
        ch.visible = p > .45 && p < .975; if (ch.visible) ch.place(poseAt(CK, p));

        /* 화면 위 글자 · 원형 확대 · 진행 막대 */
        if (Math.abs(p - lastP) > .0002 || forceP != null) {
          lastP = p;
          var tk = ramp(p, .025, .075); elTitle.style.opacity = (1 - tk).toFixed(3); elTitle.style.transform = "translate3d(0," + (-tk * 60).toFixed(1) + "px,0)"; elTitle.style.visibility = tk >= 1 ? "hidden" : "";
          if (elScroll) elScroll.style.opacity = (1 - ramp(p, .01, .04)).toFixed(2);
          var b1 = p > .07 && p < .22, b2 = p > .5 && p < .66, bk = b1 ? ramp(p, .07, .22) : b2 ? ramp(p, .5, .66) : 0;
          if (b1 || b2) { var nm = b1 ? "FOLD MARK" : "STREET FOLD"; if (elBig.textContent !== nm) elBig.textContent = nm; elBig.style.opacity = (ramp(bk, 0, .18) * (1 - ramp(bk, .62, 1))).toFixed(3); elBig.style.transform = "translate3d(" + (lerp(26, -95, sstep(bk))).toFixed(2) + "vw,0,0)"; } else elBig.style.opacity = 0;
          caps.forEach(function (li) { li.classList.toggle("is-on", p >= +li.getAttribute("data-a") && p < +li.getAttribute("data-b")); });
          var lk = sstep(ramp(p, .645, .675)) * (1 - sstep(ramp(p, .855, .885)));
          if (lk > .001) { var d = lerp(Math.hypot(W, Hh) * 1.15, Math.min(W * .92, Hh * .74), lk); elLens.style.width = elLens.style.height = d.toFixed(0) + "px"; elLens.style.opacity = Math.min(1, lk * 3).toFixed(2); } else elLens.style.opacity = 0;
          if (elBar) elBar.style.transform = "scaleX(" + p.toFixed(4) + ")";
          if (elStreak) elStreak.style.transform = "translate3d(" + (-p * 18).toFixed(2) + "%," + (p > .5 ? -(p - .5) * 20 : 0).toFixed(2) + "%,0)";
          sec.classList.toggle("is-run", p > .08 && p < .99);
        }
      };
      return S;
    }

    /* ---------------- 무대 2: FOLD MARK 4단계 ---------------- */
    function stageFmSteps(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, .01, 20), S = { host: host, sc: sc, cam: cam, step: 0, tt: 0 };
      sc.environment = ENV_DAY; sc.environmentIntensity = .7;
      keyLight(sc, 0xFFF1DC, 3.1, new T.Vector3(-.6, 1.4, .9), .35);
      var fill = new T.DirectionalLight(0xDDE6FF, .32); fill.position.set(1, .6, -1); sc.add(fill); realLight(sc, .35);
      ground(sc, .5, .4, .34, .8);
      var O = new Orbit({ yaw: .55, pitch: .42, dist: .62, t: [0, .03, 0], min: .18, max: 1.6 });
      var VIEWS = [
        { yaw: .3, pitch: .95, dist: .46, t: [.014, .03, 0] },     // 주먹 홈 (아이보리 윗면의 움푹한 곳)
        { yaw: 1.25, pitch: .25, dist: .45, t: [.06, .022, 0] },   // 앞 끝 빛 선
        { yaw: .62, pitch: .48, dist: .55, t: [.0, .06, 0] },      // 윗면 틈 → 50° 로 올라오는 스티커
        { yaw: .4, pitch: .55, dist: .62, t: [.0, .05, 0] }
      ];
      S.orbit = O;
      S.setStep = function (i) { S.step = i; S.tt = 0; O.to(VIEWS[i], 1.5); if (S.fm) { if (i !== 2) S.fm.resetStrip(); if (i === 3 && S.fm.strip) S.fm.strip.userData.e = S.fm.strip.userData.L; } };
      buildFM(function (m) { S.fm = m; sc.add(m.group); S.setStep(FM_STEP); });
      S.update = function (dt, t) {
        if (!S.fm) return; S.tt += dt; var m = S.fm;
        if (S.step === 0 && S.tt > 1.2) { S.tt = 0; m.sq = 1; m.rip = 0; }
        if (S.step === 1) m.idleGlow = .25 + 1.4 * (Math.sin(t * 9) > .2 ? 1 : 0) * (Math.sin(t * 1.4) > -.3 ? 1 : 0); else m.idleGlow = .3;
        if (S.step === 2 && !m.busy && S.tt > (m.strip && m.strip.userData.e > .01 ? 2.2 : .6)) { S.tt = 0; m.tap(); }
        if (S.step === 3 && m.strip && !m.busy) m.strip.userData.e = m.strip.userData.L;
        O.update(dt, false); O.apply(cam); m.update(dt, t);
      };
      return S;
    }

    /* ---------------- 무대 3: FOLD MARK 스튜디오 ---------------- */
    var tapB = $("#ppTap"), nudge = $("#ppNudge"), sigBs = $$("[data-sig]");
    function paintSig(k) { sigBs.forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-sig") === k); }); }
    function stageFmStudio(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(24, 1, .01, 20), S = { host: host, sc: sc, cam: cam, interactive: true };
      sc.environment = ENV_DAY; sc.environmentIntensity = .7;
      keyLight(sc, 0xFFF1DC, 3.2, new T.Vector3(-.7, 1.5, .9), .5);
      var fill = new T.DirectionalLight(0xDDE6FF, .3); fill.position.set(1, .7, -1); sc.add(fill); realLight(sc, .4);
      ground(sc, .55, .42, .34, .8);
      var O = new Orbit({ yaw: .55, pitch: .42, dist: .62, t: [.04, .045, 0], min: .16, max: 1.8, pmin: -.05, pmax: 1.35 });
      S.orbit = O;
      buildFM(function (m) { S.fm = m; sc.add(m.group); m.onSig = paintSig; });
      S.tap = function () {
        if (!S.fm) return; S.tapped = true; S.touched = true; if (tapB) { tapB.classList.add("is-hit"); setTimeout(function () { tapB.classList.remove("is-hit"); }, 180); }
        var ok = S.fm.tap(function () { showPaper(); if (tapB) tapB.disabled = false; });
        if (ok && tapB) tapB.disabled = true;
        if (ok) note.textContent = "AI가 빈 테이블을 고르는 중…";
        if (ok && !DRAG.on) S.orbit.to({ yaw: .62, dist: Math.max(S.orbit.g.dist, .95), t: [.08, .06, 0], pitch: Math.max(.45, S.orbit.g.pitch) }, 1.2);
      };
      S.hitPad = function (nx, ny) {
        if (!S.fm) return false; var rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(nx, ny), cam);
        var hit = rc.intersectObjects([S.fm.group], true)[0]; if (!hit) return null;
        if (S.fm.isStrip(hit.object)) return { strip: true, point: hit.point };
        return { pad: S.fm.isPad(hit.point), point: hit.point };
      };
      S.update = function (dt, t) {
        if (!S.fm) return; O.update(dt, DRAG.on && E.active === S); O.apply(cam); S.fm.update(dt, t);
        // 아직 아무도 만지지 않았으면 살짝 좌우로 흔들려 '돌려 볼 수 있다'고 알려 줌
        if (!S.touched && !reduced && !O.tw) O.g.yaw = O.home.yaw + Math.sin(t * .9) * .22;
        // 주먹 홈 위의 '여기를 툭' 안내 (처음 한 번 치면 사라짐)
        if (nudge) {
          var p = S.fm.recWorld(); p.y += .004; p.project(cam);
          nudge.style.transform = "translate(" + ((p.x * .5 + .5) * host.clientWidth - 9).toFixed(1) + "px," + ((-p.y * .5 + .5) * host.clientHeight - 9).toFixed(1) + "px)";
          nudge.classList.toggle("is-on", !S.tapped && p.z < 1);
        }
      };
      return S;
    }

    /* ---------------- 무대 4: STREET FOLD 부위 탐색 ---------------- */
    var PART = {
      lamp: { no: "01 · 노란 등", t: "멀리서도 보이는 빛", d: "꼭대기의 노란 등은 번호 대신 빛으로 자리를 알립니다. 약도 스티커 손님을 기다릴 때는 또렷하게, 비어 있을 때는 은은하게 켜져 골목 입구에서도 찾을 수 있습니다.", v: { yaw: .32, pitch: .12, dist: 1.6, t: [0, 1.92, 0] },
        act: [["예약됨", function (m) { m.tLampOn = 1; m.pulse = 1; m.setScreen("wait"); }], ["비어 있음", function (m) { m.tLampOn = .2; m.setScreen("idle"); }, 1]] },
      display: { no: "02 · 디스플레이", t: "이 자리의 지금 상태", d: "비었는지, 누구를 기다리는지(번호와 도착 시각만), 얼마나 더 쓸 수 있는지를 보여 줍니다. 얼굴이나 이름은 띄우지 않습니다.", v: { yaw: .26, pitch: .05, dist: 2.1, t: [0, 1.6, 0] },
        act: [["비어 있음", function (m) { m.setScreen("idle"); }], ["기다리는 중", function (m) { m.setScreen("wait"); }], ["사용 중", function (m) { m.setScreen("use"); }]] },
      reader: { no: "03 · 대는 곳", t: "트레이를 대는 곳", d: "흰 원형 조명이 숨쉬듯 켜졌다 꺼지며 '여기에 대세요'라고 알려 줍니다. 약도 스티커가 붙은 트레이 옆면을 대면 조명이 밝아지고, 번호와 시간이 맞으면 판이 내려옵니다.", v: { yaw: .3, pitch: .02, dist: .95, t: [0, 1.3, 0] },
        act: [["트레이 대 보기", function (m, S) { m.readerPulse = 1; m.setScreen("ok"); setTimeout(function () { m.tFold = 1; S.orbit.to({ yaw: .7, pitch: .3, dist: 1.5, t: [0, 1.06, .08] }, 1.6); }, 700); }]] },
      plate: { no: "04 · 판", t: "내려오는 판", d: "평소에는 세워져 기둥 안에 들어가 있다가, 확인이 끝나면 천천히 내려와 꼬치 트레이를 올리는 판이 됩니다. 아래 걸이는 무게로 늘 아래를 향해서, 판을 올리면 기둥의 걸이 홈에 쏙 들어가고 판을 내리면 다시 늘어져 가방을 걸 수 있습니다.", v: { yaw: .8, pitch: .36, dist: 2.0, t: [0, 1.0, .1] },
        on: function (m) { m.tFold = 1; }, act: [["판 올려 접기", function (m) { m.tFold = 0; }, 1], ["판 내리기", function (m) { m.tFold = 1; }]] },
      bin: { no: "05 · 쓰레기통 모듈", t: "기울어 나오는 쓰레기통", d: "아래 모듈은 쓰레기통입니다. 다 먹은 꼬치와 트레이는 위쪽 틈으로 버립니다. 맨 아래 호박색 조명선은 판이 내려올 때 흐르듯 켜지고, 통이 가득 차면 깜박여 수거할 때를 알립니다. 수거할 때는 모듈이 앞으로 기울어 나와 통째로 비웁니다.", v: { yaw: .78, pitch: .2, dist: 2.6, t: [0, .5, .08] },
        on: function (m) { m.tTilt = 1; }, off: function (m) { m.tTilt = 0; m.full = false; }, act: [["가득 참 신호", function (m) { m.full = !m.full; }, 1], ["닫기", function (m) { m.tTilt = 0; }, 1], ["기울이기", function (m) { m.tTilt = 1; }]] },
      tag: { no: "06 · 카드 태그", t: "수거하는 사람의 카드 태그", d: "옆면의 작은 사각형은 수거 담당자가 카드를 대는 곳입니다. 카드를 대면 쓰레기통 모듈이 기울어 나오고, 언제 비웠는지 기록됩니다. 손님이 보는 앞면이 아니라 옆에 있어 헷갈리지 않습니다.", v: { yaw: 1.4, pitch: .12, dist: 1.5, t: [.17, .58, -.04] },
        on: function (m) { m.tagPulse = 1.2; setTimeout(function () { m.tTilt = 1; }, 900); }, off: function (m) { m.tTilt = 0; }, act: [["카드 다시 대기", function (m) { m.tTilt = 0; m.tagPulse = 1.2; setTimeout(function () { m.tTilt = 1; }, 900); }]] }
    };
    var ORDER = ["lamp", "display", "reader", "plate", "bin", "tag"];
    var pinsBox = $("#ppPins"), info = $("#ppInfo"), infoNo = $("#ppInfoNo"), infoT = $("#ppInfoT"), infoD = $("#ppInfoD"), infoAct = $("#ppInfoAct"), ovB = $("#ppOverview");
    function stageSF(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, .05, 40), S = { host: host, sc: sc, cam: cam, interactive: true, cur: null, pins: {} };
      sc.environment = ENV_DAY; sc.environmentIntensity = .72;
      keyLight(sc, 0xFFF1DC, 3.3, new T.Vector3(-2.2, 4, 3), 1.6, new T.Vector3(0, 1, 0));
      var fill = new T.DirectionalLight(0xDDE6FF, .28); fill.position.set(2.5, 2, -2); sc.add(fill); realLight(sc, 1.6);
      ground(sc, 1.2, .9, .32, .8);
      var HOME = { yaw: .5, pitch: .1, dist: 5.4, t: [0, 1.05, 0] };
      var O = new Orbit({ yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist, t: HOME.t, min: .6, max: 8, pmin: -.1, pmax: 1.1 }); O.wide = .5;
      S.orbit = O;
      ORDER.forEach(function (k, i) {
        var b = doc.createElement("button"); b.type = "button"; b.className = "pp-pin is-off"; b.setAttribute("aria-label", PART[k].no); b.innerHTML = "<span>" + PART[k].no.split(" · ")[1] + "</span>";
        b.addEventListener("click", function () { S.focus(k); }); pinsBox.appendChild(b); S.pins[k] = b;
      });
      buildSF(function (m) { S.m = m; sc.add(m.group); });
      function setInfo(k) {
        info.classList.add("is-swap");
        setTimeout(function () {
          var p = k ? PART[k] : null;
          infoNo.textContent = p ? p.no : "STREET FOLD"; infoT.textContent = p ? p.t : "부위를 눌러 보세요.";
          infoD.textContent = p ? p.d : "점이나 왼쪽 목록을 누르면 그 부분으로 다가가 움직임과 설명을 보여 줍니다. 끌어서 돌려 볼 수도 있습니다.";
          infoAct.innerHTML = "";
          if (p && p.act) p.act.forEach(function (a) { var b = doc.createElement("button"); b.type = "button"; b.textContent = a[0]; if (a[2]) b.className = "ghost"; b.addEventListener("click", function () { if (S.m) a[1](S.m, S); }); infoAct.appendChild(b); });
          info.classList.remove("is-swap");
        }, 260);
      }
      S.focus = function (k) {
        if (!S.m) return;
        if (S.cur && PART[S.cur].off && S.cur !== k) PART[S.cur].off(S.m);
        S.cur = k; O.spin = false;
        if (k && S.m.tEx > .5) { S.m.tEx = 0; var eb = $("#ppExplode"); if (eb) { eb.setAttribute("aria-pressed", "false"); eb.textContent = "분해해서 보기"; } pinsBox.classList.remove("is-label"); }
        $$("#ppParts button").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-part") === k); });
        ORDER.forEach(function (n) { S.pins[n].classList.toggle("is-on", n === k); });
        ovB.classList.toggle("is-on", !!k);
        if (k) { O.to(PART[k].v, 1.6); if (PART[k].on) PART[k].on(S.m, S); }
        else { O.to(HOME, 1.6); S.m.tTilt = 0; }
        setInfo(k);
      };
      $$("#ppParts button").forEach(function (b) { b.addEventListener("click", function () { S.focus(b.getAttribute("data-part")); }); });
      ovB.addEventListener("click", function () { S.focus(null); });
      var exB = $("#ppExplode");
      if (exB) exB.addEventListener("click", function () {
        if (!S.m) return; var on = S.m.tEx < .5;
        S.focus(null); S.m.tEx = on ? 1 : 0; if (on) S.m.tFold = 1;
        exB.setAttribute("aria-pressed", on); exB.textContent = on ? "다시 합치기" : "분해해서 보기";
        pinsBox.classList.toggle("is-label", on);
        O.to(on ? { yaw: .85, pitch: .12, dist: 7.4, t: [.1, 1.12, .25] } : HOME, 1.8);
      });
      /* v5: 판 직접 접기 · 설계자 보기 · 가만히 두면 사람 손처럼 고르지 않은 리듬으로 판을 올렸다 내림 */
      var foldR = $("#ppFoldR"), engB = $("#ppEng"), engNote = $("#ppEngNote"), ENG = { on: false, lines: null, k: 0 }, idleT = 0, idleNext = 5;
      if (foldR) foldR.addEventListener("input", function () { if (!S.m) return; S.touched = true; S.m.tFold = foldR.value / 100; });
      function engBuild() {
        var m = S.m, g = new T.Group(), lm = new T.LineBasicMaterial({ color: 0x2F312B, transparent: true, opacity: .42 }), n = 0;
        m.root.traverse(function (o) { if (!o.isMesh || !o.geometry || o.userData.eng) return; n++; var e = new T.LineSegments(new T.EdgesGeometry(o.geometry, 28), lm); e.userData.eng = 1; o.add(e); e.visible = false; (ENG.edges = ENG.edges || []).push(e); });
        var ym = new T.LineBasicMaterial({ color: 0xD9A300, depthTest: false, transparent: true }), hp = m.plate.position, pts = [];
        g.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-.2, hp.y, hp.z), new T.Vector3(.2, hp.y, hp.z)]), ym));           // 경첩 축
        for (var i = 0; i <= 24; i++) { var a = i / 24 * Math.PI / 2; pts.push(new T.Vector3(.19, hp.y + Math.sin(a) * .23, hp.z + Math.cos(a) * .23)); }
        g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), ym));                                                                           // 판 끝이 그리는 길
        var dm = new T.LineDashedMaterial({ color: 0xD9A300, dashSize: .012, gapSize: .01, depthTest: false, transparent: true }), hk = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(.19, hp.y, hp.z + .12), new T.Vector3(.19, hp.y - .16, hp.z + .12)]), dm); hk.computeLineDistances(); g.add(hk);   // 걸이: 무게로 늘 아래
        g.renderOrder = 5; g.visible = false; m.root.add(g); ENG.lines = g; ENG.n = n;
      }
      if (engB) engB.addEventListener("click", function () {
        if (!S.m) return; ENG.on = !ENG.on; S.touched = true; if (!ENG.lines) engBuild();
        engB.setAttribute("aria-pressed", ENG.on); ENG.lines.visible = ENG.on; ENG.edges.forEach(function (e) { e.visible = ENG.on; });
        S.m.root.traverse(function (o) { if (!o.isMesh || !o.material || o.userData.eng) return; var mt = o.material; if (mt.userData.op0 == null) mt.userData.op0 = [mt.opacity, mt.transparent, mt.depthWrite]; if (ENG.on) { mt.transparent = true; mt.opacity = .16; mt.depthWrite = false; } else { mt.opacity = mt.userData.op0[0]; mt.transparent = mt.userData.op0[1]; mt.depthWrite = mt.userData.op0[2]; } mt.needsUpdate = true; });
        if (engNote) { engNote.innerHTML = "<b>설계자 보기</b><br>노란 실선: 경첩 축과 판 끝이 그리는 길 (90°)<br>노란 점선: 걸이 — 판이 어떻게 돌든 무게로 늘 아래<br>부품 " + ENG.n + "개 · 판은 내려올 때만 자동, 올릴 때는 손으로"; engNote.classList.toggle("is-on", ENG.on); }
        if (ENG.on) { S.focus(null); O.to({ yaw: 1.2, pitch: .08, dist: 5.6, t: [0, 1.05, .08] }, 1.6); } else O.to(HOME, 1.4);
      });
      var v3 = new T.Vector3(), n3 = new T.Vector3(), c3 = new T.Vector3();
      S.update = function (dt, t) {
        if (!S.m) return; O.update(dt, DRAG.on && E.active === S); O.apply(cam);
        if (!S.touched && !S.cur && !reduced && S.m.tEx < .5) { idleT += dt; if (idleT > idleNext) { idleT = 0; S.m.tFold = S.m.tFold > .5 ? 0 : 1; idleNext = 2.6 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3.2; } }
        if (foldR && doc.activeElement !== foldR) foldR.value = Math.round(S.m.fold * 100);
        S.m.update(dt, t);
        // 판 · 쓰레기통 점 위치는 움직이는 부분을 따라감
        var pl = new T.Vector3(0, .012, .15); S.m.plate.localToWorld(pl); S.m.P.plate = [pl.x, pl.y, pl.z, 0, .3, 1];
        var bn = new T.Vector3(.1, .36, .01); S.m.bin.localToWorld(bn); S.m.P.bin = [bn.x, bn.y, bn.z, 0, 0, 1];
        var w = host.clientWidth, h = host.clientHeight;
        ORDER.forEach(function (k) {
          var q = S.m.P[k], b = S.pins[k]; if (!q) return;
          v3.set(q[0], q[1], q[2]); n3.set(q[3], q[4], q[5]).normalize(); c3.copy(cam.position).sub(v3);
          var front = n3.dot(c3) > 0; v3.project(cam);
          var x = (v3.x * .5 + .5) * w, y = (-v3.y * .5 + .5) * h, off = !front || v3.z > 1 || x < 0 || x > w || y < 0 || y > h;
          b.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
          b.classList.toggle("is-off", off); b.classList.toggle("is-dim", !!S.cur && S.cur !== k);
        });
      };
      S.onLeave = function () { ORDER.forEach(function (k) { S.pins[k].classList.add("is-off"); }); };
      return S;
    }

    /* =========================================================
       v9 무대: 제품 이야기 (스크롤로 보는 소개)
       ① 부품이 날아와 하나의 제품으로 맞물림 → ② 스크롤할 때마다 한 부위씩 다가가 기능을 보여 줌
       → ③ 다 본 뒤에 아래 '직접 해 보기'가 열림
       ========================================================= */
    var STORY = {
      fm: {
        home: { yaw: .55, pitch: .42, dist: .62, t: [0, .03, 0] }, far: { yaw: -.6, pitch: .7, dist: 1.25, t: [0, .04, 0] },
        stops: [
          { k: "pad", no: "01", name: "주먹 패드", t: "툭, 치면 시작합니다", d: "버튼 대신 주먹이 닿는 회색 패드. 보기만 해도 어디를 칠지 알 수 있습니다.", v: { yaw: .45, pitch: .85, dist: .42, t: [.033, .03, 0] } },
          { k: "slot", no: "02", name: "윗면 틈", t: "약도가 올라옵니다", d: "AI가 고른 빈 테이블까지의 약도 스티커가 패드 바로 뒤 틈에서 나옵니다.", v: { yaw: .9, pitch: .32, dist: .62, t: [-.024, .1, 0] } },
          { k: "band", no: "03", name: "앞 빛 띠", t: "빛으로 말합니다", d: "대기 · 고르는 중 · 출력 완료 · 빈자리 없음을 호박색 빛의 리듬으로 알립니다.", v: { yaw: 1.45, pitch: .2, dist: .4, t: [.08, .016, 0] } },
          { k: "back", no: "04", name: "뒤 뚜껑", t: "뒤로 열어 갈아 끼웁니다", d: "몸체 뒤쪽 비스듬한 이음선까지가 스티커 카트리지 뚜껑입니다. 장사 중에도 앞을 건드리지 않습니다.", v: { yaw: -2.2, pitch: .45, dist: .5, t: [-.055, .03, 0] } }
        ]
      },
      sf: {
        home: { yaw: .5, pitch: .1, dist: 5.4, t: [0, 1.05, 0] }, far: { yaw: -.5, pitch: .32, dist: 8.6, t: [0, 1.1, 0] },
        stops: [
          { k: "lamp", no: "01", name: "노란 등", t: "멀리서도 보이는 빛", d: "번호 대신 빛으로 자리를 알립니다. 골목 입구에서도 찾을 수 있습니다." },
          { k: "display", no: "02", name: "디스플레이", t: "이 자리의 지금 상태", d: "비었는지, 누구를 기다리는지(번호와 도착 시각만) 보여 줍니다. 얼굴·이름은 띄우지 않습니다." },
          { k: "reader", no: "03", name: "대는 곳", t: "트레이를 대면", d: "흰 원형 조명이 '여기에 대세요'라고 숨쉬듯 알려 줍니다. 스티커가 맞으면 판이 내려옵니다." },
          { k: "plate", no: "04", name: "판", t: "내려오는 판", d: "평소엔 기둥에 붙어 있다가 확인이 끝나면 천천히 내려와 한 사람의 식사 자리가 됩니다." },
          { k: "bin", no: "05", name: "쓰레기통 모듈", t: "그 자리에서 버리기", d: "다 먹은 꼬치와 트레이는 아래 모듈로. 가득 차면 호박색 선이 깜박입니다." },
          { k: "tag", no: "06", name: "카드 태그", t: "수거는 카드 한 번", d: "옆면에 수거 담당자가 카드를 대면 통이 기울어 나오고, 비운 시각이 기록됩니다." }
        ]
      }
    };
    function viewLerp(a, b, k) {
      var dy = ((b.yaw - a.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      return { yaw: a.yaw + dy * k, pitch: lerp(a.pitch, b.pitch, k), dist: lerp(a.dist, b.dist, k), t: [lerp(a.t[0], b.t[0], k), lerp(a.t[1], b.t[1], k), lerp(a.t[2], b.t[2], k)] };
    }
    // 아무 모델이나 재질별로 묶어 '부품'으로 만듦 (새 FOLD MARK 모델이 와도 그대로 작동)
    function autoParts(root, keepOut) {
      root.updateMatrixWorld(true);
      var by = {}, cen = new T.Box3().setFromObject(root).getCenter(new T.Vector3()), list = [];
      root.traverse(function (o) { if (o.isMesh && o.visible && (!keepOut || keepOut.indexOf(o) < 0)) (by[o.userData.mn || "_"] = by[o.userData.mn || "_"] || []).push(o); });
      var keys = Object.keys(by), biggest = null, bv = 0;
      keys.forEach(function (k) { var b = new T.Box3(); by[k].forEach(function (o) { b.expandByObject(o); }); var sz = b.getSize(new T.Vector3()), v = sz.x * sz.y * sz.z; if (v > bv) { bv = v; biggest = k; } by[k].box = b; });
      keys.forEach(function (k, i) {
        if (k === biggest) return;   // 가장 큰 몸체는 제자리 (나머지가 여기로 모여듦)
        var g = new T.Group(); root.add(g); by[k].slice().forEach(function (o) { reparent(o, g); });
        var c = by[k].box.getCenter(new T.Vector3()), d = c.sub(cen); d.y = Math.max(d.y, 0) + .02; if (d.lengthSq() < 1e-6) d.set(0, 1, 0);
        list.push({ g: g, dir: d.normalize(), i: i });
      });
      return list;
    }
    function storyStage(host, kind) {
      var D = STORY[kind], big = kind === "sf";
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(big ? 26 : 24, 1, .01, 40), S = { host: host, sc: sc, cam: cam, p: 0, cur: -2, kind: kind };
      sc.environment = ENV_DAY; sc.environmentIntensity = .5;
      keyLight(sc, 0xFFE9CF, 3.2, big ? new T.Vector3(-2.2, 4, 3) : new T.Vector3(-.6, 1.4, .9), big ? 1.6 : .35, big ? new T.Vector3(0, 1, 0) : null);
      var rim = new T.DirectionalLight(0xFFB547, big ? 2.4 : 2.0); rim.position.set(big ? 2.6 : .9, big ? 2.4 : .55, big ? -2.6 : -.9); sc.add(rim);   // 뒤에서 호박색 윤곽
      realLight(sc, big ? 1.6 : .35);
      ground(sc, big ? 1.3 : .5, big ? 1 : .4, .5, .9);
      var O = new Orbit({ yaw: D.home.yaw, pitch: D.home.pitch, dist: D.home.dist, t: D.home.t, min: .1, max: 14 }); if (big) O.wide = .5; S.orbit = O;
      var sec = host.closest("[data-story]"), card = $(".pp-story-card", sec), ticks = $$(".pp-story-ticks li", sec), cta = $(".pp-story-cta", sec);
      var cNo = card && $(".no", card), cName = card && $(".nm", card), cT = card && $("h3", card), cD = card && $(".d", card);
      var parts = [];
      if (big) {
        // 부위별 시점: 기존 부위 탐색의 시점을 그대로 씀
        D.stops.forEach(function (s) { s.v = PART[s.k].v; });
        buildSF(function (m) {
          S.m = m; sc.add(m.group); m.asm = {}; m.tLampOn = .2;
          var DIR = { lamp: [0, 1.4, .3], display: [-.9, .4, 1.2], reader: [.9, .1, 1.3], tag: [1.4, -.2, 0], plate: [0, .3, 1.6], bin: [-.6, -.5, 1.3] };
          Object.keys(DIR).forEach(function (k, i) { parts.push({ k: k, dir: new T.Vector3().fromArray(DIR[k]).normalize(), i: i }); });
        });
      } else {
        buildFM(function (m) {
          S.m = m; sc.add(m.group); m.idleGlow = .3;
          autoParts(m.root, m.strip ? [m.strip] : null).forEach(function (q) { parts.push(q); });
        }, {});
      }
      function setCard(i) {
        if (!card) return;
        var s = i >= 0 ? D.stops[i] : null;
        card.classList.add("is-swap");
        clearTimeout(S._ct); S._ct = setTimeout(function () {
          card.classList.toggle("is-intro", !s);
          if (s) { cNo.textContent = s.no + " / 0" + D.stops.length; cName.textContent = s.name; cT.textContent = s.t; cD.textContent = s.d; }
          card.classList.remove("is-swap");
        }, 220);
        ticks.forEach(function (li, j) { li.classList.toggle("is-on", j === i); li.classList.toggle("is-past", j < i); });
      }
      ticks.forEach(function (li, j) { li.addEventListener("click", function () { var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, A = 1 / (D.stops.length + 1); scrollTo({ top: scrollY + r.top + (A + (j + .45) * (1 - A) / D.stops.length) * span, behavior: reduced ? "auto" : "smooth" }); }); });
      S.update = function (dt, t) {
        var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - innerHeight), p = clamp(-r.top / span, 0, 1);
        S.p = p; var n = D.stops.length, A = 1 / (n + 1);
        if (p > .96) { sec.classList.add("is-done"); try { sessionStorage.setItem("pp-story-" + kind, "1"); } catch (e) {} unlock(kind); }
        if (cta) cta.classList.toggle("is-on", p > .9);
        if (!S.m) return;
        var m = S.m;
        // ① 조립: 0 ~ A
        var asm = clamp(p / (A * .92), 0, 1);
        parts.forEach(function (q, j) {
          var k0 = clamp((asm - j * .06) / .62, 0, 1), e = 1 - eout(k0), dd = (big ? 1.6 : .16) * e;
          if (big) m.asm[q.k] = [q.dir.x * dd, q.dir.y * dd, q.dir.z * dd, e * 1.4 * (j % 2 ? 1 : -1)];
          else { q.g.position.copy(q.dir).multiplyScalar(dd); q.g.rotation.y = e * 1.2 * (j % 2 ? 1 : -1); }
        });
        // ② 부위: A ~ 1
        var i = p < A ? -1 : Math.min(n - 1, Math.floor((p - A) / ((1 - A) / n))), lp = p < A ? 0 : ((p - A) / ((1 - A) / n)) - i;
        if (i !== S.cur) { var old = S.cur; S.cur = i; setCard(i); if (big && old >= 0 && PART[D.stops[old].k].off) PART[D.stops[old].k].off(m); }
        var view;
        if (i < 0) view = viewLerp(D.far, D.home, eio(asm));
        else { var from = i === 0 ? D.home : D.stops[i - 1].v; view = viewLerp(from, D.stops[i].v, eio(clamp(lp / .38, 0, 1))); }
        var zoomOut = i >= 0 ? (big ? 2.1 : 1.45) : 1;   // 부위 시점은 조금 물러서서 (설명 카드와 겹치지 않게)
        O.c.yaw = view.yaw; O.c.pitch = view.pitch; O.c.dist = view.dist * lerp(1, zoomOut, i < 0 ? 0 : i === 0 ? eio(clamp(lp / .38, 0, 1)) : 1); O.c.x = view.t[0]; O.c.y = view.t[1]; O.c.z = view.t[2];
        O.g = Object.assign({}, O.c); if (!reduced) O.c.yaw += Math.sin(t * .35) * .03;
        O.apply(cam);
        // 카드가 오른쪽에 있을 땐 제품을 화면 왼쪽으로 조금 옮김 (넓은 화면만)
        S.shift = damp(S.shift || 0, i >= 0 && innerWidth > 860 ? 1 : 0, 4, dt);
        var cw = host.clientWidth, chh = host.clientHeight;
        if (S.shift > .002) cam.setViewOffset(cw, chh, cw * .13 * S.shift, 0, cw, chh); else if (cam.view) cam.clearViewOffset();
        sec.classList.toggle("is-stop", i >= 0);
        // 부위마다 움직임 (스크롤에 맞춰)
        var k = i >= 0 ? D.stops[i].k : null, act = clamp((lp - .3) / .5, 0, 1);
        if (big) {
          m.tFold = k === "plate" ? (act > .05 ? 1 : 0) : (k === "bin" || k === "tag") ? 1 : k === "reader" && act > .7 ? 1 : 0;
          m.tTilt = (k === "bin" && act > .3) || (k === "tag" && act > .5) ? 1 : 0;
          m.tLampOn = k === "lamp" ? 1 : .25;
          if (k === "reader" && act > .3 && !S._rp) { S._rp = 1; m.readerPulse = 1; m.setScreen("ok"); } if (k !== "reader") S._rp = 0;
          if (k === "display") { var mode = act < .33 ? "idle" : act < .66 ? "wait" : "use"; if (m.mode !== mode) m.setScreen(mode); } else if (k !== "reader" && m.mode !== "idle") m.setScreen("idle");
          if (k === "tag" && act > .2 && !S._tp) { S._tp = 1; m.tagPulse = 1.2; } if (k !== "tag") S._tp = 0;
          m.update(dt, t);
        } else {
          if (k === "pad") { if ((S._tt = (S._tt || 0) + dt) > 1.3) { S._tt = 0; m.sq = 1; m.rip = 0; } }
          if (m.strip) { m.strip.userData.e = k === "slot" ? m.strip.userData.L * eio(act) : (k === "band" || k === "back") ? m.strip.userData.L : 0; m.strip.userData.fade = 1; m.strip.userData.lift = 0; }
          m.idleGlow = k === "band" ? [.3, .2 + 1.5 * (Math.sin(t * 22) > 0 ? 1 : 0), 1.7, (Math.sin(t * 7) > 0 ? 1.6 : .05)][Math.min(3, Math.floor(act * 4))] : .3;
          m.update(dt, t);
        }
      };
      return S;
    }
    function unlock(kind) {
      var el = $(kind === "fm" ? "#ppStudio" : "#ppExplore"); if (el && el.classList.contains("is-locked")) el.classList.remove("is-locked");
    }
    ["fm", "sf"].forEach(function (k) { var v = null; try { v = sessionStorage.getItem("pp-story-" + k); } catch (e) {} if (v) unlock(k); });
    $$("[data-unlock]").forEach(function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-unlock"); var s = $('[data-story="' + k + '"]'); if (s) scrollTo({ top: scrollY + s.getBoundingClientRect().top, behavior: reduced ? "auto" : "smooth" }); }); });
    $$("[data-skip]").forEach(function (b) { b.addEventListener("click", function () { unlock(b.getAttribute("data-skip")); }); });

    /* v9.2 최적화: v9.1에서 뺀 점(LED) 첫 화면 코드 정리 */

    /* ---- 무대 고르기 ---- */
    var MAKERS = { film: stageFilm, fmSteps: stageFmSteps, fmStudio: stageFmStudio, sf: stageSF, fmStory: function (h) { return storyStage(h, "fm"); }, sfStory: function (h) { return storyStage(h, "sf"); } }, HOSTS = $$("[data-stage]");
    function stage(host) { var n = host.getAttribute("data-stage"); if (!STAGES[n]) STAGES[n] = MAKERS[n](host); return STAGES[n]; }
    // 처음 몇 개는 미리 만들어 둠 (스크롤 중 끊김 줄이기)
    HOSTS.forEach(function (h) { stage(h); });
    function attach(S) {
      if (E.active === S) return;
      if (E.active && E.active.onLeave) E.active.onLeave();
      E.active = S; S.host.insertBefore(r.domElement, S.host.firstChild); S.w = 0;
    }
    E.pick = function () {
      var best = null, bv = 0;
      HOSTS.forEach(function (h) { var a = vis(h); if (a > bv) { bv = a; best = h; } });
      if (best && bv > 2000) attach(stage(best));
    };
    E.redrawScreens = function () { Object.keys(STAGES).forEach(function (k) { var S = STAGES[k]; if (S.sf && S.sf.redraw) S.sf.redraw(); if (S.m && S.m.redraw) S.m.redraw(); }); };

    /* ---- 손 조작 (끌기 · 두 손가락 · Ctrl+스크롤 · 두 번 누르기 · 누르기) ---- */
    var DRAG = { on: false, moved: 0, x: 0, y: 0, pts: {}, pinch: 0 };
    var MOUSE = { x: 0, y: 0 };
    addEventListener("pointermove", function (e) { MOUSE.x = e.clientX / innerWidth * 2 - 1; MOUSE.y = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });
    var el = r.domElement;
    function nxy(e) { var b = el.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1]; }
    el.addEventListener("pointerdown", function (e) {
      var S = E.active; if (!S || !S.orbit) return;
      DRAG.pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(DRAG.pts);
      if (ids.length === 2) { var a = DRAG.pts[ids[0]], b = DRAG.pts[ids[1]]; DRAG.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); DRAG.on = false; return; }
      DRAG.on = true; DRAG.moved = 0; DRAG.x = e.clientX; DRAG.y = e.clientY; S.orbit.vy = 0; el.setPointerCapture(e.pointerId);
      S.touched = true;
    });
    el.addEventListener("pointermove", function (e) {
      var S = E.active; if (!S || !S.orbit) return;
      if (DRAG.pts[e.pointerId]) DRAG.pts[e.pointerId] = [e.clientX, e.clientY];
      var ids = Object.keys(DRAG.pts);
      if (ids.length === 2) return;
      if (DRAG.on) {
        var dx = e.clientX - DRAG.x, dy = e.clientY - DRAG.y; DRAG.moved += Math.abs(dx) + Math.abs(dy); DRAG.x = e.clientX; DRAG.y = e.clientY;
        if (e.pointerType === "touch" && DRAG.moved < 12 && Math.abs(dy) > Math.abs(dx)) return;
        S.orbit.drag(dx, dy);
      } else if (S === STAGES.fmStudio && e.pointerType === "mouse") {
        var q = nxy(e), h = S.hitPad(q[0], q[1]); cursorText(h && h.pad ? "툭 — 눌러서 스티커 뽑기" : h && h.strip ? "눌러서 스티커 떼기" : ""); el.style.cursor = h && (h.pad || h.strip) ? "pointer" : ""; S.fm.tHover = h && h.pad ? 1 : 0;
      }
    });
    function up(e) {
      var S = E.active; delete DRAG.pts[e.pointerId]; if (Object.keys(DRAG.pts).length < 2) DRAG.pinch = 0;
      if (!DRAG.on) return; DRAG.on = false;
      if (S && DRAG.moved < 6 && S === STAGES.fmStudio) { var q = nxy(e), h = S.hitPad(q[0], q[1]); if (h && h.pad) S.tap(); else if (h && h.strip && S.fm.tear(function () { note.textContent = "스티커를 떼었어요. 트레이 옆면에 붙여 건네면 됩니다."; })) { showPaper(); note.textContent = "스티커를 떼는 중…"; } }
    }
    el.addEventListener("pointerleave", function () { cursorText(""); el.style.cursor = ""; if (STAGES.fmStudio && STAGES.fmStudio.fm) STAGES.fmStudio.fm.tHover = 0; });
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    // 확대 · 축소는 빼고 (복잡함을 줄임) 끌어서 돌리기만 둠

    // 스튜디오 버튼
    var FS = function () { return STAGES.fmStudio; };
    if (tapB) tapB.addEventListener("click", function () { FS().tap(); });
    addEventListener("keydown", function (e) {
      if (e.code !== "Space" || /INPUT|TEXTAREA|BUTTON|SELECT/.test((doc.activeElement || {}).tagName || "")) return;
      var st = $("#ppStudio .pp-studio-view"); if (st && vis(st) > innerWidth * innerHeight * .2) { e.preventDefault(); FS().tap(); }
    });
    if (nudge) nudge.addEventListener("click", function () { FS().tap(); });
    // 빛 신호 미리 보기 (누르면 앞 빛 띠가 그 신호로 켜짐)
    sigBs.forEach(function (b) { b.addEventListener("click", function () {
      var S = FS(); if (!S.fm || S.fm.busy) return; var k = b.getAttribute("data-sig");
      S.fm.setSig(k); S.touched = true;
      S.orbit.to({ yaw: 1.15, pitch: .3, dist: .5, t: [.05, .03, 0] }, 1.1);    // 앞 빛 띠가 잘 보이는 쪽으로
      note.textContent = { idle: "대기 — 은은한 호박색으로 켜져 있습니다.", pick: "고르는 중 — AI가 빈 테이블과 가는 길을 고르는 동안 빠르게 깜박입니다.", done: "출력 완료 — 밝게 켜지면 스티커를 뽑아도 됩니다.", full: "빈자리 없음 — 두 번 깜박이고 꺼집니다. 스티커는 나오지 않으니 잠시 뒤 다시 칩니다." }[k];
    }); });

    /* ---- 그리기 ---- */
    var last = 0, FT = 16, prevNow = 0, fc = 0, PR0 = Math.min(devicePixelRatio || 1, 2), PR = PR0;
    (function loop(now) {
      requestAnimationFrame(loop);
      var S = E.active; if (!S || doc.hidden) { last = now; return; }
      if (!inView(S.host, 50)) { last = now; return; }
      var w = S.host.clientWidth, h = S.host.clientHeight;
      if (w !== S.w || h !== S.h) { S.w = w; S.h = h; r.setSize(w, h, false); S.cam.aspect = w / Math.max(1, h); S.cam.updateProjectionMatrix(); }
      var dt = last ? Math.min(window.PP_DTMAX || .05, (now - last) / 1000) : .016; last = now;
      S.update(dt, now / 1000);
      if (S.render) S.render(r); else r.render(S.sc, S.cam);
      // 버거운 기기에서는 해상도를 조금씩 낮춰 부드러움을 지킴 (다시 여유가 생기면 올림)
      var ms = performance.now() - now; FT = FT * .92 + (now - (prevNow || now)) * .08; prevNow = now;
      if (++fc > 50 && !window.PP_DTMAX) { if (FT > 26 && PR > .7) { PR = Math.max(.7, PR * .86); r.setPixelRatio(PR); S.w = 0; fc = 0; } else if (FT < 17.5 && PR < PR0) { PR = Math.min(PR0, PR * 1.08); r.setPixelRatio(PR); S.w = 0; fc = -120; } else fc = 0; }
    })(0);
    E.ok = true; window.PP3D = { E: E, STAGES: STAGES, T: T };
  }
  initE();
  onScroll();
})();
