import { vehicle } from "./vehicle";
import { useGame } from "./store";

type AudioGraph = {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  engine: OscillatorNode;
  engine2: OscillatorNode;
  engineGain: GainNode;
  engineFilter: BiquadFilterNode;
  tire: AudioBufferSourceNode;
  tireGain: GainNode;
  tireFilter: BiquadFilterNode;
  windGain: GainNode;
};

let graph: AudioGraph | null = null;
let birdTimer = 0;
let unlocked = false;

function makeNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const rate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, rate * seconds, rate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

function ramp(param: AudioParam, value: number, ctx: AudioContext, t = 0.04) {
  param.setTargetAtTime(value, ctx.currentTime, t);
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!graph) {
    const ctx = new AC({ latencyHint: "interactive" });
    const master = ctx.createGain();
    const music = ctx.createGain();
    const sfx = ctx.createGain();
    master.gain.value = 0.85;
    music.gain.value = 0.55;
    sfx.gain.value = 0.7;
    music.connect(master);
    sfx.connect(master);
    master.connect(ctx.destination);

    const pad1 = ctx.createOscillator();
    const pad2 = ctx.createOscillator();
    const padGain = ctx.createGain();
    const padFilter = ctx.createBiquadFilter();
    pad1.type = "sine";
    pad2.type = "sine";
    pad1.frequency.value = 110;
    pad2.frequency.value = 164.8;
    padGain.gain.value = 0.045;
    padFilter.type = "lowpass";
    padFilter.frequency.value = 420;
    pad1.connect(padFilter);
    pad2.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(music);
    pad1.start();
    pad2.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 80;
    lfo.connect(lfoGain);
    lfoGain.connect(padFilter.frequency);
    lfo.start();

    const noiseBuf = makeNoiseBuffer(ctx, 3);
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(music);
    wind.start();

    const engine = ctx.createOscillator();
    const engine2 = ctx.createOscillator();
    engine.type = "sawtooth";
    engine2.type = "triangle";
    engine.frequency.value = 42;
    engine2.frequency.value = 84;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 280;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(engineFilter);
    engine2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(sfx);
    engine.start();
    engine2.start();

    const tire = ctx.createBufferSource();
    tire.buffer = noiseBuf;
    tire.loop = true;
    const tireFilter = ctx.createBiquadFilter();
    tireFilter.type = "bandpass";
    tireFilter.frequency.value = 420;
    tireFilter.Q.value = 1.1;
    const tireGain = ctx.createGain();
    tireGain.gain.value = 0;
    tire.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(sfx);
    tire.start();

    graph = {
      ctx,
      master,
      music,
      sfx,
      engine,
      engine2,
      engineGain,
      engineFilter,
      tire,
      tireGain,
      tireFilter,
      windGain,
    };
  }
  if (graph.ctx.state === "suspended") {
    void graph.ctx.resume();
  }
  unlocked = true;
}

export function resumeAudioIfNeeded() {
  if (graph && graph.ctx.state === "suspended") void graph.ctx.resume();
}

function chirp() {
  if (!graph) return;
  const { ctx, sfx } = graph;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = "sine";
  const base = 1800 + Math.random() * 1400;
  o.frequency.setValueAtTime(base, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(base * (0.6 + Math.random() * 0.5), ctx.currentTime + 0.12);
  f.type = "bandpass";
  f.frequency.value = base;
  f.Q.value = 4;
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
  o.connect(f);
  f.connect(g);
  g.connect(sfx);
  o.start();
  o.stop(ctx.currentTime + 0.18);
  o.onended = () => {
    o.disconnect();
    f.disconnect();
    g.disconnect();
  };
}

export function playCollision(intensity: number) {
  if (!graph || intensity < 0.08) return;
  const { ctx, sfx } = graph;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const n = ctx.createBufferSource();
  n.buffer = makeNoiseBuffer(ctx, 0.2);
  o.type = "triangle";
  o.frequency.value = 70 + intensity * 40;
  g.gain.setValueAtTime(Math.min(0.22, intensity * 0.28), ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  o.connect(g);
  n.connect(g);
  g.connect(sfx);
  o.start();
  n.start();
  o.stop(ctx.currentTime + 0.24);
  n.stop(ctx.currentTime + 0.24);
}

export function updateAudio(dt: number) {
  if (!graph) return;
  const { muted, music, sfx, phase } = useGame.getState();
  const master = muted || phase === "start" ? 0 : 1;
  ramp(graph.master.gain, master * 0.9, graph.ctx, 0.08);
  ramp(graph.music.gain, music * music, graph.ctx);
  ramp(graph.sfx.gain, sfx * sfx, graph.ctx);

  const playing = phase === "playing";
  const spd = Math.abs(vehicle.speed);
  const rpm = 42 + spd * 9.5;
  graph.engine.frequency.setTargetAtTime(rpm, graph.ctx.currentTime, 0.05);
  graph.engine2.frequency.setTargetAtTime(rpm * 2.02, graph.ctx.currentTime, 0.05);
  graph.engineFilter.frequency.setTargetAtTime(220 + spd * 28, graph.ctx.currentTime, 0.08);
  ramp(graph.engineGain.gain, playing ? 0.018 + spd * 0.006 : 0, graph.ctx, 0.06);
  ramp(graph.tireGain.gain, playing && spd > 1.2 ? Math.min(0.07, (spd - 1.2) * 0.006) : 0, graph.ctx, 0.08);
  ramp(graph.windGain.gain, 0.03 + spd * 0.002, graph.ctx, 0.2);

  birdTimer -= dt;
  if (birdTimer <= 0 && playing) {
    birdTimer = 2.8 + Math.random() * 5.5;
    if (Math.random() > 0.35) chirp();
    if (Math.random() > 0.7) setTimeout(chirp, 90 + Math.random() * 180);
  }
}

export function isAudioUnlocked() {
  return unlocked;
}
