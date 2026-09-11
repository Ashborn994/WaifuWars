/**
 * WAIFU WARS - NEON BLADE SHOWDOWN
 * 1v1 Anime-Inspired Fighting Game
 * Engine: Vanilla JavaScript & Canvas API
 */

// --- 1. ENGINE & SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize performance
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const FLOOR_Y = 600;

// Game State Enum
const GAME_STATE = { MENU: 0, COUNTDOWN: 1, PLAYING: 2, PAUSED: 3, ROUND_OVER: 4, MATCH_OVER: 5, ULTIMATE: 6 };
let currentState = GAME_STATE.MENU;
let lastTime = 0;
let animationFrameId;

// Match Variables
let roundTime = 60;
let roundTimerId = 0;
let p1Wins = 0;
let p2Wins = 0;
let roundCount = 1;
let cameraShake = 0;
let ultimateData = null; 
let hitStopTimer = 0; 

// Input Handling
const keys = {};
window.addEventListener('keydown', e => {
    let key = e.key.toLowerCase();
    if (e.code === 'Space') key = ' '; 
    
    if (key === ' ' && !e.repeat) keys['space_trigger'] = true;
    if (key === 'p' && !e.repeat) keys['p_trigger'] = true;
    if (key === 'shift' && !e.repeat) keys['shift_trigger'] = true;
    
    keys[key] = true;
    
    if (e.key === 'Escape' && currentState === GAME_STATE.PLAYING) pauseGame();
    else if (e.key === 'Escape' && currentState === GAME_STATE.PAUSED) resumeGame();
    
    if(['w','a','s','d','j','k','l','p',' ','shift','arrowleft','arrowright'].includes(key)) e.preventDefault();
});

window.addEventListener('keyup', e => {
    let key = e.key.toLowerCase();
    if (e.code === 'Space') key = ' '; 
    
    keys[key] = false;
    if (key === ' ') keys['space_trigger'] = false;
    if (key === 'p') keys['p_trigger'] = false;
});

// --- 2. AUDIO SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const playSound = (type) => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'light') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'heavy') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'block') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'special') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.4);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'special2') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.6);
        gainNode.gain.setValueAtTime(0.6, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.7);
        osc.start(now); osc.stop(now + 0.7);
    } else if (type === 'ultimate') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.9);
        gainNode.gain.setValueAtTime(0.7, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
    } else if (type === 'parry') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1600, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.start(now); osc.stop(now + 0.14);
        const osc2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        osc2.type = 'square';
        osc2.connect(g2);
        g2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(2400, now);
        osc2.frequency.exponentialRampToValueAtTime(380, now + 0.07);
        g2.gain.setValueAtTime(0.2, now);
        g2.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc2.start(now); osc2.stop(now + 0.08);
    } else if (type === 'dash') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'backdash') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    }
};

// --- 3. PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, color, speed, size, life, angle = null, spread = Math.PI * 2, shape = 'square') {
        this.x = x; this.y = y; this.color = color;
        if (angle === null) {
            this.vx = (Math.random() - 0.5) * speed;
            this.vy = (Math.random() - 0.5) * speed;
        } else {
            const a = angle + (Math.random() - 0.5) * spread;
            const mag = speed * (0.5 + Math.random() * 0.5);
            this.vx = Math.cos(a) * mag;
            this.vy = Math.sin(a) * mag;
        }
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.shape = shape; 
        this.angle = Math.atan2(this.vy, this.vx);
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        if (this.shape === 'spark') {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillRect(-this.size * 1.5, -this.size * 0.25, this.size * 3, this.size * 0.5);
            ctx.restore();
        } else {
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.globalAlpha = 1.0;
    }
}
let particles = [];
const spawnParticles = (x, y, color, count, speed = 500) => {
    for(let i=0; i<count; i++) {
        if(particles.length > 200) break; 
        particles.push(new Particle(x, y, color, speed, Math.random()*4+2, Math.random()*0.3+0.2));
    }
};

const spawnDirectionalParticles = (x, y, color, count, angle, spread, speedMin, speedMax, sizeMin, sizeMax, lifeMin, lifeMax, shape = 'square') => {
    for (let i = 0; i < count; i++) {
        if (particles.length > 200) break; 
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const size = sizeMin + Math.random() * (sizeMax - sizeMin);
        const life = lifeMin + Math.random() * (lifeMax - lifeMin);
        particles.push(new Particle(x, y, color, speed, size, life, angle, spread, shape));
    }
};

// --- IMPACT VFX SYSTEM (V2) ---
let impactEffects = [];

function withAlpha(color, a) {
    if (!color) return `rgba(255,255,255,${a})`;
    if (color[0] === '#' && (color.length === 7 || color.length === 4)) {
        let r, g, b;
        if (color.length === 7) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        } else {
            r = parseInt(color[1] + color[1], 16);
            g = parseInt(color[2] + color[2], 16);
            b = parseInt(color[3] + color[3], 16);
        }
        return `rgba(${r},${g},${b},${a})`;
    }
    return color;
}

function spawnImpactFlash(x, y, radius, color, life, delay = 0, startScale = 0.4) {
    impactEffects.push({ type: 'flash', x, y, radius, color, life, maxLife: life, delay, startScale });
}
function spawnImpactRing(x, y, startRadius, endRadius, color, life, lineWidth = 3, delay = 0) {
    impactEffects.push({ type: 'ring', x, y, startRadius, endRadius, color, life, maxLife: life, lineWidth, delay });
}
function spawnScreenFlash(color, life, peakAlpha) {
    impactEffects.push({ type: 'screenFlash', color, life, maxLife: life, peakAlpha, delay: 0 });
}
function spawnImpactCore(x, y, startR, peakR, color, life, shape = 'circle', delay = 0) {
    impactEffects.push({ type: 'core', x, y, startR, peakR, color, life, maxLife: life, shape, delay });
}
function spawnImpactLines(x, y, color, life, count, innerMin, innerMax, lenMin, lenMax, widthMin, widthMax, dirAngle, spread) {
    const lines = [];
    for (let i = 0; i < count; i++) {
        const angle = dirAngle + (Math.random() - 0.5) * spread;
        const inner = innerMin + Math.random() * (innerMax - innerMin);
        const len = lenMin + Math.random() * (lenMax - lenMin);
        const width = widthMin + Math.random() * (widthMax - widthMin);
        lines.push({ angle, inner, outer: inner + len, width });
    }
    impactEffects.push({ type: 'lines', x, y, lines, color, life, maxLife: life, delay: 0 });
}

function updateImpactEffects(dt) {
    impactEffects.forEach(e => {
        if (e.delay && e.delay > 0) {
            e.delay -= dt;
            return;
        }
        e.life -= dt;
        if (e.type === 'residue') {
            e.x += (e.vx || 0) * dt;
            e.y += (e.vy || 0) * dt;
        }
    });
    impactEffects = impactEffects.filter(e => e.life > 0);
}

function drawStarBurst(ctx, x, y, r, points) {
    ctx.beginPath();
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
        const rad = (i % 2 === 0) ? r : r * 0.38;
        const a = i * step - Math.PI / 2;
        const px = x + Math.cos(a) * rad;
        const py = y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawDiamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.7, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.7, y);
    ctx.closePath();
    ctx.fill();
}

