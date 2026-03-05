// js/chaos.js
import { Config, State } from './config.js';
import { ball } from './entities.js';
import { t } from './lang.js';

export const ChaosManager = {
    events: [
        { id: 'fast_players', name_key: 'chaos_fast_players', type: 'player_speed', value: 12 },
        { id: 'slow_players', name_key: 'chaos_slow_players', type: 'player_speed', value: 1.2 },
        { id: 'big_ball', name_key: 'chaos_big_ball', type: 'ball_radius', value: 40 },
        { id: 'tiny_ball', name_key: 'chaos_tiny_ball', type: 'ball_radius', value: 8 },
        { id: 'big_goals', name_key: 'chaos_big_goals', type: 'goal_height', value: 400 },
        { id: 'tiny_goals', name_key: 'chaos_tiny_goals', type: 'goal_height', value: 80 }
    ],

    activeEvents: [],

    trigger() {
        if (!State.isChaosMode) return;

        this.reset();

        const count = Math.floor(Math.random() * 3) + 1;
        this.activeEvents = [];

        const shuffled = [...this.events].sort(() => 0.5 - Math.random());

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
            if (evt.type === 'player_speed') State.PLAYER_SPEED = evt.value;
            if (evt.type === 'ball_radius') ball.radius = evt.value;
            if (evt.type === 'goal_height') State.GOAL_HEIGHT = evt.value;
        });
    },

    reset() {
        State.PLAYER_SPEED = State.BASE_PLAYER_SPEED;

        if (ball.type === 'pingpong') ball.radius = 10;
        else if (ball.type === 'big') ball.radius = 40;
        else ball.radius = Config.BALL_RADIUS;

        State.GOAL_HEIGHT = 200;
        this.activeEvents = [];
    },

    showNotification() {
        const notif = document.getElementById('chaosNotification');
        const list = document.getElementById('chaosList');
        if (notif && list) {
            notif.classList.remove('hidden');

            list.innerHTML = this.activeEvents.map(e => `<div>${t(e.name_key)} <small>(${e.value})</small></div>`).join('');

            console.log("Chaos Applied:", this.activeEvents);
            console.log("Current Speed:", State.PLAYER_SPEED);
            console.log("Ball Radius:", ball.radius);

            setTimeout(() => {
                notif.classList.add('hidden');
            }, 3000);
        }
    }
};
