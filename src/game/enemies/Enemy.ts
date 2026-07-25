/**
 * Enemy — base class with a finite-state AI machine:
 *   PATROL -> ALERT -> CHASE -> ATTACK -> STAGGER -> DEAD
 * Subclasses configure stats + behavior via the constructor params and
 * override `animateBody` for unique motion. Combat integration is generic
 * via the Hittable interface (getHitSphere/applyDamage/isParryable/onParried).
 */
import * as THREE from 'three';
import { AssetFactory } from '@/game/core/AssetFactory';
import { Effects } from '@/game/effects/Effects';
import { AudioManager } from '@/game/audio/AudioManager';
import { Player } from '@/game/player/Player';
import { ARENA_RADIUS } from '@/game/config';
import { distXZ, randRange, clamp, pick } from '@/game/utils';
import type { Hittable } from '@/game/combat/CombatController';

export type EnemyState =
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'attack'
  | 'stagger'
  | 'dead';

export interface EnemyConfig {
  type: string;
  name: string;
  maxHealth: number;
  moveSpeed: number;
  attackDamage: number;
  attackRange: number;
  attackWindup: number;
  attackRecovery: number;
  detectRange: number;
  loseRange: number;
  scoreValue: number;
  currencyValue: number;
  isBoss: boolean;
  hitRadius: number;
  bodyHeight: number; // center of hit sphere
}

let NEXT_ID = 1;

export abstract class Enemy implements Hittable {
  id: number;
  config: EnemyConfig;
  body: THREE.Group;
  alive = true;
  isBoss: boolean;
  position = new THREE.Vector3();
  state: EnemyState = 'patrol';
  health: number;
  maxHealth: number;

  // AI timers
  protected patrolTarget = new THREE.Vector3();
  protected stateTimer = 0;
  protected attackTimer = 0; // windup/recovery countdown
  protected growlTimer = randRange(2, 6);

  // Stagger
  protected staggerTime = 0;
  protected knockbackVel = new THREE.Vector3();

  // Anim refs
  protected legL?: THREE.Mesh;
  protected legR?: THREE.Mesh;
  protected armL?: THREE.Mesh;
  protected armR?: THREE.Mesh;
  protected head?: THREE.Mesh;

  protected animTime = randRange(0, 10);
  protected facing = 0;

  // Parry tracking
  protected parryableTimer = 0; // >0 means currently in windup (parryable)
  protected wasParried = false;

  protected player: Player;
  protected assets: AssetFactory;
  protected effects: Effects;
  protected audio: AudioManager;

  constructor(
    config: EnemyConfig,
    body: THREE.Group,
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
  ) {
    this.id = NEXT_ID++;
    this.config = config;
    this.body = body;
    this.player = player;
    this.assets = assets;
    this.effects = effects;
    this.audio = audio;
    this.isBoss = config.isBoss;
    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;

    // Cache limb refs
    this.legL = (body as any).legL as THREE.Mesh | undefined;
    this.legR = (body as any).legR as THREE.Mesh | undefined;
    this.armL = (body as any).armL as THREE.Mesh | undefined;
    this.armR = (body as any).armR as THREE.Mesh | undefined;
    this.head = body.getObjectByName('head') as THREE.Mesh | undefined;

    this.pickPatrolTarget();
  }

  spawn(pos: THREE.Vector3, scene: THREE.Scene): void {
    this.position.copy(pos);
    this.body.position.copy(pos);
    scene.add(this.body);
  }

  protected pickPatrolTarget(): void {
    const ang = Math.random() * Math.PI * 2;
    const r = randRange(2, ARENA_RADIUS * 0.8);
    this.patrolTarget.set(Math.cos(ang) * 0, 0, Math.sin(ang) * 0);
    this.patrolTarget.set(
      this.position.x + Math.cos(ang) * r,
      0,
      this.position.z + Math.sin(ang) * r,
    );
    // Clamp inside arena
    const d = Math.sqrt(this.patrolTarget.x ** 2 + this.patrolTarget.z ** 2);
    if (d > ARENA_RADIUS - 2) {
      this.patrolTarget.multiplyScalar((ARENA_RADIUS - 2) / d);
    }
  }

  // ---- Hittable -----------------------------------------------------------

