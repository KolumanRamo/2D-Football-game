// js/main.js
import { Config, State } from './config.js';
import { currentLang, t } from './lang.js';
import { SoundManager } from './audio.js';
import { Particle, particles, powerUps, PowerUp, createParticles } from './particles.js';
import { applyShake, startSlowMo, createExplosion, applyExplosionForce } from './utils.js';
import { player1, player2, ball, aiController } from './entities.js';
import { ChaosManager } from './chaos.js';

import { applyWeatherPhysics, updateWeatherEffects, drawWeatherEffects } from './weather.js';
import { NetworkManager } from './network.js';
import { keys } from './input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreRedEl = document.getElementById('scoreRed');
const scoreBlueEl = document.getElementById('scoreBlue');
const timerEl = document.getElementById('timer');
const winnerText = document.getElementById('winnerText');
const pauseMenu = document.getElementById('pauseMenu');

const p1NameInput = document.getElementById('p1NameInput');
const p2NameInput = document.getElementById('p2NameInput');
const durationInput = document.getElementById('durationInput');
const goalLimitInput = document.getElementById('goalLimitInput');
const soundToggle = document.getElementById('soundToggle');
const goalNotification = document.getElementById('goalNotification');
const goalText = document.getElementById('goalText');

let timerInterval;

window.addEventListener('langChanged', () => {
    SoundManager.setLang(currentLang);
});

function initGame() {
    State.gameRunning = true;
    // Hide Lobby, Show Game overlay
    const mainUI = document.getElementById('mainUI');
    const onlineMenu = document.getElementById('onlineMenu');
    if (mainUI) mainUI.classList.add('hidden');
    if (onlineMenu) onlineMenu.classList.add('hidden');
    if (lobbyMenu) lobbyMenu.classList.add('hidden');

    const quickChatUI = document.getElementById('quickChatUI');
    if (quickChatUI && State.isOnline) {
        quickChatUI.classList.remove('hidden');
    }

    State.scoreRed = 0;
    State.scoreBlue = 0;

    // Reset Match Stats
    State.matchStats = {
        red: { shots: 0, saves: 0, possessionFrames: 0 },
        blue: { shots: 0, saves: 0, possessionFrames: 0 }
    };

    updateCoinDisplay();

    State.p1Name = p1NameInput.value || t('default_red');
    State.p2Name = p2NameInput.value || t('default_blue');
    let durationMins = parseInt(durationInput.value) || 2;
    if (durationMins > 10) durationMins = 10;
    if (durationMins < 1) durationMins = 1;
    State.winningScore = parseInt(goalLimitInput.value) || 5;

    SoundManager.setSoundEnabled(soundToggle.checked);

    const mode = document.querySelector('input[name="gameMode"]:checked').value;
    if (mode === '1p') {
        State.isVsAI = true;
        player2.controls = 'ai';
        aiController.timer = 0;
    } else {
        State.isVsAI = false;
        player2.controls = 'arrows';
    }

    // Chaos mode and other config evaluation moved below

    const hotPotatoCheck = document.getElementById('hotPotatoMode');
    State.hotPotatoMode = hotPotatoCheck ? hotPotatoCheck.checked : false;
    if (State.hotPotatoMode) {
        State.bombTimer = 900;
        State.lastTouchedBy = null;
    }

    const suddenDeathCheck = document.getElementById('suddenDeathMode');
    State.suddenDeathMode = suddenDeathCheck ? suddenDeathCheck.checked : false;
    if (State.suddenDeathMode) {
        State.winningScore = 1;
        durationMins = 99;
    }

    const announcerCheck = document.getElementById('announcerToggle');
    State.announcerEnabled = announcerCheck ? announcerCheck.checked : false;

    const nightCheck = document.getElementById('nightModeToggle');
    State.nightMode = nightCheck ? nightCheck.checked : false;
    State.grassBitmap = null; // Forces recreate with new colors

    if (State.announcerEnabled) {
        setTimeout(() => SoundManager.speak(t('start_btn')), 500);
    }

    const ballTypeInput = document.querySelector('input[name="ballType"]:checked');
    const ballType = ballTypeInput ? ballTypeInput.value : 'normal';
    ball.setType(ballType);

    const weatherInput = document.querySelector('input[name="weatherType"]:checked');
    State.weatherCondition = weatherInput ? weatherInput.value : 'sunny';
    applyWeatherPhysics();

    const chaosCheck = document.getElementById('chaosMode');
    State.isChaosMode = chaosCheck ? chaosCheck.checked : false;
    if (State.isChaosMode) {
        ChaosManager.trigger();
    } else {
        ChaosManager.reset();
    }

    State.timeRemaining = durationMins * 60;

    updateScoreboard();
    updateTimerDisplay();
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
    player1.x = 150 + Config.FIELD_MARGIN;
    player1.y = Config.CANVAS_HEIGHT / 2;
    player1.vx = 0;
    player1.vy = 0;
    player1.activePowerUp = null;
    player1.powerUpTimer = 0;

    player2.x = Config.CANVAS_WIDTH - 150 - Config.FIELD_MARGIN;
    player2.y = Config.CANVAS_HEIGHT / 2;
    player2.vx = 0;
    player2.vy = 0;
    player2.activePowerUp = null;
    player2.powerUpTimer = 0;

    ball.x = Config.CANVAS_WIDTH / 2;
    ball.y = Config.CANVAS_HEIGHT / 2;
    ball.vx = 0;
    ball.vy = 0;

    // Clear all active powerups from field
    powerUps.length = 0;
}

function handleGoal(scoringTeam) {
    if (State.isGoalCelebration) return;
    State.isGoalCelebration = true;

    if (scoringTeam === 'red') {
        State.scoreRed++;
        if (State.scoreRed >= State.winningScore) {
            State.scoreRed = State.winningScore;
            endGame();
            return;
        }
    } else {
        State.scoreBlue++;
        if (State.scoreBlue >= State.winningScore) {
            State.scoreBlue = State.winningScore;
            endGame();
            return;
        }
    }

    updateScoreboard();

    const scorerName = (scoringTeam === 'red') ? State.p1Name : State.p2Name;
    goalText.innerText = `${scorerName.toUpperCase()} ${t('goal_text')}`;
    goalNotification.classList.remove('hidden');

    startSlowMo(120, 0.1);
    SoundManager.playGoal();
    SoundManager.playExplosion();

    createExplosion(ball.x, ball.y);
    applyExplosionForce(ball.x, ball.y, [player1, player2, ball]);
    applyShake(25, 40); // Increased intensity

    const scorer = (scoringTeam === 'red') ? player1 : player2;
    scorer.celebrating = true;
    scorer.celebrationTimer = 180;

    State.celebrationTimer = 180;

    State.goalWaitTimer = 240;

    // Networking: Notify client immediately of goal for perfect sync
    if (State.isOnline && State.networkRole === 'host') {
        NetworkManager.conn.send({ type: 'goal', team: scoringTeam });
    }
}

function updateScoreboard() {
    scoreRedEl.innerText = State.scoreRed;
    scoreBlueEl.innerText = State.scoreBlue;
}

function updateTimer() {
    if (!State.gameRunning) return;

    State.timeRemaining--;
    updateTimerDisplay();

    if (State.timeRemaining <= 0) {
        endGame();
    }
}

