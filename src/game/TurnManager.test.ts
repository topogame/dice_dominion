import { describe, it, expect } from 'vitest';
import {
  finalizeTurnOrder,
  selectTurnOption,
  advanceToNextPlayer,
  playerHasAttackOptions,
  calculateAttackableEnemies,
} from './TurnManager';
import { createEmptyGrid, setUnit, setCastle } from '../../tests/helpers/GridBuilder';

// ─── finalizeTurnOrder ──────────────────────────────────────

describe('finalizeTurnOrder', () => {
  it('should sort by roll descending (highest first)', () => {
    const rolls = [
      { playerId: 'p1', roll: 2 },
      { playerId: 'p2', roll: 5 },
      { playerId: 'p3', roll: 3 },
    ];
    const result = finalizeTurnOrder(rolls);
    expect(result[0]).toBe('p2');
  });

  it('should return player IDs in sorted order', () => {
    const rolls = [
      { playerId: 'p1', roll: 1 },
      { playerId: 'p2', roll: 6 },
      { playerId: 'p3', roll: 4 },
    ];
    const result = finalizeTurnOrder(rolls);
    expect(result).toEqual(['p2', 'p3', 'p1']);
  });

  it('should handle 2 players', () => {
    const rolls = [
      { playerId: 'alpha', roll: 3 },
      { playerId: 'beta', roll: 5 },
    ];
    const result = finalizeTurnOrder(rolls);
    expect(result).toEqual(['beta', 'alpha']);
    expect(result.length).toBe(2);
  });

  it('should handle 3 players', () => {
    const rolls = [
      { playerId: 'a', roll: 10 },
      { playerId: 'b', roll: 20 },
      { playerId: 'c', roll: 15 },
    ];
    const result = finalizeTurnOrder(rolls);
    expect(result).toEqual(['b', 'c', 'a']);
    expect(result.length).toBe(3);
  });

  it('should handle 4 players', () => {
    const rolls = [
      { playerId: 'p1', roll: 1 },
      { playerId: 'p2', roll: 4 },
      { playerId: 'p3', roll: 2 },
      { playerId: 'p4', roll: 3 },
    ];
    const result = finalizeTurnOrder(rolls);
    expect(result).toEqual(['p2', 'p4', 'p3', 'p1']);
    expect(result.length).toBe(4);
  });

  it('should handle all same roll (preserve relative order / sort stability)', () => {
    const rolls = [
      { playerId: 'p1', roll: 5 },
      { playerId: 'p2', roll: 5 },
      { playerId: 'p3', roll: 5 },
    ];
    const result = finalizeTurnOrder(rolls);
    // All rolls equal; stable sort preserves original order
    expect(result).toEqual(['p1', 'p2', 'p3']);
    expect(result.length).toBe(3);
  });
});

// ─── selectTurnOption ───────────────────────────────────────

describe('selectTurnOption', () => {
  it('Option A: placing phase, 0 attacks', () => {
    const result = selectTurnOption('A');
    expect(result.turnPhase).toBe('placing');
    expect(result.attacksRemaining).toBe(0);
  });

  it('Option B: attacking phase, 1 attack', () => {
    const result = selectTurnOption('B');
    expect(result.turnPhase).toBe('attacking');
    expect(result.attacksRemaining).toBe(1);
  });

  it('Option C: attacking phase, 2 attacks', () => {
    const result = selectTurnOption('C');
    expect(result.turnPhase).toBe('attacking');
    expect(result.attacksRemaining).toBe(2);
  });
});

// ─── advanceToNextPlayer ────────────────────────────────────

describe('advanceToNextPlayer', () => {
  it('should increment index by 1 (index 0 → 1)', () => {
    const result = advanceToNextPlayer(0, 4, 1);
    expect(result.nextPlayerIndex).toBe(1);
  });

  it('should wrap to 0 at end (4 players, index 3 → 0)', () => {
    const result = advanceToNextPlayer(3, 4, 1);
    expect(result.nextPlayerIndex).toBe(0);
  });

  it('should increment turn when wrapping', () => {
    const result = advanceToNextPlayer(3, 4, 1);
    expect(result.newTurn).toBe(2);
  });

  it('should NOT increment turn when not wrapping', () => {
    const result = advanceToNextPlayer(0, 4, 1);
    expect(result.newTurn).toBe(1);
  });

  it('2 players: index 1 → 0 increments turn', () => {
    const result = advanceToNextPlayer(1, 2, 3);
    expect(result.nextPlayerIndex).toBe(0);
    expect(result.newTurn).toBe(4);
  });
});

// ─── playerHasAttackOptions ─────────────────────────────────

