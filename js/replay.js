// js/replay.js
import { Config, State } from './config.js';
import { player1, player2, ball } from './entities.js';

export class ReplayManager {
    static capture(frameCount) {
        // Record every nth frame if we want to save space, but for 5s (300 frames) it's fine
        const snapshot = {
            p1: {
                x: player1.x,
                y: player1.y,
                vx: player1.vx,
                vy: player1.vy,
                facingRight: player1.facingRight,
                sliding: player1.sliding,
                animTimer: player1.animTimer,
                celebrating: player1.celebrating,
                stunned: player1.stunned,
                charge: player1.charge,
                isCharging: player1.isCharging
            },
            p2: {
                x: player2.x,
                y: player2.y,
                vx: player2.vx,
                vy: player2.vy,
                facingRight: player2.facingRight,
                sliding: player2.sliding,
                animTimer: player2.animTimer,
                celebrating: player1.celebrating,
                stunned: player2.stunned,
                charge: player2.charge,
                isCharging: player2.isCharging
            },
            ball: {
                x: ball.x,
                y: ball.y,
                vx: ball.vx,
                vy: ball.vy,
                angle: ball.angle,
                type: ball.type,
                radius: ball.radius
            }
        };

        State.replayBuffer.push(snapshot);
        // Keep only last 300 frames (5 seconds at 60fps)
        if (State.replayBuffer.length > 300) {
            State.replayBuffer.shift();
        }
    }

    static start() {
        if (State.replayBuffer.length === 0) return;
        State.replayActive = true;
        State.replayFrame = 0;
    }

    static stop() {
        State.replayActive = false;
        State.replayBuffer = []; // Clear buffer after playing
    }

    static getSnapshot() {
        // Simple linear playback for now
        // We can use State.replaySpeed to skip frames or interpolate
        const index = Math.floor(State.replayFrame);
        if (index >= State.replayBuffer.length) return null;

        State.replayFrame += State.replaySpeed; // 0.4x slow motion
        return State.replayBuffer[index];
    }
}