  getHitSphere(out: { center: THREE.Vector3; radius: number }): void {
    out.center.set(this.position.x, this.position.y + this.config.bodyHeight, this.position.z);
    out.radius = this.config.hitRadius;
  }

  applyDamage(amount: number, knockback: THREE.Vector3, isParry: boolean): boolean {
    if (!this.alive) return false;
    this.health -= amount;
    this.knockbackVel.add(knockback);
    if (!isParry) {
      this.enterStagger(isParry ? 0.6 : 0.35);
    } else {
      this.enterStagger(1.0);
      this.wasParried = true;
    }
    if (this.health <= 0) {
      this.die();
      return true;
    }
    // Aggro on damage
    if (this.state === 'patrol' || this.state === 'alert') {
      this.setState('chase');
    }
    return false;
  }

  isParryable(): boolean {
    return this.parryableTimer > 0 && this.alive;
  }

  onParried(): void {
    // Cancel current attack
    this.attackTimer = 0;
    this.parryableTimer = 0;
    this.setState('stagger');
    this.staggerTime = 1.2;
  }

  protected enterStagger(time: number): void {
    if (this.isBoss && time < 0.8) time = 0.8; // bosses stagger less
    this.setState('stagger');
    this.staggerTime = time;
    this.attackTimer = 0;
    this.parryableTimer = 0;
  }

  protected die(): void {
    this.alive = false;
    this.setState('dead');
    this.effects.deathBurst(
      new THREE.Vector3(this.position.x, this.position.y + this.config.bodyHeight, this.position.z),
      this.isBoss ? 0x440000 : 0x331111,
    );
    this.effects.addBloodDecal(this.position);
    this.audio.enemyDeath(this.position.x, this.position.z);
    if (this.isBoss) this.effects.addTrauma(0.8);
  }

  protected setState(s: EnemyState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTimer = 0;
    if (s === 'attack') {
      this.attackTimer = this.config.attackWindup;
    }
  }

  // ---- Update -------------------------------------------------------------

  update(dt: number): void {
    if (!this.alive) {
      this.updateDeath(dt);
      return;
    }
    this.animTime += dt;
    this.stateTimer += dt;
    this.growlTimer -= dt;
    if (this.growlTimer <= 0) {
      this.growlTimer = randRange(4, 9);
      if (distXZ(this.position, this.player.position) < 22) {
        this.audio.enemyGrowl(this.position.x, this.position.z, this.config.type as 'grunt' | 'stalker' | 'brute');
      }
    }
    if (this.parryableTimer > 0) this.parryableTimer -= dt;

    switch (this.state) {
      case 'patrol':
        this.updatePatrol(dt);
        break;
      case 'alert':
        this.updateAlert(dt);
        break;
      case 'chase':
        this.updateChase(dt);
        break;
      case 'attack':
        this.updateAttack(dt);
        break;
      case 'stagger':
        this.updateStagger(dt);
        break;
    }

    // Apply knockback velocity with friction
    if (this.knockbackVel.lengthSq() > 0.01) {
      this.position.x += this.knockbackVel.x * dt;
      this.position.z += this.knockbackVel.z * dt;
      this.knockbackVel.multiplyScalar(Math.max(0, 1 - dt * 8));
    }

    // Arena clamp
    const r = Math.sqrt(this.position.x ** 2 + this.position.z ** 2);
    const maxR = ARENA_RADIUS - 1.5;
    if (r > maxR) {
      this.position.x = (this.position.x / r) * maxR;
      this.position.z = (this.position.z / r) * maxR;
    }

    // Body transform
    this.body.position.x = this.position.x;
    this.body.position.z = this.position.z;
    // Smooth face
    const targetFacing = Math.atan2(
      this.player.position.x - this.position.x,
      this.player.position.z - this.position.z,
    );
    this.facing = this.lerpAngle(this.facing, targetFacing, dt * 6);
    this.body.rotation.y = this.facing;

    this.animateBody(dt);
  }

