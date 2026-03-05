// js/entities.js
import { Config, State } from './config.js';
import { keys } from './input.js';
import { SoundManager } from './audio.js';
import { createParticles } from './particles.js';
import { applyShake, drawPentagon, checkCircleCollision, checkGoalStructure } from './utils.js';

const redSprite = new Image();
redSprite.src = 'player_red.png';

export class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.mass = radius;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

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

export class SimpleAI {
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
        this.controls = { up: false, down: false, left: false, right: false, sprint: false, shoot: false };
        this.stuckTimer = this.stuckTimer || 0;
        this.shootCooldown = this.shootCooldown || 0;

        if (!ball || isNaN(ball.x) || isNaN(ball.y)) return;

        const px = player.x, py = player.y;
        const bx = ball.x, by = ball.y;
        const dx = bx - px, dy = by - py;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Stuck detection: barely moving, ball barely moving, player on top of ball
        if (dist < player.radius + ball.radius + 20 && Math.abs(ball.vx) < 2 && Math.abs(ball.vy) < 2) {
            this.stuckTimer++;
        } else {
            this.stuckTimer = 0;
        }

        // Safe movement bounds respecting the field margin walls
        const minX = Config.FIELD_MARGIN + player.radius + 5;
        const maxX = Config.CANVAS_WIDTH - Config.FIELD_MARGIN - player.radius - 5;
        const minY = player.radius + 10;
        const maxY = Config.CANVAS_HEIGHT - player.radius - 10;

        let targetX, targetY;

        if (this.stuckTimer > 30) {
            // Escape mode: retreat to center and kick
            targetX = Config.CANVAS_WIDTH / 2;
            targetY = Config.CANVAS_HEIGHT / 2;
            this.controls.sprint = true;
            this.controls.shoot = true;
            if (this.stuckTimer > 60) this.stuckTimer = 0;
        } else {
            // APPROACH FROM BEHIND: stand to the right of ball to push it left (toward left goal = opponent goal)
            const behindOffset = 55;

            const nearRightWall = bx > Config.CANVAS_WIDTH - Config.FIELD_MARGIN - 90;
            const nearTopWall = by < 80;
            const nearBotWall = by > Config.CANVAS_HEIGHT - 80;

            if (nearTopWall || nearBotWall) {
                // Ball stuck near top/bottom — approach through center Y
                targetX = bx + behindOffset;
                targetY = Config.CANVAS_HEIGHT / 2;
                this.controls.sprint = true;
            } else if (nearRightWall) {
                // Ball near right wall — arc around from center Y
                targetX = maxX;
                targetY = Config.CANVAS_HEIGHT / 2;
                this.controls.sprint = true;
            } else {
                // Normal chase: stay slightly behind ball
                targetX = dist > 60 ? bx + behindOffset : bx;
                targetY = by;
            }
        }

        // Clamp to safe zone
        targetX = Math.max(minX, Math.min(maxX, targetX));
        targetY = Math.max(minY, Math.min(maxY, targetY));

        // Move toward target
        if (px < targetX - 5) this.controls.right = true;
        if (px > targetX + 5) this.controls.left = true;
        if (py < targetY - 5) this.controls.down = true;
        if (py > targetY + 5) this.controls.up = true;

        // Sprint when far away
        if (dist > 160) this.controls.sprint = true;

        // Shooting: only when positioned behind (right of) ball so kick goes left
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        } else if (dist < player.radius + ball.radius + 40) {
            if (px > bx - 20) {
                this.controls.shoot = true;
                if (this.timer % 20 === 0) {
                    this.controls.shoot = false;
                    this.shootCooldown = 70;
                }
            }
        }
    }
}

export const aiController = new SimpleAI();

export class Player extends Entity {
    constructor(x, y, color, controls) {
        super(x, y, Config.PLAYER_RADIUS, color);
        this.controls = controls;
        this.stamina = 100;
        this.isSprinting = false;

        this.charge = 0;
        this.isCharging = false;
        this.shootKeyReleased = true;

        this.activePowerUp = null;
        this.powerUpTimer = 0;
        this.frozen = false;
        this.freezeTimer = 0;
        this.superShot = false;
        this.confused = false;
        this.confusedTimer = 0;

        this.facingRight = (this.color !== '#3498db');
        this.animTimer = 0;
        this.kickTimer = 0;
        this.kickCooldown = 0;

        // Celebration
        this.celebrating = false;
        this.celebrationTimer = 0;
    }

    applyPowerUp(type) {
        const opponent = (this === player1) ? player2 : player1;

        if (type === 'speed') {
            this.activePowerUp = 'speed';
            this.powerUpTimer = 300;
        } else if (type === 'shot') {
            this.superShot = true;
        } else if (type === 'freeze') {
            opponent.frozen = true;
            opponent.freezeTimer = 120;
        } else if (type === 'tiny_ball') {
            ball.radius = 8;
            setTimeout(() => { ball.radius = (ball.type === 'pingpong' ? 10 : 18); }, 10000);
        } else if (type === 'big_goals') {
            const oldHeight = State.GOAL_HEIGHT;
            State.GOAL_HEIGHT = 350;
            setTimeout(() => { State.GOAL_HEIGHT = oldHeight; }, 10000);
        } else if (type === 'confusion') {
            opponent.confused = true;
            opponent.confusedTimer = 300;
        }
    }