describe('playerHasAttackOptions', () => {
  const W = 18;
  const H = 18;

  it('should return false when no units at all', () => {
    const grid = createEmptyGrid(W, H);
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(false);
  });

  it('should return true when unit adjacent to enemy unit', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 6, 5, 'p2');
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(true);
  });

  it('should return true when unit adjacent to enemy castle', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 4, 5, 'p1');
    setCastle(grid, 5, 5, 'p2');
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(true);
  });

  it('should return false when no adjacent enemies', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 2, 2, 'p1');
    setUnit(grid, 10, 10, 'p2');
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(false);
  });

  it('should not count own units as attackable', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 6, 5, 'p1');
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(false);
  });

  it('should check all 4 directions', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');

    // Enemy above
    const gridUp = createEmptyGrid(W, H);
    setUnit(gridUp, 5, 5, 'p1');
    setUnit(gridUp, 5, 4, 'p2');
    expect(playerHasAttackOptions(gridUp, 'p1', W, H)).toBe(true);

    // Enemy below
    const gridDown = createEmptyGrid(W, H);
    setUnit(gridDown, 5, 5, 'p1');
    setUnit(gridDown, 5, 6, 'p2');
    expect(playerHasAttackOptions(gridDown, 'p1', W, H)).toBe(true);

    // Enemy left
    const gridLeft = createEmptyGrid(W, H);
    setUnit(gridLeft, 5, 5, 'p1');
    setUnit(gridLeft, 4, 5, 'p2');
    expect(playerHasAttackOptions(gridLeft, 'p1', W, H)).toBe(true);

    // Enemy right
    const gridRight = createEmptyGrid(W, H);
    setUnit(gridRight, 5, 5, 'p1');
    setUnit(gridRight, 6, 5, 'p2');
    expect(playerHasAttackOptions(gridRight, 'p1', W, H)).toBe(true);
  });

  it('should handle unit at grid edge (0,0)', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 0, 0, 'p1');
    setUnit(grid, 1, 0, 'p2');
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(true);
  });

  it('should return false on empty board', () => {
    const grid = createEmptyGrid(W, H);
    expect(playerHasAttackOptions(grid, 'p1', W, H)).toBe(false);
  });
});

// ─── calculateAttackableEnemies ─────────────────────────────

describe('calculateAttackableEnemies', () => {
  const W = 18;
  const H = 18;

  it('should find adjacent enemy unit', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 6, 5, 'p2');
    const result = calculateAttackableEnemies(grid, 5, 5, 'p1', W, H);
    expect(result.has('6,5')).toBe(true);
    expect(result.size).toBe(1);
  });

  it('should find adjacent enemy castle', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 4, 5, 'p1');
    setCastle(grid, 5, 5, 'p2');
    const result = calculateAttackableEnemies(grid, 4, 5, 'p1', W, H);
    expect(result.has('5,5')).toBe(true);
  });

  it('should not include friendly units', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 6, 5, 'p1');
    const result = calculateAttackableEnemies(grid, 5, 5, 'p1', W, H);
    expect(result.has('6,5')).toBe(false);
    expect(result.size).toBe(0);
  });

  it('should not include empty cells', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    // All neighbors are empty
    const result = calculateAttackableEnemies(grid, 5, 5, 'p1', W, H);
    expect(result.size).toBe(0);
  });

  it('should return empty set when no enemies adjacent', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 2, 2, 'p1');
    setUnit(grid, 10, 10, 'p2');
    const result = calculateAttackableEnemies(grid, 2, 2, 'p1', W, H);
    expect(result.size).toBe(0);
  });

  it('should find multiple enemies (up to 4)', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 5, 5, 'p1');
    setUnit(grid, 5, 4, 'p2'); // up
    setUnit(grid, 5, 6, 'p3'); // down
    setUnit(grid, 4, 5, 'p2'); // left
    setUnit(grid, 6, 5, 'p3'); // right
    const result = calculateAttackableEnemies(grid, 5, 5, 'p1', W, H);
    expect(result.size).toBe(4);
    expect(result.has('5,4')).toBe(true);
    expect(result.has('5,6')).toBe(true);
    expect(result.has('4,5')).toBe(true);
    expect(result.has('6,5')).toBe(true);
  });

  it('should handle grid boundaries (unit at 0,0)', () => {
    const grid = createEmptyGrid(W, H);
    setUnit(grid, 0, 0, 'p1');
    setUnit(grid, 1, 0, 'p2');
    setUnit(grid, 0, 1, 'p2');
    const result = calculateAttackableEnemies(grid, 0, 0, 'p1', W, H);
    // Only right and down are valid (up and left are out of bounds)
    expect(result.size).toBe(2);
    expect(result.has('1,0')).toBe(true);
    expect(result.has('0,1')).toBe(true);
  });
});