function drawImpactEffects(ctx) {
    impactEffects.forEach(e => {
        if (e.type === 'screenFlash') return;
        if (e.delay && e.delay > 0) return;
        const alpha = Math.max(0, e.life / e.maxLife);
        const elapsed = 1 - alpha;

        if (e.type === 'flash') {
            const pop = Math.min(1, elapsed * 5);
            const r = e.radius * ((e.startScale || 0.4) + (1 - (e.startScale || 0.4)) * pop);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'ring') {
            const progress = elapsed; 
            const radius = e.startRadius + (e.endRadius - e.startRadius) * progress;
            ctx.globalAlpha = alpha * 0.95;
            ctx.strokeStyle = e.color;
            ctx.lineWidth = Math.max(1, e.lineWidth * (0.25 + 0.75 * alpha));
            ctx.beginPath();
            ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (e.type === 'core') {
            let r;
            if (elapsed < 0.22) {
                const k = elapsed / 0.22;
                const ease = 1 - (1 - k) * (1 - k);
                r = e.startR + (e.peakR - e.startR) * ease;
            } else {
                r = e.peakR * (0.65 + 0.35 * alpha);
            }
            ctx.globalAlpha = Math.min(1, alpha * 1.25);
            ctx.fillStyle = e.color;
            if (e.shape === 'star') {
                drawStarBurst(ctx, e.x, e.y, r, 8);
            } else if (e.shape === 'diamond') {
                drawDiamond(ctx, e.x, e.y, r);
            } else {
                ctx.beginPath();
                ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, r * 0.42, 0, Math.PI * 2);
            ctx.fill();
        } else if (e.type === 'lines') {
            const expand = 1 + elapsed * 0.55;
            ctx.strokeStyle = e.color;
            ctx.lineCap = 'round';
            e.lines.forEach(ln => {
                ctx.globalAlpha = alpha * 0.95;
                ctx.lineWidth = ln.width * (0.35 + 0.65 * alpha);
                const inner = ln.inner * expand;
                const outer = ln.outer * expand;
                ctx.beginPath();
                ctx.moveTo(e.x + Math.cos(ln.angle) * inner, e.y + Math.sin(ln.angle) * inner);
                ctx.lineTo(e.x + Math.cos(ln.angle) * outer, e.y + Math.sin(ln.angle) * outer);
                ctx.stroke();
            });
        } else if (e.type === 'residue') {
            ctx.globalAlpha = alpha * 0.55;
            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * (0.7 + 0.3 * alpha), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    });
}

function drawScreenFlashes(ctx) {
    impactEffects.forEach(e => {
        if (e.type !== 'screenFlash') return;
        if (e.delay && e.delay > 0) return;
        const alpha = Math.max(0, e.life / e.maxLife);
        ctx.globalAlpha = alpha * e.peakAlpha;
        ctx.fillStyle = e.color;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.globalAlpha = 1.0;
    });
}

function spawnEnergyResidue(x, y, color, count, life) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const mag = 18 + Math.random() * 40;
        impactEffects.push({
            type: 'residue',
            x: x + Math.cos(a) * mag * 0.15,
            y: y + Math.sin(a) * mag * 0.15,
            vx: Math.cos(a) * mag,
            vy: Math.sin(a) * mag,
            radius: 3 + Math.random() * 5,
            color,
            life: life * (0.6 + Math.random() * 0.4),
            maxLife: life,
            delay: 0
        });
    }
}

function spawnImpactVFX(kind, x, y, dirAngle, color, sourceType) {
    const burst = (count, speedMin, speedMax, sizeMin, sizeMax, life, spread, col, shape = 'square', angle = dirAngle) => {
        spawnDirectionalParticles(x, y, col, count, angle, spread, speedMin, speedMax, sizeMin, sizeMax, life * 0.6, life, shape);
    };

    if (kind === 'light') {
        spawnImpactFlash(x, y, 14, 'rgba(255,255,255,0.9)', 0.07);
        spawnImpactCore(x, y, 3, 10, '#ffffff', 0.08, 'circle');
        spawnImpactLines(x, y, '#ffffff', 0.09, 4, 4, 8, 10, 18, 1, 1.6, dirAngle, Math.PI * 1.2);
        burst(6, 200, 340, 2, 3, 0.18, Math.PI * 0.85, color);
        burst(3, 320, 420, 2, 3.5, 0.10, Math.PI * 0.28, '#ffffff', 'spark');
        cameraShake = Math.max(cameraShake, 0.08);
    } else if (kind === 'heavy') {
        spawnImpactFlash(x, y, 26, 'rgba(255,255,255,0.92)', 0.10);
        spawnImpactCore(x, y, 5, 18, '#ffffff', 0.12, 'star');
        spawnImpactRing(x, y, 8, 52, color, 0.26, 4);
        spawnImpactLines(x, y, '#ffffff', 0.14, 7, 8, 14, 18, 36, 1.4, 2.4, dirAngle, Math.PI * 1.6);
        burst(10, 260, 500, 3, 5, 0.32, Math.PI * 0.95, color);
        burst(4, 380, 520, 3, 5, 0.14, Math.PI * 0.4, '#ffffff', 'spark');
        spawnImpactFlash(x, y, 18, withAlpha(color, 0.35), 0.08, 0.07, 0.5);
        spawnImpactRing(x, y, 16, 40, withAlpha('#ffffff', 0.5), 0.12, 2, 0.07);
    } else if (kind === 'special1') {
        spawnImpactFlash(x, y, 30, 'rgba(255,255,255,0.9)', 0.11);
        spawnImpactCore(x, y, 6, 22, color, 0.16, 'circle');
        spawnImpactRing(x, y, 8, 64, color, 0.30, 4);
        spawnImpactLines(x, y, color, 0.16, 8, 10, 16, 22, 44, 1.5, 2.6, dirAngle, Math.PI * 1.7);
        burst(12, 280, 540, 3, 5, 0.36, Math.PI * 1.15, color);
        burst(4, 400, 560, 3, 5, 0.16, Math.PI * 0.45, '#ffffff', 'spark');
        burst(2, 360, 520, 4, 6, 0.20, Math.PI * 0.3, color, 'spark');
        spawnImpactFlash(x, y, 22, withAlpha(color, 0.4), 0.09, 0.08, 0.45);
        spawnImpactRing(x, y, 18, 48, withAlpha('#ffffff', 0.55), 0.14, 2, 0.08);
    } else if (kind === 'special2') {
        spawnImpactFlash(x, y, 42, 'rgba(255,255,255,0.95)', 0.14);
        spawnImpactCore(x, y, 8, 30, color, 0.20, 'star');
        spawnImpactRing(x, y, 10, 88, color, 0.38, 5);
        spawnImpactRing(x, y, 6, 56, '#ffffff', 0.26, 2);
        spawnImpactLines(x, y, '#ffffff', 0.18, 10, 12, 20, 28, 58, 1.6, 3.0, dirAngle, Math.PI * 2);
        burst(16, 320, 620, 3, 6, 0.42, Math.PI * 1.4, color);
        burst(6, 420, 640, 3, 6, 0.20, Math.PI * 0.5, '#ffffff', 'spark');
        burst(3, 380, 580, 4, 7, 0.24, Math.PI * 0.35, color, 'spark');
        spawnScreenFlash('#ffffff', 0.08, 0.25);
        spawnImpactFlash(x, y, 28, withAlpha(color, 0.45), 0.10, 0.09, 0.4);
        spawnImpactRing(x, y, 22, 70, withAlpha(color, 0.6), 0.16, 3, 0.09);
    } else if (kind === 'ultimate') {
        spawnImpactFlash(x, y, 64, 'rgba(255,255,255,1)', 0.20);
        spawnImpactCore(x, y, 10, 42, color, 0.28, 'star');
        spawnImpactRing(x, y, 12, 130, color, 0.48, 6);
        spawnImpactRing(x, y, 8, 86, '#ffffff', 0.34, 3);
        spawnImpactLines(x, y, '#ffffff', 0.22, 14, 14, 24, 36, 78, 1.8, 3.4, dirAngle, Math.PI * 2);
        burst(20, 360, 720, 3, 7, 0.48, Math.PI * 2, color);
        burst(8, 480, 740, 3, 6, 0.24, Math.PI * 0.7, '#ffffff', 'spark');
        burst(4, 420, 680, 4, 7, 0.28, Math.PI * 2, color, 'spark');
        spawnEnergyResidue(x, y, color, 8, 0.55);
        spawnScreenFlash('#ffffff', 0.14, 0.4);
        spawnImpactFlash(x, y, 40, withAlpha(color, 0.5), 0.14, 0.10, 0.35);
        spawnImpactRing(x, y, 28, 96, withAlpha('#ffffff', 0.7), 0.20, 3, 0.10);
        spawnImpactCore(x, y, 6, 16, '#ffffff', 0.16, 'circle', 0.10);
    } else if (kind === 'blocked') {
        spawnImpactFlash(x, y, 16, 'rgba(220,230,255,0.7)', 0.07);
        spawnImpactCore(x, y, 4, 12, '#e8eef8', 0.08, 'diamond');
        spawnImpactRing(x, y, 6, 24, 'rgba(255,255,255,0.75)', 0.14, 2);
        spawnImpactLines(x, y, '#ffffff', 0.10, 4, 6, 10, 10, 20, 1.2, 2.0, dirAngle, Math.PI * 0.9);
        burst(4, 260, 400, 2, 3, 0.12, Math.PI * 0.75, '#ffffff', 'spark');
    } else if (kind === 'parry') {
        const src = sourceType || 'light';
        const heavyish = (src === 'heavy');
        const s1 = (src === 'special1');
        const s2 = (src === 'special2');
        const flashR = s2 ? 40 : s1 ? 32 : heavyish ? 28 : 22;
        const corePeak = s2 ? 26 : s1 ? 20 : heavyish ? 18 : 14;
        const ringEnd = s2 ? 78 : s1 ? 64 : heavyish ? 52 : 38;
        const lineN = s2 ? 10 : s1 ? 8 : heavyish ? 7 : 6;
        const parts = s2 ? 14 : s1 ? 10 : heavyish ? 8 : 6;
        spawnImpactFlash(x, y, flashR, 'rgba(255,255,255,0.95)', 0.10);
        spawnImpactCore(x, y, 5, corePeak, '#ffffff', 0.12, 'star');
        spawnImpactRing(x, y, 8, ringEnd, color, 0.28, s2 ? 5 : 3);
        spawnImpactRing(x, y, 6, ringEnd * 0.55, '#ffffff', 0.16, 2);
        spawnImpactLines(x, y, '#ffffff', 0.14, lineN, 8, 14, 16, s2 ? 50 : 32, 1.5, 2.6, dirAngle, Math.PI * 2);
        burst(parts, 280, s2 ? 620 : 480, 2, 5, 0.28, Math.PI * 2, color);
        burst(s2 ? 6 : 4, 360, 560, 3, 5, 0.16, Math.PI * 2, '#ffffff', 'spark');
        if (s1 || s2) burst(3, 340, 520, 3, 6, 0.18, Math.PI * 0.5, color, 'spark');
        if (s2) spawnScreenFlash('#ffffff', 0.06, 0.18);
        if (s2) cameraShake = Math.max(cameraShake, 0.4);
        else if (s1) cameraShake = Math.max(cameraShake, 0.28);
        else if (heavyish) cameraShake = Math.max(cameraShake, 0.22);
        else cameraShake = Math.max(cameraShake, 0.12);
    }
}

