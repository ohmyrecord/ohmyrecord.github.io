/* 소리: 파일 없이 브라우저가 직접 만들어 내는 효과음. 처음엔 꺼져 있음 (M 키 / 오른쪽 위 버튼) */
(function () {
  "use strict";
  var G = window.G, S = G.snd = { on: false }, ctx = null, master, noiseBuf, sizzleG, ambG;
  function init() {
    if (ctx) return; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    function loop(type, f, q) { var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; var fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; var g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); return g; }
    sizzleG = loop("highpass", 4200, .6); ambG = loop("lowpass", 420, .4);
  }
  S.toggle = function (v) { init(); if (!ctx) return; S.on = v == null ? !S.on : v; if (ctx.state === "suspended") ctx.resume(); master.gain.setTargetAtTime(S.on ? .8 : 0, ctx.currentTime, .05); if (G.ui) G.ui.sound(S.on); };
  function tone(f0, f1, dur, type, vol, delay) { var t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .2, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
  function noise(dur, f, vol, type, delay) { var t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(); s.buffer = noiseBuf; var fl = ctx.createBiquadFilter(); fl.type = type || "bandpass"; fl.frequency.value = f; var g = ctx.createGain(); g.gain.setValueAtTime(vol || .2, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .02); }
  var FX = {
    click: function () { tone(900, 600, .06, "square", .06); },
    good: function () { tone(660, 0, .12, "triangle", .2); tone(990, 0, .22, "triangle", .2, .09); },
    great: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, .22, "triangle", .18, i * .08); }); },
    bad: function () { tone(190, 90, .32, "sawtooth", .16); },
    pick: function () { tone(480, 980, .09, "sine", .2); },
    drop: function () { tone(300, 140, .12, "sine", .2); noise(.1, 900, .12); },
    bump: function () { tone(95, 40, .28, "sine", .5); noise(.18, 240, .35, "lowpass"); },
    bump2: function () { tone(80, 38, .22, "sine", .5); noise(.14, 200, .3, "lowpass"); tone(70, 34, .25, "sine", .45, .16); noise(.14, 180, .28, "lowpass", .16); },
    hit: function () { noise(.16, 700, .3); tone(240, 110, .16, "square", .12); },
    flip: function () { noise(.14, 2600, .16, "highpass"); },
    tick: function () { tone(1300, 0, .04, "square", .05); },
    print: function () { for (var i = 0; i < 5; i++) noise(.05, 3200, .1, "bandpass", i * .06); tone(1200, 0, .08, "sine", .1, .34); },
    burn: function () { noise(.5, 500, .2, "lowpass"); tone(140, 70, .4, "sawtooth", .08); },
    start: function () { tone(440, 0, .12, "triangle", .18); tone(440, 0, .12, "triangle", .18, .3); tone(880, 0, .4, "triangle", .2, .6); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0, .3, "triangle", .18, i * .16); }); }
  };
  S.play = function (n) { if (!ctx || !S.on || !FX[n]) return; try { FX[n](); } catch (e) {} };
  S.sizzle = function (v) { if (sizzleG) sizzleG.gain.setTargetAtTime(v * .05, ctx.currentTime, .15); };
  S.amb = function (v) { if (ambG) ambG.gain.setTargetAtTime(v * .22, ctx.currentTime, .4); };
})();