function updateTimerDisplay() {
    let minutes = Math.floor(State.timeRemaining / 60);
    let seconds = State.timeRemaining % 60;
    timerEl.innerText = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function endGame() {
    State.gameRunning = false;
    clearInterval(timerInterval);

    let winner;
    if (State.scoreRed > State.scoreBlue) {
        winner = `${State.p1Name.toUpperCase()} ${t('won')}`;
    } else if (State.scoreBlue > State.scoreRed) {
        winner = `${State.p2Name.toUpperCase()} ${t('won')}`;
    } else {
        winner = t('draw_text') || "BERABERE";
    }

    winnerText.innerText = winner;

    // --- METAGAME COIN AWARDS ---
    if (!State.isOnline || (State.isOnline && State.myTeam)) {
        // Base participation coins
        let coinsEarned = 10;

        let iWon = false;
        if (State.scoreRed > State.scoreBlue && (State.myTeam === 'red' || !State.isOnline)) iWon = true;
        if (State.scoreBlue > State.scoreRed && (State.myTeam === 'blue' || !State.isOnline)) iWon = true;

        if (iWon) coinsEarned += 25; // Win bonus

        // Add performance bonuses
        const myTeamStats = State.matchStats[State.myTeam || 'red']; // default 'red' for offline P1 focus
        coinsEarned += (myTeamStats.shots * 2);
        coinsEarned += (myTeamStats.saves * 5);

        State.coins += coinsEarned;
        saveMetagameData(); // Send to backend/localStorage

        const pmCoinAmount = document.getElementById('pmCoinAmount');
        if (pmCoinAmount) pmCoinAmount.innerText = `+${coinsEarned}`;
    }

    const postMatchScreen = document.getElementById('postMatchScreen');
    if (postMatchScreen) {
        // Populate stats
        const redPossession = Math.round((State.matchStats.red.possessionFrames / Math.max(1, State.matchStats.red.possessionFrames + State.matchStats.blue.possessionFrames)) * 100) || 50;

        document.getElementById('pmRedPossession').innerText = `%${redPossession}`;
        document.getElementById('pmBluePossession').innerText = `%${100 - redPossession}`;
        document.getElementById('pmRedShots').innerText = State.matchStats.red.shots;
        document.getElementById('pmBlueShots').innerText = State.matchStats.blue.shots;
        document.getElementById('pmRedSaves').innerText = State.matchStats.red.saves;
        document.getElementById('pmBlueSaves').innerText = State.matchStats.blue.saves;

        postMatchScreen.classList.remove('hidden');
    } else {
        gameOverScreen.classList.remove('hidden');
    }

    if (State.announcerEnabled) {
        SoundManager.speak(winner);
    }
}

function togglePause() {
    if (!State.gameRunning) return;
    State.gamePaused = !State.gamePaused;

    if (State.gamePaused) {
        pauseMenu.classList.remove('hidden');
    } else {
        pauseMenu.classList.add('hidden');
        // REPLACED: No need to call requestAnimationFrame here as gameLoop is already running in the background while paused.
    }
}

function drawGoal(ctx, x, y, depth, height, isLeft) {
    const backX = isLeft ? x - depth : x + depth;
    const midY = y + height / 2;
    ctx.save();

    // ---- Net shadow fill ----
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();

    // ---- Net mesh: vertical lines ----
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.8;
    const netSpacing = 10;
    for (let i = 0; i <= Math.abs(depth); i += netSpacing) {
        const nx = isLeft ? x - i : x + i;
        // Perspective: lines slightly converge toward back
        const perspY1 = y + i * 0.05;
        const perspY2 = y + height - i * 0.05;
        ctx.beginPath();
        ctx.moveTo(nx, perspY1);
        ctx.lineTo(nx, perspY2);
        ctx.stroke();
    }
    // ---- Net mesh: horizontal lines ----
    for (let i = 0; i <= height; i += netSpacing) {
        const ny = y + i;
        ctx.beginPath();
        ctx.moveTo(x, ny);
        ctx.lineTo(backX, ny + (isLeft ? -i * 0.04 : i * 0.04));
        ctx.stroke();
    }

    // ---- Crossbar (top post) ----
    const postGrad = ctx.createLinearGradient(backX, y, x, y);
    postGrad.addColorStop(0, '#aaaaaa');
    postGrad.addColorStop(0.4, '#ffffff');
    postGrad.addColorStop(1, '#cccccc');
    ctx.strokeStyle = postGrad;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(backX, y);
    ctx.stroke();

    // ---- Bottom bar ----
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(backX, y + height);
    ctx.stroke();

    // ---- Back post ----
    ctx.beginPath();
    ctx.moveTo(backX, y);
    ctx.lineTo(backX, y + height);
    ctx.stroke();

    // ---- Front posts (two circles = top and bottom pegs on goal mouth) ----
    const drawPost = (px, py) => {
        const g = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 7);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, '#d0d0d0');
        g.addColorStop(1, '#888888');
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    drawPost(x, y);
    drawPost(x, y + height);

    // ---- Goal mouth line on field ----
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + height);
    ctx.stroke();

    ctx.restore();
}

function createGrassPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = Config.CANVAS_WIDTH;
    pCanvas.height = Config.CANVAS_HEIGHT;
    const pCtx = pCanvas.getContext('2d');

    const stripeW = 120;
    const darkGrass = State.nightMode ? '#1e3f23' : '#3a7d44';
    const lightGrass = State.nightMode ? '#2a5a31' : '#4CAF50';

    for (let i = 0; i < Config.CANVAS_WIDTH; i += stripeW) {
        const color = Math.floor(i / stripeW) % 2 === 0 ? darkGrass : lightGrass;
        // Base color
        pCtx.fillStyle = color;
        pCtx.fillRect(i, 0, stripeW, Config.CANVAS_HEIGHT);
        // Add subtle grass texture within stripe
        for (let j = 0; j < 200; j++) {
            const gx = i + Math.random() * stripeW;
            const gy = Math.random() * Config.CANVAS_HEIGHT;
            const brightness = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
            pCtx.fillStyle = brightness;
            pCtx.fillRect(gx, gy, 2, 3 + Math.random() * 4);
        }
        // Subtle gradient along each stripe (top lighter, bottom slightly darker)
        const sg = pCtx.createLinearGradient(0, 0, 0, Config.CANVAS_HEIGHT);
        sg.addColorStop(0, 'rgba(255,255,255,0.06)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0)');
        sg.addColorStop(1, 'rgba(0,0,0,0.08)');
        pCtx.fillStyle = sg;
        pCtx.fillRect(i, 0, stripeW, Config.CANVAS_HEIGHT);
    }

    return pCanvas;
}

