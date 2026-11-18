/* Stable-width title scramble, once per document arrival. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;
  root.classList.add('entry-pending');
  var safety = setTimeout(finish, 3000);
  function finish() {
    root.classList.remove('entry-pending', 'entry-playing');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var title = document.querySelector('.hero-word');
    if (!title) { finish(); return; }
    var original = title.textContent;
    var alphabet = 'ABCDEFGHIKLMNORSTUVXYZ';
    var slots = [];
    title.setAttribute('aria-label', original);
    title.textContent = '';
    Array.from(original).forEach(function (letter, index) {
      var slot = document.createElement('i');
      slot.className = 'entry-letter';
      slot.setAttribute('aria-hidden', 'true');
      var base = document.createElement('i');
      base.className = 'entry-letter-base';
      base.textContent = letter === ' ' ? '\u00a0' : letter;
      var ink = document.createElement('i');
      ink.className = 'entry-letter-ink';
      ink.textContent = /[A-Z]/.test(letter) ? alphabet[(index * 7 + 3) % alphabet.length] : letter;
      slot.appendChild(base); slot.appendChild(ink); title.appendChild(slot);
      slots.push({ ink: ink, letter: letter, index: index });
    });
    root.classList.add('entry-playing');
    var start = performance.now(), lastTick = -1;
    function frame(now) {
      var elapsed = now - start;
      if (elapsed >= 1250 || reduced.matches) {
        title.textContent = original;
        title.removeAttribute('aria-label');
        finish(); clearTimeout(safety); return;
      }
      var tick = Math.floor(elapsed / 65);
      if (tick !== lastTick) {
        slots.forEach(function (slot) {
          var settled = elapsed >= 220 + slot.index * 105;
          slot.ink.textContent = settled || !/[A-Z]/.test(slot.letter)
            ? slot.letter : alphabet[(tick * 11 + slot.index * 7) % alphabet.length];
        });
        lastTick = tick;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }, { once: true });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) finish();
  });
}());
