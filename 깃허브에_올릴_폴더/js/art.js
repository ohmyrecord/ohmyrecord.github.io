/* =========================================================
   그림 모음 (SVG) — 사람 실루엣, 골목 정면 풍경, 릴레이 무대
   이미지 파일 없이 코드로 그려서 가볍고, 인터넷 없이도 보입니다.
   질감: 무광 플라스틱(부드러운 그라데이션) + 빛 번짐
   ========================================================= */
(function () {
  "use strict";
  var C0 = window.MD_CONFIG.colors, COL = {};
  Object.keys(C0).forEach(function (k) { COL[k] = C0[k]; });
  COL.charcoal = C0.dnaCharcoal; COL.pale = C0.dnaPale; COL.ivory = C0.dnaIvory;
  var NS = "http://www.w3.org/2000/svg";
  var FONT = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  var D2R = Math.PI / 180;

  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a, b, t) {
    var A = hex(a), B = hex(b);
    return "#" + [0, 1, 2].map(function (i) { var v = Math.round(A[i] + (B[i] - A[i]) * t); return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* 끝이 둥근, 굵기가 변하는 막대 (팔다리용) */
  function taper(x1, y1, r1, x2, y2, r2) {
    var dx = x2 - x1, dy = y2 - y1, d = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux;
    return "M" + f(x1 + nx * r1) + "," + f(y1 + ny * r1) + "L" + f(x2 + nx * r2) + "," + f(y2 + ny * r2) +
      "A" + f(r2) + "," + f(r2) + " 0 0 0 " + f(x2 - nx * r2) + "," + f(y2 - ny * r2) +
      "L" + f(x1 - nx * r1) + "," + f(y1 - ny * r1) +
      "A" + f(r1) + "," + f(r1) + " 0 0 0 " + f(x1 + nx * r1) + "," + f(y1 + ny * r1) + "Z";
  }

  /* =========================================================
     사람 실루엣 (옆모습, 8등신, 관절 8개) — 키 180 단위, 발바닥이 0
     ========================================================= */
  var HIP = [0, -94], THIGH = 44, SHIN = 42, SHOULDER = [2, -145], UARM = 29, FARM = 25;
  var SIDE = {
    torso: "M-4,-156 C-9,-153 -13,-149 -13,-141 C-13,-130 -10,-121 -10,-113 C-11,-106 -14,-100 -13,-92 C-12,-86 -6,-84 0,-85 C6,-85 10,-88 10,-93 C10,-100 9,-107 9,-113 C11,-121 13,-131 12,-140 C11,-147 8,-152 5,-156 Z",
    head: "M-9,-170 C-10,-178 -4,-183 2,-182 C8,-181 11,-176 10.5,-171 L12.5,-167.5 C12.5,-166.5 11,-166 10.5,-165.8 C10.8,-163.5 10,-161 7.5,-159.6 C4,-158.4 0,-159 -2,-160.5 C-6,-161.5 -9,-165 -9,-170 Z",
    hair: {
      short: "M-10,-170 C-11,-180 -3,-185 4,-183.5 C9,-182.5 11,-178 10,-175 C5,-177 0,-176 -3,-172 C-5,-168 -7,-165 -9,-164 Z",
      pony: "M-10,-170 C-11,-180 -3,-185 4,-183.5 C9,-182.5 11,-178 10,-175 C5,-177 0,-176 -3,-172 C-5,-168 -7,-165 -9,-164 Z M-8,-176 C-17,-175 -19,-162 -15,-152 C-13,-159 -11,-166 -6,-170 Z",
      long: "M-10,-171 C-12,-182 -2,-186 5,-183.5 C10,-181 11,-177 10,-174 C4,-176 -1,-173 -2,-168 C-3,-160 -4,-151 -7,-144 C-12,-146 -14,-155 -13,-163 Z",
      cap: "M-10,-170 C-11,-180 -3,-185 4,-183.5 C9,-182.5 11,-178 10,-175 C5,-177 0,-176 -3,-172 C-5,-168 -7,-165 -9,-164 Z M-9.5,-175 C-9.5,-184 4,-186.5 9.5,-179 L19,-177.2 C18.5,-175.6 14,-175 9,-175.6 Z",
      bun: "M-10,-170 C-11,-180 -3,-185 4,-183.5 C9,-182.5 11,-178 10,-175 C5,-177 0,-176 -3,-172 C-5,-168 -7,-165 -9,-164 Z M-13,-181 a5.5,5.5 0 1,0 11,0 a5.5,5.5 0 1,0 -11,0 Z"
    },
    coat: "M-13.5,-147 C-14.5,-125 -16.5,-95 -18.5,-57 C-8,-54 6,-54 15.5,-57 C13.5,-90 12.5,-120 11.5,-146 C5,-151 -8,-151 -13.5,-147 Z",
    skirt: "M-13,-100 C-16,-88 -18,-76 -19.5,-63 C-8,-60 8,-60 16.5,-63 C14.5,-76 12.5,-88 10,-100 Z",
    pack: "M-11,-149 C-24,-149 -28,-139 -27,-123 C-27,-111 -22,-106 -11,-107 Z",
    tote: "M-2,-152 L-15,-108 M-21,-110 h14 v20 a3,3 0 0 1 -3,3 h-8 a3,3 0 0 1 -3,-3 Z",
    shoe: "M-5,-2 C-6.5,3 -5.5,7 -2,7 L17,7 C21,7 22,4 19,2 C15,0 9,-2 4,-4 Z"
  };
  // o: { fill, style:"pants|coat|skirt", hair, acc:"pack|tote|bag|none", accColor, shadow }
  function personSide(id, o) {
    o = o || {};
    var fill = o.fill || COL.ink, back = o.back || mix(fill, "#8C8A80", 0.28);
    var hair = SIDE.hair[o.hair || "short"], acc = o.acc || "none", ac = o.accColor || COL.point;
    function leg(k, col) {
      return '<g id="' + id + '-th' + k + '" fill="' + col + '"><path d="' + taper(0, 0, 9.5, 0, THIGH, 6.2) + '"/>' +
        '<g id="' + id + '-sh' + k + '"><path d="' + taper(0, 0, 6.2, 0, SHIN, 4.1) + '"/>' +
        '<g id="' + id + '-ft' + k + '"><path d="' + SIDE.shoe + '"/></g></g></g>';
    }
    function arm(k, col, extra) {
      return '<g id="' + id + '-ua' + k + '" fill="' + col + '"><path d="' + taper(0, 0, 5.7, 0, UARM, 4.3) + '"/>' +
        '<g id="' + id + '-fa' + k + '"><path d="' + taper(0, 0, 4.3, 0, FARM, 3.3) + '"/><ellipse cx="0.6" cy="' + (FARM + 3.5) + '" rx="3.5" ry="5.2"/>' + (extra || "") + '</g></g>';
    }
    var bagInHand = acc === "bag" ? '<path d="M-3,' + (FARM + 4) + ' l-5,9 M3,' + (FARM + 4) + ' l5,9" stroke="' + ac + '" stroke-width="1.6" fill="none"/><rect x="-10" y="' + (FARM + 12) + '" width="20" height="25" rx="2.5" fill="' + ac + '"/>' : "";
    return '<g id="' + id + '">' +
      (o.shadow === false ? "" : '<ellipse cx="4" cy="1" rx="26" ry="4" fill="rgba(47,49,43,.16)"/>') +
      '<g id="' + id + '-b" fill="' + fill + '">' +
        arm("B", back) + leg("B", back) +
        (acc === "pack" ? '<path d="' + SIDE.pack + '" fill="' + (o.accColor || COL.charcoal) + '"/>' : "") +
        '<path d="' + taper(0.5, -160, 4.6, 0, -151, 5.4) + '"/>' +
        '<path d="' + SIDE.torso + '"/><path d="' + SIDE.head + '"/><path d="' + hair + '" fill="' + (o.hairColor || fill) + '"/>' +
        leg("F", fill) +
        (o.style === "coat" ? '<path d="' + SIDE.coat + '"/>' : "") +
        (o.style === "skirt" ? '<path d="' + SIDE.skirt + '"/>' : "") +
        (acc === "tote" ? '<path d="' + SIDE.tote + '" stroke="' + ac + '" stroke-width="2" fill="' + ac + '"/>' : "") +
        arm("F", fill, bagInHand) +
      '</g></g>';
  }
  function bindSide(id) {
    var q = function (s) { return document.getElementById(id + s); };
    return { g: q(""), b: q("-b"), thF: q("-thF"), shF: q("-shF"), ftF: q("-ftF"), thB: q("-thB"), shB: q("-shB"), ftB: q("-ftB"),
             uaF: q("-uaF"), faF: q("-faF"), uaB: q("-uaB"), faB: q("-faB") };
  }
  /* 걸음새: phase(걸음 위치), walk(0 서 있음 ~ 1 걷기), reach(팔 뻗기), hold(물건 들기) */
  function legAngles(ph, w) {
    var hip = w * 24 * Math.sin(ph) + (1 - w) * 2;
    var knee = w * (5 + 42 * Math.pow(Math.max(0, Math.cos(ph + 0.12)), 2)) + (1 - w) * 3;
    var t1 = -hip, t2 = knee, t3 = -(t1 + t2) * 0.9 + w * 18 * Math.max(0, -Math.sin(ph + 0.9)) * 0;
    return [t1, t2, t3];
  }
  function sole(a) {
    var t1 = a[0] * D2R, t12 = (a[0] + a[1]) * D2R;
    return HIP[1] + THIGH * Math.cos(t1) + SHIN * Math.cos(t12) + 7;
  }
  function setRot(el, x, y, deg) { el.setAttribute("transform", "translate(" + x + "," + y + ") rotate(" + deg.toFixed(1) + ")"); }
  function poseSide(r, p) {
    var w = clamp(p.walk || 0, 0, 1), ph = p.phase || 0, s = p.s || 1, dir = p.dir || 1;
    var LF = legAngles(ph, w), LB = legAngles(ph + Math.PI, w);
    if (p.lean) { LF[0] -= p.lean; LB[0] -= p.lean; }
    if (p.sit) {   // 앉기: 허벅지를 앞으로 들고 무릎을 굽힘 (몸은 자리 높이로 내려감)
      var st = clamp(p.sit, 0, 1); LF = [lerp(LF[0], -84, st), lerp(LF[1], 84, st), lerp(LF[2], 0, st)]; LB = [lerp(LB[0], -80, st), lerp(LB[1], 86, st), lerp(LB[2], 0, st)];
    }
    var off = -Math.max(sole(LF), sole(LB));
    r.g.setAttribute("transform", "translate(" + p.x.toFixed(1) + "," + p.y.toFixed(1) + ") scale(" + (dir * s).toFixed(3) + "," + s + ")" + (p.tilt ? " rotate(" + p.tilt.toFixed(1) + ")" : ""));
    r.b.setAttribute("transform", "translate(0," + off.toFixed(2) + ")");
    setRot(r.thF, HIP[0], HIP[1], LF[0]); setRot(r.shF, 0, THIGH, LF[1]); setRot(r.ftF, 0, SHIN, LF[2]);
    setRot(r.thB, HIP[0], HIP[1], LB[0]); setRot(r.shB, 0, THIGH, LB[1]); setRot(r.ftB, 0, SHIN, LB[2]);
    var swF = -w * 17 * Math.sin(ph), swB = -swF;            // 팔은 반대쪽 다리와 함께 흔들림
    var aF1 = -swF, aF2 = -(8 + 14 * Math.max(0, swF) / 17), aB1 = -swB, aB2 = -(8 + 14 * Math.max(0, swB) / 17);
    var hold = clamp(p.hold || 0, 0, 1), reach = clamp(p.reach || 0, 0, 1);
    aF1 = lerp(aF1, -26, hold); aF2 = lerp(aF2, -82, hold);
    aF1 = lerp(aF1, p.reachAng == null ? -76 : p.reachAng, reach); aF2 = lerp(aF2, -8, reach);
    if (p.holdB) { aB1 = lerp(aB1, -20, p.holdB); aB2 = lerp(aB2, -86, p.holdB); }
    setRot(r.uaF, SHOULDER[0], SHOULDER[1], aF1); setRot(r.faF, 0, UARM, aF2);
    setRot(r.uaB, SHOULDER[0] - 3, SHOULDER[1], aB1); setRot(r.faB, 0, UARM, aB2);
    // 손 위치 (물건을 손에 붙일 때 사용)
    var a1 = aF1 * D2R, a12 = (aF1 + aF2) * D2R;
    var hx = SHOULDER[0] - UARM * Math.sin(a1) - (FARM + 3) * Math.sin(a12);
    var hy = SHOULDER[1] + off + UARM * Math.cos(a1) + (FARM + 3) * Math.cos(a12);
    return { hx: p.x + dir * s * hx, hy: p.y + s * hy };
  }

  /* =========================================================
     사람 실루엣 (앞/뒷모습) — 골목 정면 풍경용, 움직이지 않음
     ========================================================= */
  function personFront(x, y, s, col, o) {
    o = o || {};
    var step = o.step || 0, k = s; // step: -1~1 (걷는 중 다리 앞뒤)
    function P(d) { return '<path d="' + d + '"/>'; }
    function T(a, b, c, d, e, g) { return P(taper(a, b, c, d, e, g)); }
    var lh = -6 + Math.abs(step) * -5, rh = -6;
    var out = '<g transform="translate(' + f(x) + "," + f(y) + ") scale(" + f(k * 100) / 100 + ')" fill="' + col + '">';
    out += '<ellipse cx="0" cy="-168" rx="9.6" ry="11.6"/>';
    if (o.hair === "long") out += P("M-11,-170 C-12,-182 12,-182 11,-170 L13,-140 C6,-136 -6,-136 -13,-140 Z");
    if (o.hair === "bun") out += '<circle cx="0" cy="-182" r="5.5"/>';
    if (o.hair === "cap") out += P("M-10.5,-172 C-10,-183 10,-183 10.5,-172 Z");
    out += T(0, -158, 4.6, 0, -149, 5.6);
    out += P("M-19,-149 C-23,-148 -25.5,-144 -25,-138 C-23,-128 -19,-120 -17,-112 C-16.5,-104 -19,-98 -19.5,-88 L19.5,-88 C19,-98 16.5,-104 17,-112 C19,-120 23,-128 25,-138 C25.5,-144 23,-148 19,-149 C10,-152.5 -10,-152.5 -19,-149 Z");
    out += T(-10 + step * 1.5, -90, 10.5, -8.5 + step * 2, -50 + (step > 0 ? -3 : 0), 6.8) + T(-8.5 + step * 2, -50, 6.8, -7.5 + step * 2.5, lh + step * 3, 4.3);
    out += T(10 - step * 1.5, -90, 10.5, 8.5 - step * 2, -50 + (step < 0 ? -3 : 0), 6.8) + T(8.5 - step * 2, -50, 6.8, 7.5 - step * 2.5, rh - step * 3, 4.3);
    out += '<ellipse cx="' + f(-7.5 + step * 2.5) + '" cy="' + f(lh + step * 3 + 3) + '" rx="6" ry="3.6"/><ellipse cx="' + f(7.5 - step * 2.5) + '" cy="' + f(rh - step * 3 + 3) + '" rx="6" ry="3.6"/>';
    out += T(-22.5, -141, 5.8, -26, -111, 4.4) + T(-26, -111, 4.4, -24, -84, 3.4) + '<ellipse cx="-24" cy="-79" rx="3.6" ry="5.2"/>';
    out += T(22.5, -141, 5.8, 26, -111, 4.4) + T(26, -111, 4.4, 24, -84, 3.4) + '<ellipse cx="24" cy="-79" rx="3.6" ry="5.2"/>';
    if (o.style === "coat") out += P("M-22,-146 C-23,-120 -25,-90 -27,-56 L27,-56 C25,-90 23,-120 22,-146 Z");
    if (o.style === "skirt") out += P("M-18.5,-98 C-21,-86 -23,-74 -24,-62 L24,-62 C23,-74 21,-86 18.5,-98 Z");
    if (o.acc === "bag") out += '<rect x="22" y="-86" width="17" height="21" rx="2.5" fill="' + (o.accColor || col) + '"/>';
    if (o.acc === "pack") out += '<rect x="-17" y="-146" width="34" height="44" rx="9" fill="' + mix(col, "#000000", 0.15) + '"/>';
    return out + "</g>";
  }

  /* =========================================================
     골목 정면 풍경 — 저녁 무렵(낮) / 밤
     ========================================================= */
  function street(opt) {
    opt = opt || {};
    var night = !!opt.night, r = rng(opt.seed || 88), uid = opt.id || ("st" + (night ? "n" : "d") + (opt.seed || 88));
    var VPX = 800, VPY = 430;
    function yg(s) { return VPY + 580 * s; }
    var P = night ? {
      sky0: "#1D1F1A", sky1: "#3B3C33", wallL0: "#24261F", wallL1: "#4A4B40", wallR0: "#20221C", wallR1: "#44453B",
      floor0: "#5A5848", floor1: "#2A2B24", far: "#4F5045", haze: "rgba(255,236,170,.32)", people: "#14150F", glow: .9
    } : {
      sky0: "#F4EBCD", sky1: "#FFFDF4", wallL0: "#CFC6AA", wallL1: "#EFE8D3", wallR0: "#C8BEA1", wallR1: "#EAE2CB",
      floor0: "#FFFCF0", floor1: "#E4DCC3", far: "#F3EDDA", haze: "rgba(255,250,230,.85)", people: COL.ink, glow: .55
    };
    var o = [];
    o.push('<svg xmlns="' + NS + '" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>' +
      '<linearGradient id="' + uid + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.sky0 + '"/><stop offset="1" stop-color="' + P.sky1 + '"/></linearGradient>' +
      '<linearGradient id="' + uid + 'wl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + P.wallL0 + '"/><stop offset="1" stop-color="' + P.wallL1 + '"/></linearGradient>' +
      '<linearGradient id="' + uid + 'wr" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="' + P.wallR0 + '"/><stop offset="1" stop-color="' + P.wallR1 + '"/></linearGradient>' +
      '<linearGradient id="' + uid + 'fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P.floor0 + '"/><stop offset="1" stop-color="' + P.floor1 + '"/></linearGradient>' +
      '<radialGradient id="' + uid + 'haze" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + P.haze + '"/><stop offset="1" stop-color="' + P.haze.replace(/[\d.]+\)$/, "0)") + '"/></radialGradient>' +
      '<radialGradient id="' + uid + 'gl"><stop offset="0" stop-color="#F2D94B" stop-opacity="' + P.glow + '"/><stop offset=".45" stop-color="#F2D94B" stop-opacity="' + (P.glow * 0.35) + '"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + uid + 'bulb"><stop offset="0" stop-color="#FFF8DA"/><stop offset=".3" stop-color="#F2D94B" stop-opacity=".8"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + uid + 'vig" cx="50%" cy="48%" r="75%"><stop offset=".55" stop-color="#2F312B" stop-opacity="0"/><stop offset="1" stop-color="#2F312B" stop-opacity="' + (night ? .55 : .22) + '"/></radialGradient>' +
      '<linearGradient id="' + uid + 'refl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2D94B" stop-opacity="' + (night ? .5 : .28) + '"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + uid + 'bok"><stop offset="0" stop-color="#F2D94B" stop-opacity=".75"/><stop offset=".55" stop-color="#F2D94B" stop-opacity=".45"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + uid + 'bokw"><stop offset="0" stop-color="#FFF8DA" stop-opacity=".8"/><stop offset=".55" stop-color="#FFF8DA" stop-opacity=".45"/><stop offset="1" stop-color="#FFF8DA" stop-opacity="0"/></radialGradient>' +
      '</defs>');
    o.push('<rect width="1600" height="900" fill="url(#' + uid + 'sky)"/>');
    // 멀리 보이는 건물 (흐리게)
    o.push('<g opacity=".8"><rect x="560" y="40" width="480" height="' + f(yg(0.2) - 40) + '" fill="' + P.far + '"/>');
    for (var k = 0; k < 7; k++) {
      var fx = 590 + k * 60, fy = 120 + (k % 3) * 50, lit = night ? k % 2 === 0 : k % 3 === 0;
      o.push('<rect x="' + fx + '" y="' + fy + '" width="36" height="' + (90 + (k % 3) * 46) + '" rx="5" fill="' + (lit ? COL.point : (night ? "#5E5F53" : COL.pale)) + '"/>');
    }
    o.push('</g>');
    o.push('<ellipse cx="' + VPX + '" cy="' + (VPY - 40) + '" rx="420" ry="300" fill="url(#' + uid + 'haze)"/>');
    // 양쪽 벽
    [-1, 1].forEach(function (side) {
      var pts = [], s;
      for (s = 1.8; s >= 0.2; s -= 0.1) pts.push([VPX + side * 800 * s, VPY - 1500 * s]);
      for (s = 0.2; s <= 1.8; s += 0.1) pts.push([VPX + side * 800 * s, yg(s)]);
      o.push('<polygon fill="url(#' + uid + (side < 0 ? "wl" : "wr") + ')" points="' + pts.map(function (p) { return f(p[0]) + "," + f(p[1]); }).join(" ") + '"/>');
      for (var h = 1; h < 8; h++) {
        var s1 = 0.2, s2 = 1.8;
        o.push('<line x1="' + f(VPX + side * 800 * s1) + '" y1="' + f(yg(s1) - h * 260 * s1) + '" x2="' + f(VPX + side * 800 * s2) + '" y2="' + f(yg(s2) - h * 260 * s2) +
          '" stroke="' + (night ? "rgba(255,253,244,.05)" : "rgba(47,49,43,.06)") + '" stroke-width="2"/>');
      }
      // 창문 (밤에는 불 켜짐)
      for (var wi = 0; wi < 14; wi++) {
        var ws = 0.24 + r() * 0.9, wh = 3 + r() * 4, wx = VPX + side * 800 * ws, wy = yg(ws) - wh * 260 * ws;
        var ww = 60 * ws, wv = 80 * ws;
        var pts2 = [[wx, wy], [wx + side * ww * 0.0, wy]];
        o.push('<rect x="' + f(side < 0 ? wx - ww - 6 * ws : wx + 6 * ws) + '" y="' + f(wy - wv) + '" width="' + f(ww) + '" height="' + f(wv) + '" rx="' + f(4 * ws) + '" fill="' +
          (night ? (r() < 0.6 ? "rgba(255,226,140,.55)" : "rgba(255,253,244,.08)") : "rgba(47,49,43,.07)") + '"/>');
      }
    });
    // 바닥 (무광, 살짝 젖은 반사)
    o.push('<polygon fill="url(#' + uid + 'fl)" points="' + f(VPX - 1440) + ',' + f(yg(1.8)) + ' ' + f(VPX - 160) + ',' + f(yg(0.2)) + ' ' + f(VPX + 160) + ',' + f(yg(0.2)) + ' ' + f(VPX + 1440) + ',' + f(yg(1.8)) + '"/>');

    // 세로 간판
    var WORDS = ["명동", "분식", "환전", "약국", "카페", "만두", "안경", "의류", "호떡", "노래", "화장품", "꼬치", "서점", "사진", "떡볶이", "커피"];
    var TONES = night ? [[COL.point, COL.ink, 1], ["#5A5C52", COL.pale, 0], [COL.point, COL.ink, 1], ["#2F312B", COL.point, 0], ["#FFF3C4", COL.ink, 1]]
                      : [[COL.point, COL.ink, 1], [COL.pale, COL.ink, 0], [COL.ivory, COL.ink, 0], [COL.charcoal, COL.ivory, 0], ["#ECE5CF", COL.ink, 0], [COL.point, COL.ink, 1], [COL.pale, COL.sub, 0]];
    var DEPTHS = [0.22, 0.25, 0.29, 0.34, 0.4, 0.48, 0.6, 0.78, 1.02];
    var signs = [];
    DEPTHS.forEach(function (s, di) {
      [-1, 1].forEach(function (side) {
        if (r() < 0.1) return;
        var w = (70 + r() * 40) * s * 1.25, hm = 1.9 + r() * 1.7, base = 2.6 + r() * 1.5;
        var top = yg(s) - (base + hm) * 260 * s, bot = yg(s) - base * 260 * s;
        var xw = VPX + side * 800 * s, x = side < 0 ? xw + 6 * s : xw - 6 * s - w;
        var tone = TONES[(r() * TONES.length) | 0];
        signs.push({ s: s, side: side, x: x, top: top, w: w, h: bot - top, tone: tone, word: WORDS[(di * 2 + (side > 0 ? 1 : 0)) % WORDS.length], lit: tone[2] === 1 || (night && r() < 0.4) });
      });
    });
    // 바닥에 비친 간판 빛
    signs.forEach(function (g) {
      if (!g.lit) return;
      var y0 = yg(g.s) + 4, hh = Math.min(260, g.h * 0.7);
      o.push('<rect x="' + f(g.x) + '" y="' + f(y0) + '" width="' + f(g.w) + '" height="' + f(hh) + '" fill="url(#' + uid + 'refl)"/>');
    });
    // 줄 조명 (골목을 가로지르는 전구)
    [0.3, 0.45, 0.7].forEach(function (s, li) {
      var y = yg(s) - 4.4 * 260 * s, x1 = VPX - 800 * s, x2 = VPX + 800 * s, sag = 60 * s;
      o.push('<path d="M' + f(x1) + ',' + f(y) + ' Q' + VPX + ',' + f(y + sag * 2) + ' ' + f(x2) + ',' + f(y) + '" stroke="' + (night ? "rgba(255,253,244,.25)" : "rgba(47,49,43,.25)") + '" stroke-width="' + f(2.2 * s + .6) + '" fill="none"/>');
      for (var b = 1; b < 12; b++) {
        var t = b / 12, bx = lerp(x1, x2, t), by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y;
        o.push('<circle cx="' + f(bx) + '" cy="' + f(by + 5 * s) + '" r="' + f(26 * s) + '" fill="url(#' + uid + 'bulb)" opacity="' + (night ? 1 : .75) + '"/><circle cx="' + f(bx) + '" cy="' + f(by + 5 * s) + '" r="' + f(4 * s + .5) + '" fill="#FFF8DA"/>');
      }
    });
    signs.forEach(function (g) {
      if (g.lit) o.push('<rect x="' + f(g.x - g.w * .6) + '" y="' + f(g.top - g.w * .5) + '" width="' + f(g.w * 2.2) + '" height="' + f(g.h + g.w) + '" rx="' + f(g.w) + '" fill="url(#' + uid + 'gl)"/>');
      var face = g.tone[0], ink = g.tone[1];
      // 두께 (안쪽 옆면)
      var xe = g.side < 0 ? g.x + g.w : g.x, kk = 0.05;
      o.push('<polygon points="' + f(xe) + ',' + f(g.top) + ' ' + f(xe + (VPX - xe) * kk) + ',' + f(g.top + (VPY - g.top) * kk) + ' ' + f(xe + (VPX - xe) * kk) + ',' + f(g.top + g.h + (VPY - g.top - g.h) * kk) + ' ' + f(xe) + ',' + f(g.top + g.h) + '" fill="' + mix(face, "#2F312B", 0.35) + '"/>');
      o.push('<rect x="' + f(g.x) + '" y="' + f(g.top) + '" width="' + f(g.w) + '" height="' + f(g.h) + '" rx="' + f(g.w * .12) + '" fill="' + face + '"/>');
      o.push('<rect x="' + f(g.x) + '" y="' + f(g.top) + '" width="' + f(g.w) + '" height="' + f(g.h * .5) + '" rx="' + f(g.w * .12) + '" fill="#FFFFFF" opacity="' + (g.lit ? .22 : .1) + '"/>');
      var chars = g.word.split(""), fs = g.w * 0.48, gap = fs * 1.18, total = gap * chars.length;
      if (total < g.h * 0.9 && fs > 7) {
        var y0 = g.top + (g.h - total) / 2 + fs * 0.92;
        chars.forEach(function (ch, ci) {
          o.push('<text x="' + f(g.x + g.w / 2) + '" y="' + f(y0 + ci * gap) + '" font-family="' + FONT + '" font-weight="700" font-size="' + f(fs) + '" text-anchor="middle" fill="' + ink + '">' + ch + '</text>');
        });
      }
    });
    // 바닥 조명 (덜 붐비는 쪽을 비추는 노란 줄)
    for (var s3 = 0.22; s3 < 1.5; s3 *= 1.2) {
      [-1, 1].forEach(function (side) {
        var x = VPX + side * 430 * s3, y = yg(s3), w = 130 * s3, h = 9 * s3;
        o.push('<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(w * 1.1) + '" ry="' + f(h * 3) + '" fill="url(#' + uid + 'gl)"/>');
        o.push('<rect x="' + f(x - w / 2) + '" y="' + f(y - h / 2) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(h / 2) + '" fill="#FFF3B0"/>');
      });
    }
    // 사람들 — 2030: 두 줄로 정돈된 흐름 (먼 사람은 옅게)
    var STY = ["pants", "coat", "skirt", "pants", "coat"], HAIR = ["short", "long", "bun", "cap", "short", "long"], ACC = ["none", "bag", "none", "pack", "none"];
    var people = [];
    for (var i = 0; i < 16; i++) {
      var s = 0.24 + (i / 15) * 0.5 + r() * 0.03, lane = i % 2 ? -1 : 1;
      people.push({ s: s, lat: lane * (0.7 + r() * 1.4), h: 0.92 + r() * 0.16, o: { style: STY[(r() * 5) | 0], hair: HAIR[(r() * 6) | 0], acc: ACC[(r() * 5) | 0], step: (r() * 2 - 1) * 0.9, accColor: COL.point } });
    }
    people.sort(function (a, b) { return a.s - b.s; });
    var hazeTo = night ? "#3B3C33" : "#E9E1C9";
    people.forEach(function (p) {
      var u = 260 * p.s, x = VPX + p.lat * u, y = yg(p.s);
      var col = mix(P.people, hazeTo, clamp(0.55 - p.s * 0.75, 0, 0.6));
      o.push('<ellipse cx="' + f(x) + '" cy="' + f(y + 1) + '" rx="' + f(26 * u / 180 * 1.4) + '" ry="' + f(4 * u / 180 * 1.4) + '" fill="rgba(0,0,0,' + (night ? .3 : .12) + ')"/>');
      o.push(personFront(x, y, u * 1.7 / 180 * p.h, col, p.o));
    });
    // 앞쪽 흐린 빛망울 (보케)
    var bok = rng(7 + (opt.seed || 0));
    var bo = '<g>';
    for (var bi = 0; bi < 9; bi++) {
      var bx = bok() * 1600, by = 60 + bok() * 760, br = 18 + bok() * 44;
      if (bx > 520 && bx < 1080 && by > 300) continue;
      bo += '<circle cx="' + f(bx) + '" cy="' + f(by) + '" r="' + f(br * 1.6) + '" fill="url(#' + uid + (bok() < 0.6 ? 'bok' : 'bokw') + ')" opacity="' + f((night ? .8 : .6) + bok() * .2) + '"/>';
    }
    o.push(bo + '</g>');
    o.push('<rect width="1600" height="900" fill="url(#' + uid + 'vig)"/>');
    o.push('</svg>');
    return o.join("");
  }

  /* =========================================================
     릴레이 뒷배경: 흐릿한 저녁 거리 (6400 x 900)
     ========================================================= */
  function relayBg() {
    var r = rng(5), o = ['<svg xmlns="' + NS + '" viewBox="0 0 6400 900" preserveAspectRatio="xMinYMax meet" aria-hidden="true"><defs>' +
      '<radialGradient id="rbgGl"><stop offset="0" stop-color="#F2D94B" stop-opacity=".6"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="rbgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7DEC2"/><stop offset="1" stop-color="#F3EDDA"/></linearGradient>' +
      '<filter id="rbgBlur" x="-2%" y="-10%" width="104%" height="120%"><feGaussianBlur stdDeviation="3"/></filter></defs><g filter="url(#rbgBlur)">'];
    var x = -100;
    while (x < 6500) {
      var w = 240 + r() * 240, top = 40 + r() * 230;
      o.push('<rect x="' + f(x) + '" y="' + f(top) + '" width="' + f(w - 16) + '" height="' + f(830 - top) + '" rx="14" fill="url(#rbgB)"/>');
      for (var wy = top + 44; wy < 600; wy += 74)
        for (var wx = x + 26; wx < x + w - 52; wx += 56)
          o.push('<rect x="' + f(wx) + '" y="' + f(wy) + '" width="30" height="40" rx="5" fill="' + (r() < 0.25 ? "#F8E9A6" : "#DED5BA") + '"/>');
      var n = 1 + (r() * 2 | 0);
      for (var k = 0; k < n; k++) {
        var sx = x + 20 + r() * (w - 80), sy = top + 40 + r() * 200, sh = 150 + r() * 160, lit = r() < 0.6;
        if (lit) o.push('<ellipse cx="' + f(sx + 20) + '" cy="' + f(sy + sh / 2) + '" rx="90" ry="' + f(sh * 0.8) + '" fill="url(#rbgGl)"/>');
        o.push('<rect x="' + f(sx) + '" y="' + f(sy) + '" width="40" height="' + f(sh) + '" rx="6" fill="' + (lit ? COL.point : [COL.pale, "#D8D0B5", COL.charcoal][(r() * 3) | 0]) + '"/>');
      }
      x += w;
    }
    // 줄 조명
    for (var lx = 0; lx < 6400; lx += 520) {
      o.push('<path d="M' + lx + ',150 Q' + (lx + 260) + ',230 ' + (lx + 520) + ',150" stroke="rgba(47,49,43,.25)" stroke-width="2" fill="none"/>');
      for (var b = 1; b < 9; b++) {
        var t = b / 9, bx = lx + 520 * t, by = 150 + 2 * t * (1 - t) * 80;
        o.push('<circle cx="' + f(bx) + '" cy="' + f(by + 4) + '" r="16" fill="url(#rbgGl)"/><circle cx="' + f(bx) + '" cy="' + f(by + 4) + '" r="3.5" fill="#FFF6D0"/>');
      }
    }
    o.push('</g></svg>');
    return o.join("");
  }

  /* =========================================================
     릴레이 무대 (제품 4개가 이어지는 한 줄 거리, 6400 x 900)
     ========================================================= */
  var RELAY = {
    // v4.5: 01 FLOWAY(입구) → 02 STAY-GAP(큰길 전봇대) → 03 FOLD MARK · STREET FOLD(노점 → 골목) → 04 NAVIAR(골목 뒤편)
    // 한 구간 1600, 실제 비율 1 m = 160 (사람 약 170 cm 기준)
    seg: 1600, ground: 820,
    kiosk: { x: 760 },              // 01 FLOWAY 앞면(화면 · 버튼)이 왼쪽을 봄
    pole: { x: 2400 },              // 02 STAY-GAP 전봇대 가운데
    stall: { x: 3500 },             // 03 노점
    foldmark: { x: 3810, y: 618 },
    hinge: { x: 4350, y: 664 },     // 03 STREET FOLD 판 축 — 판 높이 0.98 m
    sf2: { x: 5420 },               // 04 골목 뒤편의 다른 STREET FOLD (앞면이 오른쪽)
    products: [{ x: 700 }, { x: 2400 }, { x: 4350 }, { x: 5420 }]
  };
  var PEOPLE = {   // 등장인물 모습
    tA: { style: "pants", hair: "short", acc: "pack", accColor: COL.charcoal },
    tB: { style: "skirt", hair: "pony" },
    pA: { style: "coat", hair: "long", acc: "bag", accColor: COL.point },
    pB: { style: "pants", hair: "cap", acc: "tote", accColor: COL.pale },
    owner: { style: "pants", hair: "short", shadow: false },
    tour: { style: "pants", hair: "cap", acc: "pack", accColor: COL.charcoal },   // 01 관광객
    elder: { style: "coat", hair: "bun", acc: "bag", accColor: COL.point },       // 02 어르신
    worker: { style: "pants", hair: "short" }                                      // 04 환경미화원
  };
  function relayTrack(products) {
    var o = [], G = RELAY.ground;
    o.push('<svg xmlns="' + NS + '" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 6400 900" preserveAspectRatio="xMinYMax meet" aria-hidden="true"><defs>' +
      '<linearGradient id="rgFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1EBD8"/><stop offset="1" stop-color="#E3DBC2"/></linearGradient>' +
      '<radialGradient id="rgGl"><stop offset="0" stop-color="#F2D94B" stop-opacity=".75"/><stop offset=".5" stop-color="#F2D94B" stop-opacity=".22"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="rgWarm"><stop offset="0" stop-color="#FFF6CF"/><stop offset=".25" stop-color="#F2D94B" stop-opacity=".7"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="rgWhite" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".95"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity=".45"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="rgCounter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77786F"/><stop offset="1" stop-color="#55574F"/></linearGradient>' +
      '<linearGradient id="rgIvory" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFEF8"/><stop offset=".55" stop-color="#F3EEDD"/><stop offset="1" stop-color="#DCD4BC"/></linearGradient>' +
      '<linearGradient id="rgPebble" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFEF8"/><stop offset="1" stop-color="#E4DDC6"/></linearGradient>' +
      '<linearGradient id="rgAwnY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E27A"/><stop offset="1" stop-color="#E2C63A"/></linearGradient>' +
      '<linearGradient id="rgAwnP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF0C8"/><stop offset="1" stop-color="#E8D9A4"/></linearGradient>' +
      '<radialGradient id="pulseG"><stop offset=".55" stop-color="#F2D94B" stop-opacity="0"/><stop offset=".8" stop-color="#F2D94B" stop-opacity=".55"/><stop offset="1" stop-color="#F2D94B" stop-opacity="0"/></radialGradient>' +
      '<filter id="rgBlur4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '</defs>');
    // 바닥 (무광)
    o.push('<rect x="-400" y="' + G + '" width="7200" height="200" fill="url(#rgFloor)"/>');
    o.push('<rect x="-400" y="' + (G - 1) + '" width="7200" height="3" fill="rgba(47,49,43,.12)"/>');
    for (var lx = 40; lx < 6400; lx += 160) {
      o.push('<ellipse cx="' + (lx + 35) + '" cy="' + (G + 38) + '" rx="70" ry="14" fill="url(#rgGl)"/>');
      o.push('<rect x="' + lx + '" y="' + (G + 34) + '" width="70" height="7" rx="3.5" fill="#FFF0A0"/>');
    }
    o.push('<g id="r-amb"></g>');

    /* --- 01 노점 (무광 플라스틱 질감) --- */
    var S = RELAY.stall.x;
    o.push('<rect x="' + (S + 70) + '" y="300" width="260" height="70" rx="12" fill="' + COL.point + '"/><ellipse cx="' + (S + 200) + '" cy="335" rx="200" ry="70" fill="url(#rgGl)"/>' +
      '<text x="' + (S + 200) + '" y="346" font-family="' + FONT + '" font-weight="700" font-size="30" text-anchor="middle" fill="' + COL.ink + '">명동 분식 · 꼬치</text>');
    o.push('<rect x="' + (S + 196) + '" y="370" width="8" height="40" fill="' + COL.charcoal + '"/>');
    o.push('<rect x="' + (S + 6) + '" y="430" width="9" height="' + (G - 430) + '" rx="4" fill="' + COL.charcoal + '"/><rect x="' + (S + 385) + '" y="430" width="9" height="' + (G - 430) + '" rx="4" fill="' + COL.charcoal + '"/>');
    o.push(personSide("r-owner", PEOPLE.owner));
    for (var k = 0; k < 10; k++) o.push('<path d="M' + (S - 20 + k * 44) + ' 418 h44 v50 q-22 20 -44 0 z" fill="url(#' + (k % 2 ? "rgAwnP" : "rgAwnY") + ')"/>');
    o.push('<rect x="' + (S - 24) + '" y="402" width="448" height="18" rx="9" fill="' + COL.ink + '"/>');
    for (var bl = 0; bl < 3; bl++) {
      var bx = S + 80 + bl * 120;
      o.push('<line x1="' + bx + '" y1="470" x2="' + bx + '" y2="500" stroke="' + COL.ink + '" stroke-width="2"/><circle cx="' + bx + '" cy="506" r="60" fill="url(#rgWarm)" opacity=".75"/><circle cx="' + bx + '" cy="506" r="7" fill="#FFF8DA"/>');
    }
    o.push('<g id="r-smoke" fill="none" stroke="rgba(255,253,244,.85)" stroke-width="9" stroke-linecap="round" filter="url(#rgBlur4)">' +
      '<path d="M' + (S + 70) + ' 600 q-16 -32 0 -64 q16 -32 0 -64"/><path d="M' + (S + 112) + ' 600 q-16 -32 0 -64 q16 -32 0 -64"/><path d="M' + (S + 154) + ' 600 q-16 -32 0 -64 q16 -32 0 -64"/></g>');
    o.push('<rect x="' + S + '" y="632" width="400" height="' + (G - 632) + '" rx="14" fill="url(#rgCounter)"/>');
    o.push('<rect x="' + (S - 10) + '" y="618" width="420" height="20" rx="10" fill="#E9E2CB"/><rect x="' + (S - 10) + '" y="618" width="420" height="7" rx="3.5" fill="#FFFDF4" opacity=".7"/>');
    o.push('<rect x="' + (S + 30) + '" y="600" width="150" height="18" rx="7" fill="' + COL.ink + '"/>');
    for (var q = 0; q < 6; q++) o.push('<line x1="' + (S + 44 + q * 22) + '" y1="592" x2="' + (S + 58 + q * 22) + '" y2="608" stroke="#E8A93A" stroke-width="8" stroke-linecap="round"/>');
    for (var m = 0; m < 3; m++) o.push('<rect x="' + (S + 34 + m * 116) + '" y="672" width="96" height="104" rx="12" fill="#4D4F48"/><rect x="' + (S + 34 + m * 116) + '" y="672" width="96" height="40" rx="12" fill="#FFFFFF" opacity=".05"/>');
    // 컵 (음식) — 손님 손으로 이동
    o.push('<g id="r-cupWait"></g>');
    // FOLD MARK — 낮은 조약돌 + 노란 빛선 + 차콜 띠
    var FM = RELAY.foldmark;
    var stickerStr = '<g id="r-sticker" opacity="0"><rect x="-7" y="-5" width="14" height="10" rx="1" fill="#FFFFFF" stroke="rgba(47,49,43,.35)" stroke-width=".8"/>' +
      '<rect x="-5.5" y="-3.5" width="4" height="4" fill="none" stroke="' + COL.point + '" stroke-width="1"/><path d="M0 -1.5 h5" stroke="' + COL.ink + '" stroke-width="1"/><rect x="2.5" y="1" width="3" height="3" fill="' + COL.ink + '"/></g>';
    // 실제 비율 168 × 50 mm (1 mm = 0.16) — 흰 앞(빛 선)이 사장님 쪽(왼쪽), 차콜 뚜껑이 손님 쪽
    o.push('<g transform="translate(' + FM.x + ',' + FM.y + ')">' +
      '<ellipse cx="0" cy="-4" rx="34" ry="16" fill="url(#rgGl)" opacity=".55"/>' +
      '<ellipse cx="0" cy="0" rx="15" ry="1.6" fill="rgba(47,49,43,.3)"/>' +
      '<path d="M-13.4 -1.2 Q-13.4 -4.8 -11.6 -4.8 Q-8 -4.9 -6 -6 Q-3 -7.2 -1 -6.8 Q1.5 -7.9 2.8 -8 L12 -8 Q13.4 -8 13.4 -6.6 L13.4 -1 Q13.4 0 12.4 0 L-12.4 0 Q-13.4 0 -13.4 -1.2 Z" fill="url(#rgPebble)" stroke="rgba(47,49,43,.25)" stroke-width=".5"/>' +
      '<path d="M2.8 -8 L12 -8 Q13.4 -8 13.4 -6.6 L13.4 -1 Q13.4 0 12.4 0 L9.4 0 Z" fill="' + COL.charcoal + '"/>' +
      '<path id="r-fmlight" d="M-13.2 -2.4 L-9.2 -2.4" stroke="#FFC94A" stroke-width="1" stroke-linecap="round" fill="none"/>' +
      '</g>');

    /* --- 01 STREET FOLD 골목 기둥 — 옆에서 본 모습, 실제 비율 (깊이 160 × 높이 2,080 mm, 1 m = 160) ---
       앞면(화면 · 판 · 쓰레기통)은 왼쪽(손님이 오는 쪽)을 봄. 옆면에는 카드 태그. */
    var Hx = RELAY.hinge.x, Hy = RELAY.hinge.y, K = 160, Y = function (m) { return G - m * K; }, D = 0.16 * K, RC = 0.03 * K;
    o.push('<ellipse cx="' + (Hx + D / 2) + '" cy="' + (G + 2) + '" rx="' + (D * 1.6) + '" ry="5" fill="rgba(47,49,43,.18)"/>');
    // 몸통 (옆면)
    o.push('<path d="M' + Hx + ' ' + Y(1.95) + ' L' + (Hx + D) + ' ' + Y(1.95) + ' L' + (Hx + D) + ' ' + (G - 2) + ' Q' + (Hx + D) + ' ' + G + ' ' + (Hx + D - 2) + ' ' + G + ' L' + (Hx + 2) + ' ' + G + ' Q' + Hx + ' ' + G + ' ' + Hx + ' ' + (G - 2) + ' Z" fill="url(#rgIvory)" stroke="rgba(47,49,43,.12)" stroke-width="1"/>');
    o.push('<rect x="' + (Hx + D - 3) + '" y="' + Y(1.95) + '" width="3" height="' + (Y(0) - Y(1.95)) + '" fill="rgba(47,49,43,.06)"/>');   // 벽 쪽 그늘
    // 번호 없는 노란 머리 (호박색 빛)
    o.push('<ellipse cx="' + (Hx + D / 2) + '" cy="' + Y(2.02) + '" rx="54" ry="34" fill="url(#rgGl)" opacity=".7"/>' +
      '<path d="M' + Hx + ' ' + Y(1.95) + ' L' + Hx + ' ' + Y(2.06) + ' Q' + Hx + ' ' + Y(2.08) + ' ' + (Hx + 3) + ' ' + Y(2.08) + ' L' + (Hx + D - 3) + ' ' + Y(2.08) + ' Q' + (Hx + D) + ' ' + Y(2.08) + ' ' + (Hx + D) + ' ' + Y(2.06) + ' L' + (Hx + D) + ' ' + Y(1.95) + ' Z" fill="' + COL.point + '"/>');
    // 디스플레이 — 앞을 보므로 옆에서는 얇은 검은 면 + 앞으로 번지는 빛
    o.push('<rect x="' + (Hx - 1.5) + '" y="' + Y(1.92) + '" width="3" height="' + (0.47 * K) + '" rx="1" fill="' + COL.ink + '"/>' +
      '<path d="M' + (Hx - 1) + ' ' + Y(1.92) + ' L' + (Hx - 26) + ' ' + (Y(1.92) - 8) + ' L' + (Hx - 26) + ' ' + (Y(1.45) + 8) + ' L' + (Hx - 1) + ' ' + Y(1.45) + ' Z" fill="url(#rgWhite)" opacity=".35"/>');
    // 대는 곳 (원형 흰 조명) — 앞면에 살짝 튀어나온 원
    o.push('<rect x="' + (Hx - 1.5) + '" y="' + (Y(1.32) - 7) + '" width="2.5" height="14" rx="1" fill="#FFFFFF" stroke="rgba(47,49,43,.3)" stroke-width=".6"/>' +
      '<ellipse id="r-ring" cx="' + (Hx - 4) + '" cy="' + Y(1.32) + '" rx="10" ry="14" fill="#FFFFFF" opacity=".35" filter="url(#rgBlur4)"/>');
    // 판이 들어가는 홈 (앞면이 30 mm 들어감)
    o.push('<rect x="' + Hx + '" y="' + Y(1.21) + '" width="' + RC + '" height="' + (Y(0.977) - Y(1.21)) + '" fill="#DCD4BC"/>' +
      '<rect x="' + Hx + '" y="' + Y(1.21) + '" width="' + RC + '" height="1.5" fill="#FFFFFF" opacity=".9"/>');
    // 쓰레기통 모듈 앞판 (옆에서 보면 얇은 차콜 면) + 상태 점 + 옆면 카드 태그
    o.push('<rect x="' + (Hx - 1) + '" y="' + Y(0.672) + '" width="3.5" height="' + (0.564 * K) + '" rx="1" fill="#3F413B"/>' +
      '<circle cx="' + (Hx + 1) + '" cy="' + Y(0.705) + '" r="1.5" fill="#7CCB62"/>' +
      '<rect x="' + (Hx + 0.04 * K) + '" y="' + Y(0.619) + '" width="' + (0.04 * K) + '" height="' + (0.038 * K) + '" rx="1.2" fill="none" stroke="' + COL.point + '" stroke-width="1.4"/>');
    // 모듈 아래 호박색 조명선
    o.push('<rect x="' + Hx + '" y="' + (Y(0.125) - 1) + '" width="' + (D - 4) + '" height="2" fill="#FFB547"/><ellipse cx="' + (Hx + 4) + '" cy="' + Y(0.125) + '" rx="22" ry="7" fill="url(#rgGl)" opacity=".7"/>');
    // 판에 떨어지는 흰 빛 (판이 내려오면)
    o.push('<g id="r-light" opacity="0"><path d="M' + (Hx + 2) + ' ' + (Y(1.19)) + ' L' + (Hx - 0.24 * K) + ' ' + (Hy - 3) + ' L' + Hx + ' ' + (Hy - 3) + ' Z" fill="url(#rgWhite)"/>' +
      '<ellipse cx="' + (Hx - 18) + '" cy="' + (Hy - 3) + '" rx="26" ry="5" fill="#FFFFFF" opacity=".6" filter="url(#rgBlur4)"/></g>');
    // 판 (접힌 상태 = 홈 안에 세워짐, main.js 가 -90° 돌려 왼쪽으로 내림) + 걸이 (무게로 늘 아래를 향함)
    o.push('<g id="r-table"><rect x="' + (Hx + 0.4) + '" y="' + (Hy - 0.228 * K) + '" width="3.8" height="' + (0.228 * K) + '" rx="1.4" fill="#FFFDF4" stroke="rgba(47,49,43,.35)" stroke-width=".8"/>' +
      '<g id="r-hook"><path d="M' + (Hx + 0.4) + ' ' + (Hy - 0.17 * K) + ' h-2.5 v7 q0 3.5 -3.5 3.5 q-2.6 0 -2.6 -2.6" stroke="' + COL.ink + '" stroke-width="1.4" fill="none" stroke-linecap="round"/></g></g>');

    /* ================= 01 FLOWAY — 명동 입구 길 안내 키오스크 (580 × 710 × 1,750 mm) =================
       옆에서 본 모습: 화면 · 버튼 받침이 왼쪽(관광객 쪽)을 봄 */
    (function () {
      var X = RELAY.kiosk.x, K = 160, Yk = function (m) { return G - m * K; }, Xk = function (m) { return X + m * K; };
      o.push('<ellipse cx="' + Xk(0.3) + '" cy="' + (G + 2) + '" rx="70" ry="6" fill="rgba(47,49,43,.18)"/>');
      // 몸통 (아래가 살짝 휘어 들어감) + 머리 덮개 + 버튼 받침
      o.push('<path d="M' + Xk(0.16) + ' ' + G + ' C' + Xk(0.1) + ' ' + Yk(0.5) + ' ' + Xk(0.12) + ' ' + Yk(0.8) + ' ' + Xk(0.08) + ' ' + Yk(0.98) +
        ' L' + Xk(-0.1) + ' ' + Yk(0.99) + ' Q' + Xk(-0.13) + ' ' + Yk(1.0) + ' ' + Xk(-0.12) + ' ' + Yk(1.03) + ' L' + Xk(0.0) + ' ' + Yk(1.06) +
        ' L' + Xk(0.05) + ' ' + Yk(1.62) + ' L' + Xk(-0.02) + ' ' + Yk(1.63) + ' L' + Xk(-0.02) + ' ' + Yk(1.72) + ' Q' + Xk(-0.02) + ' ' + Yk(1.75) + ' ' + Xk(0.02) + ' ' + Yk(1.75) +
        ' L' + Xk(0.6) + ' ' + Yk(1.75) + ' Q' + Xk(0.64) + ' ' + Yk(1.75) + ' ' + Xk(0.64) + ' ' + Yk(1.7) + ' L' + Xk(0.6) + ' ' + Yk(0.05) + ' Q' + Xk(0.6) + ' ' + G + ' ' + Xk(0.56) + ' ' + G + ' Z" fill="url(#rgIvory)" stroke="rgba(47,49,43,.14)" stroke-width="1"/>');
      o.push('<path d="M' + Xk(0.6) + ' ' + Yk(1.2) + ' C' + Xk(0.57) + ' ' + Yk(0.8) + ' ' + Xk(0.56) + ' ' + Yk(0.4) + ' ' + Xk(0.58) + ' ' + Yk(0.03) + '" stroke="' + COL.point + '" stroke-width="4" fill="none" stroke-linecap="round"/>');   // 옆면 노란 띠
      // 화면 (앞을 보므로 옆에서는 얇은 면 + 앞으로 번지는 빛)
      o.push('<path d="M' + Xk(0.0) + ' ' + Yk(1.08) + ' L' + Xk(0.05) + ' ' + Yk(1.6) + '" stroke="' + COL.ink + '" stroke-width="4" stroke-linecap="round"/>' +
        '<path id="r-fw-glow" d="M' + Xk(0.0) + ' ' + Yk(1.08) + ' L' + Xk(0.05) + ' ' + Yk(1.6) + ' L' + Xk(-0.32) + ' ' + Yk(1.72) + ' L' + Xk(-0.36) + ' ' + Yk(0.98) + ' Z" fill="url(#rgWhite)" opacity=".25"/>');
      // 버튼 세 개 (QR · 다이얼 · 언어) — 받침 위
      o.push('<rect x="' + Xk(-0.1) + '" y="' + (Yk(1.03) - 3) + '" width="5" height="3" rx="1" fill="' + COL.ink + '"/><rect id="r-fw-dial" x="' + Xk(-0.065) + '" y="' + (Yk(1.03) - 5) + '" width="7" height="5" rx="2" fill="#E2B23A"/><rect x="' + Xk(-0.02) + '" y="' + (Yk(1.03) - 3) + '" width="5" height="3" rx="1" fill="' + COL.charcoal + '"/>');
    })();
    // 화면 크게 보기 (말풍선) — 언어 → 혼잡을 피한 추천 경로 → QR 로 휴대폰에
    (function () {
      var bx = RELAY.kiosk.x - 400, by = 330, w = 270, h = 196, tx = RELAY.kiosk.x + 2, ty = G - 1.35 * 160;
      o.push('<g id="r-fw-ui" opacity="0"><path d="M' + (bx + w - 30) + ' ' + (by + h) + ' L' + tx + ' ' + ty + ' L' + (bx + w - 60) + ' ' + (by + h) + ' Z" fill="#2F312B" opacity=".9"/>' +
        '<rect x="' + bx + '" y="' + by + '" width="' + w + '" height="' + h + '" rx="20" fill="#2F312B"/><rect x="' + (bx + 10) + '" y="' + (by + 10) + '" width="' + (w - 20) + '" height="' + (h - 20) + '" rx="12" fill="#F4F1E6"/>' +
        '<g id="r-fw-s1" opacity="0">' + ["English", "日本語", "中文", "한국어"].map(function (t, i) { return '<rect x="' + (bx + 70) + '" y="' + (by + 26 + i * 38) + '" width="130" height="28" rx="14" fill="' + (i === 0 ? "#2F312B" : "#FFFFFF") + '"/><text x="' + (bx + 135) + '" y="' + (by + 45 + i * 38) + '" font-family="' + FONT + '" font-size="15" font-weight="700" text-anchor="middle" fill="' + (i === 0 ? "#F2D94B" : "#2F312B") + '">' + t + '</text>'; }).join("") + '</g>' +
        '<g id="r-fw-s2" opacity="0"><path d="M' + (bx + 30) + ' ' + (by + 60) + ' h210 M' + (bx + 30) + ' ' + (by + 120) + ' h210 M' + (bx + 90) + ' ' + (by + 20) + ' v156 M' + (bx + 180) + ' ' + (by + 20) + ' v156" stroke="#DDD6C2" stroke-width="10"/>' +
          '<circle cx="' + (bx + 180) + '" cy="' + (by + 60) + '" r="18" fill="#E5574F" opacity=".35"/><circle cx="' + (bx + 180) + '" cy="' + (by + 60) + '" r="6" fill="#E5574F"/>' +
          '<path id="r-fw-route" d="M' + (bx + 40) + ' ' + (by + 160) + ' L' + (bx + 90) + ' ' + (by + 160) + ' L' + (bx + 90) + ' ' + (by + 120) + ' L' + (bx + 230) + ' ' + (by + 120) + ' L' + (bx + 230) + ' ' + (by + 40) + '" stroke="#E2B23A" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="420" stroke-dashoffset="420"/>' +
          '<text x="' + (bx + 26) + '" y="' + (by + 40) + '" font-family="' + FONT + '" font-size="13" font-weight="700" fill="#2F312B">붐비는 곳을 피한 길</text></g>' +
        '<g id="r-fw-s3" opacity="0"><rect x="' + (bx + 95) + '" y="' + (by + 32) + '" width="80" height="80" rx="6" fill="#FFFFFF"/>' + (function () { var q = "", r2 = rng(77); for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) if ((i < 2 && j < 2) || (i > 5 && j < 2) || (i < 2 && j > 5) || r2() > .55) q += '<rect x="' + (bx + 103 + i * 8) + '" y="' + (by + 40 + j * 8) + '" width="8" height="8" fill="#2F312B"/>'; return q; })() +
          '<text x="' + (bx + 135) + '" y="' + (by + 145) + '" font-family="' + FONT + '" font-size="15" font-weight="700" text-anchor="middle" fill="#2F312B">휴대폰으로 보냈어요</text><circle cx="' + (bx + 135) + '" cy="' + (by + 166) + '" r="8" fill="#7CCB62"/></g>' +
        '</g>');
    })();

    /* ================= 02 STAY-GAP — 전봇대에 붙는 휴식 장치 (320 × 1,800 × 350 mm) =================
       혼잡하면 빨강(기대기만), 흩어지면 초록 → 버튼 → 걸터앉기 / 앉기 */
    (function () {
      var X = RELAY.pole.x, K = 160, Yp = function (m) { return G - m * K; }, PW = 0.28 * K, L = X - PW / 2;
      o.push('<g id="r-crowd">' + (function () { var c = "", r3 = rng(41), fill = mix(COL.ink, "#E3DBC2", 0.45); for (var i = 0; i < 16; i++) c += personFront(1960 + r3() * 900, G - 6 + r3() * 10, 0.8 + r3() * 0.12, fill, { hair: ["long", "bun", "cap", ""][i % 4], style: i % 3 ? "coat" : "", step: r3() * 2 - 1 }); return c; })() + '</g>');
      o.push('<ellipse cx="' + X + '" cy="' + (G + 2) + '" rx="40" ry="5" fill="rgba(47,49,43,.18)"/>');
      o.push('<rect x="' + L + '" y="-200" width="' + PW + '" height="' + (G + 200) + '" fill="#45463F"/><rect x="' + (L + PW * .62) + '" y="-200" width="' + (PW * .2) + '" height="' + (G + 200) + '" fill="#FFFFFF" opacity=".06"/>');
      o.push('<rect x="' + (L - 2) + '" y="' + Yp(1.24) + '" width="' + (PW + 4) + '" height="8" rx="2" fill="#26272A"/>');   // 묶는 띠
      // 빛 띠 (빨강 · 초록)
      o.push('<rect id="r-sg-ring" x="' + (L - 1) + '" y="' + Yp(1.78) + '" width="' + (PW + 2) + '" height="10" rx="2" fill="#E5574F"/><ellipse id="r-sg-glow" cx="' + X + '" cy="' + (Yp(1.78) + 5) + '" rx="60" ry="26" fill="#E5574F" opacity=".35" filter="url(#rgBlur4)"/>');
      // 위 판 (기대는 판, 고정) + 아래 판 (r-sg-seat: 축 0.62 m, 위로 접혀 있다가 바깥으로 펼침)
      var panel = function (y0, y1) { return '<rect x="' + (L - 7) + '" y="' + Yp(y1) + '" width="7" height="' + ((y1 - y0) * K) + '" rx="3" fill="#C9BFA6" stroke="rgba(47,49,43,.25)" stroke-width=".8"/>'; };
      o.push(panel(1.02, 1.5));
      o.push('<g id="r-sg-seat">' + panel(0.62, 1.0) + '</g>');
      o.push('<circle id="r-sg-b1" cx="' + (L - 3.5) + '" cy="' + Yp(1.0) + '" r="3.5" fill="#F29A3A"/><circle id="r-sg-b2" cx="' + (L - 3.5) + '" cy="' + Yp(0.62) + '" r="3.5" fill="#F29A3A"/>');
      // 빛의 뜻 (작은 이름표)
      o.push('<g id="r-sg-tagR"><rect x="' + (X + 40) + '" y="' + (Yp(1.78) - 12) + '" width="104" height="30" rx="15" fill="#2F312B"/><circle cx="' + (X + 58) + '" cy="' + (Yp(1.78) + 3) + '" r="6" fill="#E5574F"/><text x="' + (X + 72) + '" y="' + (Yp(1.78) + 8) + '" font-family="' + FONT + '" font-size="14" font-weight="700" fill="#FFFDF4">펼침 제한</text></g>' +
        '<g id="r-sg-tagG" opacity="0"><rect x="' + (X + 40) + '" y="' + (Yp(1.78) - 12) + '" width="132" height="30" rx="15" fill="#2F312B"/><circle cx="' + (X + 58) + '" cy="' + (Yp(1.78) + 3) + '" r="6" fill="#7CCB62"/><text x="' + (X + 72) + '" y="' + (Yp(1.78) + 8) + '" font-family="' + FONT + '" font-size="14" font-weight="700" fill="#FFFDF4">앉을 수 있어요</text></g>');
    })();

    /* ================= 04 NAVIAR — 골목 뒤편, 가득 찬 쓰레기통 =================
       골목의 다른 STREET FOLD (앞면이 오른쪽) — 호박색 선이 깜박이면 환경미화원 바이저에 경로가 뜸 */
    (function () {
      var X = RELAY.sf2.x, K = 160, Y = function (m) { return G - m * K; }, D = 0.16 * K;
      o.push('<g transform="translate(' + (2 * X) + ',0) scale(-1,1)">' +
        '<ellipse cx="' + (X + D / 2) + '" cy="' + (G + 2) + '" rx="' + (D * 1.6) + '" ry="5" fill="rgba(47,49,43,.18)"/>' +
        '<rect x="' + X + '" y="' + Y(1.95) + '" width="' + D + '" height="' + (G - Y(1.95)) + '" rx="2" fill="url(#rgIvory)" stroke="rgba(47,49,43,.12)"/>' +
        '<rect x="' + X + '" y="' + Y(2.08) + '" width="' + D + '" height="' + (0.13 * K) + '" rx="4" fill="' + COL.point + '"/>' +
        '<rect x="' + (X - 1.5) + '" y="' + Y(1.92) + '" width="3" height="' + (0.47 * K) + '" fill="' + COL.ink + '"/>' +
        '<rect x="' + X + '" y="' + Y(1.21) + '" width="4.8" height="' + (0.23 * K) + '" fill="#DCD4BC"/>' +
        '<rect x="' + (X - 1.5) + '" y="' + Y(1.21) + '" width="4" height="' + (0.228 * K) + '" rx="1.4" fill="#FFFDF4" stroke="rgba(47,49,43,.35)" stroke-width=".8"/>' +
        '<g id="r-bin2"><rect x="' + (X - 1) + '" y="' + Y(0.672) + '" width="' + (D - 2) + '" height="' + (0.564 * K) + '" rx="2" fill="#3F413B"/><rect x="' + (X + 3) + '" y="' + (Y(0.672) + 5) + '" width="' + (D - 10) + '" height="5" rx="2" fill="#26272A"/></g>' +
        '<rect id="r-tag2" x="' + (X + 0.04 * K) + '" y="' + Y(0.619) + '" width="' + (0.04 * K) + '" height="' + (0.038 * K) + '" rx="1.2" fill="none" stroke="' + COL.point + '" stroke-width="1.4"/>' +
        '<rect id="r-amb2" x="' + X + '" y="' + (Y(0.125) - 1) + '" width="' + (D - 4) + '" height="2.4" fill="#FFB547"/><ellipse id="r-amb2g" cx="' + (X + 4) + '" cy="' + Y(0.125) + '" rx="30" ry="9" fill="url(#rgGl)" opacity=".8"/>' +
        '</g>');
      // 바이저 화면 크게 보기 (말풍선): 경로 재탐색 → 작업 중
      var bx = X + 300, by = 300, w = 250, h = 170;
      o.push('<g id="r-nv-ui" opacity="0"><rect x="' + bx + '" y="' + by + '" width="' + w + '" height="' + h + '" rx="22" fill="#2F312B"/>' +
        '<g id="r-nv-s1"><path d="M' + (bx + 30) + ' ' + (by + 140) + ' L' + (bx + 30) + ' ' + (by + 90) + ' L' + (bx + 150) + ' ' + (by + 90) + ' L' + (bx + 150) + ' ' + (by + 50) + '" stroke="#F2D94B" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="8 9"/><circle cx="' + (bx + 150) + '" cy="' + (by + 44) + '" r="9" fill="#FFB547"/>' +
          '<text x="' + (bx + 40) + '" y="' + (by + 40) + '" font-family="' + FONT + '" font-size="15" font-weight="700" fill="#FFFDF4">경로 재탐색 중</text><text x="' + (bx + 40) + '" y="' + (by + 128) + '" font-family="' + FONT + '" font-size="13" fill="rgba(255,253,244,.6)">가득 찬 통까지 2분</text></g>' +
        '<g id="r-nv-s2" opacity="0"><circle cx="' + (bx + 54) + '" cy="' + (by + 85) + '" r="16" fill="#F2D94B"/><text x="' + (bx + 84) + '" y="' + (by + 93) + '" font-family="' + FONT + '" font-size="22" font-weight="700" fill="#FFFDF4">작업 중</text></g>' +
        '</g>');
      // 수레 + 쓰레기 봉투
      o.push('<g id="r-cart"><rect x="-34" y="-96" width="68" height="84" rx="8" fill="#5B5D55"/><rect x="-34" y="-96" width="68" height="12" rx="6" fill="' + COL.point + '"/><circle cx="-22" cy="-6" r="7" fill="#26272A"/><circle cx="22" cy="-6" r="7" fill="#26272A"/><path d="M34 -80 L52 -96" stroke="#26272A" stroke-width="4" stroke-linecap="round"/></g>');
      o.push('<g id="r-trash" opacity="0"><path d="M-12 0 Q-16 -18 -6 -26 L6 -26 Q16 -18 12 0 Z" fill="#26272A"/><path d="M-4 -26 L0 -32 L4 -26" stroke="#26272A" stroke-width="3" fill="none"/></g>');
    })();

    /* --- 등장인물 --- */
    o.push(personSide("r-tB", PEOPLE.tB));
    o.push(personSide("r-tA", PEOPLE.tA));
    o.push(personSide("r-pB", PEOPLE.pB));
    o.push(personSide("r-pA", PEOPLE.pA));
    o.push(personSide("r-tour", PEOPLE.tour));
    o.push(personSide("r-elder", PEOPLE.elder));
    o.push(personSide("r-worker", PEOPLE.worker));
    // 환경미화원 AR 바이저 (머리에 씌움 — main.js 가 사람과 같은 자리 · 크기로 옮김)
    o.push('<g id="r-visor"><path d="M-11,-176 L11,-176" stroke="#E9BE5F" stroke-width="5" stroke-linecap="round"/><circle cx="-11" cy="-176" r="3.6" fill="#CDC6B5"/>' +
      '<path d="M-4,-188 Q10,-191 15.5,-181 L18,-160 Q17,-149 9,-146 L7.5,-150 Q14,-153 14,-160 L12,-180 Q8,-186 -4,-185 Z" fill="#F7F5E8"/>' +
      '<path d="M12,-181 L15,-160 Q14,-152 8,-149 L5,-157 Q9,-165 9,-178 Z" fill="#303034" opacity=".6"/>' +
      '<path id="r-visor-led" d="M15.5,-181 L18,-160 Q17,-150 9,-146" stroke="#F2D94B" stroke-width="1.6" fill="none" opacity=".25"/></g>');
    // 관광객의 휴대폰
    o.push('<g id="r-phone" opacity="0"><rect x="-4" y="-8" width="8" height="15" rx="2" fill="' + COL.ink + '"/><rect x="-2.6" y="-6.4" width="5.2" height="11" rx="1" fill="#F2D94B"/></g>');
    // 음식 컵 + 뚜껑 + 김
    o.push('<g id="r-cup"><path d="M-13,-30 L13,-30 L10,0 L-10,0 Z" fill="#FFFDF4" stroke="rgba(47,49,43,.25)" stroke-width="1.2"/><rect x="-12" y="-20" width="24" height="7" fill="' + COL.point + '"/>' +
      '<g id="r-steam" opacity="0" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="5" stroke-linecap="round" filter="url(#rgBlur4)"><path d="M-5,-36 q-7,-14 0,-28 q7,-14 0,-28"/><path d="M6,-36 q-7,-14 0,-28 q7,-14 0,-28"/></g>' +
      '<g id="r-lid"><rect x="-15" y="-36" width="30" height="7" rx="3" fill="' + COL.charcoal + '"/></g></g>');
    o.push(stickerStr);
    o.push('</svg>');
    return o.join("");
  }

  window.MDArt = { street: street, relayBg: relayBg, relayTrack: relayTrack, personSide: personSide, bindSide: bindSide, poseSide: poseSide,
                   personFront: personFront, RELAY: RELAY, PEOPLE: PEOPLE, NS: NS, mix: mix };
})();
