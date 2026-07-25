/**
 * WaveManager — schedules enemy spawns across escalating waves, with a
 * boss every BOSS_EVERY waves and a final victory wave. Spawns are paced
 * so the arena never floods beyond a max concurrent count.
 */
import * as THREE from 'three';
import { Enemy, BossEnemy, createEnemy } from '@/game/enemies/Enemy';
import { Player } from '@/game/player/Player';
import { AssetFactory } from '@/game/core/AssetFactory';
import { Effects } from '@/game/effects/Effects';
import { AudioManager } from '@/game/audio/AudioManager';
import { WAVE_INTERMISSION, BOSS_EVERY, ARENA_RADIUS } from '@/game/config';
import { randRange, pick } from '@/game/utils';
import type { Hittable } from '@/game/combat/CombatController';

interface SpawnEntry {
  type: 'grunt' | 'stalker' | 'brute';
  delay: number; // sec after wave start
}

export interface WaveComposition {
  wave: number;
  isBossWave: boolean;
  spawns: SpawnEntry[];
  totalEnemies: number;
}

export const TOTAL_WAVES = 12;

export class WaveManager {
  private player: Player;
  private assets: AssetFactory;
  private effects: Effects;
  private audio: AudioManager;
  private scene: THREE.Scene;

  enemies: Enemy[] = [];
  currentWave = 0;
  private spawnQueue: SpawnEntry[] = [];
  private waveTime = 0;
  private intermissionTime = 0;
  private inIntermission = false;
  private bossInstance: BossEnemy | null = null;

  private onWaveStart?: (wave: number, isBoss: boolean) => void;
  private onWaveCleared?: (wave: number) => void;
  private onEnemyKilled?: (e: Hittable) => void;
  private onScore?: (n: number) => void;
  private onCurrency?: (n: number) => void;
  private onVictory?: () => void;
  private onBossSpawn?: (boss: BossEnemy) => void;
  private onBossUpdate?: (boss: BossEnemy | null) => void;

  private maxConcurrent = 8;

  constructor(
    player: Player,
    assets: AssetFactory,
    effects: Effects,
    audio: AudioManager,
    scene: THREE.Scene,
  ) {
    this.player = player;
    this.assets = assets;
    this.effects = effects;
    this.audio = audio;
    this.scene = scene;
  }

  setCallbacks(opts: {
    onWaveStart?: (wave: number, isBoss: boolean) => void;
    onWaveCleared?: (wave: number) => void;
    onEnemyKilled?: (e: Hittable) => void;
    onScore?: (n: number) => void;
    onCurrency?: (n: number) => void;
    onVictory?: () => void;
    onBossSpawn?: (boss: BossEnemy) => void;
    onBossUpdate?: (boss: BossEnemy | null) => void;
  }): void {
    Object.assign(this, opts);
  }

  /** Build the composition for a given wave number. */
  private buildWave(wave: number): WaveComposition {
    const isBossWave = wave % BOSS_EVERY === 0;
    const spawns: SpawnEntry[] = [];
    if (isBossWave) {
      // Boss + adds
      const adds = Math.min(2 + Math.floor(wave / 5), 6);
      for (let i = 0; i < adds; i++) {
        spawns.push({
          type: pick(['grunt', 'stalker', 'brute']) as SpawnEntry['type'],
          delay: 2 + i * 1.5,
        });
      }
      return { wave, isBossWave, spawns, totalEnemies: 1 + adds };
    }
    // Normal wave: scale counts and mix
    const base = 4 + wave * 2;
    const bruteRatio = Math.min(0.18 + wave * 0.03, 0.4);
    const stalkerRatio = Math.min(0.25 + wave * 0.02, 0.45);
    for (let i = 0; i < base; i++) {
      const r = Math.random();
      let type: SpawnEntry['type'] = 'grunt';
      if (r < bruteRatio) type = 'brute';
      else if (r < bruteRatio + stalkerRatio) type = 'stalker';
      spawns.push({ type, delay: i * randRange(0.6, 1.4) });
    }
    return { wave, isBossWave, spawns, totalEnemies: base };
  }

