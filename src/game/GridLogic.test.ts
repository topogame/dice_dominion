import { describe, it, expect } from 'vitest';
import {
  gridToIso,
  getGrassVariant,
  adjustBrightness,
  isCastleAnchor,
  isValidPlacement,
  calculateValidPlacements,
  isNearCastle,
  generateTerrain,
  placeCastle,
  getTileColor,
} from './GridLogic';
import { TerrainColors, PlayerColors } from '../types/GameTypes';
import { createEmptyGrid, setCastle, setUnit, setCell } from '../../tests/helpers/GridBuilder';
import { GameStateBuilder } from '../../tests/helpers/GameStateBuilder';

// ─── gridToIso ───────────────────────────────────────────────

describe('gridToIso', () => {
  const TW = 60;
  const TH = 18;

  it('should convert (0,0) to (0,0)', () => {
    const { screenX, screenY } = gridToIso(0, 0, TW, TH);
    expect(screenX).toBe(0);
    expect(screenY).toBe(0);
  });

  it('should convert (1,0) to (tileWidth/2, tileHeight/2)', () => {
    const { screenX, screenY } = gridToIso(1, 0, TW, TH);
    expect(screenX).toBe(TW / 2);
    expect(screenY).toBe(TH / 2);
  });

  it('should convert (0,1) to (-tileWidth/2, tileHeight/2)', () => {
    const { screenX, screenY } = gridToIso(0, 1, TW, TH);
    expect(screenX).toBe(-TW / 2);
    expect(screenY).toBe(TH / 2);
  });

  it('should convert diagonal (5,5) to screenX=0', () => {
    const { screenX, screenY } = gridToIso(5, 5, TW, TH);
    expect(screenX).toBe(0);
    expect(screenY).toBe(5 * TH);
  });

  it('should handle large grid coordinates (17,17)', () => {
    const { screenX, screenY } = gridToIso(17, 17, TW, TH);
    expect(screenX).toBe(0);
    expect(screenY).toBe(17 * TH);
  });

  it('should return negative screenX when gridY > gridX', () => {
    const { screenX } = gridToIso(2, 5, TW, TH);
    expect(screenX).toBeLessThan(0);
  });
});

// ─── getGrassVariant ─────────────────────────────────────────

describe('getGrassVariant', () => {
  it('should return base grass for (0,0)', () => {
    // (0*7 + 0*13) % 4 = 0
    expect(getGrassVariant(0, 0)).toBe(TerrainColors.grass.base);
  });

  it('should return light grass for variant 1', () => {
    // Find x,y where (x*7 + y*13) % 4 = 1
    // (1*7 + 0*13) % 4 = 3 → not 1
    // (0*7 + 1*13) % 4 = 1 ✓
    expect(getGrassVariant(0, 1)).toBe(TerrainColors.grass.light);
  });

  it('should return dark grass for variant 2', () => {
    // (0*7 + 2*13) % 4 = 26 % 4 = 2 ✓
    expect(getGrassVariant(0, 2)).toBe(TerrainColors.grass.dark);
  });

  it('should return base grass for variant 3 (default case)', () => {
    // (1*7 + 0*13) % 4 = 3 → default → base
    expect(getGrassVariant(1, 0)).toBe(TerrainColors.grass.base);
  });

  it('should be deterministic for same inputs', () => {
    expect(getGrassVariant(5, 7)).toBe(getGrassVariant(5, 7));
  });
});

// ─── adjustBrightness ────────────────────────────────────────

describe('adjustBrightness', () => {
  it('should return black for factor 0', () => {
    expect(adjustBrightness(0xffffff, 0)).toBe(0x000000);
  });

  it('should return same color for factor 1.0', () => {
    expect(adjustBrightness(0x4488ff, 1.0)).toBe(0x4488ff);
  });

  it('should darken with factor 0.5', () => {
    // 0xFF0000 → r=255*0.5=127 → 0x7F0000
    expect(adjustBrightness(0xff0000, 0.5)).toBe(0x7f0000);
  });

  it('should handle pure green', () => {
    expect(adjustBrightness(0x00ff00, 0.5)).toBe(0x007f00);
  });

  it('should handle pure blue', () => {
    expect(adjustBrightness(0x0000ff, 0.5)).toBe(0x00007f);
  });

  it('should clamp channels to 255 when brightening', () => {
    const result = adjustBrightness(0xff0000, 2.0);
    const r = (result >> 16) & 0xff;
    expect(r).toBe(255);
  });

  it('should brighten with factor 1.5', () => {
    // 0x808080 → r=128*1.5=192=0xC0
    const result = adjustBrightness(0x808080, 1.5);
    const r = (result >> 16) & 0xff;
    const g = (result >> 8) & 0xff;
    const b = result & 0xff;
    expect(r).toBe(192);
    expect(g).toBe(192);
    expect(b).toBe(192);
  });
});

