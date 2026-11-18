/* 거리의 사람들: 지도 전체에 가벼운 '점'으로 살고, 카메라 근처에 온 사람만 3D 모델을 입음 */
(function () {
  "use strict";
  var G = window.G, T = G.T, C = G.city;
  var K = G.crowd = { list: [], pool: {}, used: 0, max: 40, group: new T.Group(), R: 44 };
  var NORMAL = ["remy", "ch07_nonpbr", "character1", "character2", "character3", "character4", "ch06", "ch12", "ch33"].filter(function (n) { return window.GM && GM.chars[n]; }), FAT = "character";
  var CELL = 3, grid = {};
  function key(x, z) { return (Math.floor(x / CELL) + 500) * 1000 + Math.floor(z / CELL) + 500; }
  function regrid() { grid = {}; for (var i = 0; i < K.list.length; i++) { var a = K.list[i], k = key(a.x, a.z); (grid[k] || (grid[k] = [])).push(a); } }
  K.near = function (x, z, rad, out) { out = out || []; var n = Math.ceil(rad / CELL), cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++) { var c = grid[(cx + i + 500) * 1000 + cz + j + 500]; if (!c) continue; for (var k = 0; k < c.length; k++) { var a = c[k], dx = a.x - x, dz = a.z - z; if (dx * dx + dz * dz < (rad + a.r) * (rad + a.r)) out.push(a); } } return out; };

  function lanePoint(a, ni) {      // 다음 마디 근처의 목표점 (가는 방향의 오른쪽으로 치우쳐 걷기)
    var n = C.nodes[ni], p = C.nodes[a.node], dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    var main = Math.abs(dx) < .5 && n.a === 1, w = (Math.abs(dx) > .5 ? C.ALLEY_W : (main ? C.MAIN_W : C.SIDE_W)) / 2 - .9, mn = main ? C.MAIN_IN : .3, off = mn + a.lane * (w - mn);
    a.tx = n.x + dz * off; a.tz = n.z - dx * off;
    a.tx += (-dx) * 1.2; a.tz += (-dz) * 1.2;
  }
  function nextNode(a) {
    var n = C.nodes[a.next], opts = n.e.filter(function (e) { return e !== a.node; }); if (!opts.length) opts = n.e;
    // 큰길 쪽을 조금 더 좋아함
    var pickN = opts[Math.floor(a.rnd() * opts.length)]; if (a.rnd() < .35) { var m = opts.filter(function (e) { return C.nodes[e].a === 1; }); if (m.length) pickN = m[Math.floor(a.rnd() * m.length)]; }
    a.node = a.next; a.next = pickN; lanePoint(a, a.next);
  }
  var MAINE = null;
  function place(a, avoid) { if (!MAINE) MAINE = C.edges.filter(function (e) { return e.w === C.MAIN_W; });       // 길 위의 아무 곳에 놓기
    for (var t = 0; t < 30; t++) {
      var e = C.edges[Math.floor(a.rnd() * C.edges.length)]; if (e.w !== C.MAIN_W && a.rnd() < .6) e = MAINE[Math.floor(a.rnd() * MAINE.length)]; var f = a.rnd(), flip = a.rnd() < .5, p = C.nodes[flip ? e.b : e.a], q = C.nodes[flip ? e.a : e.b];
      a.node = flip ? e.b : e.a; a.next = flip ? e.a : e.b; lanePoint(a, a.next);
      var bx = G.lerp(p.x, q.x, f), bz = G.lerp(p.z, q.z, f), dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1, mn = e.w === C.MAIN_W ? C.MAIN_IN : .3, off = mn + a.lane * (e.w / 2 - .9 - mn);
      a.x = bx + dz / l * off; a.z = bz - dx / l * off; a.dir = Math.atan2(dx, dz);
      if (C.blocked(a.x, a.z, a.r + .1)) continue;
      if (avoid && Math.hypot(a.x - avoid.x, a.z - avoid.z) < (avoid.r || 12)) continue;
      return;
    }
  }
  K.init = function (o) {
    K.clear(); o = o || {}; K.max = o.max || 40; K.R = o.R || 44; K.opt = o;
    var rnd = G.rng((o.seed || 7) * 7919 + 13), n = o.count || 150, names = (o.names || NORMAL);
    for (var i = 0; i < n; i++) {
      var fat = rnd() < (o.fat == null ? .07 : o.fat), a = { id: i, rnd: G.rng(i * 977 + 31 + (o.seed || 0)), fat: fat, name: fat ? FAT : names[Math.floor(rnd() * names.length)], h: fat ? 1.78 + rnd() * .08 : 1.56 + rnd() * .26,
        r: fat ? .62 : .3, sp: fat ? .75 + rnd() * .2 : .95 + rnd() * .65, lane: .15 + rnd() * .85, state: "walk", t: 0, vx: 0, vz: 0, model: null, mark: 0, ph: rnd(), walk: rnd() < .3 ? "strutwalking" : "standardwalk", tint: null, alive: true };
      if (rnd() < (o.stand == null ? .12 : o.stand)) { a.state = "stand"; a.t = 4 + rnd() * 25; }
      place(a, o.avoid); K.list.push(a);
    }
    // 거리 공연(춤) + 둘러선 구경꾼
    var spots = [], perfN = o.perf == null ? 3 : o.perf;
    C.AZ.forEach(function (z) { [-1, 1].forEach(function (sd) { spots.push({ x: sd * (C.MAIN_W / 2 - 2.4), z: z + (rnd() < .5 ? -1 : 1) * (C.ALLEY_W / 2 + 4) }); }); });
    for (var pi = 0; pi < perfN && spots.length; pi++) {
      var sp = spots.splice(Math.floor(rnd() * spots.length), 1)[0]; if (o.avoid && Math.hypot(sp.x - o.avoid.x, sp.z - o.avoid.z) < (o.avoid.r || 12) + 4) continue;
      var pf = { id: n + pi * 10, rnd: G.rng(pi * 131 + 7), fat: false, name: names[Math.floor(rnd() * names.length)], h: 1.72, r: .35, sp: 0, lane: .5, state: "perform", t: 0, vx: 0, vz: 0, model: null, mark: 0, ph: rnd(), walk: "standardwalk", alive: true, perfAnim: ["hiphop", "hiphop2", "hiphop", "flair"][pi % 4], x: sp.x, z: sp.z, dir: rnd() * 6.28, fixed: true, node: 0, next: 0, tx: sp.x, tz: sp.z };
      K.list.push(pf);
      for (var wi = 0; wi < 6; wi++) { var an2 = wi / 6 * 6.28 + rnd() * .4, rr2 = 1.9 + rnd() * .5, wx = sp.x + Math.cos(an2) * rr2, wz = sp.z + Math.sin(an2) * rr2; if (!C.inStreet(wx, wz, .4)) continue;
        var wa = { id: n + pi * 10 + wi + 1, rnd: G.rng(pi * 977 + wi), fat: false, name: names[Math.floor(rnd() * names.length)], h: 1.56 + rnd() * .26, r: .3, sp: 1.1, lane: .2 + rnd() * .7, state: "stand", t: 25 + rnd() * 60, vx: 0, vz: 0, model: null, mark: 0, ph: rnd(), walk: "standardwalk", alive: true, x: wx, z: wz, dir: Math.atan2(sp.x - wx, sp.z - wz), idleAnim: rnd() < .4 ? "waving" : "idle" };
        place(wa, null); wa.x = wx; wa.z = wz; wa.dir = Math.atan2(sp.x - wx, sp.z - wz); K.list.push(wa); }
    }
    G.scene.add(K.group); regrid();
  };
  K.clear = function () { K.list.forEach(function (a) { release(a); }); K.list = []; Object.keys(K.pool).forEach(function (n) { K.pool[n].forEach(function (p) { p.dispose(); }); }); K.pool = {}; K.used = 0; if (K.group.parent) K.group.parent.remove(K.group); if (K.marks) K.marks.forEach(function (m) { if (m.parent) m.parent.remove(m); }); K.marks = []; };
  function acquire(a) {
    var pl = K.pool[a.name] || (K.pool[a.name] = []), p = null;
    for (var i = 0; i < pl.length; i++) if (!pl[i].busy) { p = pl[i]; break; }
    if (!p) { if (K.used >= K.max) return; p = G.person(a.name, 1.7, { fat: 1 }); if (!p) return; pl.push(p); K.used++; }
    p.busy = true; a.model = p; var s = a.h / p.tp.h; p.rig.scale.set(s * (a.fat ? 1.12 : 1), s, s * (a.fat ? 1.12 : 1));
    K.group.add(p.root); p.root.visible = true; p.root.position.set(a.x, 0, a.z); p.root.rotation.y = a.dir; a.anim = ""; setAnim(a, true);
  }
  function release(a) { if (!a.model) return; a.model.busy = false; a.model.root.visible = false; K.group.remove(a.model.root); a.model = null; }
  function setAnim(a, snap) {
    var p = a.model; if (!p) return; var an, o = { fade: snap ? 0 : .25 };
    if (a.state === "walk") { an = a.sp > 1.9 ? (a.id % 2 ? "run" : "running") : a.walk; o.speed = a.sp > 1.9 ? a.sp / 3.4 : a.sp / (a.walk === "strutwalking" ? 1.05 : 1.35); if (snap) o.at = a.ph; }
    else if (a.state === "stand") { an = a.idleAnim || "idle"; o.inPlace = true; if (snap) o.at = a.ph; }
    else if (a.state === "perform") { an = a.perfAnim; o.inPlace = true; if (snap) o.at = a.ph; }
    else if (a.state === "react") { an = a.reactAnim || "reaction"; o.once = true; o.force = !snap; }
    else if (a.state === "down") { an = "death"; o.once = true; if (snap) o.at = .99; }
    else if (a.state === "litter") { an = "dismissinggesture"; o.once = true; }
    else if (a.state === "angry") { an = "angry"; if (snap) o.at = a.ph * .5; }
    else if (a.state === "flee") { an = "running"; o.speed = (a.fleeSp || 3.4) / 3.3; }
    else an = "idle";
    if (a.anim !== an || o.force) { p.play(an, o); a.anim = an; } else if (o.speed != null) p.play(an, o);
  }
  var IDLES = ["idle", "idle", "idle", "waving", "swatting", "idle", "swatting"];
  K.setState = function (a, st, t, extra) { if (st === "stand" && !(extra && extra.idleAnim)) a.idleAnim = IDLES[Math.floor(a.rnd() * IDLES.length)]; a.state = st; a.t = t || 0; if (extra) for (var k in extra) a[k] = extra[k]; setAnim(a); };
  /* 치이거나 부딪혀 쓰러짐 */
  K.knock = function (a, dx, dz, pow) { a.fixed = false; a.vx = dx * (pow || 3); a.vz = dz * (pow || 3); a.dir = Math.atan2(-dx, -dz); K.setState(a, "down", 7); };
  K.bump = function (a, dx, dz, anim) { a.vx += dx * 1.6; a.vz += dz * 1.6; if (a.state === "walk" || a.state === "stand") { a.back = a.state; K.setState(a, "react", anim === "shovereaction" ? 1.6 : 1.2, { reactAnim: anim || "reaction" }); } };
  /* 머리 위 표시 */
  var markTex = G.canvasTex(128, 160, function (g, w, h) { g.fillStyle = "#ff3b30"; g.beginPath(); g.moveTo(w / 2, h - 6); g.lineTo(w * .18, h * .52); g.lineTo(w * .82, h * .52); g.closePath(); g.fill(); g.beginPath(); g.arc(w / 2, h * .36, w * .34, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "900 78px " + G.FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", w / 2, h * .38); });
  K.marks = [];
  function markOf(a) { if (a.markS) return a.markS; var s = new T.Sprite(new T.SpriteMaterial({ map: markTex, depthTest: false, transparent: true, toneMapped: false, color: new T.Color(1.6, 1.6, 1.6) })); s.scale.set(.5, .62, 1); s.renderOrder = 20; a.markS = s; K.marks.push(s); return s; }

  var tmp = [], frame = 0;
  K.update = function (dt, focus, bodies) {
    frame++; var L = K.list, i, a, R2 = K.R * K.R, Ro2 = (K.R + 6) * (K.R + 6);
    for (i = 0; i < L.length; i++) {
      a = L[i]; var fx = a.x - focus.x, fz = a.z - focus.z, d2 = fx * fx + fz * fz, nearCam = d2 < Ro2;
      a.d2 = d2;
      if (a.t > 0) { a.t -= dt; if (a.t <= 0) {
        if (a.state === "stand") { K.setState(a, "walk"); }
        else if (a.state === "perform") { a.t = 0; }
        else if (a.state === "react" || a.state === "litter" || a.state === "angry") { K.setState(a, a.back === "stand" ? "stand" : "walk", a.back === "stand" ? 5 + a.rnd() * 10 : 0); }
        else if (a.state === "down") { release(a); a.state = "walk"; a.fixed = false; a.mark = 0; place(a, { x: focus.x, z: focus.z, r: K.R + 8 }); continue; }
        else if (a.state === "flee") { a.sp = a.sp0 || 1.2; K.setState(a, "walk"); }
      } }
      if (a.mark > 0) a.mark -= dt;
      // 움직임
      var sx = 0, sz = 0, sp = 0;
      if (a.state === "walk" || a.state === "flee") {
        var tx = a.tx - a.x, tz = a.tz - a.z, tl = Math.hypot(tx, tz);
        if (tl < 2.2) { nextNode(a); tx = a.tx - a.x; tz = a.tz - a.z; tl = Math.hypot(tx, tz) || 1; }
        sp = a.state === "flee" ? (a.fleeSp || 3.4) : a.sp; var hx = tx / tl, hz = tz / tl;
        if (nearCam && C.blocked(a.x + hx * 1.1, a.z + hz * 1.1, a.r)) {     // 앞이 막히면 옆으로 돌아서 감
          var best = null; for (var tr = 1; tr <= 4 && !best; tr++) for (var sg = -1; sg <= 1; sg += 2) { var ang = sg * (a.side || 1) * tr * .45, cs = Math.cos(ang), sn = Math.sin(ang), qx = hx * cs - hz * sn, qz = hx * sn + hz * cs; if (!C.blocked(a.x + qx * 1.1, a.z + qz * 1.1, a.r)) { best = [qx, qz]; a.side = sg * (a.side || 1); break; } }
          if (best) { hx = best[0]; hz = best[1]; }
        }
        sx = hx * sp; sz = hz * sp;
        if (a.state === "walk" && a.sp <= 1.9 && a.rnd() < dt * .012) { K.setState(a, "stand", 3 + a.rnd() * 9); }
      }
      if (nearCam) {      // 가까운 사람만 서로 비켜 감
        tmp.length = 0; K.near(a.x, a.z, .9, tmp);
        for (var k = 0; k < tmp.length; k++) { var b = tmp[k]; if (b === a) continue; var dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || .01, pen = a.r + b.r + .12 - d; if (pen > 0) { var w = b.state === "down" ? .3 : 1; sx += dx / d * pen * 4 * w; sz += dz / d * pen * 4 * w; if (pen > .12) { a.x += dx / d * (pen - .12) * .5; a.z += dz / d * (pen - .12) * .5; } } }
        if (bodies) for (k = 0; k < bodies.length; k++) { b = bodies[k]; dx = a.x - b.x; dz = a.z - b.z; d = Math.hypot(dx, dz) || .01; var rr = a.r + b.r;
          if (b.avoid && d < rr + b.avoid && (a.state === "walk")) { var f = (rr + b.avoid - d) / b.avoid; sx += dx / d * f * 1.6; sz += dz / d * f * 1.6; }
          if (d < rr && b.solid && a.state !== "down") { a.x += dx / d * (rr - d); a.z += dz / d * (rr - d); } }
      }
      a.vx = G.damp(a.vx, sx, a.state === "down" ? 3 : 7, dt); a.vz = G.damp(a.vz, sz, a.state === "down" ? 3 : 7, dt);
      if (a.state === "stand" || a.state === "react" || a.state === "litter" || a.state === "angry" || a.state === "down") { a.vx = G.damp(a.vx, 0, 5, dt); a.vz = G.damp(a.vz, 0, 5, dt); }
      a.x += a.vx * dt; a.z += a.vz * dt;
      if (nearCam && !a.fixed) C.resolve(a, a.r);
      if (a.fixed) { a.x = a.tx; a.z = a.tz; a.vx = a.vz = 0; }
      if (a.state === "walk" && nearCam) { a.stuck = (Math.hypot(a.vx, a.vz) < .25) ? (a.stuck || 0) + dt : 0; if (a.stuck > 2) { a.stuck = 0; var tmpn = a.node; a.node = a.next; a.next = tmpn; lanePoint(a, a.next); } }
      var v = Math.hypot(a.vx, a.vz);
      if (v > .25 && (a.state === "walk" || a.state === "flee")) a.dir += G.angDiff(a.dir, Math.atan2(a.vx, a.vz)) * Math.min(1, dt * 7);
      // 모델 입히기 / 벗기기
      if (!a.model && d2 < R2) acquire(a); else if (a.model && d2 > Ro2) release(a);
      var p = a.model;
      if (p) {
        p.root.position.set(a.x, 0, a.z); p.root.rotation.y = a.dir;
        var far = d2 > 26 * 26; p.mesh.castShadow = d2 < 17 * 17;
        if (!far || ((frame + a.id) & 1)) p.update(far ? dt * 2 : dt);
        if (a.state === "walk" && p.anim === a.anim) { /* 걷는 빠르기에 발 맞추기 */ }
      }
      if (a.mark > 0 && p) { var m = markOf(a); if (!m.parent) G.scene.add(m); m.position.set(a.x, a.h + .45 + Math.sin(G.t * 6) * .05, a.z); m.visible = true; }
      else if (a.markS && a.markS.parent) { a.markS.parent.remove(a.markS); }
    }
    regrid();
  };
  /* 플레이어(원)와 겹친 사람들 */
  K.touch = function (x, z, r, out) { out = out || []; tmp.length = 0; K.near(x, z, r, tmp); for (var i = 0; i < tmp.length; i++) { var a = tmp[i]; if (a.state !== "down" && a.model) out.push(a); } return out; };
  K.visible = function () { return K.list.filter(function (a) { return a.model; }); };
})();