  protected lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  protected moveToward(target: THREE.Vector3, speed: number, dt: number): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.01) return;
    const vx = (dx / d) * speed;
    const vz = (dz / d) * speed;
    this.position.x += vx * dt;
    this.position.z += vz * dt;
  }

  protected canSeePlayer(): boolean {
    const d = distXZ(this.position, this.player.position);
    return d < this.config.detectRange;
  }

  protected updatePatrol(dt: number): void {
    this.moveToward(this.patrolTarget, this.config.moveSpeed * 0.4, dt);
    if (distXZ(this.position, this.patrolTarget) < 1.5) {
      this.pickPatrolTarget();
    }
    if (this.canSeePlayer()) {
      this.setState('alert');
      this.stateTimer = 0;
    }
  }

  protected updateAlert(dt: number): void {
    // Turn toward player, pause briefly, then chase
    if (this.stateTimer > 0.6) {
      this.setState('chase');
    }
    if (!this.canSeePlayer() && this.stateTimer > 2) {
      this.setState('patrol');
    }
  }

  protected updateChase(dt: number): void {
    const d = distXZ(this.position, this.player.position);
    this.moveToward(this.player.position, this.config.moveSpeed, dt);
    if (d < this.config.attackRange) {
      this.setState('attack');
    } else if (d > this.config.loseRange) {
      this.setState('alert');
    }
  }

  protected updateAttack(dt: number): void {
    const d = distXZ(this.position, this.player.position);
    this.attackTimer -= dt;
    // Parryable window = first 60% of windup
    if (this.attackTimer > this.config.attackRecovery) {
      this.parryableTimer = Math.max(this.parryableTimer, 0.02);
    }

    if (this.attackTimer <= this.config.attackRecovery && this.attackTimer > 0) {
      // Strike moment — deal damage at the midpoint of recovery
      if (this.attackTimer <= this.config.attackRecovery * 0.5 && !this.wasParried) {
        this.tryDealDamage();
        this.wasParried = true; // ensure single strike
      }
    }

    if (this.attackTimer <= 0) {
      this.wasParried = false;
      if (d < this.config.attackRange) {
        this.setState('attack');
      } else {
        this.setState('chase');
      }
    }
  }

  protected tryDealDamage(): void {
    const d = distXZ(this.position, this.player.position);
    if (d > this.config.attackRange + 0.4) return;
    this.audio.enemyAttack(this.position.x, this.position.z);
    const dmg = this.config.attackDamage;
    const applied = this.player.takeDamage(dmg);
    if (applied) {
      this.audio.playerHurt();
    }
  }

  protected updateStagger(dt: number): void {
    this.staggerTime -= dt;
    if (this.staggerTime <= 0) {
      this.setState('chase');
    }
  }

  protected updateDeath(dt: number): void {
    // Sink and fade out
    this.body.position.y -= dt * 0.6;
    this.body.rotation.z += dt * 1.5;
    this.body.scale.multiplyScalar(Math.max(0.01, 1 - dt * 1.2));
    if (this.body.scale.x < 0.05) {
      // Fully gone — caller will remove
    }
  }

  get isFullyDead(): boolean {
    return !this.alive && this.body.scale.x < 0.05;
  }

  /** Subclasses override to animate limbs. */
  protected animateBody(dt: number): void {
    // Default shamble: swing legs/arms
    const speed =
      this.state === 'chase' ? 8 : this.state === 'patrol' ? 4 : 2;
    const swing = Math.sin(this.animTime * speed) * 0.4;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    if (this.armL && this.state !== 'attack') this.armL.rotation.x = -swing * 0.7;
    if (this.armR && this.state !== 'attack') this.armR.rotation.x = swing * 0.7;

    // Attack lunge animation
    if (this.state === 'attack') {
      const p = clamp(1 - this.attackTimer / this.config.attackWindup, 0, 1);
      const lunge = Math.sin(p * Math.PI) * 1.4;
      if (this.armR) this.armR.rotation.x = -lunge;
      if (this.armL) this.armL.rotation.x = -lunge * 0.6;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.body);
    this.body.traverse((o) => {
      if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
    });
  }
}

// ---- Concrete types -------------------------------------------------------

