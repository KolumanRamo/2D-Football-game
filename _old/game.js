// --- Audio System (Synth) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const masterGainNode = audioCtx.createGain();
masterGainNode.connect(audioCtx.destination);
masterGainNode.gain.value = 0.5; // Default volume

const SoundManager = {
    setVolume: (vol) => {
        masterGainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    },
    playTone: (freq, type, duration, vol = 0.1) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(masterGainNode); // Connect to Master
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },
    playKick: () => {
        if (!soundEnabled) return;
        // Punchier kick
        SoundManager.playTone(120, 'square', 0.1, 0.2);
        SoundManager.playTone(80, 'sine', 0.15, 0.4);
    },
    playWall: () => {
        if (!soundEnabled) return;
        const now = audioCtx.currentTime;
        if (SoundManager.lastWallTime && now - SoundManager.lastWallTime < 0.15) return; // 150ms debounce
        SoundManager.lastWallTime = now;
        SoundManager.playTone(200, 'triangle', 0.05, 0.1);
    },
    playGoal: () => {
        if (!soundEnabled) return;
        // Goal Horn / Whistle mix
        const now = audioCtx.currentTime;

        // Whistle bursts
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(2000 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.1);
            osc.connect(gain);
            gain.connect(masterGainNode); // Connect to Master
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.1);
        }

        SoundManager.playCrowdCheer();
    },
    playCrowdCheer: () => {
        if (!soundEnabled) return;
        const duration = 2.0;
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        // Pink/Brown noise approximation
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const output = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output;
            data[i] = output * 3.5; // Amplify
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();

        // Swell and fade
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        noise.connect(gain);
        gain.connect(masterGainNode); // Connect to Master
        noise.start();
    },
    playWhistle: () => {
        if (!soundEnabled) return;
        SoundManager.playTone(2500, 'sine', 0.1, 0.2);
    },
    playExplosion: () => {
        if (!soundEnabled) return;
        const now = audioCtx.currentTime;

        // White Noise Burst
        const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 sec
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Filter for "Boom" sound (Lowpass)
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainNode);
        noise.start();

        // Sub-bass impact
        SoundManager.playTone(60, 'square', 0.3, 0.5);
    },
    startRainSound: () => {
        if (!soundEnabled || SoundManager.rainNode) return;

        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds loop
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2; // Lower volume noise
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800; // Muffled rain sound

        const gain = audioCtx.createGain();
        gain.gain.value = 0.3;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainNode);
        noise.start();

        SoundManager.rainNode = noise;
        SoundManager.rainGain = gain;
    },
    stopRainSound: () => {
        if (SoundManager.rainNode) {
            try {
                SoundManager.rainGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                SoundManager.rainNode.stop(audioCtx.currentTime + 0.5);
            } catch (e) { }
            SoundManager.rainNode = null;
            SoundManager.rainGain = null;
        }
    },
    speak: (text) => {
        if (!window.speechSynthesis) return;

        // Cancel previous speech to be responsive (or queue? responsive is better for arcade)
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Pick Voice
        const voices = window.speechSynthesis.getVoices();
        // Try to match currentLang (e.g. 'tr', 'en', 'de')
        // lang.js has 'currentLang' variable? No, I need to check how lang is stored.
        // It's 'currentLang' in lang.js. 
        // Wait, game.js might not see it if not global. lang.js is loaded before game.js.
        // Let's assume 'currentLang' is available.

        const targetLang = currentLang || 'en';
        const voice = voices.find(v => v.lang.startsWith(targetLang));
        if (voice) utterance.voice = voice;

        utterance.rate = 1.1; // Slightly faster for excitement
        utterance.pitch = 1.0;
        utterance.volume = 1.0; // Max volume

        window.speechSynthesis.speak(utterance);
    }
};

// --- Particle System ---
const particles = [];
const powerUps = []; // Array to store active power-ups

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'speed', 'shot', 'freeze'
        this.radius = 20;
        this.life = 240; // 4 seconds before disappearing
        this.pulse = 0;
    }

    update() {
        this.life--;
        this.pulse += 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const scale = 1 + Math.sin(this.pulse) * 0.1;
        ctx.scale(scale, scale);

        // Box/Circle background
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        if (this.type === 'speed') ctx.fillStyle = '#f1c40f'; // Yellow
        else if (this.type === 'shot') ctx.fillStyle = '#e74c3c'; // Red
        else if (this.type === 'freeze') ctx.fillStyle = '#3498db'; // Blue
        else if (this.type === 'tiny_ball') ctx.fillStyle = '#9b59b6'; // Purple
        else if (this.type === 'big_goals') ctx.fillStyle = '#2ecc71'; // Green
        else if (this.type === 'confusion') ctx.fillStyle = '#e67e22'; // Orange

        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Icon (Text for now)
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.type === 'speed') ctx.fillText('⚡', 0, 2);
        else if (this.type === 'shot') ctx.fillText('💣', 0, 2);
        else if (this.type === 'freeze') ctx.fillText('❄️', 0, 2);
        else if (this.type === 'tiny_ball') ctx.fillText('📍', 0, 2);
        else if (this.type === 'big_goals') ctx.fillText('🥅', 0, 2);
        else if (this.type === 'confusion') ctx.fillText('😵', 0, 2);

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1.0;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.03;
        this.size *= 0.95;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// --- Constants ---
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;
const PLAYER_RADIUS = 30;
const BALL_RADIUS = 18;
// Mutable Game Constants (for Chaos Mode)
let GOAL_HEIGHT = 200; // Slightly larger for bigger map
const BASE_PLAYER_SPEED = 1.5; // Reduced from 6 to match "Slow Mo" feel (User Request)
let PLAYER_SPEED = BASE_PLAYER_SPEED;

// CONSTANT FRICTION REMOVED -> Moved to Ball properties
// CONSTANT ELASTICITY REMOVED -> Moved to Ball properties
// MAX_BALL_SPEED REMOVED -> Moved to Ball properties
const FIELD_MARGIN = 100; // Space behind goal
const GOAL_DEPTH = 60; // Depth of net


// --- Assets ---
const redSprite = new Image();
redSprite.src = 'player_red.png'; // Removed cache buster for local file support
// const blueSprite = new Image(); // Not used strictly, we re-paint red
// blueSprite.src = 'player_blue.png';

// --- Setup Canvas ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Elements ---
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreRedEl = document.getElementById('scoreRed');
const scoreBlueEl = document.getElementById('scoreBlue');
const timerEl = document.getElementById('timer');

const winnerText = document.getElementById('winnerText');
const pauseMenu = document.getElementById('pauseMenu'); // Add pauseMenu definition

// --- Input Elements ---
const p1NameInput = document.getElementById('p1NameInput');
const p2NameInput = document.getElementById('p2NameInput');
const durationInput = document.getElementById('durationInput');
const goalLimitInput = document.getElementById('goalLimitInput');
const soundToggle = document.getElementById('soundToggle');
const goalNotification = document.getElementById('goalNotification');
const goalText = document.getElementById('goalText');

// --- Game State ---
let gameRunning = false;
let gamePaused = false;
let isGoalCelebration = false; // Missing variable declared!
let scoreRed = 0;
let scoreBlue = 0;
let timeRemaining = 120; // Seconds
let winningScore = 5;
let isVsAI = false;
let soundEnabled = true;
let p1Name = "Kırmızı";
let p2Name = "Mavi";
let slowMoTimer = 0;
let slowMoFactor = 1;
let frameCount = 0;
// Weather System State
let weatherCondition = 'sunny';
let rainDrops = [];
let snowFlakes = [];

// --- AI State ---
let aiTimer = 0;
let timerInterval;
// const aiController = new SimpleAI(); // MOVED DOWN

// --- Fan Celebration State ---
let cameraFlashes = [];
let crowdEmojis = [];
let celebrationTimer = 0;
let shakeTimer = 0;
let shakeIntensity = 0;

// --- Input Handling ---
const keys = {};

window.addEventListener('keydown', (e) => {
    // Prevent scrolling
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// --- Classes ---

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.mass = radius;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Shine
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius / 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fill();
        ctx.closePath();
    }
}

const PLAYER_ACCELERATION = 0.25;
const PLAYER_FRICTION = 0.92;
const PLAYER_MAX_SPEED = 2.2;
const PLAYER_SPRINT_SPEED = 6.5;
const CHARGE_MAX = 100;

class SimpleAI {
    constructor() {
        this.reactionDelay = 10;
        this.timer = 0;
        this.targetY = 0;
        this.controls = { up: false, down: false, left: false, right: false, sprint: false, shoot: false };
    }

    update(player, ball) {
        this.timer++;
        if (this.timer % this.reactionDelay === 0) {
            this.decide(player, ball);
        }
        return this.controls;
    }