    update(inputCmd) {
        if (State.isGoalCelebration && !this.celebrating) return;

        if (this.frozen) {
            this.freezeTimer--;
            if (this.freezeTimer <= 0) this.frozen = false;
            return;
        }

        if (this.celebrating) {
            this.celebrationTimer--;
            if (this.celebrationTimer <= 0) this.celebrating = false;
            // Mock celebration movement (jumping)
            this.vy = -Math.abs(Math.sin(this.celebrationTimer * 0.2) * 5);
            return;
        }

        let ax = 0;
        let ay = 0;
        let isMoving = false;

        let up, down, left, right, sprintKey, shootKey, slideKey;

        // If no explicit input is provided, fallback to the old logic (e.g. for offline or AI)
        if (!inputCmd) {
            if (this.controls === 'wasd') {
                up = keys['KeyW']; down = keys['KeyS']; left = keys['KeyA']; right = keys['KeyD']; sprintKey = keys['ShiftLeft']; shootKey = keys['Space'];
            } else if (this.controls === 'arrows') {
                up = keys['ArrowUp']; down = keys['ArrowDown']; left = keys['ArrowLeft']; right = keys['ArrowRight']; sprintKey = keys['ControlRight'] || keys['ControlLeft']; shootKey = keys['Enter'];
            } else if (this.controls === 'ai') {
                const aiInput = aiController.update(this, ball);
                up = aiInput.up; down = aiInput.down; left = aiInput.left; right = aiInput.right; sprintKey = aiInput.sprint; shootKey = aiInput.shoot;
            }
        } else {
            up = inputCmd.up;
            down = inputCmd.down;
            left = inputCmd.left;
            right = inputCmd.right;
            sprintKey = inputCmd.sprint;
            shootKey = inputCmd.shoot;
        }

        if (up) ay = -1;
        if (down) ay = 1;
        if (left) ax = -1;
        if (right) ax = 1;

        if (ax !== 0 || ay !== 0) isMoving = true;

        if (ax > 0) this.facingRight = true;
        if (ax < 0) this.facingRight = false;

        if (isMoving) {
            this.animTimer += 0.2 + (this.isSprinting ? 0.1 : 0);
        } else {
            this.animTimer = 0;
        }

        if (this.kickTimer > 0) this.kickTimer--;
        if (this.kickCooldown > 0) this.kickCooldown--;

        this.isSprinting = false;
        let currentMaxSpeed = State.PLAYER_SPEED;
        let movementFriction = 0.96; // Even higher friction for weight
        let movementAcceleration = 0.28; // Lower acceleration for heavier feel

        if (State.weatherCondition === 'snowy') {
            currentMaxSpeed *= 0.6;
            movementFriction = 0.92;
            movementAcceleration = 0.25;
        } else if (State.weatherCondition === 'icy') {
            movementFriction = 0.992; // Very slippery
            movementAcceleration = 0.04;
        }

        if (this.confused) {
            this.confusedTimer--;
            if (this.confusedTimer <= 0) this.confused = false;
            ax = -ax;
            ay = -ay;
        }

        if (this.activePowerUp === 'speed') {
            currentMaxSpeed *= 1.4;
            movementAcceleration *= 1.2;
            this.powerUpTimer--;
            createParticles(this.x, this.y + 10, '#f1c40f', 1);
            if (this.powerUpTimer <= 0) this.activePowerUp = null;
        }

        if (sprintKey && this.stamina > 0) {
            this.isSprinting = true;
            currentMaxSpeed = State.PLAYER_SPEED * 1.05; // Slightly faster sprint
            movementAcceleration *= 1.2;
            if (this.activePowerUp === 'speed') currentMaxSpeed *= 1.15;
            this.stamina -= 1.2;
        } else if (this.stamina < 100) {
            this.stamina += 0.2;
        }

        if (isMoving) {
            const length = Math.sqrt(ax * ax + ay * ay);
            ax /= length;
            ay /= length;

            // Turn Radius Logic: If current velocity is in a different direction than input,
            // the acceleration is reduced to simulate 'fighting' momentum.
            const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (currentSpeed > 0.5) {
                const dot = (this.vx / currentSpeed) * ax + (this.vy / currentSpeed) * ay;
                // If dot < 0.2 (turning more than 75 degrees), turn is harder
                if (dot < 0.6) {
                    movementAcceleration *= (0.2 + (dot + 1) * 0.25); // Harder turning penalty
                }
            }

            this.vx += ax * movementAcceleration;
            this.vy += ay * movementAcceleration;

            if (Math.random() < 0.15 && (this.isSprinting || currentSpeed > State.PLAYER_SPEED * 0.8)) {
                createParticles(this.x, this.y + this.radius, '#bdc3c7', 1);
            }
        } else {
            // Apply extra friction when not moving to stop faster (braking feel)
            movementFriction *= 0.95;
        }

        this.vx *= movementFriction;
        this.vy *= movementFriction;

        const totalSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (totalSpeed > currentMaxSpeed) {
            const ratio = currentMaxSpeed / totalSpeed;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        if (Math.abs(this.vx) < 0.01) this.vx = 0;
        if (Math.abs(this.vy) < 0.01) this.vy = 0;

        this.x += this.vx;
        this.y += this.vy;

        if (State.hotPotatoMode) {
            const mid = Config.CANVAS_WIDTH / 2;
            if (this === player1 && this.x + this.radius > mid) {
                this.x = mid - this.radius;
                this.vx = 0;
            } else if (this === player2 && this.x - this.radius < mid) {
                this.x = mid + this.radius;
                this.vx = 0;
            }
        }

        this.checkWallCollision();

        if (shootKey) {
            if (this.shootKeyReleased) {
                this.isCharging = true;
                this.charge += 2;
                if (this.charge > Config.CHARGE_MAX) this.charge = Config.CHARGE_MAX;
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

        if (dist < this.radius + ball.radius + 20) {
            const angle = Math.atan2(dy, dx);
            let power = (this.charge / 100) * 8.5; // Base power significantly reduced
            if (this.superShot) {
                power = 12.5; // Super shot power massively nerfed
                this.superShot = false;

                // Huge explosion of particles
                createParticles(ball.x, ball.y, '#e74c3c', 40);
                createParticles(ball.x, ball.y, '#f1c40f', 20);

                SoundManager.playKick();

                // Massive screen shake
                applyShake(25, 20);
            }
            if (power < 4) power = 4;

            ball.vx += Math.cos(angle) * power;
            ball.vy += Math.sin(angle) * power;

            this.kickTimer = 15;

            createParticles(ball.x, ball.y, '#ffffff', 8);
            SoundManager.playKick();
        }
    }

    checkWallCollision() {
        const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
        const goalBottom = (Config.CANVAS_HEIGHT + State.GOAL_HEIGHT) / 2;
        const goalDepth = 60;

        // Left boundary
        if (this.x - this.radius < Config.FIELD_MARGIN) {
            if (this.y > goalTop + this.radius && this.y < goalBottom - this.radius) {
                // Entering the goal mouth, stop at back of net
                if (this.x - this.radius < Config.FIELD_MARGIN - goalDepth) {
                    this.x = Config.FIELD_MARGIN - goalDepth + this.radius;
                    this.vx = 0;
                }
            } else {
                // Regular field boundary
                this.x = Config.FIELD_MARGIN + this.radius;
                this.vx = 0;
            }
        }

        // Right boundary
        if (this.x + this.radius > Config.CANVAS_WIDTH - Config.FIELD_MARGIN) {
            if (this.y > goalTop + this.radius && this.y < goalBottom - this.radius) {
                // Entering the goal mouth
                if (this.x + this.radius > Config.CANVAS_WIDTH - Config.FIELD_MARGIN + goalDepth) {
                    this.x = Config.CANVAS_WIDTH - Config.FIELD_MARGIN + goalDepth - this.radius;
                    this.vx = 0;
                }
            } else {
                this.x = Config.CANVAS_WIDTH - Config.FIELD_MARGIN - this.radius;
                this.vx = 0;
            }
        }

        if (this.y - this.radius < 0) { this.y = this.radius; this.vy = 0; }
        if (this.y + this.radius > Config.CANVAS_HEIGHT) { this.y = Config.CANVAS_HEIGHT - this.radius; this.vy = 0; }
    }

    draw(ctx) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const isMoving = speed > 0.5;
        const sprintMult = this.isSprinting ? 1.5 : 1.0;
        const bobbing = isMoving ? Math.abs(Math.sin(this.animTimer * 1.2)) * 2 : 0;

        const isBlue = (this.color === '#3498db');
        const jerseyColor = isBlue ? '#1a6fc4' : '#c0392b';
        const jerseyHighlight = isBlue ? '#3498db' : '#e74c3c';
        const skinColor = '#f5c5a3';
        const hairColor = isBlue ? '#2c2c54' : '#2c2c2c';
        const shoeColor = '#1a1a1a';
        const sockColor = isBlue ? '#2980b9' : '#922b21';
        const shortColor = isBlue ? '#154360' : '#641e16';
        const numStr = isBlue ? '10' : '7';

        // ---- Layered soft shadow underneath ----
        ctx.save();
        const shadowGrad = ctx.createRadialGradient(
            this.x, this.y + 14, 2,
            this.x, this.y + 14, this.radius * 1.2
        );
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 14, this.radius * 0.95, this.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ---- Status rings ----
        if (this.frozen) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 7, 0, Math.PI * 2);
            const iceGrad = ctx.createLinearGradient(this.x - 20, this.y - 20, this.x + 20, this.y + 20);
            iceGrad.addColorStop(0, 'rgba(130,200,255,0.7)');
            iceGrad.addColorStop(1, 'rgba(52,152,219,0.4)');
            ctx.fillStyle = iceGrad;
            ctx.fill();
            ctx.restore();
        }
        if (this.superShot) {
            ctx.save();
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();
        }
        if (this.confused) {
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('😵', this.x, this.y - this.radius - 14);
        }

        // ---- Main body (translated + rotated) ----
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!this.facingRight) ctx.scale(-1, 1);

