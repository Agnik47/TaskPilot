// Interface sound effects, synthesised with the Web Audio API (no audio files).
// Deliberately quiet and short (≤ 0.4s) so they confirm actions without
// drawing attention. Browsers only allow audio after the first user gesture,
// so the context is resumed on the first click/keypress.

let ctx = null;
let master = null;
let uiSoundsEnabled = true;
const lastPlayed = new Map();

const MASTER_VOLUME = 0.55;

function getContext() {
    if (!ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = MASTER_VOLUME;
        master.connect(ctx.destination);
    }
    return ctx;
}

if (typeof window !== "undefined") {
    const unlock = () => {
        getContext()?.resume().catch(() => {});
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
}

// One enveloped oscillator note: quick attack, exponential decay, optional glide.
function tone(audio, { freq, to, start = 0, dur = 0.08, gain = 0.1, type = "sine" }) {
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, dur / 4));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

// name -> { play, gap } ; `gap` (ms) throttles rapid repeats of the same sound.
const SOUNDS = {
    // Soft, dry tick for clicks.
    tap: { gap: 40, play: (a) => tone(a, { freq: 1400, to: 900, dur: 0.035, gain: 0.05, type: "triangle" }) },
    // Barely-there key tick with slight pitch variance so typing doesn't drone.
    type: { gap: 28, play: (a) => tone(a, { freq: 2100 + Math.random() * 500, dur: 0.018, gain: 0.018, type: "triangle" }) },
    toggleOn: { gap: 60, play: (a) => tone(a, { freq: 620, to: 940, dur: 0.07, gain: 0.06 }) },
    toggleOff: { gap: 60, play: (a) => tone(a, { freq: 940, to: 620, dur: 0.07, gain: 0.05 }) },
    open: { gap: 120, play: (a) => tone(a, { freq: 420, to: 700, dur: 0.1, gain: 0.045 }) },
    success: {
        gap: 300,
        play: (a) => {
            tone(a, { freq: 1046.5, dur: 0.12, gain: 0.06 }); // C6
            tone(a, { freq: 1318.5, start: 0.08, dur: 0.18, gain: 0.06 }); // E6
        },
    },
    error: {
        gap: 300,
        play: (a) => {
            tone(a, { freq: 330, dur: 0.12, gain: 0.07, type: "triangle" });
            tone(a, { freq: 247, start: 0.1, dur: 0.18, gain: 0.07, type: "triangle" });
        },
    },
    send: { gap: 150, play: (a) => tone(a, { freq: 520, to: 1180, dur: 0.11, gain: 0.05 }) },
    receive: {
        gap: 250,
        play: (a) => {
            tone(a, { freq: 780, dur: 0.07, gain: 0.05 });
            tone(a, { freq: 1040, start: 0.06, dur: 0.1, gain: 0.045 });
        },
    },
    // Notification chime (governed by its own "Play sound" setting).
    notification: {
        gap: 1500,
        play: (a) => {
            tone(a, { freq: 880, dur: 0.35, gain: 0.18 }); // A5
            tone(a, { freq: 1318.5, start: 0.12, dur: 0.35, gain: 0.18 }); // E6
        },
    },
};

function play(name, { force = false } = {}) {
    if (!force && !uiSoundsEnabled) return;
    const sound = SOUNDS[name];
    const audio = typeof window !== "undefined" ? getContext() : null;
    if (!sound || !audio || audio.state !== "running") return;

    const now = performance.now();
    if (now - (lastPlayed.get(name) || 0) < sound.gap) return;
    lastPlayed.set(name, now);
    sound.play(audio);
}

// Interface sounds (clicks, typing, confirmations) — respect the user setting.
export const sfx = (name) => play(name);

export function setUiSoundsEnabled(enabled) {
    uiSoundsEnabled = enabled;
}

// The notification chime has its own setting, checked by the caller.
export const playNotificationSound = () => play("notification", { force: true });

// For settings previews: plays even while interface sounds are off.
export const previewSound = (name) => play(name, { force: true });
