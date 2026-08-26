import { setQaKeys, setQaSteer, setQaThrottle } from "./input";
import { vehicle } from "./vehicle";
import { useGame } from "./store";

export type ControlsProbe = {
  getYaw: () => number;
  getSpeed: () => number;
  setSteer: (v: number) => void;
  setKeys: (codes: string[]) => void;
  setThrottle?: (v: number) => void;
  start?: () => void;
  getPosition?: () => { x: number; y: number; z: number };
};

declare global {
  interface Window {
    __controlsTest?: ControlsProbe;
  }
}

export function bindControlsTest() {
  if (typeof window === "undefined") return;
  window.__controlsTest = {
    getYaw: () => vehicle.yaw,
    getSpeed: () => vehicle.speed,
    setSteer: (v: number) => setQaSteer(v),
    setKeys: (codes: string[]) => setQaKeys(codes),
    setThrottle: (v: number) => setQaThrottle(v),
    start: () => useGame.getState().start(),
    getPosition: () => ({ x: vehicle.x, y: vehicle.y, z: vehicle.z }),
  };
}
