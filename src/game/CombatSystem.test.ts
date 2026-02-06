import { describe, it, expect } from 'vitest';
import {
  resolveCombatRolls,
  applyCombatResult,
  determineNextPhaseAfterCombat,
} from './CombatSystem';
import { GameStateBuilder } from '../../tests/helpers/GameStateBuilder';

// ─── resolveCombatRolls ─────────────────────────────────────

describe('resolveCombatRolls', () => {
  it('should declare attacker wins when roll is higher (5 vs 3, no bonuses)', () => {
    const result = resolveCombatRolls(5, 3, false, false);
    expect(result.attackerWins).toBe(true);
    expect(result.isTie).toBe(false);
    expect(result.finalAttackerRoll).toBe(5);
    expect(result.finalDefenderRoll).toBe(3);
  });

  it('should declare defender wins when defender roll is higher (2 vs 4, no bonuses)', () => {
    const result = resolveCombatRolls(2, 4, false, false);
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(false);
    expect(result.finalAttackerRoll).toBe(2);
    expect(result.finalDefenderRoll).toBe(4);
  });

  it('should give tie to defender (3 vs 3, no bonuses)', () => {
    const result = resolveCombatRolls(3, 3, false, false);
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(true);
  });

  it('should set isTie=true when final rolls are equal', () => {
    const result = resolveCombatRolls(3, 3, false, false);
    expect(result.isTie).toBe(true);
    expect(result.attackerWins).toBe(false);
  });

  it('should add +1 attack bonus making attacker win (3+1=4 vs 3)', () => {
    const result = resolveCombatRolls(3, 3, true, false);
    expect(result.attackBonus).toBe(1);
    expect(result.defenseBonus).toBe(0);
    expect(result.finalAttackerRoll).toBe(4);
    expect(result.finalDefenderRoll).toBe(3);
    expect(result.attackerWins).toBe(true);
    expect(result.isTie).toBe(false);
  });

  it('should add +1 defense bonus causing tie to go to defender (4 vs 3+1=4)', () => {
    const result = resolveCombatRolls(4, 3, false, true);
    expect(result.attackBonus).toBe(0);
    expect(result.defenseBonus).toBe(1);
    expect(result.finalAttackerRoll).toBe(4);
    expect(result.finalDefenderRoll).toBe(4);
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(true);
  });

  it('should handle both bonuses active (3+1=4 vs 3+1=4 → tie → defender)', () => {
    const result = resolveCombatRolls(3, 3, true, true);
    expect(result.attackBonus).toBe(1);
    expect(result.defenseBonus).toBe(1);
    expect(result.finalAttackerRoll).toBe(4);
    expect(result.finalDefenderRoll).toBe(4);
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(true);
  });

  it('should handle edge case: roll 1 vs 6 (attacker loses badly)', () => {
    const result = resolveCombatRolls(1, 6, false, false);
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(false);
    expect(result.finalAttackerRoll).toBe(1);
    expect(result.finalDefenderRoll).toBe(6);
  });

  it('should handle edge case: roll 6 vs 1 (attacker wins easily)', () => {
    const result = resolveCombatRolls(6, 1, false, false);
    expect(result.attackerWins).toBe(true);
    expect(result.isTie).toBe(false);
    expect(result.finalAttackerRoll).toBe(6);
    expect(result.finalDefenderRoll).toBe(1);
  });

  it('should preserve original roll values in result', () => {
    const result = resolveCombatRolls(4, 2, true, true);
    expect(result.attackerRoll).toBe(4);
    expect(result.defenderRoll).toBe(2);
    expect(result.attackBonus).toBe(1);
    expect(result.defenseBonus).toBe(1);
  });
});

// ─── applyCombatResult ──────────────────────────────────────