        // Slide rotation
        if (this.sliding) {
            ctx.rotate(Math.PI / 3 * (this.facingRight ? 1 : -1));
            // Add some sliding dust/particles behind
            if (this.slideTimer % 2 === 0) {
                createParticles(0, this.radius, 'rgba(255,255,255,0.3)', 2);
            }
        }

        // lean
        let localVx = this.facingRight ? this.vx : -this.vx;
        let targetLean = 0;
        if (this.sliding) targetLean = 0; // Handled by slide rotation
        else if (isMoving && this.isSprinting) targetLean = 0.16;
        else if (isMoving) targetLean = Math.min(0.1, (localVx / State.PLAYER_SPEED) * 0.08);

        if (!this.currentLeanAngle) this.currentLeanAngle = 0;
        this.currentLeanAngle += (targetLean - this.currentLeanAngle) * 0.18;
        ctx.rotate(this.currentLeanAngle);

        const bobY = -bobbing;
        const hipY = this.radius * 0.4 + bobY;

        // ---- Draw back leg ----
        const drawLeg = (hipX, isBackLeg, phaseOffset, isKicking) => {
            if (this.sliding && isBackLeg) return; // Hide back leg during slide for better silhouette

            const scale = isBackLeg ? 0.44 : 0.56;
            ctx.save();
            ctx.translate(hipX, hipY);

            let angle = 0, kneeBend = 0;
            if (this.sliding) {
                angle = 1.2;
                kneeBend = 0.5;
            } else if (isKicking && this.kickTimer > 0) {
                const kp = 15 - this.kickTimer;
                if (kp < 5) { angle = -0.5 * (kp / 5); kneeBend = 1.0; }
                else { const fp = (kp - 5) / 10; angle = -0.5 + 1.2 * fp; kneeBend = 1 - fp; }
            } else if (isMoving) {
                const cycle = this.animTimer * 0.6 + phaseOffset;
                angle = Math.sin(cycle) * 0.6 * sprintMult;
                kneeBend = Math.max(0, -Math.sin(cycle)) * 0.7 * sprintMult;
            }
            ctx.scale(scale, scale);
            ctx.rotate(angle);

            // Thigh (jersey color shorts portion)
            const thighGrad = ctx.createLinearGradient(-5, 0, 5, 0);
            thighGrad.addColorStop(0, shortColor);
            thighGrad.addColorStop(1, jerseyColor);
            ctx.fillStyle = thighGrad;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-5, -2, 10, 14, 4);
            else ctx.rect(-5, -2, 10, 14);
            ctx.fill();

