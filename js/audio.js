// js/audio.js
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const masterGainNode = audioCtx.createGain();
masterGainNode.connect(audioCtx.destination);
masterGainNode.gain.value = 0.5; // Default volume

// Using a module-scoped variable instead of assuming global `soundEnabled`
let soundEnabled = true;
let currentLangVar = 'en';

export const SoundManager = {
    setSoundEnabled: (enabled) => {
        soundEnabled = enabled;
    },
    setLang: (lang) => {
        currentLangVar = lang;
    },
    setVolume: (vol) => {
        masterGainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    },
    playTone: (freq, type, duration, vol = 0.1) => {
        if (!soundEnabled) return;
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
        const now = audioCtx.currentTime;
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

        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const output = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output;
            data[i] = output * 3.5;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();

        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

        noise.connect(gain);
        gain.connect(masterGainNode);
        noise.start();
    },
    playWhistle: () => {
        if (!soundEnabled) return;
        SoundManager.playTone(2500, 'sine', 0.1, 0.2);
    },
    playExplosion: () => {
        if (!soundEnabled) return;
        const now = audioCtx.currentTime;
        const bufferSize = audioCtx.sampleRate * 0.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

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

        SoundManager.playTone(60, 'square', 0.3, 0.5);
    },
    startRainSound: () => {
        if (!soundEnabled || SoundManager.rainNode) return;
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

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
    speak: (text, type = 'normal') => {
        if (!window.speechSynthesis || !soundEnabled) return;
        window.speechSynthesis.cancel();

        const langPhrases = {
            tr: {
                goal: ["Goooool!", "İnanılmaz bir gol!", "Top ağlarda!", "Müthiş bir vuruş!", "Harika bir gol!"],
                start: ["Maç başladı!", "Başarılar!", "Düdük çaldı!"]
            },
            en: {
                goal: ["Goal!", "Unbelievable!", "What a strike!", "Beautiful goal!", "Top bins!"],
                start: ["Match started!", "Good luck!", "Kick off!"]
            },
            de: {
                goal: ["Tor!", "Unglaublich!", "Was für ein Schuss!", "Wunderschönes Tor!"],
                start: ["Spiel hat begonnen!", "Viel Glück!"]
            }
        };

        const lang = currentLangVar || 'en';
        let mainPhrase = text;
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(lang));

        // Detection of Goal event to split name and shout
        const lowerText = text.toLowerCase();
        if (lowerText.includes('gol') || lowerText.includes('goal') || lowerText.includes('tor')) {
            const list = langPhrases[lang]?.goal || langPhrases['en'].goal;
            const excitedShout = list[Math.floor(Math.random() * list.length)];

            // Extract player name (e.g., "Messi GOL ATTI" -> "Messi")
            let playerName = "";
            if (text.includes(" GOL")) playerName = text.split(" GOL")[0];
            else if (text.includes(" scored")) playerName = text.split(" scored")[0];
            else if (text.includes(" hat ein Tor erzielt")) playerName = text.split(" hat ein")[0];

            if (playerName && playerName !== text) {
                // 1. Speak Name
                const nameUtterance = new SpeechSynthesisUtterance(playerName);
                if (voice) nameUtterance.voice = voice;
                nameUtterance.rate = 1.0;
                window.speechSynthesis.speak(nameUtterance);

                // 2. Tiny pause, then excited shout
                setTimeout(() => {
                    const shoutUtterance = new SpeechSynthesisUtterance(excitedShout);
                    if (voice) shoutUtterance.voice = voice;
                    shoutUtterance.rate = 1.35;
                    shoutUtterance.pitch = 1.25;
                    window.speechSynthesis.speak(shoutUtterance);
                }, 150);
                return;
            }
            mainPhrase = excitedShout;
        }

        const utterance = new SpeechSynthesisUtterance(mainPhrase);
        if (voice) utterance.voice = voice;

        if (type === 'excited' || mainPhrase.includes('!')) {
            utterance.rate = 1.3;
            utterance.pitch = 1.2;
        } else {
            utterance.rate = 1.1;
            utterance.pitch = 1.0;
        }

        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
    }
};
