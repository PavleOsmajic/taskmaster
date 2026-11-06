/* Small celebrations: sound cues, particle bursts and the flight into the Done tray. */
(function (root) {
  'use strict';

  const PALETTE = ['#33C88A', '#3BE29E', '#1A8F61', '#A6E9D6', '#F2C200'];
  const prefs = () => (root.TMApp && root.TMApp.data ? root.TMApp.prefs() : {});
  const calmMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionOn = () => prefs().effects !== false && !calmMotion();

  /* ---------- sound ---------- */
  // [frequency, start time, length] for each note in a cue
  const CUES = {
    completeHigh: [[523, 0, 0.12], [659, 0.07, 0.12], [784, 0.14, 0.12], [1047, 0.22, 0.16], [1319, 0.32, 0.45]],
    completeLow: [[659, 0, 0.12]],
    complete: [[523, 0, 0.14], [659, 0.08, 0.14], [784, 0.16, 0.16], [1047, 0.26, 0.3]],
    allSubtasks: [[659, 0, 0.1], [880, 0.08, 0.2]],
    create: [[587, 0, 0.09], [784, 0.07, 0.14]],
    tick: [[1175, 0, 0.07]],
    untick: [[784, 0, 0.06]],
    restore: [[784, 0, 0.1], [587, 0.08, 0.14]],
    remove: [[330, 0, 0.1], [247, 0.08, 0.16]],
    start: [[698, 0, 0.08], [880, 0.06, 0.1]],
    pause: [[587, 0, 0.09]],
  };
  let audio = null;
  function sound(name) {
    const cue = CUES[name];
    if (!cue || prefs().sound === false) return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const base = audio.currentTime + 0.005;
      for (const [freq, at, len] of cue) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audio.destination);
        const t = base + at;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.09, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
        osc.start(t);
        osc.stop(t + len + 0.02);
      }
      api.lastSound = name;
    } catch (e) { /* sound is optional */ }
  }

  /* ---------- particles ---------- */
  let canvas = null, ctx = null, running = false;
  const particles = [];
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }
  function fit() {
    const ratio = root.devicePixelRatio || 1;
    const w = Math.round(innerWidth * ratio), h = Math.round(innerHeight * ratio);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  /* Some particles are plus signs, echoing the OMD cross. */
  function drawPlus(size) {
    const a = size / 2, b = size / 6;
    ctx.fillRect(-a, -b, size, b * 2);
    ctx.fillRect(-b, -a, b * 2, size);
  }
  function frame(now) {
    fit();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const dt = Math.min(0.05, (now - p.last) / 1000);
      p.last = now;
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += 620 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.total * 0.5));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.plus) drawPlus(p.size);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (particles.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  const SIZES = { huge: [84, 560, 1.25, 11], tiny: [7, 170, 0.5, 5], small: [16, 260, 0.7, 7], big: [46, 430, 1.05, 9] };
  function burst(x, y, kind, extraColor) {
    if (!motionOn()) return;
    ensureCanvas();
    const [count, speed, life, size] = SIZES[kind] || SIZES.small;
    const colors = extraColor ? [...PALETTE, extraColor] : PALETTE;
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.45 + Math.random() * 0.75);
      const total = life * (0.7 + Math.random() * 0.5);
      particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - speed * 0.55,
        size: size * (0.65 + Math.random() * 0.7), color: colors[i % colors.length], plus: i % 3 === 0,
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * 11, life: total, total, last: now,
      });
    }
    api.bursts++;
    if (!running) { running = true; requestAnimationFrame(frame); }
  }
  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function burstAt(el, kind, extraColor) {
    if (!el) return;
    const c = centerOf(el);
    burst(c.x, c.y, kind, extraColor);
  }

  /* ---------- flights ---------- */
  /* Copies an element on top of the page, so it can animate after the real one is gone. */
  function lift(el, opts) {
    if (!el || !motionOn()) return null;
    // Measure the note without its tilt, so the copy starts at exactly the right size.
    const { transform, transition } = el.style;
    el.style.transition = 'none';
    el.style.transform = 'none';
    const rect = el.getBoundingClientRect();
    el.style.transform = transform;
    el.style.transition = transition;
    if (!rect.width) return null;
    const ghost = el.cloneNode(true);
    ghost.classList.add('fx-ghost');
    ghost.removeAttribute('data-note');
    ghost.removeAttribute('data-taskel');
    ghost.style.cssText += `;position:fixed;left:${rect.left}px;top:${rect.top}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;margin:0;transform-origin:0 0;z-index:90;pointer-events:none;`;
    ghost.dataset.scale = rect.width / (el.offsetWidth || rect.width);
    if (opts && opts.stamp) ghost.insertAdjacentHTML('beforeend', '<span class="stamp">DONE</span>');
    return { ghost, rect };
  }
  function flyTo(lifted, target, onLand) {
    if (!lifted) { if (onLand) onLand(); return; }
    const { ghost, rect } = lifted;
    document.body.appendChild(ghost);
    const s = Number(ghost.dataset.scale) || 1;
    if (!target || !target.getBoundingClientRect().width) { fade(ghost, s, onLand); return; }
    const t = centerOf(target);
    const end = 0.08 * s;
    const dx = t.x - rect.left - (ghost.offsetWidth * end) / 2;
    const dy = t.y - rect.top - (ghost.offsetHeight * end) / 2;
    const anim = ghost.animate([
      { transform: `translate(0,0) scale(${s})`, opacity: 1, offset: 0 },
      { transform: `translate(-4px,-8px) scale(${s * 1.07}) rotate(-2deg)`, opacity: 1, offset: 0.14, easing: 'ease-out' },
      { transform: `translate(-4px,-8px) scale(${s * 1.07}) rotate(-2deg)`, opacity: 1, offset: 0.42, easing: 'cubic-bezier(.55,.05,.75,.5)' },
      { transform: `translate(${dx}px,${dy}px) scale(${end}) rotate(8deg)`, opacity: 0.55, offset: 1 },
    ], { duration: 1000, fill: 'forwards' });
    api.flights++;
    setTimeout(() => ghost.remove(), 1500); // never leave a copy behind if the window was in the background
    anim.onfinish = () => {
      ghost.remove();
      target.classList.remove('bump');
      void target.offsetWidth;
      target.classList.add('bump');
      burst(t.x, t.y, 'tiny');
      if (onLand) onLand();
    };
  }
  function fade(ghost, s, done) {
    const anim = ghost.animate([
      { transform: `scale(${s})`, opacity: 1 },
      { transform: `scale(${s * 0.82}) rotate(-2deg)`, opacity: 0 },
    ], { duration: 240, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => ghost.remove(), 800); // never leave a copy behind if the window was in the background
    anim.onfinish = () => { ghost.remove(); if (done) done(); };
  }
  function poof(lifted) {
    if (!lifted) return;
    document.body.appendChild(lifted.ghost);
    fade(lifted.ghost, Number(lifted.ghost.dataset.scale) || 1);
  }
  function popIn(el) {
    if (!el || !motionOn()) return;
    el.classList.remove('fx-pop');
    void el.offsetWidth;
    el.classList.add('fx-pop');
    el.addEventListener('animationend', () => el.classList.remove('fx-pop'), { once: true });
  }

  const api = { sound, burst, burstAt, lift, flyTo, poof, popIn, lastSound: null, bursts: 0, flights: 0, particleCount: () => particles.length };
  root.TMFx = api;
})(window);
