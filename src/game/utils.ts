/**
 * Small math helpers used throughout the engine.
 */
import * as THREE from 'three';

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  THREE.MathUtils.damp(a, b, lambda, dt);

export const dampV3 = (
  v: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  dt: number,
): void => {
  v.x = THREE.MathUtils.damp(v.x, target.x, lambda, dt);
  v.y = THREE.MathUtils.damp(v.y, target.y, lambda, dt);
  v.z = THREE.MathUtils.damp(v.z, target.z, lambda, dt);
};

export const dampQ = (
  q: THREE.Quaternion,
  target: THREE.Quaternion,
  lambda: number,
  dt: number,
): void => {
  q.slerp(target, 1 - Math.exp(-lambda * dt));
};

/** Frame-rate independent exponential approach toward 0. */
export const dampToZero = (v: number, lambda: number, dt: number): number =>
  THREE.MathUtils.damp(v, 0, lambda, dt);

export const randRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(min + Math.random() * (max - min + 1));

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Horizontal distance (ignores Y). */
export const distXZ = (a: THREE.Vector3, b: THREE.Vector3): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const angleBetweenXZ = (
  from: THREE.Vector3,
  to: THREE.Vector3,
): number => {
  return Math.atan2(to.x - from.x, to.z - from.z);
};

export const now = (): number => performance.now() / 1000;
