/**
 * CombatController — orchestrates the player's melee combat:
 *   - Attack input (LMB) with combo chaining
 *   - Parry (RMB) with a timed window
 *   - Dodge (Space-tap / Shift) handled by Player but triggered here
 *   - Hit detection against enemies during a swing's damage window
 *   - Combo counter + score currency callbacks
 *
 * Enemy types implement `getHitSphere()` so hit detection stays generic.
 */
import * as THREE from 'three';
import { Player } from '@/game/player/Player';
import { InputManager } from '@/game/core/InputManager';
import { Effects } from '@/game/effects/Effects';
import { AudioManager } from '@/game/audio/AudioManager';
import { COMBO_WINDOW, PARRY_WINDOW, PARRY_COOLDOWN, PARRY_DAMAGE, STYLE_DECAY, STYLE_HIT_GAIN, STYLE_PARRY_GAIN, STYLE_KILL_GAIN, STYLE_RATINGS, STYLE_THRESHOLDS } from '@/game/config';
import { clamp } from '@/game/utils';

/** Minimal interface combat needs from an enemy. */
export interface Hittable {
  id: number;
  alive: boolean;
  isBoss: boolean;
  position: THREE.Vector3; // body center
  /** Approx hit sphere. */
  getHitSphere(out: { center: THREE.Vector3; radius: number }): void;
  /** Apply damage. Returns true if the hit landed (not already dead). */
  applyDamage(amount: number, knockback: THREE.Vector3, isParry: boolean): boolean;
  /** True if this enemy is currently in an attack windup (parryable). */
  isParryable(): boolean;
  /** Notify the enemy its attack was parried. */
  onParried(): void;
}

export class CombatController {
  private player: Player;
  private input: InputManager;
  private effects: Effects;
  private audio: AudioManager;

  comboCount = 0;
  private comboTimer = 0; // sec remaining before combo resets
  private comboIndex = 0; // which step in the combo chain

  // Parry
  private parryTimer = 0; // active window remaining
  private parryCooldown = 0;
  parryFlashTime = 0; // visual cue for UI

  // Hit tracking so one swing only hits each enemy once
  private swingHitSet = new Set<number>();
  private currentSwingId = 0;

  // Damage flash / hit marker timers for UI
  hitMarkerTime = 0;

  // Style meter
  stylePoints = 0;
  styleRating = ''; // '', 'C', 'B', 'A', 'S', 'ULTRA'
  styleMeter = 0; // 0..1 progress toward next rating
  private onStyleChange?: (rating: string, meter: number) => void;
  private onComboChange?: (count: number) => void;
  private onEnemyKilled?: (e: Hittable) => void;
  private onScore?: (amount: number) => void;
  private onCurrency?: (amount: number) => void;

  private enemies: Hittable[] = [];
  private tmpVec = new THREE.Vector3();
  private tmpSphere = { center: new THREE.Vector3(), radius: 0 };
  private tmpKnockback = new THREE.Vector3();

  constructor(
    player: Player,
    input: InputManager,
    effects: Effects,
    audio: AudioManager,
  ) {
    this.player = player;
    this.input = input;
    this.effects = effects;
    this.audio = audio;
  }

  setEnemies(enemies: Hittable[]): void {
    this.enemies = enemies;
  }

  setCallbacks(opts: {
    onComboChange?: (count: number) => void;
    onEnemyKilled?: (e: Hittable) => void;
    onScore?: (amount: number) => void;
    onCurrency?: (amount: number) => void;
    onStyleChange?: (rating: string, meter: number) => void;
  }): void {
    this.onComboChange = opts.onComboChange;
    this.onEnemyKilled = opts.onEnemyKilled;
    this.onScore = opts.onScore;
    this.onCurrency = opts.onCurrency;
    this.onStyleChange = opts.onStyleChange;
  }

  get comboTimerFraction(): number {
    return clamp(this.comboTimer / COMBO_WINDOW, 0, 1);
  }

  get parryReady(): boolean {
    return this.parryCooldown <= 0;
  }

  get parryCooldownFraction(): number {
    return clamp(this.parryCooldown / PARRY_COOLDOWN, 0, 1);
  }

  get dodgeReady(): boolean {
    return this.player.dodgeCooldownTime <= 0 && this.player.stamina >= 28;
  }

  get dodgeCooldownFraction(): number {
    return clamp(this.player.dodgeCooldownTime / 0.95, 0, 1);
  }

  get parryActive(): boolean {
    return this.parryTimer > 0;
  }

