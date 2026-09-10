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
const GAME_STATE = { MENU: 0, COUNTDOWN: 1, PLAYING: 2, PAUSED: 3, ROUND_OVER: 4, MATCH_OVER: 5 };
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

// Input Handling
const keys = {};
window.addEventListener('keydown', e => {
    let key = e.key.toLowerCase();
    if (e.code === 'Space') key = ' '; // Normalize spacebar just in case
    
    // Prevent spacebar from holding/repeating jump
    if (key === ' ' && !e.repeat) {
        keys['space_trigger'] = true;
    }
    
    keys[key] = true;
    
    if (e.key === 'Escape' && currentState === GAME_STATE.PLAYING) pauseGame();
    else if (e.key === 'Escape' && currentState === GAME_STATE.PAUSED) resumeGame();
    
    // Prevent scrolling for game keys (Spacebar is included here as ' ')
    if(['w','a','s','d','j','k','l',' '].includes(key)) e.preventDefault();
});

window.addEventListener('keyup', e => {
    let key = e.key.toLowerCase();
    if (e.code === 'Space') key = ' '; // Normalize spacebar just in case
    
    keys[key] = false;
    if (key === ' ') keys['space_trigger'] = false;
});

// --- 2. AUDIO SYSTEM (Web Audio API) ---
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
    }
};

// --- 3. PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, color, speed, size, life) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}
let particles = [];
const spawnParticles = (x, y, color, count, speed = 500) => {
    for(let i=0; i<count; i++) {
        if(particles.length > 150) break; // Cap particles
        particles.push(new Particle(x, y, color, speed, Math.random()*4+2, Math.random()*0.3+0.2));
    }
};