            ctx.translate(0, 11);
            ctx.rotate(kneeBend);

            // Calf
            ctx.fillStyle = skinColor;
            ctx.fillRect(-3.5, 0, 7, 8);
            // Sock
            const sockGrad = ctx.createLinearGradient(-3, 0, 3, 0);
            sockGrad.addColorStop(0, sockColor);
            sockGrad.addColorStop(0.5, jerseyHighlight);
            sockGrad.addColorStop(1, sockColor);
            ctx.fillStyle = sockGrad;
            ctx.fillRect(-4, 6, 8, 10);

            ctx.translate(0, 15);

            // Shoe (with cleats)
            const shoeGrad = ctx.createLinearGradient(-5, 0, 9, 0);
            shoeGrad.addColorStop(0, '#333');
            shoeGrad.addColorStop(0.6, '#444');
            shoeGrad.addColorStop(1, '#111');
            ctx.fillStyle = shoeGrad;
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(9, 0);
            ctx.quadraticCurveTo(11, 2, 9, 6);
            ctx.lineTo(-5, 6);
            ctx.quadraticCurveTo(-7, 3, -5, 0);
            ctx.fill();
            // Shoe lace highlight
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(0, 0, 4, 2);
            // Cleats
            ctx.fillStyle = '#999';
            [-3, 1, 5].forEach(cx => {
                ctx.fillRect(cx, 6, 2, 2);
            });