  update(dt: number): void {
    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboIndex = 0;
        this.onComboChange?.(0);
      }
    }

    // Parry timers
    if (this.parryTimer > 0) this.parryTimer -= dt;
    if (this.parryCooldown > 0) this.parryCooldown -= dt;
    if (this.parryFlashTime > 0) this.parryFlashTime -= dt;
    if (this.hitMarkerTime > 0) this.hitMarkerTime -= dt;

    // Style meter decay
    if (this.stylePoints > 0) {
      this.stylePoints = Math.max(0, this.stylePoints - STYLE_DECAY * dt);
      this.updateStyleRating();
    }

    // Inputs
    if (this.input.wasMousePressed(0)) this.tryAttack();
    if (this.input.wasMousePressed(2)) this.tryParry();
    if (this.input.wasPressed('Space')) this.player.tryDodge();

    // Hit detection during swing damage window
    if (this.player.weapon.isSwinging() && this.player.weapon.isInDamageWindow()) {
      this.checkHits();
    }

    // Sword trail
    this.player.weapon.getTipWorldPos(this.tmpVec);
    this.effects.updateTrail(this.player.weapon.isSwinging(), this.tmpVec);
  }

  private tryAttack(): void {
    if (this.player.weapon.isSwinging()) return;
    // Advance combo index
    if (this.comboTimer <= 0) {
      this.comboIndex = 0;
      this.comboCount = 0;
    }
    const def = this.player.weapon.def;
    if (this.comboIndex >= def.comboLength) {
      this.comboIndex = 0;
    }
    this.currentSwingId++;
    this.swingHitSet.clear();
    this.player.weapon.startSwing(this.comboIndex);
    this.audio.swing(this.comboIndex);

    this.comboIndex++;
    this.comboCount++;
    this.comboTimer = COMBO_WINDOW;
    this.onComboChange?.(this.comboCount);
  }

  private tryParry(): void {
    if (this.parryCooldown > 0) return;
    if (!this.player.spendStamina(10)) return;
    this.parryTimer = PARRY_WINDOW;
    this.parryCooldown = PARRY_COOLDOWN;
    this.audio.parry();
    // Check for immediate parry against enemies mid-attack
    this.checkParry();
  }

  private checkHits(): void {
    const weapon = this.player.weapon;
    const damage = weapon.getDamage();
    const range = weapon.def.range;
    const arc = weapon.def.arc;
    const playerPos = this.player.position;
    // Forward is -Z at yaw=0 in our convention, so the facing angle is
    // yaw + PI. An enemy directly in front has dz<0 -> atan2(dx,dz) ~= PI.
    const facing = this.player.yaw + Math.PI;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (this.swingHitSet.has(enemy.id)) continue;
      enemy.getHitSphere(this.tmpSphere);
      const dx = this.tmpSphere.center.x - playerPos.x;
      const dz = this.tmpSphere.center.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range + this.tmpSphere.radius) continue;
      // Angle check: enemy must be within arc of facing direction
      const angToEnemy = Math.atan2(dx, dz);
      let diff = angToEnemy - facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > arc / 2) continue;

      // Hit!
      this.swingHitSet.add(enemy.id);
      this.tmpKnockback
        .set(dx, 0, dz)
        .normalize()
        .multiplyScalar(weapon.def.knockback);
      const killed = enemy.applyDamage(damage, this.tmpKnockback, false);
      this.audio.hit();
      this.effects.bloodBurst(this.tmpSphere.center.clone(), 14);
      this.effects.addTrauma(0.12);
      this.hitMarkerTime = 0.3;
      this.addStyle(STYLE_HIT_GAIN);
      if (this.player.modifiers.lifesteal > 0) {
        this.player.heal(damage * this.player.modifiers.lifesteal);
      }
      this.onScore?.(10 + this.comboCount * 2);
      if (killed) {
        this.addStyle(STYLE_KILL_GAIN);
        this.onEnemyKilled?.(enemy);
        this.onCurrency?.(enemy.isBoss ? 50 : 5 + Math.floor(this.comboCount / 2));
      }
    }
  }

  private checkParry(): void {
    const playerPos = this.player.position;
    const range = this.player.weapon.def.range + 0.6;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (!enemy.isParryable()) continue;
      enemy.getHitSphere(this.tmpSphere);
      const dx = this.tmpSphere.center.x - playerPos.x;
      const dz = this.tmpSphere.center.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > range) continue;
      // Parry successful
      this.tmpKnockback
        .set(dx, 0, dz)
        .normalize()
        .multiplyScalar(12);
      enemy.applyDamage(PARRY_DAMAGE, this.tmpKnockback, true);
      enemy.onParried();
      this.effects.parrySpark(this.tmpSphere.center.clone());
      this.effects.addTrauma(0.3);
      this.parryFlashTime = 0.5;
      this.player.stamina = clamp(this.player.stamina + 25, 0, this.player.maxStamina);
      this.onScore?.(30);
      // Only parry one enemy per press
      break;
    }
  }

  /** Expose hit-marker intensity (1 = fresh, 0 = gone) for the UI. */
  getHitMarker(): number {
    return clamp(this.hitMarkerTime / 0.3, 0, 1);
  }

  getParryFlash(): number {
    return clamp(this.parryFlashTime / 0.5, 0, 1);
  }

  reset(): void {
    this.comboCount = 0;
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.parryTimer = 0;
    this.parryCooldown = 0;
    this.parryFlashTime = 0;
    this.hitMarkerTime = 0;
    this.swingHitSet.clear();
    this.stylePoints = 0;
    this.styleRating = '';
    this.styleMeter = 0;
  }

  private addStyle(points: number): void {
    this.stylePoints += points;
    this.updateStyleRating();
  }

  private updateStyleRating(): void {
    let rating = '';
    let meter = 0;
    for (let i = 0; i < STYLE_RATINGS.length; i++) {
      if (this.stylePoints >= STYLE_THRESHOLDS[i]) {
        rating = STYLE_RATINGS[i];
        const nextThreshold = STYLE_THRESHOLDS[i + 1] ?? STYLE_THRESHOLDS[i] + 60;
        const prevThreshold = i > 0 ? STYLE_THRESHOLDS[i] : 0;
        meter = clamp((this.stylePoints - prevThreshold) / (nextThreshold - prevThreshold), 0, 1);
      } else {
        break;
      }
    }
    if (rating !== this.styleRating || Math.abs(meter - this.styleMeter) > 0.02) {
      this.styleRating = rating;
      this.styleMeter = meter;
      this.onStyleChange?.(rating, meter);
    }
  }
}