    decide(player, ball) {
        // Reset
        this.controls = { up: false, down: false, left: false, right: false, sprint: false, shoot: false };

        const dx = ball.x - player.x;
        const dy = ball.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Defense / Offense Logic
        let targetX = 0;
        let targetY = 0;

        // Logic for Player 2 (Blue) - Attacks Left (X=0), Defends Right (X=Width)

        // 1. Defend: If ball is behind us (closer to our goal), get between ball and goal!
        // Our Goal is at x = CANVAS_WIDTH.
        if (ball.x > player.x + 10) {
            // RETREAT!
            targetX = ball.x + 100; // Get well behind the ball
            targetY = ball.y;

            // Don't go into own goal
            if (targetX > CANVAS_WIDTH - 50) targetX = CANVAS_WIDTH - 50;
        }
        // 2. Attack: If we are in good position, charge!
        else {
            targetX = ball.x;
            targetY = ball.y;
        }

        // Clamp targetY to prevent trying to move into the wall
        // Player radius is needed here. But SimpleAI doesn't have it easily?
        // Actually player.radius is available.
        // MARGIN INCREASED: Keep Messi away from the very edge to prevent pinning ball
        const wallMargin = 30;
        if (targetY < player.radius + wallMargin) targetY = player.radius + wallMargin;
        if (targetY > CANVAS_HEIGHT - player.radius - wallMargin) targetY = CANVAS_HEIGHT - player.radius - wallMargin;

        // Move towards target
        if (player.x < targetX - 10) this.controls.right = true;
        if (player.x > targetX + 10) this.controls.left = true;

        if (player.y < targetY - 10) this.controls.down = true;
        if (player.y > targetY + 10) this.controls.up = true;

        // Sprint Logic:
        // 1. Chasing ball in midfield
        // 2. Attacking (Ball is deep in opponent half)
        // 3. Recovering (Ball is behind player)
        if (dist > 100 || ball.x < CANVAS_WIDTH / 2) {
            this.controls.sprint = true;
        }

        // Shoot logic
        // If ball is within kick range and we are somewhat aligned with goal (left)
        // Goal is at X=0, Y=CANVAS_HEIGHT/2 approx.
        if (dist < player.radius + ball.radius + 30) {
            // Check alignment
            const angleToGoal = Math.atan2((CANVAS_HEIGHT / 2) - player.y, 0 - player.x);
            // Just shoot if close enough to ball
            this.controls.shoot = true;
        }
    }
}



const aiController = new SimpleAI();

class Player extends Entity {
    constructor(x, y, color, controls) {
        super(x, y, PLAYER_RADIUS, color);
        this.controls = controls;
        this.stamina = 100;
        this.isSprinting = false;

        // Shooting
        this.charge = 0;
        this.isCharging = false;
        this.shootKeyReleased = true;

        // Power-ups
        this.activePowerUp = null;
        this.powerUpTimer = 0;
        this.frozen = false;
        this.freezeTimer = 0;
        this.superShot = false;
        this.confused = false;
        this.confusedTimer = 0;

        // Animation State
        this.facingRight = (this.color !== '#3498db'); // Blue team faces left initially
        this.animTimer = 0;
        this.kickTimer = 0; // For kick animation
        this.kickCooldown = 0; // Fix attempt for rapid fire sound
    }

    applyPowerUp(type) {
        const opponent = (this === player1) ? player2 : player1;

        if (type === 'speed') {
            this.activePowerUp = 'speed';
            this.powerUpTimer = 300; // 5 seconds
        } else if (type === 'shot') {
            this.superShot = true;
        } else if (type === 'freeze') {
            opponent.frozen = true;
            opponent.freezeTimer = 120; // 2 seconds
        } else if (type === 'tiny_ball') {
            ball.radius = 8;
            // Reset after 10 seconds? Need a global timer or check in game loop.
            // Simplified: It stays until someone scores or chaos resets it.
            // Or better: Use ChaosManager.reset() logic eventually.
            setTimeout(() => { ball.radius = (ball.type === 'pingpong' ? 10 : 18); }, 10000);
        } else if (type === 'big_goals') {
            const oldHeight = GOAL_HEIGHT;
            GOAL_HEIGHT = 350; // Huge goals
            setTimeout(() => { GOAL_HEIGHT = oldHeight; }, 10000);
        } else if (type === 'confusion') {
            opponent.confused = true;
            opponent.confusedTimer = 300; // 5 seconds of reversed controls
        }
    }

    update() {
        let ax = 0;
        let ay = 0;
        let isMoving = false;

        // Input Mapping
        let up, down, left, right, sprintKey, shootKey;

        if (this.controls === 'wasd') {
            up = keys['KeyW'];
            down = keys['KeyS'];
            left = keys['KeyA'];
            right = keys['KeyD'];
            sprintKey = keys['ShiftLeft'];
            shootKey = keys['Space'];
        } else if (this.controls === 'arrows') {
            up = keys['ArrowUp'];
            down = keys['ArrowDown'];
            left = keys['ArrowLeft'];
            right = keys['ArrowRight'];
            sprintKey = keys['ControlRight'] || keys['ControlLeft'];
            shootKey = keys['Enter'];
        } else if (this.controls === 'ai') {
            const aiInput = aiController.update(this, ball);
            up = aiInput.up;
            down = aiInput.down;
            left = aiInput.left;
            right = aiInput.right;
            sprintKey = aiInput.sprint;
            shootKey = aiInput.shoot;
        }

        if (up) ay = -1;
        if (down) ay = 1;
        if (left) ax = -1;
        if (right) ax = 1;

        if (ax !== 0 || ay !== 0) isMoving = true;

        // Update Direction
        if (ax > 0) this.facingRight = true;
        if (ax < 0) this.facingRight = false;

        // Update Animation Timer
        if (isMoving) {
            this.animTimer += 0.2 + (this.isSprinting ? 0.1 : 0);
        } else {
            this.animTimer = 0;
        }

        if (this.kickTimer > 0) this.kickTimer--;
        if (this.kickCooldown > 0) this.kickCooldown--;

        // --- Sprint Logic ---
        this.isSprinting = false;
        let currentMaxSpeed = PLAYER_SPEED;
        let movementFriction = 0.9;
        let movementAcceleration = 0.5;

        // Weather Physics modifiers
        if (weatherCondition === 'snowy') {
            currentMaxSpeed *= 0.6; // 40% slower in snow
            movementFriction = 0.85; // Heavy snow, stops faster
        } else if (weatherCondition === 'icy') {
            movementFriction = 0.99; // Very slippery (almost no friction)
            movementAcceleration = 0.05; // Hard to start/stop/turn
        }

        // Frozen Effect
        if (this.frozen) {
            this.freezeTimer--;
            if (this.freezeTimer <= 0) this.frozen = false;
            return; // Can't move
        }

        // Confusion Effect
        if (this.confused) {
            this.confusedTimer--;
            if (this.confusedTimer <= 0) this.confused = false;

            // Revese Inputs
            ax = -ax;
            ay = -ay;
        }

        // Speed Power-up Effect
        if (this.activePowerUp === 'speed') {
            currentMaxSpeed *= 1.5;
            this.powerUpTimer--;
            createParticles(this.x, this.y + 10, '#f1c40f', 1); // Trail
            if (this.powerUpTimer <= 0) this.activePowerUp = null;
        }

        if (sprintKey && this.stamina > 0) {
            this.isSprinting = true;
            currentMaxSpeed = PLAYER_SPEED * 1; // Boost sprint to compensate
            if (this.activePowerUp === 'speed') currentMaxSpeed *= 1.2; // Extra sprint speed
            this.stamina -= 1;
        } else if (this.stamina < 100) {
            this.stamina += 0.15; // Regen
        }

        // --- Movement Physics ---
        if (isMoving) {
            const length = Math.sqrt(ax * ax + ay * ay);
            ax /= length;
            ay /= length;

            this.vx += ax * movementAcceleration;
            this.vy += ay * movementAcceleration;

            // Dust Particles
            if (Math.random() < 0.2 && this.isSprinting) {
                createParticles(this.x, this.y + this.radius, '#7f8c8d', 2);
            }
        }

        this.vx *= movementFriction;
        this.vy *= movementFriction;

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > currentMaxSpeed) {
            const ratio = currentMaxSpeed / speed;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        if (Math.abs(this.vx) < 0.01) this.vx = 0;
        if (Math.abs(this.vy) < 0.01) this.vy = 0;

        this.x += this.vx;
        this.y += this.vy;

        // Hot Potato: Restrict players to their own half
        if (hotPotatoMode) {
            const mid = CANVAS_WIDTH / 2;
            if (this === player1 && this.x + this.radius > mid) {
                this.x = mid - this.radius;
                this.vx = 0;
            } else if (this === player2 && this.x - this.radius < mid) {
                this.x = mid + this.radius;
                this.vx = 0;
            }
        }

        this.checkWallCollision();

        // --- Shooting Charge Logic ---
        if (shootKey) {
            if (this.shootKeyReleased) {
                this.isCharging = true;
                this.charge += 2;
                if (this.charge > CHARGE_MAX) this.charge = CHARGE_MAX;
            }
            this.shootKeyReleased = false;
        } else {
            if (this.isCharging) {
                this.tryKick();
                this.charge = 0;
                this.isCharging = false;
            }
            this.shootKeyReleased = true;
        }
    }

