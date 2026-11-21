/* Time-Slice Lab — final A1 interactive site.
   Canvas 2D time-slice simulator, 3D panel inspector, draggable frame scrubber.
   No dependencies. All numbers are illustrative teaching parameters. */
(function () {
  'use strict';

  var SPECTRUM = ['#FF5C7A', '#FF9F6E', '#FFE66D', '#8EF0B6', '#5CE1E6', '#6EA8FF', '#A78BFA', '#FF4D9D'];
  var MODES = {
    hold: {label: '普通显示', en: 'SAMPLE & HOLD'},
    global: {label: '全局 BFI', en: 'GLOBAL BFI'},
    scan: {label: '扫描 BFI', en: 'SCANNING BFI'}
  };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function hexA(hex, alpha) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  /* ------------------------------------------------------------------ */
  /* knobs                                                              */
  /* ------------------------------------------------------------------ */
  function initKnob(el) {
    var min = parseFloat(el.dataset.min || '0');
    var max = parseFloat(el.dataset.max || '100');
    var step = parseFloat(el.dataset.step || '1');
    var value = parseFloat(el.dataset.value || (min + max) / 2);
    var dial = el.querySelector('.knob-dial');
    var needle = el.querySelector('.knob-needle');
    var out = el.querySelector('output');
    var dragging = false, startY = 0, startValue = value;

    function format(v) {
      var suffix = el.dataset.suffix || '';
      var decimals = parseInt(el.dataset.decimals || '0', 10);
      return v.toFixed(decimals) + suffix;
    }

    function set(v, silent) {
      v = clamp(Math.round(v / step) * step, min, max);
      value = v;
      el.dataset.value = String(v);
      var p = (v - min) / (max - min);
      el.style.setProperty('--p', (p * 78).toFixed(2) + '%');
      el.style.setProperty('--a', (lerp(-140, 140, p)).toFixed(2) + 'deg');
      if (out) out.textContent = format(v);
      el.setAttribute('aria-valuenow', String(v));
      el.setAttribute('aria-valuetext', format(v));
      if (!silent) el.dispatchEvent(new CustomEvent('knobchange', {detail: {value: v}}));
    }

    el.addEventListener('pointerdown', function (e) {
      dragging = true;
      startY = e.clientY;
      startValue = value;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-turning');
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var span = max - min;
      var dy = startY - e.clientY;
      set(startValue + dy * span / 180);
    });
    el.addEventListener('pointerup', function (e) {
      dragging = false;
      el.classList.remove('is-turning');
      try { el.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(value + step); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(value - step); }
      if (e.key === 'Home') { e.preventDefault(); set(min); }
      if (e.key === 'End') { e.preventDefault(); set(max); }
    });
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'slider');
    el.setAttribute('aria-valuemin', String(min));
    el.setAttribute('aria-valuemax', String(max));
    set(value, true);
    return {el: el, set: set, get: function () { return value; }};
  }

  /* ------------------------------------------------------------------ */
  /* A1 lab                                                             */
  /* ------------------------------------------------------------------ */
  var lab = document.querySelector('[data-lab]');
  if (lab) {
    var simCanvas = lab.querySelector('[data-sim-canvas]');
    var ctx = simCanvas.getContext('2d');
    var w = 0, h = 0, dpr = 1;
    var mode = 'hold';
    var paused = false;
    var elapsed = 0, last = 0, lastUi = 0;

    var knobs = {};
    lab.querySelectorAll('[data-knob]').forEach(function (el) {
      knobs[el.dataset.knob] = initKnob(el);
    });
    var duty = lab.querySelector('[data-control="duty"]');

    function state() {
      var dutyVal = duty ? parseFloat(duty.value) / 100 : 0.45;
      return {
        refresh: knobs.refresh ? knobs.refresh.get() : 240,
        lc: knobs.lc ? knobs.lc.get() : 6,
        zones: knobs.zones ? knobs.zones.get() : 8,
        duty: dutyVal
      };
    }

    function resize() {
      var r = simCanvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      simCanvas.width = Math.round(w * dpr);
      simCanvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function metrics() {
      var s = state();
      var frameMs = 1000 / s.refresh;
      var bfi = mode !== 'hold';
      var holdMs = bfi ? Math.max(1.1, frameMs * s.duty) : frameMs;
      var speed = w / 2.6;
      var lcPart = (s.lc / 12) * w * 0.035;
      var blur = speed * holdMs / 1000 * 5.0 + lcPart;
      if (mode === 'scan') blur *= 0.9;
      var flicker = bfi ? (1 - s.duty) * (mode === 'global' ? 1 : 0.34) : 0.04;
      return {
        s: s, frameMs: frameMs, blur: clamp(blur, 3, w * 0.55),
        brightness: bfi ? s.duty : 1, flicker: flicker, speed: speed
      };
    }

    function updateUi() {
      var m = metrics();
      function setMetric(name, value) {
        var el = lab.querySelector('[data-metric="' + name + '"]');
        if (el) el.textContent = value;
      }
      setMetric('state', MODES[mode].label);
      setMetric('mode-en', MODES[mode].en);
      setMetric('frame', m.frameMs.toFixed(2) + ' ms');
      setMetric('blur', Math.round(m.blur) + ' px');
      setMetric('brightness', Math.round(m.brightness * 100) + '%');
      var flick = lab.querySelector('[data-metric="flicker"]');
      if (flick) {
        var label = m.flicker < 0.18 ? '低' : m.flicker < 0.45 ? '中' : '高';
        flick.textContent = label;
        flick.dataset.level = label;
      }
      var dutyOut = lab.querySelector('[data-out="duty"]');
      if (dutyOut) dutyOut.textContent = Math.round(m.s.duty * 100) + '%';
      var zonesOut = lab.querySelector('[data-metric="zones"]');
      if (zonesOut) zonesOut.textContent = m.s.zones + ' 分区';
    }

    function drawGrid() {
      ctx.save();
      ctx.strokeStyle = 'rgba(242,239,232,0.055)';
      ctx.lineWidth = 1;
      for (var x = 0; x < w; x += 64) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
      for (var y = 0; y < h; y += 52) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      }
      ctx.restore();
    }

    function drawScene(m) {
      var s = m.s;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#020304';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(255,92,122,0.10)';
      ctx.fillRect(0, h * 0.16, w, h * 0.17);
      ctx.fillStyle = 'rgba(255,159,110,0.055)';
      ctx.fillRect(0, h * 0.33, w, h * 0.10);
      ctx.fillStyle = 'rgba(92,225,230,0.08)';
      ctx.fillRect(0, h * 0.56, w, h * 0.16);
      ctx.fillStyle = 'rgba(110,168,255,0.045)';
      ctx.fillRect(0, h * 0.72, w, h * 0.10);
      drawGrid();

      var period = 3.4;
      var u = (elapsed % period) / period;
      var x = w * 0.10 + w * 0.80 * u;
      var blur = m.blur;

      var g = ctx.createLinearGradient(Math.max(0, x - blur), 0, x, 0);
      g.addColorStop(0, 'rgba(5,6,8,0)');
      g.addColorStop(0.25, 'rgba(255,92,122,0.09)');
      g.addColorStop(0.66, 'rgba(92,225,230,0.22)');
      g.addColorStop(1, 'rgba(242,239,232,0.7)');
      ctx.fillStyle = g;
      ctx.fillRect(Math.max(0, x - blur), 0, Math.min(blur, x), h);

      ctx.save();
      for (var i = 1; i <= 6; i++) {
        ctx.globalAlpha = 0.17 - i * 0.023;
        ctx.fillStyle = '#F2EFE8';
        ctx.fillRect(x - blur * (i / 7), 0, 1, h);
      }
      ctx.restore();

      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255,255,255,0.75)';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 1, 0, 2, h);
      ctx.restore();
      ctx.fillStyle = SPECTRUM[(Math.floor(elapsed * 2) + 4) % SPECTRUM.length];
      ctx.fillRect(x + 3, 0, 1, h);

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 11, 16); ctx.lineTo(x - 11, 0); ctx.lineTo(x + 11, 0); ctx.lineTo(x + 11, 16);
      ctx.moveTo(x - 11, h - 16); ctx.lineTo(x - 11, h); ctx.lineTo(x + 11, h); ctx.lineTo(x + 11, h - 16);
      ctx.stroke();
      ctx.restore();

      if (mode === 'global') {
        var on = ((elapsed % 2.8) / 2.8) < s.duty;
        if (!on) {
          ctx.fillStyle = 'rgba(0,0,0,0.95)';
          ctx.fillRect(0, 0, w, h);
        }
      }

      if (mode === 'scan') {
        var bandH = h * (0.16 + (1 - s.duty) * 0.30);
        var bandY = ((elapsed * 0.16) % 1) * (h + bandH) - bandH;
        ctx.fillStyle = 'rgba(0,0,0,0.93)';
        ctx.fillRect(0, bandY, w, bandH);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,178,122,0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, bandY); ctx.lineTo(w, bandY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, bandY + bandH); ctx.lineTo(w, bandY + bandH); ctx.stroke();
        ctx.strokeStyle = 'rgba(242,239,232,0.13)';
        for (var z = 1; z < s.zones; z++) {
          var zy = (h / s.zones) * z;
          ctx.beginPath(); ctx.moveTo(0, zy + 0.5); ctx.lineTo(w, zy + 0.5); ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#fff';
      for (var sy = 0; sy < h; sy += 4) ctx.fillRect(0, sy, w, 1);
      ctx.restore();
    }

    function setMode(next) {
      if (!MODES[next]) return;
      mode = next;
      lab.dataset.mode = next;
      lab.querySelectorAll('[data-set-mode]').forEach(function (b) {
        var on = b.dataset.setMode === next;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      updateUi();
    }

    lab.querySelectorAll('[data-set-mode]').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.dataset.setMode); });
    });

    lab.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.dataset.preset;
        if (p === 'hold60') {
          knobs.refresh.set(60); knobs.lc.set(6); knobs.zones.set(8); duty.value = 45; setMode('hold');
        } else if (p === 'global240') {
          knobs.refresh.set(240); knobs.lc.set(6); knobs.zones.set(8); duty.value = 45; setMode('global');
        } else if (p === 'scan240') {
          knobs.refresh.set(240); knobs.lc.set(6); knobs.zones.set(8); duty.value = 45; setMode('scan');
        } else if (p === 'scan360') {
          knobs.refresh.set(360); knobs.lc.set(3); knobs.zones.set(16); duty.value = 55; setMode('scan');
        }
        updateUi();
      });
    });

    if (duty) {
      duty.addEventListener('input', updateUi);
      var dutyOut = lab.querySelector('[data-out="duty"]');
      if (dutyOut) dutyOut.textContent = duty.value + '%';
    }
    lab.querySelectorAll('[data-knob]').forEach(function (el) {
      el.addEventListener('knobchange', updateUi);
    });

    var pause = lab.querySelector('[data-pause]');
    if (pause) {
      pause.addEventListener('click', function () {
        paused = !paused;
        pause.textContent = paused ? '继续' : '暂停';
        pause.setAttribute('aria-pressed', paused ? 'true' : 'false');
      });
    }

    if (window.ResizeObserver) new ResizeObserver(resize).observe(simCanvas);
    else window.addEventListener('resize', resize);

    resize(); setMode('hold'); updateUi();

    function frame(now) {
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused) elapsed += dt;
      var m = metrics();
      drawScene(m);
      if (now - lastUi > 90) { updateUi(); lastUi = now; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* 3D stack inspector                                                 */
  /* ------------------------------------------------------------------ */
  var orbitCanvas = document.querySelector('[data-orbit]');
  if (orbitCanvas) {
    var octx = orbitCanvas.getContext('2d');
    var ow = 0, oh = 0, odpr = 1;
    var yaw = -0.62, pitch = 0.28, zoom = 1.0;
    var drag = false, lastX = 0, lastY = 0;
    var autoRotate = true;
    var explode = 0;
    var layers = {backlight: true, lc: true, glass: true};
    var oTime = 0;

    function resizeOrbit() {
      var r = orbitCanvas.getBoundingClientRect();
      odpr = Math.min(window.devicePixelRatio || 1, 2);
      ow = Math.max(1, r.width);
      oh = Math.max(1, r.height);
      orbitCanvas.width = Math.round(ow * odpr);
      orbitCanvas.height = Math.round(oh * odpr);
      octx.setTransform(odpr, 0, 0, odpr, 0, 0);
    }

    function project(p) {
      var x = p[0], y = p[1], z = p[2];
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var cx = Math.cos(pitch), sx = Math.sin(pitch);
      var x1 = x * cy - z * sy;
      var z1 = x * sy + z * cy;
      var y1 = y * cx - z1 * sx;
      var z2 = y * sx + z1 * cx;
      var fov = 4.2;
      var fit = 1 - explode * 0.55;
      var sc = (fov / (fov + z2)) * zoom * fit * Math.min(ow, oh) * 0.39;
      return [ow / 2 + x1 * sc, oh / 2 - oh * 0.05 * explode + y1 * sc, z2];
    }

    function poly(points, fill, stroke, alpha) {
      var pts = points.map(project);
      octx.beginPath();
      pts.forEach(function (p, i) { if (i === 0) octx.moveTo(p[0], p[1]); else octx.lineTo(p[0], p[1]); });
      octx.closePath();
      if (fill) { octx.fillStyle = fill; octx.globalAlpha = alpha == null ? 1 : alpha; octx.fill(); }
      if (stroke) { octx.strokeStyle = stroke; octx.lineWidth = 1; octx.stroke(); }
      octx.globalAlpha = 1;
    }

    function line3(a, b, color, width, dash) {
      var pa = project(a), pb = project(b);
      octx.save();
      octx.strokeStyle = color;
      octx.lineWidth = width || 1;
      if (dash) octx.setLineDash(dash);
      octx.beginPath(); octx.moveTo(pa[0], pa[1]); octx.lineTo(pb[0], pb[1]); octx.stroke();
      octx.restore();
    }

    function layerZ(base) {
      return base < 0 ? base - explode * 0.95 : base + explode * 0.78;
    }

    function drawOrbit() {
      octx.clearRect(0, 0, ow, oh);
      var bg = octx.createRadialGradient(ow * 0.56, oh * 0.4, 10, ow * 0.56, oh * 0.4, Math.max(ow, oh) * 0.65);
      bg.addColorStop(0, 'rgba(21,33,39,0.55)');
      bg.addColorStop(0.55, 'rgba(7,9,12,0.5)');
      bg.addColorStop(1, 'rgba(2,3,4,0)');
      octx.fillStyle = bg;
      octx.fillRect(0, 0, ow, oh);

      // faint floor grid
      var step = 0.24;
      for (var gy = -1.2; gy <= 1.2; gy += step) {
        line3([-1.5, gy, -1.1], [1.5, gy, -1.1], 'rgba(242,239,232,0.045)', 1);
      }
      for (var gx = -1.2; gx <= 1.2; gx += step) {
        line3([gx, -1.2, -1.1], [gx, 1.2, -1.1], 'rgba(242,239,232,0.045)', 1);
      }

      var zBack = -1.0, zDiff = -0.55, zLC = 0, zGlass = 0.55;
      var ezBack = layerZ(zBack), ezDiff = layerZ(zDiff), ezLC = layerZ(zLC), ezGlass = layerZ(zGlass);

      if (layers.backlight) {
        // backlight board
        poly([[-1.25, -0.82, ezBack], [1.25, -0.82, ezBack], [1.25, 0.82, ezBack], [-1.25, 0.82, ezBack]],
          'rgba(8,12,16,0.84)', 'rgba(178,255,232,0.35)', 0.9);
        // zones
        var zones = knobs.zones ? knobs.zones.get() : 8;
        var dutyNow = duty ? parseFloat(duty.value) / 100 : 0.45;
        var bandH = (1.64 / zones) * (1 + (1 - dutyNow) * 1.1);
        var by = -0.82 + ((oTime * 0.30) % 1) * (1.64 + bandH) - bandH;
        for (var i = 0; i < zones; i++) {
          var y0 = -0.82 + (1.64 / zones) * i;
          var y1 = -0.82 + (1.64 / zones) * (i + 1) - 0.012;
          var dark = (y1 > by && y0 < by + bandH);
          var c = SPECTRUM[i % SPECTRUM.length];
          if (dark) {
            poly([[-1.12, y0, ezBack + 0.01], [1.12, y0, ezBack + 0.01], [1.12, y1, ezBack + 0.01], [-1.12, y1, ezBack + 0.01]],
              'rgba(1,2,3,0.94)', 'rgba(255,178,122,0.35)', 0.95);
          } else {
            octx.save();
            octx.shadowBlur = 16;
            octx.shadowColor = c;
            poly([[-1.12, y0, ezBack + 0.01], [1.12, y0, ezBack + 0.01], [1.12, y1, ezBack + 0.01], [-1.12, y1, ezBack + 0.01]],
              hexA(c, 0.72), 'rgba(255,255,255,0.2)', 0.9);
            octx.restore();
          }
        }
        // frame
        poly([[-1.25, -0.82, ezBack], [1.25, -0.82, ezBack], [1.25, 0.82, ezBack], [-1.25, 0.82, ezBack]],
          null, 'rgba(178,255,232,0.55)', 1);
      }

      if (layers.lc) {
        poly([[-1.2, -0.78, ezDiff], [1.2, -0.78, ezDiff], [1.2, 0.78, ezDiff], [-1.2, 0.78, ezDiff]],
          'rgba(71,120,138,0.10)', 'rgba(99,230,226,0.25)', 0.9);
        // LC wave surface
        var pts = [];
        for (var t = -1.1; t <= 1.1; t += 0.08) {
          pts.push([t, 0.10 * Math.sin(t * 4.5 + oTime * 2.1), ezLC]);
        }
        octx.beginPath();
        pts.forEach(function (p, idx) { var q = project(p); if (!idx) octx.moveTo(q[0], q[1]); else octx.lineTo(q[0], q[1]); });
        octx.strokeStyle = 'rgba(99,230,226,0.72)';
        octx.lineWidth = 1.3;
        octx.stroke();
        // LC plane grid
        for (var lx = -1.0; lx <= 1.0; lx += 0.25) line3([lx, -0.74, ezLC], [lx, 0.74, ezLC], 'rgba(99,230,226,0.10)', 1);
        for (var ly = -0.6; ly <= 0.6; ly += 0.3) line3([-1.1, ly, ezLC], [1.1, ly, ezLC], 'rgba(99,230,226,0.10)', 1);
      }

      if (layers.glass) {
        poly([[-1.15, -0.74, ezGlass], [1.15, -0.74, ezGlass], [1.15, 0.74, ezGlass], [-1.15, 0.74, ezGlass]],
          'rgba(255,255,255,0.022)', 'rgba(242,239,232,0.42)', 0.9);
        line3([-1.0, 0.66, ezGlass + 0.01], [-0.35, 0.7, ezGlass + 0.01], 'rgba(255,255,255,0.22)', 2);
        line3([0.55, -0.66, ezGlass + 0.01], [1.0, -0.62, ezGlass + 0.01], 'rgba(255,255,255,0.16)', 1);
      }

      // exploded axis
      if (explode > 0.02) {
        line3([0, 0, ezBack], [0, 0, ezGlass], 'rgba(255,178,122,0.35)', 1, [3, 5]);
        line3([-1.25, 0.9, ezBack], [-1.25, 0.9, ezGlass], 'rgba(255,178,122,0.22)', 1, [2, 5]);
      }

      // little corner marks
      octx.strokeStyle = 'rgba(242,239,232,0.25)';
      octx.lineWidth = 1;
      octx.beginPath(); octx.moveTo(22, 44); octx.lineTo(22, 22); octx.lineTo(44, 22); octx.stroke();
      octx.beginPath(); octx.moveTo(ow - 22, oh - 44); octx.lineTo(ow - 22, oh - 22); octx.lineTo(ow - 44, oh - 22); octx.stroke();
    }

    function orbitLoop(now) {
      if (!oTime) oTime = now / 1000;
      var dt = Math.min(0.05, (now / 1000 - oTime));
      oTime = now / 1000;
      if (autoRotate && !drag) yaw += dt * 0.14;
      drawOrbit();
      requestAnimationFrame(orbitLoop);
    }

    orbitCanvas.addEventListener('pointerdown', function (e) {
      drag = true; lastX = e.clientX; lastY = e.clientY;
      orbitCanvas.setPointerCapture(e.pointerId);
      orbitCanvas.classList.add('is-dragging');
    });
    orbitCanvas.addEventListener('pointermove', function (e) {
      if (!drag) return;
      yaw += (e.clientX - lastX) * 0.008;
      pitch = clamp(pitch + (e.clientY - lastY) * 0.005, -0.5, 0.7);
      lastX = e.clientX; lastY = e.clientY;
    });
    orbitCanvas.addEventListener('pointerup', function (e) {
      drag = false;
      orbitCanvas.classList.remove('is-dragging');
      try { orbitCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    orbitCanvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoom = clamp(zoom - e.deltaY * 0.0008, 0.7, 1.7);
    }, {passive: false});

    var explodeInput = document.querySelector('[data-explode]');
    var explodeOut = document.querySelector('[data-explode-out]');
    if (explodeInput) {
      explodeInput.addEventListener('input', function () {
        explode = parseFloat(explodeInput.value) / 100;
        if (explodeOut) explodeOut.textContent = explodeInput.value + '%';
      });
    }
    document.querySelectorAll('[data-layer]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.dataset.layer;
        layers[key] = !layers[key];
        b.classList.toggle('is-on', layers[key]);
        b.setAttribute('aria-pressed', layers[key] ? 'true' : 'false');
      });
    });
    var reset = document.querySelector('[data-reset-view]');
    if (reset) reset.addEventListener('click', function () { yaw = -0.62; pitch = 0.28; zoom = 1; });
    var autoBtn = document.querySelector('[data-auto-view]');
    if (autoBtn) {
      autoBtn.addEventListener('click', function () {
        autoRotate = !autoRotate;
        autoBtn.classList.toggle('is-on', autoRotate);
        autoBtn.setAttribute('aria-pressed', autoRotate ? 'true' : 'false');
      });
    }
    if (window.ResizeObserver) new ResizeObserver(resizeOrbit).observe(orbitCanvas);
    else window.addEventListener('resize', resizeOrbit);
    resizeOrbit();
    requestAnimationFrame(orbitLoop);
  }

  /* ------------------------------------------------------------------ */
  /* frame scrubber                                                     */
  /* ------------------------------------------------------------------ */
  var timing = document.querySelector('[data-timing]');
  if (timing) {
    var svg = timing.querySelector('svg');
    var input = timing.querySelector('input[type=range]');
    var play = timing.querySelector('[data-playhead]');
    var readout = timing.querySelector('[data-time-readout]');
    var focus = timing.querySelector('[data-time-focus]');
    var note = timing.querySelector('[data-time-note]');
    var X0 = 90, X1 = 1110;
    function paintTiming() {
      var v = parseFloat(input.value);
      var x = X0 + (v / 16.7) * (X1 - X0);
      play.setAttribute('transform', 'translate(' + x.toFixed(1) + ' 0)');
      if (readout) readout.textContent = v.toFixed(1) + ' ms';
      if (focus) {
        var isOverlap = v >= 3.2 && v <= 9.4;
        focus.textContent = isOverlap ? '光落在液晶翻转中间' : v < 3.2 ? '液晶还在翻转' : '像素已经站稳';
        if (note) {
          note.textContent = isOverlap
            ? '液晶正在从旧灰度翻到新灰度，边缘被拉出一段拖影。'
            : v < 3.2
              ? '背光已经亮了，但像素还没站稳；你看到的是上一帧的余影。'
              : '液晶已经站稳；如果这时背光仍亮，这一帧就会干净。';
        }
      }
    }
    if (input) {
      input.addEventListener('input', paintTiming);
      paintTiming();
    }
    if (svg) {
      svg.addEventListener('pointerdown', function (e) {
        var r = svg.getBoundingClientRect();
        var ratio = clamp((e.clientX - r.left) / r.width, 0, 1);
        input.value = String(ratio * 16.7);
        input.dispatchEvent(new Event('input', {bubbles: true}));
      });
    }
  }
})();
