/**
 * MazeBuilder — converts a MazeData grid into 3D geometry: walls, floor,
 * ceiling, and collision boxes. Owns the THREE.Group for a level and
 * provides collision query for the player.
 */
import * as THREE from 'three';
import { MazeGenerator, type MazeData, type Cell } from './MazeGenerator';
import { AssetFactory } from '@/game/core/AssetFactory';
import {
  MAZE_CELL_SIZE,
  MAZE_WALL_HEIGHT,
} from '@/game/config';

export interface WallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MazeLevel {
  group: THREE.Group;
  maze: MazeData;
  walls: WallBox[]; // for collision
  cellSize: number;
  originX: number;
  originZ: number;
  /** World-space center of the spawn cell. */
  spawnWorld: { x: number; z: number };
  /** World-space positions of dead-end cells (for loot / lore). */
  deadEndWorlds: { x: number; z: number }[];
}

export class MazeBuilder {
  static build(maze: MazeData, assets: AssetFactory): MazeLevel {
    const group = new THREE.Group();
    group.name = 'mazeLevel';
    const cellSize = MAZE_CELL_SIZE;
    const halfCell = cellSize / 2;

    // Center the maze around origin
    const originX = -(maze.cols * cellSize) / 2 + halfCell;
    const originZ = -(maze.rows * cellSize) / 2 + halfCell;

    const floorW = maze.cols * cellSize;
    const floorD = maze.rows * cellSize;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(floorW, floorD);
    const floor = new THREE.Mesh(floorGeo, assets.groundMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.name = 'mazeFloor';
    group.add(floor);

    // Ceiling (dark, low) — gives claustrophobic feel
    const ceilGeo = new THREE.PlaneGeometry(floorW, floorD);
    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0e,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = MAZE_WALL_HEIGHT;
    ceiling.name = 'mazeCeiling';
    group.add(ceiling);

    // Walls — merge into the group; use individual boxes for collision.
    const walls: WallBox[] = [];
    const wallGeoBase = new THREE.BoxGeometry(cellSize, MAZE_WALL_HEIGHT, cellSize);

    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        if (!maze.grid[r][c]) continue; // open cell
        // Skip walls with no open neighbor (interior solid blocks) to
        // reduce draw calls — they're hidden inside walls anyway.
        if (!this.hasOpenNeighbor(maze, c, r)) continue;

        const { x, z } = MazeGenerator.cellToWorld({ col: c, row: r }, cellSize, originX, originZ);
        const wall = new THREE.Mesh(wallGeoBase, assets.wallMat);
        wall.position.set(x, MAZE_WALL_HEIGHT / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);

        walls.push({
          minX: x - halfCell,
          maxX: x + halfCell,
          minZ: z - halfCell,
          maxZ: z + halfCell,
        });
      }
    }

    // Spawn world position
    const spawnWorld = MazeGenerator.cellToWorld(maze.spawn, cellSize, originX, originZ);

    // Dead-end world positions
    const deadEndWorlds = maze.deadEnds.map((c) =>
      MazeGenerator.cellToWorld(c, cellSize, originX, originZ),
    );

    return {
      group,
      maze,
      walls,
      cellSize,
      originX,
      originZ,
      spawnWorld,
      deadEndWorlds,
    };
  }

  private static hasOpenNeighbor(maze: MazeData, c: number, r: number): boolean {
    const checks = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dc, dr] of checks) {
      const nc = c + dc;
      const nr = r + dr;
      if (nr >= 0 && nr < maze.rows && nc >= 0 && nc < maze.cols && !maze.grid[nr][nc]) {
        return true;
      }
    }
    return false;
  }

  /** Circle-vs-AABB collision resolution: push pos out of overlapping walls. */
  static resolveCollision(
    pos: THREE.Vector3,
    radius: number,
    walls: WallBox[],
  ): void {
    for (const w of walls) {
      // Closest point on AABB to the player center
      const cx = Math.max(w.minX, Math.min(pos.x, w.maxX));
      const cz = Math.max(w.minZ, Math.min(pos.z, w.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else if (distSq <= 0.0001) {
        // Player center is inside the wall — push out along nearest edge
        const toLeft = pos.x - w.minX;
        const toRight = w.maxX - pos.x;
        const toTop = pos.z - w.minZ;
        const toBottom = w.maxZ - pos.z;
        const minPen = Math.min(toLeft, toRight, toTop, toBottom);
        if (minPen === toLeft) pos.x = w.minX - radius;
        else if (minPen === toRight) pos.x = w.maxX + radius;
        else if (minPen === toTop) pos.z = w.minZ - radius;
        else pos.z = w.maxZ + radius;
      }
    }
  }

  /** Is the given world position inside a wall cell? */
  static isInsideWall(x: number, z: number, level: MazeLevel): boolean {
    for (const w of level.walls) {
      if (x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ) return true;
    }
    return false;
  }

  /** Find a random open cell far from the given world position. */
  static farOpenCell(level: MazeLevel, awayFrom: { x: number; z: number }, minDist = 15): { x: number; z: number } | null {
    const candidates = level.maze.openCells
      .map((c) => {
        const w = MazeGenerator.cellToWorld(c, level.cellSize, level.originX, level.originZ);
        const d = Math.hypot(w.x - awayFrom.x, w.z - awayFrom.z);
        return { ...w, dist: d };
      })
      .filter((c) => c.dist > minDist);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
