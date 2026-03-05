// --- Weather System ---
let weatherCondition = 'sunny';
let rainDrops = [];
let snowFlakes = [];

function applyWeatherPhysics() {
    // Reset defaults first
    ball.friction = 0.98;
    // Player friction/speed could also be adjusted here if desired

    if (weatherCondition === 'rainy') {
        ball.friction = 0.99; // Slippery/Fast
    } else if (weatherCondition === 'snowy') {
        ball.friction = 0.96; // Slow/Heavy
    } else if (weatherCondition === 'icy') {
        ball.friction = 0.995; // Ice skating!
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
    if (weatherCondition === 'rainy') {
        ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
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

    } else if (weatherCondition === 'snowy') {
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

    } else if (weatherCondition === 'icy') {
        // Icy Tint
        ctx.fillStyle = 'rgba(130, 200, 255, 0.15)';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}
