import { describe, it, expect } from 'vitest';
import { eliminatePlayer, checkVictory } from './PlayerManager';
import { GameStateBuilder } from '../../tests/helpers/GameStateBuilder';

// ─── eliminatePlayer ────────────────────────────────────────

describe('eliminatePlayer', () => {
  const W = 18, H = 18;

  it('should set castle cells to empty', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[5][5].type).toBe('empty');
    expect(grid[5][6].type).toBe('empty');
    expect(grid[6][5].type).toBe('empty');
    expect(grid[6][6].type).toBe('empty');
  });

  it('should clear ownerIds on castle cells', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[5][5].ownerId).toBeNull();
    expect(grid[5][6].ownerId).toBeNull();
    expect(grid[6][5].ownerId).toBeNull();
    expect(grid[6][6].ownerId).toBeNull();
  });

  it('should clear isCastle flag on castle cells', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[5][5].isCastle).toBe(false);
    expect(grid[5][6].isCastle).toBe(false);
    expect(grid[6][5].isCastle).toBe(false);
    expect(grid[6][6].isCastle).toBe(false);
  });

  it('should remove all units belonging to the eliminated player', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(8, 8, 'p1')
      .withUnitAt(9, 9, 'p1')
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[8][8].type).toBe('empty');
    expect(grid[9][9].type).toBe('empty');
  });

  it('should set unit cells to empty and clear ownerIds', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(8, 8, 'p1')
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[8][8].ownerId).toBeNull();
  });

  it('should remove the player from the turnOrder', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(gameState.turnOrder).not.toContain('p1');
    expect(gameState.turnOrder).toContain('p2');
  });

  it('should adjust currentPlayerIndex when eliminated player is before current', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 1)
      .withPlayer('p3', 'P3', 'green', 1, 15)
      .withCurrentPlayerIndex(2) // p3 is current
      .build();
    // Removing p1 (index 0), which is before currentPlayerIndex (2)
    eliminatePlayer(grid, gameState, 'p1', { x: 1, y: 1 }, W, H);
    expect(gameState.currentPlayerIndex).toBe(1);
  });

  it('should not adjust currentPlayerIndex when eliminated player is after current', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 1)
      .withPlayer('p3', 'P3', 'green', 1, 15)
      .withCurrentPlayerIndex(0) // p1 is current
      .build();
    // Removing p3 (index 2), which is after currentPlayerIndex (0)
    eliminatePlayer(grid, gameState, 'p3', { x: 1, y: 15 }, W, H);
    expect(gameState.currentPlayerIndex).toBe(0);
  });

  it('should wrap currentPlayerIndex to 0 when eliminated player is at end and is current', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 1)
      .withCurrentPlayerIndex(1) // p2 is current (last in order)
      .build();
    // Removing p2 (index 1 = currentPlayerIndex), turnOrder becomes ['p1'] length=1
    // currentPlayerIndex=1 >= length=1, so wraps to 0
    eliminatePlayer(grid, gameState, 'p2', { x: 15, y: 1 }, W, H);
    expect(gameState.currentPlayerIndex).toBe(0);
  });

  it('should preserve other players cells and state', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(14, 14, 'p2')
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(grid[15][15].type).toBe('castle');
    expect(grid[15][15].ownerId).toBe('p2');
    expect(grid[14][14].type).toBe('unit');
    expect(grid[14][14].ownerId).toBe('p2');
    expect(gameState.players['p2'].isAlive).toBe(true);
  });

  it('should handle a player with 0 units (only castle)', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    // p1 has no units, just the castle
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(gameState.players['p1'].isAlive).toBe(false);
    expect(gameState.turnOrder).not.toContain('p1');
  });

  it('should mark the player as dead', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 5, 5)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();
    eliminatePlayer(grid, gameState, 'p1', { x: 5, y: 5 }, W, H);
    expect(gameState.players['p1'].isAlive).toBe(false);
  });
});

// ─── checkVictory ───────────────────────────────────────────

describe('checkVictory', () => {
  it('should return null when there are 2 or more players', () => {
    expect(checkVictory(['p1', 'p2'])).toBeNull();
  });

  it('should return the winner when only 1 player remains', () => {
    expect(checkVictory(['p2'])).toBe('p2');
  });

  it('should return null when there are 4 players', () => {
    expect(checkVictory(['p1', 'p2', 'p3', 'p4'])).toBeNull();
  });
});
