/* 개인 제품 페이지 — 문구는 조 폴더의 js/content.js 에서 가져옵니다.
   (지금은 빈 틀입니다. 각자 PRODUCT0X/index.html 을 자유롭게 채워 주세요) */
(function () {
  "use strict";
  var TXT = window.MD_CONTENT, i = parseInt(document.body.getAttribute("data-product"), 10) - 1;
  var p = TXT.products[i], n = TXT.products.length;
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  document.title = p.name + " — " + TXT.teamName + " · " + TXT.siteName;
  set("ppNo", p.no); set("ppName", p.name); set("ppLine", p.line);
  set("ppIn", p.input); set("ppAi", p.ai); set("ppAct", p.act);
  var img = document.getElementById("ppImg"); img.alt = p.name;
  var nx = (i + 1) % n, next = TXT.products[nx];
  document.getElementById("ppNext").href = "../PRODUCT0" + (nx + 1) + "/index.html";
  set("ppNextName", next.no + " " + next.name);
  Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function (el) {
    var v = el.getAttribute("data-t").split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, TXT);
    if (v != null) el.textContent = v;
  });
  setTimeout(function () { Array.prototype.forEach.call(document.querySelectorAll(".rv"), function (el) { el.classList.add("is-in"); }); }, 60);
})();
