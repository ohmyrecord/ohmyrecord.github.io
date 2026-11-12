/* 제품 개별 페이지 — 문구는 js/content.js 의 products 에서 가져옵니다.
   (이 페이지는 빈 틀입니다. 내용이 정해지면 product-0X.html 을 자유롭게 채워 주세요) */
(function () {
  "use strict";
  var TXT = window.MD_CONTENT, i = parseInt(document.body.getAttribute("data-product"), 10) - 1;
  var p = TXT.products[i], n = TXT.products.length;
  function set(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  document.title = p.name + " — " + TXT.siteName;
  set("ppNo", p.no); set("ppName", p.name); set("ppLine", p.line);
  set("ppIn", p.input); set("ppAi", p.ai); set("ppAct", p.act);
  var img = document.getElementById("ppImg");
  img.src = "assets/products/product-0" + (i + 1) + "-hero.png"; img.alt = p.name;
  var next = TXT.products[(i + 1) % n];
  var nx = document.getElementById("ppNext");
  nx.href = next.page; set("ppNextName", next.no + " " + next.name);
  Array.prototype.forEach.call(document.querySelectorAll("[data-t]"), function (el) {
    var v = el.getAttribute("data-t").split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, TXT);
    if (v != null) el.textContent = v;
  });
  var rvs = document.querySelectorAll(".rv");
  setTimeout(function () { Array.prototype.forEach.call(rvs, function (el) { el.classList.add("is-in"); }); }, 60);
})();
