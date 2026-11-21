/* Six application objects, drawn as inspectable procedural 3D on Canvas 2D.
   Generic product forms, no brand assets. Drag to orbit, wheel to zoom. */
(function () {
  'use strict';

  var root = document.querySelector('[data-app3d]');
  if (!root) return;
  var canvas = root.querySelector('[data-app-canvas]');
  var ctx = canvas.getContext('2d');
  var buttons = [].slice.call(root.querySelectorAll('[data-app]'));
  var autoBtn = root.querySelector('[data-app-auto]');
  var resetBtn = root.querySelector('[data-app-reset]');
  var label = root.querySelector('[data-app-label]');
  var desc = root.querySelector('[data-app-desc]');
  var code = root.querySelector('[data-app-code]');

  var DATA = {
    ar: {cn: 'AR 眼镜', en: 'NEAR-EYE', desc: '近眼显示里，运动边缘与双眼视差一起决定佩戴舒适度。'},
    hud: {cn: '车载 HUD', en: 'AUTOMOTIVE', desc: '信息投到挡风玻璃上，远处路面与近处读数必须同时清楚。'},
    medical: {cn: '医疗内窥', en: 'MEDICAL', desc: '镜头在体内移动，组织边缘需要稳定、低延迟地呈现。'},
    aviation: {cn: '航空座舱', en: 'AVIATION', desc: '姿态与航迹在快速机动中不能拖尾，读数必须一眼可辨。'},
    industry: {cn: '工业检测', en: 'INDUSTRY', desc: '传送带上的高速工件经过相机，缺陷边缘要在运动中看清。'},
    replay: {cn: '赛事回放', en: 'REPLAY', desc: '高速运动的轨迹被拆成可读的帧，慢放时才看得懂。'}
  };
  var keys = Object.keys(DATA);
  var active = 'ar';
  var thumbs = [].slice.call(root.querySelectorAll('[data-app-thumb]'));

  var w = 0, h = 0, dpr = 1;
  var yaw = -0.85, pitch = 0.23, zoom = 1;
  var auto = true, drag = false, lastX = 0, lastY = 0;
  var thumbMode = false;
  var time = 0;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(p) {
    var x = p[0], y = p[1], z = p[2];
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var cx = Math.cos(pitch), sx = Math.sin(pitch);
    var x1 = x * cy - z * sy;
    var z1 = x * sy + z * cy;
    var y1 = y * cx - z1 * sx;
    var z2 = y * sx + z1 * cx;
    var fov = 4.4;
    var smallView = (w < 500 && !thumbMode) ? 0.78 : 1;
    var sc = (fov / (fov + z2)) * zoom * smallView * Math.min(w, h) * 0.46;
    return [w / 2 + x1 * sc, h / 2 - y1 * sc, z2];
  }

  function face(S, pts, fill, stroke, glow, alpha) {
    S.faces.push({pts: pts, fill: fill, stroke: stroke, glow: glow, alpha: alpha == null ? 1 : alpha});
  }

  function parseColor(c) {
    if (!c) return null;
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    }
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var v = m[1].split(',').map(function (x) { return parseFloat(x.trim()); });
    return [v[0] || 0, v[1] || 0, v[2] || 0, v.length > 3 ? v[3] : 1];
  }

  function shade(c, factor) {
    var p = parseColor(c);
    if (!p) return c;
    var r = Math.max(0, Math.min(255, Math.round(p[0] * factor)));
    var g = Math.max(0, Math.min(255, Math.round(p[1] * factor)));
    var b = Math.max(0, Math.min(255, Math.round(p[2] * factor)));
    return 'rgba(' + r + ',' + g + ',' + b + ',' + p[3] + ')';
  }

  function normalOf(pts) {
    if (pts.length < 3) return [0, 0, 1];
    var a = pts[0], b = pts[1], c = pts[2];
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return [nx / len, ny / len, nz / len];
  }

  function faceLight(pts) {
    var n = normalOf(pts);
    var l = [-0.42, 0.72, 0.55];
    var len = Math.sqrt(l[0] * l[0] + l[1] * l[1] + l[2] * l[2]);
    var dot = Math.abs(n[0] * l[0] / len + n[1] * l[1] / len + n[2] * l[2] / len);
    return 0.5 + Math.pow(dot, 0.82) * 0.62;
  }

  function line(S, a, b, color, width, glow, dash) {
    S.lines.push({a: a, b: b, color: color, width: width || 1, glow: glow || null, dash: dash || null});
  }

  function floorLine(S, a, b, color, width) {
    S.floor.push({a: a, b: b, color: color, width: width || 1});
  }

  function text(S, p, str, color, size, align) {
    S.texts.push({p: p, str: str, color: color || '#f2efe8', size: size || 12, align: align || 'center'});
  }

  function box(S, cx, cy, cz, sx, sy, sz, fill, stroke, glow) {
    var x0 = cx - sx / 2, x1 = cx + sx / 2;
    var y0 = cy - sy / 2, y1 = cy + sy / 2;
    var z0 = cz - sz / 2, z1 = cz + sz / 2;
    var v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
    var f = [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]];
    var edge = glow ? stroke : shade(stroke || 'rgba(0,0,0,.65)', 0.42);
    for (var i = 0; i < f.length; i++) {
      var pts = f[i].map(function (n) { return v[n]; });
      face(S, pts, fill, edge, glow, 1);
    }
    // Glowing devices keep an emissive rim. Solid bodies rely on shaded faces,
    // otherwise every back edge draws through the surface and reads as wireframe.
    if (glow) {
      for (var j = 0; j < 4; j++) {
        line(S, v[j], v[(j + 1) % 4], edge, 1);
        line(S, v[j + 4], v[(j + 1) % 4 + 4], edge, 1);
        line(S, v[j], v[j + 4], edge, 1);
      }
    } else {
      line(S, v[3], v[2], 'rgba(255,255,255,.10)', 1);
      line(S, v[7], v[6], 'rgba(255,255,255,.07)', 1);
    }
  }

  function disc(S, cx, cy, cz, r, fill, stroke, glow, seg) {
    var n = seg || 40, pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
    }
    face(S, pts, fill, stroke, glow, 0.95);
  }

  function halfDisc(S, cx, cy, cz, r, from, to, fill, stroke, glow) {
    var n = 32, pts = [];
    for (var i = 0; i <= n; i++) {
      var a = from + (to - from) * (i / n);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz]);
    }
    pts.push([cx, cy, cz]);
    face(S, pts, fill, stroke, glow, 0.96);
  }

  function ring3(S, cx, cy, cz, r, color, width, glow, rot) {
    var n = 44, prev = null;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var x = Math.cos(a) * r, y = Math.sin(a) * r;
      var p = [cx + x * Math.cos(rot || 0), cy + y, cz + x * Math.sin(rot || 0)];
      if (prev) line(S, prev, p, color, width || 1, glow);
      prev = p;
    }
  }

  function gridFloor(S) {
    for (var i = -6; i <= 6; i++) {
      floorLine(S, [i * 0.28, -0.92, -1.2], [i * 0.28, -0.92, 1.1], 'rgba(242,239,232,.045)', 1);
    }
    for (var j = -4; j <= 4; j++) {
      floorLine(S, [-1.7, -0.92, j * 0.28], [1.7, -0.92, j * 0.28], 'rgba(242,239,232,.045)', 1);
    }
  }

  function glowEdge(S, a, b, color, width) {
    line(S, a, b, color, width, color);
  }

  /* ----------------------------- models ----------------------------- */
  function ar(S) {
    // two lens frames
    box(S, -0.6, 0.08, 0, 0.66, 0.42, 0.11, '#7c8e95', 'rgba(99,230,226,.82)', 'rgba(99,230,226,.7)');
    box(S, 0.6, 0.08, 0, 0.66, 0.42, 0.11, '#7c8e95', 'rgba(99,230,226,.82)', 'rgba(99,230,226,.7)');
    // inner lenses: smoked glass with a real reflection
    face(S, [[-0.8,-0.06,-.062],[ -0.4,-0.06,-.062],[-0.4,0.22,-.062],[-0.8,0.22,-.062]], 'rgba(10,32,38,.94)', 'rgba(242,239,232,.5)', 'rgba(99,230,226,.15)', 1);
    face(S, [[0.4,-0.06,-.062],[0.8,-0.06,-.062],[0.8,0.22,-.062],[0.4,0.22,-.062]], 'rgba(10,32,38,.94)', 'rgba(242,239,232,.5)', 'rgba(99,230,226,.15)', 1);
    line(S, [-0.75, 0.16, -.055], [-0.47, 0.16, -.055], 'rgba(255,255,255,.7)', 2);
    line(S, [0.47, 0.16, -.055], [0.75, 0.16, -.055], 'rgba(255,255,255,.55)', 1.3);
    // bridge + hinge
    box(S, 0, 0.12, 0.02, 0.24, 0.06, 0.08, '#6d8087', 'rgba(242,239,232,.5)');
    box(S, -0.9, 0.12, 0, 0.06, 0.1, 0.08, '#6d8087', 'rgba(242,239,232,.5)');
    box(S, 0.9, 0.12, 0, 0.06, 0.1, 0.08, '#6d8087', 'rgba(242,239,232,.5)');
    // nose pads + temples — brushed metal with a specular edge
    disc(S, -0.18, -0.13, 0.085, 0.026, 'rgba(215,226,225,.9)', null, 'rgba(99,230,226,.3)', 12);
    disc(S, 0.18, -0.13, 0.085, 0.026, 'rgba(215,226,225,.9)', null, 'rgba(99,230,226,.3)', 12);
    line(S, [-0.93, 0.12, 0], [-1.42, 0.16, -0.72], 'rgba(150,168,173,.98)', 5, 'rgba(200,220,226,.25)');
    line(S, [0.93, 0.12, 0], [1.42, 0.16, -0.72], 'rgba(150,168,173,.98)', 5, 'rgba(200,220,226,.25)');
    line(S, [-0.93, 0.17, 0], [-1.42, 0.21, -0.72], 'rgba(240,247,244,.7)', 1.2);
    line(S, [0.93, 0.17, 0], [1.42, 0.21, -0.72], 'rgba(240,247,244,.7)', 1.2);
    // camera dot + light
    disc(S, 0, 0.32, 0.09, 0.035, 'rgba(255,178,122,.9)', null, 'rgba(255,178,122,.8)', 20);
    line(S, [0, 0.32, 0.09], [0, 0.48, 0.32], 'rgba(255,178,122,.35)', 1);
    // lens motion accents
    line(S, [-0.78, 0.08, 0.06], [-0.38, 0.08, 0.06], 'rgba(99,230,226,.65)', 2, 'rgba(99,230,226,.65)');
    line(S, [0.38, 0.08, 0.06], [0.78, 0.08, 0.06], 'rgba(99,230,226,.65)', 2, 'rgba(99,230,226,.65)');
  }

  function hud(S) {
    box(S, 0, -0.64, 0.05, 2.25, 0.16, 0.78, '#304049', 'rgba(195,211,214,.55)');
    box(S, 0, -0.5, 0.05, 2.0, 0.08, 0.6, '#43565e', 'rgba(99,230,226,.32)');
    // windshield — glass with a soft cyan reflection
    face(S, [[-1.15,-0.35,.74],[1.15,-0.35,.74],[0.86,0.7,.46],[-0.86,0.7,.46]], 'rgba(82,177,190,.14)', 'rgba(99,230,226,.55)', 'rgba(99,230,226,.25)', 1);
    line(S, [-0.95,-0.2,.7], [-0.28,-0.05,.7], 'rgba(255,255,255,.32)', 2);
    // projected reticle
    var z = 0.22;
    face(S, [[-0.25,0.05,z],[0.25,0.05,z],[0.25,0.37,z],[-0.25,0.37,z]], 'rgba(255,178,122,.03)', 'rgba(255,178,122,.55)', 'rgba(255,178,122,.5)', 0.95);
    line(S, [-0.25,0.2,z],[-0.1,0.2,z],'rgba(255,178,122,.85)',1.5);
    line(S, [0.1,0.2,z],[0.25,0.2,z],'rgba(255,178,122,.85)',1.5);
    line(S, [0,0.1,z],[0,0.32,z],'rgba(255,178,122,.55)',1);
    text(S, [0,0.24,z], '88', 'rgba(255,178,122,.95)', 16, 'center');
    // road strips
    for (var i = 0; i < 4; i++) {
      var yy = -0.93, zz = -0.1 - i * 0.32;
      line(S, [-0.08, yy, zz], [0.08, yy, zz], 'rgba(242,239,232,.45)', 3);
      line(S, [-1.05, yy, zz], [-0.82, yy, zz], 'rgba(242,239,232,.14)', 1);
      line(S, [0.82, yy, zz], [1.05, yy, zz], 'rgba(242,239,232,.14)', 1);
    }
    line(S, [-0.2,-0.35,0.74],[0.2,-0.35,0.74],'rgba(255,255,255,.75)',1.5,'rgba(255,255,255,.3)');
  }

  function medical(S) {
    // tissue surface: a subtle 3D mesh
    for (var i = -3; i <= 3; i++) {
      var pts = [];
      for (var j = -2; j <= 2; j++) {
        pts.push([i * 0.28, -0.45 + 0.04 * Math.sin(i * 0.7 + j), j * 0.26 - 0.1]);
      }
      for (var k = 0; k < pts.length - 1; k++) line(S, pts[k], pts[k + 1], 'rgba(255,178,122,.16)', 1);
    }
    for (var j2 = -2; j2 <= 2; j2++) {
      var pts2 = [];
      for (var i2 = -3; i2 <= 3; i2++) pts2.push([i2 * 0.28, -0.45 + 0.04 * Math.sin(i2 * 0.7 + j2), j2 * 0.26 - 0.1]);
      for (var k2 = 0; k2 < pts2.length - 1; k2++) line(S, pts2[k2], pts2[k2 + 1], 'rgba(255,178,122,.12)', 1);
    }
    // insertion tube
    var tube = [[-1.4, 0.6, -0.8], [-0.85, 0.35, -0.5], [-0.2, 0.1, -0.15], [0.36, -0.12, 0.2], [0.72, -0.25, 0.45]];
    for (var t = 0; t < tube.length - 1; t++) {
      line(S, tube[t], tube[t + 1], 'rgba(114,133,136,.95)', 14, 'rgba(99,230,226,.15)');
      line(S, tube[t], tube[t + 1], 'rgba(205,216,212,.92)', 9);
      line(S, tube[t], tube[t + 1], 'rgba(255,255,255,.5)', 2);
      line(S, tube[t], tube[t + 1], 'rgba(99,230,226,.4)', 1, 'rgba(99,230,226,.55)');
    }
    for (var r = 0; r < tube.length; r++) {
      var p = tube[r];
      ring3(S, p[0], p[1], p[2], 0.075, 'rgba(242,239,232,.4)', 1.3, null, 0.4);
    }
    // head + lens
    box(S, 0.72, -0.25, 0.45, 0.2, 0.14, 0.16, '#3a4c54', 'rgba(242,239,232,.68)');
    disc(S, 0.72, -0.25, 0.54, 0.055, 'rgba(242,239,232,.15)', 'rgba(255,255,255,.8)', 'rgba(99,230,226,.9)', 24);
    // light cone
    face(S, [[0.72,-0.25,0.54],[0.72,-0.55,-0.05],[0.72,-0.55,0.85]], 'rgba(255,178,122,.045)', 'rgba(255,178,122,.18)', 'rgba(255,178,122,.2)', 0.8);
    text(S, [0.72,-0.42,0.35], 'LENS', 'rgba(255,178,122,.7)', 9, 'center');
  }

  function aviation(S) {
    box(S, 0, 0.1, -0.22, 2.2, 1.3, 0.2, '#1a262c', 'rgba(174,190,194,.45)');
    box(S, 0, -0.15, 0.02, 2.0, 0.25, 0.24, '#2c3d44', 'rgba(174,190,194,.35)');
    // attitude display
    var cx = 0, cy = 0.28, cz = -0.1, r = 0.52;
    disc(S, cx, cy, cz, r, '#020507', 'rgba(180,195,198,.6)', 'rgba(99,230,226,.35)', 48);
    ring3(S, cx, cy, cz + 0.01, r * 1.03, 'rgba(157,174,178,.75)', 1.6, 'rgba(110,145,150,.35)');
    halfDisc(S, cx, cy, cz + 0.01, r * 0.92, 0, Math.PI, 'rgba(42,143,158,.32)', 'rgba(99,230,226,.28)', null);
    halfDisc(S, cx, cy, cz + 0.01, r * 0.92, Math.PI, Math.PI * 2, 'rgba(178,98,53,.30)', 'rgba(255,178,122,.25)', null);
    line(S, [cx - r * .86, cy, cz + .02], [cx + r * .86, cy, cz + .02], 'rgba(242,239,232,.85)', 1.5);
    for (var i = -2; i <= 2; i++) {
      if (!i) continue;
      line(S, [cx - 0.18, cy + i * 0.12, cz + .02], [cx + 0.18, cy + i * 0.12, cz + .02], 'rgba(242,239,232,.32)', 1);
    }
    line(S, [cx, cy, cz + .02], [cx - .1, cy - .08, cz + .02], 'rgba(255,178,122,.9)', 2);
    line(S, [cx, cy, cz + .02], [cx + .1, cy - .08, cz + .02], 'rgba(255,178,122,.9)', 2);
    line(S, [cx, cy, cz + .02], [cx, cy + .15, cz + .02], 'rgba(242,239,232,.75)', 1);
    // side displays
    box(S, -0.78, 0.26, -0.09, 0.4, 0.28, 0.04, '#1c3d44', 'rgba(99,230,226,.55)');
    box(S, 0.78, 0.26, -0.09, 0.4, 0.28, 0.04, '#4d3522', 'rgba(255,178,122,.55)');
    for (var g = 0; g < 3; g++) {
      line(S, [-0.92 + g * .1, 0.2, -0.05], [-0.92 + g * .1, 0.32, -0.05], 'rgba(99,230,226,.6)', 1);
      line(S, [0.68 + g * .1, 0.2, -0.05], [0.68 + g * .1, 0.32, -0.05], 'rgba(255,178,122,.55)', 1);
    }
    // glare
    line(S, [-0.9, 0.7, 0.03], [0.2, 0.35, 0.03], 'rgba(255,255,255,.18)', 2);
  }

  function industry(S) {
    // conveyor
    box(S, 0, -0.58, -0.1, 2.3, 0.16, 0.72, '#3b494f', 'rgba(188,203,206,.45)');
    for (var i = 0; i < 6; i++) {
      box(S, -1.0 + i * .4, -0.47, 0.2, 0.2, 0.03, 0.06, '#59666b', 'rgba(230,238,237,.4)');
    }
    // parts
    for (var p = 0; p < 3; p++) {
      var x = -0.65 + p * 0.78 + Math.sin(time * 0.5 + p) * .08;
      box(S, x, -0.35, 0.02, .34, .14, .2, '#8a4b2e', 'rgba(255,190,132,.65)');
      if (p === 1) {
        box(S, x + .04, -0.31, .13, .06, .04, .01, '#ff5c7a', null, 'rgba(255,92,122,.8)');
      }
    }
    // gantry — anodized metal, not a wire
    line(S, [0.8, -0.5, -0.2], [0.8, 0.9, -0.2], 'rgba(111,125,130,.95)', 5, 'rgba(154,190,192,.22)');
    line(S, [0.8, 0.9, -0.2], [-0.1, 0.9, -0.2], 'rgba(111,125,130,.95)', 5, 'rgba(154,190,192,.22)');
    box(S, -0.1, 0.9, 0.04, 0.2, 0.2, 0.24, '#34464e', 'rgba(200,215,216,.65)');
    disc(S, -0.1, 0.9, 0.15, 0.052, 'rgba(6,8,10,.95)', 'rgba(99,230,226,.8)', 'rgba(99,230,226,.9)', 20);
    // light sheet
    face(S, [[-0.1,0.9,.15],[-0.3,-0.3,-0.1],[0.1,-0.3,0.15]], 'rgba(99,230,226,.035)', 'rgba(99,230,226,.3)', 'rgba(99,230,226,.3)', 0.8);
    line(S, [-0.1, 0.82, 0.15], [-0.25, -0.3, -0.05], 'rgba(255,178,122,.55)', 1, 'rgba(255,178,122,.55)', [3,4]);
  }

  function replay(S) {
    box(S, 0, 0.3, -0.38, 2.15, 1.2, 0.12, '#2c3b42', 'rgba(185,200,203,.5)');
    face(S, [[-1.0,0.88,-0.31],[1.0,0.88,-0.31],[1.0,-0.28,-0.31],[-1.0,-0.28,-0.31]], '#061014', 'rgba(99,230,226,.45)', 'rgba(99,230,226,.2)', 1);
    // replay arc on screen
    var arc = [];
    for (var i = 0; i < 18; i++) {
      var u = i / 17;
      arc.push([-0.8 + u * 1.6, -0.05 + Math.sin(u * Math.PI) * .7, -0.29]);
    }
    for (var a = 0; a < arc.length - 1; a++) line(S, arc[a], arc[a + 1], 'rgba(99,230,226,.55)', 1.2, 'rgba(99,230,226,.4)');
    for (var b = 0; b < arc.length; b += 3) disc(S, arc[b][0], arc[b][1], arc[b][2], 0.018 + b * 0.0007, 'rgba(255,178,122,.85)', null, 'rgba(255,178,122,.6)', 10);
    // screen timeline
    line(S, [-0.86, -0.2, -0.28], [0.86, -0.2, -0.28], 'rgba(242,239,232,.25)', 1);
    for (var tl = 0; tl < 12; tl++) line(S, [-0.86 + tl * .155, -0.2, -0.28], [-0.86 + tl * .155, -0.16, -0.28], 'rgba(242,239,232,.35)', 1);
    text(S, [0, 0.05, -0.27], 'REPLAY', 'rgba(242,239,232,.9)', 24, 'center');
    // broadcast camera
    box(S, -0.82, -0.55, 0.65, 0.34, 0.22, 0.3, '#33454d', 'rgba(196,211,214,.5)');
    box(S, -0.82, -0.55, 0.84, 0.16, 0.12, 0.14, '#10181c', 'rgba(99,230,226,.6)');
    disc(S, -0.82, -0.55, 0.92, 0.045, 'rgba(99,230,226,.55)', 'rgba(99,230,226,.95)', 'rgba(99,230,226,.8)', 18);
    line(S, [-0.82, -0.67, 0.65], [-1.08, -0.92, 0.45], 'rgba(111,125,130,.9)', 3);
    line(S, [-0.82, -0.67, 0.65], [-0.56, -0.92, 0.45], 'rgba(111,125,130,.9)', 3);
    line(S, [-0.82, -0.67, 0.65], [-0.82, -0.92, 0.8], 'rgba(111,125,130,.75)', 2.5);
    // camera sightline
    line(S, [-0.82, -0.55, 0.92], [-0.15, 0.05, -0.28], 'rgba(255,178,122,.25)', 1, null, [3,5]);
  }

  function build(key) {
    var S = {faces: [], lines: [], floor: [], texts: []};
    gridFloor(S);
    if (key === 'ar') ar(S);
    if (key === 'hud') hud(S);
    if (key === 'medical') medical(S);
    if (key === 'aviation') aviation(S);
    if (key === 'industry') industry(S);
    if (key === 'replay') replay(S);
    return S;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var bg = ctx.createRadialGradient(w * 0.5, h * 0.43, 10, w * 0.5, h * 0.43, Math.max(w, h) * 0.7);
    bg.addColorStop(0, 'rgba(20,33,36,.55)');
    bg.addColorStop(0.55, 'rgba(7,10,12,.6)');
    bg.addColorStop(1, 'rgba(2,3,4,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // grounded shadow — gives the object a physical seat
    ctx.save();
    ctx.translate(w * 0.5, h * 0.86);
    ctx.scale(1, 0.28);
    var sh = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.min(w * 0.34, 420));
    sh.addColorStop(0, 'rgba(0,0,0,.65)');
    sh.addColorStop(.55, 'rgba(0,0,0,.28)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(0, 0, Math.min(w * 0.34, 420), 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    var S = build(active);

    // floor lines
    for (var fl = 0; fl < S.floor.length; fl++) {
      var fln = S.floor[fl];
      var fpa = project(fln.a), fpb = project(fln.b);
      ctx.save();
      ctx.strokeStyle = fln.color;
      ctx.lineWidth = fln.width;
      ctx.beginPath(); ctx.moveTo(fpa[0], fpa[1]); ctx.lineTo(fpb[0], fpb[1]); ctx.stroke();
      ctx.restore();
    }

    // faces back-to-front
    var drawFaces = S.faces.map(function (f) {
      var pts = f.pts.map(project);
      var z = pts.reduce(function (a, p) { return a + p[2]; }, 0) / pts.length;
      return {f: f, pts: pts, z: z};
    }).sort(function (a, b) { return b.z - a.z; });
    drawFaces.forEach(function (o) {
      var f = o.f;
      ctx.save();
      ctx.globalAlpha = f.alpha;
      if (f.glow) { ctx.shadowBlur = 18; ctx.shadowColor = f.glow; }
      ctx.beginPath();
      o.pts.forEach(function (p, i) { if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
      ctx.closePath();
      if (f.fill) {
        var xs = o.pts.map(function (p) { return p[0]; });
        var ys = o.pts.map(function (p) { return p[1]; });
        var light = faceLight(f.pts);
        var grad = ctx.createLinearGradient(Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys));
        grad.addColorStop(0, shade(f.fill, Math.min(1.42, light * 1.2)));
        grad.addColorStop(1, shade(f.fill, Math.max(.3, light * .64)));
        ctx.fillStyle = grad;
        ctx.fill();
      }
      if (f.stroke) { ctx.strokeStyle = f.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    });

    // model lines, after faces so the structure reads
    for (var l = 0; l < S.lines.length; l++) {
      var ln = S.lines[l];
      var pa = project(ln.a), pb = project(ln.b);
      ctx.save();
      ctx.strokeStyle = ln.color;
      ctx.lineWidth = ln.width;
      if (ln.dash) ctx.setLineDash(ln.dash);
      if (ln.glow) { ctx.shadowBlur = 14; ctx.shadowColor = ln.glow; }
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
      ctx.restore();
    }

    // projected labels
    S.texts.forEach(function (t) {
      var p = project(t.p);
      ctx.save();
      ctx.fillStyle = t.color;
      ctx.font = '400 ' + t.size + 'px Bahnschrift, Consolas, monospace';
      ctx.textAlign = t.align;
      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(255,178,122,.25)';
      ctx.fillText(t.str, p[0], p[1]);
      ctx.restore();
    });

    // corner marks
    ctx.strokeStyle = 'rgba(242,239,232,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18, 38); ctx.lineTo(18, 18); ctx.lineTo(38, 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 18, h - 38); ctx.lineTo(w - 18, h - 18); ctx.lineTo(w - 38, h - 18); ctx.stroke();
  }

  function drawThumb(cv, key) {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var td = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * td) || cv.height !== Math.round(r.height * td)) {
      cv.width = Math.round(r.width * td);
      cv.height = Math.round(r.height * td);
    }
    var tc = cv.getContext('2d');
    tc.setTransform(td, 0, 0, td, 0, 0);
    var saved = {ctx: ctx, w: w, h: h, yaw: yaw, pitch: pitch, zoom: zoom, active: active, thumbMode: thumbMode};
    ctx = tc; w = r.width; h = r.height; thumbMode = true;
    yaw = -0.85; pitch = 0.23; zoom = key === 'replay' ? 0.9 : 1.08; active = key;
    try { draw(); } finally {
      ctx = saved.ctx; w = saved.w; h = saved.h; thumbMode = saved.thumbMode;
      yaw = saved.yaw; pitch = saved.pitch; zoom = saved.zoom; active = saved.active;
    }
  }

  function drawThumbs() {
    thumbs.forEach(function (cv) { drawThumb(cv, cv.dataset.appThumb); });
  }

  function setActive(key) {
    if (!DATA[key]) return;
    active = key;
    buttons.forEach(function (b) {
      var on = b.dataset.app === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (label) label.textContent = DATA[key].cn;
    if (desc) desc.textContent = DATA[key].desc;
    if (code) code.textContent = (keys.indexOf(key) + 1 < 10 ? '0' : '') + (keys.indexOf(key) + 1) + ' / 06';
    yaw = -0.85; pitch = 0.23; zoom = key === 'replay' ? 0.84 : 1;
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { setActive(b.dataset.app); });
  });
  canvas.addEventListener('pointerdown', function (e) {
    drag = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = clamp(pitch + (e.clientY - lastY) * 0.005, -0.35, 0.6);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', function (e) {
    drag = false; canvas.classList.remove('is-dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); zoom = clamp(zoom - e.deltaY * 0.0008, 0.7, 1.7);
  }, {passive: false});

  if (autoBtn) {
    autoBtn.addEventListener('click', function () {
      auto = !auto; autoBtn.classList.toggle('is-on', auto);
      autoBtn.setAttribute('aria-pressed', auto ? 'true' : 'false');
    });
  }
  if (resetBtn) resetBtn.addEventListener('click', function () { yaw = -0.85; pitch = 0.23; zoom = active === 'replay' ? 0.84 : 1; });

  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize(); setActive('ar');
  drawThumbs();

  var last = 0, lastThumb = 0;
  function loop(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt;
    if (auto && !drag) yaw += dt * 0.13;
    draw();
    if (now - lastThumb > 180) { drawThumbs(); lastThumb = now; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