describe('applyCombatResult', () => {
  it('should convert enemy unit to attacker ownership when attacker wins', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withUnitAt(3, 1, 'p1')
      .withUnitAt(4, 1, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const outcome = applyCombatResult(
      grid, gameState,
      { x: 3, y: 1 }, // attacker
      { x: 4, y: 1 }, // defender
      true,            // attacker wins
      'p1'
    );

    expect(grid[1][4].ownerId).toBe('p1');
    expect(grid[1][4].type).toBe('unit');
    expect(outcome.unitCaptured).toBe(true);
  });

  it('should increment attacker unitCount and decrement defender unitCount on capture', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withUnitAt(3, 1, 'p1')
      .withUnitAt(4, 1, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const p1UnitsBefore = gameState.players['p1'].unitCount;
    const p2UnitsBefore = gameState.players['p2'].unitCount;

    applyCombatResult(
      grid, gameState,
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      true,
      'p1'
    );

    expect(gameState.players['p1'].unitCount).toBe(p1UnitsBefore + 1);
    expect(gameState.players['p2'].unitCount).toBe(p2UnitsBefore - 1);
  });

  it('should reduce castle HP by 1 when attacking castle', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withUnitAt(14, 15, 'p1')
      .withTurnOrder(['p1', 'p2'])
      .build();

    expect(gameState.players['p2'].castleHP).toBe(4);

    const outcome = applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 }, // castle cell
      true,
      'p1'
    );

    expect(gameState.players['p2'].castleHP).toBe(3);
    expect(outcome.castleDamaged).toBe(true);
    expect(outcome.newCastleHP).toBe(3);
    expect(outcome.eliminatedPlayer).toBeUndefined();
  });

  it('should eliminate player when castle HP reaches 0', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withCastleHP('p2', 1)
      .withUnitAt(14, 15, 'p1')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const outcome = applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      true,
      'p1'
    );

    expect(gameState.players['p2'].castleHP).toBe(0);
    expect(outcome.eliminatedPlayer).toBe('p2');
    expect(outcome.castleDamaged).toBe(true);
    expect(outcome.newCastleHP).toBe(0);
  });

  it('should clear all defender cells on elimination', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withCastleHP('p2', 1)
      .withUnitAt(14, 15, 'p1')
      .withUnitAt(10, 10, 'p2')
      .withUnitAt(11, 10, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      true,
      'p1'
    );

    // Castle cells should be empty
    expect(grid[15][15].type).toBe('empty');
    expect(grid[15][15].ownerId).toBeNull();
    expect(grid[15][15].isCastle).toBe(false);
    expect(grid[15][16].type).toBe('empty');
    expect(grid[16][15].type).toBe('empty');
    expect(grid[16][16].type).toBe('empty');

    // Unit cells should be empty
    expect(grid[10][10].type).toBe('empty');
    expect(grid[10][10].ownerId).toBeNull();
    expect(grid[10][11].type).toBe('empty');
    expect(grid[10][11].ownerId).toBeNull();
  });

  it('should remove eliminated player from turnOrder', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withCastleHP('p2', 1)
      .withUnitAt(14, 15, 'p1')
      .withTurnOrder(['p1', 'p2'])
      .build();

    applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      true,
      'p1'
    );

    expect(gameState.turnOrder).toEqual(['p1']);
    expect(gameState.turnOrder).not.toContain('p2');
  });

  it('should adjust currentPlayerIndex when eliminated player index is lower', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 8, 8)
      .withPlayer('p3', 'Player 3', 'red', 15, 15)
      .withCastleHP('p1', 1)
      .withUnitAt(0, 1, 'p3')
      .withTurnOrder(['p1', 'p2', 'p3'])
      .withCurrentPlayerIndex(2) // p3 is current
      .build();

    applyCombatResult(
      grid, gameState,
      { x: 0, y: 1 },
      { x: 1, y: 1 }, // p1 castle cell
      true,
      'p3'
    );

    // p1 (index 0) removed, p3 was at index 2 -> should now be at index 1
    expect(gameState.turnOrder).toEqual(['p2', 'p3']);
    expect(gameState.currentPlayerIndex).toBe(1);
  });

  it('should set eliminated player isAlive to false', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withCastleHP('p2', 1)
      .withUnitAt(14, 15, 'p1')
      .withTurnOrder(['p1', 'p2'])
      .build();

    applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      true,
      'p1'
    );

    expect(gameState.players['p2'].isAlive).toBe(false);
  });

  it('should make attacker cell empty and decrement unitCount when attacker loses', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withUnitAt(3, 1, 'p1')
      .withUnitAt(4, 1, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const p1UnitsBefore = gameState.players['p1'].unitCount;

    const outcome = applyCombatResult(
      grid, gameState,
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      false, // attacker loses
      'p1'
    );

    expect(grid[1][3].type).toBe('empty');
    expect(grid[1][3].ownerId).toBeNull();
    expect(gameState.players['p1'].unitCount).toBe(p1UnitsBefore - 1);
    expect(outcome.attackerDestroyed).toBe(true);
  });

  it('should not affect defender when attacker loses', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withUnitAt(3, 1, 'p1')
      .withUnitAt(4, 1, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const p2UnitsBefore = gameState.players['p2'].unitCount;
    const p2HPBefore = gameState.players['p2'].castleHP;

    applyCombatResult(
      grid, gameState,
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      false,
      'p1'
    );

    // Defender is completely unaffected
    expect(grid[1][4].type).toBe('unit');
    expect(grid[1][4].ownerId).toBe('p2');
    expect(gameState.players['p2'].unitCount).toBe(p2UnitsBefore);
    expect(gameState.players['p2'].castleHP).toBe(p2HPBefore);
    expect(gameState.players['p2'].isAlive).toBe(true);
  });

  it('should not eliminate player when castle HP goes to 1 (not 0)', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'Player 1', 'blue', 1, 1)
      .withPlayer('p2', 'Player 2', 'yellow', 15, 15)
      .withCastleHP('p2', 2)
      .withUnitAt(14, 15, 'p1')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const outcome = applyCombatResult(
      grid, gameState,
      { x: 14, y: 15 },
      { x: 15, y: 15 },
      true,
      'p1'
    );

    expect(gameState.players['p2'].castleHP).toBe(1);
    expect(gameState.players['p2'].isAlive).toBe(true);
    expect(outcome.eliminatedPlayer).toBeUndefined();
    expect(outcome.castleDamaged).toBe(true);
    expect(outcome.newCastleHP).toBe(1);
    expect(gameState.turnOrder).toContain('p2');
  });
});

