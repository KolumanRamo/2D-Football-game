// js/weather.js
import { Config, State } from './config.js';
import { SoundManager } from './audio.js';
import { ball } from './entities.js';

export function applyWeatherPhysics() {
    ball.friction = 0.98;

    initWeatherEffects();

    if (State.weatherCondition === 'rainy') {
        ball.friction = 0.99;
        SoundManager.startRainSound();
    } else {
        SoundManager.stopRainSound();
        if (State.weatherCondition === 'snowy') {
            ball.friction = 0.96;
        } else if (State.weatherCondition === 'icy') {
            ball.friction = 0.995;
        }
    }
}

export function initWeatherEffects() {
    State.rainDrops = [];
    State.snowFlakes = [];

    if (State.weatherCondition === 'rainy') {
        for (let i = 0; i < 100; i++) {
            State.rainDrops.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: Math.random() * Config.CANVAS_HEIGHT,
                l: Math.random() * 20 + 10,
                vy: Math.random() * 10 + 10
            });
        }
    } else if (State.weatherCondition === 'snowy') {
        for (let i = 0; i < 50; i++) {
            State.snowFlakes.push({
                x: Math.random() * Config.CANVAS_WIDTH,
                y: Math.random() * Config.CANVAS_HEIGHT,
                r: Math.random() * 3 + 1,
                vy: Math.random() * 2 + 1,
                vx: Math.random() * 1 - 0.5
            });
        }
    }
}

export function updateWeatherEffects() {
    if (State.weatherCondition === 'rainy') {
        State.rainDrops.forEach(d => {
            d.y += d.vy;
            if (d.y > Config.CANVAS_HEIGHT) {
                d.y = -20;
                d.x = Math.random() * Config.CANVAS_WIDTH;
            }
        });
    } else if (State.weatherCondition === 'snowy') {
        State.snowFlakes.forEach(f => {
            f.y += f.vy;
            f.x += f.vx;
            if (f.y > Config.CANVAS_HEIGHT) {
                f.y = -10;
                f.x = Math.random() * Config.CANVAS_WIDTH;
            }
        });
    }
}

export function drawWeatherEffects(ctx) {
    if (State.weatherCondition === 'sunny') {
        const gradient = ctx.createRadialGradient(0, 0, 100, 0, 0, 800);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    } else if (State.weatherCondition === 'rainy') {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        State.rainDrops.forEach(d => {
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x, d.y + d.l);
        });
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 0, 20, 0.3)';
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    } else if (State.weatherCondition === 'snowy') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(Config.FIELD_MARGIN, Config.FIELD_MARGIN, Config.CANVAS_WIDTH - Config.FIELD_MARGIN * 2, Config.CANVAS_HEIGHT - Config.FIELD_MARGIN * 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        State.snowFlakes.forEach(f => {
            ctx.moveTo(f.x, f.y);
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        });
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);

    } else if (State.weatherCondition === 'icy') {
        ctx.fillStyle = 'rgba(200, 240, 255, 0.4)';
        ctx.fillRect(Config.FIELD_MARGIN, Config.FIELD_MARGIN, Config.CANVAS_WIDTH - Config.FIELD_MARGIN * 2, Config.CANVAS_HEIGHT - Config.FIELD_MARGIN * 2);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(400, 300); ctx.lineTo(450, 350);
        ctx.moveTo(1000, 600); ctx.lineTo(1100, 600);
        ctx.moveTo(1200, 200); ctx.lineTo(1250, 250);
        ctx.stroke();

        ctx.fillStyle = 'rgba(180, 220, 255, 0.1)';
        ctx.fillRect(0, 0, Config.CANVAS_WIDTH, Config.CANVAS_HEIGHT);
    }
}