            ctx.restore();
        };

        const leftHipX = -this.radius * 0.22;
        const rightHipX = this.radius * 0.22;

        drawLeg(leftHipX, true, Math.PI, false);

        // ---- Jersey / body ----
        ctx.save();
        const jerseyW = this.radius * 1.05;
        const jerseyH = this.radius * 1.1;
        const jerseyTop = -this.radius * 0.7 + bobY;

        // Jersey gradient (left dark, center highlight, right medium)
        const jGrad = ctx.createLinearGradient(-jerseyW, jerseyTop, jerseyW, jerseyTop);
        jGrad.addColorStop(0, jerseyColor);
        jGrad.addColorStop(0.4, jerseyHighlight);
        jGrad.addColorStop(1, jerseyColor);
        ctx.fillStyle = jGrad;
        ctx.beginPath();
        // Trapezoid shape (wider shoulders, narrower waist)
        ctx.moveTo(-jerseyW, jerseyTop + jerseyH * 0.15);
        ctx.lineTo(-jerseyW * 0.9, jerseyTop);
        ctx.lineTo(jerseyW * 0.9, jerseyTop);
        ctx.lineTo(jerseyW, jerseyTop + jerseyH * 0.15);
        ctx.lineTo(jerseyW * 0.7, jerseyTop + jerseyH);
        ctx.lineTo(-jerseyW * 0.7, jerseyTop + jerseyH);
        ctx.closePath();
        ctx.fill();
        // Jersey collar
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, jerseyTop + 2, jerseyW * 0.3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Jersey number
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `bold ${this.radius * 0.55}px 'Fredoka One', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(numStr, 0, jerseyTop + jerseyH * 0.55);
        ctx.restore();

        // ---- Shorts ----
        ctx.save();
        const shortGrad = ctx.createLinearGradient(-12, 0, 12, 0);
        shortGrad.addColorStop(0, shortColor);
        shortGrad.addColorStop(0.5, isBlue ? '#1a5276' : '#7b241c');
        shortGrad.addColorStop(1, shortColor);
        ctx.fillStyle = shortGrad;
        const shortTop = hipY - 4;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(-11, shortTop, 22, 12, 3) : ctx.rect(-11, shortTop, 22, 12);
        ctx.fill();
        // White stripe detail on shorts
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(-11, shortTop, 4, 12);
        ctx.fillRect(7, shortTop, 4, 12);
        ctx.restore();

        // ---- Head ----
        ctx.save();
        const headY = -this.radius * 0.95 + bobY;
        const headR = this.radius * 0.55;
        // Neck
        ctx.fillStyle = skinColor;
        ctx.fillRect(-4, headY + headR * 0.8, 8, 10);

        // Head (skin oval)
        const headGrad = ctx.createRadialGradient(-headR * 0.3, headY - headR * 0.2, 2, 0, headY, headR);
        headGrad.addColorStop(0, '#ffd5b0');
        headGrad.addColorStop(0.7, skinColor);
        headGrad.addColorStop(1, '#d4956a');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.ellipse(0, headY, headR, headR * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();

        // Arms (Celebration / Stun)
        if (this.celebrating) {
            ctx.strokeStyle = skinColor;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            // Arms up!
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.6, headY + 5);
            ctx.lineTo(-this.radius * 1.2, headY - 15);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.radius * 0.6, headY + 5);
            ctx.lineTo(this.radius * 1.2, headY - 15);
            ctx.stroke();
            if (this.celebrationTimer % 10 === 0) {
                createParticles(0, headY - 20, '#f1c40f', 3);
            }
        }

        // Stun indicator
        if (this.stunned) {
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💫', 0, headY - headR - 10);
        }

        // Ear
        ctx.fillStyle = '#e8a87c';
        ctx.beginPath();
        ctx.ellipse(headR * 0.85, headY + headR * 0.1, 4, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        const hairColor2 = isBlue ? '#1a1a4e' : '#1a1a1a';
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        ctx.ellipse(0, headY - headR * 0.4, headR * 0.95, headR * 0.65, 0, Math.PI, 0);
        ctx.fill();
        // Hair highlight
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(-headR * 0.2, headY - headR * 0.55, headR * 0.3, headR * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        const eyeY = headY - headR * 0.05;
        const eyeSize = 3.5;
        // White of eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(headR * 0.25, eyeY, eyeSize, eyeSize * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(headR * 0.28, eyeY, 2, 0, Math.PI * 2);
        ctx.fill();
        // Eye shine
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(headR * 0.31, eyeY - 0.8, 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Back leg already drawn, now draw front leg (over body)
        drawLeg(rightHipX, false, 0, this.kickTimer > 0);

        // Kick sparks
        if (this.kickTimer > 12) {
            ctx.save();
            const sparkDir = this.facingRight ? 1 : -1;
            for (let i = 0; i < 5; i++) {
                const sa = (i / 5) * Math.PI - Math.PI * 0.25;
                const sr = 12 + Math.random() * 10;
                const sx = Math.cos(sa) * sr * sparkDir;
                const sy = this.radius * 0.5 + Math.sin(sa) * sr;
                ctx.strokeStyle = `rgba(255, ${150 + i * 20}, 0, ${0.9 - i * 0.1})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(sx * 0.5, sy * 0.5);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.restore(); // end translate/rotate

        // ---- Stamina bar ----
        if (this.stamina < 100) {
            const bx = this.x - 22, by = this.y + 24;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(bx, by, 44, 5, 3) : ctx.fillRect(bx, by, 44, 5);
            ctx.fill();
            const stGrad = ctx.createLinearGradient(bx, 0, bx + 44, 0);
            stGrad.addColorStop(0, '#f1c40f');
            stGrad.addColorStop(1, '#e67e22');
            ctx.fillStyle = stGrad;
            const w = 44 * (this.stamina / 100);
            if (ctx.roundRect) {
                ctx.beginPath(); ctx.roundRect(bx, by, w, 5, 3); ctx.fill();
            } else {
                ctx.fillRect(bx, by, w, 5);
            }
        }

        // ---- Charge bar ----
        if (this.isCharging) {
            const bx = this.x - 22, by = this.y - 40;
            // Background
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bx - 1, by - 1, 46, 10, 4); else ctx.rect(bx, by, 44, 8);
            ctx.fill();
            // Fill
            const pct = this.charge / 100;
            const r = Math.floor(255 * pct);
            const g = Math.floor(255 * (1 - pct));
            ctx.save();
            ctx.shadowColor = `rgb(${r},${g},0)`;
            ctx.shadowBlur = 8;
            ctx.fillStyle = `rgb(${r},${g},0)`;
            if (ctx.roundRect) {
                ctx.beginPath(); ctx.roundRect(bx, by, 44 * pct, 8, 3); ctx.fill();
            } else {
                ctx.fillRect(bx, by, 44 * pct, 8);
            }
            ctx.restore();
            // Border
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(bx, by, 44, 8, 3); else ctx.strokeRect(bx, by, 44, 8);
            ctx.stroke();
        }
    }
}