// --- 4. FIGHTER CLASS ---
const STATES = { IDLE: 0, WALK: 1, JUMP: 2, LIGHT: 3, HEAVY: 4, SPECIAL_1: 5, BLOCK: 6, HIT: 7, DEAD: 8, SPECIAL_2: 9, ULTIMATE: 10, PARRY: 11, PARRY_RECOVERY: 12, PARRY_SUCCESS: 13, DASH: 14, BACKDASH: 15 };

const PARRY_WINDOW = 0.15;
const PARRY_RECOVERY = 0.20;
const PARRY_SUCCESS_HOLD = 0.14;
const PARRY_ATTACKER_STUN = 0.40;
const PARRY_KNOCKBACK = 300;
const PARRY_ENERGY_REWARD = 15;
const PARRY_HITSTOP = 0.12;

const ATTACK_TIMING = {
    LIGHT:     { total: 0.25, anticipation: 0.07, active: 0.10, recovery: 0.08 }, 
    HEAVY:     { total: 0.50, anticipation: 0.22, active: 0.12, recovery: 0.16 }, 
    SPECIAL_1: { total: 0.40, anticipation: 0.12, active: 0.12, recovery: 0.16 }, 
    SPECIAL_2: { total: 0.90, anticipation: 0.30, active: 0.20, recovery: 0.40 }, 
};

class Fighter {
    constructor(isPlayer, x, color, accentColor) {
        this.isPlayer = isPlayer;
        this.x = x;
        this.y = FLOOR_Y;
        this.vx = 0;
        this.vy = 0;
        this.width = 60;
        this.height = 140;
        this.color = color;
        this.accentColor = accentColor;
        this.dir = isPlayer ? 1 : -1;
        
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.energy = 0; 
        
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        this.dashCooldownTimer = 0;
        
        this.comboCount = 0;
        this.comboTimer = 0;
        this.attackHasHit = false;
        
        this.aiTimer = 0;
        this.aiJumpCooldown = 0;
        this.aiParryCooldown = 0;
        this.aiAttackCooldown = 0; // NEW: CPU attack cadence pacing
        this.aiDashCooldown = 0; // NEW: CPU dash usage cooldown
    }

    reset(x) {
        this.x = x; this.y = FLOOR_Y;
        this.vx = 0; this.vy = 0;
        this.hp = this.maxHp; this.energy = 0;
        this.state = STATES.IDLE;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.dashCooldownTimer = 0;
        this.dir = this.isPlayer ? 1 : -1;
        this.aiJumpCooldown = 0;
        this.aiParryCooldown = 0;
        this.aiAttackCooldown = 0;
        this.aiDashCooldown = 0;
    }

    update(dt, opponent) {
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        if (this.state === STATES.DASH) {
            this.vx = this.dir * 850;
            if (Math.random() < 0.4) {
                spawnDirectionalParticles(this.x - this.dir * 10, this.y - 70, this.accentColor, 1, (this.dir === 1 ? Math.PI : 0), 0.3, 100, 200, 2, 4, 0.15, 0.25, 'spark');
            }
        } else if (this.state === STATES.BACKDASH) {
            this.vx = -this.dir * 700;
            if (Math.random() < 0.3) {
                spawnDirectionalParticles(this.x, this.y, '#cccccc', 1, -Math.PI/2, Math.PI, 40, 90, 2, 3, 0.2, 0.3, 'square');
            }
        }

        this.y += this.vy * dt;

        if (this.y < FLOOR_Y) {
            this.vy += 2500 * dt;
            if (this.state === STATES.IDLE || this.state === STATES.WALK) this.state = STATES.JUMP;
        } else {
            this.vy = 0;
            this.y = FLOOR_Y;
            if (this.state === STATES.JUMP) this.state = STATES.IDLE;
        }

        this.vx *= Math.pow(0.01, dt); 
        this.x += this.vx * dt;

        if (this.x < 30) this.x = 30;
        if (this.x > GAME_WIDTH - 30) this.x = GAME_WIDTH - 30;

        if (this.state === STATES.IDLE || this.state === STATES.WALK || this.state === STATES.BLOCK) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
        }

