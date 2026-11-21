/* Background music + tactile control SFX.
   Music stays low; knob/fader ticks are deliberately more present. */
(function () {
  'use strict';

  var bgm = document.querySelector('[data-bgm]');
  var toggle = document.querySelector('[data-sound-toggle]');
  var label = document.querySelector('[data-sound-label]');
  var muted = false;
  var started = false;
  var ac = null;
  var lastTick = 0;

  if (bgm) {
    bgm.loop = true;
    bgm.volume = 0.12;
  }

  function context() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') ac.resume().catch(function () {});
    return ac;
  }

  function updateToggle() {
    if (!toggle) return;
    var on = started && !muted;
    toggle.classList.toggle('is-on', on);
    toggle.classList.toggle('is-off', started && muted);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (label) label.textContent = !started ? 'SOUND / READY' : muted ? 'SOUND / OFF' : 'SOUND / ON';
  }

  function playMusic() {
    if (!bgm || muted) return;
    var p = bgm.play();
    if (p && p.catch) p.catch(function () { /* user gesture or file issue */ });
  }

  function startAudio() {
    context();
    started = true;
    muted = false;
    playMusic();
    updateToggle();
  }

  function toggleAudio() {
    if (!started) {
      startAudio();
      return;
    }
    muted = !muted;
    if (muted && bgm) bgm.pause();
    if (!muted) {
      context();
      playMusic();
    }
    updateToggle();
  }

  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleAudio();
    });
  }

  function firstGesture(e) {
    if (!started && !muted) {
      if (e.target && e.target.closest && e.target.closest('[data-sound-toggle]')) return;
      startAudio();
    }
  }
  document.addEventListener('pointerdown', firstGesture, {capture: true, passive: true});
  document.addEventListener('keydown', firstGesture, {capture: true, passive: true});

  updateToggle();

  /* ---------------------------------------------------------------- SFX */
  function blip(freq, gain, duration, type, delay) {
    if (!ac) return;
    var t = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  function tick(kind, value) {
    if (muted) return;
    var now = performance.now();
    if (now - lastTick < 32) return;
    lastTick = now;
    context();
    if (!ac) return;
    var v = Math.max(0, Math.min(1, value == null ? 0.5 : value));

    if (kind === 'knob') {
      // a crisp detent plus a short body thump
      blip(1450 + v * 900, 0.22, 0.035, 'triangle', 0);
      blip(150 + v * 70, 0.11, 0.055, 'sine', 0.006);
    } else if (kind === 'fader') {
      // lower friction tick for a continuous fader
      blip(620 + v * 460, 0.15, 0.026, 'square', 0);
      blip(190 + v * 90, 0.075, 0.045, 'sine', 0.004);
    } else {
      blip(720, 0.13, 0.035, 'triangle', 0);
      blip(410, 0.075, 0.05, 'sine', 0.01);
    }
  }

  document.querySelectorAll('[data-knob]').forEach(function (el) {
    el.addEventListener('knobchange', function (e) {
      var min = parseFloat(el.dataset.min || '0');
      var max = parseFloat(el.dataset.max || '100');
      var p = (e.detail.value - min) / (max - min || 1);
      tick('knob', p);
    });
  });

  document.querySelectorAll('[data-control="duty"]').forEach(function (el) {
    el.addEventListener('input', function () {
      var p = (parseFloat(el.value) - parseFloat(el.min || '0')) / ((parseFloat(el.max || '100') - parseFloat(el.min || '0')) || 1);
      tick('fader', p);
    });
  });

  document.querySelectorAll('[data-timing] input[type=range]').forEach(function (el) {
    el.addEventListener('input', function () {
      tick('fader', parseFloat(el.value) / 16.7);
    });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('button');
    if (!btn || btn.hasAttribute('data-sound-toggle') || btn.hasAttribute('data-knob')) return;
    tick('click', 0.5);
  }, true);
})();
