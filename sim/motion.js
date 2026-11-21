/* Scroll choreography: reveal masks, depth tilt, hero parallax, scene rail. */
(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));
  var railLinks = [].slice.call(document.querySelectorAll('.scroll-rail [data-scene]'));
  var sections = railLinks.map(function (link) { return document.getElementById(link.dataset.scene); }).filter(Boolean);

  root.classList.add('motion-ready');

  if (reduce) {
    reveals.forEach(function (el) { el.classList.add('is-inview'); });
  } else if ('IntersectionObserver' in window) {
    var grouped = [];
    var groups = [].slice.call(document.querySelectorAll('.inspect-section, .timeline-section, .ways-section, .cost-section, .apps-section'));
    groups.forEach(function (section) {
      var items = [].slice.call(section.querySelectorAll('[data-reveal]'));
      if (!items.length) return;
      items.forEach(function (el) { grouped.push(el); });
      var groupObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          items.forEach(function (el) { el.classList.add('is-inview'); });
          groupObserver.unobserve(section);
        });
      }, {rootMargin: '0px 0px -4% 0px', threshold: 0.025});
      groupObserver.observe(section);
    });

    var loose = reveals.filter(function (el) { return grouped.indexOf(el) === -1; });
    if (loose.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-inview');
            io.unobserve(entry.target);
          }
        });
      }, {rootMargin: '0px 0px -7% 0px', threshold: 0.08});
      loose.forEach(function (el) { io.observe(el); });
    }
  } else {
    reveals.forEach(function (el) { el.classList.add('is-inview'); });
  }

  function setRail() {
    if (!railLinks.length) return;
    var probe = window.scrollY + window.innerHeight * 0.38;
    var active = 0;
    sections.forEach(function (section, i) {
      if (section.offsetTop <= probe) active = i;
    });
    railLinks.forEach(function (link, i) {
      link.classList.toggle('is-on', i === active);
      if (i === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  var frame = 0;
  function update() {
    frame = 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    root.style.setProperty('--sp', (Math.min(1, window.scrollY / max) * 100).toFixed(2) + '%');

    var hero = document.querySelector('.hero');
    if (hero) {
      var hp = Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight));
      root.style.setProperty('--hp', hp.toFixed(3));
    }

    var stage = document.querySelector('.inspect-stage');
    if (stage && !reduce) {
      var r = stage.getBoundingClientRect();
      var ip = Math.max(0, Math.min(1, (window.innerHeight - r.top) / (window.innerHeight + r.height)));
      root.style.setProperty('--ip', ip.toFixed(3));
    }

    setRail();
  }

  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  window.addEventListener('scroll', requestUpdate, {passive: true});
  window.addEventListener('resize', requestUpdate);
  update();
})();
