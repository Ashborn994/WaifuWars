# ⚔️ WaifuWars — Neon Blade Showdown

> **A fast-paced 1v1 anime-inspired fighting game built with vanilla JavaScript and HTML5 Canvas.**

WaifuWars is a browser-based fighting game where the player battles an AI-controlled opponent in a cyberpunk-inspired arena.

The project focuses on responsive combat, simple game physics, enemy AI, visual effects, and an iterative AI-assisted development workflow.

---

## 🎮 Features

* ⚔️ **1v1 Fighting System**
* 🤖 **CPU Opponent with AI Behavior**

  * Movement and positioning
  * Light and heavy attacks
  * Blocking
  * Jumping
  * Special attacks
  * Tactical repositioning
* 🦘 **Aerial Combat**

  * Player and CPU jumping
  * Air attacks
  * Gravity and vertical physics
* 💥 **Combat System**

  * Light attacks
  * Heavy attacks
  * Special attacks
  * Blocking
  * Hit detection
  * Knockback
  * Hit stun
* 🔥 **Combo System**
* ⚡ **Energy System**
* ❤️ **Health Bars**
* ⏱️ **60-Second Rounds**
* 🏆 **Best-of-3 Match System**
* ✨ **Particle Effects**
* 📳 **Camera Shake**
* 🔊 **Web Audio Effects**
* 🎨 **Cyberpunk / Neon Visual Style**
* ⏸️ **Pause and Rematch System**
* 🚫 **No backend required**

---

## 🕹️ Controls

| Key     | Action         |
| ------- | -------------- |
| `A`     | Move Left      |
| `D`     | Move Right     |
| `Space` | Jump           |
| `S`     | Block          |
| `J`     | Light Attack   |
| `K`     | Heavy Attack   |
| `L`     | Special Attack |
| `Esc`   | Pause / Resume |

---

## 🛠️ Technologies

* **HTML5**
* **CSS3**
* **JavaScript**
* **HTML5 Canvas API**
* **Web Audio API**
* **Git & GitHub**

The game is built without a game engine or backend, keeping the project lightweight and easy to run directly in a browser.

---

## 🧠 Game Architecture

The game uses a simple state-based fighter system.

Each fighter maintains:

* Position and velocity
* Health
* Energy
* Facing direction
* Current combat state
* Attack timing
* Combo information
* AI decision timers
* Jump cooldowns

### Fighter State Machine

```text
IDLE
  │
  ├── WALK
  ├── JUMP
  ├── LIGHT
  ├── HEAVY
  ├── SPECIAL
  ├── BLOCK
  ├── HIT
  └── DEAD
```

Attack hit detection uses attack-specific:

* Range
* Damage
* Knockback
* Stun duration
* Active frames

This allows different attacks to behave differently while using the same underlying combat system.

---

## 🤖 CPU AI

The CPU opponent uses a lightweight decision-making system rather than simply attacking continuously.

Its behavior changes based on the player's position and current state.

For example, the CPU can:

* Approach the player when far away
* Attack when within combat range
* Block incoming attacks
* Jump to reposition
* Jump when the player is airborne
* Retreat from close-range situations
* Use its special attack when enough energy has been accumulated

The AI also uses short decision intervals and action cooldowns to make its behavior less predictable.

---

## ⚡ Combat & Energy

Fighters gradually generate energy during the match.

Energy can also be gained by successfully landing attacks or blocking attacks.

Once the energy meter reaches `100`, the fighter can perform a powerful special attack.

Special attacks consume the stored energy and have increased:

* Attack range
* Damage
* Knockback
* Visual effects

---

## 🏆 Match System

Each match uses a **best-of-3 round format**.

A round can end when:

1. A fighter's health reaches zero, or
2. The 60-second timer expires.

If the timer expires, the fighter with the higher remaining health wins the round.

The first fighter to win two rounds wins the match.

---

## 📁 Project Structure

```text
WaifuWars/
│
├── index.html      # Game structure and UI
├── style.css       # Visual styling
├── script.js       # Game engine, combat, physics and AI
└── README.md       # Project documentation
```

---

## 🚀 Running the Game

No installation or backend server is required.

### Option 1 — VS Code Live Server

1. Clone or download the repository.
2. Open the project in VS Code.
3. Open `index.html` using Live Server.
4. Start playing.

### Option 2 — Browser

The project can also be opened directly through a modern browser, although using a local development server is recommended during development.

---

## 🤖 AI-Assisted Development

WaifuWars was developed using an **iterative AI-assisted development workflow**.

Instead of relying on a single AI-generated codebase, different AI tools were used for different stages of development.

```text
Game Design
     ↓
Prompt Engineering
     ↓
AI Implementation
     ↓
Testing
     ↓
Bug Identification
     ↓
Targeted Correction Prompt
     ↓
Implementation
     ↓
Testing Again
```

### Development Workflow

**ChatGPT**

* Game design
* Feature planning
* Prompt engineering
* Debugging and diagnosis
* Architecture decisions

**Gemini**

* Primary code implementation
* Feature integration
* Iterative code modifications

**Claude**

* Planned code review
* Bug hunting
* Gameplay and UX feedback

The goal was not simply to generate code, but to use AI as a development partner while testing, debugging, and refining the resulting system.

---

## 🧪 Development Philosophy

The project is being developed incrementally.

Major features are implemented, tested, debugged, and committed to Git before moving on to larger changes.

Examples of development milestones include:

```text
Initial game engine
       ↓
Player movement
       ↓
Combat system
       ↓
CPU AI
       ↓
Jump mechanics
       ↓
CPU jumping
       ↓
CPU special attack fixes
       ↓
Gameplay polish
       ↓
Competition build
```

---

## 🔮 Future Improvements

Potential future additions include:

* 🎭 Multiple playable characters
* 🗡️ Character-specific abilities
* 🎚️ CPU difficulty levels
* 🎮 Local 2-player mode
* 🎮 Controller support
* 🎵 Background music
* 🎬 Improved attack animations
* 🏟️ Multiple arenas
* 🏅 High-score / statistics system
* 📱 Improved mobile support
* ✨ More advanced visual effects

---

## 🎯 Project Goal

WaifuWars was created as a project for a **Prompt Engineering competition**, where participants build a functional game using AI-assisted prompting.

The goal is to demonstrate that effective prompt engineering is not just about generating code once, but about:

> **Design → Build → Test → Diagnose → Refine → Repeat**

---

## 📌 Current Status

**🟢 Playable**

The core gameplay loop is implemented, including:

* Player movement
* Jumping
* CPU movement
* CPU jumping
* Combat
* Blocking
* Special attacks
* Energy system
* Health system
* Round timer
* Best-of-3 matches
* Win conditions
* Visual and audio effects

The project is currently being refined and polished for competition presentation.

---

## 📄 License

This project is currently intended as a personal/educational project.

---

### ⚔️ WaifuWars

**Build. Fight. Prompt. Repeat.**
