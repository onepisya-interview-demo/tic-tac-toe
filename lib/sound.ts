// Optional, user-mutable one-shot sound effects using the native Web Audio API.
// No background music, no third-party sound assets. Lazy-initializes on the
// first user gesture to satisfy autoplay policies; defaults to muted so silent
// users are never forced to hear the game.

const STORAGE_KEY = 'ttt.sound.muted';
const VOLUME = 0.18;

type Tone = 'move' | 'win' | 'draw' | 'cheer';

interface ProgramStep {
  freq: number;
  dur: number;
  type?: OscillatorType;
  /** Add a paired 5Hz LFO modulating detune for the duration of this note. */
  vibrato?: boolean;
}

const PROGRAMS: Record<Tone, ProgramStep[]> = {
  move: [{ freq: 440, dur: 0.08, type: 'square' }],
  win: [
    { freq: 523.25, dur: 0.18, type: 'triangle' },
    { freq: 659.25, dur: 0.18, type: 'triangle' },
  ],
  draw: [{ freq: 220, dur: 0.32, type: 'sine' }],
  // Ascending C-major arpeggio with a sustained, vibrato-tailed top note.
  // Total duration ~1.02s — short enough not to collide with the next round.
  cheer: [
    { freq: 523.25, dur: 0.12, type: 'triangle' }, // C5
    { freq: 659.25, dur: 0.11, type: 'triangle' }, // E5
    { freq: 783.99, dur: 0.10, type: 'triangle' }, // G5
    { freq: 1046.5, dur: 0.09, type: 'triangle' }, // C6
    { freq: 1318.51, dur: 0.6, type: 'triangle', vibrato: true }, // E6
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

    if (step.vibrato) {
      // 5Hz LFO modulating detune by ±10 cents — a subtle chorus-like
      // shimmer that turns the sustained top note into a "celebration".
      const lfo = audio.createOscillator();
      const lfoGain = audio.createGain();
      lfo.frequency.value = 5;
      lfoGain.gain.value = 10;
      lfo.connect(lfoGain).connect(osc.detune);
      lfo.start(t0);
      lfo.stop(t1 + 0.02);
    }
  });
}