    tryKick() {
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.radius + ball.radius + 20) { // Range
            const angle = Math.atan2(dy, dx);

            // Power calculation
            let power = (this.charge / 100) * 14; // Increased base power (was 10.5) for heavy ball
            if (this.superShot) {
                power = 25; // Massive power
                this.superShot = false;
                createParticles(ball.x, ball.y, '#e74c3c', 20); // Explosion effect
                SoundManager.playKick(); // Double sound for impact
                applyShake(15, 15); // Shake on super shot
            }
            if (power < 4) power = 4; // Min kick

            // Apply impulse smoothly to current velocity
            // We ADD to existing, allowing for curve/redirects
            ball.vx += Math.cos(angle) * power;
            ball.vy += Math.sin(angle) * power;

            this.kickTimer = 15; // Trigger kick animation

            createParticles(ball.x, ball.y, '#ffffff', 8);
            SoundManager.playKick();
        }
    }

    checkWallCollision() {
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx = 0; }
        if (this.x + this.radius > CANVAS_WIDTH) { this.x = CANVAS_WIDTH - this.radius; this.vx = 0; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy = 0; }
        if (this.y + this.radius > CANVAS_HEIGHT) { this.y = CANVAS_HEIGHT - this.radius; this.vy = 0; }
    }

    draw() {
        // Draw Shadow
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fill();
        ctx.closePath();

        // Frozen Visual
        if (this.frozen) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(52, 152, 219, 0.5)";
            ctx.fill();
        }

        // Super Shot Visual
        if (this.superShot) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "#e74c3c";
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (this.confused) {
            ctx.fillStyle = "white";
            ctx.font = "bold 24px Arial";
            ctx.textAlign = "center";
            ctx.fillText("😵", this.x, this.y - this.radius - 15);
        }

        // Sprite Rendering
        const img = redSprite;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Direction Handling (Flip if facing left)
        if (!this.facingRight) {
            ctx.scale(-1, 1);
        }

        // --- Draw Legs (Animation) ---
        // Calculate Bobbing (Vertical Bounce)
        const isMoving = (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1);
        const bobbing = (isMoving) ? Math.abs(Math.sin(this.animTimer)) * 3 : 0;

        // Reduced stride (6 instead of 10) to prevent "4 legs" look
        const legOffset = Math.sin(this.animTimer) * 6;
        const kickOffset = (this.kickTimer > 0) ? (15 - this.kickTimer) * 2 : 0;

        // Define colors
        const sockColor = this.color;
        const shoeColor = '#2c3e50';
        const skinColor = '#eebb99';

        // Helper to draw a foot (Slimmer, Athletic + Shorts)
        const drawFoot = (x, y, isBackLeg) => {
            const scale = isBackLeg ? 0.9 : 1.0;

            // 0. Shorts (Connection to Body)
            // Elongate shorts upwards to reach body from lower leg position
            ctx.fillStyle = (this.color === '#3498db' ? '#3498db' : this.color);
            // Default width: x - 3, width 6 -> User tried x-1, width 4
            // Now shrinking: width 3, height 12. Centered around x+0.5
            // KEEP SHORTS SLIM (Width 3)
            ctx.fillRect(x - 0.5 * scale, y - 24, 3 * scale, 12 * scale);

            // 1. Leg/Skin (Original Thinner & Longer - Width 4)
            // Reverting leg width to 4.
            // Center of shorts roughly x+1.
            // Legs need to be width 4. Center x+1 -> x+1 - 2 = x-1 start?
            // Previous code used x-2 for width 4. Let's stick to that for proper alignment.
            ctx.fillStyle = skinColor;
            ctx.fillRect(x - 1 * scale, y - 10, 4 * scale, 10 * scale);

            // 2. Sock (Thinner, fitting)
            let currentSockColor = sockColor;
            if (this.color === '#3498db') currentSockColor = '#3498db';

            ctx.fillStyle = currentSockColor;
            ctx.beginPath();
            // Sock width 4 (matching leg)
            // Start x-1.2, End x+3.2 (Width 4.4 for slight overlap)
            ctx.moveTo(x - 1.2 * scale, y);
            ctx.lineTo(x + 3.2 * scale, y);
            ctx.lineTo(x + 2.8 * scale, y + 8); // Slightly longer sock
            ctx.lineTo(x - 0.8 * scale, y + 8);
            ctx.fill();

            // 3. Shoe (Cleat - Streamlined)
            ctx.beginPath();
            ctx.fillStyle = shoeColor;
            // Shoe width ~6-7
            ctx.moveTo(x - 1 * scale, y + 7);
            ctx.lineTo(x + 5 * scale, y + 7); // Toe
            ctx.quadraticCurveTo(x + 7 * scale, y + 9, x + 5 * scale, y + 11);
            ctx.lineTo(x - 1 * scale, y + 11); // Heel
            ctx.lineTo(x - 2 * scale, y + 8); // Heel back
            ctx.fill();

            // 4. Studs
            ctx.fillStyle = '#ccc';
            ctx.fillRect(x + 0 * scale, y + 11, 2 * scale, 2 * scale);
            ctx.fillRect(x + 4 * scale, y + 11, 2 * scale, 2 * scale);

            // 5. Laces / Detail
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(x + 1 * scale, y + 7, 3 * scale, 1.5 * scale);
        };

        // Temporarily disable filter for geometric legs to get accurate colors
        if (this.color === '#3498db') {
            ctx.filter = 'none';
        }

        // Right Leg (Front)
        // Move Y UP to shorten legs (was 28, now 22)
        // Conditional X alignment: Blue (2). Red needs to be slightly RIGHT of previous (-1). Try 3.
        const isBlue = (this.color === '#3498db');
        let rightLegX = isBlue ? 2 : 3;
        let rightLegY = 22;
        if (this.kickTimer > 0) {
            rightLegX += kickOffset;
            rightLegY -= 12; // Adjusted kick height
        } else {
            rightLegX += legOffset;
            rightLegY -= Math.abs(legOffset) * 0.2;
        }

        // Left Leg (Back)
        // Conditional X alignment: Blue (-7). Red needs to be center -> -6?
        let leftLegX = (isBlue ? -7 : -6) - legOffset;
        let leftLegY = 22 - Math.abs(legOffset) * 0.2;

        // Draw Boots
        drawFoot(leftLegX, leftLegY, true);
        drawFoot(rightLegX, rightLegY, false);

        // Re-enable filter for Body Sprite if Blue Team
        if (this.color === '#3498db') {
            ctx.filter = 'hue-rotate(210deg) brightness(1.2) saturate(1.2)';
        }

        // Remove filter for body if we used it for legs, or keep it? 
        // Actually the sprite is red, so we apply filter to the whole context if blue.
        // But we already applied it above if needed.
        // Let's reset filter for body if we draw custom legs, BUT the body is an image.

        // NOTE: The sprite image likely includes the whole "ball" body.
        // We should draw legs BEHIND the body if possible, but the body is drawn after.
        // Wait, the body is drawn below this code block in the original plan.
        // Let's draw legs first (done above).

        // Draw Image (Centered) - Body
        const size = this.radius * 2.8;

        // Apply Bobbing to Body
        const bobY = -bobbing;

        if (img && img.complete) {
            // New: Crop the image to remove original legs/feet
            // Assuming legs are bottom 40% of the image.

            const cropHeightRatio = 0.6; // Keep top 60% of the image

            const sWidth = img.width;
            const sHeight = img.height * cropHeightRatio;

            // Calculate Destination Height
            // Standard width for everyone (0.8) to prevent "1D" look
            const dWidth = size * 0.8;
            const dHeight = size * cropHeightRatio;

            // Align bottom of torso with procedural legs (y ~ 12)
            const dY = (12 - dHeight) + bobY;

            // Special handling for Red Team to "slim only the waist" (Tapered Clip)
            if (this.color !== '#3498db') { // Red Team
                ctx.save();
                ctx.beginPath();
                // Organic V-Shape: Ultra-Thin Athletic
                const taperFactor = 0.; // Waist is 25% of shoulder width (Stick-man Athletic)

                // Reduce top width EVEN MORE (0.65) - Very narrow shoulders
                const topHalfWidth = (dWidth * 0.65) / 2;
                const bottomHalfWidth = (dWidth * taperFactor) / 2;

                // Shoulder Start (20% down from top)
                const shoulderY = dY + dHeight * 0.2;

                ctx.moveTo(-topHalfWidth, dY); // Top-Left (Neck)
                ctx.lineTo(topHalfWidth, dY);  // Top-Right (Neck)
                ctx.lineTo(topHalfWidth, shoulderY); // Shoulder Right

                // Curve to Waist (Right Side) - Aggressive curve
                ctx.quadraticCurveTo(topHalfWidth * 0.8, dY + dHeight * 0.5, bottomHalfWidth, dY + dHeight);

                ctx.lineTo(-bottomHalfWidth, dY + dHeight); // Bottom-Left (Narrow Waist)

                // Curve to Shoulder (Left Side) - Aggressive curve
                ctx.quadraticCurveTo(-topHalfWidth * 0.8, dY + dHeight * 0.5, -topHalfWidth, shoulderY);

                ctx.closePath();

                // Debug outline removed.
                ctx.clip(); // Clip the following image draw to this shape
            }

            ctx.drawImage(
                img,
                0, 0, sWidth, sHeight, // Source Crop
                -dWidth / 2, dY, // Destination Position
                dWidth, dHeight // Destination Size
            );

            if (this.color !== '#3498db') {
                ctx.restore(); // Undo clipping for subsequent draws (if any)
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, bobY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        ctx.restore();

        // Stamina Bar
        if (this.stamina < 100) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(this.x - 20, this.y + 25, 40, 5);
            ctx.fillStyle = "#f1c40f";
            ctx.fillRect(this.x - 20, this.y + 25, 40 * (this.stamina / 100), 5);
        }

        // Charge Bar
        if (this.isCharging) {
            ctx.fillStyle = "white";
            ctx.fillRect(this.x - 20, this.y - 35, 40, 8);
            ctx.fillStyle = `rgb(${2.55 * this.charge}, ${255 - 2.55 * this.charge}, 0)`;
            ctx.fillRect(this.x - 20, this.y - 35, 40 * (this.charge / 100), 8);
            ctx.strokeStyle = "black";
            ctx.strokeRect(this.x - 20, this.y - 35, 40, 8);
        }
    }
}

