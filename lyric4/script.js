/**
 * script.js — "ABOUT YOU", Cinematic Lyric Decode Animation
 * Vanilla JS + Canvas 2D, no dependencies. Black & white, monospace only.
 *
 * Flow:
 *   INTRO (DOM/CSS title card)
 *     -> RAIN_BUILDUP (canvas digital rain fills the screen)
 *     -> DECODE   (lyric scrambles into place, character by character)
 *     -> HOLD     (rain around it fades away, only the lyric remains)
 *     -> TRANSITION (lyric explodes into scattered characters, rain returns)
 *     -> next lyric -> DECODE ... (loops forever)
 *
 * Sparkles (✧) drift in ambiently through the whole experience.
 */
(function () {
  'use strict';

  // ============================================================
  // CONFIG
  // ============================================================
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const LYRICS = [
"But she's dancing with another man",
"Although it hurts",
"I'll be the first to say that I was wrong",
"Oh, I know I'm probably much too late"
"To try and apologize for my mistakes"'
"But I just want you to know",
"I hope he buys you flowers",
"I hope he holds your hand",
"Give you all his hours",
"When he has the chance"
  ];

  const RAIN_BUILDUP_TIME = 1.4;
  const HOLD_TIME = 2.6;
  const RAIN_FADE_TIME = 1.0;     // how long rain takes to vanish during HOLD
  const RAIN_RETURN_TIME = 1.0;   // how long rain takes to return during TRANSITION
  const EXPLODE_TIME = 1.1;

  const SPARKLE_COUNT = 22;

  // ============================================================
  // UTILS
  // ============================================================
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randomGlyph = () => GLYPHS[randInt(0, GLYPHS.length - 1)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const TAU = Math.PI * 2;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // CANVAS + GRID SETUP
  // ============================================================
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let fontSize = 18;
  let cellW = 12, cellH = 24;
  let cols = 0, rows = 0;

  function computeGrid() {
    fontSize = clamp(Math.floor(window.innerWidth / 68), 13, 22);
    cellW = Math.round(fontSize * 0.66);
    cellH = Math.round(fontSize * 1.4);
    cols = Math.ceil(W / cellW) + 1;
    rows = Math.ceil(H / cellH) + 1;
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    computeGrid();
    RainEngine.onResize();
    LyricEngine.onResize();
  }

  // ============================================================
  // RAIN ENGINE — classic digital-rain columns, trail via translucent overlay
  // ============================================================
  const RainEngine = (() => {
    let columns = [];
    let visibility = 1; // 0..1, drives alpha of newly-spawned head glyphs

    function buildColumns() {
      columns = [];
      for (let c = 0; c < cols; c++) {
        columns.push({
          row: rand(0, rows),
          stepTime: rand(0.045, 0.13),
          timer: rand(0, 0.2)
        });
      }
    }

    function onResize() {
      buildColumns();
    }

    function setVisibility(v) {
      visibility = clamp(v, 0, 1);
    }

    function update(dt) {
      columns.forEach((col) => {
        col.timer -= dt;
        if (col.timer <= 0) {
          col.timer = col.stepTime;
          col.row += 1;
          col.justStepped = true;
          if (col.row > rows + rand(0, 12)) {
            col.row = -rand(0, 8);
            col.stepTime = rand(0.045, 0.13);
          }
        } else {
          col.justStepped = false;
        }
      });
    }

    // draws the translucent black overlay that produces the falling trail-fade
    function drawTrailOverlay() {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, 0, W, H);
    }

    function draw() {
      if (visibility <= 0.002) return;
      ctx.font = `${fontSize}px 'Space Mono', 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      columns.forEach((col, c) => {
        if (!col.justStepped) return;
        const row = Math.floor(col.row);
        if (row < 0 || row > rows) return;

        // let the lyric engine claim cells so the rain never overwrites them
        if (LyricEngine.isCellClaimed(c, row)) return;

        const x = c * cellW + cellW / 2;
        const y = row * cellH + cellH / 2;
        ctx.globalAlpha = visibility;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(randomGlyph(), x, y);
      });
      ctx.globalAlpha = 1;
    }

    return { onResize, update, draw, drawTrailOverlay, setVisibility, get visibility() { return visibility; } };
  })();

  // ============================================================
  // LYRIC ENGINE — grid-aligned scramble-to-reveal
  // ============================================================
  const LyricEngine = (() => {
    const PHASE = { BUILDUP: 0, DECODE: 1, HOLD: 2, TRANSITION: 3 };
    let phase = PHASE.BUILDUP;
    let phaseTimer = 0;
    let lyricIndex = 0;

    let slots = [];          // current line's character slots
    let startCol = 0, row = 0;
    let decodeTotal = 1.5;
    let explodeParticles = [];

    function claimedSet() {
      // Map of "col,row" -> true, for cells currently occupied by the active lyric
      const set = new Set();
      if (phase === PHASE.DECODE || phase === PHASE.HOLD) {
        slots.forEach((s, i) => {
          if (s.char !== ' ') set.add((startCol + i) + ',' + row);
        });
      }
      return set;
    }
    let claimed = new Set();

    function isCellClaimed(c, r) {
      return claimed.has(c + ',' + r);
    }

    function prepareLine(text) {
      const chars = text.split('');
      row = Math.round(rows / 2);
      startCol = Math.round((cols - chars.length) / 2);

      const nonSpace = [];
      chars.forEach((ch, i) => { if (ch !== ' ') nonSpace.push(i); });
      const order = shuffle(nonSpace);
      const n = Math.max(order.length, 1);
      decodeTotal = clamp(0.9 + order.length * 0.045, 1.2, 2.6);

      slots = chars.map((ch) => ({
        char: ch,
        locked: ch === ' ',
        lockAt: null,
        glyph: ch === ' ' ? ' ' : randomGlyph(),
        scrambleTimer: rand(0.03, 0.07),
        flash: 0
      }));

      order.forEach((idx, i) => {
        slots[idx].lockAt = clamp(((i + 1) / n) * decodeTotal + rand(-0.08, 0.08), 0.05, decodeTotal);
      });
    }

    function startDecode() {
      prepareLine(LYRICS[lyricIndex]);
      phase = PHASE.DECODE;
      phaseTimer = 0;
      claimed = claimedSet();
    }

    function spawnExplosion() {
      explodeParticles = [];
      slots.forEach((s, i) => {
        if (s.char === ' ') return;
        const x = (startCol + i) * cellW + cellW / 2;
        const y = row * cellH + cellH / 2;
        const angle = rand(0, TAU);
        const speed = rand(60, 220);
        explodeParticles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          rot: rand(0, TAU),
          rotSpeed: rand(-4, 4),
          glyph: s.char,
          life: 1
        });
      });
    }

    function onResize() {
      // realign the currently active line to the new grid without breaking its progress
      if (phase === PHASE.DECODE || phase === PHASE.HOLD) {
        row = Math.round(rows / 2);
        startCol = Math.round((cols - slots.length) / 2);
        claimed = claimedSet();
      }
    }

    function update(dt) {
      phaseTimer += dt;

      if (phase === PHASE.BUILDUP) {
        RainEngine.setVisibility(1);
        if (phaseTimer >= RAIN_BUILDUP_TIME) startDecode();
        return;
      }

      if (phase === PHASE.DECODE) {
        RainEngine.setVisibility(1);
        slots.forEach((s) => {
          if (s.locked) return;
          if (phaseTimer >= s.lockAt) {
            s.locked = true;
            s.glyph = s.char;
            s.flash = 1;
          } else {
            s.scrambleTimer -= dt;
            if (s.scrambleTimer <= 0) {
              s.glyph = randomGlyph();
              s.scrambleTimer = rand(0.03, 0.07);
            }
          }
        });
        slots.forEach((s) => { if (s.flash > 0) s.flash = Math.max(0, s.flash - dt / 0.3); });
        claimed = claimedSet();

        if (phaseTimer >= decodeTotal + 0.15) {
          phase = PHASE.HOLD;
          phaseTimer = 0;
        }
        return;
      }

      if (phase === PHASE.HOLD) {
        const v = 1 - clamp(phaseTimer / RAIN_FADE_TIME, 0, 1);
        RainEngine.setVisibility(v);
        claimed = claimedSet();

        if (phaseTimer >= HOLD_TIME) {
          phase = PHASE.TRANSITION;
          phaseTimer = 0;
          spawnExplosion();
        }
        return;
      }

      if (phase === PHASE.TRANSITION) {
        const v = clamp(phaseTimer / RAIN_RETURN_TIME, 0, 1);
        RainEngine.setVisibility(v);
        claimed = new Set(); // lyric no longer occupies the grid, rain may pass through

        explodeParticles.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 90 * dt; // gentle gravity for a natural arc
          p.rot += p.rotSpeed * dt;
          p.life -= dt / EXPLODE_TIME;
        });
        explodeParticles = explodeParticles.filter((p) => p.life > 0);

        if (phaseTimer >= EXPLODE_TIME) {
          lyricIndex = (lyricIndex + 1) % LYRICS.length;
          startDecode();
        }
        return;
      }
    }

    function draw() {
      ctx.font = `bold ${fontSize}px 'Space Mono', 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (phase === PHASE.DECODE || phase === PHASE.HOLD) {
        slots.forEach((s, i) => {
          if (s.char === ' ') return;
          const x = (startCol + i) * cellW + cellW / 2;
          const y = row * cellH + cellH / 2;

          if (s.locked) {
            const pop = 1 + s.flash * 0.35;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(pop, pop);
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10 + s.flash * 18;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(s.glyph, 0, 0);
            ctx.restore();
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText(s.glyph, x, y);
          }
        });
        ctx.shadowBlur = 0;
      }

      if (phase === PHASE.TRANSITION) {
        explodeParticles.forEach((p) => {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = clamp(p.life, 0, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(p.glyph, 0, 0);
          ctx.restore();
        });
        ctx.globalAlpha = 1;
      }
    }

    return { update, draw, onResize, isCellClaimed };
  })();

  // ============================================================
  // SPARKLE ENGINE — ambient ✧ accents
  // ============================================================
  const SparkleEngine = (() => {
    let sparkles = [];

    function spawn() {
      return {
        x: rand(0, W),
        y: rand(0, H),
        size: rand(4, 10),
        life: 0,
        maxLife: rand(2.2, 4.5),
        fadeIn: rand(0.5, 1),
        fadeOut: rand(0.6, 1.2),
        pulseSpeed: rand(1.2, 2.4),
        phase: rand(0, TAU)
      };
    }

    function init() {
      sparkles = Array.from({ length: SPARKLE_COUNT }, spawn);
      sparkles.forEach((s) => { s.life = rand(0, s.maxLife); });
    }

    function drawGlyph(x, y, r, alpha) {
      const inner = r * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI / 4) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : inner;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function update(dt) {
      sparkles.forEach((s, i) => {
        s.life += dt;
        if (s.life >= s.maxLife) sparkles[i] = spawn();
      });
    }

    function draw(t) {
      sparkles.forEach((s) => {
        let alpha;
        if (s.life < s.fadeIn) alpha = s.life / s.fadeIn;
        else if (s.life > s.maxLife - s.fadeOut) alpha = (s.maxLife - s.life) / s.fadeOut;
        else alpha = 1;
        alpha = clamp(alpha, 0, 1) * (0.35 + 0.25 * Math.sin(t * s.pulseSpeed + s.phase));
        if (alpha <= 0.01) return;
        drawGlyph(s.x, s.y, s.size, alpha);
      });
    }

    return { init, update, draw };
  })();

  // ============================================================
  // INTRO SEQUENCE (DOM/CSS)
  // ============================================================
  function playIntro(onDone) {
    const intro = document.getElementById('intro');
    requestAnimationFrame(() => {
      intro.classList.add('show');
    });
    setTimeout(() => {
      intro.classList.add('hide');
    }, 1000 + 3000);
    setTimeout(() => {
      intro.classList.add('done');
      onDone();
    }, 1000 + 3000 + 800);
  }

  // ============================================================
  // MASTER LOOP
  // ============================================================
  let lastTime = null;
  let clockStart = 0;
  let started = false;

  function loop(now) {
    if (lastTime === null) lastTime = now;
    let dt = (now - lastTime) / 1000;
    dt = Math.min(dt, 1 / 30);
    lastTime = now;
    const t = (now - clockStart) / 1000;

    RainEngine.update(dt);
    LyricEngine.update(dt);
    SparkleEngine.update(dt);

    RainEngine.drawTrailOverlay();
    RainEngine.draw();
    LyricEngine.draw();
    SparkleEngine.draw(t);

    requestAnimationFrame(loop);
  }

  function startSequence() {
    if (started) return;
    started = true;
    clockStart = performance.now();
    lastTime = null;
    requestAnimationFrame(loop);
  }

  function init() {
    resize();
    SparkleEngine.init();

    window.addEventListener('resize', () => {
      clearTimeout(window.__decodeResizeT);
      window.__decodeResizeT = setTimeout(resize, 150);
    });

    if (prefersReducedMotion) {
      // Skip the timed intro card, jump straight into the loop.
      document.getElementById('intro').classList.add('done');
      startSequence();
    } else {
      playIntro(startSequence);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