function drawField() {
    if (!State.grassBitmap) State.grassBitmap = createGrassPattern();

    // Draw the pre-rendered grass
    ctx.drawImage(State.grassBitmap, 0, 0);

    // Stadium floodlight shafts
    ctx.save();
    for (let i = 0; i < 4; i++) {
        const lx = (Config.CANVAS_WIDTH / 5) * (i + 1);
        const grad = ctx.createLinearGradient(lx, 0, lx, Config.CANVAS_HEIGHT);
        grad.addColorStop(0, 'rgba(255,255,240,0.07)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
        grad.addColorStop(1, 'rgba(255,255,240,0.07)');
        ctx.fillStyle = grad;
        ctx.fillRect(lx - 30, 0, 60, Config.CANVAS_HEIGHT);
    }
    ctx.restore();

    // Field lines — with glow
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Outer boundary
    ctx.strokeRect(75, 30, Config.CANVAS_WIDTH - 150, Config.CANVAS_HEIGHT - 60);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(Config.CANVAS_WIDTH / 2, 30);
    ctx.lineTo(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT - 30);
    ctx.stroke();

    // Centre circle
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Centre spot
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Penalty spots
    ctx.beginPath();
    ctx.arc(Config.FIELD_MARGIN + 80, Config.CANVAS_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(Config.CANVAS_WIDTH - Config.FIELD_MARGIN - 80, Config.CANVAS_HEIGHT / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    const penW = 140, penH = 280;
    const penTop = (Config.CANVAS_HEIGHT - penH) / 2;
    ctx.strokeRect(75, penTop, penW, penH);
    ctx.strokeRect(Config.CANVAS_WIDTH - 75 - penW, penTop, penW, penH);

    // Corner arcs
    const corners = [
        [75, 30, 0, Math.PI * 0.5],
        [75, Config.CANVAS_HEIGHT - 30, Math.PI * 1.5, 0],
        [Config.CANVAS_WIDTH - 75, 30, Math.PI * 0.5, Math.PI],
        [Config.CANVAS_WIDTH - 75, Config.CANVAS_HEIGHT - 30, Math.PI, Math.PI * 1.5]
    ];
    corners.forEach(([cx, cy, sa, ea]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 22, sa, ea);
        ctx.stroke();
    });

    ctx.restore();

    // Goals
    const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
    const goalDepth = 60;
    if (!State.hotPotatoMode) {
        drawGoal(ctx, Config.FIELD_MARGIN, goalTop, goalDepth, State.GOAL_HEIGHT, true);
        drawGoal(ctx, Config.CANVAS_WIDTH - Config.FIELD_MARGIN, goalTop, goalDepth, State.GOAL_HEIGHT, false);
    }

    // Vignette overlay
    ctx.save();
    const vig = ctx.createRadialGradient(
        Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, Config.CANVAS_HEIGHT * 0.3,
        Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2, Config.CANVAS_WIDTH * 0.75
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
    ctx.restore();

    drawWeatherEffects(ctx);

    // Night Mode Lighting (Overlays)
    if (State.nightMode) {
        // Ambient darkness overlay
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(8, 12, 35, 0.78)';
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
        ctx.restore();

        // High-quality Stadium Spotlights
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const spots = [
            [0, 0], [Config.CANVAS_WIDTH, 0],
            [0, Config.CANVAS_HEIGHT], [Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT]
        ];
        spots.forEach(([sx, sy]) => {
            const grad = ctx.createRadialGradient(sx, sy, 50, sx, sy, 800);
            grad.addColorStop(0, 'rgba(255, 255, 230, 0.4)');
            grad.addColorStop(0.3, 'rgba(255, 255, 230, 0.15)');
            grad.addColorStop(1, 'rgba(255, 255, 230, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

            // Volumetric light beams
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            const bx = sx < Config.CANVAS_WIDTH / 2 ? sx + 300 : sx - 300;
            ctx.lineTo(bx, sy + 600);
            ctx.lineTo(bx + (sx < Config.CANVAS_WIDTH / 2 ? 400 : -400), sy + 600);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();
        });
        ctx.restore();
    }
}

function drawShadows() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";

    // Players shadows
    [player1, player2].forEach(p => {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.radius - 5, p.radius * 0.8, p.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    // Ball shadow
    ctx.beginPath();
    const ballShadowWidth = ball.radius * (1 + (ball.vy / 20) * 0.2); // Subtle width change with speed
    ctx.ellipse(ball.x, ball.y + ball.radius - 2, ballShadowWidth, ball.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBallTrail() {
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 8) {
        State.ballTrail.push({ x: ball.x, y: ball.y, alpha: 0.6, color: ball.color });
    }

    if (State.ballTrail.length > 12) State.ballTrail.shift();

    ctx.save();
    for (let i = 0; i < State.ballTrail.length; i++) {
        const p = State.ballTrail[i];
        p.alpha -= 0.045;
        if (p.alpha <= 0) continue;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color || "white";
        ctx.beginPath();
        ctx.arc(p.x, p.y, ball.radius * (i / State.ballTrail.length), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    State.ballTrail = State.ballTrail.filter(p => p.alpha > 0);
}

function drawPostProcessing() {
    // Subtle bloom and contrast for Professional look
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    // Hint of saturation/vibrance
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
    ctx.restore();
}

function updateAndDrawFanEffects() {
    if (State.celebrationTimer > 0) {
        State.celebrationTimer--;

        if (Math.random() < 0.2) {
            State.cameraFlashes.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: Math.random() * Config.CANVAS_HEIGHT,
                radius: 20 + Math.random() * 50,
                alpha: 1.0,
                life: 10
            });
        }

        if (Math.random() < 0.1) {
            const emojis = ['👏', '🔥', '⚽', '🎉', '📸', '🙌'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            const side = Math.random() < 0.5 ? 'top' : 'bottom';
            const startY = side === 'top' ? -20 : Config.CANVAS_HEIGHT + 20;
            const vy = side === 'top' ? 2 + Math.random() * 2 : -2 - Math.random() * 2;

            State.crowdEmojis.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: startY,
                emoji: emoji,
                vy: vy,
                alpha: 1.0,
                life: 60
            });
        }

        // Removed duplicated block
    }

    // Draw Quick Chat messages OUTSIDE celebration timer
    for (let i = State.chatMessages.length - 1; i >= 0; i--) {
        const msg = State.chatMessages[i];
        msg.life--;
        if (msg.life <= 0) {
            State.chatMessages.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1.0, msg.life / 20); // Fade out
        ctx.font = 'bold 24px Fredoka One';
        ctx.textAlign = 'center';
        ctx.fillStyle = msg.color || '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;

        const yOffset = -70 - (60 - msg.life) * 0.5; // Float up slightly
        ctx.strokeText(msg.text, msg.x, msg.y + yOffset);
        ctx.fillText(msg.text, msg.x, msg.y + yOffset);

        ctx.font = '14px Fredoka One';
        ctx.fillStyle = '#f1c40f';
        ctx.strokeText(msg.playerName, msg.x, msg.y + yOffset - 25);
        ctx.fillText(msg.playerName, msg.x, msg.y + yOffset - 25);

        ctx.restore();
    }

    for (let i = State.cameraFlashes.length - 1; i >= 0; i--) {
        const flash = State.cameraFlashes[i];
        flash.life--;
        flash.alpha = flash.life / 10;

        if (flash.life <= 0) {
            State.cameraFlashes.splice(i, 1);
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

    ctx.save();
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    for (let i = State.crowdEmojis.length - 1; i >= 0; i--) {
        const item = State.crowdEmojis[i];
        item.y += item.vy;
        item.life--;
        item.alpha = Math.min(1, item.life / 20);

        if (item.life <= 0) {
            State.crowdEmojis.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = item.alpha;
        ctx.fillText(item.emoji, item.x, item.y);
    }
    ctx.restore();
}

function checkPlayerBallCollision(player) {
    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = player.radius + ball.radius;

    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;

        ball.x += Math.cos(angle) * (overlap + 2);
        ball.y += Math.sin(angle) * (overlap + 2);

        const pushFactor = player.isSprinting ? 0.9 : 0.75;
        const playerSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        if (playerSpeed > 0.1) {
            ball.vx = player.vx * pushFactor;
            ball.vy = player.vy * pushFactor;
        } else {
            ball.vx += Math.cos(angle) * 1.5;
            ball.vy += Math.sin(angle) * 1.5;
        }

        SoundManager.playWall();

        SoundManager.playWall();

        const playerTeam = (player === player1) ? 'red' : 'blue';

        // --- STAT TRACKING (Saves & Possession) ---
        if (ball.isShotOnGoal && ball.shotRegisteredFor && ball.shotRegisteredFor !== playerTeam) {
            // Reversing a shot! It's a save.
            State.matchStats[playerTeam].saves++;
            ball.isShotOnGoal = false; // Save completed

            // Pop some text or juice for the save
            createParticles(ball.x, ball.y, '#f1c40f', 15);
        }

        State.lastTouchedBy = playerTeam;

        if (State.hotPotatoMode) {
            ball.color = (player === player1) ? '#ff4757' : '#2e86de';
            State.bombTimer = 900;
        }
    }
}

function checkPlayerPlayerCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = p1.radius + p2.radius;

    if (distance < minDistance) {
        const angle = Math.atan2(dy, dx);
        const overlap = minDistance - distance;

        p1.x -= Math.cos(angle) * overlap / 2;
        p1.y -= Math.sin(angle) * overlap / 2;
        p2.x += Math.cos(angle) * overlap / 2;
        p2.y += Math.sin(angle) * overlap / 2;


        const force = 2;
        p1.vx -= Math.cos(angle) * force;
        p1.vy -= Math.sin(angle) * force;
        p2.vx += Math.cos(angle) * force;
        p2.vy += Math.sin(angle) * force;
    }
}

function gameLoop(timestamp) {
    if (!State.gameRunning) return;

    if (State.gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    State.frameCount++;
    let shouldUpdate = true;
    if (State.slowMoTimer > 0) {
        State.slowMoTimer--;
        if (State.frameCount % State.slowMoFactor !== 0) {
            shouldUpdate = false;
        }
    } else {
        State.slowMoFactor = 1;
    }

    ctx.clearRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    ctx.save();
    if (State.shakeTimer > 0) {
        const dx = (Math.random() - 0.5) * State.shakeIntensity;
        const dy = (Math.random() - 0.5) * State.shakeIntensity;
        ctx.translate(dx, dy);
        State.shakeTimer--;
    }

    drawField();

    if (State.isGoalCelebration) {
        State.goalWaitTimer--;
        if (State.goalWaitTimer <= 0) {
            resetPositions();
            State.isGoalCelebration = false;
            goalNotification.classList.add('hidden');
            if (State.isChaosMode && State.scoreRed < State.winningScore && State.scoreBlue < State.winningScore) {
                ChaosManager.trigger();
            } else {
                ChaosManager.reset();
            }
        }
    }

    // Network Tick (Host broadcasts state)
    if (State.isOnline && State.networkRole === 'host') {
        const now = Date.now();
        if (!State.lastNetworkTick) State.lastNetworkTick = now;
        if (now - State.lastNetworkTick >= Config.TICK_TIME) {

            // Determine the remote player's last processed input
            // The Host always runs the client's input. The client sends an input with an 'id'.
            // The Host stores this in State.remoteInput.id when it receives it.
            const p2LastProcessed = State.remoteInput ? (State.remoteInput.id || 0) : 0;
            const p1LastProcessed = State.remoteInput ? (State.remoteInput.id || 0) : 0;

            // Send authoritative state
            const payload = {
                ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, color: ball.color },
                p1: { x: player1.x, y: player1.y, vx: player1.vx, vy: player1.vy, sprint: player1.isSprinting, charge: player1.charge, stamina: player1.stamina, facing: player1.facingRight, celebrating: player1.celebrating, lastProcessed: p1LastProcessed },
                p2: { x: player2.x, y: player2.y, vx: player2.vx, vy: player2.vy, sprint: player2.isSprinting, charge: player2.charge, stamina: player2.stamina, facing: player2.facingRight, celebrating: player2.celebrating, lastProcessed: p2LastProcessed },
                scores: { red: State.scoreRed, blue: State.scoreBlue, time: State.timeRemaining }
            };
            NetworkManager.sendState(payload);
            State.lastNetworkTick = now;
        }
    }

    if (shouldUpdate && !State.isGoalCelebration) {
        updateWeatherEffects();

        // --- GATHER INPUTS ---
        let p1Input = null;
        let p2Input = null;

        if (State.isOnline) {
            if (State.networkRole === 'host') {
                // Host reads local input directly, remote input from client
                p1Input = { up: keys['KeyW'], down: keys['KeyS'], left: keys['KeyA'], right: keys['KeyD'], sprint: keys['ShiftLeft'], shoot: keys['Space'] };
                p2Input = State.remoteInput;
            } else {
                // Client reads local input directly, creates packet
                State.currentInputId++;
                const currentInput = {
                    id: State.currentInputId,
                    up: keys['KeyW'] || keys['ArrowUp'],
                    down: keys['KeyS'] || keys['ArrowDown'],
                    left: keys['KeyA'] || keys['ArrowLeft'],
                    right: keys['KeyD'] || keys['ArrowRight'],
                    sprint: keys['ShiftLeft'] || keys['Shift'] || keys['ControlRight'],
                    shoot: keys['Space'] || keys['Enter']
                };

                State.pendingInputs.push(currentInput);

                // For client's local simulation, we apply the current input we just pressed
                // If myTeam is red, the client is P1, otherwise P2
                if (State.myTeam === 'red') p1Input = currentInput;
                else p2Input = currentInput;

                // We send it to host
                NetworkManager.sendInput(currentInput);
            }
        } else {
            // Offline
            p1Input = { up: keys['KeyW'], down: keys['KeyS'], left: keys['KeyA'], right: keys['KeyD'], sprint: keys['ShiftLeft'], shoot: keys['Space'] };
            p2Input = { up: keys['ArrowUp'], down: keys['ArrowDown'], left: keys['ArrowLeft'], right: keys['ArrowRight'], sprint: keys['ControlRight'], shoot: keys['Enter'] };
            if (State.isVsAI) p2Input = null; // AI will calculate inside 
        }

        // --- APPLY PHYSICS ---
        // Player 1
        player1.update(p1Input);
        if (player1.isCharging && !player1.frozen) {
            player1.charge += (player1.isSprinting ? 1.5 : 1.0);
            if (player1.charge > 100) player1.charge = 100;
            if (player1.charge > 85 && Math.random() < 0.25) applyShake(2, 3);
        } else if (player1.charge > 0) {
            player1.tryKick();
            if (player1.charge > 90) applyShake(12, 12);
            player1.charge = 0;
        }

        // Player 2
        player2.update(p2Input);
        if (player2.isCharging && !player2.frozen) {
            player2.charge += (player2.isSprinting ? 1.5 : 1.0);
            if (player2.charge > 100) player2.charge = 100;
            if (player2.charge > 85 && Math.random() < 0.25) applyShake(2, 3);
        } else if (player2.charge > 0) {
            player2.tryKick();
            if (player2.charge > 90) applyShake(12, 12);
            player2.charge = 0;
        }

        ball.update(handleGoal);

        // Track Possession
        if (State.lastTouchedBy === 'red') {
            State.matchStats.red.possessionFrames++;
        } else if (State.lastTouchedBy === 'blue') {
            State.matchStats.blue.possessionFrames++;
        }

        if (State.hotPotatoMode && !State.isGoalCelebration) {
            State.bombTimer--;

            const flashRate = State.bombTimer < 180 ? 5 : (State.bombTimer < 360 ? 10 : 20);

            if (!State.lastTouchedBy) {
                if (Math.floor(State.bombTimer / flashRate) % 2 === 0) ball.color = '#ff0000';
                else ball.color = '#ff6600';
            }

            if (State.bombTimer <= 0) {
                let loser = State.lastTouchedBy;

                if (!loser) {
                    if (ball.x < Config.CANVAS_WIDTH / 2) loser = 'red';
                    else loser = 'blue';
                }

                const scoringTeam = (loser === 'red') ? 'blue' : 'red';

                createExplosion(ball.x, ball.y);
                applyExplosionForce(ball.x, ball.y, [player1, player2, ball]);
                SoundManager.playExplosion();
                applyShake(15, 30);

                handleGoal(scoringTeam);

                State.bombTimer = 600 + Math.floor(Math.random() * 300);
                State.lastTouchedBy = null;
                ball.color = '#ffffff';
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Power-ups ONLY spawn in Chaos mode
        if (State.isChaosMode && Math.random() < 0.0013 && powerUps.length < 2) {
            const types = ['speed', 'shot', 'freeze', 'tiny_ball', 'big_goals', 'confusion'];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = Config.FIELD_MARGIN + 50 + Math.random() * (Config.CANVAS_WIDTH - Config.FIELD_MARGIN * 2 - 100);
            const y = Config.FIELD_MARGIN + 50 + Math.random() * (Config.CANVAS_HEIGHT - Config.FIELD_MARGIN * 2 - 100);
            powerUps.push(new PowerUp(x, y, type));
        }

        for (let i = powerUps.length - 1; i >= 0; i--) {
            const p = powerUps[i];
            p.update();
            if (p.life <= 0) {
                powerUps.splice(i, 1);
                continue;
            }
            let picked = false;
            for (const player of [player1, player2]) {
                if (picked) break;
                const dx = player.x - p.x;
                const dy = player.y - p.y;
                if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.radius) {
                    player.applyPowerUp(p.type);
                    powerUps.splice(i, 1);
                    createParticles(p.x, p.y, '#ffffff', 10);
                    SoundManager.playWhistle();
                    picked = true;
                }
            }
        }

        checkPlayerBallCollision(player1);
        checkPlayerBallCollision(player2);
    }

    drawShadows();
    drawBallTrail();
    for (let p of powerUps) p.draw(ctx);
    for (let p of particles) p.draw(ctx);

    // --- INTERPOLATION FOR RENDERING ---
    let renderP1X = player1.x, renderP1Y = player1.y;
    let renderP2X = player2.x, renderP2Y = player2.y;
    let renderBallX = ball.x, renderBallY = ball.y;

    if (State.isOnline && State.networkRole === 'client') {
        const lerp = State.lerpFactor;

        // Local player uses explicit prediction (no lerp, snaps and reconciles)
        // Remote entity uses smooth interpolation from authoritative state updates

        if (State.myTeam === 'red') {
            // I am P1. I predict P1. I need to lerp P2 and Ball.
            if (player2.targetX !== undefined) {
                player2.x += (player2.targetX - player2.x) * lerp;
                player2.y += (player2.targetY - player2.y) * lerp;
                renderP2X = player2.x; renderP2Y = player2.y;
            }
        } else {
            // I am P2. I predict P2. I need to lerp P1 and Ball.
            if (player1.targetX !== undefined) {
                player1.x += (player1.targetX - player1.x) * lerp;
                player1.y += (player1.targetY - player1.y) * lerp;
                renderP1X = player1.x; renderP1Y = player1.y;
            }
        }

        if (ball.targetX !== undefined) {
            // Extrapolation combined with Interpolation
            // If ball moves fast, target is further along
            const predictedTargetX = ball.targetX + ball.vx;
            const predictedTargetY = ball.targetY + ball.vy;

            ball.x += (predictedTargetX - ball.x) * lerp;
            ball.y += (predictedTargetY - ball.y) * lerp;
            renderBallX = ball.x; renderBallY = ball.y;
        }
    }

    // Pass rendering coords to draw
    player1.draw(ctx, renderP1X, renderP1Y);
    player2.draw(ctx, renderP2X, renderP2Y);
    ball.draw(ctx, renderBallX, renderBallY);

    if (State.hotPotatoMode) {
        const seconds = Math.ceil(State.bombTimer / 60);
        ctx.save();
        ctx.font = 'bold 28px Fredoka One';
        ctx.textAlign = 'center';
        ctx.fillStyle = State.bombTimer < 180 ? '#ff0000' : '#ff6600';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = State.bombTimer < 180 ? 20 : 10;
        ctx.fillText(`💣 ${seconds}`, ball.x, ball.y - ball.radius - 15);
        ctx.restore();

        ctx.save();
        ctx.setLineDash([15, 10]);
        ctx.strokeStyle = 'rgba(255, 50, 50, 0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Config.CANVAS_WIDTH / 2, 0);
        ctx.lineTo(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    updateAndDrawFanEffects();
    drawPostProcessing();

    ctx.restore();

    ctx.fillStyle = "white";
    ctx.font = "14px Fredoka One";
    ctx.textAlign = "center";
    ctx.fillText(State.p1Name, player1.x, player1.y - 45);
    ctx.fillText(State.p2Name, player2.x, player2.y - 45);

    // --- Networking Sync ---
    if (State.isOnline && State.networkRole === 'host') {
        const scorePack = {
            scoreRed: State.scoreRed,
            scoreBlue: State.scoreBlue,
            time: State.timeRemaining
        };
        NetworkManager.sendState({
            p1: { x: player1.x, y: player1.y, vx: player1.vx, vy: player1.vy, sprint: player1.isSprinting, charge: player1.charge, stamina: player1.stamina, facing: player1.facingRight, celebrating: player1.celebrating },
            p2: { x: player2.x, y: player2.y, vx: player2.vx, vy: player2.vy, sprint: player2.isSprinting, charge: player2.charge, stamina: player2.stamina, facing: player2.facingRight, celebrating: player2.celebrating },
            ball: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, color: ball.color },
            scores: scorePack
        });
    }

    // Removed: old legacy naive input sending. 
    // Handled above in Gather Inputs stage where we attach sequence IDs.

    requestAnimationFrame(gameLoop);
}

// Networking Event Listeners
window.addEventListener('applyRemoteState', (e) => {
    const s = e.detail;

    // Remote State received on Client
    const myPlayer = (State.myTeam === 'red') ? player1 : player2;
    const opponent = (State.myTeam === 'red') ? player2 : player1;
    const sMyPlayer = (State.myTeam === 'red') ? s.p1 : s.p2;
    const sOpponent = (State.myTeam === 'red') ? s.p2 : s.p1;

    // 1. RECONCILIATION FOR LOCAL PLAYER
    // Remove inputs that have already been processed by the server
    State.pendingInputs = State.pendingInputs.filter(input => input.id > sMyPlayer.lastProcessed);

    // Calculate where server says we should be based on processed inputs
    const serverX = sMyPlayer.x;
    const serverY = sMyPlayer.y;

    // Check if our predicted position is wildly different from server's verified position (e.g. > 10 pixels off)
    // If it is, we snap back to server, and "re-simulate" the pending inputs instantly.
    const dx = myPlayer.x - serverX;
    const dy = myPlayer.y - serverY;

    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
        console.warn('Prediction drift! Reconciling server state.');
        myPlayer.x = serverX;
        myPlayer.y = serverY;
        myPlayer.vx = sMyPlayer.vx;
        myPlayer.vy = sMyPlayer.vy;

        // Re-apply unacknowledged pending inputs
        State.pendingInputs.forEach(input => {
            myPlayer.update(input);
        });
    }

    // 2. INTERPOLATION TARGETS FOR REMOTE ENTITIES
    // Rather than snapping, we tell them where they "should" be
    opponent.targetX = sOpponent.x;
    opponent.targetY = sOpponent.y;
    opponent.vx = sOpponent.vx; // Snap velocities to make anims look right
    opponent.vy = sOpponent.vy;

    // Same for ball
    ball.targetX = s.ball.x;
    ball.targetY = s.ball.y;
    ball.vx = s.ball.vx;
    ball.vy = s.ball.vy;
    ball.color = s.ball.color;

    // Basic state syncing
    opponent.isSprinting = sOpponent.sprint;
    opponent.charge = sOpponent.charge;
    opponent.stamina = sOpponent.stamina;
    opponent.facingRight = sOpponent.facing;
    opponent.celebrating = sOpponent.celebrating;

    State.scoreRed = s.scores.scoreRed;
    State.scoreBlue = s.scores.scoreBlue;
    State.timeRemaining = s.scores.time;
    updateScoreboard();
    updateTimerDisplay();
});

window.addEventListener('networkGoal', (e) => {
    handleGoal(e.detail);
});

// --- Lobby Logic ---
const lobbyMenu = document.getElementById('lobbyMenu');
const lobbyRoomName = document.getElementById('lobbyRoomName');
const lobbyRedList = document.getElementById('lobbyRedList');
const lobbySpecList = document.getElementById('lobbySpecList');
const lobbyBlueList = document.getElementById('lobbyBlueList');

function updateLobbyUI() {
    lobbyRedList.innerHTML = '';
    lobbySpecList.innerHTML = '';
    lobbyBlueList.innerHTML = '';

    let redCount = 0;
    let blueCount = 0;

    for (const [id, player] of Object.entries(State.lobby.players)) {
        const div = document.createElement('div');
        div.className = 'player-list-item';
        const readyText = player.isReady ? '<span style="color: #2ecc71; font-size: 0.8rem;">[HAZIR]</span>' : '';
        div.innerHTML = `<span>${player.name}</span> <span>${readyText} ${player.isHost ? '👑' : ''}</span>`;

        if (player.team === 'red') {
            lobbyRedList.appendChild(div);
            redCount++;
            if (player.isReady) readyCount++;
        } else if (player.team === 'blue') {
            lobbyBlueList.appendChild(div);
            blueCount++;
            if (player.isReady) readyCount++;
        } else {
            lobbySpecList.appendChild(div);
        }
    }

    if (State.networkRole === 'host') {
        const startBtn = document.getElementById('lobbyStartBtn');
        if (startBtn) {
            startBtn.style.display = 'block';
            // Start only if at least 1v1 AND everyone in a team is ready.
            const totalPlayersInTeams = redCount + blueCount;
            startBtn.disabled = !(redCount >= 1 && blueCount >= 1 && readyCount === totalPlayersInTeams);
            startBtn.style.opacity = startBtn.disabled ? '0.5' : '1';
        }

        const waitMsg = document.getElementById('lobbyWaitMsg');
        if (waitMsg) waitMsg.style.display = 'none';

        // Enable inputs
        document.getElementById('lobbyDuration').disabled = false;
        document.getElementById('lobbyGoalLimit').disabled = false;
        document.getElementById('lobbyWeather').disabled = false;
        document.getElementById('lobbyBallType').disabled = false;
    } else {
        const startBtn = document.getElementById('lobbyStartBtn');
        if (startBtn) startBtn.style.display = 'none';

        const waitMsg = document.getElementById('lobbyWaitMsg');
        if (waitMsg) waitMsg.style.display = 'block';

        // Disable inputs
        document.getElementById('lobbyDuration').disabled = true;
        document.getElementById('lobbyGoalLimit').disabled = true;
        document.getElementById('lobbyWeather').disabled = true;
        document.getElementById('lobbyBallType').disabled = true;

        // Sync inputs
        if (State.lobby.settings) {
            document.getElementById('lobbyDuration').value = State.lobby.settings.duration;
            document.getElementById('lobbyGoalLimit').value = State.lobby.settings.goalLimit;
            document.getElementById('lobbyWeather').value = State.lobby.settings.weather;
            document.getElementById('lobbyBallType').value = State.lobby.settings.ballType;
        }
    }
}

window.addEventListener('lobbyStateUpdated', () => {
    updateLobbyUI();
});

window.addEventListener('lobbyActionReceived', (e) => {
    if (State.networkRole !== 'host') return;
    const action = e.detail;

    if (action.action === 'join_team') {
        if (State.lobby.players[action.peerId]) {
            State.lobby.players[action.peerId].team = action.team;
        } else {
            State.lobby.players[action.peerId] = { name: action.name, team: action.team, isHost: false, isReady: false };
        }
        NetworkManager.sendLobbyState(State.lobby);
        updateLobbyUI();
    } else if (action.action === 'toggle_ready') {
        if (State.lobby.players[action.peerId]) {
            State.lobby.players[action.peerId].isReady = action.isReady;
        }
        NetworkManager.sendLobbyState(State.lobby);
        updateLobbyUI();
    }
});

window.addEventListener('networkStartGame', () => {
    // Apply settings
    if (document.getElementById('durationInput')) {
        document.getElementById('durationInput').value = State.lobby.settings.duration;
    }
    if (document.getElementById('goalLimitInput')) {
        document.getElementById('goalLimitInput').value = State.lobby.settings.goalLimit;
    }

    State.weatherCondition = State.lobby.settings.weather;
    // ball.setType handling is in initGame, but we need to override the radio check somehow.
    // Instead, we just let initGame read the lobby values directly if we are online.

    lobbyMenu.classList.add('hidden');

    // Assign roles. For simplicity, if you are 'red' in lobby, you control P1. If 'blue', P2.
    // Actually, network input is sent blindly. We just need to know who we are.
    const myPlayerInfo = State.lobby.players[State.peerId];
    if (myPlayerInfo) {
        State.myTeam = myPlayerInfo.team;
    }

    initGame();
});

window.addEventListener('networkReady', () => {
    // Show Lobby
    if (lobbyMenu) lobbyMenu.classList.remove('hidden');
    startScreen.classList.add('hidden');

    const myName = State.networkRole === 'host' ? document.getElementById('p1NameInput').value : document.getElementById('p2NameInput').value;

    if (State.networkRole === 'host') {
        State.lobby.players[State.peerId] = { name: myName || 'Host', team: 'red', isHost: true };

        State.lobby.settings = {
            duration: document.getElementById('lobbyDuration').value,
            goalLimit: document.getElementById('lobbyGoalLimit').value,
            weather: document.getElementById('lobbyWeather').value,
            ballType: document.getElementById('lobbyBallType').value
        };

        NetworkManager.sendLobbyState(State.lobby);
        updateLobbyUI();
    } else {
        // Join as spectator to start
        NetworkManager.sendLobbyAction({ action: 'join_team', peerId: State.peerId, name: myName || 'Oyuncu', team: 'spec' });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    console.log("Game Initializing via Module...");

    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const mainMenuBtn = document.getElementById('mainMenuBtn');
    const volumeSlider = document.getElementById('volumeSlider');

    if (startBtn) startBtn.addEventListener('click', initGame);
    if (restartBtn) restartBtn.addEventListener('click', initGame);
    if (resumeBtn) resumeBtn.addEventListener('click', togglePause);

    // Online UI Listeners
    const onlineBtn = document.getElementById('onlineBtn');
    const onlineMenu = document.getElementById('onlineMenu');
    const hostBtn = document.getElementById('hostBtn');
    const joinBtn = document.getElementById('joinBtn');
    const backBtn = document.getElementById('backToMainBtn');
    const joinIdInput = document.getElementById('joinIdInput');
    const myPeerIdEl = document.getElementById('myPeerId');


    if (onlineBtn) onlineBtn.addEventListener('click', () => {
        onlineMenu.classList.remove('hidden');
        NetworkManager.init();
    });


    if (hostBtn) hostBtn.addEventListener('click', () => NetworkManager.host());
    if (joinBtn) joinBtn.addEventListener('click', () => NetworkManager.join(joinIdInput.value));
    if (backBtn) backBtn.addEventListener('click', () => onlineMenu.classList.add('hidden'));

    if (myPeerIdEl) {
        myPeerIdEl.addEventListener('click', () => {
            navigator.clipboard.writeText(myPeerIdEl.innerText);
            alert("Oda kodu kopyalandı!");
        });
    }

    // Lobby Listeners
    const joinRedBtn = document.getElementById('joinRedBtn');
    const joinBlueBtn = document.getElementById('joinBlueBtn');
    const joinSpecBtn = document.getElementById('joinSpecBtn');
    const lobbyStartBtn = document.getElementById('lobbyStartBtn');
    const lobbyLeaveBtn = document.getElementById('lobbyLeaveBtn');
    const lobbyCopyIdBtn = document.getElementById('lobbyCopyIdBtn');

    if (joinRedBtn) joinRedBtn.addEventListener('click', () => handleTeamJoin('red'));
    if (joinBlueBtn) joinBlueBtn.addEventListener('click', () => handleTeamJoin('blue'));
    if (joinSpecBtn) joinSpecBtn.addEventListener('click', () => handleTeamJoin('spec'));

    function handleTeamJoin(team) {
        const myName = State.networkRole === 'host' ? document.getElementById('p1NameInput').value : document.getElementById('p2NameInput').value;
        if (State.networkRole === 'host') {
            State.lobby.players[State.peerId] = { name: myName || 'Host', team: team, isHost: true };
            NetworkManager.sendLobbyState(State.lobby);
            updateLobbyUI();
        } else {
            NetworkManager.sendLobbyAction({ action: 'join_team', peerId: State.peerId, name: myName || 'Oyuncu', team: team });
        }
    }

    if (lobbyStartBtn) {
        lobbyStartBtn.addEventListener('click', () => {
            if (State.networkRole !== 'host') return;
            State.isChaosMode = !!(document.getElementById('lobbyChaosMode') && document.getElementById('lobbyChaosMode').checked);
            State.hotPotatoMode = !!(document.getElementById('lobbyBombMode') && document.getElementById('lobbyBombMode').checked);
            State.suddenDeathMode = !!(document.getElementById('lobbySuddenDeath') && document.getElementById('lobbySuddenDeath').checked);
            NetworkManager.sendStartGame();
            lobbyMenu.classList.add('hidden');
            const myPlayerInfo = State.lobby.players[State.peerId];
            if (myPlayerInfo) State.myTeam = myPlayerInfo.team;
            initGame();
        });
    }

    if (lobbyLeaveBtn) {
        lobbyLeaveBtn.addEventListener('click', () => {
            location.reload();
        });
    }

    if (lobbyCopyIdBtn) {
        lobbyCopyIdBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(State.peerId);
            alert("Oda linki/kodu kopyalandı:\n" + State.peerId);
        });
    }

    // Lobby Settings Sync
    const lobbyInputs = ['lobbyDuration', 'lobbyGoalLimit', 'lobbyWeather', 'lobbyBallType', 'lobbyChaosMode', 'lobbyBombMode', 'lobbySuddenDeath'];
    lobbyInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (State.networkRole === 'host') {
                    State.lobby.settings.duration = document.getElementById('lobbyDuration').value;
                    State.lobby.settings.goalLimit = document.getElementById('lobbyGoalLimit').value;
                    State.lobby.settings.weather = document.getElementById('lobbyWeather').value;
                    State.lobby.settings.ballType = document.getElementById('lobbyBallType').value;
                    NetworkManager.sendLobbyState(State.lobby);
                }
            });
        }
    });

    if (mainMenuBtn) {
        mainMenuBtn.addEventListener('click', () => {
            State.gameRunning = false;
            State.gamePaused = false;
            document.getElementById('pauseMenu').classList.add('hidden');

            const postMatchScreen = document.getElementById('postMatchScreen');
            if (postMatchScreen) postMatchScreen.classList.add('hidden');

            startScreen.classList.remove('hidden');
            gameOverScreen.classList.add('hidden');

            // If online, go back to lobby instead
            if (State.isOnline) {
                startScreen.classList.add('hidden');
                if (lobbyMenu) lobbyMenu.classList.remove('hidden');

                // Reset ready states for next match
                for (let id in State.lobby.players) {
                    if (!State.lobby.players[id].isHost) {
                        State.lobby.players[id].isReady = false;
                    }
                }
                updateLobbyUI();
            }

            ctx.clearRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
            drawField();
        });
    }

    // Post Match Continue Button
    const pmContinueBtn = document.getElementById('pmContinueBtn');
    if (pmContinueBtn) {
        pmContinueBtn.addEventListener('click', () => {
            const postMatchScreen = document.getElementById('postMatchScreen');
            if (postMatchScreen) postMatchScreen.classList.add('hidden');

            updateCoinDisplay();
            if (mainMenuBtn) mainMenuBtn.click(); // Reuse main menu btn logic to return to right screen
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            SoundManager.setVolume(e.target.value);
        });
    }


    // Keydown Interception for Quick Chat
    const CHAT_MESSAGES = {
        '1': 'Harika Pas!',
        '2': 'İyi Oyundu! (GG)',
        '3': 'Kusura Bakma!',
        '4': 'Şanslıydın!'
    };

    document.addEventListener('keydown', (e) => {
        if (State.gameRunning && (e.key === 'Escape' || e.key === 'P' || e.key === 'p')) {
            togglePause();
            return;
        }

        if (State.gameRunning && State.isOnline && CHAT_MESSAGES[e.key]) {
            const msgText = CHAT_MESSAGES[e.key];
            const me = State.lobby.players[State.peerId];
            if (!me) return;

            // Send to Network
            NetworkManager.sendChat(msgText, me.name, me.team);

            // Create locally
            spawnQuickChat(msgText, me.name, me.team);

            // Show UI briefly visually
            const chatUI = document.getElementById('quickChatUI');
            if (chatUI) {
                chatUI.style.transform = 'scale(1.1)';
                setTimeout(() => chatUI.style.transform = 'scale(1)', 100);
            }
        }
    });

    // Networking Event for Chat
    window.addEventListener('networkChat', (e) => {
        const { text, playerName, team } = e.detail;
        spawnQuickChat(text, playerName, team);
    });

    function spawnQuickChat(text, playerName, team) {
        let originX, originY, color;
        if (team === 'red') {
            originX = player1.x; originY = player1.y;
            color = '#ff6b6b';
        } else if (team === 'blue') {
            originX = player2.x; originY = player2.y;
            color = '#4dabf7';
        } else {
            originX = Config.CANVAS_WIDTH / 2; originY = 100; // Spec chat?
            color = '#ffffff';
        }

        // Add variation so multiple chats don't perfectly overlap
        const rx = (Math.random() - 0.5) * 40;

        State.chatMessages.push({
            text: text,
            playerName: playerName,
            x: originX + rx,
            y: originY,
            color: color,
            life: 90 // Frames
        });

        SoundManager.playWhistle(); // Sub with chat ping later if customized
    }

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }

    // --- METAGAME & SHOP INITIALIZATION ---
    initAuthUI();
    initShopUI();
    initLobbyBrowser();

    drawField();
    player1.draw(ctx);
    player2.draw(ctx);
    ball.draw(ctx);

    console.log("Game Initialized Successfully!");
});

