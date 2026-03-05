// js/particles.js
import { Config, State } from './config.js';

export const particles = [];
export const powerUps = [];

export class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'speed', 'shot', 'freeze', ...
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

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        if (this.type === 'speed') ctx.fillStyle = '#f1c40f';
        else if (this.type === 'shot') ctx.fillStyle = '#e74c3c';
        else if (this.type === 'freeze') ctx.fillStyle = '#3498db';
        else if (this.type === 'tiny_ball') ctx.fillStyle = '#9b59b6';
        else if (this.type === 'big_goals') ctx.fillStyle = '#2ecc71';
        else if (this.type === 'confusion') ctx.fillStyle = '#e67e22';

        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.stroke();

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

export class Particle {
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
        this.vx *= 0.92;
        this.vy *= 0.92;
        this.life -= 0.02;
        this.size *= 0.96;
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

export function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}
