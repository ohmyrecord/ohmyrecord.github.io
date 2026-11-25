/* =========================================================
   사람 (Mixamo 뼈대 모델) — 공용 사이트 3D 거리 · 릴레이용
   - 모양 파일: assets/people/<이름>.js  (게임과 함께 씀, 옷 그림은 없음 → 짙은 실루엣)
   - 동작 파일: assets/people/anims.js  (걷기 · 서 있기)
   - city3d.js 가 쓰던 '관절 조종' 방식(hip · legL · armR ... 의 rotation)을 그대로 받아서,
     걷기/서 있기 동작 위에 덧붙여 움직임 → 앉기 · 손 뻗기 같은 장면 동작도 그대로 됨
   ========================================================= */
(function () {
  "use strict";
  var T = window.THREE;
  if (!T) return;
  var MX = window.MDPeople = {};
  var MAP = { hip: "Hips", spine: "Spine1", head: "Head", legL: "LeftUpLeg", kneeL: "LeftLeg", legR: "RightUpLeg", kneeR: "RightLeg",
              armL: "LeftArm", elbL: "LeftForeArm", armR: "RightArm", elbR: "RightForeArm" };
  var ORDER = ["hip", "spine", "head", "legL", "kneeL", "legR", "kneeR", "armL", "elbL", "armR", "elbR"];
  function buf(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer; }
  MX.IDLE = "breathidle";
  MX.CALM = .65;
  function apronMaterial(col) {
    var m = new T.MeshStandardMaterial({ color: col, roughness: .8, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aRest; varying vec4 vRest;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec4 vRest;").replace("void main() {", [
        "void main() {",
        "  float x = abs(vRest.x), y = vRest.y, z = vRest.w; bool keep = false;",
        "  if (y > .335 && y < .615 && z > .05 && x < mix(.125, .108, (y - .335) / .28)) keep = true;",      // 치마 부분
        "  if (y >= .615 && y < .735 && z > .25 && x < .062 + (y - .615) * .05) keep = true;",                // 가슴 판
        "  if (y >= .735 && y < .80 && z > .1 && x > .040 && x < .056 - (y - .735) * .1) keep = true;",       // 목끈
        "  if (y > .598 && y < .614) keep = true;",                                                       // 허리끈 (한 바퀴)
        "  if (!keep) discard;"].join("\n"));
    };
    return m;
  }
  /* 서서 고민하는 자세: 왼손은 턱, 오른팔은 배 앞으로 접음 (기본 서 있기 위에 덧붙임) */
  MX.THINK = { armL: [-.2, 0, -.4], elbL: [-2.0, 0, -.9], armR: [0, 0, .35], elbR: [-1.5, 1.4, 0], head: [.12, 0, 0] };
  /* 팔짱 낀 자세 */
  MX.CROSS = { armR: [.2, 0, .3], elbR: [-1.7, 1.5, 0], armL: [.2, 0, -.3], elbL: [-1.7, -1.5, 0] };
  MX.ready = function () { var G = window.GM; return !!(G && G.chars && G.anims && G.anims.standardwalk); };
  MX.has = function (n) { return !!(window.GM && GM.chars && GM.chars[n]); };

  /* 모양 + 뼈 (키 1 로 맞춤: 원래 cm 단위를 한 번에 줄임) */
  var TPL = {};
  /* skin = true: 제품을 쓰는 사람 — 옷 그림(assets/people/skin)까지 입힌 원래 모습 */
  MX.template = function (name, height, mat, skin, opt) {
    opt = opt || {};
    var D = window.GM.chars[name]; if (!D) return null;
    var SK = skin && window.GM.skins && window.GM.skins[name];
    var key = name + (SK ? "|skin" : "") + (opt.apron ? "|apron" : "") + (opt.hair ? "|h" + opt.hair : ""); var tp = TPL[key];
    if (!tp) {
      var h = D.hi[1] - D.lo[1], s = 1 / h, n = D.nv, q = new Uint16Array(buf(D.pos)), pos = new Float32Array(n * 3);
      for (var i = 0; i < n * 3; i++) pos[i] = (D.lo[i % 3] + q[i] / 65535 * (D.hi[i % 3] - D.lo[i % 3])) * s;
      var g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(pos, 3));
      g.setAttribute("normal", new T.BufferAttribute(new Int8Array(buf(D.nor)), 3, true));
      g.setAttribute("skinIndex", new T.BufferAttribute(new Uint8Array(buf(D.si)), 4));
      g.setAttribute("skinWeight", new T.BufferAttribute(new Uint8Array(buf(D.sw)), 4, true));
      g.setIndex(new T.BufferAttribute(D.i32 ? new Uint32Array(buf(D.idx)) : new Uint16Array(buf(D.idx)), 1));
      g.boundingSphere = new T.Sphere(new T.Vector3(0, .5, 0), .9);
      if (SK) {
        var uq = new Uint16Array(buf(SK.uvq)), uv = new Float32Array(uq.length); for (var u = 0; u < uq.length; u++) uv[u] = SK.uvlo + uq[u] / 65535 * (SK.uvhi - SK.uvlo);
        g.setAttribute("uv", new T.BufferAttribute(uv, 2));
        (D.groups || []).forEach(function (gr) { g.addGroup(gr.start, gr.count, gr.m); });
        var tl = new T.TextureLoader();
        var mats = SK.mats.map(function (m) {
          var hair = /hair|lash/i.test(m.name || ""), o = new T.MeshStandardMaterial({ color: m.map ? 0xffffff : m.color, roughness: hair ? .55 : .74, metalness: 0 });
          if (m.map) { o.map = tl.load(m.map); o.map.colorSpace = T.SRGBColorSpace; o.map.anisotropy = 4; }
          if (m.alpha || m.transparent) { o.alphaTest = .42; o.side = T.DoubleSide; if (/lash/i.test(m.name)) { o.transparent = true; o.alphaTest = .1; o.depthWrite = false; } }
          if (hair && opt.hair) o.color.set(opt.hair);
          o.envMapIntensity = .8; return o;
        });
      }
      /* v8: 앞치마 — 몸 앞면 삼각형을 그대로 복사해 살짝 띄움 (같은 뼈를 따라 움직임) */
      var apronGeo = null;
      if (opt.apron) {
        // 몸 전체를 살짝 부풀린 복사본 + 앞치마 모양 밖은 그리지 않음 (쉬는 자세 기준 좌표로 판단 → 가장자리가 깔끔)
        var nr = g.attributes.normal, g0 = (D.groups && D.groups[0]) ? D.groups[0] : { start: 0, count: g.index.count };
        var cx = 0; for (var v0 = 0; v0 < n; v0++) cx += pos[v0 * 3]; cx /= n;
        var P2 = new Float32Array(n * 3), RS = new Float32Array(n * 4);
        for (var v1 = 0; v1 < n; v1++) { var nx = nr.getX(v1), ny = nr.getY(v1), nz = nr.getZ(v1), off = .0065;
          P2[v1 * 3] = pos[v1 * 3] + nx * off; P2[v1 * 3 + 1] = pos[v1 * 3 + 1] + ny * off; P2[v1 * 3 + 2] = pos[v1 * 3 + 2] + nz * off;
          RS[v1 * 4] = pos[v1 * 3] - cx; RS[v1 * 4 + 1] = pos[v1 * 3 + 1]; RS[v1 * 4 + 2] = pos[v1 * 3 + 2]; RS[v1 * 4 + 3] = nz; }
        apronGeo = new T.BufferGeometry();
        apronGeo.setAttribute("position", new T.BufferAttribute(P2, 3)); apronGeo.setAttribute("normal", g.attributes.normal);
        apronGeo.setAttribute("skinIndex", g.attributes.skinIndex); apronGeo.setAttribute("skinWeight", g.attributes.skinWeight);
        apronGeo.setAttribute("aRest", new T.BufferAttribute(RS, 4));
        apronGeo.setIndex(new T.BufferAttribute(g.index.array.slice(g0.start, g0.start + g0.count), 1));
        apronGeo.boundingSphere = new T.Sphere(new T.Vector3(0, .5, 0), .9);
      }
      var inv = new Float32Array(buf(D.inv));
      for (var b = 0; b < D.bones.length; b++) { inv[b * 16 + 12] *= s; inv[b * 16 + 13] *= s; inv[b * 16 + 14] *= s; }
      var seen = {}, bones = D.bones.map(function (bn, k) { var nm = bn.n; if (seen[nm]) nm = nm + "_dup" + k; else seen[nm] = 1; return { n: nm, p: bn.p, t: [bn.t[0] * s, bn.t[1] * s, bn.t[2] * s], q: bn.q, sc: bn.s }; });
      // 엉덩이 뼈 부모까지의 변환 (동작의 엉덩이 높이를 이 사람 크기에 맞추려고)
      var hip = -1; bones.forEach(function (b2, k) { if (b2.n === "Hips" && hip < 0) hip = k; });
      var chain = [], bi = bones[hip].p; while (bi >= 0) { chain.unshift(bi); bi = bones[bi].p; }
      var pm = new T.Matrix4(), tm = new T.Matrix4(); chain.forEach(function (k) { var b3 = bones[k]; tm.compose(new T.Vector3().fromArray(b3.t), new T.Quaternion().fromArray(b3.q), new T.Vector3().fromArray(b3.sc)); pm.multiply(tm); });
      var hw = new T.Vector3().fromArray(bones[hip].t).applyMatrix4(pm);
      tp = TPL[key] = { name: name, D: D, geo: g, inv: inv, bones: bones, hip: hip, hipW: hw, hipPInv: pm.clone().invert(), scale: s, mats: SK ? mats : null, apronGeo: apronGeo, apronMat: apronGeo ? apronMaterial(opt.apron) : null };
    }
    return { mx: true, tp: tp, H: height, mat: tp.mats || mat, skin: !!tp.mats, armFree: { L: 1, R: 1 }, stride: 1 };
  };

  /* 동작: 뼈마다 [시간별 회전] 표 (엉덩이 위치 포함) */
  var CL = {};
  function clip(tp, an) {
    var key = tp.name + "|" + an; if (CL[key]) return CL[key];
    var A = window.GM.anims[an]; if (!A) return null;
    var n = A.n, q = new Int16Array(buf(A.q)), has = {}, tr = [];
    tp.bones.forEach(function (b, k) { if (has[b.n] == null) has[b.n] = k; });
    A.bones.forEach(function (bn, bi) { var k = has[bn]; if (k == null) return; var v = new Float32Array(n * 4); for (var i = 0; i < n * 4; i++) v[i] = q[bi * n * 4 + i] / 32767; tr.push({ b: k, v: v }); });
    var hipT = null;
    if (A.hip) {
      var hp = new Float32Array(buf(A.hip)), k2 = tp.hipW.y / 97 * 1, ex = hp[(n - 1) * 3] - hp[0], ez = hp[(n - 1) * 3 + 2] - hp[2], tv = new T.Vector3();
      hipT = new Float32Array(n * 3);
      for (var j = 0; j < n; j++) { var f = j / (n - 1); tv.set(tp.hipW.x + (hp[j * 3] - hp[0] - ex * f) * k2, hp[j * 3 + 1] * k2, tp.hipW.z + (hp[j * 3 + 2] - hp[2] - ez * f) * k2).applyMatrix4(tp.hipPInv); hipT[j * 3] = tv.x; hipT[j * 3 + 1] = tv.y; hipT[j * 3 + 2] = tv.z; }
    }
    return (CL[key] = { n: n, fps: A.fps, dur: n / (A.fps || 30), tr: tr, hip: hipT });
  }
  var qa = new T.Quaternion(), qb = new T.Quaternion();
  function sample(c, t, out, w) {          // t: 0~1 (한 바퀴), out[b] 에 섞어 넣기
    var x = t * (c.n - 1), i0 = Math.floor(x) % (c.n - 1), f = x - Math.floor(x), i1 = i0 + 1;
    for (var k = 0; k < c.tr.length; k++) {
      var tr = c.tr[k], v = tr.v; qa.fromArray(v, i0 * 4); qb.fromArray(v, i1 * 4); qa.slerp(qb, f);
      var o = out[tr.b]; if (!o) o = out[tr.b] = new T.Quaternion().copy(qa); else if (w < 1) o.slerp(qa, w); else o.copy(qa);
    }
    if (c.hip) { var h = c.hip; out.hip = out.hip || new T.Vector3(); var px = h[i0 * 3] + (h[i1 * 3] - h[i0 * 3]) * f, py = h[i0 * 3 + 1] + (h[i1 * 3 + 1] - h[i0 * 3 + 1]) * f, pz = h[i0 * 3 + 2] + (h[i1 * 3 + 2] - h[i0 * 3 + 2]) * f; if (w < 1) out.hip.lerp(qb.set(px, py, pz, 0), w); else out.hip.set(px, py, pz); }
  }

  /* 한 사람 (city3d 의 rig 와 같은 모양으로 돌려줌) */
  MX.clone = function (R0) {
    var tp = R0.tp, B = tp.bones;
    var box = new T.Group(); box.scale.setScalar(R0.H);
    var bones = B.map(function (b) { var o = new T.Bone(); o.name = b.n; o.position.fromArray(b.t); o.quaternion.fromArray(b.q); o.scale.fromArray(b.sc); return o; });
    B.forEach(function (b, i) { if (b.p >= 0) bones[b.p].add(bones[i]); else box.add(bones[i]); });
    var invs = []; for (var i = 0; i < bones.length; i++) invs.push(new T.Matrix4().fromArray(tp.inv, i * 16));
    var mesh = new T.SkinnedMesh(tp.geo, R0.mat); mesh.frustumCulled = false; box.add(mesh);
    if (R0.skin) { mesh.castShadow = true; mesh.receiveShadow = true; }
    var skel = new T.Skeleton(bones, invs); mesh.bind(skel, new T.Matrix4());
    if (tp.apronGeo) { var am = new T.SkinnedMesh(tp.apronGeo, tp.apronMat); am.frustumCulled = false; am.castShadow = true; box.add(am); am.bind(skel, new T.Matrix4()); }
    var root = new T.Group(); root.add(box);
    var BY = {}; bones.forEach(function (b, k) { if (BY[b.name] == null) BY[b.name] = k; });
    var vb = {}, ctl = [];
    ORDER.forEach(function (k) { var v = new T.Object3D(); vb[k] = v; var i2 = BY[MAP[k]]; if (i2 != null) ctl.push({ k: k, v: v, bone: bones[i2], i: i2 }); });
    var q0 = bones.map(function (b) { return b.quaternion.clone(); }), p0 = bones.map(function (b) { return b.position.clone(); });
    var walk = clip(tp, "standardwalk"), idle = clip(tp, "idle");
    var hipY = tp.hipW.y * R0.H; vb.hip.position.y = hipY;
    var hipM3 = new T.Matrix3().setFromMatrix4(tp.hipPInv), hipUp = new T.Vector3();
    var pose = {}, mq = [], tq = new T.Quaternion(), qc = new T.Quaternion(), qi = new T.Quaternion(), ql = new T.Quaternion();
    var r = { root: root, mesh: mesh, b: vb, H: R0.H, hipY: hipY, armFree: R0.armFree, stride: 1, cc: true, mx: true, ph: 0, amt: 0, t: Math.random() * 10,
      sync: function () {
        // 1) 바탕 동작: 서 있기 ↔ 걷기 섞기
        var a = r.amt, walkT = ((r.ph / (Math.PI * 2)) % 1 + 1) % 1;
        var ic = clip(tp, r.pose || MX.IDLE) || clip(tp, "idle"); idle = ic;
        // v8: 기본은 숨 쉬듯 자연스럽게 서 있기 (T포즈 · 두리번 없음). poseLive:false 면 한 순간(poseAt)에 멈춤
        var idleT = r.poseLive !== false ? ((performance.now() / (1000 * (r.poseSec || (ic && ic.dur) || 6)) + r.t) % 1 + 1) % 1 : (r.poseAt || .02);
        if (r.gait && a > 0) { var gc = clip(tp, r.gait); if (gc) walk = gc; }
        for (var k = 0; k < bones.length; k++) bones[k].quaternion.copy(q0[k]);
        if (idle && a < 1) { sample(idle, idleT, pose, 1);
          // v8.1: 서 있을 때 좌우로 크게 흔들리지 않게 — 한 순간의 자세 쪽으로 65% 끌어당겨 움직임 폭을 1/3 로 줄임
          if (r.poseLive !== false && MX.CALM > 0) sample(idle, r._calmT == null ? (r._calmT = .5) : r._calmT, pose, MX.CALM); }
        if (walk && a > 0) sample(walk, walkT, pose, a >= 1 || !idle ? 1 : a);
        Object.keys(pose).forEach(function (k2) { if (k2 !== "hip") bones[k2].quaternion.copy(pose[k2]); });
        var hb = bones[tp.hip]; if (pose.hip) hb.position.copy(pose.hip); else hb.position.copy(p0[tp.hip]);
        // 2) 장면 동작 (몸 기준 축으로 넣은 회전) 을 지금 자세 위에 덧붙임
        box.updateMatrixWorld(true);
        var boxQi = box.getWorldQuaternion(qi).invert().clone();
        for (var c = 0; c < ctl.length; c++) { var C = ctl[c]; C.qc = (C.qc || new T.Quaternion()).copy(boxQi).multiply(C.bone.getWorldQuaternion(qc)); }
        for (c = 0; c < ctl.length; c++) {
          var C2 = ctl[c], e = C2.v.rotation; if (!e.x && !e.y && !e.z) continue;
          tq.setFromEuler(e); ql.copy(C2.qc).invert().multiply(tq).multiply(C2.qc); C2.bone.quaternion.multiply(ql);
        }
        var dy = (vb.hip.position.y - hipY) / R0.H; if (dy) hb.position.add(hipUp.set(0, dy, 0).applyMatrix3(hipM3));
      },
      walk: function (ph, amt) { r.ph = ph; r.amt = amt; r.t += 1 / 60; ORDER.forEach(function (k) { vb[k].rotation.set(0, 0, 0); }); vb.hip.position.y = hipY;
        var pr = r.preset; if (pr && amt < 1) { var w = 1 - amt; for (var k in pr) if (vb[k]) vb[k].rotation.set(pr[k][0] * w, pr[k][1] * w, pr[k][2] * w); } },
      bone: function (n) { var k = BY[n]; return k == null ? null : bones[k]; },
      // 머리의 위치와 '몸 기준' 회전 (뼈 고유의 축 방향은 빼고, 쉬는 자세에서 얼마나 돌았는지만)
      headFrame: function (outP, outQ) {
        var k = BY.Head; if (k == null) return false; var hb = bones[k];
        if (!r._hr) { var m = new T.Matrix4().copy(invs[k]).invert(), q0r = new T.Quaternion(), pp = new T.Vector3(), ss = new T.Vector3(); m.decompose(pp, q0r, ss); r._hr = q0r.invert(); }
        hb.getWorldPosition(outP); var hq = hb.getWorldQuaternion(new T.Quaternion()), bq = box.getWorldQuaternion(new T.Quaternion());
        outQ.copy(hq).multiply(r._hr);   // = 상자(몸) 회전 × 머리가 쉬는 자세에서 돈 만큼
        return true;
      },
      handPos: function (side, out) {
        var h = bones[BY[side === "L" ? "LeftHand" : "RightHand"]], f = bones[BY[side === "L" ? "LeftForeArm" : "RightForeArm"]];
        var a2 = h.getWorldPosition(new T.Vector3()), b2 = f.getWorldPosition(new T.Vector3());
        return (out || new T.Vector3()).copy(a2).addScaledVector(a2.clone().sub(b2).normalize(), 0.05 * R0.H);
      } };
    return r;
  };
})();