// ─── isCastleAnchor ──────────────────────────────────────────

describe('isCastleAnchor', () => {
  it('should return true for top-left cell of castle', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    expect(isCastleAnchor(grid, 5, 5)).toBe(true);
  });

  it('should return false for top-right cell of castle', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    expect(isCastleAnchor(grid, 6, 5)).toBe(false);
  });

  it('should return false for bottom-left cell of castle', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    expect(isCastleAnchor(grid, 5, 6)).toBe(false);
  });

  it('should return false for bottom-right cell of castle', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    expect(isCastleAnchor(grid, 6, 6)).toBe(false);
  });

  it('should return false for non-castle cell', () => {
    const grid = createEmptyGrid();
    expect(isCastleAnchor(grid, 5, 5)).toBe(false);
  });

  it('should return true when castle is at grid corner (0,0)', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 0, 0, 'p1');
    expect(isCastleAnchor(grid, 0, 0)).toBe(true);
  });

  it('should distinguish adjacent castles from different players', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 3, 3, 'p1');
    setCastle(grid, 5, 3, 'p2');
    expect(isCastleAnchor(grid, 3, 3)).toBe(true);
    expect(isCastleAnchor(grid, 5, 3)).toBe(true);
  });
});

// ─── isValidPlacement ────────────────────────────────────────

describe('isValidPlacement', () => {
  const W = 18, H = 18;

  it('should return false for x < 0', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, -1, 0, W, H)).toBe(false);
  });

  it('should return false for y < 0', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, 0, -1, W, H)).toBe(false);
  });

  it('should return false for x >= gridWidth', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, W, 0, W, H)).toBe(false);
  });

  it('should return false for y >= gridHeight', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, 0, H, W, H)).toBe(false);
  });

  it('should return true for empty cell', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(true);
  });

  it('should return true for bridge cell', () => {
    const grid = createEmptyGrid();
    setCell(grid, 5, 5, { type: 'bridge' });
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(true);
  });

  it('should return true for chest cell', () => {
    const grid = createEmptyGrid();
    setCell(grid, 5, 5, { type: 'chest' });
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(true);
  });

  it('should return false for river cell', () => {
    const grid = createEmptyGrid();
    setCell(grid, 5, 5, { type: 'river' });
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(false);
  });

  it('should return false for mountain cell', () => {
    const grid = createEmptyGrid();
    setCell(grid, 5, 5, { type: 'mountain' });
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(false);
  });

  it('should return false for unit cell', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(false);
  });

  it('should return false for castle cell', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    expect(isValidPlacement(grid, 5, 5, W, H)).toBe(false);
  });

  it('should return true for boundary cells (0 and max-1)', () => {
    const grid = createEmptyGrid();
    expect(isValidPlacement(grid, 0, 0, W, H)).toBe(true);
    expect(isValidPlacement(grid, W - 1, H - 1, W, H)).toBe(true);
  });
});

// ─── calculateValidPlacements ────────────────────────────────