// --- AUTHENTICATION & METAGAME FUNCTIONS ---
let authToken = localStorage.getItem('arcadeFootball_token');

function initAuthUI() {
    const authScreen = document.getElementById('authScreen');
    const startScreen = document.getElementById('startScreen');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const playOfflineBtn = document.getElementById('playOfflineBtn');

    const userInp = document.getElementById('authUsername');
    const passInp = document.getElementById('authPassword');
    const errMsg = document.getElementById('authErrorMsg');

    if (!authScreen) return; // Means html not loaded yet

    if (authToken) {
        authScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        loadMetagameData();
    } else {
        startScreen.classList.add('hidden');
    }

    async function handleAuth(isLogin) {
        const username = userInp.value.trim();
        const password = passInp.value;
        if (!username || !password) {
            errMsg.innerText = "Kullanıcı adı ve şifre giriniz.";
            return;
        }

        const endpoint = isLogin ? '/api/login' : '/api/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                authToken = data.token;
                localStorage.setItem('arcadeFootball_token', authToken);

                State.coins = data.user.coins || 0;
                State.unlockedItems = data.user.unlockedItems || ['classic_ball', 'classic_jersey'];
                State.equippedBallSkin = data.user.equippedBallSkin || 'classic_ball';
                State.equippedJersey = data.user.equippedJersey || 'classic_jersey';
                updateCoinDisplay();

                authScreen.classList.add('hidden');
                startScreen.classList.remove('hidden');
            } else {
                errMsg.innerText = data.error || "Bir hata oluştu.";
            }
        } catch (e) {
            errMsg.innerText = "Sunucuya bağlanılamadı.";
        }
    }

    if (authToken) {
        // We will apply the trail after loadMetagameData fetches it
    }

    if (loginBtn) loginBtn.addEventListener('click', () => handleAuth(true));
    if (registerBtn) registerBtn.addEventListener('click', () => handleAuth(false));

    if (playOfflineBtn) playOfflineBtn.addEventListener('click', () => {
        authScreen.classList.add('hidden');
        startScreen.classList.remove('hidden');
        State.coins = 0;
        State.unlockedItems = ['classic_ball', 'classic_jersey'];
        State.equippedBallSkin = 'classic_ball';
        State.equippedJersey = 'classic_jersey';
        updateCoinDisplay();
    });
}