        if (this.stateTimer > 0) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                if (this.state === STATES.DEAD) return; 
                if (this.state === STATES.PARRY) {
                    this.state = STATES.PARRY_RECOVERY;
                    this.stateTimer = PARRY_RECOVERY;
                    this.attackHasHit = false;
                } else {
                    if (this.state === STATES.DASH || this.state === STATES.BACKDASH) {
                        this.vx *= 0.1; 
                    }
                    this.state = STATES.IDLE;
                    this.attackHasHit = false;
                }
            }
        }

        if (this.aiJumpCooldown > 0) this.aiJumpCooldown -= dt;
        if (this.aiParryCooldown > 0) this.aiParryCooldown -= dt;
        if (this.aiAttackCooldown > 0) this.aiAttackCooldown -= dt;
        if (this.aiDashCooldown > 0) this.aiDashCooldown -= dt;

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                if (this.isPlayer) {
                    if (domCombo) domCombo.classList.add('hidden');
                } else {
                    if (domCpuCombo) domCpuCombo.classList.add('hidden');
                }
            }
        }

        if (this.energy < 100 && currentState === GAME_STATE.PLAYING) {
            this.energy += 5 * dt;
        }

        if (currentState === GAME_STATE.PLAYING && this.state !== STATES.DEAD && this.state !== STATES.HIT
            && this.state !== STATES.PARRY && this.state !== STATES.PARRY_RECOVERY && this.state !== STATES.PARRY_SUCCESS) {
            if (this.isPlayer) this.handlePlayerInput(opponent);
            else this.handleAI(dt, opponent);
        }

        if ((this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2) && !this.attackHasHit) {
            this.checkAttackHit(opponent);
        }
    }

    handlePlayerInput(opponent) {
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2 || this.state === STATES.ULTIMATE || this.state === STATES.DASH || this.state === STATES.BACKDASH) {
            // Discard any SHIFT press made while locked in an action, so it cannot
            // queue another dash after this one ends.
            keys['shift_trigger'] = false;
            return;
        }
        
        if (keys['l']) {
            if (this.energy >= 100) { this.attack(STATES.ULTIMATE, opponent); return; } 
            else if (this.energy >= 66) { this.attack(STATES.SPECIAL_2, opponent); return; } 
            else if (this.energy >= 33) { this.attack(STATES.SPECIAL_1, opponent); return; }
        } else if (keys['k']) {
            this.attack(STATES.HEAVY, opponent); return;
        } else if (keys['j']) {
            this.attack(STATES.LIGHT, opponent); return;
        }

        if (keys['p_trigger']) {
            keys['p_trigger'] = false;
            this.startParry();
            return;
        }

        if (keys['s']) {
            this.state = STATES.BLOCK;
            this.vx = 0;
            return;
        }

        // --- DASH (SHIFT) ---
        // Direction is decided ONCE, at the moment the dash starts: held A/D
        // overrides it, otherwise the current facing direction is used.
        // startDash() locks facing for the whole dash (facing is only re-derived
        // in IDLE/WALK/BLOCK), and this early-return ignores A/D until it ends,
        // so no input can reverse an in-progress dash.
        if (keys['shift_trigger']) {
            keys['shift_trigger'] = false;
            if (this.dashCooldownTimer <= 0) {
                if (keys['d'] && !keys['a']) this.dir = 1;
                else if (keys['a'] && !keys['d']) this.dir = -1;
                // Neither (or both) held: keep the current facing direction as-is.
                this.startDash(STATES.DASH);
                return;
            }
        }

        if (keys['a']) {
            this.vx = -400;
            if(this.y === FLOOR_Y) this.state = STATES.WALK;
        } else if (keys['d']) {
            this.vx = 400;
            if(this.y === FLOOR_Y) this.state = STATES.WALK;
        } else {
            if(this.y === FLOOR_Y) this.state = STATES.IDLE;
        }

        if (keys['space_trigger'] && this.y === FLOOR_Y) {
            this.vy = -900;
            this.state = STATES.JUMP;
            keys['space_trigger'] = false; 
        }
    }

    handleAI(dt, opponent) {
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2 || this.state === STATES.ULTIMATE || this.state === STATES.DASH || this.state === STATES.BACKDASH) return;
        if (this.state === STATES.PARRY || this.state === STATES.PARRY_RECOVERY || this.state === STATES.PARRY_SUCCESS) return;
        
        this.aiTimer -= dt;
        if (this.aiTimer > 0) return; 

        const dist = Math.abs(opponent.x - this.x);
        this.aiTimer = Math.random() * 0.2 + 0.1; 

        if (this.tryCpuParry(opponent, dist)) return;

        const canAttack = (this.aiAttackCooldown <= 0);

        // Occasional air dash while airborne (reuses the existing dash system + cooldown)
        if (this.y < FLOOR_Y && this.aiDashCooldown <= 0 && Math.random() < 0.06) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
            this.startDash(STATES.DASH);
            this.aiDashCooldown = 1.5 + Math.random() * 1.5; // ~1.5-3.0s
            return;
        }

        if (dist > 300) {
            if (dist <= 380 && canAttack && this.decideSpecialAttack(opponent)) {
                // handled
            } else if (this.y === FLOOR_Y && this.aiDashCooldown <= 0 && Math.random() < 0.10) {
                // Occasional dash-in: close distance using the existing dash system
                this.dir = (opponent.x > this.x) ? 1 : -1;
                this.startDash(STATES.DASH);
                this.aiDashCooldown = 1.4 + Math.random() * 1.4; // ~1.4-2.8s
            } else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && Math.random() < 0.25) {
                this.vy = -900;
                this.state = STATES.JUMP;
                this.aiJumpCooldown = 2.0; 
            } else {
                this.vx = this.dir * 350;
                if(this.y === FLOOR_Y) this.state = STATES.WALK;
            }
        } else if (dist < 150) {
            const rand = Math.random();
            if (this.y === FLOOR_Y && this.aiDashCooldown <= 0 && rand < 0.08) {
                // Occasional backdash-out: create space using the existing dash system
                this.dir = (opponent.x > this.x) ? 1 : -1;
                this.startDash(STATES.BACKDASH);
                this.aiDashCooldown = 1.2 + Math.random() * 1.2; // ~1.2-2.4s
            } else if (canAttack && this.decideSpecialAttack(opponent)) {
                // handled
            } else if (opponent.state === STATES.LIGHT || opponent.state === STATES.HEAVY) {
                if (rand < 0.5) this.state = STATES.BLOCK; 
                else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && rand < 0.8) {
                    this.vy = -900;
                    this.state = STATES.JUMP;
                    this.aiJumpCooldown = 2.0;
                }
            } else {
                if (canAttack && rand < 0.4) this.attack(STATES.LIGHT, opponent);
                else if (canAttack && rand < 0.7) this.attack(STATES.HEAVY, opponent);
                else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && rand < 0.85) {
                    this.vy = -900;
                    this.state = STATES.JUMP;
                    this.aiJumpCooldown = 2.0;
                } else {
                    this.vx = -this.dir * 300; 
                }
            }
        } else {
            const rand = Math.random();
            if (canAttack && this.decideSpecialAttack(opponent)) {
                // handled
            } else if (opponent.y < FLOOR_Y && this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && rand < 0.4) {
                this.vy = -900;
                this.state = STATES.JUMP;
                this.aiJumpCooldown = 2.0;
            } else {
                this.vx = this.dir * 300;
                if(this.y === FLOOR_Y) this.state = STATES.WALK;
            }
        }
    }

    decideSpecialAttack(opponent) {
        if (this.energy >= 100 && Math.random() < 0.6) {
            this.attack(STATES.ULTIMATE, opponent);
            return true;
        }
        if (this.energy >= 66 && Math.random() < 0.45) {
            this.attack(STATES.SPECIAL_2, opponent);
            return true;
        }
        if (this.energy >= 33 && Math.random() < 0.4) {
            this.attack(STATES.SPECIAL_1, opponent);
            return true;
        }
        return false;
    }

    startParry() {
        this.state = STATES.PARRY;
        this.stateTimer = PARRY_WINDOW;
        this.vx = 0;
    }
    
    startDash(type) {
        this.state = type;
        this.stateTimer = (type === STATES.DASH) ? 0.20 : 0.22;
        this.dashCooldownTimer = 0.35;
        this.vx = 0; 
        this.attackHasHit = false;
        
        playSound(type === STATES.DASH ? 'dash' : 'backdash');
        
        if (type === STATES.DASH) {
            spawnDirectionalParticles(this.x, this.y - 70, this.accentColor, 4, (this.dir === 1 ? Math.PI : 0), 0.4, 200, 400, 2, 5, 0.15, 0.25, 'spark');
        } else {
            spawnDirectionalParticles(this.x, this.y - 10, '#ffffff', 5, -Math.PI/2, Math.PI, 100, 200, 2, 4, 0.2, 0.3, 'square');
        }
    }

    tryCpuParry(opponent, dist) {
        if (this.aiParryCooldown > 0) return false;
        if (dist > 220) return false;
        const phase = opponent.getAttackPhase && opponent.getAttackPhase();
        if (!phase) return false;
        if (phase.phase !== 'anticipation' && phase.phase !== 'active') return false;
        let chance = 0.12;
        if (opponent.state === STATES.HEAVY) chance = 0.15;
        else if (opponent.state === STATES.SPECIAL_1) chance = 0.12;
        else if (opponent.state === STATES.SPECIAL_2) chance = 0.10;
        else if (opponent.state === STATES.LIGHT) chance = 0.10;
        if (Math.random() >= chance) {
            this.aiParryCooldown = 0.45; 
            return false;
        }
        this.startParry();
        this.aiParryCooldown = 1.6;
        return true;
    }

    attack(type, opponent) {
        if (opponent) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
        }

        if (type === STATES.ULTIMATE) {
            startUltimate(this, opponent);
            if (!this.isPlayer) {
                // Ensure a safe, sizable pause after executing an ultimate
                this.aiAttackCooldown = 2.7 + 0.5 + Math.random() * 0.3;
            }
            return;
        }

        this.state = type;
        this.attackHasHit = false;
        this.vx = 0; 

        if (type === STATES.LIGHT) {
            this.stateTimer = 0.25;
            playSound('light');
        } else if (type === STATES.HEAVY) {
            this.stateTimer = 0.5;
            this.vx = this.dir * 200; 
            playSound('heavy');
        } else if (type === STATES.SPECIAL_1) {
            this.stateTimer = 0.4;
            this.energy = Math.max(0, this.energy - 33); 
            playSound('special');
        } else if (type === STATES.SPECIAL_2) {
            this.stateTimer = 0.9;
            this.energy = Math.max(0, this.energy - 66); 
            playSound('special2');
        }

        // --- NEW CPU CADENCE FIX ---
        // Dynamically scales the post-attack 'breathing room' depending on the weight of the move 
        if (!this.isPlayer) {
            let postAttackDelay = 0.3;
            if (type === STATES.LIGHT) postAttackDelay = 0.2 + Math.random() * 0.2; // 200 - 400ms
            else if (type === STATES.HEAVY) postAttackDelay = 0.3 + Math.random() * 0.3; // 300 - 600ms
            else if (type === STATES.SPECIAL_1) postAttackDelay = 0.4 + Math.random() * 0.2; // 400 - 600ms
            else if (type === STATES.SPECIAL_2) postAttackDelay = 0.5 + Math.random() * 0.3; // 500 - 800ms
            
            // Because aiAttackCooldown ticks down DURING the animation, we add the attack's overall length
            this.aiAttackCooldown = this.stateTimer + postAttackDelay;
        }
    }

    getAttackPhase() {
        let timing;
        if (this.state === STATES.LIGHT) timing = ATTACK_TIMING.LIGHT;
        else if (this.state === STATES.HEAVY) timing = ATTACK_TIMING.HEAVY;
        else if (this.state === STATES.SPECIAL_1) timing = ATTACK_TIMING.SPECIAL_1;
        else if (this.state === STATES.SPECIAL_2) timing = ATTACK_TIMING.SPECIAL_2;
        else return null;

        const activeFrameStart = timing.total - timing.anticipation; 
        const activeFrameEnd = activeFrameStart - timing.active;     

        let phase;
        if (this.stateTimer > activeFrameStart) phase = 'anticipation';
        else if (this.stateTimer > activeFrameEnd) phase = 'active';
        else phase = 'recovery';

        return { phase, activeFrameStart, activeFrameEnd, timing };
    }

    checkAttackHit(opponent) {
        if (opponent.state === STATES.DEAD) return;

        let reach = 0;
        let damage = 0;
        let knockback = 0;
        let stunTime = 0;
        let hitType = '';

        if (this.state === STATES.LIGHT) { reach = 100; damage = 5; knockback = 150; stunTime = 0.3; hitType = 'light';}
        if (this.state === STATES.HEAVY) { reach = 150; damage = 12; knockback = 500; stunTime = 0.5; hitType = 'heavy';}
        if (this.state === STATES.SPECIAL_1) { reach = 180; damage = 28; knockback = 400; stunTime = 0.35; hitType = 'special1';}
        if (this.state === STATES.SPECIAL_2) { reach = 450; damage = 45; knockback = 700; stunTime = 0.6; hitType = 'special2';}

        const phaseInfo = this.getAttackPhase();
        if (!phaseInfo || phaseInfo.phase !== 'active') return;

        const dist = (opponent.x - this.x) * this.dir; 
        const yDist = Math.abs(opponent.y - this.y);
        
        let maxVerticalDist = (this.state === STATES.SPECIAL_2) ? 140 : 100;

        const attackerAirborne = this.y < FLOOR_Y;
        const opponentGrounded = opponent.y >= FLOOR_Y;
        if (this.state === STATES.HEAVY && attackerAirborne && opponentGrounded) {
            maxVerticalDist = 180;
        }

        let isHit;
        if (this.state === STATES.LIGHT) {
            const opponentHalfWidth = opponent.width / 2; 
            const effectiveReach = reach + opponentHalfWidth;
            isHit = (dist > 0 && dist < effectiveReach && yDist < maxVerticalDist);
        } else {
            isHit = (dist > 0 && dist < reach && yDist < maxVerticalDist);
        }

        if (isHit) {
            this.attackHasHit = true;
            const result = opponent.takeDamage(damage, knockback * this.dir, stunTime, hitType);

            if (result.parried) {
                this.comboCount = 0;
                this.comboTimer = 0;
                if (this.isPlayer) {
                    if (domCombo) domCombo.classList.add('hidden');
                } else {
                    if (domCpuCombo) domCpuCombo.classList.add('hidden');
                }
                this.state = STATES.HIT;
                this.stateTimer = PARRY_ATTACKER_STUN;
                this.vx = -this.dir * PARRY_KNOCKBACK;
                this.attackHasHit = true;
                return;
            }

            if (!result.blocked) {
                this.comboCount++;
                this.comboTimer = 1.0;
                if (this.comboCount > 1) {
                    if (this.isPlayer) updatePlayerComboUI(this.comboCount);
                    else updateCpuComboUI(this.comboCount);
                }
                this.energy = Math.min(100, this.energy + 10); 
                
                // --- COMBO PRESERVATION FIX ---
                // Wipes the cadence delay exclusively on unblocked hits so the CPU can freely and rapidly chain combinations
                if (!this.isPlayer) {
                    this.aiAttackCooldown = 0;
                }
            } else {
                this.comboCount = 0;
                this.comboTimer = 0;
                if (this.isPlayer) {
                    if (domCombo) domCombo.classList.add('hidden');
                } else {
                    if (domCpuCombo) domCpuCombo.classList.add('hidden');
                }
            }
        }
    }

    takeDamage(amount, knockback, stunTime, type) {
        let actualDamage = amount;
        let actualKnockback = knockback;
        let blocked = false;
        let hitStopDuration = 0;
        let vfxKind = type; 

        if (this.state === STATES.PARRY && type !== 'ultimate') {
            this.state = STATES.PARRY_SUCCESS;
            this.stateTimer = PARRY_SUCCESS_HOLD;
            this.energy = Math.min(100, this.energy + PARRY_ENERGY_REWARD);
            playSound('parry');
            if (typeof hitStopTimer !== 'undefined') {
                hitStopTimer = Math.max(hitStopTimer, PARRY_HITSTOP);
            }
            const hitDirSign = knockback !== 0 ? Math.sign(knockback) : 1;
            const dirAngle = hitDirSign >= 0 ? 0 : Math.PI;
            const vfxX = this.x - hitDirSign * 22;
            spawnImpactVFX('parry', vfxX, this.y - 70, dirAngle, this.accentColor, type);
            return { blocked: true, parried: true, damage: 0 };
        }

        if (this.state === STATES.BLOCK) {
            blocked = true;
            vfxKind = 'blocked';
            actualDamage = Math.floor(amount * 0.2);
            actualKnockback = knockback * 0.1;
            playSound('block');
            this.energy = Math.min(100, this.energy + 5);
            hitStopDuration = 0.02; 
        } else {
            this.state = STATES.HIT;
            this.stateTimer = stunTime;
            playSound('hit');
            
            if (type === 'heavy' || type === 'special1') cameraShake = Math.max(cameraShake, 0.3);
            else if (type === 'special2') cameraShake = Math.max(cameraShake, 0.45);
            else if (type === 'ultimate') cameraShake = Math.max(cameraShake, 0.6);

            if (type === 'light') hitStopDuration = 0.045; 
            else if (type === 'heavy') hitStopDuration = 0.08; 
            else if (type === 'special1') hitStopDuration = 0.09; 
            else if (type === 'special2') hitStopDuration = 0.11; 
            else if (type === 'ultimate') hitStopDuration = 0.18; 
        }

        if (typeof hitStopTimer !== 'undefined') {
            hitStopTimer = Math.max(hitStopTimer, hitStopDuration);
        }

        this.hp -= actualDamage; 
        this.vx = actualKnockback;
        updateHealthUI();

        const hitDirSign = actualKnockback !== 0 ? Math.sign(actualKnockback) : (knockback !== 0 ? Math.sign(knockback) : 1);
        const dirAngle = hitDirSign >= 0 ? 0 : Math.PI;
        const vfxX = this.x - hitDirSign * (blocked ? 28 : 18);
        spawnImpactVFX(vfxKind, vfxX, this.y - 70, dirAngle, this.accentColor);

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = STATES.DEAD;
            this.stateTimer = 999;
            this.vx = knockback * 1.5; 
            this.vy = -400;
            spawnParticles(this.x, this.y - 70, this.color, 50, 800);
            checkRoundEnd();
        }

        return { blocked, damage: actualDamage };
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1); 

        ctx.fillStyle = this.color;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        
        if (this.state === STATES.DEAD) {
            ctx.fillRect(-this.height/2, -20, this.height, 20);
        } else if (this.state === STATES.HIT) {
            ctx.rotate(-0.2);
            ctx.fillRect(-20, -120, 40, 100); 
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -140, 30, 30); 
        } else if (this.state === STATES.PARRY || this.state === STATES.PARRY_SUCCESS) {
            ctx.fillRect(-18, -120, 40, 100);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -148, 30, 30);
            const pulse = this.state === STATES.PARRY_SUCCESS ? 1 : (0.45 + 0.55 * (this.stateTimer / PARRY_WINDOW));
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.35 + 0.55 * pulse;
            ctx.beginPath();
            ctx.arc(28, -80, 18 + pulse * 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = this.state === STATES.PARRY_SUCCESS ? '#ffffff' : this.accentColor;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(18, -110, 50, 8);
            ctx.globalAlpha = 1.0;
        } else if (this.state === STATES.PARRY_RECOVERY) {
            ctx.fillRect(-20, -105, 40, 105);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -132, 30, 28);
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(22, -70, 12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } else if (this.state === STATES.BLOCK) {
            ctx.fillRect(-20, -100, 40, 100);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -130, 30, 30); 
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(30, -120);
            ctx.lineTo(40, -60);
            ctx.lineTo(30, 0);
            ctx.stroke();
        } else {
            let lean = 0;
            if (this.state === STATES.WALK) lean = 0.2;
            if (this.state === STATES.JUMP) lean = -0.1;
            if (this.state === STATES.DASH) lean = 0.4;
            if (this.state === STATES.BACKDASH) lean = -0.25;
            
            ctx.rotate(lean);
            ctx.fillRect(-20, -120, 40, 100); 
            
            ctx.fillStyle = this.accentColor;
            const wave = Math.sin(Date.now() / 150) * 10;
            ctx.fillRect(-40, -110 + wave, 30, 15);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -150, 30, 30);

            const atk = this.getAttackPhase();
            if (this.state === STATES.LIGHT && atk) {
                ctx.fillStyle = this.accentColor;
                if (atk.phase === 'anticipation') {
                    ctx.globalAlpha = 0.5;
                    ctx.fillRect(15, -105, 15, 10);
                    ctx.globalAlpha = 1.0;
                } else if (atk.phase === 'active') {
                    ctx.fillRect(20, -100, 80, 10);
                } else {
                    ctx.globalAlpha = 0.25;
                    ctx.fillRect(20, -100, 80, 10);
                    ctx.globalAlpha = 1.0;
                }
            } else if (this.state === STATES.HEAVY && atk) {
                ctx.fillStyle = this.accentColor;
                if (atk.phase === 'anticipation') {
                    ctx.globalAlpha = 0.8;
                    ctx.rotate(-Math.PI / 3);
                    ctx.fillRect(0, -160, 20, 90);
                    ctx.globalAlpha = 1.0;
                } else if (atk.phase === 'active') {
                    const activeSpan = atk.activeFrameStart - atk.activeFrameEnd;
                    const swingProgress = activeSpan > 0 ? (this.stateTimer - atk.activeFrameEnd) / activeSpan : 0; 
                    ctx.rotate(swingProgress * Math.PI - Math.PI/4);
                    ctx.fillRect(0, -140, 20, 120);
                } else {
                    ctx.globalAlpha = 0.4;
                    ctx.fillRect(0, -60, 20, 60);
                    ctx.globalAlpha = 1.0;
                }
            } else if (this.state === STATES.SPECIAL_1 && atk) {
                ctx.fillStyle = this.accentColor;
                if (atk.phase === 'anticipation') {
                    const chargeT = 1 - (this.stateTimer - atk.activeFrameStart) / atk.timing.anticipation; 
                    ctx.globalAlpha = 0.3 + 0.5 * chargeT;
                    ctx.beginPath();
                    ctx.arc(20, -100, 8 + chargeT * 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                } else if (atk.phase === 'active') {
                    ctx.globalAlpha = 0.9;
                    ctx.fillRect(20, -110, 160, 20);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(20, -102, 160, 4);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.globalAlpha = 0.25;
                    ctx.fillRect(20, -110, 160, 20);
                    ctx.globalAlpha = 1.0;
                }
            } else if (this.state === STATES.SPECIAL_2 && atk) {
                ctx.fillStyle = this.accentColor;
                if (atk.phase === 'anticipation') {
                    const chargeT = 1 - (this.stateTimer - atk.activeFrameStart) / atk.timing.anticipation; 
                    ctx.globalAlpha = 0.3 + 0.5 * chargeT;
                    ctx.beginPath();
                    ctx.arc(20, -110, 14 + chargeT * 20, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                } else if (atk.phase === 'active') {
                    ctx.globalAlpha = 0.85;
                    ctx.fillRect(30, -140, 420, 90);
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(30, -110, 420, 30);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.globalAlpha = 0.2;
                    ctx.fillRect(30, -140, 420, 90);
                    ctx.globalAlpha = 1.0;
                }
            } else if (this.state === STATES.ULTIMATE) {
                ctx.fillStyle = this.accentColor;
                ctx.globalAlpha = 0.9;
                ctx.fillRect(15, -130, 90, 8);
                ctx.globalAlpha = 1.0;
            }
        }
        
        ctx.restore();
    }
}

