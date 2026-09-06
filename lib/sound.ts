// Optional, user-mutable one-shot sound effects using the native Web Audio API.
// No background music, no third-party sound assets. Lazy-initializes on the
// first user gesture to satisfy autoplay policies; defaults to muted so silent
// users are never forced to hear the game.

const STORAGE_KEY = 'ttt.sound.muted';
const VOLUME = 0.18;

type Tone = 'move' | 'win' | 'draw' | 'lose';

const PROGRAMS: Record<Tone, { freq: number; dur: number; type?: OscillatorType }[]> = {
  move: [{ freq: 440, dur: 0.08, type: 'square' }],
  win: [
    { freq: 523.25, dur: 0.18, type: 'triangle' },
    { freq: 659.25, dur: 0.18, type: 'triangle' },
  ],
  draw: [{ freq: 220, dur: 0.32, type: 'sine' }],
  lose: [
    { freq: 392, dur: 0.18, type: 'sine' },
    { freq: 196, dur: 0.32, type: 'sine' },
  ],
};

let ctx: AudioContext | null = null;
let muted = true;


function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export function getMuted(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      muted = raw === null ? true : raw === '1';
    } catch {
      /* ignore */
    }
  }
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}

export function playSound(name: Tone): void {
  if (muted) return;
  const audio = ensureContext();
  if (!audio) return;
  const master = audio.createGain();
  master.gain.setValueAtTime(VOLUME, audio.currentTime);
  master.connect(audio.destination);
  const start = audio.currentTime + 0.005;
  const program = PROGRAMS[name];
  program.forEach((step, i) => {
    const osc = audio.createOscillator();
    const envGain = audio.createGain();
    osc.type = step.type ?? 'sine';
    osc.frequency.value = step.freq;
    const offset = i === 0 ? 0 : (program[i - 1]?.dur ?? 0);
    const t0 = start + offset;
    const t1 = t0 + step.dur;
    envGain.gain.setValueAtTime(0, t0);
    envGain.gain.linearRampToValueAtTime(1, t0 + 0.012);
    envGain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(envGain).connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  });
}
