import { useSyncExternalStore } from 'react';
import { RECIPES, type PlayOptions, type SoundName } from './recipes';

const STORAGE_KEY = 'dice-dominion.sound';
const MASTER_LEVEL = 0.85;

/** Shortest gap between two plays of the same sound, so a burst of events does not pile up. */
const MIN_GAP: Partial<Record<SoundName, number>> = {
  click: 0.03,
  diceTap: 0.03,
  place: 0.05,
  fall: 0.07,
};

function storedPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    // Private browsing can refuse storage; sound simply defaults to on.
    return true;
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private lastPlayed = new Map<SoundName, number>();
  private listeners = new Set<() => void>();
  private on = storedPreference();

  get enabled() {
    return this.on;
  }

  /**
   * Browsers keep audio suspended until the player interacts with the page,
   * so this is called from the first pointer or key event.
   */
  unlock() {
    if (!this.ctx) this.build();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private build() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();

    // Everything passes through one limiter so overlapping sounds cannot clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 10;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;

    const master = ctx.createGain();
    master.gain.value = this.on ? MASTER_LEVEL : 0;
    const sfx = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    sfx.connect(master);
    master.connect(limiter).connect(analyser).connect(ctx.destination);

    this.ctx = ctx;
    this.master = master;
    this.sfx = sfx;
    this.analyser = analyser;
    this.startAmbience(ctx, master);
  }

  /** A quiet bed of wind and running water under the whole match. */
  private startAmbience(ctx: AudioContext, out: AudioNode) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: each sample drifts a little from the last, which sounds softer than white noise.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) / 1.04;
      data[i] = last * 6;
    }

    const layer = (filterType: BiquadFilterType, freq: number, q: number, level: number, lfoRate: number, lfoDepth: number) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const amp = ctx.createGain();
      amp.gain.value = level;
      // A slow wobble on the level keeps the bed from sounding like static.
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = lfoRate;
      depth.gain.value = level * lfoDepth;
      lfo.connect(depth).connect(amp.gain);
      src.connect(filter).connect(amp).connect(out);
      src.start();
      lfo.start();
    };

    layer('lowpass', 420, 0.5, 0.05, 0.07, 0.6); // wind
    layer('bandpass', 1500, 0.6, 0.022, 0.31, 0.35); // river
  }

  play(name: SoundName, options: PlayOptions = {}) {
    const ctx = this.ctx;
    if (!this.on || !ctx || !this.sfx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name];
    if (gap !== undefined && now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    this.lastPlayed.set(name, now);
    RECIPES[name]({ ctx, out: this.sfx }, now + 0.005, options.strength ?? 1);
  }

  setEnabled(on: boolean) {
    this.on = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      // Not being able to remember the choice is not worth an error.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? MASTER_LEVEL : 0, this.ctx.currentTime, 0.04);
    }
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Development aid: state of the audio context and the peak level leaving the limiter right now. */
  probe() {
    if (!this.ctx || !this.analyser) return { state: 'not built', peak: 0 };
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const v of samples) peak = Math.max(peak, Math.abs(v));
    return { state: this.ctx.state, peak };
  }
}

export const sound = new SoundEngine();

/** Whether sound is switched on, for the HUD toggle. */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(sound.subscribe, () => sound.enabled);
}

/**
 * Renders one sound offline and reports its level, so a recipe can be
 * checked for silence, clipping or bad numbers without a pair of ears.
 */
export async function measureSound(name: SoundName, strength = 1) {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, rate * 3, rate);
  const declared = RECIPES[name]({ ctx, out: ctx.destination }, 0.01, strength);
  const samples = (await ctx.startRendering()).getChannelData(0);

  let peak = 0;
  let sum = 0;
  let lastAudible = 0;
  let bad = false;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    if (!Number.isFinite(v)) bad = true;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    if (a > 0.002) lastAudible = i;
    sum += v * v;
  }
  const audible = Math.max(1, lastAudible);
  return {
    name,
    peak: +peak.toFixed(3),
    rms: +Math.sqrt(sum / audible).toFixed(3),
    seconds: +(lastAudible / rate).toFixed(2),
    declared,
    bad,
  };
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __sound: unknown }).__sound = { sound, measureSound, names: Object.keys(RECIPES) };
}
