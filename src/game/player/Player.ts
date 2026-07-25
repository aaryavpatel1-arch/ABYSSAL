/**
 * Player — first-person controller.
 * Handles: mouse look, WASD, sprint, jump, gravity, arena collision,
 * stamina, dodge (i-frames), and view-model bob/sway. Combat decisions
 * (attacks/parry) are issued by CombatController, which reads player state.
 */
import * as THREE from 'three';
import { InputManager } from '@/game/core/InputManager';
import { AssetFactory } from '@/game/core/AssetFactory';
import { Flashlight } from '@/game/player/Flashlight';
import { Weapon } from '@/game/player/Weapon';
import { Effects } from '@/game/effects/Effects';
import {
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  WALK_SPEED,
  SPRINT_SPEED,
  ACCEL,
  FRICTION,
  JUMP_VELOCITY,
  GRAVITY,
  MAX_FALL,
  STAMINA_SPRINT_DRAIN,
  STAMINA_REGEN,
  STAMINA_JUMP_COST,
  STAMINA_REGEN_DELAY,
  STAMINA_DODGE_COST,
  DODGE_SPEED,
  DODGE_DURATION,
  DODGE_COOLDOWN,
  DODGE_I_FRAMES,
  ARENA_RADIUS,
} from '@/game/config';
import { clamp, damp, dampV3 } from '@/game/utils';
import type { WallBox } from '@/game/maze/MazeBuilder';
import type { Settings } from '@/game/types';

export interface PlayerModifiers {
  maxHealth: number;
  maxStamina: number;
  sprintCostMult: number;
  damageMult: number;
  attackSpeedMult: number;
  moveSpeedMult: number;
  healthRegen: number;
  healthRegenDelay: number;
  dodgeCooldownMult: number;
  lifesteal: number; // fraction of damage dealt returned as health
}