// --- 4. FIGHTER CLASS ---
const STATES = { IDLE: 0, WALK: 1, JUMP: 2, LIGHT: 3, HEAVY: 4, SPECIAL: 5, BLOCK: 6, HIT: 7, DEAD: 8 };

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
        
        // Stats
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.energy = 0; // Max 100 for special
        
        // State Machine
        this.state = STATES.IDLE;
        this.stateTimer = 0;
        
        // Combat tracking (independent per-fighter combo state - used by BOTH player and CPU)
        this.comboCount = 0;
        this.comboTimer = 0;
        this.attackHasHit = false;
        
        // AI Variables
        this.aiTimer = 0;
        this.aiJumpCooldown = 0;
    }

    reset(x) {
        this.x = x; this.y = FLOOR_Y;
        this.vx = 0; this.vy = 0;
        this.hp = this.maxHp; this.energy = 0;
        this.state = STATES.IDLE;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.dir = this.isPlayer ? 1 : -1;
        this.aiJumpCooldown = 0;
    }

    update(dt, opponent) {
        // Apply Vertical Velocity
        this.y += this.vy * dt;

        // Apply Gravity and Ground Detection
        if (this.y < FLOOR_Y) {
            this.vy += 2500 * dt;
            if (this.state === STATES.IDLE || this.state === STATES.WALK) this.state = STATES.JUMP;
        } else {
            this.vy = 0;
            this.y = FLOOR_Y;
            if (this.state === STATES.JUMP) this.state = STATES.IDLE;
        }

        // Apply Friction/Deceleration
        this.vx *= Math.pow(0.01, dt); 
        this.x += this.vx * dt;

        // Boundaries
        if (this.x < 30) this.x = 30;
        if (this.x > GAME_WIDTH - 30) this.x = GAME_WIDTH - 30;

        // Facing direction (only change if not attacking/hit)
        if (this.state === STATES.IDLE || this.state === STATES.WALK || this.state === STATES.BLOCK) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
        }

        // State Timer updates
        if (this.stateTimer > 0) {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                if (this.state === STATES.DEAD) return; // Stay dead
                this.state = STATES.IDLE;
                this.attackHasHit = false;
            }
        }

        // AI Jump Cooldown update
        if (this.aiJumpCooldown > 0) {
            this.aiJumpCooldown -= dt;
        }

        // Combo timer (independent per-fighter - applies to BOTH player and CPU)
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                // Ensure the corresponding indicator is hidden once the combo naturally expires
                if (this.isPlayer) {
                    if (domCombo) domCombo.classList.add('hidden');
                } else {
                    if (domCpuCombo) domCpuCombo.classList.add('hidden');
                }
            }
        }

        // Passive Energy Gen
        if (this.energy < 100 && currentState === GAME_STATE.PLAYING) {
            this.energy += 5 * dt;
        }

        // Handle Input / AI Logic
        if (currentState === GAME_STATE.PLAYING && this.state !== STATES.DEAD && this.state !== STATES.HIT) {
            if (this.isPlayer) this.handlePlayerInput(opponent);
            else this.handleAI(dt, opponent);
        }

        // Hit Detection for Attacks
        if ((this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL) && !this.attackHasHit) {
            this.checkAttackHit(opponent);
        }
    }

    handlePlayerInput(opponent) {
        // Cannot interrupt attacks unless comboing, cannot move if blocking
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL) return;
        
        // Attack Inputs
        if (keys['l'] && this.energy >= 100) {
            this.attack(STATES.SPECIAL, opponent); return;
        } else if (keys['k']) {
            this.attack(STATES.HEAVY, opponent); return;
        } else if (keys['j']) {
            this.attack(STATES.LIGHT, opponent); return;
        }

        // Defense
        if (keys['s']) {
            this.state = STATES.BLOCK;
            this.vx = 0;
            return;
        }

        // Movement (A and D only)
        if (keys['a']) {
            this.vx = -400;
            if(this.y === FLOOR_Y) this.state = STATES.WALK;
        } else if (keys['d']) {
            this.vx = 400;
            if(this.y === FLOOR_Y) this.state = STATES.WALK;
        } else {
            if(this.y === FLOOR_Y) this.state = STATES.IDLE;
        }

        // Jump (Spacebar)
        if (keys['space_trigger'] && this.y === FLOOR_Y) {
            this.vy = -900;
            this.state = STATES.JUMP;
            keys['space_trigger'] = false; // consume trigger to prevent holding from looping jumps
        }
    }

    handleAI(dt, opponent) {
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL) return;
        
        this.aiTimer -= dt;
        if (this.aiTimer > 0) return; // Thinking pause

        const dist = Math.abs(opponent.x - this.x);
        this.aiTimer = Math.random() * 0.2 + 0.1; // React every 100-300ms

        // AI Logic Tree
        if (dist > 300) {
            // Check if special can be used at range (Special reach is 400)
            if (this.energy >= 100 && dist <= 380 && Math.random() < 0.5) {
                this.attack(STATES.SPECIAL, opponent);
            } else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && Math.random() < 0.25) {
                this.vy = -900;
                this.state = STATES.JUMP;
                this.aiJumpCooldown = 2.0; // Cooldown before next AI jump
            } else {
                this.vx = this.dir * 350;
                if(this.y === FLOOR_Y) this.state = STATES.WALK;
            }
        } else if (dist < 150) {
            // In combat range
            const rand = Math.random();
            if (this.energy >= 100 && rand < 0.4) {
                this.attack(STATES.SPECIAL, opponent);
            } else if (opponent.state === STATES.LIGHT || opponent.state === STATES.HEAVY) {
                if (rand < 0.5) this.state = STATES.BLOCK; // Block incoming attack
                else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && rand < 0.8) {
                    // Jump to reposition/avoid
                    this.vy = -900;
                    this.state = STATES.JUMP;
                    this.aiJumpCooldown = 2.0;
                }
            } else {
                if (rand < 0.4) this.attack(STATES.LIGHT, opponent);
                else if (rand < 0.7) this.attack(STATES.HEAVY, opponent);
                else if (this.y === FLOOR_Y && this.aiJumpCooldown <= 0 && rand < 0.85) {
                    // Tactical jump reposition
                    this.vy = -900;
                    this.state = STATES.JUMP;
                    this.aiJumpCooldown = 2.0;
                } else {
                    this.vx = -this.dir * 300; // retreat slightly
                }
            }
        } else {
            // Mid range
            const rand = Math.random();
            if (this.energy >= 100 && rand < 0.4) {
                this.attack(STATES.SPECIAL, opponent);
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

    attack(type, opponent) {
        // Fix: Force facing direction directly toward the opponent when initiating an attack
        if (opponent) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
        }

        this.state = type;
        this.attackHasHit = false;
        this.vx = 0; // stop moving

        if (type === STATES.LIGHT) {
            this.stateTimer = 0.25;
            playSound('light');
        } else if (type === STATES.HEAVY) {
            this.stateTimer = 0.5;
            this.vx = this.dir * 200; // slight forward momentum
            playSound('heavy');
        } else if (type === STATES.SPECIAL) {
            this.stateTimer = 0.8;
            this.energy = 0;
            playSound('special');
        }
    }

    checkAttackHit(opponent) {
        if (opponent.state === STATES.DEAD) return;

        let reach = 0;
        let damage = 0;
        let knockback = 0;
        let stunTime = 0;
        let activeFrameStart = 0;
        let hitType = '';

        if (this.state === STATES.LIGHT) { reach = 100; damage = 5; knockback = 150; stunTime = 0.3; activeFrameStart = 0.15; hitType = 'light';}
        if (this.state === STATES.HEAVY) { reach = 150; damage = 12; knockback = 500; stunTime = 0.5; activeFrameStart = 0.3; hitType = 'heavy';}
        if (this.state === STATES.SPECIAL) { reach = 400; damage = 25; knockback = 800; stunTime = 0.8; activeFrameStart = 0.4; hitType = 'special';}

        // Only hit during "active frames" (end of the animation timer)
        if (this.stateTimer > activeFrameStart) return;

        // Distance check
        const dist = (opponent.x - this.x) * this.dir; // Positive if opponent is in front
        const yDist = Math.abs(opponent.y - this.y);
        
        // Relax vertical threshold slightly for Special beam to account for airborne states cleanly
        const maxVerticalDist = (this.state === STATES.SPECIAL) ? 140 : 100;

        // --- Light attack hitbox fix ---
        // The old check only compared `reach` to the opponent's CENTER x position,
        // ignoring that the opponent's body (width 60) extends toward the attacker.
        // The visible slash (ctx.fillRect(20, -100, 80, 10)) reaches `reach` units
        // in front of the attacker, so a hit should register once that slash tip
        // reaches the opponent's near body edge - not the opponent's center.
        // Adding half the opponent's body width closes that gap so "looks like a
        // hit" and "registers as a hit" agree, while a real visible gap still misses.
        // Heavy and Special are untouched and keep the original center-based check.
        let isHit;
        if (this.state === STATES.LIGHT) {
            const opponentHalfWidth = opponent.width / 2; // 30 - matches opponent's body extent
            const effectiveReach = reach + opponentHalfWidth;
            isHit = (dist > 0 && dist < effectiveReach && yDist < maxVerticalDist);
        } else {
            isHit = (dist > 0 && dist < reach && yDist < maxVerticalDist);
        }

        if (isHit) {
            this.attackHasHit = true;

            // takeDamage now reports whether the hit was actually blocked, so combo
            // logic can react to the REAL outcome instead of guessing from state.
            const result = opponent.takeDamage(damage, knockback * this.dir, stunTime, hitType);

            if (!result.blocked) {
                // Successful (unblocked) hit -> build this fighter's combo.
                this.comboCount++;
                this.comboTimer = 1.0;
                if (this.comboCount > 1) {
                    if (this.isPlayer) updatePlayerComboUI(this.comboCount);
                    else updateCpuComboUI(this.comboCount);
                }
                // Energy-on-hit behavior is unchanged: only the player gained energy
                // from landing hits in the original implementation.
                if (this.isPlayer) {
                    this.energy = Math.min(100, this.energy + 10); // Gain energy on hit
                }
            } else {
                // Blocked hit -> combo is interrupted and does NOT increase.
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

        // Blocking logic
        if (this.state === STATES.BLOCK) {
            blocked = true;
            actualDamage = Math.floor(amount * 0.2);
            actualKnockback = knockback * 0.1;
            playSound('block');
            spawnParticles(this.x + this.dir * 30, this.y - 70, '#ffffff', 10, 200);
            this.energy = Math.min(100, this.energy + 5);
        } else {
            this.state = STATES.HIT;
            this.stateTimer = stunTime;
            playSound('hit');
            spawnParticles(this.x, this.y - 70, this.accentColor, 20, 600);
            
            if (type === 'heavy' || type === 'special') cameraShake = 0.3;
        }

        this.hp -= actualDamage;
        this.vx = actualKnockback;
        updateHealthUI();

        if (this.hp <= 0) {
            this.hp = 0;
            this.state = STATES.DEAD;
            this.stateTimer = 999;
            this.vx = knockback * 1.5; // Dramatic fall
            this.vy = -400;
            spawnParticles(this.x, this.y - 70, this.color, 50, 800);
            checkRoundEnd();
        }

        // Report the real outcome of this hit so the attacker's combo logic
        // can tell a blocked attack apart from a full-damage hit.
        return { blocked, damage: actualDamage };
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.dir, 1); // Flip based on facing direction

        // Base styling
        ctx.fillStyle = this.color;
        
        // Draw Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 40, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw stylized figure (Canvas shapes)
        ctx.fillStyle = this.color;
        
        if (this.state === STATES.DEAD) {
            // Lying on ground
            ctx.fillRect(-this.height/2, -20, this.height, 20);
        } else if (this.state === STATES.HIT) {
            // Knocked back posture
            ctx.rotate(-0.2);
            ctx.fillRect(-20, -120, 40, 100); // Body
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -140, 30, 30); // Head flash
        } else if (this.state === STATES.BLOCK) {
            // Defensive crouch + Shield
            ctx.fillRect(-20, -100, 40, 100);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -130, 30, 30); // Head
            // Shield effect
            ctx.strokeStyle = this.accentColor;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(30, -120);
            ctx.lineTo(40, -60);
            ctx.lineTo(30, 0);
            ctx.stroke();
        } else {
            // Normal Posture (Idle, Walk, Jump, Attack core body)
            let lean = 0;
            if (this.state === STATES.WALK) lean = 0.2;
            if (this.state === STATES.JUMP) lean = -0.1;
            
            ctx.rotate(lean);
            ctx.fillRect(-20, -120, 40, 100); // Torso/Legs
            
            // Stylized Scarf/Hair
            ctx.fillStyle = this.accentColor;
            const wave = Math.sin(Date.now() / 150) * 10;
            ctx.fillRect(-40, -110 + wave, 30, 15);
            
            // Head
            ctx.fillStyle = '#fff';
            ctx.fillRect(-15, -150, 30, 30);

            // Attacks Overlays
            if (this.state === STATES.LIGHT) {
                // Quick slash
                ctx.fillStyle = this.accentColor;
                ctx.fillRect(20, -100, 80, 10);
            } else if (this.state === STATES.HEAVY) {
                // Big overhead swing
                ctx.fillStyle = this.accentColor;
                const swingPhase = this.stateTimer / 0.5; // 1 to 0
                ctx.rotate(swingPhase * Math.PI - Math.PI/4);
                ctx.fillRect(0, -140, 20, 120);
            } else if (this.state === STATES.SPECIAL) {
                // Giant Laser/Energy Beam
                ctx.fillStyle = this.accentColor;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(30, -120, 500, 60);
                ctx.fillStyle = '#fff';
                ctx.fillRect(30, -100, 500, 20);
                ctx.globalAlpha = 1.0;
            }
        }
        
        ctx.restore();
    }
}