export class GruntEnemy extends Enemy {
  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
  ) {
    super(
      {
        type: 'grunt',
        name: 'Shambler',
        maxHealth: 50,
        moveSpeed: 2.6,
        attackDamage: 10,
        attackRange: 1.8,
        attackWindup: 0.7,
        attackRecovery: 0.4,
        detectRange: 16,
        loseRange: 30,
        scoreValue: 15,
        currencyValue: 5,
        isBoss: false,
        hitRadius: 0.7,
        bodyHeight: 1.3,
      },
      assets.createGruntBody(),
      player,
      assets,
      effects,
      audio,
    );
  }
}

export class StalkerEnemy extends Enemy {
  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
  ) {
    super(
      {
        type: 'stalker',
        name: 'Stalker',
        maxHealth: 35,
        moveSpeed: 5.2,
        attackDamage: 8,
        attackRange: 1.7,
        attackWindup: 0.4,
        attackRecovery: 0.25,
        detectRange: 22,
        loseRange: 40,
        scoreValue: 20,
        currencyValue: 7,
        isBoss: false,
        hitRadius: 0.55,
        bodyHeight: 1.0,
      },
      assets.createStalkerBody(),
      player,
      assets,
      effects,
      audio,
    );
  }

  protected animateBody(dt: number): void {
    // Quick loping gait
    const speed = this.state === 'chase' ? 14 : 7;
    const swing = Math.sin(this.animTime * speed) * 0.6;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    // Arms always forward
    if (this.armL) this.armL.rotation.x = 1.1 + Math.sin(this.animTime * speed) * 0.2;
    if (this.armR) this.armR.rotation.x = 1.1 - Math.sin(this.animTime * speed) * 0.2;
    // Body bob
    this.body.position.y = Math.abs(Math.sin(this.animTime * speed)) * 0.12;
    if (this.state === 'attack') {
      const p = clamp(1 - this.attackTimer / this.config.attackWindup, 0, 1);
      const lunge = Math.sin(p * Math.PI) * 1.8;
      if (this.armR) this.armR.rotation.x = 1.1 + lunge;
      if (this.armL) this.armL.rotation.x = 1.1 + lunge * 0.5;
    }
  }
}

export class BruteEnemy extends Enemy {
  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
  ) {
    super(
      {
        type: 'brute',
        name: 'Brute',
        maxHealth: 130,
        moveSpeed: 1.9,
        attackDamage: 22,
        attackRange: 2.2,
        attackWindup: 1.0,
        attackRecovery: 0.55,
        detectRange: 14,
        loseRange: 26,
        scoreValue: 40,
        currencyValue: 14,
        isBoss: false,
        hitRadius: 0.95,
        bodyHeight: 1.5,
      },
      assets.createBruteBody(),
      player,
      assets,
      effects,
      audio,
    );
  }

  protected animateBody(dt: number): void {
    const speed = this.state === 'chase' ? 5 : 3;
    const swing = Math.sin(this.animTime * speed) * 0.3;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    if (this.state !== 'attack') {
      if (this.armL) this.armL.rotation.x = -swing * 0.5;
      if (this.armR) this.armR.rotation.x = swing * 0.5;
    }
    if (this.state === 'attack') {
      const p = clamp(1 - this.attackTimer / this.config.attackWindup, 0, 1);
      const slam = Math.sin(p * Math.PI) * 2.0;
      if (this.armR) this.armR.rotation.x = -slam;
      if (this.armL) this.armL.rotation.x = -slam * 0.7;
    }
  }
}