class Ball extends Entity {
    constructor(x, y) {
        super(x, y, BALL_RADIUS, '#ffffff');
        this.angle = 0;

        // Physics Properties (Default: Normal)
        this.friction = 0.96; // Haxball feel (was 0.985)
        this.elasticity = 0.95;
        this.maxSpeed = 15; // Increased max speed (was 13)
        this.type = 'normal';
    }

    setType(type) {
        this.type = type;
        if (type === 'bowling') {
            this.friction = 0.96; // Stops quicker
            this.elasticity = 0.6; // Low bounce
            this.maxSpeed = 18; // Can go fast if hit hard, but heavy
            this.color = '#2c3e50'; // Dark Grey
            this.radius = BALL_RADIUS;
        } else if (type === 'beach') {
            this.friction = 0.995; // Glides forever
            this.elasticity = 1.1; // Super bouncy
            this.maxSpeed = 10; // Slow but floaty
            this.color = '#e17055'; // Orange
            this.radius = BALL_RADIUS;
        } else if (type === 'pingpong') {
            this.friction = 0.99; // Air resistance, but light
            this.elasticity = 1.05; // Very bouncy
            this.maxSpeed = 20; // Very fast
            this.radius = 10; // Tiny!
            this.color = '#fab1a0'; // Matte Orange
        } else {
            // Normal
            this.friction = 0.985;
            this.elasticity = 0.95;
            this.maxSpeed = 13;
            this.color = '#ffffff';
            this.radius = BALL_RADIUS;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'normal') {
            // --- Realistic Soccer Ball ---
            // Base White
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Black Pentagons (Procedural)
            ctx.fillStyle = "#2c3e50";
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                const theta = (i * 2 * Math.PI) / 5;
                const dist = this.radius * 0.5;
                const x = Math.cos(theta) * dist;
                const y = Math.sin(theta) * dist;
                drawPentagon(ctx, x, y, this.radius * 0.25);
            }
            // Center one
            drawPentagon(ctx, 0, 0, this.radius * 0.25);

        } else if (this.type === 'bowling') {
            // ... (Bowling logic - Kept same as previous update plan, but ensuring it's in here)
            // 1. Base Dark
            const grad = ctx.createRadialGradient(-10, -10, 5, 0, 0, this.radius);
            // ... (rest of bowling logic)
            // NOTE: Re-implementing Bowling here because I'm replacing the whole block
            // Base Black (Shiny)
            const gradB = ctx.createRadialGradient(-10, -10, 5, 0, 0, this.radius);
            gradB.addColorStop(0, "#555");
            gradB.addColorStop(1, "#000");
            ctx.fillStyle = gradB;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Finger Holes
            ctx.fillStyle = "#111"; // Darker inside
            const holeOffset = this.radius * 0.4;

            ctx.beginPath(); ctx.arc(-5, -holeOffset, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(5, -holeOffset, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(0, holeOffset * 0.5, 5, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'beach') {
            // ... (Beach logic) ...
            const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ffffff', '#ff6b81'];

            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.fillStyle = colors[i];
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, this.radius, (i * Math.PI / 3), ((i + 1) * Math.PI / 3));
                ctx.lineTo(0, 0);
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = "white";
            ctx.fill();

        } else if (this.type === 'pingpong') {
            // --- Ping Pong Ball ---
            // Simple matte orange/white circle
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = "#fab1a0"; // Light Orange
            ctx.fill();

            // Subtle shading (Matte, no shine)
            const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, this.radius);
            grad.addColorStop(0, "rgba(255,255,255,0.2)");
            grad.addColorStop(1, "rgba(0,0,0,0.1)");
            ctx.fillStyle = grad;
            ctx.fill();

            // Thin border
            ctx.strokeStyle = "#e17055";
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Brand logo text (Tiny)
            ctx.fillStyle = "#d35400";
            ctx.font = "6px Arial";
            ctx.textAlign = "center";
            ctx.fillText("*** 3", 0, 2);
        }

        ctx.restore();
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Rotation
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.angle += speed * 0.05;

        this.vx *= this.friction;
        this.vy *= this.friction;

        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy); // Re-calc
        if (spd > this.maxSpeed) {
            const ratio = this.maxSpeed / spd;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        this.checkWallCollision();
    }

    checkWallCollision() {
        const goalTop = (CANVAS_HEIGHT - GOAL_HEIGHT) / 2;
        const goalBottom = (CANVAS_HEIGHT + GOAL_HEIGHT) / 2;

        // Top/Bottom Walls (Simple bounce)
        if (this.y - this.radius < 0) {
            this.y = this.radius + 5; // Keep push out to prevent stick
            this.vy = Math.abs(this.vy) * this.elasticity; // Force positive

            // Min bounce also dynamic? Maybe fixed min is fine.
            const minBounce = 6;
            if (this.vy < minBounce) this.vy = minBounce;

            // Add slight random lateral movement if stuck vertically
            if (Math.abs(this.vx) < 1) this.vx += (Math.random() - 0.5) * 4;

            SoundManager.playWall();
            applyShake(3, 3); // Reduced shake
        }
        if (this.y + this.radius > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.radius - 5; // Keep push out
            this.vy = -Math.abs(this.vy) * this.elasticity; // Force negative

            const minBounce = 6;
            if (this.vy > -minBounce) this.vy = -minBounce;

            // Add slight random lateral movement if stuck vertically
            if (Math.abs(this.vx) < 1) this.vx += (Math.random() - 0.5) * 4;

            SoundManager.playWall();
            applyShake(3, 3); // Reduced shake
        }

        // Left Side Logic
        if (!hotPotatoMode && this.x - this.radius < FIELD_MARGIN) {
            // Check Post Collision (Top Post)
            checkCircleCollision(this, FIELD_MARGIN, goalTop);
            // Check Post Collision (Bottom Post)
            checkCircleCollision(this, FIELD_MARGIN, goalBottom);

            // Check Net Structure (Left)
            checkGoalStructure(this, true);
        }

        // Right Side Logic
        if (!hotPotatoMode && this.x + this.radius > CANVAS_WIDTH - FIELD_MARGIN) {
            // Check Post Collision (Top Post)
            checkCircleCollision(this, CANVAS_WIDTH - FIELD_MARGIN, goalTop);
            // Check Post Collision (Bottom Post)
            checkCircleCollision(this, CANVAS_WIDTH - FIELD_MARGIN, goalBottom);

            // Check Net Structure (Right)
            checkGoalStructure(this, false);
        }

        // Screen Boundaries / Goal Lines
        // Screen Boundaries / Goal Lines
        // GOAL CHECK: If ball is within vertical goal range and crosses the goal line (FIELD_MARGIN)
        if (!hotPotatoMode && this.y > goalTop + this.radius && this.y < goalBottom - this.radius) {
            // Left Goal Scoring
            if (this.x < FIELD_MARGIN - this.radius) {
                handleGoal('blue');
                return; // Stop further physics
            }
            // Right Goal Scoring
            if (this.x > CANVAS_WIDTH - FIELD_MARGIN + this.radius) {
                handleGoal('red');
                return;
            }
        }

        // General Screen Boundary (Left/Right) - Only if NOT a goal (i.e. above/below posts)
        if (this.x - this.radius < 0 || this.x + this.radius > CANVAS_WIDTH) {
            // Side Wall Bounce (if somehow got behind net but not in goal - rare if net physics works)
            this.vx *= -this.elasticity;
            // ... (rest of bounce logic)
            if (this.x < CANVAS_WIDTH / 2) {
                this.x = this.radius + 5;
                if (this.vx < 6) this.vx = 6;
            } else {
                this.x = CANVAS_WIDTH - this.radius - 5;
                if (this.vx > -6) this.vx = -6;
            }
            SoundManager.playWall();
        }
    }
}