describe('calculateValidPlacements', () => {
  const W = 18, H = 18;

  it('should return empty set when player owns no cells', () => {
    const grid = createEmptyGrid();
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.size).toBe(0);
  });

  it('should return 4 neighbors for a single owned unit in center', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 9, 9, 'p1');
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('9,8')).toBe(true);   // up
    expect(result.has('9,10')).toBe(true);  // down
    expect(result.has('8,9')).toBe(true);   // left
    expect(result.has('10,9')).toBe(true);  // right
    expect(result.size).toBe(4);
  });

  it('should not include out-of-bounds neighbors', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 0, 0, 'p1');
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('1,0')).toBe(true);
    expect(result.has('0,1')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('should not include river cells', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setCell(grid, 6, 5, { type: 'river' });
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('6,5')).toBe(false);
  });

  it('should not include mountain cells', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setCell(grid, 4, 5, { type: 'mountain' });
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('4,5')).toBe(false);
  });

  it('should not include other unit cells', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 6, 5, 'p2');
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('6,5')).toBe(false);
  });

  it('should include bridge cells', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setCell(grid, 6, 5, { type: 'bridge' });
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('6,5')).toBe(true);
  });

  it('should include chest cells', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setCell(grid, 5, 4, { type: 'chest' });
    const result = calculateValidPlacements(grid, 'p1', W, H);
    expect(result.has('5,4')).toBe(true);
  });

  it('should include neighbors of castle cells', () => {
    const grid = createEmptyGrid();
    setCastle(grid, 5, 5, 'p1');
    const result = calculateValidPlacements(grid, 'p1', W, H);
    // Castle is 2x2 at (5,5)(6,5)(5,6)(6,6)
    // Adjacent empty cells around the perimeter
    expect(result.has('4,5')).toBe(true);
    expect(result.has('7,5')).toBe(true);
    expect(result.has('5,4')).toBe(true);
    expect(result.has('5,7')).toBe(true);
  });

  it('should deduplicate shared neighbors', () => {
    const grid = createEmptyGrid();
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 5, 7, 'p1');
    const result = calculateValidPlacements(grid, 'p1', W, H);
    // Both share neighbor (5,6)
    expect(result.has('5,6')).toBe(true);
    // Count should not have duplicates
    const arr = Array.from(result);
    const unique = new Set(arr);
    expect(arr.length).toBe(unique.size);
  });
});

// ─── isNearCastle ────────────────────────────────────────────

describe('isNearCastle', () => {
  it('should return true for cell adjacent to castle', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .build();
    expect(isNearCastle(gameState.players, 4, 5, 1)).toBe(true);
  });

  it('should return true within distance 3 of castle corner', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .build();
    expect(isNearCastle(gameState.players, 2, 5, 3)).toBe(true);
  });

  it('should return false for cell far from all castles', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    expect(isNearCastle(gameState.players, 15, 15, 3)).toBe(false);
  });

  it('should check all 4 cells of 2x2 castle', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .build();
    // Distance 1 from castle cell (6,6) bottom-right → (7,6) should be within 1
    expect(isNearCastle(gameState.players, 7, 6, 1)).toBe(true);
  });

  it('should check against all players castles', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    expect(isNearCastle(gameState.players, 14, 15, 1)).toBe(true);
    expect(isNearCastle(gameState.players, 0, 1, 1)).toBe(true);
  });

  it('should return false at distance+1', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .build();
    // Castle occupies (5,5)(6,5)(5,6)(6,6). Distance 2 from (6,6) = (9,6) should be false
    expect(isNearCastle(gameState.players, 9, 6, 2)).toBe(false);
  });
});

// ─── generateTerrain ─────────────────────────────────────────

describe('generateTerrain', () => {
  const W = 18, H = 18;
  const centerX = Math.floor(W / 2);
  const centerY = Math.floor(H / 2);

  it('should not modify grid for flat map', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'flat', W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        expect(grid[y][x].type).toBe('empty');
      }
    }
  });

  it('should create vertical river on river map', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'river', W, H);
    // Most center columns should be river (except bridges)
    expect(grid[0][centerX - 1].type).toBe('river');
    expect(grid[0][centerX].type).toBe('river');
    expect(grid[1][centerX - 1].type).toBe('river');
  });

  it('should place bridges on river map at y=4 and y=GRID_HEIGHT-5', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'river', W, H);
    expect(grid[4][centerX - 1].type).toBe('bridge');
    expect(grid[4][centerX].type).toBe('bridge');
    expect(grid[H - 5][centerX - 1].type).toBe('bridge');
    expect(grid[H - 5][centerX].type).toBe('bridge');
  });

  it('should create mountain cluster on mountain map', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'mountain', W, H);
    expect(grid[centerY][centerX].type).toBe('mountain');
    expect(grid[centerY - 1][centerX - 2].type).toBe('mountain');
    expect(grid[centerY + 1][centerX + 2].type).toBe('mountain');
  });

  it('should create cross-shaped rivers on bridge map', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'bridge', W, H);
    // Horizontal river at centerY
    expect(grid[centerY][4].type).toBe('river');
    // Vertical river at centerX
    expect(grid[4][centerX].type).toBe('river');
    // Center intersection should be bridge
    expect(grid[centerY][centerX].type).toBe('bridge');
  });

  it('should place additional bridges on bridge map', () => {
    const grid = createEmptyGrid(W, H);
    generateTerrain(grid, 'bridge', W, H);
    expect(grid[centerY][5].type).toBe('bridge');
    expect(grid[centerY][W - 6].type).toBe('bridge');
    expect(grid[5][centerX].type).toBe('bridge');
    expect(grid[H - 6][centerX].type).toBe('bridge');
  });
});