// Instantiate Fighters (isPlayer, x, color, accentColor)
const player = new Fighter(true, 300, '#222', '#00f3ff');
const enemy = new Fighter(false, 980, '#222', '#ff00ea');

// --- 4b. ULTIMATE CINEMATIC SYSTEM ---
const ULTIMATE_TIMELINE = [
    { t: 0.30, action: 'dash' },
    { t: 0.50, action: 'slash1' },
    { t: 0.70, action: 'slash2' },
    { t: 0.90, action: 'slash3' },
    { t: 1.10, action: 'rapid' },
    { t: 1.80, action: 'reposition' },
    { t: 2.00, action: 'finish' },
    { t: 2.70, action: 'end' },
];
const ULTIMATE_DAMAGE = 80; 

function startUltimate(attacker, opponent) {
    if (currentState === GAME_STATE.ULTIMATE) return; 

    attacker.state = STATES.ULTIMATE;
    attacker.stateTimer = 0;
    attacker.attackHasHit = false;
    attacker.vx = 0;
    attacker.vy = 0;
    attacker.energy = 0; 

    ultimateData = {
        attacker,
        opponent,
        timer: 0,
        nextBeat: 0,
        origAttackerDir: attacker.dir,
        origOpponentX: opponent.x,
    };

    currentState = GAME_STATE.ULTIMATE;
}

