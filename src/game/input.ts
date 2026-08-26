export type Actions = {
  throttle: number;
  steer: number;
  brake: number;
  handbrake: boolean;
  pause: boolean;
};

const keys = new Set<string>();
const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
]);

let qaSteer: number | null = null;
let qaThrottle: number | null = null;
let qaKeys: Set<string> | null = null;
let touchSteer = 0;
let touchThrottle = 0;
let touchBrake = 0;
let touchBrakeButton = 0;
let pauseQueued = false;
let attached = false;

function radialDeadzone(x: number, y: number, dz = 0.16) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function onKeyDown(e: KeyboardEvent) {
  if (e.repeat) {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    return;
  }
  keys.add(e.code);
  if (e.code === "Escape") pauseQueued = true;
  if (GAME_CODES.has(e.code)) e.preventDefault();
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code);
}

function onBlur() {
  keys.clear();
}

export function attachInput() {
  if (attached || typeof window === "undefined") return () => undefined;
  attached = true;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onBlur);
    attached = false;
    keys.clear();
  };
}

export function setTouchStick(steer: number, throttle: number, brake: number) {
  touchSteer = Math.max(-1, Math.min(1, steer));
  touchThrottle = Math.max(-1, Math.min(1, throttle));
  touchBrake = Math.max(0, Math.min(1, brake));
}

export function setTouchBrake(brake: number) {
  touchBrakeButton = Math.max(0, Math.min(1, brake));
}

export function setTouchDrive(steer: number, throttle: number, brake: number) {
  setTouchStick(steer, throttle, brake);
}

export function setQaSteer(v: number | null) {
  qaSteer = v;
}

export function setQaThrottle(v: number | null) {
  qaThrottle = v;
}

export function setQaKeys(codes: string[] | null) {
  qaKeys = codes ? new Set(codes) : null;
}

function readGamepad() {
  const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
  if (!pads) return { steer: 0, throttle: 0, brake: 0, handbrake: false };
  for (const pad of pads) {
    if (!pad || pad.mapping !== "standard") continue;
    const stick = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const rt = pad.buttons[7]?.value ?? 0;
    const lt = pad.buttons[6]?.value ?? 0;
    const dpadL = pad.buttons[14]?.pressed ? 1 : 0;
    const dpadR = pad.buttons[15]?.pressed ? 1 : 0;
    const dpadU = pad.buttons[12]?.pressed ? 1 : 0;
    const dpadD = pad.buttons[13]?.pressed ? 1 : 0;
    const steer = Math.max(-1, Math.min(1, -stick.x + dpadL - dpadR));
    const analogThrottle = rt > 0.02 ? rt : Math.max(0, -stick.y) + dpadU;
    const analogBrake = lt > 0.02 ? lt : Math.max(0, stick.y) + dpadD;
    const handbrake = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
    return {
      steer,
      throttle: Math.max(-1, Math.min(1, analogThrottle)),
      brake: Math.max(0, Math.min(1, analogBrake)),
      handbrake,
    };
  }
  return { steer: 0, throttle: 0, brake: 0, handbrake: false };
}

export function sampleActions(): Actions {
  const src = qaKeys ?? keys;
  let steer = 0;
  let throttle = 0;
  let brake = 0;

  if (src.has("KeyA") || src.has("ArrowLeft")) steer += 1;
  if (src.has("KeyD") || src.has("ArrowRight")) steer -= 1;
  if (src.has("KeyW") || src.has("ArrowUp")) throttle += 1;
  if (src.has("KeyS") || src.has("ArrowDown")) throttle -= 1;

  const pad = readGamepad();
  steer += pad.steer;
  throttle += pad.throttle;
  brake += pad.brake;

  steer += touchSteer;
  throttle += touchThrottle;
  brake += touchBrake + touchBrakeButton;

  if (qaSteer != null) steer = qaSteer;
  if (qaThrottle != null) throttle = qaThrottle;

  const pause = pauseQueued;
  pauseQueued = false;

  return {
    throttle: Math.max(-1, Math.min(1, throttle)),
    steer: Math.max(-1, Math.min(1, steer)),
    brake: Math.max(0, Math.min(1, brake)),
    handbrake: src.has("Space") || pad.handbrake,
    pause,
  };
}

export function getPressedCodes() {
  return qaKeys ?? keys;
}
