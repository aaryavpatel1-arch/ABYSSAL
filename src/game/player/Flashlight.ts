/**
 * Flashlight — a SpotLight mounted to the camera with battery drain/regen
 * and a subtle flicker. Toggle with F.
 */
import * as THREE from 'three';
import {
  FLASHLIGHT_INTENSITY,
  FLASHLIGHT_BATTERY_MAX,
  FLASHLIGHT_BATTERY_DRAIN,
  FLASHLIGHT_BATTERY_REGEN,
} from '@/game/config';
import { clamp, randRange } from '@/game/utils';

export class Flashlight {
  readonly light: THREE.SpotLight;
  readonly target: THREE.Object3D;
  on = true;
  battery = FLASHLIGHT_BATTERY_MAX;

  private flickerTime = 0;
  private flickerCooldown = 0;

  constructor(camera: THREE.Camera) {
    this.light = new THREE.SpotLight(
      0xfff2d8,
      FLASHLIGHT_INTENSITY,
      30,
      Math.PI / 6,
      0.45,
      1.2,
    );
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.light.shadow.camera.near = 0.3;
    this.light.shadow.camera.far = 30;
    this.light.shadow.bias = -0.0005;
    this.target = new THREE.Object3D();
    camera.add(this.light);
    camera.add(this.target);
    this.light.position.set(0.15, -0.1, 0);
    this.target.position.set(0.15, -0.1, -1);
    this.light.target = this.target;
  }

  toggle(): void {
    if (this.battery <= 0) return;
    this.on = !this.on;
  }

  get intensity(): number {
    return this.on ? this.light.intensity : 0;
  }

  /** Trigger a brief flicker (e.g. when an enemy gets close). */
  flicker(): void {
    this.flickerCooldown = 0.5;
  }

  update(dt: number): void {
    this.flickerTime += dt;
    if (this.on && this.battery > 0) {
      this.battery = clamp(
        this.battery - FLASHLIGHT_BATTERY_DRAIN * dt,
        0,
        FLASHLIGHT_BATTERY_MAX,
      );
      if (this.battery <= 0) {
        this.on = false;
      }
    } else if (!this.on) {
      this.battery = clamp(
        this.battery + FLASHLIGHT_BATTERY_REGEN * dt,
        0,
        FLASHLIGHT_BATTERY_MAX,
      );
    }

    // Flicker effect
    let base = this.on ? FLASHLIGHT_INTENSITY : 0;
    if (this.flickerCooldown > 0) {
      this.flickerCooldown -= dt;
      if (Math.random() < 0.35) {
        base *= randRange(0.1, 0.7);
      }
    } else {
      // Subtle ambient flicker
      const subtle = Math.sin(this.flickerTime * 18) * 0.04 + Math.sin(this.flickerTime * 7.3) * 0.03;
      base *= 1 + subtle;
    }
    // Fade near battery depletion
    if (this.battery < 20 && this.on) {
      base *= clamp(this.battery / 20, 0.3, 1) * (0.7 + Math.random() * 0.3);
    }
    this.light.intensity = base;
  }

  dispose(): void {
    this.light.parent?.remove(this.light);
    this.target.parent?.remove(this.target);
  }
}