export class BossEnemy extends Enemy {
  private phase = 1;
  private aura?: THREE.Mesh;
  private roarTimer = 4;

  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
  ) {
    super(
      {
        type: 'boss',
        name: 'The Warden',
        maxHealth: 600,
        moveSpeed: 2.4,
        attackDamage: 30,
        attackRange: 2.8,
        attackWindup: 1.1,
        attackRecovery: 0.6,
        detectRange: 60,
        loseRange: 80,
        scoreValue: 300,
        currencyValue: 60,
        isBoss: true,
        hitRadius: 1.2,
        bodyHeight: 2.4,
      },
      assets.createBossBody(),
      player,
      assets,
      effects,
      audio,
    );
    this.aura = this.body.getObjectByName('bossAura') as THREE.Mesh | undefined;
  }

  spawn(pos: THREE.Vector3, scene: THREE.Scene): void {
    super.spawn(pos, scene);
    this.audio.bossRoar(pos.x, pos.z);
    this.effects.addTrauma(0.5);
  }

  protected animateBody(dt: number): void {
    const speed = this.state === 'chase' ? 4 : 2.5;
    const swing = Math.sin(this.animTime * speed) * 0.28;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    if (this.state !== 'attack') {
      if (this.armL) this.armL.rotation.x = -swing * 0.4;
      if (this.armR) this.armR.rotation.x = swing * 0.4;
    }
    if (this.state === 'attack') {
      const p = clamp(1 - this.attackTimer / this.config.attackWindup, 0, 1);
      const slam = Math.sin(p * Math.PI) * 2.2;
      if (this.armR) this.armR.rotation.x = -slam;
      if (this.armL) this.armL.rotation.x = -slam * 0.7;
    }
    // Aura pulse
    if (this.aura) {
      const m = this.aura.material as THREE.MeshBasicMaterial;
      m.opacity = 0.25 + Math.sin(this.animTime * 3) * 0.12;
      this.aura.scale.setScalar(1 + Math.sin(this.animTime * 2) * 0.08);
    }
    // Phase 2 enrage at <50% HP
    if (this.phase === 1 && this.health < this.maxHealth * 0.5) {
      this.phase = 2;
      this.config.moveSpeed = 3.6;
      this.config.attackWindup = 0.8;
      this.audio.bossRoar(this.position.x, this.position.z);
      this.effects.addTrauma(0.6);
    }
    // Periodic roars
    this.roarTimer -= dt;
    if (this.roarTimer <= 0) {
      this.roarTimer = randRange(6, 11);
      if (this.state !== 'dead') this.audio.bossRoar(this.position.x, this.position.z);
    }
  }
}

export function createEnemy(
  type: 'grunt' | 'stalker' | 'brute' | 'boss',
  player: Player,
  assets: AssetFactory,
  effects: Effects,
  audio: AudioManager,
): Enemy {
  switch (type) {
    case 'grunt':
      return new GruntEnemy(player, assets, effects, audio);
    case 'stalker':
      return new StalkerEnemy(player, assets, effects, audio);
    case 'brute':
      return new BruteEnemy(player, assets, effects, audio);
    case 'boss':
      return new BossEnemy(player, assets, effects, audio);
  }
}

// forward references to new maze enemy types defined later in this file
export type EnemySpawnType = 'crawler' | 'sentry' | 'spitter' | 'grunt' | 'stalker' | 'brute';

// ---- Ranged / maze enemy types -------------------------------------------

/** Shared projectile pool manager (energy blasts + acid globs). */
export class ProjectileManager {
  private scene: THREE.Scene;
  private player: Player;
  private effects: Effects;
  private audio: AudioManager;
  private projectiles: Projectile[] = [];
  private blastGeo: THREE.SphereGeometry;
  private poolSize = 40;
  private pool: Projectile[] = [];

  constructor(scene: THREE.Scene, player: Player, effects: Effects, audio: AudioManager) {
    this.scene = scene;
    this.player = player;
    this.effects = effects;
    this.audio = audio;
    this.blastGeo = new THREE.SphereGeometry(0.22, 8, 8);
    for (let i = 0; i < this.poolSize; i++) {
      const mesh = new THREE.Mesh(
        this.blastGeo,
        new THREE.MeshBasicMaterial({ color: 0x44ddff, transparent: true, opacity: 0 }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        vx: 0, vy: 0, vz: 0,
        alive: false,
        damage: 0,
        radius: 0.3,
        life: 0,
        type: 'blast',
        light: this.makeGlow(0x44ddff, mesh.position),
      });
    }
  }

  private makeGlow(color: number, pos: THREE.Vector3): THREE.PointLight {
    const l = new THREE.PointLight(color, 0, 5, 2);
    l.position.copy(pos);
    this.scene.add(l);
    return l;
  }

