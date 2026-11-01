/* Every sound is synthesized with the Web Audio API: no audio files, nothing to license. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = false;
let hum: { stop: () => void } | null = null;
let humWanted = false;
let lastTick = 0;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

export function isEnabled() {
  return enabled;
}

/** Must be called from a user gesture the first time it turns sound on. */
export function setEnabled(on: boolean) {
  enabled = on;
  if (on) {
    const c = ensure();
    if (!c || !master) return;
    c.resume();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setTargetAtTime(0.55, c.currentTime, 0.05);
    if (humWanted) startHum();
  } else if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    stopHum();
    const c = ctx;
    setTimeout(() => {
      if (!enabled) c.suspend();
    }, 300);
  }
}

function tone(opts: {
  type?: OscillatorType;
  f0: number;
  f1?: number;
  dur: number;
  gain: number;
  at?: number;
  attack?: number;
}) {
  if (!enabled || !ctx || !master) return;
  const t = ctx.currentTime + (opts.at ?? 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.f0, t);
  if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + opts.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + opts.dur + 0.02);
}

function noise(dur: number, gain: number, freq: number, q = 1) {
  if (!enabled || !ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

export const sfx = {
  /** soft tick for hovering interactive elements (throttled) */
  tick() {
    const now = performance.now();
    if (now - lastTick < 45) return;
    lastTick = now;
    tone({ type: "triangle", f0: 2400, f1: 1800, dur: 0.03, gain: 0.025 });
  },
  blip() {
    tone({ type: "sine", f0: 620, f1: 980, dur: 0.09, gain: 0.08 });
  },
  open() {
    tone({ type: "sine", f0: 420, f1: 840, dur: 0.16, gain: 0.07 });
    tone({ type: "triangle", f0: 1260, dur: 0.12, gain: 0.025, at: 0.05 });
  },
  close() {
    tone({ type: "sine", f0: 760, f1: 380, dur: 0.14, gain: 0.06 });
  },
  whoosh() {
    noise(0.5, 0.05, 1800, 0.6);
  },
  start() {
    [0, 0.08, 0.16].forEach((at, i) => tone({ type: "square", f0: 330 * (1 + i * 0.5), dur: 0.1, gain: 0.04, at }));
  },
  collect(combo: number) {
    const base = 660 * Math.pow(2, Math.min(combo - 1, 4) / 12 * 3);
    tone({ type: "sine", f0: base, f1: base * 1.5, dur: 0.12, gain: 0.09 });
    tone({ type: "triangle", f0: base * 2, dur: 0.08, gain: 0.03, at: 0.04 });
  },
  hit() {
    noise(0.35, 0.3, 2200, 2);
    tone({ type: "sawtooth", f0: 160, f1: 40, dur: 0.35, gain: 0.12 });
  },
  levelUp() {
    [0, 0.09].forEach((at, i) => tone({ type: "triangle", f0: 523 * (1 + i * 0.5), dur: 0.14, gain: 0.07, at }));
  },
  zone() {
    noise(0.7, 0.08, 2600, 0.6);
    [392, 523, 659, 784].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.24, gain: 0.07, at: i * 0.08 }));
  },
  power() {
    tone({ type: "sine", f0: 500, f1: 1500, dur: 0.2, gain: 0.09 });
  },
  gameOver() {
    [523, 392, 330, 262].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.22, gain: 0.08, at: i * 0.16 }));
  },
};

/* low ambient hum for the deck: two detuned oscillators through a slow-breathing lowpass */
function startHum() {
  if (hum || !enabled || !ctx || !master) return;
  const c = ctx;
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.setTargetAtTime(0.05, c.currentTime, 1.2);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(lp.frequency);
  const oscs = [55, 55.4, 110.3].map((f, i) => {
    const o = c.createOscillator();
    o.type = i === 2 ? "sine" : "sawtooth";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = i === 2 ? 0.25 : 0.5;
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  lp.connect(out).connect(master);
  lfo.start();
  hum = {
    stop() {
      out.gain.setTargetAtTime(0, c.currentTime, 0.3);
      setTimeout(() => {
        oscs.forEach((o) => o.stop());
        lfo.stop();
        out.disconnect();
      }, 1200);
    },
  };
}

function stopHum() {
  hum?.stop();
  hum = null;
}

/** The deck asks for the hum; it only plays while sound is enabled. */
export function setHum(on: boolean) {
  humWanted = on;
  if (on) startHum();
  else stopHum();
}