async function loadMetagameData() {
    if (!authToken) return;

    try {
        const res = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            State.coins = data.coins || 0;
            State.unlockedItems = data.unlockedItems || ['classic_ball', 'classic_jersey'];
            State.equippedBallSkin = data.equippedBallSkin || 'classic_ball';
            State.equippedJersey = data.equippedJersey || 'classic_jersey';
            updateCoinDisplay();
        } else {
            // Token expired or invalid
            localStorage.removeItem('arcadeFootball_token');
            authToken = null;
        }
    } catch (e) {
        console.error('Failed to load metagame data', e);
    }
}

async function saveMetagameData() {
    if (!authToken) return; // Offline mode, don't save

    try {
        await fetch('/api/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                coins: State.coins,
                unlockedItems: State.unlockedItems,
                equippedBallSkin: State.equippedBallSkin,
                equippedJersey: State.equippedJersey
            })
        });
    } catch (e) {
        console.error('Failed to save metagame data', e);
    }
}

function updateCoinDisplay() {
    const coinEls = [document.getElementById('coinBalanceDisplay'), document.getElementById('shopCoinDisplay')];
    coinEls.forEach(el => { if (el) el.innerText = State.coins; });
}

function initShopUI() {
    const shopScreen = document.getElementById('shopScreen');
    const openShopBtn = document.getElementById('openShopBtn');
    const closeShopBtn = document.getElementById('closeShopBtn');
    const container = document.getElementById('shopItemsContainer');

    if (openShopBtn) openShopBtn.addEventListener('click', () => {
        renderShop('ball');
        shopScreen.classList.remove('hidden');
    });
    if (closeShopBtn) closeShopBtn.addEventListener('click', () => shopScreen.classList.add('hidden'));

    const BALL_SKINS = [
        { id: 'classic_ball', name: 'Klasik ⚽', color: '#cccccc', price: 0 },
        { id: 'neon_ball', name: 'Neon 💚', color: '#2ecc71', price: 100 },
        { id: 'fire_ball', name: 'Alev Ateşi 🔥', color: '#e67e22', price: 250 },
        { id: 'electric_ball', name: 'Elektrik ⚡', color: '#00d2d3', price: 250 },
        { id: 'gold_ball', name: 'Saf Altın 👑', color: '#f1c40f', price: 500 },
        { id: 'dark_ball', name: 'Karanlık 🌑', color: '#8e44ad', price: 1000 },
    ];

    const JERSEY_SKINS = [
        { id: 'classic_jersey', name: 'Klasik Kırmızı', color: '#e74c3c', price: 0 },
        { id: 'galaxy', name: 'Galaksi 🌌', color: '#9b59b6', price: 100 },
        { id: 'emerald', name: 'Zümrüt 💚', color: '#27ae60', price: 250 },
        { id: 'electric', name: 'Elektrik ⚡', color: '#0abde3', price: 250 },
        { id: 'sunset', name: 'Gün Batımı 🌅', color: '#f39c12', price: 500 },
        { id: 'gold_king', name: 'Altın Kral 👑', color: '#f1c40f', price: 1000 },
        { id: 'dark_knight', name: 'Karanlık Şövalye 🖤', color: '#5d6d7e', price: 1000 },
    ];

    let activeTab = 'ball';

    function renderShop(tab) {
        activeTab = tab;
        if (!container) return;
        container.innerHTML = '';

        const tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex;gap:10px;margin-bottom:18px;justify-content:center;';
        ['ball', 'jersey'].forEach(t => {
            const tb = document.createElement('button');
            tb.innerText = t === 'ball' ? '⚽ Top Skinleri' : '👕 Forma Skinleri';
            tb.style.cssText = `padding:8px 18px;border-radius:8px;border:none;font-weight:bold;font-size:0.9rem;cursor:pointer;background:${t === tab ? '#e67e22' : '#2c3e50'};color:white;transition:background 0.2s;`;
            tb.addEventListener('click', () => renderShop(t));
            tabBar.appendChild(tb);
        });
        container.appendChild(tabBar);

        const grid = document.createElement('div');
        grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;';
        const items = tab === 'ball' ? BALL_SKINS : JERSEY_SKINS;
        const equippedKey = tab === 'ball' ? 'equippedBallSkin' : 'equippedJersey';

        items.forEach(item => {
            const unlockedItems = State.unlockedItems || ['classic_ball', 'classic_jersey'];
            const isUnlocked = unlockedItems.includes(item.id) || item.price === 0;
            const isEquipped = State[equippedKey] === item.id;

            const card = document.createElement('div');
            card.style.cssText = `background:#2c3e50;padding:15px;border-radius:12px;width:115px;text-align:center;border:3px solid ${isEquipped ? item.color : 'transparent'};box-shadow:${isEquipped ? `0 0 14px ${item.color}` : 'none'};transition:all 0.2s;`;

            let btnText = 'SATIN AL', btnBg = '#e67e22', btnAction = 'buy';
            if (isEquipped) { btnText = 'KUŞANILDI'; btnBg = '#27ae60'; btnAction = 'none'; }
            else if (isUnlocked) { btnText = 'KUŞAN'; btnBg = '#2980b9'; btnAction = 'equip'; }
            else if (State.coins < item.price) { btnText = 'YETERSİZ'; btnBg = '#7f8c8d'; btnAction = 'none'; }

            const previewIcon = tab === 'ball'
                ? `<div style="width:40px;height:40px;border-radius:50%;background:${item.color};margin:0 auto 8px;box-shadow:0 0 14px ${item.color};"></div>`
                : `<div style="width:40px;height:40px;border-radius:6px;background:${item.color};margin:0 auto 8px;box-shadow:0 0 10px ${item.color};display:flex;align-items:center;justify-content:center;font-size:18px;">👕</div>`;

            card.innerHTML = `
                <div style="font-weight:bold;color:white;margin-bottom:8px;font-size:0.8rem;">${item.name}</div>
                ${previewIcon}
                <div style="color:#f1c40f;font-weight:bold;margin-bottom:8px;font-size:0.85rem;">${isUnlocked ? 'SAHİP ✓' : '🪙 ' + item.price}</div>
                <button class="shop-item-btn" data-action="${btnAction}" data-id="${item.id}" data-price="${item.price}" data-type="${tab}"
                    style="background:${btnBg};width:100%;padding:5px;font-size:0.75rem;border-radius:6px;border:none;font-weight:bold;color:white;cursor:pointer;">${btnText}</button>
            `;
            grid.appendChild(card);
        });
        container.appendChild(grid);

        container.querySelectorAll('.shop-item-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const action = e.target.getAttribute('data-action');
                const id = e.target.getAttribute('data-id');
                const price = parseInt(e.target.getAttribute('data-price'));
                const type = e.target.getAttribute('data-type');
                const equipped = type === 'ball' ? 'equippedBallSkin' : 'equippedJersey';

                if (!State.unlockedItems) State.unlockedItems = ['classic_ball', 'classic_jersey'];

                if (action === 'buy') {
                    if (State.coins >= price) {
                        State.coins -= price;
                        State.unlockedItems.push(id);
                        State[equipped] = id;
                        saveMetagameData();
                        updateCoinDisplay();
                        renderShop(activeTab);
                    }
                } else if (action === 'equip') {
                    State[equipped] = id;
                    saveMetagameData();
                    renderShop(activeTab);
                }
            });
        });
    }
}

