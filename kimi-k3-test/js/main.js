/* ═══════════════════════════════════════════════════════════════
   DREAM ENGINE — main loop & subsystems
   scroll physics · RPM HUD · cursor · heart particles · audio
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── utils ─────────────────────────────────────────────── */
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, mn, mx) { return Math.min(mx, Math.max(mn, v)); };

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer: fine)').matches;
  if (FINE && !REDUCED) document.documentElement.classList.add('fine-pointer');

  /* ── shared state ──────────────────────────────────────── */
  var S = {
    time: 0,
    progress: 0,
    velN: 0,        // normalized |velocity| 0..1
    velSigned: 0,   // smoothed signed px/frame
    mx: 0, my: 0,   // smoothed mouse -1..1
    duality: 0.5
  };
  var mouseTX = 0, mouseTY = 0;
  var dualTarget = 0.5, dualVis = 0;
  var rpmBoost = 0;

  /* ── split text ────────────────────────────────────────── */
  function splitEl(el) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    var idx = 0;
    text.split(/(\s+)/).forEach(function (piece) {
      if (/^\s+$/.test(piece)) { el.appendChild(document.createTextNode(' ')); return; }
      if (!piece) return;
      var w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < piece.length; i++) {
        var c = document.createElement('span');
        c.className = 'c';
        c.style.setProperty('--i', idx++);
        c.textContent = piece[i];
        w.appendChild(c);
      }
      el.appendChild(w);
    });
  }
  document.querySelectorAll('[data-split]').forEach(splitEl);

  /* stagger sibling reveals a touch */
  document.querySelectorAll('.cards, .mystery-list, .hero-stats').forEach(function (group) {
    var kids = group.querySelectorAll('[data-reveal]');
    kids.forEach(function (k, i) { k.style.setProperty('--d', (i * 110) + 'ms'); });
  });

  /* ── preloader ─────────────────────────────────────────── */
  var loader = document.getElementById('loader');
  var loadCount = document.getElementById('loadCount');
  var loadBar = document.getElementById('loadBar');
  var ready = false;
  var pending = [];

  function applyInView(el) { el.classList.add('in-view'); }

  var LOAD_MS = REDUCED ? 200 : 1500;
  var t0 = performance.now();
  (function loadTick(now) {
    var p = clamp(((now || performance.now()) - t0) / LOAD_MS, 0, 1);
    var e = 1 - Math.pow(2, -10 * p); // easeOutExpo
    var rpm = Math.round(e * 11000);
    loadCount.textContent = rpm.toLocaleString('en-US');
    loadBar.style.transform = 'scaleX(' + e + ')';
    if (p < 1) { requestAnimationFrame(loadTick); return; }
    loadCount.textContent = '11,000';
    loader.classList.add('done');
    setTimeout(function () { loader.style.display = 'none'; }, 1300);
    ready = true;
    pending.forEach(applyInView);
    pending.length = 0;
  })(t0);

  /* ── intersection reveals ──────────────────────────────── */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      if (ready) applyInView(en.target); else pending.push(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('[data-reveal], [data-split]').forEach(function (el) { io.observe(el); });

  /* ── WebGL sky ─────────────────────────────────────────── */
  var glOK = window.DreamGL && window.DreamGL.init(document.getElementById('gl'));

  /* ── HUD gauge ─────────────────────────────────────────── */
  var hud = document.getElementById('hud');
  var needle = document.getElementById('needle');
  var gaugeArc = document.getElementById('gaugeArc');
  var rpmNum = document.getElementById('rpmNum');
  var ARC_LEN = 267;
  var rpm = 800;

  (function buildTicks() {
    var g = document.getElementById('ticks');
    var NS = 'http://www.w3.org/2000/svg';
    for (var i = 0; i <= 11; i++) {
      var v = i / 11;
      var phi = Math.PI - v * Math.PI; // 180° → 0°
      var cos = Math.cos(phi), sin = Math.sin(phi);
      var line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', 100 + cos * 66);
      line.setAttribute('y1', 115 - sin * 66);
      line.setAttribute('x2', 100 + cos * 76);
      line.setAttribute('y2', 115 - sin * 76);
      if (i >= 9) line.setAttribute('class', 'red');
      g.appendChild(line);
      if (i % 3 === 0 || i === 11) {
        var tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', 100 + cos * 54);
        tx.setAttribute('y', 115 - sin * 54 + 3);
        tx.setAttribute('text-anchor', 'middle');
        tx.textContent = i;
        g.appendChild(tx);
      }
    }
  })();

  /* ── marquee ───────────────────────────────────────────── */
  var marqueeTrack = document.getElementById('marqueeTrack');
  var marqX = 0;

  /* ── horizontal scroll ─────────────────────────────────── */
  var hOuter = document.getElementById('motion');
  var hTrack = document.getElementById('htrack');
  function sizeHScroll() {
    var over = Math.max(0, hTrack.scrollWidth - window.innerWidth);
    hOuter.style.height = (window.innerHeight + over * 1.15) + 'px';
  }
  sizeHScroll();

  /* ── ghosts ────────────────────────────────────────────── */
  var ghosts = Array.prototype.slice.call(document.querySelectorAll('.ghost'));

  /* ── cursor + trail ────────────────────────────────────── */
  var cursor = document.getElementById('cursor');
  var ring = document.getElementById('cursorRing');
  var trailCanvas = document.getElementById('trail');
  var tctx = trailCanvas.getContext('2d');
  var trailPts = [];
  var ringX = -100, ringY = -100, dotX = -100, dotY = -100;

  function sizeTrail() {
    trailCanvas.width = window.innerWidth;
    trailCanvas.height = window.innerHeight;
  }
  sizeTrail();

  if (FINE && !REDUCED) {
    window.addEventListener('pointermove', function (e) {
      mouseTX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTY = (e.clientY / window.innerHeight) * 2 - 1;
      trailPts.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (trailPts.length > 42) trailPts.shift();
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('[data-hover], a, button, input')) ring.classList.add('hovering');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('[data-hover], a, button, input')) ring.classList.remove('hovering');
    });
  } else {
    window.addEventListener('pointermove', function (e) {
      mouseTX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ── tilt cards ────────────────────────────────────────── */
  if (FINE && !REDUCED) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.transition = 'transform .06s linear, border-color .4s';
        card.style.transform = 'perspective(900px) rotateX(' + ((py - 0.5) * -10).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 12).toFixed(2) + 'deg)';
        card.style.setProperty('--mx', (px * 100) + '%');
        card.style.setProperty('--my', (py * 100) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1), border-color .4s';
        card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
      });
    });
  }

  /* ── magnetic buttons ──────────────────────────────────── */
  if (FINE && !REDUCED) {
    document.querySelectorAll('.magnetic').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.transition = 'transform .1s linear';
        btn.style.transform = 'translate(' + (dx * 0.28).toFixed(1) + 'px,' + (dy * 0.28).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
        btn.style.transform = 'translate(0,0)';
      });
    });
  }

  /* ── duality seam ──────────────────────────────────────── */
  var dualStage = document.getElementById('dualStage');
  var dualRange = document.getElementById('dualRange');
  var dualSection = document.getElementById('duality');
  dualRange.addEventListener('input', function () {
    dualStage.style.setProperty('--split-p', dualRange.value + '%');
    dualTarget = dualRange.value / 100;
  });

  /* ── scramble on hover ─────────────────────────────────── */
  var GLYPHS = '!<>-_\\/[]{}=+*^?#·—';
  document.querySelectorAll('.scramble').forEach(function (btn) {
    var original = btn.dataset.text;
    var raf = null;
    function run() {
      if (REDUCED) return;
      cancelAnimationFrame(raf);
      var frame = 0;
      var total = original.length * 3 + 10;
      (function tick() {
        frame++;
        var reveal = Math.floor((frame / total) * original.length * 1.6);
        var out = '';
        for (var i = 0; i < original.length; i++) {
          var ch = original[i];
          if (ch === ' ') { out += ' '; continue; }
          out += (i < reveal) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        btn.textContent = out;
        if (reveal < original.length) raf = requestAnimationFrame(tick);
        else btn.textContent = original;
      })();
    }
    btn.addEventListener('mouseenter', run);
    btn.addEventListener('focus', run);
  });

  /* ── heart particles ───────────────────────────────────── */
  var heartSection = document.getElementById('heart');
  var heartCanvas = document.getElementById('heartCanvas');
  var hctx = heartCanvas.getContext('2d');
  var N = 2048;
  var parts = [];
  var heartState = 'idle'; // idle → forming ↔ burst
  var heartVisible = false;
  var hdpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var hw = 0, hh = 0;

  function heartPoint(t) {
    var x = 16 * Math.pow(Math.sin(t), 3);
    var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: x, y: y };
  }

  function sizeHeart() {
    hw = heartSection.clientWidth;
    hh = heartSection.clientHeight;
    heartCanvas.width = hw * hdpr;
    heartCanvas.height = hh * hdpr;
    hctx.setTransform(hdpr, 0, 0, hdpr, 0, 0);
    retarget();
  }

  function retarget() {
    var scale = Math.min(hw, hh) / 38;
    var cx = hw / 2, cy = hh * 0.40;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var hp = heartPoint(p.t);
      p.tx = cx + hp.x * scale + (Math.random() - 0.5) * scale * 0.9;
      p.ty = cy - hp.y * scale + (Math.random() - 0.5) * scale * 0.9;
    }
  }

  (function initHeart() {
    for (var i = 0; i < N; i++) {
      parts.push({
        t: (i / N) * Math.PI * 2,
        x: Math.random() * 2000 - 1000,
        y: Math.random() * 2000 - 1000,
        tx: 0, ty: 0,
        vx: 0, vy: 0,
        ph: Math.random() * Math.PI * 2,
        size: 1 + Math.random() * 1.6,
        hue: 320 - (i / N) * 130 // 320 magenta → 190 cyan
      });
    }
    sizeHeart();
    if (REDUCED) {
      // static heart, no motion
      parts.forEach(function (p) { p.x = p.tx; p.y = p.ty; });
    }
  })();

  new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      heartVisible = en.isIntersecting;
      if (heartVisible && heartState === 'idle') heartState = 'forming';
      if (heartVisible && REDUCED) drawHeartStatic();
    });
  }, { threshold: 0.05 }).observe(heartSection);

  function drawHeartStatic() {
    hctx.clearRect(0, 0, hw, hh);
    hctx.globalCompositeOperation = 'lighter';
    parts.forEach(function (p) {
      hctx.fillStyle = 'hsla(' + p.hue + ',90%,68%,0.6)';
      hctx.fillRect(p.x, p.y, p.size, p.size);
    });
  }

  function heartFrame(time) {
    if (!heartVisible || REDUCED) return;
    hctx.clearRect(0, 0, hw, hh);
    hctx.globalCompositeOperation = 'lighter';
    var wob = time * 0.0016;
    for (var i = 0; i < N; i++) {
      var p = parts[i];
      if (heartState === 'burst') {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.94; p.vy *= 0.94;
        p.vy += 0.05;
      } else {
        p.x += (p.tx - p.x) * 0.055 + Math.sin(wob + p.ph) * 0.3;
        p.y += (p.ty - p.y) * 0.055 + Math.cos(wob * 1.2 + p.ph) * 0.3;
      }
      var a = heartState === 'burst' ? 0.8 : 0.55 + Math.sin(wob * 2 + p.ph) * 0.2;
      hctx.fillStyle = 'hsla(' + p.hue + ',92%,66%,' + a.toFixed(3) + ')';
      var s = p.size * (1 + Math.sin(wob * 3 + p.ph) * 0.25);
      hctx.fillRect(p.x, p.y, s, s);
    }
  }

  document.getElementById('dreamBtn').addEventListener('click', function () {
    if (REDUCED) return;
    heartState = 'burst';
    rpmBoost = 1;
    for (var i = 0; i < N; i++) {
      var p = parts[i];
      var ang = Math.atan2(p.y - hh * 0.4, p.x - hw / 2) + (Math.random() - 0.5) * 1.2;
      var sp = 4 + Math.random() * 11;
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
    }
    setTimeout(function () { heartState = 'forming'; }, 1100);
  });

  /* ── generative audio ──────────────────────────────────── */
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = soundBtn.querySelector('.sound-label');
  var actx = null, master = null;
  var soundOn = false;

  function buildAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0;

    var filter = actx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.8;

    // slow filter LFO — breathing
    var lfo = actx.createOscillator();
    lfo.frequency.value = 0.06;
    var lfoGain = actx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    lfo.start();

    // space
    var delay = actx.createDelay(1);
    delay.delayTime.value = 0.42;
    var fb = actx.createGain(); fb.gain.value = 0.34;
    var wet = actx.createGain(); wet.gain.value = 0.3;
    delay.connect(fb); fb.connect(delay);

    filter.connect(master);
    filter.connect(delay); delay.connect(wet); wet.connect(master);
    master.connect(actx.destination);

    // detuned dream saws
    [[110, 'sawtooth', 0.16], [110.8, 'sawtooth', 0.16], [165.2, 'triangle', 0.10], [55, 'sine', 0.30]]
      .forEach(function (cfg) {
        var o = actx.createOscillator();
        o.type = cfg[1];
        o.frequency.value = cfg[0];
        var g = actx.createGain();
        g.gain.value = cfg[2];
        o.connect(g); g.connect(filter);
        o.start();
        // gentle drift
        var drift = actx.createOscillator();
        drift.frequency.value = 0.03 + Math.random() * 0.05;
        var dg = actx.createGain(); dg.gain.value = 0.6;
        drift.connect(dg); dg.connect(o.detune);
        drift.start();
      });
  }

  soundBtn.addEventListener('click', function () {
    if (!actx) buildAudio();
    if (actx.state === 'suspended') actx.resume();
    soundOn = !soundOn;
    var now = actx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(soundOn ? 0.085 : 0, now, 0.8);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    soundLabel.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
  });

  /* ── resize ────────────────────────────────────────────── */
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      if (glOK) window.DreamGL.resize();
      sizeHScroll();
      sizeTrail();
      sizeHeart();
      if (REDUCED) drawHeartStatic();
    }, 150);
  });

  /* ── main loop ─────────────────────────────────────────── */
  var progressBar = document.getElementById('progress');
  var docEl = document.documentElement;
  var lastY = window.scrollY;
  var lastT = performance.now();
  var velAbs = 0;

  function frame(now) {
    var dt = Math.min(50, now - lastT);
    lastT = now;
    var dtScale = dt / 16.666;

    // time (frozen under reduced motion)
    if (!REDUCED) S.time += dt / 1000;

    // scroll physics
    var y = window.scrollY;
    var dy = y - lastY;
    lastY = y;
    velAbs = lerp(velAbs, Math.abs(dy), 0.12);
    S.velSigned = lerp(S.velSigned, dy, 0.09);
    var max = Math.max(1, docEl.scrollHeight - window.innerHeight);
    S.progress = clamp(y / max, 0, 1);
    S.velN = clamp(velAbs / 55, 0, 1);
    rpmBoost *= Math.pow(0.97, dtScale);

    // mouse smoothing
    S.mx = lerp(S.mx, mouseTX, 0.06);
    S.my = lerp(S.my, mouseTY, 0.06);

    // duality visibility weight
    var dr = dualSection.getBoundingClientRect();
    var center = dr.top + dr.height / 2;
    var dist = Math.abs(center - window.innerHeight / 2) / (window.innerHeight * 0.9);
    dualVis = clamp(1 - dist, 0, 1);
    var dualEffective = lerp(0.5, dualTarget, dualVis);
    S.duality = lerp(S.duality, dualEffective, 0.08);

    // shader
    if (glOK) window.DreamGL.frame(S);

    // progress bar
    progressBar.style.transform = 'scaleX(' + S.progress + ')';

    // HUD
    var effVel = Math.max(S.velN, rpmBoost);
    var rpmTarget = 800 + effVel * 10200;
    rpm = lerp(rpm, rpmTarget, 0.14);
    var rv = clamp(rpm / 11000, 0, 1);
    needle.style.transform = 'rotate(' + (-90 + rv * 180).toFixed(2) + 'deg)';
    gaugeArc.style.strokeDashoffset = (ARC_LEN * (1 - rv)).toFixed(1);
    rpmNum.textContent = Math.round(rpm).toLocaleString('en-US');
    var red = rpm > 9300 && !REDUCED;
    hud.classList.toggle('redline', red);
    docEl.classList.toggle('redline', red);

    // marquee
    if (!REDUCED) {
      marqX -= (1.1 + S.velN * 26) * dtScale;
      var half = marqueeTrack.scrollWidth / 2;
      if (half > 0 && -marqX >= half) marqX += half;
      var skew = clamp(S.velSigned * -0.45, -14, 14);
      marqueeTrack.style.transform = 'translate3d(' + marqX.toFixed(1) + 'px,0,0) skewX(' + skew.toFixed(2) + 'deg)';
    }

    // horizontal section
    var hr = hOuter.getBoundingClientRect();
    if (hr.bottom > 0 && hr.top < window.innerHeight) {
      var total = hOuter.offsetHeight - window.innerHeight;
      var p = clamp(-hr.top / Math.max(1, total), 0, 1);
      var maxX = Math.max(0, hTrack.scrollWidth - window.innerWidth + 40);
      hTrack.style.transform = 'translate3d(' + (-p * maxX).toFixed(1) + 'px,0,0)';
    }

    // ghost parallax
    if (!REDUCED) {
      for (var i = 0; i < ghosts.length; i++) {
        var g = ghosts[i];
        var pr = g.parentElement.getBoundingClientRect();
        if (pr.bottom < -200 || pr.top > window.innerHeight + 200) continue;
        var off = (pr.top + pr.height / 2 - window.innerHeight / 2) * parseFloat(g.dataset.speed || 0.15);
        g.style.transform = 'translateY(' + off.toFixed(1) + 'px)';
      }
    }

    // cursor + trail
    if (FINE && !REDUCED) {
      dotX = lerp(dotX, mouseTX * 0 + (trailPts.length ? trailPts[trailPts.length - 1].x : dotX), 0.9);
      dotY = lerp(dotY, trailPts.length ? trailPts[trailPts.length - 1].y : dotY, 0.9);
      ringX = lerp(ringX, dotX, 0.16);
      ringY = lerp(ringY, dotY, 0.16);
      cursor.style.transform = 'translate(' + dotX + 'px,' + dotY + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px) translate(-50%,-50%)';

      tctx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
      if (trailPts.length > 1) {
        tctx.globalCompositeOperation = 'lighter';
        for (var j = 1; j < trailPts.length; j++) {
          var a = trailPts[j - 1], b = trailPts[j];
          b.life -= 0.03 * dtScale;
          var hue = 200 + (j / trailPts.length) * 130;
          tctx.strokeStyle = 'hsla(' + hue.toFixed(0) + ',95%,65%,' + (b.life * 0.5).toFixed(3) + ')';
          tctx.lineWidth = Math.max(0.4, b.life * 3);
          tctx.beginPath();
          tctx.moveTo(a.x, a.y);
          tctx.lineTo(b.x, b.y);
          tctx.stroke();
        }
        while (trailPts.length && trailPts[0].life <= 0) trailPts.shift();
      }
    }

    // heart
    heartFrame(now);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
