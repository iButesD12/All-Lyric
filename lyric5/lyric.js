(function () {
  'use strict';


  const lyrics = [
    { text: "oh, golden boy, you shinned a light on your home",   duration: 3.5 },
    { text: "and at your best you were magic, i was sold",      duration: 2 },
    { text: "but don't tell 'em what you told me'",    duration: 1.3 },
    { text: "don't even tell 'em that you know me'", duration: 1 },
    { text: "i would rather burn forever",      duration: 0.8 },
    { text: "but you should know that i died slow", duration: 2.5 },
    { text: "running through the halls of your haunted home", duration: 2 },
    { text: "and the thoughest part is that we both know", duration: 2.2 },
    { text: "what happened to you", duration: 1 },
    { text: "why you're out on your own", duration: 1 },
    { text: "eid al adha, please don't call", duration: 5 }
  ];

  const FADE_IN_MS = 900;   
  const FADE_OUT_MS = 900;

  
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const TAU = Math.PI * 2;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInQuad = (t) => t * t;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    StarField.build();
  }


  const StarField = (() => {
    let stars = [];

    function build() {
      const count = clamp(Math.round((W * H) / 8500), 90, 240);
      stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: rand(0, W),
          y: rand(0, H),
          r: rand(0.6, 2.1),                
          baseAlpha: rand(0.35, 1),
          twinkleSpeed: rand(0.5, 1.7),
          phase: rand(0, TAU),
          vx: rand(-4, 4),                   
          vy: rand(-4, 4)
        });
      }
    }

    function update(dt) {
      stars.forEach((s) => {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < -5) s.x = W + 5; else if (s.x > W + 5) s.x = -5;
        if (s.y < -5) s.y = H + 5; else if (s.y > H + 5) s.y = -5;
      });
    }

    function draw(t) {
      stars.forEach((s) => {
        const tw = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.phase);
        ctx.globalAlpha = s.baseAlpha * (0.45 + 0.55 * tw);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    return { build, update, draw };
  })();


  const FireworksEngine = (() => {
    const PALETTE = ['#ff6b81', '#ffd166', '#4cc9f0', '#b892ff', '#80ffdb', '#f72585', '#ffb703', '#8ecae6'];

    let rockets = [];
    let bursts = [];

    function launch() {
      const x = W / 2 + rand(-W * 0.16, W * 0.16);
      rockets.push({
        x, y: H + 10,
        vx: rand(-35, 35),
        vy: rand(-620, -540),
        targetY: rand(H * 0.14, H * 0.42),
        color: pick(PALETTE),
        trail: []
      });
    }

    function spawnFlash(x, y, color) {
      bursts.push({
        kind: 'flash',
        x, y, color,
        life: 1,
        decay: 1 / 0.18
      });
    }

    function spawnBurst(x, y, color) {
    
      const particles = [];
      const count = randInt(30, 52);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * TAU + rand(-0.08, 0.08);
        const speed = rand(90, 260);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() < 0.7 ? color : pick(PALETTE),
          size: rand(1.2, 2.8),
          life: 1,
          decay: rand(0.6, 1.05)
        });
      }

      const flower = {
        petalCount: randInt(8, 14),
        maxLength: rand(46, 92),
        rotation: rand(0, TAU),
        color,
        t: 0
      };

      bursts.push({ kind: 'burst', x, y, particles, flower, life: 1 });
      spawnFlash(x, y, '#ffffff');
    }

    function updateRockets(dt) {
      rockets = rockets.filter((r) => {
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 12) r.trail.shift();
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += 300 * dt;

        if (r.y <= r.targetY || r.vy >= -30) {
          spawnBurst(r.x, r.y, r.color);
          return false;
        }
        return true;
      });
    }

    function updateBursts(dt) {
      bursts = bursts.filter((b) => {
        if (b.kind === 'flash') {
          b.life -= b.decay * dt;
          return b.life > 0;
        }

        
        b.flower.t += dt;

      
        b.particles.forEach((p) => {
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.vy += 130 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= p.decay * dt;
        });
        b.particles = b.particles.filter((p) => p.life > 0);

        const flowerDone = b.flower.t > 1.65; 
        return b.particles.length > 0 || !flowerDone;
      });
    }

    function drawFlower(f, x, y) {
      const BLOOM = 0.5, HOLD = 0.25, FADE = 0.9;
      let scale, alpha;

      if (f.t < BLOOM) {
        scale = easeOutCubic(f.t / BLOOM);
        alpha = scale;
      } else if (f.t < BLOOM + HOLD) {
        scale = 1;
        alpha = 1;
      } else {
        const ft = clamp((f.t - BLOOM - HOLD) / FADE, 0, 1);
        scale = 1;
        alpha = 1 - easeInQuad(ft);
      }
      if (alpha <= 0.01) return;

      const length = f.maxLength * scale;
      const width = length * 0.3;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = f.color;
      ctx.globalAlpha = alpha * 0.85;

      for (let i = 0; i < f.petalCount; i++) {
        const angle = f.rotation + (i / f.petalCount) * TAU;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const px = -dy, py = dx;
        const tipX = x + dx * length, tipY = y + dy * length;
        const midX = x + dx * length * 0.55, midY = y + dy * length * 0.55;
        const leftX = midX + px * width, leftY = midY + py * width;
        const rightX = midX - px * width, rightY = midY - py * width;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(leftX, leftY, tipX, tipY);
        ctx.quadraticCurveTo(rightX, rightY, x, y);
        ctx.closePath();
        ctx.fill();
      }

      
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, length * 0.14), 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    function draw() {
    
      ctx.globalCompositeOperation = 'lighter';
      rockets.forEach((r) => {
        r.trail.forEach((p, i) => {
          ctx.globalAlpha = (i / r.trail.length) * 0.55;
          ctx.fillStyle = r.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.6, 0, TAU);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 1.8, 0, TAU);
        ctx.fill();
      });

      bursts.forEach((b) => {
        if (b.kind === 'flash') {
          const r = 8 + (1 - b.life) * 46;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          g.addColorStop(0, `rgba(255,255,255,${b.life * 0.8})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, TAU);
          ctx.fill();
          return;
        }

      
        ctx.globalCompositeOperation = 'source-over';
        drawFlower(b.flower, b.x, b.y);

        ctx.globalCompositeOperation = 'lighter';
        b.particles.forEach((p) => {
          ctx.globalAlpha = clamp(p.life, 0, 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
        });
      });

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function update(dt) {
      updateRockets(dt);
      updateBursts(dt);
    }

    return { launch, update, draw };
  })();


  const LyricEngine = (() => {
    const el = document.getElementById('lyric-text');

    function showLine(index) {
      if (index >= lyrics.length) return;
      const line = lyrics[index];
      el.textContent = line.text;

      requestAnimationFrame(() => {
        el.classList.add('show');
      });

      const holdMs = FADE_IN_MS + line.duration * 1000;

      setTimeout(() => {
        el.classList.remove('show');

        const isLast = index === lyrics.length - 1;
        if (!isLast) {
          setTimeout(() => showLine(index + 1), FADE_OUT_MS);
        }
        
      }, holdMs);
    }

    function start() {
      if (lyrics.length > 0) showLine(0);
    }

    return { start };
  })();


  let lastTime = null;

  function loop(now) {
    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    dt = Math.min(dt, 1 / 30);
    lastTime = now;
    const t = now / 1000;

    ctx.clearRect(0, 0, W, H);

    StarField.update(dt);
    StarField.draw(t);

    FireworksEngine.update(dt);
    FireworksEngine.draw();

    requestAnimationFrame(loop);
  }


  function init() {
    resize();
    window.addEventListener('resize', () => {
      clearTimeout(window.__lyricResizeT);
      window.__lyricResizeT = setTimeout(resize, 150);
    });

    document.getElementById('firework-btn').addEventListener('click', () => {
      FireworksEngine.launch();
    });

    LyricEngine.start();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();