import { create } from "zustand";

export type Phase = "start" | "playing" | "paused";
export type CamMode = "chase" | "hood";
export type Quality = "high" | "low";

type Persist = {
  muted: boolean;
  music: number;
  sfx: number;
  quality: Quality;
  camMode: CamMode;
};

function loadPersist(): Persist {
  const fallback: Persist = {
    muted: false,
    music: 0.55,
    sfx: 0.7,
    quality: "high",
    camMode: "chase",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem("stillwood-settings-v1");
    if (!raw) {
      const mobile = window.innerWidth < 700 || /Mobi|Android/i.test(navigator.userAgent);
      return { ...fallback, quality: mobile ? "low" : "high" };
    }
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function savePersist(p: Persist) {
  try {
    localStorage.setItem("stillwood-settings-v1", JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const initial = loadPersist();

type GameStore = {
  phase: Phase;
  speed: number;
  yaw: number;
  distance: number;
  muted: boolean;
  music: number;
  sfx: number;
  quality: Quality;
  camMode: CamMode;
  hudHint: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  toggleMute: () => void;
  setMusic: (v: number) => void;
  setSfx: (v: number) => void;
  setQuality: (q: Quality) => void;
  cycleCamera: () => void;
  setTelemetry: (speed: number, yaw: number, distance: number) => void;
  hideHint: () => void;
};

function persistFrom(s: GameStore): Persist {
  return {
    muted: s.muted,
    music: s.music,
    sfx: s.sfx,
    quality: s.quality,
    camMode: s.camMode,
  };
}

export const useGame = create<GameStore>((set, get) => ({
  phase: "start",
  speed: 0,
  yaw: 0,
  distance: 0,
  muted: initial.muted,
  music: initial.music,
  sfx: initial.sfx,
  quality: initial.quality,
  camMode: initial.camMode,
  hudHint: true,
  start: () => set({ phase: "playing", hudHint: true }),
  pause: () => {
    if (get().phase === "playing") set({ phase: "paused" });
  },
  resume: () => {
    if (get().phase === "paused") set({ phase: "playing" });
  },
  toggleMute: () => {
    set({ muted: !get().muted });
    savePersist(persistFrom(get()));
  },
  setMusic: (v) => {
    set({ music: v });
    savePersist(persistFrom(get()));
  },
  setSfx: (v) => {
    set({ sfx: v });
    savePersist(persistFrom(get()));
  },
  setQuality: (q) => {
    set({ quality: q });
    savePersist(persistFrom(get()));
  },
  cycleCamera: () => {
    set({ camMode: get().camMode === "chase" ? "hood" : "chase" });
    savePersist(persistFrom(get()));
  },
  setTelemetry: (speed, yaw, distance) => set({ speed, yaw, distance }),
  hideHint: () => set({ hudHint: false }),
}));