function endUltimateCinematic() {
    const u = ultimateData;
    if (u) {
        const attacker = u.attacker;
        attacker.state = STATES.IDLE;
        attacker.stateTimer = 0;
        attacker.attackHasHit = false;
        attacker.x = Math.max(30, Math.min(GAME_WIDTH - 30, attacker.x));
    }
    ultimateData = null;
    if (currentState === GAME_STATE.ULTIMATE) {
        currentState = GAME_STATE.PLAYING;
    }
}

function updateUltimateCinematic(dt) {
    if (currentState !== GAME_STATE.ULTIMATE || !ultimateData) {
        ultimateData = null;
        return;
    }

    const u = ultimateData;
    const attacker = u.attacker;
    const opponent = u.opponent;
    const dir = u.origAttackerDir;
    u.timer += dt;

    while (u.nextBeat < ULTIMATE_TIMELINE.length && u.timer >= ULTIMATE_TIMELINE[u.nextBeat].t) {
        const action = ULTIMATE_TIMELINE[u.nextBeat].action;
        u.nextBeat++;

        if (action === 'dash') {
            playSound('special');
        } else if (action === 'slash1' || action === 'slash2' || action === 'slash3') {
            playSound('light');
            spawnParticles(opponent.x - dir * 20, opponent.y - 80, attacker.accentColor, 15, 500);
            cameraShake = Math.max(cameraShake, 0.15);
        } else if (action === 'rapid') {
            playSound('heavy');
        } else if (action === 'reposition') {
            attacker.dir = -dir; 
        } else if (action === 'finish') {
            playSound('ultimate');
            const result = opponent.takeDamage(ULTIMATE_DAMAGE, 1000 * dir, 0.8, 'ultimate');

            if (!result.blocked) {
                attacker.comboCount++;
                attacker.comboTimer = 1.0;
                if (attacker.comboCount > 1) {
                    if (attacker.isPlayer) updatePlayerComboUI(attacker.comboCount);
                    else updateCpuComboUI(attacker.comboCount);
                }
            } else {
                attacker.comboCount = 0;
                attacker.comboTimer = 0;
                if (attacker.isPlayer) { if (domCombo) domCombo.classList.add('hidden'); }
                else { if (domCpuCombo) domCpuCombo.classList.add('hidden'); }
            }
            spawnParticles(opponent.x, opponent.y - 70, attacker.accentColor, 60, 900);
        } else if (action === 'end') {
            endUltimateCinematic();
            return; 
        }
    }

    if (u.timer >= 0.30 && u.timer < 0.50) {
        const t = Math.min(1, (u.timer - 0.30) / 0.20);
        const targetX = u.origOpponentX - dir * 80;
        if (u._dashFromX === undefined) u._dashFromX = attacker.x;
        attacker.x = u._dashFromX + (targetX - u._dashFromX) * t;
        spawnParticles(attacker.x, attacker.y - 70, attacker.accentColor, 1, 250);
    } else if (u.timer >= 1.80 && u.timer < 2.00) {
        const t = Math.min(1, (u.timer - 1.80) / 0.20);
        const startX = u.origOpponentX - dir * 80;
        const behindX = u.origOpponentX + dir * 60;
        attacker.x = startX + (behindX - startX) * t;
    }
}