export class Ball extends Entity {
    constructor(x, y) {
        super(x, y, Config.BALL_RADIUS, '#ffffff');
        this.angle = 0;
        this.friction = 0.96;
        this.elasticity = 0.95;
        this.maxSpeed = 15;
        this.type = 'normal';
        this.trail = [];
    }

    setType(type) {
        this.type = type;
        if (type === 'bowling') {
            this.friction = 0.96;
            this.elasticity = 0.6;
            this.maxSpeed = 18;
            this.color = '#2c3e50';
            this.radius = Config.BALL_RADIUS;
        } else if (type === 'beach') {
            this.friction = 0.995;
            this.elasticity = 1.1;
            this.maxSpeed = 10;
            this.color = '#e17055';
            this.radius = Config.BALL_RADIUS;
        } else if (type === 'pingpong') {
            this.friction = 0.99;
            this.elasticity = 1.05;
            this.maxSpeed = 20;
            this.radius = 10;
            this.color = '#fab1a0';
        } else {
            this.friction = 0.985;
            this.elasticity = 0.95;
            this.maxSpeed = 13;
            this.color = '#ffffff';
            this.radius = Config.BALL_RADIUS;
        }
    }

    draw(ctx) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const bobbing = Math.min(speed * 0.5, 5);

        // ---- Dynamic shadow ----
        ctx.save();
        const shadowGrad = ctx.createRadialGradient(
            this.x, this.y + this.radius, 2,
            this.x, this.y + this.radius, this.radius * 1.4
        );
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius - bobbing + 4, this.radius * 1.1, this.radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ---- Motion blur trail ----
        // Get color based on equipped trail
        let trailColorStr = '#dde';
        if (typeof State !== 'undefined' && State.equippedTrail) {
            switch (State.equippedTrail) {
                case 'neon_green': trailColorStr = '#2ecc71'; break;
                case 'fire_orange': trailColorStr = '#e67e22'; break;
                case 'electric_blue': trailColorStr = '#00d2d3'; break;
                case 'gold': trailColorStr = '#f1c40f'; break;
                case 'dark_matter': trailColorStr = '#8e44ad'; break;
                default: trailColorStr = '#dde';
            }
        }