// ─── determineNextPhaseAfterCombat ──────────────────────────

describe('determineNextPhaseAfterCombat', () => {
  it('should return "placing" for Option B when attacker won', () => {
    const result = determineNextPhaseAfterCombat(true, 'B', 0, false);
    expect(result).toBe('placing');
  });

  it('should return "done" for Option B when attacker lost', () => {
    const result = determineNextPhaseAfterCombat(false, 'B', 1, true);
    expect(result).toBe('done');
  });

  it('should return "attacking" for Option C when won with attacks remaining and targets', () => {
    const result = determineNextPhaseAfterCombat(true, 'C', 1, true);
    expect(result).toBe('attacking');
  });

  it('should return "done" for Option C when won but no attacks remaining', () => {
    const result = determineNextPhaseAfterCombat(true, 'C', 0, true);
    expect(result).toBe('done');
  });

  it('should return "done" for Option C when won with attacks remaining but no targets', () => {
    const result = determineNextPhaseAfterCombat(true, 'C', 1, false);
    expect(result).toBe('done');
  });

  it('should return "done" for Option C when attacker lost', () => {
    const result = determineNextPhaseAfterCombat(false, 'C', 1, true);
    expect(result).toBe('done');
  });

  it('should return "done" for Option A regardless of outcome', () => {
    expect(determineNextPhaseAfterCombat(true, 'A', 0, false)).toBe('done');
    expect(determineNextPhaseAfterCombat(false, 'A', 0, false)).toBe('done');
  });

  it('should return "done" when attacker lost regardless of option', () => {
    expect(determineNextPhaseAfterCombat(false, 'A', 1, true)).toBe('done');
    expect(determineNextPhaseAfterCombat(false, 'B', 1, true)).toBe('done');
    expect(determineNextPhaseAfterCombat(false, 'C', 1, true)).toBe('done');
  });
});