// ============================================================
// LOBİLER - Lobby Browser System
// ============================================================
async function initLobbyBrowser() {
    const screen = document.getElementById('lobbiesScreen');
    const modal = document.getElementById('lobbyCreateModal');
    const listEl = document.getElementById('lobbyListContainer');
    const lobbiesBtn = document.getElementById('lobbiesBtn');
    const startScreen = document.getElementById('startScreen');
    const closeBrowserBtn = document.getElementById('closeLobbyBrowserBtn');
    const refreshBtn = document.getElementById('refreshLobbiesBtn');
    const createBtn = document.getElementById('createLobbyBtn');
    const createConfirmBtn = document.getElementById('lobbyCreateConfirmBtn');
    const createCancelBtn = document.getElementById('lobbyCreateCancelBtn');
    const nameInput = document.getElementById('lobbyNameInput');
    const errEl = document.getElementById('lobbyCreateError');

    let isPrivate = false; // default: public

    // Privacy toggle buttons
    document.querySelectorAll('.lobby-privacy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            isPrivate = btn.getAttribute('data-val') === 'private';
            document.querySelectorAll('.lobby-privacy-btn').forEach(b => {
                const isActive = b.getAttribute('data-val') === (isPrivate ? 'private' : 'public');
                b.style.background = isActive ? '#27ae60' : '#2c3e50';
                b.style.borderColor = isActive ? '#27ae60' : '#666';
            });
        });
    });

    // Open lobby browser
    if (lobbiesBtn) lobbiesBtn.addEventListener('click', async () => {
        startScreen.classList.add('hidden');
        screen.classList.remove('hidden');
        await loadLobbyList();
        // Auto-join if URL has ?lobby=ID
        const params = new URLSearchParams(window.location.search);
        const lobbyId = params.get('lobby');
        if (lobbyId) await joinLobbyById(lobbyId);
    });

    if (closeBrowserBtn) closeBrowserBtn.addEventListener('click', () => {
        screen.classList.add('hidden');
        startScreen.classList.remove('hidden');
    });

    if (refreshBtn) refreshBtn.addEventListener('click', loadLobbyList);

    // ---- Load & render public lobby list ----
    async function loadLobbyList() {
        listEl.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;">Yükleniyor...</div>';
        try {
            const res = await fetch('/api/lobbies');
            const lobbies = await res.json();
            if (!Array.isArray(lobbies) || lobbies.length === 0) {
                listEl.innerHTML = '<div style="color:#888;text-align:center;padding:40px;font-size:1.1rem;">Şu an aktif lobi yok. İlk sen aç! 🚀</div>';
                return;
            }
            listEl.innerHTML = '';
            lobbies.forEach(lobby => {
                const row = document.createElement('div');
                row.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:10px;padding:14px 20px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;border:1px solid rgba(255,255,255,0.1);';
                row.innerHTML = `
                    <div>
                        <div style="font-size:1.1rem;font-weight:bold;color:white;">${lobby.isPrivate ? '🔒' : '🌐'} ${lobby.name}</div>
                        <div style="font-size:0.8rem;color:#aaa;">ID: ${lobby.id}</div>
                    </div>
                    <button class="join-lobby-btn" data-id="${lobby.id}" style="background:#8e44ad;padding:8px 18px;border-radius:8px;border:none;color:white;font-weight:bold;cursor:pointer;">KATIL</button>
                `;
                listEl.appendChild(row);
            });
            listEl.querySelectorAll('.join-lobby-btn').forEach(btn => {
                btn.addEventListener('click', () => joinLobbyById(btn.getAttribute('data-id')));
            });
        } catch (e) {
            listEl.innerHTML = '<div style="color:#e74c3c;text-align:center;padding:40px;">Lobiler yüklenemedi.</div>';
        }
    }

    // ---- Join lobby by ID (fetch hostPeerId, then connect) ----
    async function joinLobbyById(id) {
        try {
            const res = await fetch(`/api/lobbies/${id}`);
            if (!res.ok) { alert('Lobi bulunamadı veya kapandı.'); return; }
            const lobby = await res.json();
            // Fill the peer join input and click join
            screen.classList.add('hidden');
            const onlineMenu = document.getElementById('onlineMenu');
            onlineMenu.classList.remove('hidden');
            startScreen.classList.add('hidden');
            const joinInput = document.getElementById('joinIdInput');
            if (joinInput) joinInput.value = lobby.hostPeerId;
            // Auto click the join button
            const joinBtn = document.getElementById('joinBtn');
            if (joinBtn) joinBtn.click();
        } catch (e) {
            alert('Lobiye katılınamadı.');
        }
    }

    // ---- Open create modal ----
    if (createBtn) createBtn.addEventListener('click', () => {
        nameInput.value = '';
        errEl.innerText = '';
        modal.classList.remove('hidden');
    });

    if (createCancelBtn) createCancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // ---- Create lobby ----
    if (createConfirmBtn) createConfirmBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) { errEl.innerText = 'Lütfen bir lobi adı girin.'; return; }
        if (!authToken) { errEl.innerText = 'Lobi açmak için giriş yapmanız gerekiyor.'; return; }

        // First we need a PeerID. Open the online menu and get a peer, register once we have it.
        errEl.innerText = 'Oda oluşturuluyor...';
        modal.classList.add('hidden');
        screen.classList.add('hidden');
        startScreen.classList.add('hidden');

        // Open the regular online menu (triggers peer creation)
        const onlineMenu = document.getElementById('onlineMenu');
        onlineMenu.classList.remove('hidden');

        // Click host button to generate a peer
        const hostBtn = document.getElementById('hostBtn');
        if (hostBtn) hostBtn.click();

        // Wait for peerId to be available then register lobby
        let tries = 0;
        const waitForPeer = setInterval(async () => {
            tries++;
            const peerIdEl = document.getElementById('myPeerId');
            const peerId = peerIdEl && peerIdEl.innerText && peerIdEl.innerText !== '...' ? peerIdEl.innerText : null;
            if (peerId || tries > 30) {
                clearInterval(waitForPeer);
                if (!peerId) return;
                try {
                    const reg = await fetch('/api/lobbies/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                        body: JSON.stringify({ name, isPrivate, hostPeerId: peerId })
                    });
                    const data = await reg.json();
                    if (data.id) {
                        // Update room name display
                        const roomName = document.getElementById('lobbyRoomName');
                        if (roomName) roomName.innerText = `${isPrivate ? '🔒' : '🌐'} ${name}`;
                        // For private: show the link
                        if (isPrivate) {
                            const link = `${window.location.origin}/?lobby=${data.id}`;
                            alert(`Gizli lobiniz oluşturuldu!\n\nDavet linki:\n${link}\n\nBu linki arkadaşınızla paylaşın.`);
                        }
                    }
                } catch (ex) { console.error('Lobby register error', ex); }
            }
        }, 500);
    });
}

// Check if URL has lobby= param on load
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lobby')) {
        // Lobby join will be handled after auth in initLobbyBrowser
    }
});