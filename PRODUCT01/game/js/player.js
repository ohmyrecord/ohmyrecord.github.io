/* 3인칭 주인공: W/S 앞뒤, A/D 방향 돌리기, 뒤에서 따라오는 카메라 */
(function () {
  "use strict";
  var G = window.G, T = G.T, C = G.city;
  G.shake = 0; G.bumpY = 0;
  G.Player = function (o) {
    var P = { x: o.x || 0, z: o.z || 0, dir: o.dir || 0, v: 0, r: o.r || .33, walk: o.walk || 2, run: o.run || 0, back: o.back || 1.1, turn: o.turn || 2.4, anims: o.anims, camD: o.camD || 4.4, camH: o.camH || 2.5, frozen: false, extra: o.extra || null, pitch: .1 };
    P.m = G.person(o.name, o.h || 1.7, { anim: o.anims.idle }); P.m.root.position.set(P.x, 0, P.z); G.scene.add(P.m.root);
    var cp = new T.Vector3(), look = new T.Vector3(), first = true;
    P.update = function (dt) {
      var k = G.keys, f = 0, t = 0;
      if (!P.frozen) { if (k.KeyW || k.ArrowUp) f += 1; if (k.KeyS || k.ArrowDown) f -= 1; if (k.KeyA || k.ArrowLeft) t += 1; if (k.KeyD || k.ArrowRight) t -= 1; }
      var running = P.run && f > 0 && (k.ShiftLeft || k.ShiftRight), want = f > 0 ? (running ? P.run : P.walk) : f < 0 ? -P.back : 0; if (P.boost) want = Math.max(want, P.boost);
      if (!P.frozen) { P.dir -= G.mouse.dx * .0034; P.pitch = G.clamp(P.pitch + G.mouse.dy * .0026, -.35, .6); }
      P.running = running; P.v = G.damp(P.v, want, want === 0 ? 9 : 6, dt); P.dir += t * P.turn * dt * (f < 0 ? -1 : 1) * (P.boost ? .35 : 1);
      var sx = Math.sin(P.dir), cz = Math.cos(P.dir), ox = P.x, oz = P.z; P.x += sx * P.v * dt; P.z += cz * P.v * dt;
      C.resolve(P, P.r);
      if (P.extra) { var q = { x: P.x + sx * P.extra.d, z: P.z + cz * P.extra.d }, qx = q.x, qz = q.z; if (C.resolve(q, P.extra.r)) { P.x += q.x - qx; P.z += q.z - qz; P.v *= .8; } }
      P.x = G.clamp(P.x, -C.XL + 1, C.XL - 1); P.z = G.clamp(P.z, -C.ZL + 1, C.ZL - 1);
      P.spd = Math.hypot(P.x - ox, P.z - oz) / Math.max(dt, 1e-4);
      var A = P.anims, m = P.m;
      if (!P.animLock) { if (Math.abs(P.v) < .15) m.play(A.idle, { fade: .2, inPlace: true }); else if (running || P.boost) m.play(A.run || A.walk, { fade: .18, speed: Math.abs(P.v) / (A.runSp || 3.4), inPlace: true }); else m.play(A.walk, { fade: .2, speed: (P.v < 0 ? -1 : 1) * Math.max(.4, Math.abs(P.v) / (A.walkSp || 1.35)), inPlace: true }); }
      m.root.position.set(P.x, 0, P.z); m.root.rotation.y = P.dir; m.update(dt);
    };
    P.cam = function (dt) {
      var sx = Math.sin(P.dir), cz = Math.cos(P.dir), d = P.camD;
      for (; d > .9; d -= .35) { if (!C.blocked(P.x - sx * d, P.z - cz * d, .3)) break; }
      var tx = P.x - sx * d * (1 - P.pitch * .25), tz = P.z - cz * d * (1 - P.pitch * .25), ty = P.camH * (.55 + .45 * d / P.camD) + P.pitch * 2.6;
      if (first) { cp.set(tx, ty, tz); look.set(P.x + sx * 2.5, 1.25, P.z + cz * 2.5); first = false; }
      cp.x = G.damp(cp.x, tx, 9, dt); cp.y = G.damp(cp.y, ty, 9, dt); cp.z = G.damp(cp.z, tz, 9, dt);
      look.x = G.damp(look.x, P.x + sx * 2.5, 16, dt); look.z = G.damp(look.z, P.z + cz * 2.5, 16, dt); look.y = 1.25 - P.pitch * .9 + .25;
      G.shake = G.damp(G.shake, 0, 6, dt); G.bumpY = G.damp(G.bumpY, 0, 9, dt);
      var s = G.shake; G.cam.position.set(cp.x + (Math.random() - .5) * s, cp.y + (Math.random() - .5) * s + G.bumpY, cp.z + (Math.random() - .5) * s); G.cam.lookAt(look.x, look.y + G.bumpY * .5, look.z);
      C.follow(P.x, P.z);
    };
    P.dispose = function () { P.m.dispose(); };
    return P;
  };
})();