// --- Init Objects ---
const player1 = new Player(150 + FIELD_MARGIN, CANVAS_HEIGHT / 2, '#e74c3c', 'wasd');
const player2 = new Player(CANVAS_WIDTH - 150 - FIELD_MARGIN, CANVAS_HEIGHT / 2, '#3498db', 'arrows');
const ball = new Ball(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

// --- Functions ---

function initGame() {
    gameRunning = true;
    scoreRed = 0;
    scoreBlue = 0;

    // Read Setup Inputs
    p1Name = p1NameInput.value || t('default_red');
    p2Name = p2NameInput.value || t('default_blue');
    let durationMins = parseInt(durationInput.value) || 2;
    if (durationMins > 10) durationMins = 10;
    if (durationMins < 1) durationMins = 1;
    winningScore = parseInt(goalLimitInput.value) || 5;

    // Read Sound Settings
    soundEnabled = soundToggle.checked;

    // Read Game Mode
    const mode = document.querySelector('input[name="gameMode"]:checked').value;
    if (mode === '1p') {
        isVsAI = true;
        player2.controls = 'ai';
        // Reset AI Timer
        aiTimer = 0;
    } else {
        isVsAI = false;
        player2.controls = 'arrows';
    }

    // Chaos Mode
    const chaosCheck = document.getElementById('chaosMode');
    isChaosMode = chaosCheck.checked;
    if (isChaosMode) {
        ChaosManager.trigger(); // Start with chaos!
    } else {
        ChaosManager.reset();
    }

    // Hot Potato Mode
    const hotPotatoCheck = document.getElementById('hotPotatoMode');
    hotPotatoMode = hotPotatoCheck ? hotPotatoCheck.checked : false;
    if (hotPotatoMode) {
        bombTimer = 900; // 15 seconds at 60fps
        lastTouchedBy = null;
    }

    // Sudden Death Mode (Golden Goal)
    const suddenDeathCheck = document.getElementById('suddenDeathMode');
    suddenDeathMode = suddenDeathCheck ? suddenDeathCheck.checked : false;
    if (suddenDeathMode) {
        winningScore = 1;
        durationMins = 99; // Effectively infinite
    }

    // Announcer
    const announcerCheck = document.getElementById('announcerToggle');
    announcerEnabled = announcerCheck ? announcerCheck.checked : false;

    // Announce Match Start
    if (announcerEnabled) {
        setTimeout(() => SoundManager.speak(t('start_btn')), 500);
    }

    // Read Ball Type
    const ballTypeInput = document.querySelector('input[name="ballType"]:checked');
    const ballType = ballTypeInput ? ballTypeInput.value : 'normal';
    ball.setType(ballType);

    // Read Weather Condition
    const weatherInput = document.querySelector('input[name="weatherType"]:checked');
    weatherCondition = weatherInput ? weatherInput.value : 'sunny';
    applyWeatherPhysics();

    timeRemaining = durationMins * 60;

    updateScoreboard();
    updateTimerDisplay(); // Fix: Display immediately
    resetPositions();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    goalNotification.classList.add('hidden');

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    SoundManager.playWhistle();

    requestAnimationFrame(gameLoop);
}

function resetPositions() {
    player1.x = 150 + FIELD_MARGIN;
    player1.y = CANVAS_HEIGHT / 2;
    player2.x = CANVAS_WIDTH - 150 - FIELD_MARGIN;
    player2.y = CANVAS_HEIGHT / 2;

    ball.x = CANVAS_WIDTH / 2;
    ball.y = CANVAS_HEIGHT / 2;
    ball.vx = 0;
    ball.vy = 0;
}

// --- Visual Effects Functions ---
function applyShake(currentIntensity, duration) {
    shakeIntensity = currentIntensity;
    shakeTimer = duration;
}

function startSlowMo(duration, factor) {
    slowMoTimer = duration;
    slowMoFactor = factor;
}

function handleGoal(scoringTeam) {
    if (isGoalCelebration) return;
    isGoalCelebration = true;

    if (scoringTeam === 'red') {
        scoreRed++;
        if (scoreRed >= winningScore) {
            scoreRed = winningScore;
            endGame();
            return;
        }
    } else {
        scoreBlue++;
        if (scoreBlue >= winningScore) {
            scoreBlue = winningScore;
            endGame();
            return;
        }
    }

    updateScoreboard();

    // Goal Notification
    const scorerName = (scoringTeam === 'red') ? p1Name : p2Name;
    goalText.innerText = `${scorerName.toUpperCase()} ${t('goal_text')}`;
    goalNotification.classList.remove('hidden');

    // Celebration Effects
    startSlowMo(120, 0.1); // Ultra Slow motion for 2 sec (Rocket League style)
    SoundManager.playGoal();
    SoundManager.playExplosion();

    // Announcer: GOAL!
    if (announcerEnabled) {
        SoundManager.speak(`${scorerName} ${t('goal_text')}`);
    }

    // Explosion at ball position
    createExplosion(ball.x, ball.y);
    applyExplosionForce(ball.x, ball.y);

    startFanCelebration(); // Keep fan effects too because why not?

    // Reset or Chaos?
    setTimeout(() => {
        // clearInterval(confettiAnim); // Removed undefined reference
        resetPositions();
        isGoalCelebration = false;
        goalNotification.classList.add('hidden');

        // --- CHAOS TRIGGER ---
        if (isChaosMode && scoreRed < winningScore && scoreBlue < winningScore) {
            ChaosManager.trigger();
        } else {
            ChaosManager.reset();
        }
    }, 2000);
}

function updateScoreboard() {
    scoreRedEl.innerText = scoreRed;
    scoreBlueEl.innerText = scoreBlue;
}

function updateTimer() {
    if (!gameRunning) return;

    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
        endGame();
    }
}

function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    timerEl.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// End Game
function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);

    // Determine Winner
    if (scoreRed > scoreBlue) {
        winner = `${p1Name.toUpperCase()} ${t('won')}`;
    } else if (scoreBlue > scoreRed) {
        winner = `${p2Name.toUpperCase()} ${t('won')}`;
    } else {
        winner = t('draw_text') || "BERABERE";
    }

    winnerText.innerText = winner;
    gameOverScreen.classList.remove('hidden');

    // Announcer: Winner
    if (announcerEnabled) {
        SoundManager.speak(winner);
    }
}

// --- Physics Logic ---

function checkPlayerBallCollision(player) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = player.radius + ball.radius;

    if (distance < minDist) {
        // 1. Overlap Correction (Push ball out)
        const angle = Math.atan2(dy, dx);
        const overlap = minDist - distance;

        // Push ball away efficiently to prevent "sticking"
        ball.x += Math.cos(angle) * overlap;
        ball.y += Math.sin(angle) * overlap;

        // Hot Potato Logic
        if (hotPotatoMode) {
            lastTouchedBy = (player === player1) ? 'red' : 'blue';
        }

        // 2. Resolve Collision (Dribble / Push)
        // REMOVED: Automatic kick force and sound (as per user request)
        // Instead, we just "push" the ball with the player's velocity to simulate dribbling.

        // Push factor: Reduced for "Heavier" feel (Haxball style)
        // Was 1.3 / 1.1 -> Now 0.9 / 0.75
        // This means ball moves slightly SLOWER than player, requiring active pushing
        const pushFactor = player.isSprinting ? 0.9 : 0.75;

        // Apply player's velocity to ball
        // We blend the ball's current velocity with the player's velocity for smooth control
        if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
            ball.vx = player.vx * pushFactor;
            ball.vy = player.vy * pushFactor;
        } else {
            // If player is standing still but touching ball, give it a tiny nudge away so it doesn't clip
            // But NO flight.
            ball.vx += Math.cos(angle) * 0.5;
            ball.vy += Math.sin(angle) * 0.5;
        }

        // --- Hot Potato Logic: Tag & Reset ---
        if (hotPotatoMode) {
            lastTouchedBy = (player === player1) ? 'red' : 'blue';
            ball.color = (player === player1) ? '#ff4757' : '#2e86de';
            bombTimer = 900;
        }
    }
}

// Hot Potato Mode Variables
let hotPotatoMode = false;
let bombTimer = 0;
let lastTouchedBy = null;

let grassPattern = null;

function createGrassPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');

    // Base green
    pCtx.fillStyle = '#4CAF50';
    pCtx.fillRect(0, 0, 64, 64);

    // Noise/Texture
    for (let i = 0; i < 400; i++) {
        pCtx.fillStyle = Math.random() < 0.5 ? '#45a049' : '#5cb85c';
        pCtx.globalAlpha = 0.4;
        const x = Math.random() * 64;
        const y = Math.random() * 64;
        const w = 2 + Math.random() * 2;
        const h = 2 + Math.random() * 4;
        pCtx.fillRect(x, y, w, h);
    }

    return ctx.createPattern(pCanvas, 'repeat');
}

