/**
 * LevelManager — top-level dungeon progression.
 *
 * Responsibilities:
 *   - Track current level depth (1..MAX_LEVELS).
 *   - Decide whether a level is a standard maze or a boss arena (every
 *     BOSS_LEVEL_INTERVAL).
 *   - For maze levels: generate the maze, pick enemy count/types scaled
 *     by depth, place the keycard in a dead-end, place the descent
 *     elevator, place collectibles.
 *   - For boss levels: grant the exclusive boss weapon, spawn the boss
 *     and adds.
 *   - Scale enemy health/damage/counts continuously across 50+ levels.
 */
import * as THREE from 'three';
import { MazeGenerator, type MazeData } from '@/game/maze/MazeGenerator';
import { MazeBuilder, type MazeLevel } from '@/game/maze/MazeBuilder';
import { AssetFactory } from '@/game/core/AssetFactory';
import {
  MAZE_BASE_COLS,
  MAZE_BASE_ROWS,
  MAZE_MAX_COLS,
  MAZE_MAX_ROWS,
  MAZE_GROWTH,
  MAX_LEVELS,
  BOSS_LEVEL_INTERVAL,
  BOSS_WEAPONS,
  LEVEL_ENEMY_BASE,
  LEVEL_ENEMY_GROWTH,
  LEVEL_HEALTH_SCALE,
  LEVEL_DAMAGE_SCALE,
} from '@/game/config';
import { clamp } from '@/game/utils';

export type EnemySpawnType = 'crawler' | 'sentry' | 'spitter' | 'grunt' | 'stalker' | 'brute';

export interface MazeLevelSetup {
  level: number;
  isBoss: boolean;
  maze: MazeData | null;
  mazeLevel: MazeLevel | null;
  enemyCount: number;
  enemyTypes: EnemySpawnType[];
  healthScale: number;
  damageScale: number;
  keycardWorld: { x: number; z: number } | null;
  elevatorWorld: { x: number; z: number } | null;
  lootPositions: { x: number; z: number }[];
  bossWeapon: { id: string; name: string; description: string } | null;
}

export class LevelManager {
  private scene: THREE.Scene;
  private assets: AssetFactory;

  currentLevel = 0;
  private currentMazeGroup: THREE.Group | null = null;

  constructor(scene: THREE.Scene, assets: AssetFactory) {
    this.scene = scene;
    this.assets = assets;
  }

  get isAtMaxLevel(): boolean {
    return this.currentLevel >= MAX_LEVELS;
  }

  static isBossLevel(level: number): boolean {
    return level % BOSS_LEVEL_INTERVAL === 0;
  }

  static bossWeaponForLevel(level: number): { id: string; name: string; description: string } | null {
    return BOSS_WEAPONS[level] ?? null;
  }

