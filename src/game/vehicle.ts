import { collideTrees, groundHeight, normalAt } from "./world";

export type VehicleState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  speed: number;
  lateral: number;
  steerAngle: number;
  wheelRot: number;
  bodyBounce: number;
  collision: number;
  distance: number;
  grounded: boolean;
};

export const vehicle: VehicleState = {
  x: 0,
  y: 0.2,
  z: 4,
  yaw: 0.35,
  pitch: 0,
  roll: 0,
  speed: 0,
  lateral: 0,
  steerAngle: 0,
  wheelRot: 0,
  bodyBounce: 0,
  collision: 0,
  distance: 0,
  grounded: true,
};

const MAX_SPEED = 16.5;
const MAX_REVERSE = 5.5;
const ACCEL = 9.2;
const BRAKE = 16;
const COAST_DRAG = 0.55;
const ROLLING = 0.35;
const TURN_RATE = 1.35;
const GRIP = 7.2;
const HANDBRAKE_GRIP = 2.1;
const WHEEL_BASE = 2.55;
const TRACK = 1.55;
const RIDE = 0.42;

export type DriveInput = {
  throttle: number;
  steer: number;
  brake: number;
  handbrake: boolean;
};

export function resetVehicle() {
  vehicle.x = 0;
  vehicle.y = 0.2;
  vehicle.z = 4;
  vehicle.yaw = 0.35;
  vehicle.pitch = 0;
  vehicle.roll = 0;
  vehicle.speed = 0;
  vehicle.lateral = 0;
  vehicle.steerAngle = 0;
  vehicle.wheelRot = 0;
  vehicle.bodyBounce = 0;
  vehicle.collision = 0;
  vehicle.distance = 0;
}

export function stepVehicle(dt: number, input: DriveInput) {
  const throttle = Math.max(-1, Math.min(1, input.throttle));
  const steerIn = Math.max(-1, Math.min(1, input.steer));
  const brake = Math.max(0, Math.min(1, input.brake));

  if (throttle > 0.02) {
    vehicle.speed += throttle * ACCEL * dt;
  } else if (throttle < -0.02) {
    vehicle.speed += throttle * BRAKE * 0.55 * dt;
  } else {
    vehicle.speed *= Math.exp(-COAST_DRAG * dt);
  }

  if (brake > 0) {
    const sign = Math.sign(vehicle.speed) || 1;
    vehicle.speed -= sign * brake * BRAKE * dt;
    if (Math.abs(vehicle.speed) < 0.35 && throttle <= 0) vehicle.speed = 0;
  }

  vehicle.speed *= Math.exp(-ROLLING * dt);
  vehicle.speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, vehicle.speed));

  const speedAbs = Math.abs(vehicle.speed);
  const speedFactor = Math.min(1, speedAbs / 4.2);
  const highSpeedTaper = 1 - Math.min(0.45, speedAbs / MAX_SPEED) * 0.55;
  const reverse = vehicle.speed >= 0 ? 1 : -1;

  const targetSteer = steerIn * 0.55;
  vehicle.steerAngle += (targetSteer - vehicle.steerAngle) * (1 - Math.exp(-10 * dt));

  vehicle.yaw +=
    steerIn * TURN_RATE * speedFactor * highSpeedTaper * reverse * dt;

  const grip = input.handbrake ? HANDBRAKE_GRIP : GRIP;
  vehicle.lateral += steerIn * vehicle.speed * 0.22 * dt;
  vehicle.lateral *= Math.exp(-grip * dt);

  const fx = -Math.sin(vehicle.yaw);
  const fz = -Math.cos(vehicle.yaw);
  const rx = Math.cos(vehicle.yaw);
  const rz = -Math.sin(vehicle.yaw);

  let vx = fx * vehicle.speed + rx * vehicle.lateral;
  let vz = fz * vehicle.speed + rz * vehicle.lateral;

  let nx = vehicle.x + vx * dt;
  let nz = vehicle.z + vz * dt;

  const hit = collideTrees(nx, nz, vx, vz);
  nx = hit.x;
  nz = hit.z;
  vx = hit.vx;
  vz = hit.vz;
  if (hit.hit > 0) {
    vehicle.collision = Math.min(1, vehicle.collision + hit.hit);
    vehicle.bodyBounce = Math.min(0.18, vehicle.bodyBounce + hit.hit * 0.12);
  }

  vehicle.speed = vx * fx + vz * fz;
  vehicle.lateral = vx * rx + vz * rz;
  vehicle.x = nx;
  vehicle.z = nz;

  const dist = Math.hypot(vx, vz) * dt;
  vehicle.distance += dist;
  vehicle.wheelRot += (vehicle.speed / 0.42) * dt;
  vehicle.collision = Math.max(0, vehicle.collision - dt * 1.6);
  vehicle.bodyBounce *= Math.exp(-6 * dt);

  const flX = nx + fx * (WHEEL_BASE * 0.5) - rx * (TRACK * 0.5);
  const flZ = nz + fz * (WHEEL_BASE * 0.5) - rz * (TRACK * 0.5);
  const frX = nx + fx * (WHEEL_BASE * 0.5) + rx * (TRACK * 0.5);
  const frZ = nz + fz * (WHEEL_BASE * 0.5) + rz * (TRACK * 0.5);
  const rlX = nx - fx * (WHEEL_BASE * 0.5) - rx * (TRACK * 0.5);
  const rlZ = nz - fz * (WHEEL_BASE * 0.5) - rz * (TRACK * 0.5);
  const rrX = nx - fx * (WHEEL_BASE * 0.5) + rx * (TRACK * 0.5);
  const rrZ = nz - fz * (WHEEL_BASE * 0.5) + rz * (TRACK * 0.5);

  const fl = groundHeight(flX, flZ);
  const fr = groundHeight(frX, frZ);
  const rl = groundHeight(rlX, rlZ);
  const rr = groundHeight(rrX, rrZ);
  const ground = (fl + fr + rl + rr) * 0.25;
  vehicle.y = ground + RIDE + vehicle.bodyBounce;

  const frontH = (fl + fr) * 0.5;
  const rearH = (rl + rr) * 0.5;
  const leftH = (fl + rl) * 0.5;
  const rightH = (fr + rr) * 0.5;
  const targetPitch = Math.atan2(rearH - frontH, WHEEL_BASE);
  const targetRoll =
    Math.atan2(rightH - leftH, TRACK) + vehicle.steerAngle * speedFactor * 0.28;
  vehicle.pitch += (targetPitch - vehicle.pitch) * (1 - Math.exp(-8 * dt));
  vehicle.roll += (targetRoll - vehicle.roll) * (1 - Math.exp(-7 * dt));

  const n = normalAt(nx, nz);
  vehicle.grounded = n.y > 0.55;
}

export function forwardVector() {
  return { x: -Math.sin(vehicle.yaw), z: -Math.cos(vehicle.yaw) };
}