function checkCircleCollision(entity, cx, cy) {
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Post radius approx 5 + entity radius
    if (dist < entity.radius + 5) {
        const angle = Math.atan2(dy, dx);
        const overlap = (entity.radius + 5) - dist;

        entity.x += Math.cos(angle) * overlap;
        entity.y += Math.sin(angle) * overlap;

        // Bounce using Vector Reflection (Vnew = V - 2(V.N)N)
        // Normal vector (n) from center of circle (cx, cy) to entity
        // We already have dx, dy. Normalize them.
        // re-calculate angle/normal just to be safe with updated positions
        const nx = entity.x - cx;
        const ny = entity.y - cy;
        const len = Math.sqrt(nx * nx + ny * ny);

        if (len > 0) {
            const ux = nx / len;
            const uy = ny / len;

            // Dot product (V . N)
            const dot = entity.vx * ux + entity.vy * uy;

            // Only reflect if moving INTO the object (dot < 0)
            // This prevents "sticking" if we are already moving away but still overlapping
            if (dot < 0) {
                entity.vx = entity.vx - 2 * dot * ux;
                entity.vy = entity.vy - 2 * dot * uy;

                // Restore energy loss (elasticity)
                entity.vx *= 0.7; // Dampen post hits
                entity.vy *= 0.7;

                // Debounce wall sound
                const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
                if (speed > 1) {
                    SoundManager.playWall();
                }
                applyShake(8, 8);
            }
        }
    }
}

function checkGoalStructure(entity, isLeft) {
    const goalTop = (CANVAS_HEIGHT - GOAL_HEIGHT) / 2;
    const goalBottom = (CANVAS_HEIGHT + GOAL_HEIGHT) / 2;

    // KEY COORDINATES
    // MouthX: The line where the goal starts (field side)
    const mouthX = isLeft ? FIELD_MARGIN : CANVAS_WIDTH - FIELD_MARGIN;
    // BackX: The back of the net
    const backX = isLeft ? FIELD_MARGIN - GOAL_DEPTH : CANVAS_WIDTH - FIELD_MARGIN + GOAL_DEPTH;

    // 1. Check Side Nets (Top & Bottom Walls of the goal box)
    // We strictly check if the ball is WITHIN the depth range (between Mouth and Back)

    let inDepthRange = false;
    if (isLeft) {
        if (entity.x < mouthX + entity.radius && entity.x > backX - entity.radius) inDepthRange = true;
    } else {
        if (entity.x > mouthX - entity.radius && entity.x < backX + entity.radius) inDepthRange = true;
    }

    if (inDepthRange) {
        // TOP NET WALL
        // Check if ball is hitting the top net from below (inside goal) or above (outside)
        if (Math.abs(entity.y - goalTop) < entity.radius) {
            // Determine side: Inside goal (y > goalTop) or Outside (y < goalTop)?
            // We use the PREVIOUS velocity or simple position check

            // If dragging along the wall, simply bounce VY
            entity.vy *= -0.8;

            // Hard PROJECTION (Clamp)
            if (entity.y > goalTop) {
                // It was inside, keep it inside
                entity.y = goalTop + entity.radius + 1;
            } else {
                // It was outside, keep it outside
                entity.y = goalTop - entity.radius - 1;
            }
        }

        // BOTTOM NET WALL
        if (Math.abs(entity.y - goalBottom) < entity.radius) {
            entity.vy *= -0.8;

            // Hard PROJECTION (Clamp)
            if (entity.y < goalBottom) {
                // Inside
                entity.y = goalBottom - entity.radius - 1;
            } else {
                // Outside
                entity.y = goalBottom + entity.radius + 1;
            }
        }
    }

    // 2. Check Back Net
    // Condition: Entity is vertically within the goal mouth height
    if (entity.y > goalTop - entity.radius && entity.y < goalBottom + entity.radius) {
        // Collision with Back Plane
        if (Math.abs(entity.x - backX) < entity.radius) {
            entity.vx *= -0.8; // Bounce off back net
            entity.x = isLeft ? backX + entity.radius + 1 : backX - entity.radius - 1;

            SoundManager.playWall();
        }
    }
}

function drawField() {
    if (!grassPattern) grassPattern = createGrassPattern();

    // Fill Grass
    ctx.fillStyle = grassPattern;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Mowing Stripes (Overlay)
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    const stripeWidth = 120;
    for (let i = 0; i < CANVAS_WIDTH; i += stripeWidth * 2) {
        ctx.fillRect(i, 0, stripeWidth, CANVAS_HEIGHT);
    }









    if (false) {
        /* DELETED RAINY */
        ctx.lineWidth = 1;
        ctx.beginPath();
        rainDrops.forEach(d => {
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.l);
        });
        ctx.stroke();

        // Darken overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } else if (false) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        snowFlakes.forEach(f => {
            ctx.moveTo(f.x, f.y);
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        });
        ctx.fill();

        // White tint overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } else if (false) {
        // Icy Tint
        ctx.fillStyle = 'rgba(130, 200, 255, 0.15)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 4;

    // Outer line
    ctx.strokeRect(75, 30, CANVAS_WIDTH - 150, CANVAS_HEIGHT - 60);

    // Center line
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 30);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Center Dot
    ctx.beginPath();
    ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();

    const goalTop = (CANVAS_HEIGHT - GOAL_HEIGHT) / 2;
    const goalDepth = 60;

    // Draw Goals (Only if NOT in Hot Potato Mode)
    if (!hotPotatoMode) {
        drawGoal(ctx, FIELD_MARGIN, goalTop, goalDepth, GOAL_HEIGHT, true); // Left Goal
        drawGoal(ctx, CANVAS_WIDTH - FIELD_MARGIN, goalTop, goalDepth, GOAL_HEIGHT, false); // Right Goal
    }

    // Draw Posts (Over everything to simulate depth of "net enclosure" but posts are solid triggers)
    // Actually, drawGoal handles it.
    drawWeatherEffects();
}