  /** Clear the previous level geometry from the scene. */
  clearLevel(): void {
    if (this.currentMazeGroup) {
      this.scene.remove(this.currentMazeGroup);
      this.currentMazeGroup.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== (this.assets.groundMat as unknown)) {
          // Don't dispose shared wall/ground geometries; they're reused.
        }
      });
      this.currentMazeGroup = null;
    }
  }

  /**
   * Build the setup for the next level (does not spawn enemies — that's
   * the WaveManager/EnemyManager's job once the setup is applied).
   */
  buildLevel(level: number): MazeLevelSetup {
    this.currentLevel = level;
    const isBoss = LevelManager.isBossLevel(level);
    const healthScale = Math.pow(LEVEL_HEALTH_SCALE, level - 1);
    const damageScale = Math.pow(LEVEL_DAMAGE_SCALE, level - 1);

    if (isBoss) {
      this.clearLevel();
      const bossWeapon = LevelManager.bossWeaponForLevel(level);
      const arena = this.buildBossArena(level);
      this.scene.add(arena);
      this.currentMazeGroup = arena;
      return {
        level,
        isBoss: true,
        maze: null,
        mazeLevel: null,
        enemyCount: 3 + Math.floor(level / 10),
        enemyTypes: ['brute', 'stalker', 'crawler'],
        healthScale,
        damageScale,
        keycardWorld: null,
        elevatorWorld: null,
        lootPositions: [],
        bossWeapon,
      };
    }

    // Standard maze level
    this.clearLevel();
    const cols = Math.min(MAZE_MAX_COLS, MAZE_BASE_COLS + Math.floor(level / MAZE_GROWTH) * 2);
    const rows = Math.min(MAZE_MAX_ROWS, MAZE_BASE_ROWS + Math.floor(level / MAZE_GROWTH) * 2);
    const maze = MazeGenerator.generate(cols, rows);
    const mazeLevel = MazeBuilder.build(maze, this.assets);
    this.scene.add(mazeLevel.group);
    this.currentMazeGroup = mazeLevel.group;

    // Enemy count & type mix scale with level
    const enemyCount = Math.floor(
      LEVEL_ENEMY_BASE + level * LEVEL_ENEMY_GROWTH,
    );
    const types = this.pickEnemyMix(level, enemyCount);

    // Keycard in a dead-end (pick the farthest one)
    const keycardCell = this.pickFarthestDeadEnd(mazeLevel);
    const keycardWorld = keycardCell
      ? MazeGenerator.cellToWorld(keycardCell, mazeLevel.cellSize, mazeLevel.originX, mazeLevel.originZ)
      : null;

    // Elevator near spawn but offset (so player must traverse)
    const elevatorWorld = {
      x: mazeLevel.spawnWorld.x,
      z: mazeLevel.spawnWorld.z,
    };

    // Loot / collectible positions in some dead-ends
    const lootPositions = mazeLevel.deadEndWorlds
      .filter((_, i) => Math.random() < 0.4)
      .slice(0, 5);

    return {
      level,
      isBoss: false,
      maze,
      mazeLevel,
      enemyCount,
      enemyTypes: types,
      healthScale,
      damageScale,
      keycardWorld,
      elevatorWorld,
      lootPositions,
      bossWeapon: null,
    };
  }

  private pickEnemyMix(level: number, count: number): EnemySpawnType[] {
    const types: EnemySpawnType[] = [];
    // Early levels: mostly crawlers (melee), some sentries
    const sentryRatio = clamp(0.1 + level * 0.03, 0.1, 0.4);
    const spitterRatio = clamp(level < 3 ? 0 : 0.1 + (level - 3) * 0.025, 0, 0.3);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (r < sentryRatio) types.push('sentry');
      else if (r < sentryRatio + spitterRatio) types.push('spitter');
      else types.push('crawler');
    }
    return types;
  }

  private pickFarthestDeadEnd(mazeLevel: MazeLevel): { col: number; row: number } | null {
    if (mazeLevel.maze.deadEnds.length === 0) return null;
    let best = mazeLevel.maze.deadEnds[0];
    let bestDist = 0;
    for (const cell of mazeLevel.maze.deadEnds) {
      const w = MazeGenerator.cellToWorld(cell, mazeLevel.cellSize, mazeLevel.originX, mazeLevel.originZ);
      const d = Math.hypot(w.x - mazeLevel.spawnWorld.x, w.z - mazeLevel.spawnWorld.z);
      if (d > bestDist) {
        bestDist = d;
        best = cell;
      }
    }
    return best;
  }

  /** Build a boss arena — a spacious room with pillars. */
  private buildBossArena(level: number): THREE.Group {
    const g = new THREE.Group();
    g.name = 'bossArena';
    const radius = 24 + Math.min(level * 0.3, 10);

    // Floor
    const floorGeo = new THREE.CircleGeometry(radius, 80);
    const floor = new THREE.Mesh(floorGeo, this.assets.groundMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);

    // Outer wall
    const wallGeo = new THREE.CylinderGeometry(radius, radius, 6, 64, 1, true);
    const wall = new THREE.Mesh(wallGeo, this.assets.wallMat);
    wall.position.y = 3;
    wall.receiveShadow = true;
    g.add(wall);

    // Pillars around the edge for cover
    const pillarCount = 8;
    for (let i = 0; i < pillarCount; i++) {
      const ang = (i / pillarCount) * Math.PI * 2;
      const p = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.9, 5, 8),
        this.assets.pillarMat,
      );
      p.position.set(Math.cos(ang) * (radius - 3), 2.5, Math.sin(ang) * (radius - 3));
      p.castShadow = true;
      p.receiveShadow = true;
      g.add(p);
    }

    // Emissive center ring (arena marker)
    const ringGeo = new THREE.RingGeometry(radius * 0.15, radius * 0.2, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xb91c1c,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    return g;
  }

  /** Get collision walls for the current level (for player movement). */
  getCurrentWalls() {
    // Caller accesses mazeLevel.walls directly; exposed via buildLevel result.
    return null;
  }

  reset(): void {
    this.clearLevel();
    this.currentLevel = 0;
  }
}
