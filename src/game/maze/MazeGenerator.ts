/**
 * MazeGenerator — recursive-backtracking grid maze.
 * Produces a 2D boolean grid (true = wall, false = open) plus a list of
 * dead-end cells and a spawn cell. Used by MazeBuilder to construct 3D
 * geometry and by LevelManager for loot placement.
 */

export interface MazeData {
  cols: number;
  rows: number;
  /** true = wall, false = open corridor */
  grid: boolean[][];
  deadEnds: Cell[];
  spawn: Cell;
  /** Cells guaranteed reachable from spawn (all open cells are). */
  openCells: Cell[];
}

export interface Cell {
  col: number;
  row: number;
}

export class MazeGenerator {
  /**
   * Generate a maze of the given size (must be odd for standard RB).
   * Starts filled with walls, carves corridors via iterative recursive
   * backtracking, then adds a few extra loops to reduce dead-ends.
   */
  static generate(cols: number, rows: number, extraLoops = 0.15): MazeData {
    // Ensure odd dimensions
    if (cols % 2 === 0) cols++;
    if (rows % 2 === 0) rows++;

    const grid: boolean[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => true),
    );

    const stack: Cell[] = [];
    const start: Cell = { col: 1, row: 1 };
    grid[start.row][start.col] = false;
    stack.push(start);

    const dirs = [
      { dc: 0, dr: -2 },
      { dc: 0, dr: 2 },
      { dc: -2, dr: 0 },
      { dc: 2, dr: 0 },
    ];

    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors: Cell[] = [];
      for (const d of dirs) {
        const nc = current.col + d.dc;
        const nr = current.row + d.dr;
        if (nc > 0 && nc < cols - 1 && nr > 0 && nr < rows - 1 && grid[nr][nc]) {
          neighbors.push({ col: nc, row: nr });
        }
      }
      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        // Knock down wall between current and next
        const wallCol = (current.col + next.col) / 2;
        const wallRow = (current.row + next.row) / 2;
        grid[wallRow][wallCol] = false;
        grid[next.row][next.col] = false;
        stack.push(next);
      } else {
        stack.pop();
      }
    }

    // Add extra loops: randomly knock down some interior walls to create
    // cycles, so the maze is less of a pure tree (more interesting).
    const loopCount = Math.floor(((cols - 1) * (rows - 1)) * 0.04 * extraLoops * 5);
    for (let i = 0; i < loopCount; i++) {
      const c = 1 + 2 * Math.floor(Math.random() * Math.floor((cols - 2) / 2));
      const r = 1 + 2 * Math.floor(Math.random() * Math.floor((rows - 2) / 2));
      // Knock down a random adjacent wall
      const dir = Math.floor(Math.random() * 4);
      const dc = [0, 0, -1, 1][dir];
      const dr = [-1, 1, 0, 0][dir];
      const wc = c + dc;
      const wr = r + dr;
      if (wc > 0 && wc < cols - 1 && wr > 0 && wr < rows - 1) {
        grid[wr][wc] = false;
      }
    }

    // Collect dead-ends (open cells with exactly 1 open neighbor)
    const deadEnds: Cell[] = [];
    const openCells: Cell[] = [];
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (!grid[r][c]) {
          openCells.push({ col: c, row: r });
          let openNeighbors = 0;
          if (!grid[r - 1][c]) openNeighbors++;
          if (!grid[r + 1][c]) openNeighbors++;
          if (!grid[r][c - 1]) openNeighbors++;
          if (!grid[r][c + 1]) openNeighbors++;
          if (openNeighbors === 1) {
            deadEnds.push({ col: c, row: r });
          }
        }
      }
    }

    return {
      cols,
      rows,
      grid,
      deadEnds,
      spawn: start,
      openCells,
    };
  }

  /** Convert maze cell coords to world XZ center. */
  static cellToWorld(cell: Cell, cellSize: number, originX: number, originZ: number): { x: number; z: number } {
    return {
      x: originX + cell.col * cellSize,
      z: originZ + cell.row * cellSize,
    };
  }
}
