/**
 * Weapon — holds damage stats, combo chain definition, and the view-model
 * animation state (swing arc, idle sway, recoil). Multiple weapon tiers
 * can be unlocked via upgrades.
 */
import * as THREE from 'three';
import { AssetFactory } from '@/game/core/AssetFactory';
import { clamp, lerp } from '@/game/utils';

export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  attackDuration: number; // sec per swing
  comboLength: number; // max combo steps before reset
  knockback: number;
  range: number;
  arc: number; // radians of horizontal sweep
  viewAngleOffset: number; // base angle of view model
  /** Which AssetFactory method builds this weapon's view-model. */
  model: 'cleaver' | 'machete' | 'glaive' | 'maul' | 'greatsword' | 'energyblade';
  /** If true, this weapon deflects ranged projectiles during parry. */
  deflectsProjectiles?: boolean;
  /** If true, parry triggers a shockwave AoE slam. */
  parrySlam?: boolean;
}

export const WEAPONS: Record<string, WeaponDef> = {
  cleaver: {
    id: 'cleaver',
    name: 'Rusted Cleaver',
    damage: 22,
    attackDuration: 0.42,
    comboLength: 3,
    knockback: 6,
    range: 2.6,
    arc: Math.PI * 0.8,
    viewAngleOffset: 0,
    model: 'cleaver',
  },
  machete: {
    id: 'machete',
    name: 'Serrated Machete',
    damage: 28,
    attackDuration: 0.4,
    comboLength: 4,
    knockback: 7,
    range: 2.9,
    arc: Math.PI * 0.85,
    viewAngleOffset: 0,
    model: 'machete',
  },
  glaive: {
    id: 'glaive',
    name: 'Abyssal Glaive',
    damage: 34,
    attackDuration: 0.46,
    comboLength: 4,
    knockback: 9,
    range: 3.4,
    arc: Math.PI * 0.9,
    viewAngleOffset: 0,
    model: 'glaive',
  },
  maul: {
    id: 'maul',
    name: 'War Maul',
    damage: 46,
    attackDuration: 0.58,
    comboLength: 2,
    knockback: 16,
    range: 2.7,
    arc: Math.PI * 0.6,
    viewAngleOffset: 0,
    model: 'maul',
  },
  blade: {
    id: 'blade',
    name: 'Tempest Blade',
    damage: 40,
    attackDuration: 0.38,
    comboLength: 5,
    knockback: 8,
    range: 3.0,
    arc: Math.PI * 0.95,
    viewAngleOffset: 0,
    model: 'cleaver',
  },
  greatsword: {
    id: 'greatsword',
    name: 'Abyssal Greatsword',
    damage: 52,
    attackDuration: 0.54,
    comboLength: 3,
    knockback: 14,
    range: 3.4,
    arc: Math.PI * 0.8,
    viewAngleOffset: 0,
    model: 'greatsword',
    parrySlam: true,
  },
  energyblade: {
    id: 'energyblade',
    name: 'Energy Blade',
    damage: 44,
    attackDuration: 0.36,
    comboLength: 4,
    knockback: 9,
    range: 3.1,
    arc: Math.PI * 0.9,
    viewAngleOffset: 0,
    model: 'energyblade',
    deflectsProjectiles: true,
  },
  plasmachain: {
    id: 'plasmachain',
    name: 'Plasma Chainblade',
    damage: 48,
    attackDuration: 0.4,
    comboLength: 4,
    knockback: 10,
    range: 3.3,
    arc: Math.PI * 1.1,
    viewAngleOffset: 0,
    model: 'greatsword',
  },
  voidreaper: {
    id: 'voidreaper',
    name: 'Void Reaper',
    damage: 58,
    attackDuration: 0.44,
    comboLength: 4,
    knockback: 12,
    range: 3.6,
    arc: Math.PI * 0.95,
    viewAngleOffset: 0,
    model: 'glaive',
  },
  leviathan: {
    id: 'leviathan',
    name: 'Leviathan Fang',
    damage: 68,
    attackDuration: 0.42,
    comboLength: 5,
    knockback: 13,
    range: 3.8,
    arc: Math.PI,
    viewAngleOffset: 0,
    model: 'energyblade',
    deflectsProjectiles: true,
    parrySlam: true,
  },
};

export class Weapon {
  def: WeaponDef;
  view: THREE.Group;
  // Hold the sword at lower-right of the view, angled so the blade
  // points forward-up. The model's blade points +Y, handle -Y, so we
  // rotate it to point forward (-Z) and tilt up slightly.
  private basePos = new THREE.Vector3(0.26, -0.34, -0.62);
  private baseRot = new THREE.Euler(-2.35, 0.15, 0.25); // tilt blade forward
  private swayTime = 0;
  private swayAmount = 0;

  // Animation state (0..1 progress of current swing)
  swingProgress = 0; // 0 idle, ramps to 1 during swing
  private swingDir = 1;
  private recoil = 0;

  // Damage multipliers from upgrades
  damageMult = 1;
  speedMult = 1;