  startNextWave(): void {
    this.currentWave++;
    if (this.currentWave > TOTAL_WAVES) {
      this.onVictory?.();
      return;
    }
    const comp = this.buildWave(this.currentWave);
    this.spawnQueue = [...comp.spawns];
    this.waveTime = 0;
    this.inIntermission = false;
    this.audio.waveStart();
    this.onWaveStart?.(this.currentWave, comp.isBossWave);

    if (comp.isBossWave) {
      // Spawn boss immediately at far edge
      const boss = createEnemy('boss', this.player, this.assets, this.effects, this.audio) as BossEnemy;
      const ang = Math.random() * Math.PI * 2;
      const pos = new THREE.Vector3(
        Math.cos(ang) * (ARENA_RADIUS * 0.7),
        0,
        Math.sin(ang) * (ARENA_RADIUS * 0.7),
      );
      boss.spawn(pos, this.scene);
      this.enemies.push(boss);
      this.bossInstance = boss;
      this.onBossSpawn?.(boss);
    }
  }

  /** Begin the intermission between waves (called when all enemies dead). */
  private beginIntermission(): void {
    this.inIntermission = true;
    this.intermissionTime = WAVE_INTERMISSION;
    this.audio.waveCleared();
    this.onWaveCleared?.(this.currentWave);
  }

  get enemiesRemaining(): number {
    return this.enemies.filter((e) => e.alive).length + this.spawnQueue.length;
  }

  get enemiesTotalThisWave(): number {
    return this.enemies.length + this.spawnQueue.length;
  }

  get isBossWave(): boolean {
    return this.bossInstance !== null && this.bossInstance.alive;
  }

  /** Public read access to the current boss (for HUD), or null. */
  getBoss(): BossEnemy | null {
    return this.bossInstance;
  }

  update(dt: number): void {
    // Process spawn queue
    if (this.spawnQueue.length > 0) {
      this.waveTime += dt;
      const liveCount = this.enemies.filter((e) => e.alive).length;
      for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
        const entry = this.spawnQueue[i];
        if (this.waveTime >= entry.delay && liveCount < this.maxConcurrent) {
          this.spawnQueue.splice(i, 1);
          this.spawnEnemy(entry.type);
        }
      }
    }

    // Update enemies
    for (const e of this.enemies) {
      e.update(dt);
    }

    // Cull fully-dead enemies and report kills
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.isFullyDead) {
        e.dispose(this.scene);
        this.enemies.splice(i, 1);
      }
    }

    // Boss status
    if (this.bossInstance) {
      if (this.bossInstance.alive) {
        this.onBossUpdate?.(this.bossInstance);
      } else {
        // Boss just died — wait for death anim then clear
        this.onBossUpdate?.(null);
        this.bossInstance = null;
      }
    }

    // Wave clear detection
    if (!this.inIntermission && this.spawnQueue.length === 0) {
      const anyAlive = this.enemies.some((e) => e.alive);
      if (!anyAlive) {
        if (this.currentWave >= TOTAL_WAVES) {
          this.onVictory?.();
        } else {
          this.beginIntermission();
        }
      }
    }

    // Intermission countdown
    if (this.inIntermission) {
      this.intermissionTime -= dt;
      if (this.intermissionTime <= 0) {
        this.startNextWave();
      }
    }
  }

  private spawnEnemy(type: 'grunt' | 'stalker' | 'brute'): void {
    const e = createEnemy(type, this.player, this.assets, this.effects, this.audio);
    // Spawn at arena edge, away from player
    let ang = Math.random() * Math.PI * 2;
    const playerAng = Math.atan2(this.player.position.x, this.player.position.z);
    // Avoid spawning right on top of player
    let diff = ang - playerAng;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 0.6) ang = playerAng + (diff >= 0 ? 0.8 : -0.8);
    const r = ARENA_RADIUS * randRange(0.75, 0.92);
    const pos = new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r);
    e.spawn(pos, this.scene);
    this.enemies.push(e);
  }

  /** Get the live enemy list for combat hit detection. */
  getHittables(): Hittable[] {
    return this.enemies.filter((e) => e.alive);
  }

  /** Pause all enemy AI (used when game paused). */
  setPaused(_paused: boolean): void {
    // Handled by Game not calling update(); nothing extra needed.
  }

  reset(): void {
    for (const e of this.enemies) e.dispose(this.scene);
    this.enemies = [];
    this.spawnQueue = [];
    this.currentWave = 0;
    this.waveTime = 0;
    this.intermissionTime = 0;
    this.inIntermission = false;
    this.bossInstance = null;
  }
}
