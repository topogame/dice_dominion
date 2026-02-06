import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './GameStateFactory';

// ─── createInitialGameState ─────────────────────────────────

describe('createInitialGameState', () => {
  it('should create an 18x18 grid', () => {
    const { grid } = createInitialGameState(2, 'flat');
    expect(grid.length).toBe(18);
    expect(grid[0].length).toBe(18);
  });

  it('should have all cells initialized (no undefined)', () => {
    const { grid } = createInitialGameState(2, 'flat');
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        expect(grid[y][x]).toBeDefined();
        expect(grid[y][x].x).toBe(x);
        expect(grid[y][x].y).toBe(y);
      }
    }
  });

  it('should place 2 castles for a 2-player game', () => {
    const { grid } = createInitialGameState(2, 'flat');
    let castleCount = 0;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        if (grid[y][x].isCastle) castleCount++;
      }
    }
    // Each castle is 2x2, so 2 castles = 8 castle cells
    expect(castleCount).toBe(8);
  });

  it('should place 3 castles for a 3-player game', () => {
    const { grid } = createInitialGameState(3, 'flat');
    let castleCount = 0;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        if (grid[y][x].isCastle) castleCount++;
      }
    }
    expect(castleCount).toBe(12);
  });

  it('should place 4 castles for a 4-player game', () => {
    const { grid } = createInitialGameState(4, 'flat');
    let castleCount = 0;
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        if (grid[y][x].isCastle) castleCount++;
      }
    }
    expect(castleCount).toBe(16);
  });

  // 2-player castle positions
  it('should place Blue at (1, 15) bottom-left for 2-player', () => {
    const { gameState } = createInitialGameState(2, 'flat');
    expect(gameState.players['player1'].castlePosition).toEqual({ x: 1, y: 15 });
  });

  it('should place Yellow at (15, 1) top-right for 2-player', () => {
    const { gameState } = createInitialGameState(2, 'flat');
    expect(gameState.players['player2'].castlePosition).toEqual({ x: 15, y: 1 });
  });

  // 4-player castle positions
  it('should place Blue at (1, 1) top-left for 4-player', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    expect(gameState.players['player1'].castlePosition).toEqual({ x: 1, y: 1 });
  });

  it('should place Yellow at (15, 1) top-right for 4-player', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    expect(gameState.players['player2'].castlePosition).toEqual({ x: 15, y: 1 });
  });

  it('should place Green at (1, 15) bottom-left for 4-player', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    expect(gameState.players['player3'].castlePosition).toEqual({ x: 1, y: 15 });
  });

  it('should place Red at (15, 15) bottom-right for 4-player', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    expect(gameState.players['player4'].castlePosition).toEqual({ x: 15, y: 15 });
  });

  // Player state defaults
  it('should set all castle HPs to 4', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    for (const player of Object.values(gameState.players)) {
      expect(player.castleHP).toBe(4);
    }
  });

  it('should set all players as alive', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    for (const player of Object.values(gameState.players)) {
      expect(player.isAlive).toBe(true);
    }
  });

  it('should set all unitCounts to 0', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    for (const player of Object.values(gameState.players)) {
      expect(player.unitCount).toBe(0);
    }
  });

  // Terrain
  it('should apply river terrain for river map', () => {
    const { grid } = createInitialGameState(2, 'river');
    const centerX = Math.floor(18 / 2);
    // Row 0 should have river cells at center columns
    expect(grid[0][centerX - 1].type).toBe('river');
    expect(grid[0][centerX].type).toBe('river');
  });

  it('should apply mountain terrain for mountain map', () => {
    const { grid } = createInitialGameState(2, 'mountain');
    const centerX = Math.floor(18 / 2);
    const centerY = Math.floor(18 / 2);
    expect(grid[centerY][centerX].type).toBe('mountain');
  });

  it('should have no terrain for flat map', () => {
    const { grid } = createInitialGameState(2, 'flat');
    for (let y = 0; y < 18; y++) {
      for (let x = 0; x < 18; x++) {
        const cell = grid[y][x];
        if (!cell.isCastle) {
          expect(cell.type).toBe('empty');
        }
      }
    }
  });

  // Game state defaults
  it('should include all player IDs in turnOrder', () => {
    const { gameState } = createInitialGameState(4, 'flat');
    expect(gameState.turnOrder).toEqual(['player1', 'player2', 'player3', 'player4']);
  });

  it('should start at currentTurn 1', () => {
    const { gameState } = createInitialGameState(2, 'flat');
    expect(gameState.currentTurn).toBe(1);
  });

  it('should start with an empty chests array', () => {
    const { gameState } = createInitialGameState(2, 'flat');
    expect(gameState.chests).toEqual([]);
  });
});
