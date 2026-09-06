import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class StubOsc {
  type: OscillatorType = 'sine';
  frequency: { value: number };
  started: number[] = [];
  stopped: number[] = [];
  constructor() {
    this.frequency = { value: 0 };
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
});
