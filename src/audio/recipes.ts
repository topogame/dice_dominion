/**
 * Every sound in the game is synthesised with the Web Audio API: no audio
 * files are downloaded. A recipe schedules oscillators and filtered noise on
 * whatever context it is given, so the same code plays live and can be
 * rendered offline to measure its level.
 */

export interface Bus {
  ctx: BaseAudioContext;
  out: AudioNode;
}

export type SoundName =
  | 'click'
  | 'select'
  | 'rattle'
  | 'diceTap'
  | 'place'
  | 'swing'
  | 'clash'
  | 'block'
  | 'capture'
  | 'fall'
  | 'castleHit'
  | 'castleFall'
  | 'chest'
  | 'turn'
  | 'yourTurn'
  | 'victory'
  | 'defeat';

export interface PlayOptions {
  /** 0..1 scale on loudness (and, for knocks, on weight). */
  strength?: number;
}

// ── Building blocks ────────────────────────────────────────────────────
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Two seconds of white noise, generated once per context. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/** A fast rise to `peak` and an exponential fall back to silence. */
function envelope(param: AudioParam, t: number, attack: number, decay: number, peak: number) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

interface ToneSpec {
  type?: OscillatorType;
  from: number;
  /** Pitch glides to this frequency over the length of the note. */
  to?: number;
  attack?: number;
  decay: number;
  gain: number;
}

function tone(bus: Bus, t: number, spec: ToneSpec) {
  const { ctx, out } = bus;
  const attack = spec.attack ?? 0.004;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.from, t);
  if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, t + attack + spec.decay);
  envelope(amp.gain, t, attack, spec.decay, spec.gain);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + attack + spec.decay + 0.02);
}

interface NoiseSpec {
  filter: BiquadFilterType;
  from: number;
  /** Filter frequency sweeps to this value over the length of the burst. */
  to?: number;
  q?: number;
  attack?: number;
  decay: number;
  gain: number;
}

function noise(bus: Bus, t: number, spec: NoiseSpec) {
  const { ctx, out } = bus;
  const attack = spec.attack ?? 0.003;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  // Start somewhere random in the buffer so repeated bursts do not sound identical.
  const offset = Math.random() * 1.5;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 0.8;
  filter.frequency.setValueAtTime(spec.from, t);
  if (spec.to) filter.frequency.exponentialRampToValueAtTime(spec.to, t + attack + spec.decay);
  const amp = ctx.createGain();
  envelope(amp.gain, t, attack, spec.decay, spec.gain);
  src.connect(filter).connect(amp).connect(out);
  src.start(t, offset);
  src.stop(t + attack + spec.decay + 0.02);
}

/** Struck metal: several partials that are not whole multiples of one another. */
function ring(bus: Bus, t: number, base: number, decay: number, gain: number, ratios: number[]) {
  ratios.forEach((ratio, i) => {
    tone(bus, t, {
      from: base * ratio * (1 + (Math.random() - 0.5) * 0.012),
      decay: decay * (1 - i * 0.12),
      gain: gain / (1 + i * 0.7),
    });
  });
}

/** A soft bell note: a sine with a quieter octave above it. */
function bell(bus: Bus, t: number, freq: number, decay: number, gain: number) {
  tone(bus, t, { from: freq, decay, gain });
  tone(bus, t, { from: freq * 2.01, decay: decay * 0.55, gain: gain * 0.28 });
}

/** A reedy horn note: a filtered sawtooth that swells and fades. */
function horn(bus: Bus, t: number, freq: number, length: number, gain: number) {
  const { ctx, out } = bus;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, t);
  filter.type = 'lowpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(freq * 1.5, t);
  filter.frequency.linearRampToValueAtTime(freq * 4, t + length * 0.35);
  filter.frequency.linearRampToValueAtTime(freq * 2, t + length);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.06);
  amp.gain.setValueAtTime(gain, t + length * 0.6);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(filter).connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

