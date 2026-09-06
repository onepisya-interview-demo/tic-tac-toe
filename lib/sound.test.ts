import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class StubOsc {
  type: OscillatorType = 'sine';
  frequency: { value: number };
  detune: { value: number };
  started: number[] = [];
  stopped: number[] = [];
  constructor() {
    this.frequency = { value: 0 };
    this.detune = { value: 0 };
  }
  connect() {
    return this;
  }
  start(t: number) {
    this.started.push(t);
  }
  stop(t: number) {
    this.stopped.push(t);
  }
}

class StubParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
  }
  linearRampToValueAtTime() {
    /* noop */
  }
  exponentialRampToValueAtTime() {
    /* noop */
  }
}

class StubGain {
  gain: StubParam;
  constructor() {
    this.gain = new StubParam();
  }
  connect() {
    return this;
  }
}

class StubContext {
  state: 'running' | 'suspended' = 'suspended';
  currentTime = 0;
  destination = new StubGain();
  createdOscs: StubOsc[] = [];
  createdGains: StubGain[] = [];
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  createGain() {
    const g = new StubGain();
    this.createdGains.push(g);
    return g;
  }
  createOscillator() {
    const o = new StubOsc();
    this.createdOscs.push(o);
    return o;
  }
}

beforeEach(() => {
  window.localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stubAudioContext() {
  const ctx = new StubContext();
  (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
    function () {
      return ctx as unknown as AudioContext;
    } as unknown as typeof AudioContext;
  return ctx;
}

async function load() {
  const mod = await import('@/lib/sound');
  return mod;
}

describe('lib/sound', () => {
  it('defaults to muted without touching localStorage', async () => {
    const { getMuted } = await load();
    expect(getMuted()).toBe(true);
    expect(window.localStorage.getItem('ttt.sound.muted')).toBeNull();
  });

  it('setMuted flips the preference and rewrites localStorage', async () => {
    const { getMuted, setMuted } = await load();
    setMuted(false);
    expect(getMuted()).toBe(false);
    expect(window.localStorage.getItem('ttt.sound.muted')).toBe('0');
    setMuted(true);
    expect(getMuted()).toBe(true);
    expect(window.localStorage.getItem('ttt.sound.muted')).toBe('1');
  });

  it('playSound is silent when muted, no AudioContext instantiated', async () => {
    const { playSound, setMuted } = await load();
    setMuted(true);
    const ctx = stubAudioContext();
    playSound('move');
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.createdOscs).toHaveLength(0);
  });

  it('playSound resumes context and creates one envelope when unmuted', async () => {
    const { playSound, setMuted } = await load();
    setMuted(false);
    const ctx = stubAudioContext();
    playSound('move');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    expect(ctx.createdOscs).toHaveLength(1);
  });

  it('playSound stacks the two-tone envelope for a win', async () => {
    const { playSound, setMuted } = await load();
    setMuted(false);
    const ctx = stubAudioContext();
    playSound('win');
    expect(ctx.createdOscs).toHaveLength(2);
  });

  it('playSound stacks the five-tone cheer envelope plus a vibrato modulator (6 oscillators)', async () => {
    const { playSound, setMuted } = await load();
    setMuted(false);
    const ctx = stubAudioContext();
    playSound('cheer');
    // Five notes in the ascending arpeggio, plus a paired detune modulator
    // for the sustained last note. Total = 6.
    expect(ctx.createdOscs).toHaveLength(6);
  });

  it('playSound("cheer") is silent when muted', async () => {
    const { playSound, setMuted } = await load();
    setMuted(true);
    const ctx = stubAudioContext();
    playSound('cheer');
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.createdOscs).toHaveLength(0);
  });

  it('playSound("cheer") resumes the AudioContext once when unmuted', async () => {
    const { playSound, setMuted } = await load();
    setMuted(false);
    const ctx = stubAudioContext();
    playSound('cheer');
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('playSound orders "win" then "cheer" oscillators distinctly (2 + 6 = 8)', async () => {
    const { playSound, setMuted } = await load();
    setMuted(false);
    const ctx = stubAudioContext();
    playSound('win');
    playSound('cheer');
    // 2 oscillators from win (C5, E5) + 6 from cheer (C5, E5, G5, C6, E6 + 5Hz LFO)
    expect(ctx.createdOscs).toHaveLength(8);
    // win pair
    expect(ctx.createdOscs[0].frequency.value).toBeCloseTo(523.25);
    expect(ctx.createdOscs[1].frequency.value).toBeCloseTo(659.25);
    // cheer arpeggio in order
    expect(ctx.createdOscs[2].frequency.value).toBeCloseTo(523.25);
    expect(ctx.createdOscs[3].frequency.value).toBeCloseTo(659.25);
    expect(ctx.createdOscs[4].frequency.value).toBeCloseTo(783.99);
    expect(ctx.createdOscs[5].frequency.value).toBeCloseTo(1046.5);
    expect(ctx.createdOscs[6].frequency.value).toBeCloseTo(1318.51);
    // 5Hz vibrato LFO modulating the sustained last note
    expect(ctx.createdOscs[7].frequency.value).toBe(5);
  });
});