function drawGoal(ctx, x, y, depth, height, isLeft) {
    const backX = isLeft ? x - depth : x + depth;

    ctx.save();

    // 1. Floor / Net Bottom
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(backX, y);
    ctx.lineTo(x, y);
    // Don't close back to start, it's the mouth

    // Net Texture (Grid)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;

    // Verticals
    for (let i = 0; i <= depth; i += 10) {
        const dx = isLeft ? -i : i;
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx, y + height);
    }

    // Horizontals
    for (let i = 0; i <= height; i += 10) {
        ctx.moveTo(x, y + i);
        ctx.lineTo(backX, y + i);
    }
    ctx.stroke();

    // 2. Frame (Back and Sides)
    ctx.strokeStyle = "rgba(200, 200, 200, 1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Top Bar
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(x, y + height);
    ctx.stroke();

    // 3. Posts (The main uprights)
    ctx.fillStyle = "#ecf0f1";
    ctx.strokeStyle = "#7f8c8d";
    ctx.lineWidth = 2;

    // Top Post
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bottom Post
    ctx.beginPath();
    ctx.arc(x, y + height, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// Corner Arcs
ctx.beginPath();
ctx.arc(75, 30, 20, 0, Math.PI * 0.5);
ctx.stroke();

ctx.beginPath();
ctx.arc(75, CANVAS_HEIGHT - 30, 20, Math.PI * 1.5, 0);
ctx.stroke();

ctx.beginPath();
ctx.arc(CANVAS_WIDTH - 75, 30, 20, Math.PI * 0.5, Math.PI);
ctx.stroke();

ctx.beginPath();
ctx.arc(CANVAS_WIDTH - 75, CANVAS_HEIGHT - 30, 20, Math.PI, Math.PI * 1.5);
ctx.stroke();

function drawGoal(ctx, x, y, depth, height, isLeft) {
    const backX = isLeft ? x - depth : x + depth;

    ctx.save();

    // 1. Floor / Net Bottom
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(backX, y);
    ctx.lineTo(x, y);
    // Don't close back to start, it's the mouth

    // Net Texture (Grid)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;

    // Verticals
    for (let i = 0; i <= depth; i += 10) {
        const dx = isLeft ? -i : i;
        ctx.moveTo(x + dx, y);
        ctx.lineTo(x + dx, y + height);
    }

    // Horizontals
    for (let i = 0; i <= height; i += 10) {
        ctx.moveTo(x, y + i);
        ctx.lineTo(backX, y + i);
    }
    ctx.stroke();

    // 2. Frame (Back and Sides)
    ctx.strokeStyle = "rgba(200, 200, 200, 1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Top Bar
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(x, y + height);
    ctx.stroke();

    // 3. Posts (The main uprights)
    ctx.fillStyle = "#ecf0f1";
    ctx.strokeStyle = "#7f8c8d";
    ctx.lineWidth = 2;

    // Top Post
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bottom Post
    ctx.beginPath();
    ctx.arc(x, y + height, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// --- Main Loop ---



function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;

    if (gamePaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
        requestAnimationFrame(gameLoop);
    }
}

function gameLoop(timestamp) {
    if (!gameRunning) return;

    // Pause Check
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Slow Motion Logic
    frameCount++;
    let shouldUpdate = true;
    if (slowMoTimer > 0) {
        slowMoTimer--;
        if (frameCount % slowMoFactor !== 0) {
            shouldUpdate = false;
        }
    } else {
        slowMoFactor = 1; // Reset
    }

    // Render Start
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save(); // Save for Shake
    // Screen Shake Apply
    if (shakeTimer > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
        shakeTimer--;
    }

    drawField();

    if (shouldUpdate) {
        updateWeatherEffects();
        player1.update();
        player2.update();
        ball.update();

        // --- Hot Potato Bomb Logic ---
        if (hotPotatoMode && !isGoalCelebration) {
            bombTimer--;

            // Flash effect (Pulse size/glow instead of color override)
            const flashRate = bombTimer < 180 ? 5 : (bombTimer < 360 ? 10 : 20);

            // Only override color to white briefly for ticking effect, otherwise keep player color
            if (lastTouchedBy) {
                if (Math.floor(bombTimer / flashRate) % 2 === 0) {
                    // Keep player color
                } else {
                    // Flash white for urgency
                    // ball.color = '#ffffff'; 
                    // Actually, user said "rengini alsın". Let's keep it player color but maybe flash white text?
                    // Or just let the ball be the color.
                    // Let's flash the ball color to a lighter shade?
                }
            } else {
                // Neutral ball (start) - Flash red/orange generic
                if (Math.floor(bombTimer / flashRate) % 2 === 0) ball.color = '#ff0000';
                else ball.color = '#ff6600';
            }

            // EXPLOSION!
            if (bombTimer <= 0) {
                // Determine loser: The person who "owns" the bomb (lastTouchedBy)
                let loser = lastTouchedBy;

                // If nobody touched it yet (neutral), fallback to position
                if (!loser) {
                    if (ball.x < CANVAS_WIDTH / 2) loser = 'red';
                    else loser = 'blue';
                }

                // Opponent scores
                const scoringTeam = (loser === 'red') ? 'blue' : 'red';

                // Big explosion effect
                createExplosion(ball.x, ball.y);
                applyExplosionForce(ball.x, ball.y);
                SoundManager.playExplosion();
                applyShake(15, 30);

                handleGoal(scoringTeam);

                // Reset bomb for next round
                bombTimer = 600 + Math.floor(Math.random() * 300); // 10-15 sec random
                lastTouchedBy = null;
                ball.color = '#ffffff'; // Reset to neutral color
            }
        }

        // Particles Update
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Power-ups Management
        // Spawn
        if (Math.random() < 0.0013 && powerUps.length < 2) {
            // Expanded Pool
            const types = ['speed', 'shot', 'freeze', 'tiny_ball', 'big_goals', 'confusion'];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = FIELD_MARGIN + 50 + Math.random() * (CANVAS_WIDTH - FIELD_MARGIN * 2 - 100);
            const y = FIELD_MARGIN + 50 + Math.random() * (CANVAS_HEIGHT - FIELD_MARGIN * 2 - 100);
            powerUps.push(new PowerUp(x, y, type));
        }

        // Power-up Collision
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.update();
            if (p.life <= 0) {
                powerUps.splice(i, 1);
                continue;
            }
            // Helper for collision checking inside loop...
            [player1, player2].forEach(player => {
                const dx = player.x - p.x;
                const dy = player.y - p.y;
                if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.radius) {
                    player.applyPowerUp(p.type);
                    powerUps.splice(i, 1);
                    createParticles(p.x, p.y, '#ffffff', 10);
                    SoundManager.playWhistle();
                }
            });
        }

        checkPlayerBallCollision(player1);
        checkPlayerBallCollision(player2);
    }

    // Always Draw (even if not updated for Smo-Mo, but positions are static then)
    // Actually, drawing static entities is fine.

    // Draw Powerups (outside update loop to ensure visibility)
    for (let p of powerUps) p.draw(ctx);

    for (let p of particles) p.draw(ctx);

    player1.draw();
    player2.draw();
    ball.draw();

    // --- Hot Potato Visual Effects ---
    if (hotPotatoMode) {
        // Draw Bomb Timer above ball
        const seconds = Math.ceil(bombTimer / 60);
        ctx.save();
        ctx.font = 'bold 28px Fredoka One';
        ctx.textAlign = 'center';
        ctx.fillStyle = bombTimer < 180 ? '#ff0000' : '#ff6600';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = bombTimer < 180 ? 20 : 10;
        ctx.fillText(`💣 ${seconds}`, ball.x, ball.y - ball.radius - 15);
        ctx.restore();

        // Draw Midfield Barrier Line (Red dashed)
        ctx.save();
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2, 0);
        ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // --- Draw Fan Effects ---
    updateAndDrawFanEffects();

    ctx.restore(); // Restore Shake

    // UI Overlay (Don't shake UI)
    ctx.fillStyle = "white";
    ctx.font = "14px Fredoka One";
    ctx.textAlign = "center";
    ctx.fillText(p1Name, player1.x, player1.y - 45);
    ctx.fillText(p2Name, player2.x, player2.y - 45);

    requestAnimationFrame(gameLoop);
}

// Global Event Listeners & Init Logic
document.addEventListener('DOMContentLoaded', () => {
    console.log("Game Initializing...");

    // Explicitly get elements to avoid null references
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const chaosModeBox = document.getElementById('chaosMode');
    const bombModeBox = document.getElementById('hotPotatoMode');
    const suddenDeathBox = document.getElementById('suddenDeathMode');

    if (startBtn) startBtn.addEventListener('click', initGame);
    if (restartBtn) restartBtn.addEventListener('click', initGame);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', () => {
            gameRunning = false;
            gamePaused = false;
            document.getElementById('pauseMenu').classList.add('hidden');

            // Reset Views
            startScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');

            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            drawField();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            SoundManager.setVolume(e.target.value);
        });
    }

    // Key Listener for Pause
    document.addEventListener('keydown', (e) => {
        if (gameRunning && (e.key === 'Escape' || e.key === 'P' || e.key === 'p')) {
            togglePause();
        }
    });

    // Announcer: Init
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices(); // Pre-load voices
    }

    // Initial Render
    drawField();
    player1.draw();
    player2.draw();
    ball.draw();

    console.log("Game Initialized Successfully!");
});

// --- Fan Celebration Logic ---

function startFanCelebration() {
    celebrationTimer = 180; // 3 seconds
}

