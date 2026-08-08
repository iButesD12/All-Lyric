const lyricsData = [
  { text: "You know it's true", duration: 4.5, emotional: false },
  { text: "That, I miss u...", duration: 5.0, emotional: false },
  { text: "You know it's true...", duration: 5.0, emotional: false },
  { text: "So, what if I call", duration: 3.5, emotional: false },
  { text: "And you pick up the phone?", duration: 4.5, emotional: false },
  { text: "And I use this holiday", duration: 5.0, emotional: false },
  { text: "To make my way to your ghost", duration: 6.2, emotional: true },
  { text: "Powered by iButesD12", duration: 10, emotional: true }
];

const colors = ['#ffffff', '#ff69b4', '#ff3333', '#9400d3', '#00bfff'];

let canvas, ctx;
let width, height;

const stars = [];
const particles = [];
const rockets = [];

let currentLineIndex = -1;
let lineStartTime = 0;
let wordElements = [];
let lastFireworkTime = 0;
const fireworkInterval = 1500; 

class Star {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.2;
        this.alpha = Math.random();
        this.speed = Math.random() * 0.02 + 0.005;
    }
    update() {
        this.alpha += this.speed;
        if (this.alpha > 1 || this.alpha < 0) this.speed = -this.speed;
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(this.alpha)})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class FloatingParticle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 1.5 + 0.3;
        this.vx = (Math.random() - 0.5) * 0.15;
        this.vy = -Math.random() * 0.2 - 0.05;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -10) {
            this.y = height + 10;
            this.x = Math.random() * width;
        }
    }
    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Rocket {
    constructor(tx, ty) {
        this.x = tx;
        this.y = height;
        this.tx = tx;
        this.ty = ty;
        this.vy = -Math.random() * 4 - 8;
    }
    update() {
        this.y += this.vy;
        return this.y > this.ty;
    }
    draw() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(this.x - 1, this.y, 2, 8);
    }
}

class FireworkParticle {
    constructor(x, y, color, targetHeartPos = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.alpha = 1;
        this.gravity = 0.035;

        this.targetHeartPos = targetHeartPos;
        this.inHeartFormation = false;
        this.heartLife = 120; 
        this.pulseTime = Math.random() * 10;
    }
    update() {
        if (!this.inHeartFormation) {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.gravity;
            this.alpha -= 0.012;

            if (this.targetHeartPos && this.alpha <= 0.6) {
                this.inHeartFormation = true;
                this.alpha = 1;
            }
        } else if (this.inHeartFormation && this.heartLife > 0) {
            this.pulseTime += 0.05;
            const pulse = 1 + Math.sin(this.pulseTime) * 0.05; 

            const tx = this.targetHeartPos.cx + this.targetHeartPos.hx * pulse;
            const ty = this.targetHeartPos.cy + this.targetHeartPos.hy * pulse;

            
            this.x += (tx - this.x) * 0.08;
            this.y += (ty - this.y) * 0.08;
            this.heartLife--;
        } else {
            this.vy += this.gravity * 0.3;
            this.vx += (Math.random() - 0.5) * 0.05;
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= 0.015;
        }
        return this.alpha > 0;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}


function initCanvas() {
    canvas = document.getElementById('cinematic-canvas');
    ctx = canvas.getContext('2d');
    
    const resize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    createStars();
    createParticles();
    
    lineStartTime = performance.now();
    requestAnimationFrame(animationLoop);
}

function createStars() {
    for (let i = 0; i < 50; i++) {
        stars.push(new Star());
    }
}

function createParticles() {
    for (let i = 0; i < 35; i++) {
        particles.push(new FloatingParticle());
    }
}

function launchFirework(x = Math.random() * width, y = height * (0.2 + Math.random() * 0.3)) {
    rockets.push(new Rocket(x, y));
}

function createHeartFirework(cx, cy) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const totalPoints = 220;
    for (let i = 0; i < totalPoints; i++) {
        const t = (i / totalPoints) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3) * 6.5;
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * 6.5;
        
        const targetPos = { cx, cy, hx, hy };
        particles.push(new FireworkParticle(cx, cy, color, targetPos));
    }

    for (let i = 0; i < 40; i++) {
        particles.push(new FireworkParticle(cx, cy, color));
    }
}

function animateLyrics(elapsedTime) {
    let accumulatedTime = 0;
    let targetIndex = -1;

    for (let i = 0; i < lyricsData.length; i++) {
        const duration = lyricsData[i].duration;
        if (elapsedTime >= accumulatedTime && elapsedTime < accumulatedTime + duration) {
            targetIndex = i;
            break;
        }
        accumulatedTime += duration;
    }

    if (targetIndex !== currentLineIndex) {
        currentLineIndex = targetIndex;
        const lyricLineEl = document.getElementById('lyric-line');

        if (currentLineIndex !== -1) {
            const currentLine = lyricsData[currentLineIndex];
            
         if (currentLine.emotional) {
             launchFirework(width * 0.25, height * 0.25);
              launchFirework(width * 0.50, height * 0.20);
              launchFirework(width * 0.75, height * 0.25);
           } else {
           launchFirework();
          }

            lyricLineEl.innerHTML = '';
            lyricLineEl.className = 'lyric-line';
            if (currentLine.emotional) lyricLineEl.classList.add('emotional-glow');

            const words = currentLine.text.split(' ');
            wordElements = words.map(w => {
                const span = document.createElement('span');
                span.className = 'lyric-word';
                span.innerText = w;
                lyricLineEl.appendChild(span);
                return span;
            });

            void lyricLineEl.offsetWidth;
            lyricLineEl.classList.add('active');
        } else {
            lyricLineEl.classList.remove('active');
        }
    }

    if (currentLineIndex !== -1) {
        let currentLineStart = 0;
        for(let i=0; i<currentLineIndex; i++) currentLineStart += lyricsData[i].duration;

        const currentLineDuration = lyricsData[currentLineIndex].duration;
        const lineProgress = (elapsedTime - currentLineStart) / currentLineDuration;
        const activeWordIndex = Math.floor(lineProgress * wordElements.length);

        wordElements.forEach((el, index) => {
            if (index <= activeWordIndex) el.classList.add('highlight');
            else el.classList.remove('highlight');
        });
    }
}

function animationLoop(timestamp) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, width, height);

    stars.forEach(s => { s.update(); s.draw(); });
    particles.forEach(p => { p.update(); p.draw(); });

    for (let i = rockets.length - 1; i >= 0; i--) {
        if (!rockets[i].update()) {
            createHeartFirework(rockets[i].tx, rockets[i].ty);
            rockets.splice(i, 1);
        } else {
            rockets[i].draw();
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i] instanceof FireworkParticle) {
            if (!particles[i].update()) particles.splice(i, 1);
            else particles[i].draw();
        }
    }
    
    // Kembang api otomatis setiap 1.5 detik
     if (timestamp - lastFireworkTime > fireworkInterval) {
       launchFirework();
    lastFireworkTime = timestamp;
     }
    const elapsedTime = (timestamp - lineStartTime) / 1000;
    animateLyrics(elapsedTime);

    requestAnimationFrame(animationLoop);
}

window.addEventListener('DOMContentLoaded', initCanvas);
