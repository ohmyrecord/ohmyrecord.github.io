/* =========================================================
   v9 개인 사이트 — 글자 대신 움직이는 그림
   1) 왜: 노점 앞에 몰린 사람(점) → 스크롤하면 약도 선을 따라 골목의 빈 테이블로
   2) 연결도: 빛 한 점이 입력 → AI 판단 → 물리적 반응으로 흐름
   ========================================================= */
(function () {
  "use strict";
  var doc = document, reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s) { return doc.querySelector(s); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function eio(t) { t = clamp(t, 0, 1); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rng(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* ---------- v9.1 teamcafeteria 방식: 말이 단어씩 나타나고, 핵심 낱말이 화면을 채움 ---------- */
  function words(el, text) {   // 문장을 단어 조각으로 (나타나기 전엔 희미하게)
    el.innerHTML = ""; var list = [];
    text.split(/(\s+)/).forEach(function (w) { if (!w.trim()) { el.appendChild(doc.createTextNode(w)); return; } var sp = doc.createElement("span"); sp.textContent = w; el.appendChild(sp); list.push(sp); });
    return list;
  }
  function secP(sec) { var r = sec.getBoundingClientRect(); return { p: clamp(-r.top / Math.max(1, sec.offsetHeight - innerHeight), 0, 1), on: r.bottom > 0 && r.top < innerHeight }; }

  // 1) 첫 화면: 영상 위로 한 줄씩
  var op = $(".pp-open"), opLines = op ? Array.prototype.slice.call(op.querySelectorAll(".pp-open-lines li")) : [], opT = op && op.querySelector(".pp-open-t"), opChap = op ? op.querySelectorAll(".pp-chap li") : [];
  // 2) 목소리
  var VOICES = [
    { who: "관광객 · 26 · 오사카", line: "꼬치는 샀는데, 먹을 데가 없어서 그냥 걸으면서 먹었어요.", key: "서성임", bg: "./assets/images/scene-crowd.webp" },
    { who: "노점 사장님 · 58 · 명동길", line: "손님이 길을 물어보면 장사를 멈춰야 해요. 하루에도 수십 번이요.", key: "멈춤", bg: "../assets/images/world-street.webp" },
    { who: "환경미화원 · 61 · 중구", line: "다 먹은 꼬치는 결국 제일 가까운 노점 앞에 쌓여요.", key: "쌓임", bg: "./assets/images/scene-night.webp" },
    { who: "골목 카페 직원 · 31 · 명동 골목", line: "한 골목만 들어오면 자리가 비어 있는데, 아무도 몰라요.", key: "1분", bg: "./assets/images/scene-alley.webp" }
  ];
  var vs = $("#why"), vLine = $("#ppVLine"), vKey = $("#ppVKey"), vWho = $("#ppVWho"), vTime = $("#ppVTime"), vBg = vs && vs.querySelector(".pp-v-bg"), vChap = $("#ppVChap");
  var vCur = -1, vWords = [];
  // 3) 영상 자막: 단어씩 + <em> 낱말이 크게
  var caps = Array.prototype.slice.call(doc.querySelectorAll("#ppCaps li")), film = $(".pp-film"), fKey = null;
  if (film && caps.length) {
    fKey = doc.createElement("div"); fKey.className = "pp-film-key"; fKey.setAttribute("aria-hidden", "true"); (film.querySelector(".pp-film-pin") || film).appendChild(fKey);
    caps.forEach(function (li) {
      var sm = li.querySelector("small"), em = li.querySelector("em"), body = doc.createElement("span"); body.className = "w";
      li.dataset.key = em ? em.textContent.replace(/[,.]/g, "").trim() : "";
      var txt = li.textContent.replace(sm ? sm.textContent : "", "").trim();
      Array.prototype.slice.call(li.childNodes).forEach(function (n) { if (n !== sm) li.removeChild(n); });
      li.appendChild(body); li._w = words(body, txt);
    });
  }
  (function loop(now) {
    requestAnimationFrame(loop);
    if (op) {
      var o = secP(op);
      if (o.on) {
        var n = opLines.length, f = o.p * (n + .6) - .45;
        if (opT) { var tk = clamp(1 - f * 1.4, 0, 1); opT.style.opacity = (.12 + .88 * tk).toFixed(3); opT.style.transform = "translateY(" + ((1 - tk) * -6).toFixed(1) + "vh) scale(" + (.9 + .1 * tk).toFixed(3) + ")"; }
        opLines.forEach(function (li, i) { var last = i === n - 1; li.classList.toggle("is-on", f >= i && (f < i + 1 || last)); li.classList.toggle("is-past", f >= i + 1 && !last); });
        Array.prototype.forEach.call(opChap, function (c, i) { c.classList.toggle("is-on", i === 0); });
      }
    }
    if (vs && vLine) {
      var v = secP(vs);
      if (v.on) {
        var N = VOICES.length, g = v.p * N, i = Math.min(N - 1, Math.floor(g)), c = g - i;
        if (i !== vCur) {
          vCur = i; var V = VOICES[i]; vWho.textContent = V.who; vWords = words(vLine, V.line); vKey.textContent = V.key;
          if (vBg) vBg.style.backgroundImage = "url(" + V.bg + ")";
          Array.prototype.forEach.call(vChap.children, function (li, j) { li.classList.toggle("is-on", j === i); li.classList.toggle("is-past", j < i); });
        }
        // 0~.12 들어옴 · .12~.58 단어씩 · .62~.9 큰 낱말 · .9~1 다음으로
        var shown = Math.round(clamp((c - .1) / .45, 0, 1) * vWords.length);
        vWords.forEach(function (w, j) { w.classList.toggle("on", j < shown); w.classList.toggle("now", j === shown - 1); });
        var kk = clamp((c - .6) / .08, 0, 1) * (1 - clamp((c - .93) / .07, 0, 1));
        vs.style.setProperty("--key", kk.toFixed(3)); vs.classList.toggle("is-key", kk > .5);
        vs.style.setProperty("--fade", (clamp(c / .08, 0, 1) * (1 - clamp((c - .95) / .05, 0, 1))).toFixed(3));
        var secs = Math.floor(c * 9); vTime.textContent = "00:00:0" + secs;
      }
    }
    if (fKey && caps.length && window.PP_FILM_P != null) {
      var fp = window.PP_FILM_P, keyOn = 0, keyTxt = "";
      caps.forEach(function (li) {
        var a = +li.getAttribute("data-a"), b = +li.getAttribute("data-b"), k = clamp((fp - a) / Math.max(.001, b - a), 0, 1), on = fp >= a && fp < b;
        var shown = on ? Math.round(clamp((k - .05) / .5, 0, 1) * li._w.length) : (fp >= b ? li._w.length : 0);
        li._w.forEach(function (w, j) { w.classList.toggle("on", j < shown); });
        if (on && li.dataset.key) { var kv = clamp((k - .58) / .08, 0, 1) * (1 - clamp((k - .9) / .08, 0, 1)); if (kv > keyOn) { keyOn = kv; keyTxt = li.dataset.key; } }
      });
      if (keyTxt && fKey.textContent !== keyTxt) fKey.textContent = keyTxt;
      fKey.style.opacity = keyOn.toFixed(3); fKey.style.transform = "translate(-50%,-50%) scale(" + (1.08 - .08 * keyOn).toFixed(3) + ")";
      film.classList.toggle("is-key", keyOn > .5);
    }
  })(0);

  /* ---------- 2) 연결도 ---------- */
  var net = $("#ppNet"), path = $("#ppNetP"), dot = $("#ppNetDot");
  if (net && path && dot) {
    var nodes = net.querySelectorAll(".pp-node"), L = path.getTotalLength(), t1 = performance.now();
    (function loop2(now) {
      requestAnimationFrame(loop2);
      var r = net.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      var seen = clamp((innerHeight * .85 - r.top) / (innerHeight * .6), 0, 1);
      net.style.setProperty("--draw", seen.toFixed(3));
      var k = reduced ? seen : ((now - t1) / 2600) % 1;   // 빛 한 점이 계속 흐름
      var q = path.getPointAtLength(L * k * seen), vb = path.ownerSVGElement.viewBox.baseVal;
      dot.style.transform = "translate(" + (q.x / vb.width * r.width).toFixed(1) + "px," + (q.y / vb.height * net.querySelector("svg").clientHeight).toFixed(1) + "px)";
      nodes.forEach(function (n, i) { var at = [0.0, .5, 1][i]; n.classList.toggle("is-hit", seen > .2 + i * .25 && Math.abs(k - at) < .08); n.classList.toggle("is-in", seen > .1 + i * .25); });
    })(0);
  }
})();
