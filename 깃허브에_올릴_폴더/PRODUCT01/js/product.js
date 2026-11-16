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
    r.toneMapping = T.NeutralToneMapping || T.ACESFilmicToneMapping; r.toneMappingExposure = 1;
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
        if (n === "페인트 (1)") { m.clearcoat = 1; m.clearcoatRoughness = .08; }
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
        root.position.set(-.084, 0, 0);
        var pad = [], band = [];
        root.traverse(function (o) {
          if (!o.isMesh) return;
          if (o.userData.mn === "플라스틱 (1)") pad.push(o);
          if (o.userData.mn === "발광") band.push(o);
          if (!o.userData.mn) { var b = new T.Box3().setFromObject(o); if (b.max.y > .052) o.visible = false; } // 모델 안 임시 스티커 면은 숨김
        });
        var bandMat = band[0] ? band[0].material : null; band.forEach(function (o) { o.material = bandMat; });
        if (bandMat) { bandMat.emissive = new T.Color(0xFFB547); bandMat.emissiveIntensity = .25; bandMat.color.set(0x3a3a2a); }   // 조명 띠: 호박색
        // 주먹 홈 = 아이보리 윗면의 움푹 파인 곳 (도면: 약 82 × 66 mm, 깊이 6) — 위에서 쏴서 홈 바닥 높이를 찾음
        root.updateMatrixWorld(true);
        var REC = new T.Vector3(.098, .04, 0), rcY = new T.Raycaster(new T.Vector3(.098 - .084, .3, 0), new T.Vector3(0, -1, 0));
        var hy = rcY.intersectObject(root, true).filter(function (h) { return h.object.visible; })[0]; if (hy) REC.y = hy.point.y;
        var gcv = screenCanvas(128, 128), gg = gcv.getContext("2d"), gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, "rgba(242,217,75,.85)"); gr.addColorStop(.6, "rgba(242,217,75,.35)"); gr.addColorStop(1, "rgba(242,217,75,0)"); gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
        var glow = new T.Mesh(new T.PlaneGeometry(.085, .07), new T.MeshBasicMaterial({ map: new T.CanvasTexture(gcv), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        glow.rotation.x = -Math.PI / 2; glow.position.set(REC.x - .084, REC.y + .0025, 0); squash.add(glow);
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
          var x = .0605, y = .0478, ph = 50 * Math.PI / 180, ds = e / N, half = u.W / 2;
          for (var i = 0; i <= N; i++) {
            var s = i * ds;
            if (i) { var a = ph - Math.min(Math.max(0, s - .05) * 7, 1.9) * (1 - .25 * u.lift); x += Math.cos(a) * ds; y += Math.sin(a) * ds; }   // 처음 5 cm 는 50° 로 곧게(친 각도 = 뽑는 각도), 그다음은 길게 나오며 무게로 휨
            var j = i * 6; P[j] = x; P[j + 1] = y + u.lift * .06; P[j + 2] = -half; P[j + 3] = x; P[j + 4] = y + u.lift * .06; P[j + 5] = half;
            var uu = u.U * clamp(1 - (e - s) / u.L, 0, 1), q = i * 4; UV[q] = uu; UV[q + 1] = 1; UV[q + 2] = uu; UV[q + 3] = 0;
          }
          strip.geometry.attributes.position.needsUpdate = true; strip.geometry.attributes.uv.needsUpdate = true; strip.geometry.computeVertexNormals(); strip.geometry.boundingSphere = null; strip.geometry.boundingBox = null;
          strip.visible = u.e > .001 && u.fade > .01; strip.material.opacity = u.fade; strip.material.transparent = u.fade < .999;
        }
        // 누름 파문
        var ring = new T.Mesh(new T.RingGeometry(.02, .024, 48), new T.MeshBasicMaterial({ color: 0xF2D94B, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(REC.x - .084, REC.y + .003, 0); squash.add(ring);
        var M = { group: wrap, root: root, pad: pad, strip: strip, ring: ring, glowM: glow, hover: 0, tHover: 0, bandMat: bandMat, sq: 0, rip: 1, blink: 0, glow: .25, tGlow: .25, job: null, busy: false, rec: REC };
        M.isPad = function (pw) { var q = root.worldToLocal(pw.clone()); return q.x > .055 && q.x < .145 && Math.abs(q.z) < .045 && q.y > .02; };
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

    /* ---------------- 무대 1: 첫 화면 (저녁 명동) ---------------- */
    function stageHero(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, .05, 60), S = { host: host, sc: sc, cam: cam, env: ENV_NIGHT, ready: false, mx: 0, my: 0 };
      sc.environment = ENV_NIGHT;
      sc.environmentIntensity = .75;
      keyLight(sc, 0xFFF0DC, 1.7, new T.Vector3(-2.6, 4.2, 3.6), 2.2, new T.Vector3(-.3, .6, .2));
      var rim = new T.DirectionalLight(0xB8CCF0, .9); rim.position.set(3.2, 2.6, -3); sc.add(rim);
      var warm = new T.DirectionalLight(0xFF9E5A, .7); warm.position.set(-4, 1.2, -2); sc.add(warm);
      var cap = new T.PointLight(0xF2C94B, 1.4, 2.6, 2); sc.add(cap);
      var spot = new T.SpotLight(0xFFF2D8, 6, 3.2, .32, .7, 1.6); spot.position.set(.5, 2.4, 1.6); spot.target.position.set(.66, .9, .74); sc.add(spot); sc.add(spot.target);
      ground(sc, 2.2, 1.6, .42, .55);
      // 노점 카운터 끝 (FOLD MARK 받침) — 제품 왼쪽 뒤에 낮게
      var ctr = new T.Group(), cm = new T.MeshPhysicalMaterial({ color: 0x24251f, roughness: .55, clearcoat: .3, clearcoatRoughness: .4 });
      var top = new T.Mesh(new T.BoxGeometry(.9, .04, .5), new T.MeshPhysicalMaterial({ color: 0xbdb59f, roughness: .5 })); top.position.y = .88; top.castShadow = top.receiveShadow = true; ctr.add(top);
      var body = new T.Mesh(new T.BoxGeometry(.86, .86, .46), cm); body.position.y = .43; body.castShadow = body.receiveShadow = true; ctr.add(body);
      var strip = new T.Mesh(new T.BoxGeometry(.86, .01, .004), new T.MeshBasicMaterial({ color: 0xF2D94B, toneMapped: false })); strip.position.set(0, .82, .232); ctr.add(strip);
      ctr.position.set(.78, 0, .62); ctr.rotation.y = -.42; sc.add(ctr);
      buildSF(function (m) { S.sf = m; m.group.position.set(-.1, 0, -.1); m.group.rotation.y = -.32; sc.add(m.group); m.tLampOn = 1; }, { screen: "wait", lamp: true });
      buildFM(function (m) { S.fm = m; m.group.position.set(.62, .9, .78); m.group.rotation.y = -.15; sc.add(m.group); m.idleGlow = .7; }, { noStrip: true });
      // 마우스를 따라다니는 손전등 빛 + 번호등 · 빛 띠의 은은한 번짐(블룸 대신 빛 판)
      var torch = new T.PointLight(0xFFE2B0, 2.2, 3.2, 1.8); sc.add(torch);
      function glowSprite(col, sz) {
        var c = screenCanvas(128, 128), g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, col.replace("A", "1")); gr.addColorStop(.35, col.replace("A", ".35")); gr.addColorStop(1, col.replace("A", "0")); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        var sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
        sp.scale.setScalar(sz); sc.add(sp); return sp;
      }
      var gCap = glowSprite("rgba(255,214,90,A)", .9), gBand = glowSprite("rgba(255,205,80,A)", .22), gScr = glowSprite("rgba(255,236,170,A)", .7);
      var t0 = 0;
      S.update = function (dt, t) {
        if (!S.sf || !S.fm) return;
        var p = clamp(scrollY / innerHeight, 0, 1);
        S.mx = damp(S.mx, MOUSE.x, 2.5, dt); S.my = damp(S.my, MOUSE.y, 2.5, dt);
        var drift = reduced ? 0 : Math.sin(t * .18) * .06;
        cam.position.set(-.55 + S.mx * .25 + drift, 1.25 + S.my * .1 - p * .2, 5.6 - p * .9);
        cam.lookAt(.3, 1.04 - p * .08, .2);
        var W = S.w || 1, H = S.h || 1, off = W > 900 ? -W * .2 : 0; cam.setViewOffset(W, H, off, 0, W, H);
        S.sf.tFold = p > .12 ? 1 : 0;
        // 가끔 사장님이 툭
        t0 += dt; if (t0 > 5.5 && !reduced) { t0 = 0; S.fm.sq = 1; S.fm.rip = 0; S.fm.tGlow = 1.8; S.sf.pulse = .6; }
        var cw = new T.Vector3(0, 2.02, .12); S.sf.group.localToWorld(cw); cap.position.copy(cw);
        gCap.position.copy(cw); gCap.material.opacity = .55 + .1 * Math.sin(t * 2.2);
        var sw = new T.Vector3(0, 1.66, .06); S.sf.group.localToWorld(sw); gScr.position.copy(sw); gScr.material.opacity = .35;
        var bw = new T.Vector3(.07, .016, 0); S.fm.root.parent.localToWorld(bw); gBand.position.copy(bw); gBand.material.opacity = clamp(S.fm.glow * .6, .2, 1);
        torch.position.set(lerp(-1.2, 1.6, (S.mx + 1) / 2), 1.0 + S.my * .7, 1.3);
        S.sf.update(dt, t); S.fm.update(dt, t);
      };
      return S;
    }

    /* ---------------- 무대 2: FOLD MARK 4단계 ---------------- */
    function stageFmSteps(host) {
      var sc = new T.Scene(), cam = new T.PerspectiveCamera(26, 1, .01, 20), S = { host: host, sc: sc, cam: cam, step: 0, tt: 0 };
      sc.environment = ENV_DAY; sc.environmentIntensity = 1;
      keyLight(sc, 0xFFF4E2, 2.2, new T.Vector3(-.6, 1.4, .9), .35);
      var fill = new T.DirectionalLight(0xDDE6FF, .6); fill.position.set(1, .6, -1); sc.add(fill);
      ground(sc, .5, .4, .22, .55);
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
      sc.environment = ENV_DAY; sc.environmentIntensity = 1;
      keyLight(sc, 0xFFF4E2, 2.3, new T.Vector3(-.7, 1.5, .9), .5);
      var fill = new T.DirectionalLight(0xDDE6FF, .55); fill.position.set(1, .7, -1); sc.add(fill);
      ground(sc, .55, .42, .22, .55);
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
      sc.environment = ENV_DAY; sc.environmentIntensity = 1;
      keyLight(sc, 0xFFF4E2, 2.4, new T.Vector3(-2.2, 4, 3), 1.6, new T.Vector3(0, 1, 0));
      var fill = new T.DirectionalLight(0xDDE6FF, .5); fill.position.set(2.5, 2, -2); sc.add(fill);
      ground(sc, 1.2, .9, .2, .55);
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
      var v3 = new T.Vector3(), n3 = new T.Vector3(), c3 = new T.Vector3();
      S.update = function (dt, t) {
        if (!S.m) return; O.update(dt, DRAG.on && E.active === S); O.apply(cam); S.m.update(dt, t);
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

    /* ---- 무대 고르기 ---- */
    var MAKERS = { hero: stageHero, fmSteps: stageFmSteps, fmStudio: stageFmStudio, sf: stageSF }, HOSTS = $$("[data-stage]");
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
        var q = nxy(e), h = S.hitPad(q[0], q[1]); cursorText(h && h.pad ? "툭 — 눌러서 스티커 뽑기" : ""); el.style.cursor = h && h.pad ? "pointer" : ""; S.fm.tHover = h && h.pad ? 1 : 0;
      }
    });
    function up(e) {
      var S = E.active; delete DRAG.pts[e.pointerId]; if (Object.keys(DRAG.pts).length < 2) DRAG.pinch = 0;
      if (!DRAG.on) return; DRAG.on = false;
      if (S && DRAG.moved < 6 && S === STAGES.fmStudio) { var q = nxy(e), h = S.hitPad(q[0], q[1]); if (h && h.pad) S.tap(); }
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
    var last = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      var S = E.active; if (!S || doc.hidden) { last = now; return; }
      if (!inView(S.host, 50)) { last = now; return; }
      var w = S.host.clientWidth, h = S.host.clientHeight;
      if (w !== S.w || h !== S.h) { S.w = w; S.h = h; r.setSize(w, h, false); S.cam.aspect = w / Math.max(1, h); S.cam.updateProjectionMatrix(); }
      var dt = last ? Math.min(window.PP_DTMAX || .05, (now - last) / 1000) : .016; last = now;
      S.update(dt, now / 1000);
      r.render(S.sc, S.cam);
    })(0);
    E.ok = true; window.PP3D = { E: E, STAGES: STAGES, T: T };
  }
  initE();
  onScroll();
})();
