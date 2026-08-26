import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, Camera, Gauge } from "lucide-react";
import { useGame } from "../store";
import { unlockAudio } from "../audio";
import { setTouchBrake, setTouchStick } from "../input";

export function Overlays() {
  const phase = useGame((s) => s.phase);
  return (
    <>
      {phase === "start" ? <StartScreen /> : null}
      {phase !== "start" ? <HUD /> : null}
      {phase === "paused" ? <PauseMenu /> : null}
      {phase === "playing" ? <TouchControls /> : null}
    </>
  );
}

function StartScreen() {
  const start = useGame((s) => s.start);

  const begin = () => {
    unlockAudio();
    start();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/70 to-bg/15">
      <div className="pointer-events-auto mx-auto w-full max-w-lg px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10">
        <p className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.28em] text-accent">
          A quiet drive
        </p>
        <h1 className="font-display text-5xl font-medium italic leading-tight tracking-tight text-fg sm:text-6xl">
          Stillwood
        </h1>
        <p className="mt-4 max-w-md font-sans text-base leading-relaxed text-muted">
          An endless forest. No map. No hurry. Follow the dirt path, or leave it.
        </p>
        <button
          type="button"
          onClick={begin}
          className="mt-8 inline-flex h-12 min-w-44 items-center justify-center rounded-lg bg-primary px-8 font-sans text-sm font-medium text-primary-fg transition-transform duration-150 ease-out hover:brightness-105 active:scale-[0.98]"
        >
          Begin drive
        </button>
        <p className="mt-5 font-sans text-sm text-subtle">
          WASD or arrows to drive · Space to slide · Esc to pause
        </p>
      </div>
    </div>
  );
}

function HUD() {
  const speed = useGame((s) => s.speed);
  const yaw = useGame((s) => s.yaw);
  const distance = useGame((s) => s.distance);
  const pause = useGame((s) => s.pause);
  const phase = useGame((s) => s.phase);
  const hint = useGame((s) => s.hudHint);
  const kmh = Math.abs(speed) * 3.6;
  const km = distance / 1000;
  const compass = ((-yaw * 180) / Math.PI + 3600) % 360;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div>
          <p className="font-display text-xl italic tracking-tight text-fg/90">Stillwood</p>
          <p className="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-muted">
            {km < 0.05 ? "The meadow" : `${km.toFixed(2)} km wandered`}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <Compass deg={compass} />
          {phase === "playing" ? (
            <button
              type="button"
              onClick={pause}
              aria-label="Pause"
              className="flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 text-fg backdrop-blur-sm"
            >
              <Pause className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 hidden -translate-x-1/2 sm:block">
        <div className="rounded-lg border border-border bg-surface/70 px-5 py-2.5 backdrop-blur-sm">
          <p className="font-sans text-2xl font-medium tabular-nums tracking-tight text-fg">
            {kmh.toFixed(0)}
            <span className="ml-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted">
              km/h
            </span>
          </p>
        </div>
      </div>

      {hint && phase === "playing" ? (
        <div className="absolute bottom-36 left-1/2 hidden w-[min(90%,22rem)] -translate-x-1/2 text-center sm:block">
          <p className="font-sans text-sm text-muted">
            W accelerate · A / D turn · S brake · C camera
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Compass({ deg }: { deg: number }) {
  return (
    <div
      className="relative flex size-11 items-center justify-center rounded-md border border-border bg-surface/80 backdrop-blur-sm"
      aria-label="Compass"
    >
      <span
        className="font-sans text-[10px] font-medium uppercase tracking-wider text-accent"
        style={{ transform: `rotate(${-deg}deg)` }}
      >
        N
      </span>
    </div>
  );
}

function PauseMenu() {
  const resume = useGame((s) => s.resume);
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const music = useGame((s) => s.music);
  const sfx = useGame((s) => s.sfx);
  const setMusic = useGame((s) => s.setMusic);
  const setSfx = useGame((s) => s.setSfx);
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const camMode = useGame((s) => s.camMode);
  const cycleCamera = useGame((s) => s.cycleCamera);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/55 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-panel sm:p-8">
        <p className="font-sans text-xs font-medium uppercase tracking-[0.24em] text-accent">
          Paused
        </p>
        <h2 className="mt-2 font-display text-3xl italic text-fg">Still a while</h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
          The forest keeps. Resume whenever you like.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.16em] text-subtle">
              Ambience
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={music}
              onChange={(e) => setMusic(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
            />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 font-sans text-xs uppercase tracking-[0.16em] text-subtle">
              Engine
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sfx}
              onChange={(e) => setSfx(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 font-sans text-sm text-fg"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {muted ? "Muted" : "Sound on"}
          </button>
          <button
            type="button"
            onClick={cycleCamera}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 font-sans text-sm text-fg"
          >
            <Camera className="size-4" />
            {camMode === "chase" ? "Chase cam" : "Hood cam"}
          </button>
          <button
            type="button"
            onClick={() => setQuality(quality === "high" ? "low" : "high")}
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 font-sans text-sm text-fg"
          >
            <Gauge className="size-4" />
            {quality === "high" ? "High detail" : "Soft detail"}
          </button>
        </div>

        <button
          type="button"
          onClick={resume}
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-sans text-sm font-medium text-primary-fg transition-transform duration-150 active:scale-[0.98]"
        >
          <Play className="size-4" />
          Resume drive
        </button>
      </div>
    </div>
  );
}

function TouchControls() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
    setShow(coarse);
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <Stick />
      <BrakePedal />
    </div>
  );
}

function Stick() {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pid = useRef<number | null>(null);

  const apply = (clientX: number, clientY: number) => {
    const el = pad.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (clientX - cx) / (r.width * 0.42);
    let dy = (clientY - cy) / (r.height * 0.42);
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    setKnob({ x: dx, y: dy });
    setTouchStick(-dx, Math.max(0, -dy), Math.max(0, dy));
  };

  const clear = () => {
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    setTouchStick(0, 0, 0);
  };

  return (
    <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]">
      <div
        ref={pad}
        className="relative size-32 rounded-full border border-border bg-surface/50 backdrop-blur-sm"
        onPointerDown={(e) => {
          pid.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          apply(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pid.current !== e.pointerId) return;
          apply(e.clientX, e.clientY);
        }}
        onPointerUp={clear}
        onPointerCancel={clear}
      >
        <div
          className="absolute left-1/2 top-1/2 size-12 rounded-full bg-primary/90"
          style={{
            transform: `translate(calc(-50% + ${knob.x * 36}px), calc(-50% + ${knob.y * 36}px))`,
          }}
        />
      </div>
    </div>
  );
}

function BrakePedal() {
  return (
    <div className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]">
      <button
        type="button"
        aria-label="Brake"
        className="flex size-20 items-center justify-center rounded-full border border-border bg-surface/50 font-sans text-xs uppercase tracking-[0.18em] text-fg backdrop-blur-sm active:bg-surface"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setTouchBrake(1);
        }}
        onPointerUp={() => setTouchBrake(0)}
        onPointerCancel={() => setTouchBrake(0)}
      >
        Brake
      </button>
    </div>
  );
}

export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-bg px-6 pb-16">
      <p className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.28em] text-accent">
        A quiet drive
      </p>
      <h1 className="font-display text-5xl font-medium italic text-fg">Stillwood</h1>
      <p className="mt-4 max-w-md font-sans text-base text-muted">
        An endless forest. No map. No hurry.
      </p>
    </div>
  );
}