  /** Fire an energy blast from `from` toward `to`. */
  fireBlast(from: THREE.Vector3, to: THREE.Vector3, damage: number): void {
    const p = this.pool.find((pr) => !pr.alive);
    if (!p) return;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 14;
    p.alive = true;
    p.mesh.visible = true;
    (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x44ddff);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    p.mesh.position.copy(from);
    p.mesh.position.y = 1.3;
    p.vx = (dx / d) * speed;
    p.vy = 0;
    p.vz = (dz / d) * speed;
    p.damage = damage;
    p.radius = 0.3;
    p.life = 4;
    p.type = 'blast';
    p.light.color.setHex(0x44ddff);
    p.light.intensity = 1.5;
    p.light.position.copy(p.mesh.position);
    this.audio.enemyShootBlast(from.x, from.z);
  }

  /** Fire an acid glob that lands at `target` and creates an AoE pool. */
  fireAcid(from: THREE.Vector3, target: THREE.Vector3, damage: number): void {
    const p = this.pool.find((pr) => !pr.alive);
    if (!p) return;
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 9;
    p.alive = true;
    p.mesh.visible = true;
    (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(0x66ff44);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    p.mesh.position.copy(from);
    p.mesh.position.y = 1.5;
    p.vx = (dx / d) * speed;
    p.vy = 4; // arc up
    p.vz = (dz / d) * speed;
    p.damage = damage;
    p.radius = 0.35;
    p.life = 3;
    p.type = 'acid';
    p.light.color.setHex(0x66ff44);
    p.light.intensity = 1.2;
    p.light.position.copy(p.mesh.position);
  }

  private acidPools: AcidPool[] = [];
  private poolGeo: THREE.CircleGeometry = new THREE.CircleGeometry(1.4, 16);

  private spawnAcidPool(x: number, z: number, damage: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x33aa22,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.poolGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.05, z);
    this.scene.add(mesh);
    this.acidPools.push({ mesh, x, z, damage, life: 4, maxLife: 4, mat });
    this.audio.acidSplash(x, z);
    this.effects.sparkBurst(new THREE.Vector3(x, 0.2, z), 0x66ff44, 8);
  }

  update(dt: number): void {
    const pp = this.player.position;
    // Projectiles
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.type === 'acid') p.vy -= 16 * dt; // gravity arc
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.light.position.copy(p.mesh.position);

      if (p.type === 'acid' && p.mesh.position.y <= 0.1) {
        // Land → spawn pool
        this.spawnAcidPool(p.mesh.position.x, p.mesh.position.z, p.damage);
        this.deactivate(p);
        continue;
      }
      // Hit player?
      const d = Math.hypot(p.mesh.position.x - pp.x, p.mesh.position.z - pp.z);
      if (d < 0.6 && p.mesh.position.y > 0.5 && p.mesh.position.y < 2.2) {
        this.player.takeDamage(p.damage);
        this.effects.sparkBurst(p.mesh.position.clone(), 0x44ddff, 10);
        this.deactivate(p);
        continue;
      }
      if (p.life <= 0) this.deactivate(p);
    }

    // Acid pools
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const a = this.acidPools[i];
      a.life -= dt;
      const lf = Math.max(0, a.life / a.maxLife);
      a.mat.opacity = 0.6 * lf;
      a.mesh.scale.setScalar(1 + (1 - lf) * 0.3);
      // Damage player if standing in it
      const d = Math.hypot(a.x - pp.x, a.z - pp.z);
      if (d < 1.4 && Math.random() < dt * 3) {
        this.player.takeDamage(a.damage * 0.3);
      }
      if (a.life <= 0) {
        this.scene.remove(a.mesh);
        a.mat.dispose();
        this.acidPools.splice(i, 1);
      }
    }
  }

  private deactivate(p: Projectile): void {
    p.alive = false;
    p.mesh.visible = false;
    p.light.intensity = 0;
  }

  dispose(): void {
    for (const p of this.pool) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
      this.scene.remove(p.light);
    }
    this.blastGeo.dispose();
    for (const a of this.acidPools) {
      this.scene.remove(a.mesh);
      a.mat.dispose();
    }
    this.poolGeo.dispose();
  }

  reset(): void {
    for (const p of this.pool) this.deactivate(p);
    for (const a of this.acidPools) {
      this.scene.remove(a.mesh);
      a.mat.dispose();
    }
    this.acidPools = [];
  }
}

interface Projectile {
  mesh: THREE.Mesh;
  vx: number; vy: number; vz: number;
  alive: boolean;
  damage: number;
  radius: number;
  life: number;
  type: 'blast' | 'acid';
  light: THREE.PointLight;
}