  constructor(assets: AssetFactory, defId: string = 'cleaver') {
    this.def = WEAPONS[defId];
    this.assets = assets;
    this.view = this.buildView();
    this.applyBaseTransform();
  }

  private assets: AssetFactory;

  /** Build the view-model group matching the current weapon def. */
  private buildView(): THREE.Group {
    switch (this.def.model) {
      case 'machete':
        return this.assets.createMacheteViewmodel();
      case 'glaive':
        return this.assets.createGlaiveViewmodel();
      case 'maul':
        return this.assets.createWarMaulViewmodel();
      case 'greatsword':
        return this.assets.createGreatswordViewmodel();
      case 'energyblade':
        return this.assets.createEnergyBladeViewmodel();
      case 'cleaver':
      default:
        return this.assets.createCleaverViewmodel();
    }
  }

  switchTo(defId: string): void {
    const newDef = WEAPONS[defId];
    if (!newDef || newDef.id === this.def.id) return;
    const wasParent = this.view.parent;
    wasParent?.remove(this.view);
    this.def = newDef;
    this.view = this.buildView();
    this.applyBaseTransform();
    wasParent?.add(this.view);
  }

  /** Position/orient the view-model based on weapon reach. */
  private applyBaseTransform(): void {
    // Longer weapons sit slightly further out and lower.
    const reachFactor = this.def.range / 2.6;
    this.basePos.set(
      0.26,
      -0.34 - (reachFactor - 1) * 0.12,
      -0.62 - (reachFactor - 1) * 0.18,
    );
    this.view.position.copy(this.basePos);
    this.view.rotation.copy(this.baseRot);
  }

  getDamage(): number {
    return this.def.damage * this.damageMult;
  }

  getAttackDuration(): number {
    return this.def.attackDuration / this.speedMult;
  }

  /** Start a swing. dir alternates for visual variety. */
  startSwing(comboIndex: number): void {
    this.swingDir = comboIndex % 2 === 0 ? 1 : -1;
    this.swingProgress = 0.001;
  }

  /** Advance the swing animation. Returns true while a swing is active. */
  updateSwing(dt: number): boolean {
    if (this.swingProgress <= 0) return false;
    const dur = this.getAttackDuration();
    this.swingProgress += dt / dur;
    if (this.swingProgress >= 1) {
      this.swingProgress = 0;
      this.recoil = 0.4;
    }
    return this.swingProgress > 0;
  }

  /** The active damage window of a swing (middle 60%). */
  isInDamageWindow(): boolean {
    return this.swingProgress > 0.2 && this.swingProgress < 0.65;
  }

  isSwinging(): boolean {
    return this.swingProgress > 0;
  }

  getTipWorldPos(target: THREE.Vector3): void {
    // Blade tip is at local +Y ~0.78 in the model; approximated per-weapon.
    this.view.updateMatrixWorld();
    const tipY = this.def.model === 'glaive' ? 1.7 : this.def.model === 'maul' ? 1.1 : 0.78;
    target.set(0, tipY, 0).applyMatrix4(this.view.matrixWorld);
  }

  /** Per-frame view-model animation: swing arc + idle sway + bob. */
  animate(dt: number, moving: boolean, bobX: number, bobY: number, sprinting: boolean): void {
    this.swayTime += dt;
    this.recoil = Math.max(0, this.recoil - dt * 3);

    // Swing rotation
    let swingRot = 0;
    if (this.swingProgress > 0) {
      const p = this.swingProgress;
      // Wind up then strike: ease in then snap
      if (p < 0.3) {
        swingRot = -lerp(0, 1.4, p / 0.3) * this.swingDir;
      } else if (p < 0.6) {
        swingRot = lerp(-1.4, 1.8, (p - 0.3) / 0.3) * this.swingDir;
      } else {
        const settle = (p - 0.6) / 0.4;
        swingRot = lerp(1.8, 0, settle) * this.swingDir;
      }
    }

    // Idle sway increases when moving
    const targetSway = moving ? (sprinting ? 0.05 : 0.03) : 0.012;
    this.swayAmount = lerp(this.swayAmount, targetSway, dt * 6);
    const sway = Math.sin(this.swayTime * (sprinting ? 11 : 7)) * this.swayAmount;

    this.view.position.set(
      this.basePos.x + sway * 0.4 + bobX * 0.3,
      this.basePos.y + Math.abs(sway) * 0.3 + bobY * 0.4 - this.recoil * 0.05,
      this.basePos.z + this.recoil * 0.1,
    );
    this.view.rotation.set(
      this.baseRot.x - this.recoil * 0.4 + Math.sin(this.swayTime * 5) * this.swayAmount * 0.3,
      this.baseRot.y + swingRot * 0.6,
      this.baseRot.z + swingRot + sway * 0.2,
    );
  }

  setVisibility(v: boolean): void {
    this.view.visible = v;
  }

  dispose(): void {
    this.view.parent?.remove(this.view);
  }
}
