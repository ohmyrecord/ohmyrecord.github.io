/* 화면 글자 · 버튼: 체험 고르기, 방법 안내, 진행 중 표시(HUD), 결과 */
(function () {
  "use strict";
  var G = window.G, U = G.ui = {}, root = document.getElementById("ui");
  function el(tag, cls, html, par) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (par || root).appendChild(e); return e; }
  U.el = el;
  var scr = el("div", "scr"), hud = el("div", "hud"), snd = el("button", "snd", "소리 켜기 <b>M</b>");
  snd.onclick = function () { G.snd.toggle(); snd.blur(); };
  U.sound = function (on) { snd.innerHTML = (on ? "소리 끄기" : "소리 켜기") + " <b>M</b>"; snd.classList.toggle("on", on); };
  var hTime = el("div", "h-time", "", hud), hScore = el("div", "h-score", "", hud), hLeft = el("div", "h-left", "", hud), hHint = el("div", "h-hint", "", hud), hToast = el("div", "h-toast", "", hud), hCross = el("div", "h-cross", "", hud), hPause = el("div", "h-pause", '<div class="pm"><p class="eyebrow">일시정지</p><b>잠깐 멈췄습니다</b><div class="pbtns"><button class="btn" data-a="resume">계속하기</button><button class="btn ghost" data-a="retry">다시하기</button><button class="btn ghost" data-a="other">다른 체험</button><button class="btn ghost" data-a="exit">나가기</button></div><span class="pnote">ESC 를 누르면 언제든 이 메뉴가 나옵니다</span></div>', hud), hFlash = el("div", "h-flash", "", hud);
  U.left = hLeft; U.hudEl = hud;
  U.show = function (html) { scr.innerHTML = html; scr.classList.add("on"); hud.classList.remove("on"); return scr; };
  U.hide = function () { scr.classList.remove("on"); };
  U.hud = function (on, cross) { hud.classList.toggle("on", on); hCross.style.display = cross ? "block" : "none"; if (on) { hToast.innerHTML = ""; hHint.innerHTML = ""; hLeft.innerHTML = ""; hPause.classList.remove("on"); } };
  U.time = function (t) { t = Math.max(0, Math.ceil(t)); hTime.textContent = Math.floor(t / 60) + ":" + ("0" + t % 60).slice(-2); hTime.classList.toggle("warn", t <= 20); };
  U.score = function (s, label) { hScore.style.display = s === null ? "none" : ""; hScore.innerHTML = "<small>" + (label || "점수") + "</small>" + s; };
  U.hint = function (h) { if (hHint._h !== h) { hHint._h = h; hHint.innerHTML = h || ""; hHint.style.opacity = h ? 1 : 0; } };
  U.toast = function (txt, kind) { var t = el("div", "toast " + (kind || ""), txt, hToast); setTimeout(function () { t.classList.add("out"); }, 1300); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1800); while (hToast.children.length > 4) hToast.removeChild(hToast.firstChild); };
  U.flash = function (col) { hFlash.style.background = col || "rgba(255,60,40,.35)"; hFlash.classList.remove("go"); void hFlash.offsetWidth; hFlash.classList.add("go"); };
  U.pause = function (on, cb) { hPause.classList.toggle("on", on); if (cb) U._pcb = cb; };
  Array.prototype.forEach.call(hPause.querySelectorAll("[data-a]"), function (b) { b.onclick = function (e) { e.stopPropagation(); G.snd.play("click"); if (U._pcb) U._pcb(b.getAttribute("data-a")); }; });
  U.pnote = function (t) { hPause.querySelector(".pnote").textContent = t; };

  var CARDS = [
    { id: "vendor", no: "01", t: "사장님", sub: "노점 사장님이 되어 3분 장사", view: "1인칭 · 3분", d: "주문을 받고, 닭꼬치를 굽고, FOLD MARK 스티커를 붙여 건넵니다." },
    { id: "customer", no: "02", t: "손님", sub: "인파를 뚫고 STREET FOLD 찾기", view: "3인칭 · 3분", d: "방금 산 닭꼬치를 지키며 걸어가, STREET FOLD에 트레이를 올리고 편하게 먹습니다." },
    { id: "cleaner", no: "03", t: "환경미화원", sub: "3분 동안 거리를 깨끗하게", view: "3인칭 · 3분", d: "전동 청소차로 쓰레기를 줍고, STREET FOLD를 들르고, 무단투기범은 혼내 줍니다." }
  ];
  U.menu = function (pick) {
    var s = U.show('<div class="menu"><p class="eyebrow">2030 MYEONGDONG · STREET FOLD &amp; FOLD MARK</p><h1>직접 겪어 보는 명동의 밤</h1><p class="lead">세 사람의 입장에서 같은 거리를 걸어 봅니다. 하나를 골라 주세요.</p><div class="cards">' +
      CARDS.map(function (c) { return '<button class="card" data-id="' + c.id + '"><i>' + c.no + '</i><h2>' + c.t + '</h2><p class="sub">' + c.sub + '</p><p class="d">' + c.d + '</p><span class="tag">' + c.view + '</span></button>'; }).join("") + '</div><p class="foot">키보드와 마우스로 진행합니다 · 소리는 <b>M</b> 키로 켤 수 있습니다</p></div>');
    Array.prototype.forEach.call(s.querySelectorAll(".card"), function (b) { b.onclick = function () { G.snd.play("click"); pick(b.getAttribute("data-id")); }; });
  };
  U.howto = function (g, go, back) {
    var s = U.show('<div class="how"><p class="eyebrow">' + g.eyebrow + '</p><h1>' + g.title + '</h1><p class="lead">' + g.goal + '</p><div class="cols"><div><h3>조작</h3><ul class="keys">' + g.keys.map(function (k) { return "<li><kbd>" + k[0] + "</kbd><span>" + k[1] + "</span></li>"; }).join("") + '</ul></div><div><h3>규칙</h3><ul class="rules">' + g.rules.map(function (r) { return "<li>" + r + "</li>"; }).join("") + '</ul></div></div><div class="btns"><button class="btn ghost" data-a="back">다른 체험 고르기</button><button class="btn" data-a="go">시작하기</button></div></div>');
    s.querySelector('[data-a="go"]').onclick = function () { go(); }; s.querySelector('[data-a="back"]').onclick = function () { G.snd.play("click"); back(); };
  };
  U.result = function (r, on) {
    var s = U.show('<div class="res"><p class="eyebrow">' + r.eyebrow + '</p><div class="rank r-' + r.rank.charAt(0) + (r.rank.length > 1 ? " word" : "") + '">' + r.rank + '</div>' + (r.title ? '<div class="title">칭호 · ' + r.title + '</div>' : '') + '<h1>' + r.head + '</h1><p class="lead">' + r.msg + '</p><ul class="lines">' + r.lines.map(function (l) { return "<li><span>" + l[0] + "</span><b>" + l[1] + "</b></li>"; }).join("") + '</ul><div class="btns"><button class="btn ghost" data-a="retry">다시하기</button><button class="btn ghost" data-a="other">다른 체험하기</button><button class="btn" data-a="product">제품 보기</button></div></div>');
    ["retry", "other", "product"].forEach(function (a) { s.querySelector('[data-a="' + a + '"]').onclick = function () { G.snd.play("click"); on(a); }; });
  };
})();
