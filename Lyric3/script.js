/**
 * script.js — Aurora Drift, Cinematic Galaxy Lyric Animation
 * Vanilla JS, no dependencies. Modular engines driven by one shared RAF loop.
 *
 *   Utils            → small math helpers
 *   CameraEngine      → mouse / touch / device-orientation → lerped CSS vars
 *   CosmosEngine      → nebula + starfield + shooting stars + cosmic dust
 *   GalaxyEngine      → the Milky Way spiral, self-rotating + camera-parallaxed
 *   FireworksEngine   → rockets + firework bursts, object-pooled particles
 *   LyricEngine       → timeline-driven lyric swapping with enter/exit anims
 *   InteractionEngine → click/tap → spawn burst + camera shake
 */
(function () {
  'use strict';

  // ============================================================
  // UTILS
  // ============================================================
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const TAU = Math.PI * 2;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const isSmall = () => window.innerWidth < 720;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.documentElement;

  function setCanvasSize(canvas) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { w, h, ctx };
  }

  // ============================================================
  // CAMERA ENGINE
  // ============================================================
  const CameraEngine = (() => {
    let targetX = 0, targetY = 0;
    let curX = 0, curY = 0;
    let shakeAmp = 0;
    let shakeX = 0, shakeY = 0;

    function onPointerMove(clientX, clientY) {
      const nx = (clientX / window.innerWidth) * 2 - 1;
      const ny = (clientY / window.innerHeight) * 2 - 1;
      targetX = clamp(nx, -1, 1);
      targetY = clamp(ny, -1, 1);
    }

    function bind() {
      window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY), { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });

      // Gentle device-orientation parallax on mobile, if available & permitted.
      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
          if (e.gamma == null || e.beta == null) return;
          const nx = clamp(e.gamma / 30, -1, 1);
          const ny = clamp((e.beta - 45) / 30, -1, 1);
          // Blend gently rather than overriding touch input entirely.
          targetX = lerp(targetX, nx, 0.15);
          targetY = lerp(targetY, ny, 0.15);
        }, true);
      }
    }

    function kick(amount) {
      shakeAmp = Math.min(shakeAmp + amount, 26);
    }

    function update() {
      const smoothing = prefersReducedMotion ? 1 : 0.06;
      curX = lerp(curX, targetX, smoothing);
      curY = lerp(curY, targetY, smoothing);

      shakeAmp *= 0.88;
      if (shakeAmp < 0.05) shakeAmp = 0;
      shakeX = shakeAmp ? rand(-1, 1) * shakeAmp : 0;
      shakeY = shakeAmp ? rand(-1, 1) * shakeAmp : 0;

      root.style.setProperty('--cam-x', curX.toFixed(4));
      root.style.setProperty('--cam-y', curY.toFixed(4));
      root.style.setProperty('--shake-x', shakeX.toFixed(2) + 'px');
      root.style.setProperty('--shake-y', shakeY.toFixed(2) + 'px');
    }

    return { bind, update, kick, get x() { return curX; }, get y() { return curY; } };
  })();

  // ============================================================
  // COSMOS ENGINE — nebula + stars + shooting stars + cosmic dust
  // ============================================================
  const CosmosEngine = (() => {
    const canvas = document.getElementById('cosmos-canvas');
    let ctx, W, H;

    let nebulaBlobs = [];
    let starLayers = []; // 3 depth groups
    let dust = [];
    let shootingStars = [];
    let nextShootTimer = rand(3, 7);

    const NEBULA_COLORS = ['rgba(59,107,246,', 'rgba(139,92,246,', 'rgba(34,211,238,'];

    function buildNebula() {
      nebulaBlobs = [];
      const count = isSmall() ? 3 : 5;
      for (let i = 0; i < count; i++) {
        nebulaBlobs.push({
          x: rand(0.15, 0.85) * W,
          y: rand(0.15, 0.75) * H,
          r: rand(0.22, 0.4) * Math.max(W, H),
          color: pick(NEBULA_COLORS),
          alpha: rand(0.05, 0.12),
          driftPhase: rand(0, TAU),
          driftSpeed: rand(0.02, 0.05)
        });
      }
    }

    function buildStars() {
      starLayers = [
        { count: isSmall() ? 90 : 180, size: [0.4, 1.1], speed: [0.15, 0.35], opacity: [0.2, 0.5] },
        { count: isSmall() ? 60 : 120, size: [0.8, 1.6], speed: [0.35, 0.6], opacity: [0.4, 0.75] },
        { count: isSmall() ? 30 : 60, size: [1.3, 2.4], speed: [0.6, 1.0], opacity: [0.6, 1] }
      ].map((layer) => {
        const stars = [];
        for (let i = 0; i < layer.count; i++) {
          stars.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: rand(layer.size[0], layer.size[1]),
            baseA: rand(layer.opacity[0], layer.opacity[1]),
            twinkleSpeed: rand(0.6, 1.8),
            phase: rand(0, TAU),
            parallax: rand(layer.speed[0], layer.speed[1])
          });
        }
        return stars;
      });
    }

    function buildDust() {
      dust = [];
      const count = isSmall() ? 26 : 50;
      for (let i = 0; i < count; i++) {
        dust.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rand(0.6, 1.6),
          vx: rand(-4, 4) / 60,
          vy: rand(-10, -3) / 60,
          alpha: rand(0.08, 0.22)
        });
      }
    }

    function spawnShootingStar() {
      const fromLeft = Math.random() < 0.5;
      const startX = fromLeft ? rand(-0.1, 0.3) * W : rand(0.7, 1.1) * W;
      const startY = rand(0.05, 0.35) * H;
      const angle = fromLeft ? rand(0.15, 0.4) : Math.PI - rand(0.15, 0.4);
      const speed = rand(9, 15);
      shootingStars.push({
        x: startX, y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        trail: []
      });
    }

    function resize() {
      const s = setCanvasSize(canvas);
      W = s.w; H = s.h; ctx = s.ctx;
      buildNebula();
      buildStars();
      buildDust();
    }

    function draw(t, dt) {
      ctx.clearRect(0, 0, W, H);

      // --- nebula ---
      ctx.globalCompositeOperation = 'lighter';
      nebulaBlobs.forEach((n) => {
        const dx = Math.cos(t * n.driftSpeed + n.driftPhase) * 24;
        const dy = Math.sin(t * n.driftSpeed + n.driftPhase) * 18;
        const g = ctx.createRadialGradient(n.x + dx, n.y + dy, 0, n.x + dx, n.y + dy, n.r);
        g.addColorStop(0, n.color + n.alpha + ')');
        g.addColorStop(1, n.color + '0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x + dx, n.y + dy, n.r, 0, TAU);
        ctx.fill();
      });

      // --- stars (twinkle, layered parallax via subtle drift) ---
      ctx.globalCompositeOperation = 'source-over';
      starLayers.forEach((layer) => {
        layer.forEach((s) => {
          const tw = 0.55 + 0.45 * Math.sin(t * s.twinkleSpeed + s.phase);
          ctx.globalAlpha = s.baseA * tw;
          ctx.fillStyle = '#f4f6ff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, TAU);
          ctx.fill();
        });
      });
      ctx.globalAlpha = 1;

      // --- cosmic dust ---
      ctx.globalCompositeOperation = 'lighter';
      dust.forEach((d) => {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -5) d.y = H + 5;
        if (d.x < -5) d.x = W + 5;
        if (d.x > W + 5) d.x = -5;
        ctx.fillStyle = `rgba(180,200,255,${d.alpha})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
      });

      // --- shooting stars ---
      ctx.globalCompositeOperation = 'lighter';
      nextShootTimer -= dt;
      if (nextShootTimer <= 0) {
        spawnShootingStar();
        nextShootTimer = rand(4, 9);
      }
      shootingStars = shootingStars.filter((s) => s.life > 0);
      shootingStars.forEach((s) => {
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 14) s.trail.shift();
        s.x += s.vx; s.y += s.vy;
        s.life -= dt * 0.7;

        for (let i = 0; i < s.trail.length; i++) {
          const p = s.trail[i];
          const a = (i / s.trail.length) * s.life * 0.8;
          ctx.fillStyle = `rgba(244,246,255,${a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4, 0, TAU);
          ctx.fill();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    return { resize, draw };
  })();

  // ============================================================
  // GALAXY ENGINE — the Milky Way spiral, hero visual
  // ============================================================
  const GalaxyEngine = (() => {
    const canvas = document.getElementById('galaxy-canvas');
    let ctx, W, H, cx, cy, baseRadius;
    let armPoints = [];
    let ringParticles = [];
    let rotation = 0;

    const ARM_COLORS = ['#8b5cf6', '#3b6bf6', '#22d3ee', '#f4f6ff'];

    function buildGalaxy() {
      armPoints = [];
      const arms = 3;
      const pointsPerArm = isSmall() ? 130 : 220;
      baseRadius = Math.min(W, H) * (isSmall() ? 0.34 : 0.3);

      for (let a = 0; a < arms; a++) {
        const armOffset = (a / arms) * TAU;
        for (let i = 0; i < pointsPerArm; i++) {
          const t = i / pointsPerArm;
          const angle = armOffset + t * Math.PI * 2.6;
          const radius = t * baseRadius * (0.94 + Math.random() * 0.12);
          const scatter = rand(-14, 14) * (1 - t * 0.4);
          armPoints.push({
            angle,
            radius,
            scatter,
            size: rand(0.5, 1.9) * (1 - t * 0.5) + 0.4,
            color: pick(ARM_COLORS),
            alpha: rand(0.35, 0.9) * (1 - t * 0.35),
            twinkleSpeed: rand(0.4, 1.2),
            phase: rand(0, TAU)
          });
        }
      }

      ringParticles = [];
      const ringCount = isSmall() ? 40 : 70;
      for (let i = 0; i < ringCount; i++) {
        ringParticles.push({
          angle: rand(0, TAU),
          radius: baseRadius * rand(1.05, 1.35),
          size: rand(0.5, 1.4),
          speed: rand(0.02, 0.06) * (Math.random() < 0.5 ? 1 : -1),
          alpha: rand(0.2, 0.5)
        });
      }
    }

    function resize() {
      const s = setCanvasSize(canvas);
      W = s.w; H = s.h; ctx = s.ctx;
      cx = W / 2; cy = H * 0.46;
      buildGalaxy();
    }

    function draw(t, dt) {
      ctx.clearRect(0, 0, W, H);
      rotation += dt * 0.02; // slow self-rotation

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      // --- core glow ---
      ctx.globalCompositeOperation = 'lighter';
      const coreR = baseRadius * 0.32;
      const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      coreGlow.addColorStop(0, 'rgba(244,246,255,0.85)');
      coreGlow.addColorStop(0.35, 'rgba(139,92,246,0.45)');
      coreGlow.addColorStop(1, 'rgba(139,92,246,0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(0, 0, coreR, 0, TAU);
      ctx.fill();

      // --- spiral arms ---
      armPoints.forEach((p) => {
        const tw = 0.7 + 0.3 * Math.sin(t * p.twinkleSpeed + p.phase);
        const x = Math.cos(p.angle) * p.radius + Math.cos(p.angle + 1.4) * p.scatter;
        const y = Math.sin(p.angle) * p.radius * 0.55 + Math.sin(p.angle + 1.4) * p.scatter * 0.55;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * tw;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // --- outer particle ring (cosmic particles orbiting the galaxy) ---
      ringParticles.forEach((p) => {
        p.angle += p.speed * dt;
        const x = Math.cos(p.angle) * p.radius;
        const y = Math.sin(p.angle) * p.radius * 0.55;
        ctx.fillStyle = 'rgba(180,200,255,' + p.alpha + ')';
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, TAU);
        ctx.fill();
      });

      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    return { resize, draw };
  })();

  // ============================================================
  // FIREWORKS ENGINE — rockets + bursts, object pooled
  // ============================================================
  const FireworksEngine = (() => {
    const canvas = document.getElementById('fx-canvas');
    let ctx, W, H;

    const FX_COLORS = ['#8b5cf6', '#3b6bf6', '#22d3ee', '#f4f6ff', '#c084fc'];

    const rocketPool = [];
    const particlePool = [];
    let activeRockets = [];
    let activeParticles = [];
    let nextSpawnTimer = rand(0.8, 2);

    function getRocket() {
      return rocketPool.pop() || {};
    }
    function releaseRocket(r) { rocketPool.push(r); }

    function getParticle() {
      return particlePool.pop() || {};
    }
    function releaseParticle(p) { particlePool.push(p); }

    function spawnRocket(x) {
      const r = getRocket();
      r.x = x != null ? x : rand(W * 0.15, W * 0.85);
      r.y = H + 10;
      r.targetY = rand(H * 0.18, H * 0.5);
      r.vx = rand(-0.3, 0.3);
      r.vy = rand(-6.2, -5.2);
      r.trail = r.trail || [];
      r.trail.length = 0;
      r.color = pick(FX_COLORS);
      r.alive = true;
      activeRockets.push(r);
    }

    function burst(x, y, opts) {
      opts = opts || {};
      const count = opts.count || randInt(28, 46);
      const baseColor = opts.color || pick(FX_COLORS);
      const speed = opts.speed || rand(2.4, 4.4);
      for (let i = 0; i < count; i++) {
        const p = getParticle();
        const angle = (i / count) * TAU + rand(-0.06, 0.06);
        const sp = speed * rand(0.5, 1);
        p.x = x; p.y = y;
        p.vx = Math.cos(angle) * sp;
        p.vy = Math.sin(angle) * sp;
        p.gravity = 0.045;
        p.drag = 0.985;
        p.life = 1;
        p.decay = rand(0.012, 0.02);
        p.size = rand(1.2, 2.8);
        p.color = Math.random() < 0.75 ? baseColor : pick(FX_COLORS);
        activeParticles.push(p);
      }
      // bright flash core, a few big fast-fading particles for the "flash" feel
      for (let i = 0; i < 6; i++) {
        const p = getParticle();
        p.x = x; p.y = y;
        p.vx = rand(-0.6, 0.6);
        p.vy = rand(-0.6, 0.6);
        p.gravity = 0;
        p.drag = 0.9;
        p.life = 1;
        p.decay = 0.09;
        p.size = rand(3, 6);
        p.color = '#f4f6ff';
        activeParticles.push(p);
      }
    }

    function spawnRandom() {
      if (Math.random() < 0.5) {
        spawnRocket();
      } else {
        burst(rand(W * 0.2, W * 0.8), rand(H * 0.15, H * 0.45));
      }
    }

    function spawnAt(x, y) {
      if (Math.random() < 0.35) {
        spawnRocket(x);
      } else {
        burst(x, y, { count: randInt(34, 52), speed: rand(3, 5) });
      }
    }

    function resize() {
      const s = setCanvasSize(canvas);
      W = s.w; H = s.h; ctx = s.ctx;
    }

    function update(dt) {
      nextSpawnTimer -= dt;
      if (nextSpawnTimer <= 0) {
        spawnRandom();
        nextSpawnTimer = rand(0.8, 2);
      }

      // rockets
      const stillRockets = [];
      for (const r of activeRockets) {
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 10) r.trail.shift();
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.01;

        if (r.y <= r.targetY || r.vy >= -0.5) {
          burst(r.x, r.y, { color: r.color });
          releaseRocket(r);
        } else {
          stillRockets.push(r);
        }
      }
      activeRockets = stillRockets;

      // particles
      const stillParticles = [];
      for (const p of activeParticles) {
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          releaseParticle(p);
        } else {
          stillParticles.push(p);
        }
      }
      activeParticles = stillParticles;
    }

    function draw() {
      // trail-fade clear for glowing streaks
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(4,3,10,0.22)';
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'lighter';

      activeRockets.forEach((r) => {
        r.trail.forEach((p, i) => {
          const a = (i / r.trail.length) * 0.6;
          ctx.fillStyle = r.color;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.6, 0, TAU);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f4f6ff';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 1.8, 0, TAU);
        ctx.fill();
      });

      activeParticles.forEach((p) => {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    return { resize, update, draw, spawnAt, clearRectInit: () => ctx && ctx.clearRect(0, 0, W, H) };
  })();

  // ============================================================
  // LYRIC ENGINE
  // ============================================================
  const LyricEngine = (() => {
    const lyrics = [
      { time: 0.5,  text: 'kita berdua, di antara jutaan bintang' },
      { time: 6,    text: 'waktu berhenti, hanya kita yang bergerak' },
      { time: 11.5, text: 'cahayamu menembus galaksi paling gelap' },
      { time: 17,   text: 'seperti nova yang lahir dari keheningan' },
      { time: 22.5, text: 'kupetik satu bintang, kuberi namamu' },
      { time: 28,   text: 'dan semesta pun tersenyum melihat kita' },
      { time: 33.5, text: 'selama galaksi berputar, aku di sini' }
    ];
    const CYCLE = 40; // seconds, then loops

    const el = document.getElementById('lyric-line');
    let currentIndex = -1;
    let startTime = null;
    let exiting = false;
    let exitUntil = 0;
    let pendingIndex = -1;

    function showLine(text) {
      el.textContent = text;
      el.classList.remove('exit');
      // force reflow so the enter animation restarts reliably
      void el.offsetWidth;
      el.classList.add('enter');
    }

    function update(t) {
      if (startTime === null) startTime = t;
      const elapsed = (t - startTime) % CYCLE;

      // find the lyric line whose time window we're in
      let idx = -1;
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (elapsed >= lyrics[i].time) { idx = i; break; }
      }

      if (idx !== currentIndex && idx !== -1 && !exiting) {
        if (currentIndex === -1) {
          currentIndex = idx;
          showLine(lyrics[idx].text);
        } else {
          exiting = true;
          pendingIndex = idx;
          el.classList.remove('enter');
          el.classList.add('exit');
          exitUntil = performance.now() + 700;
        }
      }

      if (exiting && performance.now() >= exitUntil) {
        exiting = false;
        currentIndex = pendingIndex;
        showLine(lyrics[currentIndex].text);
      }
    }

    return { update };
  })();

  // ============================================================
  // INTERACTION ENGINE — click / tap → burst + shake
  // ============================================================
  const InteractionEngine = (() => {
    function bind() {
      window.addEventListener('pointerdown', (e) => {
        FireworksEngine.spawnAt(e.clientX, e.clientY);
        CameraEngine.kick(14);
      }, { passive: true });
    }
    return { bind };
  })();

  // ============================================================
  // MASTER LOOP + INIT
  // ============================================================
  let lastTime = performance.now();
  let clockStart = performance.now();

  function resizeAll() {
    CosmosEngine.resize();
    GalaxyEngine.resize();
    FireworksEngine.resize();
  }

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    const t = (now - clockStart) / 1000;

    CameraEngine.update();
    CosmosEngine.draw(t, dt);
    GalaxyEngine.draw(t, dt);
    FireworksEngine.update(dt);
    FireworksEngine.draw();
    LyricEngine.update(t);

    requestAnimationFrame(loop);
  }

  function init() {
    resizeAll();
    CameraEngine.bind();
    InteractionEngine.bind();

    window.addEventListener('resize', () => {
      clearTimeout(window.__galaxyResizeT);
      window.__galaxyResizeT = setTimeout(resizeAll, 150);
    });

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
