(function () {
  'use strict';
  var stage = document.querySelector('.crowd-slides');
  if (!stage) return;
  var slides = Array.from(stage.querySelectorAll('img'));
  var buttons = Array.from(document.querySelectorAll('[data-crowd]'));
  var names = ['혼잡', '보통', '여유'];
  var request = 0, active = 0, frame = 0;
  var weights = [1, 0, 0];
  function paint() {
    // Convert blend weights to stacked alpha: no dark flash or third-photo ghost.
    var sum = 0;
    slides.forEach(function (img, i) {
      sum += weights[i];
      img.style.opacity = i === 0 ? 1 : (sum > 0 ? weights[i] / sum : 0);
    });
  }
  function dissolve(index) {
    cancelAnimationFrame(frame);
    var from = weights.slice(), start = performance.now();
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function animate(now) {
      var t = reduced ? 1 : Math.min(1, (now - start) / 650);
      var ease = t * t * (3 - 2 * t);
      weights = from.map(function (value, i) { return value + ((i === index ? 1 : 0) - value) * ease; });
      paint();
      if (t < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
  }
  paint();
  var ready = slides.map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  });
  function select(index) {
    var ticket = ++request;
    ready[index].then(function () {
      if (ticket !== request || !slides[index].complete || !slides[index].naturalWidth) return;
      if (active === index) return;
      active = index;
      dissolve(index);
      slides.forEach(function (img, i) { img.classList.toggle('is-active', i === index); });
      buttons.forEach(function (button) {
        var selected = Number(button.dataset.crowd) === index;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      stage.setAttribute('aria-label', names[index] + ' 상태에서 혼잡도 정보를 공유하는 기기들');
    });
  }
  buttons.forEach(function (button) {
    var index = Number(button.dataset.crowd);
    button.addEventListener('pointerenter', function (event) {
      if (event.pointerType !== 'touch') select(index);
    });
    button.addEventListener('focus', function () { select(index); });
    button.addEventListener('click', function () { select(index); });
  });
}());