interface AcidPool {
  mesh: THREE.Mesh;
  x: number; z: number;
  damage: number;
  life: number;
  maxLife: number;
  mat: THREE.MeshBasicMaterial;
}

/** Crawler — fast aggressive melee chaser (maze variant of the stalker). */
export class CrawlerEnemy extends Enemy {
  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
    healthScale = 1,
    damageScale = 1,
  ) {
    super(
      {
        type: 'crawler',
        name: 'Crawler',
        maxHealth: Math.round(40 * healthScale),
        moveSpeed: 5.5,
        attackDamage: Math.round(10 * damageScale),
        attackRange: 1.7,
        attackWindup: 0.35,
        attackRecovery: 0.2,
        detectRange: 24,
        loseRange: 45,
        scoreValue: 18,
        currencyValue: 6,
        isBoss: false,
        hitRadius: 0.55,
        bodyHeight: 0.9,
      },
      assets.createStalkerBody(),
      player,
      assets,
      effects,
      audio,
    );
  }

  protected animateBody(dt: number): void {
    const speed = this.state === 'chase' ? 16 : 8;
    const swing = Math.sin(this.animTime * speed) * 0.7;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    if (this.armL) this.armL.rotation.x = 1.2 + Math.sin(this.animTime * speed) * 0.3;
    if (this.armR) this.armR.rotation.x = 1.2 - Math.sin(this.animTime * speed) * 0.3;
    this.body.position.y = Math.abs(Math.sin(this.animTime * speed)) * 0.15;
    if (this.state === 'attack') {
      const p = clamp(1 - this.attackTimer / this.config.attackWindup, 0, 1);
      const lunge = Math.sin(p * Math.PI) * 2.0;
      if (this.armR) this.armR.rotation.x = 1.2 + lunge;
      if (this.armL) this.armL.rotation.x = 1.2 + lunge * 0.6;
    }
  }
}

/** Ranged Sentry — maintains distance, fires energy blasts via raycast. */
export class SentryEnemy extends Enemy {
  private projectiles: ProjectileManager;
  private shootCooldown = 0;
  private preferredDist = 8;

  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
    projectiles: ProjectileManager,
    healthScale = 1,
    damageScale = 1,
  ) {
    super(
      {
        type: 'sentry',
        name: 'Corrupted Sentry',
        maxHealth: Math.round(55 * healthScale),
        moveSpeed: 2.8,
        attackDamage: Math.round(12 * damageScale),
        attackRange: 18,
        attackWindup: 0.8,
        attackRecovery: 0.5,
        detectRange: 30,
        loseRange: 50,
        scoreValue: 25,
        currencyValue: 9,
        isBoss: false,
        hitRadius: 0.6,
        bodyHeight: 1.4,
      },
      assets.createSentryBody(),
      player,
      assets,
      effects,
      audio,
    );
    this.projectiles = projectiles;
  }

  protected updateChase(dt: number): void {
    const d = distXZ(this.position, this.player.position);
    // Maintain preferred distance — back off if too close, approach if too far
    if (d < this.preferredDist - 1) {
      // Back away
      const dx = this.position.x - this.player.position.x;
      const dz = this.position.z - this.player.position.z;
      const dd = Math.hypot(dx, dz) || 1;
      this.position.x += (dx / dd) * this.config.moveSpeed * dt;
      this.position.z += (dz / dd) * this.config.moveSpeed * dt;
    } else if (d > this.preferredDist + 2) {
      this.moveToward(this.player.position, this.config.moveSpeed, dt);
    } else {
      // Strafe slightly
      const ang = Math.atan2(this.player.position.x - this.position.x, this.player.position.z - this.position.z);
      this.position.x += Math.cos(ang + Math.PI / 2) * this.config.moveSpeed * 0.5 * dt;
      this.position.z += Math.sin(ang + Math.PI / 2) * this.config.moveSpeed * 0.5 * dt;
    }

    // Shooting
    this.shootCooldown -= dt;
    if (d < this.config.attackRange && this.shootCooldown <= 0 && this.canSeePlayer()) {
      this.shootCooldown = 1.5;
      this.projectiles.fireBlast(
        new THREE.Vector3(this.position.x, 1.4, this.position.z),
        this.player.position,
        this.config.attackDamage,
      );
      this.audio.enemyShootBlast(this.position.x, this.position.z);
    }
  }

  protected animateBody(dt: number): void {
    // Hovering bob + eye glow pulse
    this.body.position.y = 1.0 + Math.sin(this.animTime * 3) * 0.1;
    // Arms raised (casting pose)
    if (this.armL) this.armL.rotation.x = -1.3;
    if (this.armR) this.armR.rotation.x = -1.3;
  }
}

