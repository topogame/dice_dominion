import { describe, it, expect } from 'vitest';
import { placeUnit, calculatePlacementPoints } from './PlacementSystem';
import { GameStateBuilder } from '../../tests/helpers/GameStateBuilder';

// ─── placeUnit ──────────────────────────────────────────────

describe('placeUnit', () => {
  it('should set the cell type to unit', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    placeUnit(grid, gameState, 5, 5, 'p1');
    expect(grid[5][5].type).toBe('unit');
  });

  it('should set the cell ownerId to the player', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    placeUnit(grid, gameState, 5, 5, 'p1');
    expect(grid[5][5].ownerId).toBe('p1');
  });

  it('should increment the player unitCount', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    expect(gameState.players['p1'].unitCount).toBe(0);
    placeUnit(grid, gameState, 5, 5, 'p1');
    expect(gameState.players['p1'].unitCount).toBe(1);
  });

  it('should detect and collect a chest on the cell', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(5, 5, 'attack')
      .build();
    placeUnit(grid, gameState, 5, 5, 'p1');
    expect(gameState.chests[0].isCollected).toBe(true);
    expect(gameState.players['p1'].activeBonuses.length).toBe(1);
  });

  it('should return chestCollected=true when placing on a chest', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(5, 5, 'speed')
      .build();
    const result = placeUnit(grid, gameState, 5, 5, 'p1');
    expect(result.chestCollected).toBe(true);
    expect(result.chestBonusType).toBe('speed');
  });

  it('should return chestCollected=false when placing on an empty cell', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    const result = placeUnit(grid, gameState, 5, 5, 'p1');
    expect(result.chestCollected).toBe(false);
    expect(result.chestBonusType).toBeUndefined();
  });

  it('should work on a bridge cell', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withBridgeAt(5, 5)
      .build();
    const result = placeUnit(grid, gameState, 5, 5, 'p1');
    expect(grid[5][5].type).toBe('unit');
    expect(grid[5][5].ownerId).toBe('p1');
    expect(result.chestCollected).toBe(false);
  });
});

// ─── calculatePlacementPoints ───────────────────────────────

describe('calculatePlacementPoints', () => {
  it('should return dice value when no speed bonus (dice=1)', () => {
    expect(calculatePlacementPoints(1, false)).toBe(1);
  });

  it('should return dice value when no speed bonus (dice=6)', () => {
    expect(calculatePlacementPoints(6, false)).toBe(6);
  });

  it('should add 2 when speed bonus active (dice=1)', () => {
    expect(calculatePlacementPoints(1, true)).toBe(3);
  });

  it('should add 2 when speed bonus active (dice=6)', () => {
    expect(calculatePlacementPoints(6, true)).toBe(8);
  });
});