// Instantiate Fighters (isPlayer, x, color, accentColor)
const player = new Fighter(true, 300, '#222', '#00f3ff');
const enemy = new Fighter(false, 980, '#222', '#ff00ea');

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

// CPU combo indicator - uses the #cpu-combo-display / #cpu-combo-count markup
// already present in index.html, which shares its CSS styling with the player's
// #combo-display via style.css (same font, size, weight, glow, padding, etc.).
const domCpuCombo = document.getElementById('cpu-combo-display');
const domCpuComboCount = document.getElementById('cpu-combo-count');

function updateHealthUI() {
    domP1Health.style.width = `${Math.max(0, player.hp)}%`;
    domP2Health.style.width = `${Math.max(0, enemy.hp)}%`;
}

function updateEnergyUI() {
    domP1Energy.style.width = `${player.energy}%`;
    domP1Energy.style.background = player.energy >= 100 ? '#fff' : '#00ff88';
    domP2Energy.style.width = `${enemy.energy}%`;
    domP2Energy.style.background = enemy.energy >= 100 ? '#fff' : '#00ff88';
}

// Player combo indicator (unchanged behavior, renamed from updateComboUI for clarity)
function updatePlayerComboUI(count) {
    domComboCount.innerText = count;
    domCombo.classList.remove('hidden');
    // Retrigger animation
    domCombo.style.animation = 'none';
    domCombo.offsetHeight; 
    domCombo.style.animation = 'slideRight 0.3s ease-out';
    
    setTimeout(() => {
        if(player.comboCount === 0) domCombo.classList.add('hidden');
    }, 1500);
}