/** Acid Spitter — fires delayed AoE pools on the floor. */
export class AcidSpitterEnemy extends Enemy {
  private projectiles: ProjectileManager;
  private spitCooldown = 0;

  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
    projectiles: ProjectileManager,
    healthScale = 1,
    damageScale = 1,
  ) {
    super(
      {
        type: 'spitter',
        name: 'Acid Spitter',
        maxHealth: Math.round(70 * healthScale),
        moveSpeed: 2.2,
        attackDamage: Math.round(14 * damageScale),
        attackRange: 14,
        attackWindup: 1.0,
        attackRecovery: 0.8,
        detectRange: 22,
        loseRange: 38,
        scoreValue: 30,
        currencyValue: 11,
        isBoss: false,
        hitRadius: 0.7,
        bodyHeight: 1.2,
      },
      assets.createSpitterBody(),
      player,
      assets,
      effects,
      audio,
    );
    this.projectiles = projectiles;
  }

  protected updateChase(dt: number): void {
    const d = distXZ(this.position, this.player.position);
    // Keep medium distance
    if (d > 10) {
      this.moveToward(this.player.position, this.config.moveSpeed, dt);
    } else if (d < 5) {
      const dx = this.position.x - this.player.position.x;
      const dz = this.position.z - this.player.position.z;
      const dd = Math.hypot(dx, dz) || 1;
      this.position.x += (dx / dd) * this.config.moveSpeed * 0.7 * dt;
      this.position.z += (dz / dd) * this.config.moveSpeed * 0.7 * dt;
    }
    this.spitCooldown -= dt;
    if (d < this.config.attackRange && this.spitCooldown <= 0 && this.canSeePlayer()) {
      this.spitCooldown = 2.2;
      // Lead the target slightly
      const target = this.player.position.clone().add(
        this.player.velocity.clone().multiplyScalar(0.3),
      );
      this.projectiles.fireAcid(
        new THREE.Vector3(this.position.x, 1.3, this.position.z),
        target,
        this.config.attackDamage,
      );
    }
  }

  protected animateBody(dt: number): void {
    const speed = this.state === 'chase' ? 5 : 3;
    const swing = Math.sin(this.animTime * speed) * 0.35;
    if (this.legL) this.legL.rotation.x = swing;
    if (this.legR) this.legR.rotation.x = -swing;
    this.body.position.y = 0.8 + Math.abs(Math.sin(this.animTime * speed)) * 0.08;
    // Spitting recoil
    if (this.spitCooldown > 1.8) {
      if (this.armR) this.armR.rotation.x = -1.5;
      if (this.armL) this.armL.rotation.x = -1.5;
    }
  }
}

/** Extended enemy factory that includes ranged/maze types + scaling. */
export function createMazeEnemy(
  type: EnemySpawnType,
  player: Player,
  assets: AssetFactory,
  effects: Effects,
  audio: AudioManager,
  projectiles: ProjectileManager,
  healthScale = 1,
  damageScale = 1,
): Enemy {
  switch (type) {
    case 'crawler':
      return new CrawlerEnemy(player, assets, effects, audio, healthScale, damageScale);
    case 'sentry':
      return new SentryEnemy(player, assets, effects, audio, projectiles, healthScale, damageScale);
    case 'spitter':
      return new AcidSpitterEnemy(player, assets, effects, audio, projectiles, healthScale, damageScale);
    case 'grunt':
      return new GruntEnemy(player, assets, effects, audio);
    case 'stalker':
      return new StalkerEnemy(player, assets, effects, audio);
    case 'brute':
      return new BruteEnemy(player, assets, effects, audio);
  }
}
