// js/utils.js
import { Config, State } from './config.js';
import { SoundManager } from './audio.js';
import { Particle, particles } from './particles.js';

export function applyShake(currentIntensity, duration) {
    State.shakeIntensity = currentIntensity;
    State.shakeTimer = duration;
}

export function startSlowMo(duration, factor) {
    State.slowMoTimer = duration;
    State.slowMoFactor = factor;
}

export function drawPentagon(ctx, x, y, radius) {
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

export function createExplosion(x, y) {
    const colors = ['#e74c3c', '#c0392b', '#d35400', '#f39c12', '#ffffff', '#e74c3c'];
    for (let i = 0; i < 80; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const p = new Particle(x, y, color);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 20 + 10;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 1.0 + Math.random() * 0.5;
        particles.push(p);
    }
}

export function applyExplosionForce(x, y, entities) {
    const force = 30;
    const range = 500;

    entities.forEach(entity => {
        const dx = entity.x - x;
        const dy = entity.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < range) {
            const angle = Math.atan2(dy, dx);
            let effect = (1 - dist / range);
            if (effect < 0) effect = 0;

            const push = effect * force;

            entity.vx += Math.cos(angle) * push;
            entity.vy += Math.sin(angle) * push;

            if (dist < 100) entity.vy -= 10;
        }
    });

    applyShake(20, 30);
}

export function checkCircleCollision(entity, cx, cy) {
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < entity.radius + 5) {
        const angle = Math.atan2(dy, dx);
        const overlap = (entity.radius + 5) - dist;

        entity.x += Math.cos(angle) * overlap;
        entity.y += Math.sin(angle) * overlap;

        const nx = entity.x - cx;
        const ny = entity.y - cy;
        const len = Math.sqrt(nx * nx + ny * ny);

        if (len > 0) {
            const ux = nx / len;
            const uy = ny / len;

            const dot = entity.vx * ux + entity.vy * uy;

            if (dot < 0) {
                entity.vx = entity.vx - 2 * dot * ux;
                entity.vy = entity.vy - 2 * dot * uy;

                entity.vx *= 0.7;
                entity.vy *= 0.7;

                const speed = Math.sqrt(entity.vx * entity.vx + entity.vy * entity.vy);
                if (speed > 1) {
                    SoundManager.playWall();
                }
                applyShake(8, 8);
            }
        }
    }
}

export function checkGoalStructure(entity, isLeft) {
    const goalTop = (Config.CANVAS_HEIGHT - State.GOAL_HEIGHT) / 2;
    const goalBottom = (Config.CANVAS_HEIGHT + State.GOAL_HEIGHT) / 2;

    const mouthX = isLeft ? Config.FIELD_MARGIN : Config.CANVAS_WIDTH - Config.FIELD_MARGIN;
    const backX = isLeft ? Config.FIELD_MARGIN - Config.GOAL_DEPTH : Config.CANVAS_WIDTH - Config.FIELD_MARGIN + Config.GOAL_DEPTH;

    let inDepthRange = false;
    if (isLeft) {
        if (entity.x < mouthX + entity.radius && entity.x > backX - entity.radius) inDepthRange = true;
    } else {
        if (entity.x > mouthX - entity.radius && entity.x < backX + entity.radius) inDepthRange = true;
    }

    if (inDepthRange) {
        if (Math.abs(entity.y - goalTop) < entity.radius) {
            entity.vy *= -0.8;
            if (entity.y > goalTop) {
                entity.y = goalTop + entity.radius + 1;
            } else {
                entity.y = goalTop - entity.radius - 1;
            }
        }

        if (Math.abs(entity.y - goalBottom) < entity.radius) {
            entity.vy *= -0.8;
            if (entity.y < goalBottom) {
                entity.y = goalBottom - entity.radius - 1;
            } else {
                entity.y = goalBottom + entity.radius + 1;
            }
        }
    }

    if (entity.y > goalTop - entity.radius && entity.y < goalBottom + entity.radius) {
        if (Math.abs(entity.x - backX) < entity.radius) {
            entity.vx *= -0.8;
            entity.x = isLeft ? backX + entity.radius + 1 : backX - entity.radius - 1;
            SoundManager.playWall();
        }
    }
}
