/* 사람: Mixamo 캐릭터(가볍게 바꾼 것) + 동작 섞기 */
(function () {
  "use strict";
  var G = window.G, T = G.T, GM = window.GM, TPL = {}, CLIPS = {};
  var texL = new T.TextureLoader();
  function tpl(name) {
    if (TPL[name]) return TPL[name]; var D = GM.chars[name]; if (!D) return null;
    var n = D.nv, q = new Uint16Array(G.b64buf(D.pos)), pos = new Float32Array(n * 3);
    for (var i = 0; i < n * 3; i++) pos[i] = D.lo[i % 3] + q[i] / 65535 * (D.hi[i % 3] - D.lo[i % 3]);
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.BufferAttribute(new Int8Array(G.b64buf(D.nor)), 3, true));
    var SK = (GM.skins && GM.skins[name]) || null;     // 옷 그림 · uv 는 게임 전용 파일(assets/skin)에
    if (SK) { var uq = new Uint16Array(G.b64buf(SK.uvq)), uv = new Float32Array(uq.length); for (var u = 0; u < uq.length; u++) uv[u] = SK.uvlo + uq[u] / 65535 * (SK.uvhi - SK.uvlo); g.setAttribute("uv", new T.BufferAttribute(uv, 2)); }
    else if (D.uv) g.setAttribute("uv", new T.BufferAttribute(new Float32Array(G.b64buf(D.uv)), 2));
    g.setAttribute("skinIndex", new T.BufferAttribute(new Uint8Array(G.b64buf(D.si)), 4));
    g.setAttribute("skinWeight", new T.BufferAttribute(new Uint8Array(G.b64buf(D.sw)), 4, true));
    g.setIndex(new T.BufferAttribute(D.i32 ? new Uint32Array(G.b64buf(D.idx)) : new Uint16Array(G.b64buf(D.idx)), 1));
    D.groups.forEach(function (gr) { g.addGroup(gr.start, gr.count, gr.m); });
    g.boundingSphere = new T.Sphere(new T.Vector3(0, (D.lo[1] + D.hi[1]) / 2, 0), (D.hi[1] - D.lo[1]) * .75);
    var mats = ((SK && SK.mats) || D.mats || [{ name: "body", color: 0x777777 }]).map(function (m) {
      var hair = /hair|lash/i.test(m.name), o = new T.MeshStandardMaterial({ color: m.map ? 0xffffff : m.color, roughness: hair ? .55 : .78, metalness: 0 });
      if (m.map) { o.map = texL.load(m.map); o.map.colorSpace = T.SRGBColorSpace; o.map.anisotropy = 4; }
      if (m.alpha || m.transparent) { o.alphaTest = .42; o.side = T.DoubleSide; if (/lash/i.test(m.name)) { o.transparent = true; o.alphaTest = .1; o.depthWrite = false; } }
      o.envMapIntensity = .7; return o;
    });
    var inv = new Float32Array(G.b64buf(D.inv)), hip = -1, seen = {}; D.bones.forEach(function (b, i) { if (seen[b.n]) b.n = b.n + "_dup" + i; else seen[b.n] = 1; if (b.n === "Hips" && hip < 0) hip = i; });   // 같은 이름이 겹친 보조 뼈는 동작에서 제외
    // 엉덩이 뼈의 쉬는 자세 세계 위치와, 그 부모까지의 변환 (동작의 엉덩이 높이를 이 캐릭터 크기에 맞추려고)
    var chain = [], bi = D.bones[hip].p; while (bi >= 0) { chain.unshift(bi); bi = D.bones[bi].p; }
    var pm = new T.Matrix4(), tm = new T.Matrix4(); chain.forEach(function (k) { var b = D.bones[k]; tm.compose(new T.Vector3().fromArray(b.t), new T.Quaternion().fromArray(b.q), new T.Vector3().fromArray(b.s)); pm.multiply(tm); });
    var hw = new T.Vector3().fromArray(D.bones[hip].t).applyMatrix4(pm);
    return (TPL[name] = { D: D, geo: g, mats: mats, inv: inv, h: D.hi[1] - D.lo[1], hipW: hw, hipPInv: pm.clone().invert() });
  }
  function clip(tp, an, inPlace) {
    var key = tp.D.name + "|" + an + (inPlace ? "|ip" : ""); if (CLIPS[key]) return CLIPS[key];
    var A = GM.anims[an]; if (!A) return null;
    var n = A.n, q = new Int16Array(G.b64buf(A.q)), times = new Float32Array(n), tracks = [], has = {}; tp.D.bones.forEach(function (b) { has[b.n] = 1; });
    for (var i = 0; i < n; i++) times[i] = i / A.fps;
    A.bones.forEach(function (bn, bi) { if (!has[bn]) return; var v = new Float32Array(n * 4); for (var i = 0; i < n * 4; i++) v[i] = q[bi * n * 4 + i] / 32767; tracks.push(new T.QuaternionKeyframeTrack(bn + ".quaternion", times, v)); });
    if (A.hip) {
      var hp = new Float32Array(G.b64buf(A.hip)), k = tp.hipW.y / 97, v2 = new Float32Array(n * 3), moving = Math.hypot(hp[(n - 1) * 3] - hp[0], hp[(n - 1) * 3 + 2] - hp[2]) > 20, tv = new T.Vector3();
      var ex = hp[(n - 1) * 3] - hp[0], ez = hp[(n - 1) * 3 + 2] - hp[2];
      for (var j = 0; j < n; j++) { var fr = inPlace ? j / (n - 1) : 0; tv.set(tp.hipW.x + (moving ? (hp[j * 3] - hp[0] - ex * fr) * k : 0), hp[j * 3 + 1] * k, tp.hipW.z + (moving ? (hp[j * 3 + 2] - hp[2] - ez * fr) * k : 0)).applyMatrix4(tp.hipPInv); v2[j * 3] = tv.x; v2[j * 3 + 1] = tv.y; v2[j * 3 + 2] = tv.z; }
      tracks.push(new T.VectorKeyframeTrack("Hips.position", times, v2));
    }
    var c = new T.AnimationClip(an, (n - 1) / A.fps, tracks); c.userData = { moving: !!moving };
    return (CLIPS[key] = c);
  }
  /* 사람 한 명 만들기: name = 캐릭터 이름, h = 키(m) */
  G.person = function (name, h, opt) {
    var tp = tpl(name); if (!tp) return null; opt = opt || {};
    var root = new T.Group(), rig = new T.Group(); root.add(rig);
    var s = (h || 1.7) / tp.h; rig.scale.set(s * (opt.fat || 1), s, s * (opt.fat || 1));
    var bones = tp.D.bones.map(function (b) { var o = new T.Bone(); o.name = b.n; o.position.fromArray(b.t); o.quaternion.fromArray(b.q); o.scale.fromArray(b.s); return o; });
    tp.D.bones.forEach(function (b, i) { if (b.p >= 0) bones[b.p].add(bones[i]); else rig.add(bones[i]); });
    var invs = []; for (var i = 0; i < bones.length; i++) invs.push(new T.Matrix4().fromArray(tp.inv, i * 16));
    var mesh = new T.SkinnedMesh(tp.geo, opt.mats || tp.mats); mesh.castShadow = !opt.noShadow; mesh.receiveShadow = false; mesh.frustumCulled = false;
    rig.add(mesh); mesh.bind(new T.Skeleton(bones, invs), new T.Matrix4());
    var mixer = new T.AnimationMixer(rig), cur = null, B = {}; bones.forEach(function (b) { B[b.name] = b; });
    var P = { root: root, rig: rig, mesh: mesh, bones: B, mixer: mixer, name: name, h: h || 1.7, tp: tp, anim: "", scale: s };
    P.play = function (an, o) {
      o = o || {}; if (P.anim === an && !o.force) { if (cur && o.speed != null) cur.timeScale = o.speed; return cur; }
      var c = clip(tp, an, o.inPlace); if (!c) return null; var a = mixer.clipAction(c);
      a.reset(); a.setLoop(o.once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once; a.timeScale = o.speed != null ? o.speed : 1; if (o.at != null) a.time = o.at * c.duration;
      a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (cur && cur !== a) cur.crossFadeTo(a, o.fade != null ? o.fade : .25, false); cur = a; P.anim = an; return a;
    };
    P.update = function (dt) { mixer.update(dt); };
    P.tint = function (col) { mesh.material = tp.mats.map(function (m) { var c = m.clone(); c.color.multiply(new T.Color(col)); return c; }); };
    P.dispose = function () { mixer.stopAllAction(); if (root.parent) root.parent.remove(root); };
    P.play(opt.anim || "idle", { fade: 0, at: Math.random() });
    return P;
  };
  G.charNames = function () { return Object.keys(GM.chars); };
})();
