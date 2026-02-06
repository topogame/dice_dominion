import { GridCell } from '../../src/types/GameTypes';

const DEFAULT_WIDTH = 18;
const DEFAULT_HEIGHT = 18;

export function createEmptyGrid(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): GridCell[][] {
  const grid: GridCell[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = {
        x,
        y,
        type: 'empty',
        ownerId: null,
        isCastle: false,
      };
    }
  }
  return grid;
}

export function setCell(
  grid: GridCell[][],
  x: number,
  y: number,
  overrides: Partial<GridCell>
): void {
  grid[y][x] = { ...grid[y][x], ...overrides };
}

export function setCastle(
  grid: GridCell[][],
  x: number,
  y: number,
  ownerId: string
): void {
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      setCell(grid, x + dx, y + dy, {
        type: 'castle',
        ownerId,
        isCastle: true,
      });
    }
  }
}

export function setUnit(
  grid: GridCell[][],
  x: number,
  y: number,
  ownerId: string
): void {
  setCell(grid, x, y, { type: 'unit', ownerId });
}
