import { describe, it, expect } from 'vitest';
import {
  findChestSpawnPosition,
  collectChest,
  hasActiveBonus,
  decrementBonuses,
} from './ChestSystem';
import { GameStateBuilder } from '../../tests/helpers/GameStateBuilder';
import { createEmptyGrid, setUnit } from '../../tests/helpers/GridBuilder';

// ─── findChestSpawnPosition ─────────────────────────────────

describe('findChestSpawnPosition', () => {
  const W = 18, H = 18;

  it('should return a valid position on an empty grid', () => {
    const grid = createEmptyGrid(W, H);
    const players = {};
    const rng = () => 0.5;
    const result = findChestSpawnPosition(grid, players, W, H, 3, rng);
    expect(result).not.toBeNull();
    expect(result!.x).toBeGreaterThanOrEqual(0);
    expect(result!.x).toBeLessThan(W);
    expect(result!.y).toBeGreaterThanOrEqual(0);
    expect(result!.y).toBeLessThan(H);
  });

  it('should return null when the entire grid is full of units', () => {
    const grid = createEmptyGrid(W, H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        setUnit(grid, x, y, 'p1');
      }
    }
    const players = {};
    const rng = () => 0.5;
    const result = findChestSpawnPosition(grid, players, W, H, 3, rng);
    expect(result).toBeNull();
  });

  it('should not return a position near any castle', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 8, 8)
      .build();
    // RNG that always targets (9, 9) which is inside the castle
    const rng = () => 0.5; // floor(0.5 * 18) = 9
    const result = findChestSpawnPosition(grid, gameState.players, W, H, 3, rng);
    // Should be null because (9,9) is always near castle at (8,8)
    expect(result).toBeNull();
  });

  it('should use the provided RNG deterministically', () => {
    const grid = createEmptyGrid(W, H);
    const players = {};
    // RNG that returns 0.0 => x=0, y=0
    const rng = () => 0.0;
    const result = findChestSpawnPosition(grid, players, W, H, 3, rng);
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

// ─── collectChest ───────────────────────────────────────────

describe('collectChest', () => {
  it('should mark the chest as collected', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'defense')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    expect(gameState.chests[0].isCollected).toBe(true);
  });

  it('should add a bonus to the player', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'defense')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    expect(gameState.players['p1'].activeBonuses.length).toBe(1);
    expect(gameState.players['p1'].activeBonuses[0].type).toBe('defense');
  });

  it('should give defense bonus 3 turns remaining', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'defense')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    expect(gameState.players['p1'].activeBonuses[0].turnsRemaining).toBe(3);
  });

  it('should give attack bonus 3 turns remaining', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'attack')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    expect(gameState.players['p1'].activeBonuses[0].turnsRemaining).toBe(3);
  });

  it('should give speed bonus 3 turns remaining', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'speed')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    expect(gameState.players['p1'].activeBonuses[0].turnsRemaining).toBe(3);
  });

  it('should give bridge bonus 99 turns and 2 uses', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'bridge')
      .build();
    collectChest(gameState, 10, 10, 'p1');
    const bonus = gameState.players['p1'].activeBonuses[0];
    expect(bonus.turnsRemaining).toBe(99);
    expect(bonus.usesRemaining).toBe(2);
  });

  it('should return null if no chest is found at that position', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toBeNull();
  });

  it('should return null if the chest is already collected', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'defense')
      .build();
    gameState.chests[0].isCollected = true;
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toBeNull();
  });

  it('should return bonusType and bonusName for defense', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'defense')
      .build();
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toEqual({ bonusType: 'defense', bonusName: 'Defense Shield' });
  });

  it('should return bonusType and bonusName for attack', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'attack')
      .build();
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toEqual({ bonusType: 'attack', bonusName: 'Attack Boost' });
  });

  it('should return bonusType and bonusName for speed', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'speed')
      .build();
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toEqual({ bonusType: 'speed', bonusName: 'Speed Bonus' });
  });

  it('should return bonusType and bonusName for bridge', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withChestAt(10, 10, 'bridge')
      .build();
    const result = collectChest(gameState, 10, 10, 'p1');
    expect(result).toEqual({ bonusType: 'bridge', bonusName: 'Bridge Builder' });
  });
});

// ─── hasActiveBonus ─────────────────────────────────────────

describe('hasActiveBonus', () => {
  it('should return true when a matching bonus exists', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'defense', 3)
      .build();
    expect(hasActiveBonus(gameState.players['p1'], 'defense')).toBe(true);
  });

  it('should return false when activeBonuses is empty', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    expect(hasActiveBonus(gameState.players['p1'], 'defense')).toBe(false);
  });

  it('should return false when the bonus type does not match', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'attack', 3)
      .build();
    expect(hasActiveBonus(gameState.players['p1'], 'defense')).toBe(false);
  });

  it('should return false when turnsRemaining is 0', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'defense', 0)
      .build();
    expect(hasActiveBonus(gameState.players['p1'], 'defense')).toBe(false);
  });
});

// ─── decrementBonuses ───────────────────────────────────────

describe('decrementBonuses', () => {
  it('should decrement turnsRemaining by 1', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'defense', 3)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    expect(player.activeBonuses[0].turnsRemaining).toBe(2);
  });

  it('should remove a bonus when turnsRemaining reaches 0', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'defense', 1)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    expect(player.activeBonuses.length).toBe(0);
  });

  it('should NOT decrement turnsRemaining for bridge bonuses', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'bridge', 99, 2)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    expect(player.activeBonuses[0].turnsRemaining).toBe(99);
  });

  it('should remove bridge bonus when usesRemaining is 0', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'bridge', 99, 0)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    expect(player.activeBonuses.length).toBe(0);
  });

  it('should handle an empty activeBonuses array', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    expect(player.activeBonuses.length).toBe(0);
  });

  it('should keep active bonuses while removing expired ones', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayerBonus('p1', 'defense', 1)
      .withPlayerBonus('p1', 'attack', 3)
      .build();
    const player = gameState.players['p1'];
    decrementBonuses(player);
    // defense (1 -> 0) removed, attack (3 -> 2) kept
    expect(player.activeBonuses.length).toBe(1);
    expect(player.activeBonuses[0].type).toBe('attack');
    expect(player.activeBonuses[0].turnsRemaining).toBe(2);
  });
});