// CPU combo indicator - logically separate from the player's (own element/state),
// but visually matches it: same styling via shared CSS, same animation mechanism
// and timing, just mirrored (slideLeft) so it moves naturally toward the center
// from the CPU side.
function updateCpuComboUI(count) {
    domCpuComboCount.innerText = count;
    domCpuCombo.classList.remove('hidden');
    // Retrigger animation
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

    // Make sure both combo indicators start hidden each round
    domCombo.classList.add('hidden');
    domCpuCombo.classList.add('hidden');
    
    roundTime = 60;
    domTimer.innerText = roundTime;
    
    currentState = GAME_STATE.COUNTDOWN;
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    
    particles = [];

    // 3, 2, 1, FIGHT Sequence
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
        if (currentState === GAME_STATE.PLAYING) {
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

// Menu Navigation Functions
function pauseGame() {
    currentState = GAME_STATE.PAUSED;
    document.getElementById('pause-menu').classList.remove('hidden');
}

function resumeGame() {
    currentState = GAME_STATE.PLAYING;
    document.getElementById('pause-menu').classList.add('hidden');
    lastTime = performance.now(); // Prevent large delta time jump
}

function returnToMainMenu() {
    currentState = GAME_STATE.MENU;
    clearInterval(roundTimerId);
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

// Button Listeners
document.getElementById('btn-start').addEventListener('click', () => {
    // Init audio context on first user interaction
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
    // Cyberpunk/Grid floor background
    ctx.fillStyle = '#0b0b1a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Horizon line
    ctx.strokeStyle = '#ff00ea';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(GAME_WIDTH, FLOOR_Y);
    ctx.stroke();

    // Floor grid
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
    const timeOffset = (Date.now() / 20) % 50;
    for (let i = 0; i < GAME_WIDTH; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, FLOOR_Y);
        ctx.lineTo(i - 200 + timeOffset*4, GAME_HEIGHT);
        ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i < 150; i+=30) {
        ctx.beginPath();
        ctx.moveTo(0, FLOOR_Y + i);
        ctx.lineTo(GAME_WIDTH, FLOOR_Y + i);
        ctx.stroke();
    }
}

function update(dt) {
    if (currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.ROUND_OVER) {
        player.update(dt, enemy);
        enemy.update(dt, player);
        updateEnergyUI();
    }
    
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);

    if (cameraShake > 0) cameraShake -= dt;
}

function draw() {
    ctx.save();
    
    // Apply Camera Shake
    if (cameraShake > 0) {
        const shakeMag = cameraShake * 30;
        ctx.translate((Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag);
    }

    drawBackground();
    
    // Draw entities
    player.draw(ctx);
    enemy.draw(ctx);
    
    // Draw particles
    particles.forEach(p => p.draw(ctx));

    ctx.restore();
}

function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // Cap dt to prevent physics explosions on tab switch
    lastTime = timestamp;

    if (currentState !== GAME_STATE.MENU && currentState !== GAME_STATE.PAUSED) {
        update(dt);
        draw();
    } else if (currentState === GAME_STATE.MENU) {
        // Just draw empty background for menu
        drawBackground();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// Start Engine
requestAnimationFrame(gameLoop);