function drawUltimateOverlay(ctx) {
    if (!ultimateData) return;
    const t = ultimateData.timer;
    const attacker = ultimateData.attacker;
    const accent = attacker.accentColor;

    ctx.save();

    let darken = 0;
    if (t < 0.3) darken = (t / 0.3) * 0.5;
    else if (t < 2.3) darken = 0.5;
    else if (t < 2.7) darken = 0.5 * (1 - (t - 2.3) / 0.4);
    if (darken > 0) {
        ctx.fillStyle = `rgba(0,0,0,${darken.toFixed(2)})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (t >= 2.0 && t < 2.15) {
        const flashAlpha = 1 - (t - 2.0) / 0.15;
        ctx.fillStyle = `rgba(255,255,255,${(flashAlpha * 0.8).toFixed(2)})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    if (t >= 0.5 && t < 1.8) {
        const fadeIn = Math.min(1, (t - 0.5) * 4);
        const fadeOut = t > 1.6 ? Math.max(0, (1.8 - t) * 5) : 1;
        ctx.fillStyle = accent;
        ctx.font = 'italic bold 64px Trebuchet MS, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = accent;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = fadeIn * fadeOut;
        ctx.fillText((attacker.isPlayer ? 'PLAYER' : 'CPU') + ' ULTIMATE!', GAME_WIDTH / 2, 140);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// --- 5. UI & MATCH MANAGEMENT ---

const domP1Health = document.getElementById('p1-health');
const domP2Health = document.getElementById('p2-health');
const domP1Energy = document.getElementById('p1-energy');
const domP2Energy = document.getElementById('p2-energy');
const domTimer = document.getElementById('timer');
const domCenterMsg = document.getElementById('center-message');
const domCombo = document.getElementById('combo-display');
const domComboCount = document.getElementById('combo-count');
const domP1Wins = document.getElementById('p1-wins');
const domP2Wins = document.getElementById('p2-wins');

const domCpuCombo = document.getElementById('cpu-combo-display');
const domCpuComboCount = document.getElementById('cpu-combo-count');

const domP1SpecialTag = document.getElementById('p1-special-tag');
const domP2SpecialTag = document.getElementById('p2-special-tag');

function updateHealthUI() {
    domP1Health.style.width = `${Math.max(0, player.hp)}%`;
    domP2Health.style.width = `${Math.max(0, enemy.hp)}%`;
}

function updateEnergyUI() {
    domP1Energy.style.width = `${100 - player.energy}%`;
    domP2Energy.style.width = `${100 - enemy.energy}%`;

    domP1Energy.style.background = '';
    domP2Energy.style.background = '';

    if (player.energy >= 100) {
        domP1Energy.parentElement.classList.add('ultimate-glow');
    } else {
        domP1Energy.parentElement.classList.remove('ultimate-glow');
    }

    if (enemy.energy >= 100) {
        domP2Energy.parentElement.classList.add('ultimate-glow');
    } else {
        domP2Energy.parentElement.classList.remove('ultimate-glow');
    }

    updateSpecialTag(domP1SpecialTag, player.energy);
    updateSpecialTag(domP2SpecialTag, enemy.energy);
}

function updateSpecialTag(tagEl, energy) {
    if (!tagEl) return;
    tagEl.classList.remove('level2', 'ultimate');
    if (energy >= 100) {
        tagEl.innerText = 'ULTIMATE READY';
        tagEl.classList.add('ultimate');
        tagEl.classList.remove('hidden');
    } else if (energy >= 66) {
        tagEl.innerText = 'SUPER READY';
        tagEl.classList.add('level2');
        tagEl.classList.remove('hidden');
    } else if (energy >= 33) {
        tagEl.innerText = 'SPECIAL READY';
        tagEl.classList.remove('hidden');
    } else {
        tagEl.classList.add('hidden');
    }
}

function updatePlayerComboUI(count) {
    domComboCount.innerText = count;
    domCombo.classList.remove('hidden');
    domCombo.style.animation = 'none';
    domCombo.offsetHeight; 
    domCombo.style.animation = 'slideRight 0.3s ease-out';
    
    setTimeout(() => {
        if(player.comboCount === 0) domCombo.classList.add('hidden');
    }, 1500);
}

function updateCpuComboUI(count) {
    domCpuComboCount.innerText = count;
    domCpuCombo.classList.remove('hidden');
    domCpuCombo.style.animation = 'none';
    domCpuCombo.offsetHeight;
    domCpuCombo.style.animation = 'slideLeft 0.3s ease-out';

    setTimeout(() => {
        if(enemy.comboCount === 0) domCpuCombo.classList.add('hidden');
    }, 1500);
}

function updateWinsUI() {
    domP1Wins.innerText = p1Wins === 0 ? "〇 〇" : p1Wins === 1 ? "⬤ 〇" : "⬤ ⬤";
    domP2Wins.innerText = p2Wins === 0 ? "〇 〇" : p2Wins === 1 ? "〇 ⬤" : "⬤ ⬤";
}

function showCenterMessage(msg, duration = 2000) {
    domCenterMsg.innerText = msg;
    domCenterMsg.classList.remove('hidden');
    setTimeout(() => domCenterMsg.classList.add('hidden'), duration);
}

function resetMatch() {
    p1Wins = 0; p2Wins = 0; roundCount = 1;
    updateWinsUI();
    startRound();
}

function startRound() {
    player.reset(300);
    enemy.reset(980);
    updateHealthUI();
    updateEnergyUI();

    hitStopTimer = 0; 

    domCombo.classList.add('hidden');
    domCpuCombo.classList.add('hidden');
    
    roundTime = 60;
    domTimer.innerText = roundTime;
    
    currentState = GAME_STATE.COUNTDOWN;
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    
    particles = [];
    impactEffects = []; 

    showCenterMessage("ROUND " + roundCount);
    setTimeout(() => {
        if(currentState !== GAME_STATE.COUNTDOWN) return;
        showCenterMessage("FIGHT!", 1000);
        currentState = GAME_STATE.PLAYING;
        startTimer();
    }, 2000);
}

function startTimer() {
    clearInterval(roundTimerId);
    roundTimerId = setInterval(() => {
        if (currentState === GAME_STATE.PLAYING && hitStopTimer <= 0) {
            roundTime--;
            domTimer.innerText = roundTime;
            if (roundTime <= 0) checkRoundEnd(true);
        }
    }, 1000);
}

function checkRoundEnd(timeUp = false) {
    if (currentState === GAME_STATE.ROUND_OVER) return;

    if (player.hp <= 0 || enemy.hp <= 0 || timeUp) {
        currentState = GAME_STATE.ROUND_OVER;
        clearInterval(roundTimerId);
        
        let msg = "";
        if (player.hp > enemy.hp) { msg = "PLAYER WINS"; p1Wins++; }
        else if (enemy.hp > player.hp) { msg = "CPU WINS"; p2Wins++; }
        else { msg = "DRAW"; }

        updateWinsUI();
        showCenterMessage(msg, 3000);

        setTimeout(() => {
            if (p1Wins >= 2 || p2Wins >= 2) {
                currentState = GAME_STATE.MATCH_OVER;
                document.getElementById('match-winner').innerText = p1Wins >= 2 ? "PLAYER WINS THE MATCH!" : "CPU WINS THE MATCH!";
                document.getElementById('match-winner').style.color = p1Wins >= 2 ? "var(--primary-cyan)" : "var(--primary-magenta)";
                document.getElementById('result-screen').classList.remove('hidden');
            } else {
                roundCount++;
                startRound();
            }
        }, 3000);
    }
}

function pauseGame() {
    currentState = GAME_STATE.PAUSED;
    document.getElementById('pause-menu').classList.remove('hidden');
}

function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    document.getElementById('pause-menu').classList.add('hidden');
    lastTime = performance.now(); 
}

function returnToMainMenu() {
    currentState = GAME_STATE.MENU;
    clearInterval(roundTimerId);
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

document.getElementById('btn-start').addEventListener('click', () => {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    resetMatch();
});
document.getElementById('btn-controls').addEventListener('click', () => document.getElementById('controls-screen').classList.remove('hidden'));
document.getElementById('btn-close-controls').addEventListener('click', () => document.getElementById('controls-screen').classList.add('hidden'));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', returnToMainMenu);
document.getElementById('btn-result-quit').addEventListener('click', returnToMainMenu);
document.getElementById('btn-rematch').addEventListener('click', resetMatch);


// --- 6. RENDER & MAIN LOOP ---

function drawBackground() {
    ctx.fillStyle = '#0b0b1a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = '#ff00ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(GAME_WIDTH, FLOOR_Y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
    const timeOffset = (Date.now() / 20) % 50;
    for (let i = 0; i < GAME_WIDTH; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, FLOOR_Y);
        ctx.lineTo(i - 200 + timeOffset*4, GAME_HEIGHT);
        ctx.stroke();
    }
    
    for (let i = 0; i < 150; i+=30) {
        ctx.beginPath();
        ctx.moveTo(0, FLOOR_Y + i);
        ctx.lineTo(GAME_WIDTH, FLOOR_Y + i);
        ctx.stroke();
    }
}

function update(dt) {
    if (hitStopTimer > 0) {
        hitStopTimer -= dt;
        
        particles.forEach(p => p.update(dt));
        particles = particles.filter(p => p.life > 0);
        updateImpactEffects(dt);
        if (cameraShake > 0) cameraShake -= dt;
        
        return; 
    }

    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.ROUND_OVER) {
        player.update(dt, enemy);
        enemy.update(dt, player);
        updateEnergyUI();
    } else if (currentState === GAME_STATE.ULTIMATE) {
        updateUltimateCinematic(dt);
        updateEnergyUI();
    }
    
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
    updateImpactEffects(dt);

    if (cameraShake > 0) cameraShake -= dt;
}

function draw() {
    ctx.save();
    
    if (cameraShake > 0) {
        const shakeMag = cameraShake * 30;
        ctx.translate((Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag);
    }

    if (currentState === GAME_STATE.ULTIMATE && ultimateData) {
        const t = ultimateData.timer;
        let zoom = 1;
        if (t < 0.3) zoom = 1 + (t / 0.3) * 0.15;
        else if (t < 2.3) zoom = 1.15;
        else if (t < 2.7) zoom = 1.15 - ((t - 2.3) / 0.4) * 0.15;
        const midX = (ultimateData.attacker.x + ultimateData.opponent.x) / 2;
        const midY = FLOOR_Y - 80;
        ctx.translate(midX, midY);
        ctx.scale(zoom, zoom);
        ctx.translate(-midX, -midY);
    }

    drawBackground();
    
    player.draw(ctx);
    enemy.draw(ctx);
    
    particles.forEach(p => p.draw(ctx));

    drawImpactEffects(ctx);

    ctx.restore();

    drawScreenFlashes(ctx);

    if (currentState === GAME_STATE.ULTIMATE) {
        drawUltimateOverlay(ctx);
    }
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime = timestamp;

    if (currentState !== GAME_STATE.MENU && currentState !== GAME_STATE.PAUSED) {
        update(dt);
        draw();
    } else if (currentState === GAME_STATE.MENU) {
        drawBackground();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);