// ─── placeCastle ─────────────────────────────────────────────

describe('placeCastle', () => {
  it('should set 2x2 area to castle type', () => {
    const grid = createEmptyGrid();
    placeCastle(grid, 5, 5, 'p1');
    expect(grid[5][5].type).toBe('castle');
    expect(grid[5][6].type).toBe('castle');
    expect(grid[6][5].type).toBe('castle');
    expect(grid[6][6].type).toBe('castle');
  });

  it('should assign ownerId to all 4 cells', () => {
    const grid = createEmptyGrid();
    placeCastle(grid, 5, 5, 'p1');
    expect(grid[5][5].ownerId).toBe('p1');
    expect(grid[5][6].ownerId).toBe('p1');
    expect(grid[6][5].ownerId).toBe('p1');
    expect(grid[6][6].ownerId).toBe('p1');
  });

  it('should set isCastle flag on all 4 cells', () => {
    const grid = createEmptyGrid();
    placeCastle(grid, 5, 5, 'p1');
    expect(grid[5][5].isCastle).toBe(true);
    expect(grid[5][6].isCastle).toBe(true);
    expect(grid[6][5].isCastle).toBe(true);
    expect(grid[6][6].isCastle).toBe(true);
  });

  it('should not modify cells outside 2x2 area', () => {
    const grid = createEmptyGrid();
    placeCastle(grid, 5, 5, 'p1');
    expect(grid[4][5].type).toBe('empty');
    expect(grid[5][4].type).toBe('empty');
    expect(grid[7][5].type).toBe('empty');
    expect(grid[5][7].type).toBe('empty');
  });
});

// ─── getTileColor ────────────────────────────────────────────

describe('getTileColor', () => {
  const players = {
    p1: {
      id: 'p1', displayName: 'P1', color: 'blue' as const,
      castleHP: 4, castleMaxHP: 4 as const, castleFirstDamageTurn: null,
      castlePosition: { x: 1, y: 1 }, activeBonuses: [],
      isAlive: true, isConnected: true, unitCount: 0, level: 1,
    },
  };

  it('should return water.base for river', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'river', ownerId: null, isCastle: false }, players))
      .toBe(TerrainColors.water.base);
  });

  it('should return rock.base for mountain', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'mountain', ownerId: null, isCastle: false }, players))
      .toBe(TerrainColors.rock.base);
  });

  it('should return wood.base for bridge', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'bridge', ownerId: null, isCastle: false }, players))
      .toBe(TerrainColors.wood.base);
  });

  it('should return player color for owned castle', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'castle', ownerId: 'p1', isCastle: true }, players))
      .toBe(PlayerColors.blue);
  });

  it('should return player color for owned unit', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'unit', ownerId: 'p1', isCastle: false }, players))
      .toBe(PlayerColors.blue);
  });

  it('should return grass variant for empty cell', () => {
    const color = getTileColor({ x: 0, y: 0, type: 'empty', ownerId: null, isCastle: false }, players);
    expect(color).toBe(getGrassVariant(0, 0));
  });

  it('should return grass.base for castle/unit with no owner', () => {
    expect(getTileColor({ x: 0, y: 0, type: 'castle', ownerId: null, isCastle: true }, players))
      .toBe(TerrainColors.grass.base);
  });
});