// Note frequencies used by the short musical cues.
const D4 = 293.66;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const D5 = 587.33;
const E5 = 659.25;
const FS5 = 739.99;
const A5 = 880.0;
const B5 = 987.77;
const D6 = 1174.66;

// ── Recipes ────────────────────────────────────────────────────────────
// Each schedules its sound at time `t` and returns how long it lasts.
export const RECIPES: Record<SoundName, (bus: Bus, t: number, strength: number) => number> = {
  /** Button press: a small wooden tick. */
  click: (bus, t, s) => {
    tone(bus, t, { from: 760, to: 520, decay: 0.045, gain: 0.16 * s });
    noise(bus, t, { filter: 'bandpass', from: 2600, q: 1.2, decay: 0.02, gain: 0.07 * s });
    return 0.07;
  },

  /** Picking a soldier on the board: a brighter, shorter tick. */
  select: (bus, t, s) => {
    tone(bus, t, { from: 1040, to: 1320, decay: 0.06, gain: 0.12 * s });
    return 0.08;
  },

  /** Dice shaken before the throw: a handful of light knocks. */
  rattle: (bus, t, s) => {
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.045 + Math.random() * 0.02;
      tone(bus, at, { from: 520 + Math.random() * 380, to: 300, decay: 0.03, gain: 0.15 * s });
      noise(bus, at, { filter: 'bandpass', from: 2200 + Math.random() * 1600, q: 1.5, decay: 0.018, gain: 0.13 * s });
    }
    return 0.4;
  },

  /** A die landing: a woody knock, heavier for a harder landing. */
  diceTap: (bus, t, s) => {
    tone(bus, t, { from: 150 + 130 * s, to: 90, decay: 0.07 + 0.05 * s, gain: 0.34 * s });
    tone(bus, t, { from: 640, to: 380, decay: 0.035, gain: 0.12 * s });
    noise(bus, t, { filter: 'bandpass', from: 2400, q: 1.1, decay: 0.03, gain: 0.16 * s });
    return 0.16;
  },

  /** A soldier set down on a tile: a soft thud with a clink of armour. */
  place: (bus, t, s) => {
    tone(bus, t, { from: 150, to: 68, decay: 0.11, gain: 0.3 * s });
    noise(bus, t, { filter: 'lowpass', from: 900, to: 300, decay: 0.07, gain: 0.12 * s });
    ring(bus, t + 0.012, 2300 + Math.random() * 500, 0.07, 0.035 * s, [1, 1.47]);
    return 0.16;
  },

  /** A sword drawn back and swung: a short rush of air. */
  swing: (bus, t, s) => {
    noise(bus, t, { filter: 'bandpass', from: 380, to: 2200, q: 1.6, attack: 0.09, decay: 0.2, gain: 0.55 * s });
    return 0.32;
  },

  /** Blade on blade. */
  clash: (bus, t, s) => {
    noise(bus, t, { filter: 'highpass', from: 3200, decay: 0.035, gain: 0.26 * s });
    ring(bus, t, 1180 + Math.random() * 180, 0.42, 0.15 * s, [1, 1.59, 2.31, 2.93, 3.74]);
    tone(bus, t, { from: 190, to: 80, decay: 0.09, gain: 0.2 * s });
    return 0.5;
  },

  /** A blow caught on a shield: duller and lower than a blade. */
  block: (bus, t, s) => {
    tone(bus, t, { from: 210, to: 95, decay: 0.14, gain: 0.34 * s });
    noise(bus, t, { filter: 'bandpass', from: 900, q: 0.9, decay: 0.06, gain: 0.2 * s });
    ring(bus, t, 430, 0.22, 0.09 * s, [1, 1.52, 2.4]);
    return 0.3;
  },

  /** An enemy soldier joins your side: three rising bell notes. */
  capture: (bus, t, s) => {
    [E5, A5, D6].forEach((f, i) => bell(bus, t + i * 0.075, f, 0.38, 0.13 * s));
    return 0.6;
  },

  /** A soldier is beaten: a falling tone and a dull landing. */
  fall: (bus, t, s) => {
    tone(bus, t, { type: 'triangle', from: 330, to: 95, decay: 0.26, gain: 0.16 * s });
    tone(bus, t + 0.2, { from: 120, to: 55, decay: 0.12, gain: 0.24 * s });
    noise(bus, t + 0.2, { filter: 'lowpass', from: 700, decay: 0.08, gain: 0.1 * s });
    return 0.4;
  },

  /** A castle wall struck: a deep boom with cracking stone. */
  castleHit: (bus, t, s) => {
    tone(bus, t, { from: 96, to: 42, decay: 0.5, gain: 0.5 * s });
    noise(bus, t, { filter: 'lowpass', from: 520, to: 140, decay: 0.5, gain: 0.3 * s });
    noise(bus, t + 0.02, { filter: 'bandpass', from: 1100, q: 1.4, decay: 0.07, gain: 0.2 * s });
    noise(bus, t + 0.13, { filter: 'bandpass', from: 760, q: 1.4, decay: 0.09, gain: 0.13 * s });
    return 0.6;
  },

  /** A castle comes down: a long rumble, tumbling stones, a final thump. */
  castleFall: (bus, t, s) => {
    noise(bus, t, { filter: 'lowpass', from: 420, to: 90, attack: 0.25, decay: 1.5, gain: 0.42 * s });
    tone(bus, t, { from: 70, to: 36, attack: 0.2, decay: 1.4, gain: 0.34 * s });
    for (let i = 0; i < 9; i++) {
      const at = t + 0.1 + Math.random() * 1.2;
      noise(bus, at, { filter: 'bandpass', from: 500 + Math.random() * 900, q: 1.6, decay: 0.07 + Math.random() * 0.08, gain: 0.14 * s });
    }
    tone(bus, t + 1.35, { from: 110, to: 38, decay: 0.55, gain: 0.5 * s });
    noise(bus, t + 1.35, { filter: 'lowpass', from: 600, to: 120, decay: 0.45, gain: 0.3 * s });
    return 2;
  },

  /** A treasure chest opened: a quick run of bright bells. */
  chest: (bus, t, s) => {
    [D5, FS5, A5, D6, A5 * 1.5].forEach((f, i) => bell(bus, t + i * 0.06, f, 0.5, 0.1 * s));
    return 0.8;
  },

  /** Another kingdom's turn begins: one low, quiet horn note. */
  turn: (bus, t, s) => {
    horn(bus, t, D4 / 2, 0.32, 0.07 * s);
    return 0.35;
  },

  /** Your turn: a two-note horn call, a fifth apart. */
  yourTurn: (bus, t, s) => {
    horn(bus, t, D4, 0.22, 0.13 * s);
    horn(bus, t + 0.18, A4, 0.5, 0.15 * s);
    return 0.7;
  },

  /** The match is won: a rising call that settles on a bright chord. */
  victory: (bus, t, s) => {
    [D4, FS5 / 2, A4, D5].forEach((f, i) => horn(bus, t + i * 0.16, f, 0.3, 0.12 * s));
    [D5, FS5, A5].forEach((f) => horn(bus, t + 0.66, f, 1.3, 0.085 * s));
    [D6, B5, D6].forEach((f, i) => bell(bus, t + 0.7 + i * 0.14, f, 0.9, 0.07 * s));
    return 2.1;
  },

  /** The match is lost: a slow minor descent. */
  defeat: (bus, t, s) => {
    [A4, G4, F4, D4].forEach((f, i) => horn(bus, t + i * 0.3, f, 0.5, 0.11 * s));
    [D4 / 2, F4 / 2, A4 / 2].forEach((f) => horn(bus, t + 1.2, f, 1.2, 0.08 * s));
    tone(bus, t + 1.2, { from: 73, decay: 1.1, gain: 0.2 * s });
    return 2.5;
  },
};
