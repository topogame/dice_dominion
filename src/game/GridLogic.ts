import {
  GridCell,
  PlayerState,
  PlayerColors,
  TerrainColors,
} from '../types/GameTypes';

/**
 * Convert grid coordinates to isometric screen coordinates.
 */
export function gridToIso(
  gridX: number,
  gridY: number,
  tileWidth: number,
  tileHeight: number
): { screenX: number; screenY: number } {
  const screenX = (gridX - gridY) * (tileWidth / 2);
  const screenY = (gridX + gridY) * (tileHeight / 2);
  return { screenX, screenY };
}

/**
 * Get pseudo-random grass color variation based on position.
 */
export function getGrassVariant(x: number, y: number): number {
  const variant = (x * 7 + y * 13) % 4;
  switch (variant) {
    case 0: return TerrainColors.grass.base;
    case 1: return TerrainColors.grass.light;
    case 2: return TerrainColors.grass.dark;
    default: return TerrainColors.grass.base;
  }
}

/**
 * Adjust brightness of a hex color by a factor.
 */
export function adjustBrightness(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * Check if a cell is the top-left anchor of a 2x2 castle.
 */
export function isCastleAnchor(grid: GridCell[][], x: number, y: number): boolean {
  const cell = grid[y][x];
  if (!cell.isCastle) return false;

  const leftCell = x > 0 ? grid[y][x - 1] : null;
  const topCell = y > 0 ? grid[y - 1][x] : null;

  const isLeftEdge = !leftCell || !leftCell.isCastle || leftCell.ownerId !== cell.ownerId;
  const isTopEdge = !topCell || !topCell.isCastle || topCell.ownerId !== cell.ownerId;

  return isLeftEdge && isTopEdge;
}

/**
 * Check if a cell is a valid placement target.
 */
export function isValidPlacement(
  grid: GridCell[][],
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): boolean {
  if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) {
    return false;
  }
  const cell = grid[y][x];
  if (cell.type !== 'empty' && cell.type !== 'bridge' && cell.type !== 'chest') {
    return false;
  }
  return true;
}

/**
 * Calculate all valid placement positions for a player (cells adjacent to owned territory).
 */
export function calculateValidPlacements(
  grid: GridCell[][],
  currentPlayerId: string,
  gridWidth: number,
  gridHeight: number
): Set<string> {
  const validPlacements = new Set<string>();
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      if (cell.ownerId === currentPlayerId) {
        for (const dir of directions) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (isValidPlacement(grid, nx, ny, gridWidth, gridHeight)) {
            validPlacements.add(`${nx},${ny}`);
          }
        }
      }
    }
  }

  return validPlacements;
}

/**
 * Check if a position is within a given distance of any player's castle.
 */
export function isNearCastle(
  players: Record<string, PlayerState>,
  x: number,
  y: number,
  distance: number
): boolean {
  for (const player of Object.values(players)) {
    const castlePos = player.castlePosition;
    for (let cx = 0; cx < 2; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        const dx = Math.abs(x - (castlePos.x + cx));
        const dy = Math.abs(y - (castlePos.y + cy));
        if (dx <= distance && dy <= distance) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Generate terrain features on the grid based on map type.
 */
export function generateTerrain(
  grid: GridCell[][],
  mapType: string,
  gridWidth: number,
  gridHeight: number
): void {
  const centerX = Math.floor(gridWidth / 2);
  const centerY = Math.floor(gridHeight / 2);

  switch (mapType) {
    case 'river':
      for (let y = 0; y < gridHeight; y++) {
        grid[y][centerX - 1].type = 'river';
        grid[y][centerX].type = 'river';
      }
      grid[4][centerX - 1].type = 'bridge';
      grid[4][centerX].type = 'bridge';
      grid[gridHeight - 5][centerX - 1].type = 'bridge';
      grid[gridHeight - 5][centerX].type = 'bridge';
      break;

    case 'mountain':
      for (let i = -2; i <= 2; i++) {
        for (let j = -1; j <= 1; j++) {
          const mx = centerX + i;
          const my = centerY + j;
          if (mx >= 0 && mx < gridWidth && my >= 0 && my < gridHeight) {
            grid[my][mx].type = 'mountain';
          }
        }
      }
      break;

    case 'bridge':
      for (let x = 3; x < gridWidth - 3; x++) {
        grid[centerY][x].type = 'river';
      }
      for (let y = 3; y < gridHeight - 3; y++) {
        grid[y][centerX].type = 'river';
      }
      grid[centerY][centerX].type = 'bridge';
      grid[centerY][5].type = 'bridge';
      grid[centerY][gridWidth - 6].type = 'bridge';
      grid[5][centerX].type = 'bridge';
      grid[gridHeight - 6][centerX].type = 'bridge';
      break;

    case 'flat':
    default:
      break;
  }
}

/**
 * Place a 2x2 castle on the grid.
 */
export function placeCastle(
  grid: GridCell[][],
  x: number,
  y: number,
  playerId: string
): void {
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      grid[y + dy][x + dx].type = 'castle';
      grid[y + dy][x + dx].ownerId = playerId;
      grid[y + dy][x + dx].isCastle = true;
    }
  }
}

/**
 * Get the color for a tile based on its cell state.
 */
export function getTileColor(
  cell: GridCell,
  players: Record<string, PlayerState>
): number {
  switch (cell.type) {
    case 'river':
      return TerrainColors.water.base;
    case 'mountain':
      return TerrainColors.rock.base;
    case 'bridge':
      return TerrainColors.wood.base;
    case 'castle':
    case 'unit':
      if (cell.ownerId) {
        const player = players[cell.ownerId];
        if (player) {
          return PlayerColors[player.color];
        }
      }
      return TerrainColors.grass.base;
    default:
      return getGrassVariant(cell.x, cell.y);
  }
}