        if (speed > 2) {
            ctx.save();
            const trailLen = this.trail.length;
            const vAngle = Math.atan2(this.vy, this.vx);
            for (let i = 0; i < trailLen; i++) {
                const pt = this.trail[i];
                const ratio = i / trailLen;
                const alpha = 0.35 * ratio;
                const r = this.radius * (0.4 + ratio * 0.6);

                ctx.globalAlpha = alpha;
                // Draw stretched ellipse in direction of movement for motion-blur feel
                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate(vAngle);
                const stretch = 1 + speed * 0.08;
                ctx.beginPath();
                ctx.ellipse(0, 0, r * stretch * 0.7, r * 0.7, 0, 0, Math.PI * 2);
                ctx.fillStyle = this.type === 'normal' ? trailColorStr : this.color;
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.type === 'normal') {
            // Base sphere using radial gradient for 3D look
            const sphereGrad = ctx.createRadialGradient(
                -this.radius * 0.3, -this.radius * 0.35, this.radius * 0.05,
                0, 0, this.radius
            );
            sphereGrad.addColorStop(0, '#ffffff');
            sphereGrad.addColorStop(0.4, '#f0f0f0');
            sphereGrad.addColorStop(0.85, '#cccccc');
            sphereGrad.addColorStop(1, '#999999');
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = sphereGrad;
            ctx.fill();

            // Pentagon stitches with subtle outline
            ctx.fillStyle = '#1a252f';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < 5; i++) {
                const theta = (i * 2 * Math.PI) / 5;
                const dist = this.radius * 0.48;
                const px = Math.cos(theta) * dist;
                const py = Math.sin(theta) * dist;
                ctx.save();
                ctx.translate(px, py);
                ctx.beginPath();
                for (let j = 0; j < 5; j++) {
                    const a = (j * 2 * Math.PI) / 5 - Math.PI / 2;
                    const pr = this.radius * 0.22;
                    j === 0 ? ctx.moveTo(Math.cos(a) * pr, Math.sin(a) * pr) : ctx.lineTo(Math.cos(a) * pr, Math.sin(a) * pr);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }
            // Center pentagon
            ctx.save();
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const a = (j * 2 * Math.PI) / 5 - Math.PI / 2;
                const pr = this.radius * 0.22;
                j === 0 ? ctx.moveTo(Math.cos(a) * pr, Math.sin(a) * pr) : ctx.lineTo(Math.cos(a) * pr, Math.sin(a) * pr);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Specular highlight
            const specGrad = ctx.createRadialGradient(
                -this.radius * 0.3, -this.radius * 0.35, 0,
                -this.radius * 0.3, -this.radius * 0.35, this.radius * 0.45
            );
            specGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
            specGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = specGrad;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Outer rim (subtle)
            ctx.strokeStyle = 'rgba(80,80,80,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.stroke();

        } else if (this.type === 'bowling') {
            const gradB = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 2, 0, 0, this.radius);
            gradB.addColorStop(0, '#444');
            gradB.addColorStop(0.5, '#222');
            gradB.addColorStop(1, '#000');
            ctx.fillStyle = gradB;
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0a0a0a';
            const ho = this.radius * 0.4;
            [[-5, -ho], [5, -ho], [0, ho * 0.5]].forEach(([hx, hy]) => {
                ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
            });
            // Specular
            const specB = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 0, 0, 0, this.radius * 0.5);
            specB.addColorStop(0, 'rgba(255,255,255,0.25)');
            specB.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = specB;
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'beach') {
            const beachColors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#ffffff', '#ff6b81'];
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.fillStyle = beachColors[i];
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, this.radius, (i * Math.PI / 3), ((i + 1) * Math.PI / 3));
                ctx.closePath(); ctx.fill();
            }
            // Outline
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
            // Center dot + specular
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill();
            const specBeach = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, 0, 0, 0, this.radius * 0.6);
            specBeach.addColorStop(0, 'rgba(255,255,255,0.4)'); specBeach.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = specBeach; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();

        } else if (this.type === 'pingpong') {
            const ppGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, this.radius);
            ppGrad.addColorStop(0, '#ffc9b5'); ppGrad.addColorStop(1, '#e07055');
            ctx.fillStyle = ppGrad; ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#e17055'; ctx.lineWidth = 0.5; ctx.stroke();
            ctx.fillStyle = '#d35400'; ctx.font = '6px Arial'; ctx.textAlign = 'center'; ctx.fillText('*** 3', 0, 2);
            const specPP = ctx.createRadialGradient(-2, -2, 0, 0, 0, this.radius * 0.5);
            specPP.addColorStop(0, 'rgba(255,255,255,0.5)'); specPP.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = specPP; ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }

    update(handleGoalCallback) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        if (speed > 1) {
            this.trail.push({ x: this.x, y: this.y, angle: this.angle });
            const maxTrail = this.type === 'pingpong' ? 15 : (speed > 15 ? 12 : 8); // Longer trail if fast
            if (this.trail.length > maxTrail) {
                this.trail.shift();
            }
        } else if (this.trail.length > 0) {
            this.trail.shift();
        }

        // --- STAT TRACKING (Shots & Saves) ---
        const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
        const goalBottom = (Config.CANVAS_HEIGHT + State.GOAL_HEIGHT) / 2;

        // Detect a "Shot" if the ball is moving fast towards a goal area and was last touched by someone.
        if (speed > 10 && State.lastTouchedBy) {
            // Check if it's heading towards Blue Goal (Right side)
            if (this.vx > 8 && this.x > Config.CANVAS_WIDTH / 2 && this.y > goalTop - 50 && this.y < goalBottom + 50) {
                if (!this.shotRegisteredFor || this.shotRegisteredFor !== State.lastTouchedBy) {
                    if (State.lastTouchedBy === 'red') {
                        State.matchStats.red.shots++;
                        this.shotRegisteredFor = 'red';
                        this.isShotOnGoal = true;
                    }
                }
            }
            // Check if it's heading towards Red Goal (Left side)
            else if (this.vx < -8 && this.x < Config.CANVAS_WIDTH / 2 && this.y > goalTop - 50 && this.y < goalBottom + 50) {
                if (!this.shotRegisteredFor || this.shotRegisteredFor !== State.lastTouchedBy) {
                    if (State.lastTouchedBy === 'blue') {
                        State.matchStats.blue.shots++;
                        this.shotRegisteredFor = 'blue';
                        this.isShotOnGoal = true;
                    }
                }
            }
        } else if (speed < 5) {
            // Reset shot status if ball slows down
            this.isShotOnGoal = false;
            this.shotRegisteredFor = null;
        }

        // Detect a "Save" in checkPlayerBallCollision (main.js) instead, since it requires player intersection.
        // We'll mark the ball with `isShotOnGoal` flag here so main.js knows a shot is active.

        this.x += this.vx;
        this.y += this.vy;

        this.angle += speed * 0.05;

        this.vx *= this.friction;
        this.vy *= this.friction;

        if (Math.abs(this.vx) < 0.05) this.vx = 0;
        if (Math.abs(this.vy) < 0.05) this.vy = 0;

        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > this.maxSpeed) {
            const ratio = this.maxSpeed / spd;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        this.checkWallCollision(handleGoalCallback);
    }

    checkWallCollision(handleGoalCallback) {
        const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
        const goalBottom = (Config.CANVAS_HEIGHT + State.GOAL_HEIGHT) / 2;

        if (this.y - this.radius < 0) {
            this.y = this.radius + 5;
            this.vy = Math.abs(this.vy) * this.elasticity;

            const minBounce = 6;
            if (this.vy < minBounce) this.vy = minBounce;

            if (Math.abs(this.vx) < 1) this.vx += (Math.random() - 0.5) * 4;

            SoundManager.playWall();
            applyShake(3, 3);
        }
        if (this.y + this.radius > Config.CANVAS_HEIGHT) {
            this.y = Config.CANVAS_HEIGHT - this.radius - 5;
            this.vy = -Math.abs(this.vy) * this.elasticity;

            const minBounce = 6;
            if (this.vy > -minBounce) this.vy = -minBounce;

            if (Math.abs(this.vx) < 1) this.vx += (Math.random() - 0.5) * 4;

            SoundManager.playWall();
            applyShake(3, 3);
        }

        if (!State.hotPotatoMode && this.x - this.radius < Config.FIELD_MARGIN) {
            checkCircleCollision(this, Config.FIELD_MARGIN, goalTop);
            checkCircleCollision(this, Config.FIELD_MARGIN, goalBottom);

            if (this.y < goalTop || this.y > goalBottom) {
                this.x = Config.FIELD_MARGIN + this.radius;
                this.vx = Math.abs(this.vx) * this.elasticity;
                SoundManager.playWall();
            } else {
                checkGoalStructure(this, true);
            }
        }

        if (!State.hotPotatoMode && this.x + this.radius > Config.CANVAS_WIDTH - Config.FIELD_MARGIN) {
            checkCircleCollision(this, Config.CANVAS_WIDTH - Config.FIELD_MARGIN, goalTop);
            checkCircleCollision(this, Config.CANVAS_WIDTH - Config.FIELD_MARGIN, goalBottom);

            if (this.y < goalTop || this.y > goalBottom) {
                this.x = Config.CANVAS_WIDTH - Config.FIELD_MARGIN - this.radius;
                this.vx = -Math.abs(this.vx) * this.elasticity;
                SoundManager.playWall();
            } else {
                checkGoalStructure(this, false);
            }
        }

        if (!State.hotPotatoMode && this.y > goalTop + this.radius && this.y < goalBottom - this.radius) {
            if (this.x < Config.FIELD_MARGIN - this.radius) {
                if (handleGoalCallback) handleGoalCallback('blue');
                return;
            }
            if (this.x > Config.CANVAS_WIDTH - Config.FIELD_MARGIN + this.radius) {
                if (handleGoalCallback) handleGoalCallback('red');
                return;
            }
        }

        if (this.x - this.radius < 0 || this.x + this.radius > Config.CANVAS_WIDTH) {
            this.vx *= -this.elasticity;
            if (this.x < Config.CANVAS_WIDTH / 2) {
                this.x = this.radius + 5;
                if (this.vx < 6) this.vx = 6;
            } else {
                this.x = Config.CANVAS_WIDTH - this.radius - 5;
                if (this.vx > -6) this.vx = -6;
            }
            SoundManager.playWall();
        }
    }
}

export const player1 = new Player(150 + Config.FIELD_MARGIN, Config.CANVAS_HEIGHT / 2, '#e74c3c', 'wasd');
export const player2 = new Player(Config.CANVAS_WIDTH - 150 - Config.FIELD_MARGIN, Config.CANVAS_HEIGHT / 2, '#3498db', 'arrows');
export const ball = new Ball(Config.CANVAS_WIDTH / 2, Config.CANVAS_HEIGHT / 2);