export const DEFAULT_MODIFIERS: PlayerModifiers = {
  maxHealth: 100,
  maxStamina: 100,
  sprintCostMult: 1,
  damageMult: 1,
  attackSpeedMult: 1,
  moveSpeedMult: 1,
  healthRegen: 0,
  healthRegenDelay: 6,
  dodgeCooldownMult: 1,
  lifesteal: 0,
};

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly flashlight: Flashlight;
  readonly weapon: Weapon;

  // Position is the camera (eye) position; the body is slightly below.
  position = new THREE.Vector3(0, PLAYER_HEIGHT, 8);
  velocity = new THREE.Vector3(0, 0, 0);
  onGround = true;

  // Look
  yaw = 0;
  pitch = 0;

  // Stats
  health = 100;
  maxHealth = 100;
  stamina = 100;
  maxStamina = 100;

  // Dodge
  dodging = false;
  dodgeJustStarted = false;
  dodgeTime = 0;
  dodgeCooldownTime = 0;
  dodgeDir = new THREE.Vector3();
  invulnerable = false;

  // i-frames from recently taken damage (prevent stunlock chains)
  private hitCooldown = 0;

  // Stamina regen delay
  private staminaDelay = 0;

  // Health regen
  private timeSinceDamage = 0;

  // Bob
  private bobTime = 0;
  bobX = 0;
  bobY = 0;

  // Footstep timer
  private stepTimer = 0;

  modifiers: PlayerModifiers = { ...DEFAULT_MODIFIERS };

  // Collision walls (set per level by Game). When empty, uses arena bounds.
  collisionWalls: WallBox[] = [];
  arenaBoundsRadius = ARENA_RADIUS;

  private input: InputManager;
  private effects: Effects;
  private settings: Settings;
  private tmpForward = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();
  private tmpMove = new THREE.Vector3();
  private eyeTarget = new THREE.Vector3();
  private footstepCb?: (running: boolean) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    assets: AssetFactory,
    effects: Effects,
    settings: Settings,
  ) {
    this.camera = camera;
    this.input = input;
    this.effects = effects;
    this.settings = settings;
    this.flashlight = new Flashlight(camera);
    this.weapon = new Weapon(assets, 'cleaver');
    this.camera.add(this.weapon.view);
    this.applyModifiers();
  }

  setSettings(s: Settings): void {
    this.settings = s;
  }

  setFootstepCallback(cb: (running: boolean) => void): void {
    this.footstepCb = cb;
  }

  applyModifiers(): void {
    this.maxHealth = this.modifiers.maxHealth;
    this.maxStamina = this.modifiers.maxStamina;
    this.health = Math.min(this.health, this.maxHealth);
    this.stamina = Math.min(this.stamina, this.maxStamina);
    this.weapon.damageMult = this.modifiers.damageMult;
    this.weapon.speedMult = this.modifiers.attackSpeedMult;
  }

  /** Reset to a fresh run state (called when a new game starts). */
  reset(): void {
    this.position.set(0, PLAYER_HEIGHT, 8);
    this.velocity.set(0, 0, 0);
    this.yaw = Math.PI;
    this.pitch = 0;
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.modifiers = { ...DEFAULT_MODIFIERS };
    this.applyModifiers();
    this.weapon.switchTo('cleaver');
    this.dodging = false;
    this.dodgeCooldownTime = 0;
  }

  /** Deal damage to the player. Returns true if damage was applied. */
  takeDamage(amount: number): boolean {
    if (this.invulnerable || this.hitCooldown > 0) return false;
    this.health = clamp(this.health - amount, 0, this.maxHealth);
    this.hitCooldown = 0.35;
    this.timeSinceDamage = 0;
    this.effects.addTrauma(Math.min(0.6, 0.2 + amount * 0.006));
    return true;
  }

  heal(amount: number): void {
    this.health = clamp(this.health + amount, 0, this.maxHealth);
  }

  isDead(): boolean {
    return this.health <= 0;
  }

  /** Spend stamina; returns true if enough was available. */
  spendStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaDelay = STAMINA_REGEN_DELAY;
    return true;
  }

  // ---- Dodge --------------------------------------------------------------

  tryDodge(): boolean {
    if (this.dodging || this.dodgeCooldownTime > 0) return false;
    if (!this.spendStamina(STAMINA_DODGE_COST)) return false;
    this.dodging = true;
    this.dodgeJustStarted = true;
    this.dodgeTime = DODGE_DURATION;
    this.invulnerable = true;
    this.dodgeCooldownTime = DODGE_COOLDOWN * this.modifiers.dodgeCooldownMult;
    // Dodge in movement input direction, or forward if none
    this.tmpMove.set(0, 0, 0);
    if (this.input.isDown('KeyW')) this.tmpMove.z -= 1;
    if (this.input.isDown('KeyS')) this.tmpMove.z += 1;
    if (this.input.isDown('KeyA')) this.tmpMove.x -= 1;
    if (this.input.isDown('KeyD')) this.tmpMove.x += 1;
    if (this.tmpMove.lengthSq() === 0) this.tmpMove.set(0, 0, -1);
    this.tmpMove.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.dodgeDir.copy(this.tmpMove);
    return true;
  }

  isInvulnerable(): boolean {
    return this.invulnerable;
  }

  // ---- Per-frame update ---------------------------------------------------

  update(dt: number): void {
    this.updateLook(dt);
    this.updateDodge(dt);
    this.updateMovement(dt);
    this.updateStamina(dt);
    this.updateHealthRegen(dt);
    this.updateFlashlight();
    this.updateViewmodel(dt);

    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    if (this.dodgeCooldownTime > 0) this.dodgeCooldownTime -= dt;
    this.dodgeJustStarted = false;
    if (this.dodgeTime <= 0 && this.dodging) {
      this.dodging = false;
      // invuln ends slightly after dodge movement ends
      this.invulnerable = false;
    }
  }

  private updateLook(dt: number): void {
    const sens = this.settings.sensitivity * 0.0022;
    this.yaw -= this.input.mouseDX * sens;
    const ySign = this.settings.invertY ? 1 : -1;
    this.pitch -= ySign * this.input.mouseDY * sens;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

    // YXZ order: yaw (Y) then pitch (X). Always reset z (roll) to 0 so the
    // menu camera's lookAt() roll doesn't bleed into gameplay.
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private updateDodge(dt: number): void {
    if (!this.dodging) return;
    this.dodgeTime -= dt;
    const t = clamp(1 - this.dodgeTime / DODGE_DURATION, 0, 1);
    // Ease out speed
    const speed = DODGE_SPEED * (1 - t * 0.6);
    this.velocity.x = this.dodgeDir.x * speed;
    this.velocity.z = this.dodgeDir.z * speed;
    // End i-frames slightly before dodge movement fully ends
    if (this.dodgeTime <= DODGE_DURATION - DODGE_I_FRAMES) {
      this.invulnerable = false;
    }
  }

  private updateMovement(dt: number): void {
    const input = this.input;
    const sprinting =
      input.isSprinting() && this.stamina > 0 && input.isDown('KeyW');
    const baseSpeed =
      (sprinting ? SPRINT_SPEED : WALK_SPEED) * this.modifiers.moveSpeedMult;

    // Build input vector in camera space
    this.tmpMove.set(0, 0, 0);
    if (input.isDown('KeyW')) this.tmpMove.z -= 1;
    if (input.isDown('KeyS')) this.tmpMove.z += 1;
    if (input.isDown('KeyA')) this.tmpMove.x -= 1;
    if (input.isDown('KeyD')) this.tmpMove.x += 1;

    const moving = this.tmpMove.lengthSq() > 0 && !this.dodging;
    if (moving) {
      this.tmpMove.normalize();
      this.tmpForward.set(0, 0, -1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.yaw,
      );
      this.tmpRight.set(1, 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        this.yaw,
      );
      const desiredX =
        this.tmpForward.x * -this.tmpMove.z + this.tmpRight.x * this.tmpMove.x;
      const desiredZ =
        this.tmpForward.z * -this.tmpMove.z + this.tmpRight.z * this.tmpMove.x;

      if (this.dodging) {
        // dodge velocity already set; skip accel
      } else {
        this.velocity.x = damp(this.velocity.x, desiredX * baseSpeed, ACCEL, dt);
        this.velocity.z = damp(this.velocity.z, desiredZ * baseSpeed, ACCEL, dt);
      }
    } else if (!this.dodging) {
      // Friction
      this.velocity.x = damp(this.velocity.x, 0, FRICTION, dt);
      this.velocity.z = damp(this.velocity.z, 0, FRICTION, dt);
    }

    // Jump — but skip if a dodge was initiated this frame (Space shared).
    if (input.wasPressed('Space') && this.onGround && !this.dodging && !this.dodgeJustStarted) {
      if (this.spendStamina(STAMINA_JUMP_COST)) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
      }
    }

    // Gravity
    if (!this.onGround) {
      this.velocity.y = Math.max(this.velocity.y - GRAVITY * dt, -MAX_FALL);
    }

    // Integrate
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground collision
    const eyeHeight = PLAYER_HEIGHT;
    if (this.position.y <= eyeHeight) {
      this.position.y = eyeHeight;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Maze wall collision (if walls are set) — otherwise arena bounds
    if (this.collisionWalls.length > 0) {
      this.resolveWalls();
    } else {
      const r = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);
      const maxR = this.arenaBoundsRadius - PLAYER_RADIUS - 0.5;
      if (r > maxR) {
        const nx = this.position.x / r;
        const nz = this.position.z / r;
        this.position.x = nx * maxR;
        this.position.z = nz * maxR;
        this.velocity.x *= 0.5;
        this.velocity.z *= 0.5;
      }
    }

    // Footstep audio
    if (this.onGround && moving) {
      this.stepTimer += dt;
      const interval = sprinting ? 0.3 : 0.45;
      if (this.stepTimer >= interval) {
        this.stepTimer = 0;
        this.footstepCb?.(sprinting);
      }
    } else {
      this.stepTimer = 0.4;
    }

    // Head bob
    if (this.onGround && moving) {
      this.bobTime += dt * (sprinting ? 14 : 9);
      this.bobX = Math.sin(this.bobTime) * (sprinting ? 0.06 : 0.04);
      this.bobY = Math.abs(Math.sin(this.bobTime)) * (sprinting ? 0.05 : 0.035);
    } else {
      this.bobTime += dt * 2;
      this.bobX = damp(this.bobX, 0, 6, dt);
      this.bobY = damp(this.bobY, 0, 6, dt);
    }

    // Apply camera position with bob + shake
    const shake = this.effects.getShakeOffset();
    this.eyeTarget.set(
      this.position.x + this.bobX + shake.x,
      this.position.y + this.bobY + shake.y,
      this.position.z + shake.z,
    );
    dampV3(this.camera.position, this.eyeTarget, 30, dt);
  }

  private updateStamina(dt: number): void {
    if (this.staminaDelay > 0) {
      this.staminaDelay -= dt;
    } else {
      this.stamina = clamp(this.stamina + STAMINA_REGEN * dt, 0, this.maxStamina);
    }
    // Sprint drain
    if (
      this.input.isSprinting() &&
      this.input.isDown('KeyW') &&
      (Math.abs(this.velocity.x) + Math.abs(this.velocity.z) > 1)
    ) {
      this.stamina = clamp(
        this.stamina - STAMINA_SPRINT_DRAIN * this.modifiers.sprintCostMult * dt,
        0,
        this.maxStamina,
      );
      if (this.stamina <= 0) this.staminaDelay = STAMINA_REGEN_DELAY;
    }
  }

  private updateHealthRegen(dt: number): void {
    this.timeSinceDamage += dt;
    if (this.modifiers.healthRegen > 0 && this.timeSinceDamage > this.modifiers.healthRegenDelay) {
      this.heal(this.modifiers.healthRegen * dt);
    }
  }

  private updateFlashlight(): void {
    if (this.input.wasPressed('KeyF')) {
      this.flashlight.toggle();
    }
    this.flashlight.update(this.clocklessDt());
  }

  // Re-use last delta; Game passes it. Simpler: track our own delta via clock.
  private lastTime = performance.now() / 1000;
  private clocklessDt(): number {
    const t = performance.now() / 1000;
    const dt = Math.min(t - this.lastTime, 0.05);
    this.lastTime = t;
    return dt;
  }

  private updateViewmodel(dt: number): void {
    const moving =
      (Math.abs(this.velocity.x) + Math.abs(this.velocity.z) > 1) && this.onGround;
    const sprinting =
      this.input.isSprinting() && this.input.isDown('KeyW') && this.stamina > 0;
    this.weapon.animate(dt, moving, this.bobX, this.bobY, sprinting);
    this.weapon.updateSwing(dt);
  }

  /** Resolve collision against maze walls (circle vs AABB). */
  private resolveWalls(): void {
    for (const w of this.collisionWalls) {
      const cx = Math.max(w.minX, Math.min(this.position.x, w.maxX));
      const cz = Math.max(w.minZ, Math.min(this.position.z, w.maxZ));
      const dx = this.position.x - cx;
      const dz = this.position.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < PLAYER_RADIUS * PLAYER_RADIUS && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = PLAYER_RADIUS - dist;
        this.position.x += (dx / dist) * push;
        this.position.z += (dz / dist) * push;
        this.velocity.x *= 0.6;
        this.velocity.z *= 0.6;
      } else if (distSq <= 0.0001) {
        const toLeft = this.position.x - w.minX;
        const toRight = w.maxX - this.position.x;
        const toTop = this.position.z - w.minZ;
        const toBottom = w.maxZ - this.position.z;
        const minPen = Math.min(toLeft, toRight, toTop, toBottom);
        if (minPen === toLeft) this.position.x = w.minX - PLAYER_RADIUS;
        else if (minPen === toRight) this.position.x = w.maxX + PLAYER_RADIUS;
        else if (minPen === toTop) this.position.z = w.minZ - PLAYER_RADIUS;
        else this.position.z = w.maxZ + PLAYER_RADIUS;
        this.velocity.x *= 0.6;
        this.velocity.z *= 0.6;
      }
    }
  }

  /** Forward direction on XZ plane (for audio listener + enemy facing). */
  getForwardXZ(out: THREE.Vector3): THREE.Vector3 {
    out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    // Forward is -Z when yaw=0 in our convention
    out.multiplyScalar(-1);
    return out;
  }

  dispose(): void {
    this.flashlight.dispose();
    this.weapon.dispose();
  }
}
