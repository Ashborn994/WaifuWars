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
let ultimateData = null; // Active Ultimate cinematic sequence data (see startUltimate/updateUltimateCinematic), null when none is running

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
    } else if (type === 'special2') {
        // Level 2 Special: bigger, wider sweep than Level 1
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.6);
        gainNode.gain.setValueAtTime(0.6, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.7);
        osc.start(now); osc.stop(now + 0.7);
    } else if (type === 'ultimate') {
        // Ultimate finishing strike: the biggest, longest sweep in the game
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.9);
        gainNode.gain.setValueAtTime(0.7, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
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
const STATES = { IDLE: 0, WALK: 1, JUMP: 2, LIGHT: 3, HEAVY: 4, SPECIAL_1: 5, BLOCK: 6, HIT: 7, DEAD: 8, SPECIAL_2: 9, ULTIMATE: 10 };

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

        // Hit Detection for Attacks (ULTIMATE is intentionally excluded - its single
        // finishing hit is applied directly by the cinematic system, see startUltimate)
        if ((this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2) && !this.attackHasHit) {
            this.checkAttackHit(opponent);
        }
    }

    handlePlayerInput(opponent) {
        // Cannot interrupt attacks unless comboing, cannot move if blocking
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2 || this.state === STATES.ULTIMATE) return;
        
        // Attack Inputs
        // L now activates the highest special/ultimate tier the fighter can afford:
        // 100 energy -> Ultimate, 66+ -> Level 2, 33+ -> Level 1, otherwise nothing.
        if (keys['l']) {
            if (this.energy >= 100) {
                this.attack(STATES.ULTIMATE, opponent); return;
            } else if (this.energy >= 66) {
                this.attack(STATES.SPECIAL_2, opponent); return;
            } else if (this.energy >= 33) {
                this.attack(STATES.SPECIAL_1, opponent); return;
            }
            // Insufficient energy for any tier - fall through, same as a no-op key press.
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
        if (this.state === STATES.LIGHT || this.state === STATES.HEAVY || this.state === STATES.SPECIAL_1 || this.state === STATES.SPECIAL_2 || this.state === STATES.ULTIMATE) return;
        
        this.aiTimer -= dt;
        if (this.aiTimer > 0) return; // Thinking pause

        const dist = Math.abs(opponent.x - this.x);
        this.aiTimer = Math.random() * 0.2 + 0.1; // React every 100-300ms

        // AI Logic Tree
        if (dist > 300) {
            // Check if special can be used at range (kept from original: only attempt at long range within ~380 units)
            if (dist <= 380 && this.decideSpecialAttack(opponent)) {
                // handled inside decideSpecialAttack
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
            if (this.decideSpecialAttack(opponent)) {
                // handled inside decideSpecialAttack
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
            if (this.decideSpecialAttack(opponent)) {
                // handled inside decideSpecialAttack
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

    // Chooses and attempts the highest-value special/ultimate the CPU can currently
    // afford, with per-tier probabilities so it doesn't fire the instant it's
    // available (per-branch call sites are unchanged from the original single-special
    // AI logic - only the decision itself is now tiered). Returns true if an attack
    // was initiated, so callers can skip their other branches exactly like before.
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

    attack(type, opponent) {
        // Fix: Force facing direction directly toward the opponent when initiating an attack
        if (opponent) {
            this.dir = (opponent.x > this.x) ? 1 : -1;
        }

        // ULTIMATE doesn't behave like a normal timed attack state - it hands off
        // entirely to the dedicated cinematic system (see startUltimate below),
        // which is what freezes both fighters for the duration of the sequence.
        if (type === STATES.ULTIMATE) {
            startUltimate(this, opponent);
            return;
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
        } else if (type === STATES.SPECIAL_1) {
            this.stateTimer = 0.4;
            this.energy = Math.max(0, this.energy - 33); // Level 1 costs ~33 energy
            playSound('special');
        } else if (type === STATES.SPECIAL_2) {
            this.stateTimer = 0.9;
            this.energy = Math.max(0, this.energy - 66); // Level 2 costs ~66 energy
            playSound('special2');
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
        if (this.state === STATES.SPECIAL_1) { reach = 180; damage = 28; knockback = 400; stunTime = 0.35; activeFrameStart = 0.2; hitType = 'special1';}
        if (this.state === STATES.SPECIAL_2) { reach = 450; damage = 45; knockback = 700; stunTime = 0.6; activeFrameStart = 0.5; hitType = 'special2';}

        // Only hit during "active frames" (end of the animation timer)
        if (this.stateTimer > activeFrameStart) return;

        // Distance check
        const dist = (opponent.x - this.x) * this.dir; // Positive if opponent is in front
        const yDist = Math.abs(opponent.y - this.y);
        
        // Relax vertical threshold slightly for the Level 2 beam to account for airborne states cleanly
        let maxVerticalDist = (this.state === STATES.SPECIAL_2) ? 140 : 100;

        // --- Aerial Heavy attack vertical fix ---
        // Heavy's swing is a downward/overhead animation, so when the attacker is
        // airborne and swinging at a grounded opponent, `yDist` grows with jump
        // height even though the swing visually reaches the ground. Widen the
        // vertical tolerance for this specific case only (Heavy, attacker airborne,
        // opponent grounded) - horizontal reach, active frames, and all other
        // attack/matchup combinations are untouched. ~180 comfortably covers the
        // fighter's max jump height (~162 units) without being an unbounded hitbox.
        const attackerAirborne = this.y < FLOOR_Y;
        const opponentGrounded = opponent.y >= FLOOR_Y;
        if (this.state === STATES.HEAVY && attackerAirborne && opponentGrounded) {
            maxVerticalDist = 180;
        }

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
                // Energy-on-hit now applies to both fighters (previously player-only).
                this.energy = Math.min(100, this.energy + 10); // Gain energy on hit
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
            
            // Graduated shake: Heavy/Level1 keep the original intensity, Level2 is
            // stronger, and the Ultimate finishing hit is the strongest in the game.
            if (type === 'heavy' || type === 'special1') cameraShake = Math.max(cameraShake, 0.3);
            else if (type === 'special2') cameraShake = Math.max(cameraShake, 0.45);
            else if (type === 'ultimate') cameraShake = Math.max(cameraShake, 0.6);
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
            } else if (this.state === STATES.SPECIAL_1) {
                // Level 1: fast, short-range energy strike - a brighter, longer slash
                ctx.fillStyle = this.accentColor;
                ctx.globalAlpha = 0.9;
                ctx.fillRect(20, -110, 160, 20);
                ctx.fillStyle = '#fff';
                ctx.fillRect(20, -102, 160, 4);
                ctx.globalAlpha = 1.0;
            } else if (this.state === STATES.SPECIAL_2) {
                // Level 2: large energy beam - bigger and brighter than Level 1
                ctx.fillStyle = this.accentColor;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(30, -140, 420, 90);
                ctx.fillStyle = '#fff';
                ctx.fillRect(30, -110, 420, 30);
                ctx.globalAlpha = 1.0;
            } else if (this.state === STATES.ULTIMATE) {
                // Sword held ready during the cinematic. The dash/slash/finish visuals
                // themselves are drawn by drawUltimateOverlay(); this just keeps the
                // base silhouette sensible if the cinematic ends abruptly (e.g. a KO).
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

// --- 4b. ULTIMATE CINEMATIC SYSTEM (LEVEL 3) ---
// Fully separate from the normal per-fighter update/attack flow. While
// `currentState === GAME_STATE.ULTIMATE`, the main update() dispatcher (see below)
// calls ONLY updateUltimateCinematic() instead of player.update()/enemy.update(),
// which is what freezes both fighters (movement, input, AI, and further attacks -
// including a second Ultimate) for the whole sequence. Damage is applied exactly
// once, at the scripted "finish" beat, via the normal takeDamage() so blocking,
// knockback, and combo rules all still apply.

// Fixed timeline (seconds from activation). Each beat fires exactly once, in
// order, as `timer` passes its `t` value - this keeps the sequence exact
// regardless of frame rate rather than relying on continuous range checks.
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
const ULTIMATE_DAMAGE = 80; // Strongest attack in the game; still routed through takeDamage() so blocking applies

function startUltimate(attacker, opponent) {
    if (currentState === GAME_STATE.ULTIMATE) return; // Guard against re-entrancy/double activation

    attacker.state = STATES.ULTIMATE;
    attacker.stateTimer = 0;
    attacker.attackHasHit = false;
    attacker.vx = 0;
    attacker.vy = 0;
    attacker.energy = 0; // Ultimate always consumes all 100 energy, immediately

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
        // Safety clamp: keep the attacker's cinematic-repositioned x within the
        // arena, mirroring the normal boundary clamp in Fighter.update().
        attacker.x = Math.max(30, Math.min(GAME_WIDTH - 30, attacker.x));
    }
    ultimateData = null;
    // Only resume normal play if nothing else (e.g. a KO via checkRoundEnd) has
    // already moved the game to a different state - a KO takes priority.
    if (currentState === GAME_STATE.ULTIMATE) {
        currentState = GAME_STATE.PLAYING;
    }
}

function updateUltimateCinematic(dt) {
    // Safety net: if the state changed out from under us (e.g. the finishing hit
    // KO'd the opponent and checkRoundEnd() already took over), stop immediately
    // rather than continuing to drive a cinematic that's no longer relevant.
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
            attacker.dir = -dir; // Now attacking from behind, toward the opponent
        } else if (action === 'finish') {
            // The single, intentional damage moment - never applied more than once
            // because this 'finish' beat can only fire one time per cinematic.
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
            return; // ultimateData is now cleared - nothing left to do this frame
        }
    }

    // Continuous motion between beats (dash in / reposition behind the opponent)
    if (u.timer >= 0.30 && u.timer < 0.50) {
        const t = Math.min(1, (u.timer - 0.30) / 0.20);
        const targetX = u.origOpponentX - dir * 80;
        // Use the attacker's position at cinematic start (captured lazily) to interpolate smoothly
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

    // Darkened background to focus attention on the fighters
    let darken = 0;
    if (t < 0.3) darken = (t / 0.3) * 0.5;
    else if (t < 2.3) darken = 0.5;
    else if (t < 2.7) darken = 0.5 * (1 - (t - 2.3) / 0.4);
    if (darken > 0) {
        ctx.fillStyle = `rgba(0,0,0,${darken.toFixed(2)})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Screen flash at the finishing-slash moment
    if (t >= 2.0 && t < 2.15) {
        const flashAlpha = 1 - (t - 2.0) / 0.15;
        ctx.fillStyle = `rgba(255,255,255,${(flashAlpha * 0.8).toFixed(2)})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    // Dramatic callout text during the slash sequence
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

// CPU combo indicator - uses the #cpu-combo-display / #cpu-combo-count markup
// already present in index.html, which shares its CSS styling with the player's
// #combo-display via style.css (same font, size, weight, glow, padding, etc.).
const domCpuCombo = document.getElementById('cpu-combo-display');
const domCpuComboCount = document.getElementById('cpu-combo-count');

// Available-special indicators (LEVEL1/LEVEL2/ULTIMATE readiness) - optional
// elements; updateSpecialTag() no-ops safely if either is missing from the HTML.
const domP1SpecialTag = document.getElementById('p1-special-tag');
const domP2SpecialTag = document.getElementById('p2-special-tag');

function updateHealthUI() {
    domP1Health.style.width = `${Math.max(0, player.hp)}%`;
    domP2Health.style.width = `${Math.max(0, enemy.hp)}%`;
}

function updateEnergyUI() {
    domP1Energy.style.width = `${player.energy}%`;
    domP1Energy.style.background = player.energy >= 100 ? '#fff' : '#00ff88';
    domP2Energy.style.width = `${enemy.energy}%`;
    domP2Energy.style.background = enemy.energy >= 100 ? '#fff' : '#00ff88';

    // Available-special indicator: shows the strongest move each fighter can
    // currently afford, mirroring the 33/66/100 energy thresholds.
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
    } else if (currentState === GAME_STATE.ULTIMATE) {
        // Normal player/CPU update is intentionally skipped here - this is what
        // freezes both fighters for the duration of the Ultimate cinematic.
        updateUltimateCinematic(dt);
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

    // Ultimate cinematic: subtle zoom toward the fighters for a "finisher" feel
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
    
    // Draw entities
    player.draw(ctx);
    enemy.draw(ctx);
    
    // Draw particles
    particles.forEach(p => p.draw(ctx));

    ctx.restore();

    if (currentState === GAME_STATE.ULTIMATE) {
        drawUltimateOverlay(ctx);
    }
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