function updateAndDrawFanEffects() {
    if (celebrationTimer > 0) {
        celebrationTimer--;

        // Spawn Flash
        if (Math.random() < 0.2) { // 20% chance per frame
            cameraFlashes.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                radius: 20 + Math.random() * 50,
                alpha: 1.0,
                life: 10
            });
        }

        // Spawn Emoji
        if (Math.random() < 0.1) {
            const emojis = ['👏', '🔥', '⚽', '🎉', '📸', '🙌'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const side = Math.random() < 0.5 ? 'top' : 'bottom';
            const startY = side === 'top' ? -20 : CANVAS_HEIGHT + 20;
            const vy = side === 'top' ? 2 + Math.random() * 2 : -2 - Math.random() * 2;

            crowdEmojis.push({
                x: Math.random() * CANVAS_WIDTH,
                y: startY,
                emoji: emoji,
                vy: vy,
                alpha: 1.0,
                life: 60
            });
        }
    }

    // Update & Draw Flashes
    for (let i = cameraFlashes.length - 1; i >= 0; i--) {
        const flash = cameraFlashes[i];
        flash.life--;
        flash.alpha = flash.life / 10;

        if (flash.life <= 0) {
            cameraFlashes.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = flash.alpha * 0.6;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Update & Draw Emojis
    ctx.save();
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    for (let i = crowdEmojis.length - 1; i >= 0; i--) {
        const item = crowdEmojis[i];
        item.y += item.vy;
        item.life--;
        item.alpha = Math.min(1, item.life / 20);

        if (item.life <= 0) {
            crowdEmojis.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = item.alpha;
        ctx.fillText(item.emoji, item.x, item.y);
    }
    ctx.restore();
}

function drawPentagon(ctx, x, y, radius) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const theta = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = x + Math.cos(theta) * radius;
        const py = y + Math.sin(theta) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

// --- Chaos Manager ---
const ChaosManager = {
    events: [
        { id: 'fast_players', name_key: 'chaos_fast_players', type: 'player_speed', value: 12 },
        { id: 'slow_players', name_key: 'chaos_slow_players', type: 'player_speed', value: 1.2 }, // Super Slow (Snail)
        { id: 'big_ball', name_key: 'chaos_big_ball', type: 'ball_radius', value: 40 },
        { id: 'tiny_ball', name_key: 'chaos_tiny_ball', type: 'ball_radius', value: 8 },
        { id: 'big_goals', name_key: 'chaos_big_goals', type: 'goal_height', value: 400 },
        { id: 'tiny_goals', name_key: 'chaos_tiny_goals', type: 'goal_height', value: 80 }
    ],

    activeEvents: [],

    trigger() {
        if (!isChaosMode) return;

        // Reset everything first
        this.reset();

        // Pick 1 to 3 random events
        const count = Math.floor(Math.random() * 3) + 1;
        this.activeEvents = [];

        // Shuffle events and pick
        const shuffled = [...this.events].sort(() => 0.5 - Math.random());

        // Logic to avoid conflicting events (e.g. big ball AND tiny ball)
        for (let evt of shuffled) {
            if (this.activeEvents.length >= count) break;

            const hasConflict = this.activeEvents.some(e => e.type === evt.type);
            if (!hasConflict) {
                this.activeEvents.push(evt);
            }
        }

        this.apply();
        this.showNotification();
    },

    apply() {
        this.activeEvents.forEach(evt => {
            if (evt.type === 'player_speed') PLAYER_SPEED = evt.value;
            if (evt.type === 'ball_radius') ball.radius = evt.value;
            if (evt.type === 'goal_height') GOAL_HEIGHT = evt.value;
        });
    },

    reset() {
        PLAYER_SPEED = BASE_PLAYER_SPEED; // Reset to new Base Speed

        // Reset Ball Radius based on Type
        if (ball.type === 'pingpong') ball.radius = 10;
        else if (ball.type === 'big') ball.radius = 40; // Should not happen as type, but just in case
        else ball.radius = 18; // Default

        GOAL_HEIGHT = 200; // Reset to default
        this.activeEvents = [];
    },

    showNotification() {
        const notif = document.getElementById('chaosNotification');
        const list = document.getElementById('chaosList');
        notif.classList.remove('hidden');

        // Debug info added to display
        list.innerHTML = this.activeEvents.map(e => `<div>${t(e.name_key)} <small>(${e.value})</small></div>`).join('');

        // Debug Log
        console.log("Chaos Applied:", this.activeEvents);
        console.log("Current Speed:", PLAYER_SPEED);
        console.log("Ball Radius:", ball.radius);

        // Play Chaos Sound (if implemented, for now reusing whistle or just silence)
        // SoundManager.playChaos(); 

        setTimeout(() => {
            notif.classList.add('hidden');
        }, 3000); // Increased duration to read
    }
};

// Hook into handleGoal
// const originalHandleGoal = handleGoal; // Removed unused wrapper

// --- Rocket League Style Effects ---

function createExplosion(x, y) {
    const colors = ['#e74c3c', '#c0392b', '#d35400', '#f39c12', '#ffffff', '#e74c3c']; // More Reds/Oranges
    for (let i = 0; i < 80; i++) { // More particles
        const color = colors[Math.floor(Math.random() * colors.length)];
        const p = new Particle(x, y, color);
        // Overwrite velocity for higher speed explosion
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 12 + 6; // Faster
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 60 + Math.random() * 40; // 1-1.6 sec
        particles.push(p);
    }
}

function applyExplosionForce(x, y) {
    const force = 30; // Strong push
    const range = 500; // Large radius

    const entities = [player1, player2, ball];
    entities.forEach(entity => {
        const dx = entity.x - x;
        const dy = entity.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < range) {
            const angle = Math.atan2(dy, dx);
            // Inversely proportional to distance
            let effect = (1 - dist / range);
            if (effect < 0) effect = 0;

            const push = effect * force;

            entity.vx += Math.cos(angle) * push;
            entity.vy += Math.sin(angle) * push;

            // Lift effect if close (simulated by y-push against gravity if we had it, but here just chaos)
            if (dist < 100) entity.vy -= 10;
        }
    });

    // Also shake screen hard
    applyShake(20, 30);
}

function startFanCelebration() {
    celebrationTimer = 180; // 3 seconds
}

function updateAndDrawFanEffects() {
    if (celebrationTimer > 0) {
        celebrationTimer--;

        // Spawn Flash
        if (Math.random() < 0.2) { // 20% chance per frame
            cameraFlashes.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                radius: 20 + Math.random() * 50,
                alpha: 1.0,
                life: 10
            });
        }

        // Spawn Emoji
        if (Math.random() < 0.1) {
            const emojis = ['👏', '🔥', '⚽', '🎉', '📸', '🙌'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const side = Math.random() < 0.5 ? 'top' : 'bottom';
            const startY = side === 'top' ? -20 : CANVAS_HEIGHT + 20;
            const vy = side === 'top' ? 2 + Math.random() * 2 : -2 - Math.random() * 2;

            crowdEmojis.push({
                x: Math.random() * CANVAS_WIDTH,
                y: startY,
                emoji: emoji,
                vy: vy,
                alpha: 1.0,
                life: 60
            });
        }
    }

    // Update & Draw Flashes
    for (let i = cameraFlashes.length - 1; i >= 0; i--) {
        const flash = cameraFlashes[i];
        flash.life--;
        flash.alpha = flash.life / 10;

        if (flash.life <= 0) {
            cameraFlashes.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = flash.alpha * 0.6;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Update & Draw Emojis
    ctx.save();
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    for (let i = crowdEmojis.length - 1; i >= 0; i--) {
        const item = crowdEmojis[i];
        item.y += item.vy;
        item.life--;
        item.alpha = Math.min(1, item.life / 20);

        if (item.life <= 0) {
            crowdEmojis.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = item.alpha;
        ctx.fillText(item.emoji, item.x, item.y);
    }
    ctx.restore();
}

// --- Weather System ---


function applyWeatherPhysics() {
    // Reset defaults first
    ball.friction = 0.98;
    // Player friction/speed could also be adjusted here if desired

    initWeatherEffects();

    if (weatherCondition === 'rainy') {
        ball.friction = 0.99; // Slippery/Fast
        SoundManager.startRainSound();
    } else {
        SoundManager.stopRainSound();
        if (weatherCondition === 'snowy') {
            ball.friction = 0.96; // Slow/Heavy
        } else if (weatherCondition === 'icy') {
            ball.friction = 0.995; // Ice skating!
        }
    }
}

function initWeatherEffects() {
    rainDrops = [];
    snowFlakes = [];

    if (weatherCondition === 'rainy') {
        for (let i = 0; i < 100; i++) {
            rainDrops.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                l: Math.random() * 20 + 10,
                vy: Math.random() * 10 + 10
            });
        }
    } else if (weatherCondition === 'snowy') {
        for (let i = 0; i < 50; i++) {
            snowFlakes.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                r: Math.random() * 3 + 1,
                vy: Math.random() * 2 + 1,
                vx: Math.random() * 1 - 0.5
            });
        }
    }
}

function updateWeatherEffects() {
    if (weatherCondition === 'rainy') {
        rainDrops.forEach(d => {
            d.y += d.vy;
            if (d.y > CANVAS_HEIGHT) {
                d.y = -20;
                d.x = Math.random() * CANVAS_WIDTH;
            }
        });
    } else if (weatherCondition === 'snowy') {
        snowFlakes.forEach(f => {
            f.y += f.vy;
            f.x += f.vx;
            if (f.y > CANVAS_HEIGHT) {
                f.y = -10;
                f.x = Math.random() * CANVAS_WIDTH;
            }
        });
    }
}

function drawWeatherEffects() {
    if (weatherCondition === 'sunny') {
        // Sun Rays (Gradient Overlay)
        const gradient = ctx.createRadialGradient(0, 0, 100, 0, 0, 800);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)'); // Bright center
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)'); // Fade out
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } else if (weatherCondition === 'rainy') {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.6)';
        ctx.lineWidth = 2; // Thicker rain
        ctx.beginPath();
        rainDrops.forEach(d => {
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.l);
        });
        ctx.stroke();

        // Darken overlay (Heavy clouds)
        ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } else if (weatherCondition === 'snowy') {
        // Snow Ground Cover
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(FIELD_MARGIN, FIELD_MARGIN, CANVAS_WIDTH - FIELD_MARGIN * 2, CANVAS_HEIGHT - FIELD_MARGIN * 2);

        // Snowflakes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        snowFlakes.forEach(f => {
            ctx.moveTo(f.x, f.y);
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        });
        ctx.fill();

        // General White Tint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    } else if (weatherCondition === 'icy') {
        // Icy Ground (Cyan tint on field)
        ctx.fillStyle = 'rgba(200, 240, 255, 0.4)';
        ctx.fillRect(FIELD_MARGIN, FIELD_MARGIN, CANVAS_WIDTH - FIELD_MARGIN * 2, CANVAS_HEIGHT - FIELD_MARGIN * 2);

        // Shine effects on ice (simple lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(400, 300); ctx.lineTo(450, 350);
        ctx.moveTo(1000, 600); ctx.lineTo(1100, 600);
        ctx.moveTo(1200, 200); ctx.lineTo(1250, 250);
        ctx.stroke();

        // General Cold Tint
        ctx.fillStyle = 'rgba(180, 220, 255, 0.1)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

