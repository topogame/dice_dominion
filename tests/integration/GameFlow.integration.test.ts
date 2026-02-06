import { describe, it, expect } from 'vitest';
import { GameStateBuilder } from '../helpers/GameStateBuilder';
import { setUnit } from '../helpers/GridBuilder';
import { resolveCombatRolls, applyCombatResult, determineNextPhaseAfterCombat } from '../../src/game/CombatSystem';
import { selectTurnOption, advanceToNextPlayer, playerHasAttackOptions, finalizeTurnOrder } from '../../src/game/TurnManager';
import { placeUnit, calculatePlacementPoints } from '../../src/game/PlacementSystem';
import { collectChest, hasActiveBonus, decrementBonuses } from '../../src/game/ChestSystem';
import { eliminatePlayer, checkVictory } from '../../src/game/PlayerManager';
import { calculateValidPlacements } from '../../src/game/GridLogic';
import { createInitialGameState } from '../../src/game/GameStateFactory';

// ─── Full Turn Flow ──────────────────────────────────────────

describe('Full Turn Flow', () => {
  describe('Option A: Expand Only', () => {
    it('should set turn phase to placing with 0 attacks', () => {
      const result = selectTurnOption('A');
      expect(result.turnPhase).toBe('placing');
      expect(result.attacksRemaining).toBe(0);
    });

    it('dice roll of 4 with no speed bonus gives 4 placement points', () => {
      expect(calculatePlacementPoints(4, false)).toBe(4);
    });

    it('should calculate valid placements adjacent to castle', () => {
      const { grid, gameState } = new GameStateBuilder()
        .withPlayer('p1', 'P1', 'blue', 5, 5)
        .withPlayer('p2', 'P2', 'yellow', 15, 15)
        .build();
      const placements = calculateValidPlacements(grid, 'p1', 18, 18);
      expect(placements.size).toBeGreaterThan(0);
      // Should include tiles adjacent to 2x2 castle
      expect(placements.has('4,5')).toBe(true);
      expect(placements.has('5,4')).toBe(true);
    });

    it('placing units should decrement points until 0', () => {
      const { grid, gameState } = new GameStateBuilder()
        .withPlayer('p1', 'P1', 'blue', 1, 1)
        .withPlayer('p2', 'P2', 'yellow', 15, 15)
        .build();

      let points = 3;
      // Place 3 units adjacent to castle
      placeUnit(grid, gameState, 3, 1, 'p1');
      points--;
      expect(points).toBe(2);
      expect(grid[1][3].type).toBe('unit');
      expect(grid[1][3].ownerId).toBe('p1');

      placeUnit(grid, gameState, 1, 3, 'p1');
      points--;
      expect(points).toBe(1);

      placeUnit(grid, gameState, 0, 1, 'p1');
      points--;
      expect(points).toBe(0);
      expect(gameState.players['p1'].unitCount).toBe(3);
    });

    it('should advance to next player after turn ends', () => {
      const { nextPlayerIndex, newTurn } = advanceToNextPlayer(0, 2, 1);
      expect(nextPlayerIndex).toBe(1);
      expect(newTurn).toBe(1);
    });

    it('should increment turn counter after all players complete', () => {
      const { nextPlayerIndex, newTurn } = advanceToNextPlayer(1, 2, 1);
      expect(nextPlayerIndex).toBe(0);
      expect(newTurn).toBe(2);
    });
  });

  describe('Option B: 1 Attack + Expand', () => {
    it('selecting B sets attacking phase with 1 attack', () => {
      const result = selectTurnOption('B');
      expect(result.turnPhase).toBe('attacking');
      expect(result.attacksRemaining).toBe(1);
    });

    it('winning attack transitions to placement phase', () => {
      const phase = determineNextPhaseAfterCombat(true, 'B', 0, false);
      expect(phase).toBe('placing');
    });

    it('losing attack ends turn immediately', () => {
      const phase = determineNextPhaseAfterCombat(false, 'B', 0, false);
      expect(phase).toBe('done');
    });

    it('no attack targets falls through (auto Option A behavior)', () => {
      const { grid } = new GameStateBuilder()
        .withPlayer('p1', 'P1', 'blue', 1, 1)
        .withPlayer('p2', 'P2', 'yellow', 15, 15)
        .build();
      expect(playerHasAttackOptions(grid, 'p1', 18, 18)).toBe(false);
    });
  });

  describe('Option C: 2 Attacks', () => {
    it('selecting C sets attacking phase with 2 attacks', () => {
      const result = selectTurnOption('C');
      expect(result.turnPhase).toBe('attacking');
      expect(result.attacksRemaining).toBe(2);
    });

    it('winning first attack allows second when targets exist', () => {
      const phase = determineNextPhaseAfterCombat(true, 'C', 1, true);
      expect(phase).toBe('attacking');
    });

    it('losing first attack ends turn immediately', () => {
      const phase = determineNextPhaseAfterCombat(false, 'C', 1, true);
      expect(phase).toBe('done');
    });

    it('winning both attacks ends turn (no placement in C)', () => {
      const phase = determineNextPhaseAfterCombat(true, 'C', 0, false);
      expect(phase).toBe('done');
    });

    it('winning first but no second target ends turn', () => {
      const phase = determineNextPhaseAfterCombat(true, 'C', 1, false);
      expect(phase).toBe('done');
    });
  });
});

// ─── Combat Flow Integration ─────────────────────────────────

describe('Combat Flow Integration', () => {
  it('attacker with attack bonus should get +1 to roll', () => {
    const result = resolveCombatRolls(3, 3, true, false);
    expect(result.finalAttackerRoll).toBe(4);
    expect(result.finalDefenderRoll).toBe(3);
    expect(result.attackerWins).toBe(true);
  });

  it('defender with defense bonus should get +1 to roll', () => {
    const result = resolveCombatRolls(4, 3, false, true);
    expect(result.finalDefenderRoll).toBe(4);
    expect(result.isTie).toBe(true);
    expect(result.attackerWins).toBe(false);
  });

  it('attacking castle should reduce HP then eliminate at 0', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(14, 15, 'p1')
      .withCastleHP('p2', 1)
      .withTurnOrder(['p1', 'p2'])
      .build();

    const outcome = applyCombatResult(grid, gameState, { x: 14, y: 15 }, { x: 15, y: 15 }, true, 'p1');
    expect(outcome.castleDamaged).toBe(true);
    expect(outcome.eliminatedPlayer).toBe('p2');
    expect(gameState.players['p2'].isAlive).toBe(false);
    expect(gameState.turnOrder).not.toContain('p2');
  });

  it('attacking unit should convert to attacker ownership', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(5, 5, 'p1')
      .withUnitAt(6, 5, 'p2')
      .withTurnOrder(['p1', 'p2'])
      .build();

    const outcome = applyCombatResult(grid, gameState, { x: 5, y: 5 }, { x: 6, y: 5 }, true, 'p1');
    expect(outcome.unitCaptured).toBe(true);
    expect(grid[5][6].ownerId).toBe('p1');
    expect(gameState.players['p1'].unitCount).toBe(2); // original + captured
    expect(gameState.players['p2'].unitCount).toBe(0);
  });

  it('eliminated players units should be removed from grid', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(14, 15, 'p1')
      .withUnitAt(10, 10, 'p2')
      .withUnitAt(12, 12, 'p2')
      .withCastleHP('p2', 1)
      .withTurnOrder(['p1', 'p2'])
      .build();

    applyCombatResult(grid, gameState, { x: 14, y: 15 }, { x: 15, y: 15 }, true, 'p1');

    // P2's units should be cleared
    expect(grid[10][10].type).toBe('empty');
    expect(grid[10][10].ownerId).toBeNull();
    expect(grid[12][12].type).toBe('empty');
  });

  it('victory should be detected when one player remains', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withUnitAt(14, 15, 'p1')
      .withCastleHP('p2', 1)
      .withTurnOrder(['p1', 'p2'])
      .build();

    applyCombatResult(grid, gameState, { x: 14, y: 15 }, { x: 15, y: 15 }, true, 'p1');
    const winner = checkVictory(gameState.turnOrder);
    expect(winner).toBe('p1');
  });
});

// ─── Placement Flow Integration ──────────────────────────────

describe('Placement Flow Integration', () => {
  it('new units should expand the valid placement frontier', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .build();

    // Initial frontier from castle
    const before = calculateValidPlacements(grid, 'p1', 18, 18);

    // Place a unit at an edge position
    placeUnit(grid, gameState, 3, 1, 'p1');

    // Frontier should now include neighbors of the new unit
    const after = calculateValidPlacements(grid, 'p1', 18, 18);
    expect(after.has('4,1')).toBe(true);
    expect(after.size).toBeGreaterThan(before.size);
  });

  it('placing unit on chest should collect bonus and add to player', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withChestAt(3, 1, 'attack')
      .build();

    const result = placeUnit(grid, gameState, 3, 1, 'p1');
    expect(result.chestCollected).toBe(true);
    expect(result.chestBonusType).toBe('attack');
    expect(gameState.players['p1'].activeBonuses.length).toBe(1);
    expect(gameState.players['p1'].activeBonuses[0].type).toBe('attack');
  });

  it('speed bonus should add +2 to dice roll for placement', () => {
    expect(calculatePlacementPoints(3, true)).toBe(5);
    expect(calculatePlacementPoints(6, true)).toBe(8);
    expect(calculatePlacementPoints(1, true)).toBe(3);
  });

  it('placement on bridge should be allowed', () => {
    const { grid } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withBridgeAt(5, 5)
      .build();

    const placements = calculateValidPlacements(grid, 'p1', 18, 18);
    // Bridge at (5,5) - if not adjacent to owned territory, won't appear
    // Put a unit adjacent to make it reachable
    setUnit(grid, 5, 4, 'p1');
    const placementsAfter = calculateValidPlacements(grid, 'p1', 18, 18);
    expect(placementsAfter.has('5,5')).toBe(true);
  });

  it('placement on river should be rejected', () => {
    const { grid } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withRiverAt(5, 5)
      .build();

    setUnit(grid, 5, 4, 'p1');
    const placements = calculateValidPlacements(grid, 'p1', 18, 18);
    expect(placements.has('5,5')).toBe(false);
  });
});

// ─── Bonus Lifecycle Integration ─────────────────────────────

describe('Bonus Lifecycle Integration', () => {
  it('collecting attack chest gives 3 turns of +1 attack', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withChestAt(3, 1, 'attack')
      .build();

    placeUnit(grid, gameState, 3, 1, 'p1');
    const player = gameState.players['p1'];
    expect(hasActiveBonus(player, 'attack')).toBe(true);
    expect(player.activeBonuses[0].turnsRemaining).toBe(3);
  });

  it('bonus should expire after 3 turns via decrementBonuses', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withPlayerBonus('p1', 'attack', 3)
      .build();

    const player = gameState.players['p1'];
    decrementBonuses(player); // turns: 3→2
    expect(hasActiveBonus(player, 'attack')).toBe(true);
    decrementBonuses(player); // turns: 2→1
    expect(hasActiveBonus(player, 'attack')).toBe(true);
    decrementBonuses(player); // turns: 1→0, removed
    expect(hasActiveBonus(player, 'attack')).toBe(false);
    expect(player.activeBonuses.length).toBe(0);
  });

  it('bridge bonus has 2 uses, not turn-limited', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withChestAt(3, 1, 'bridge')
      .build();

    placeUnit(grid, gameState, 3, 1, 'p1');
    const player = gameState.players['p1'];
    expect(player.activeBonuses[0].turnsRemaining).toBe(99);
    expect(player.activeBonuses[0].usesRemaining).toBe(2);

    // Decrementing turns should NOT remove bridge bonus (uses still > 0)
    decrementBonuses(player);
    expect(hasActiveBonus(player, 'bridge')).toBe(true);
  });

  it('multiple bonuses active simultaneously should all be tracked', () => {
    const { gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withPlayerBonus('p1', 'attack', 3)
      .withPlayerBonus('p1', 'defense', 2)
      .withPlayerBonus('p1', 'speed', 1)
      .build();

    const player = gameState.players['p1'];
    expect(hasActiveBonus(player, 'attack')).toBe(true);
    expect(hasActiveBonus(player, 'defense')).toBe(true);
    expect(hasActiveBonus(player, 'speed')).toBe(true);

    decrementBonuses(player); // speed expires (1→0), others decrement
    expect(hasActiveBonus(player, 'attack')).toBe(true);
    expect(hasActiveBonus(player, 'defense')).toBe(true);
    expect(hasActiveBonus(player, 'speed')).toBe(false);
    expect(player.activeBonuses.length).toBe(2);
  });
});

// ─── Turn Order Determination ────────────────────────────────

describe('Turn Order Determination', () => {
  it('highest roller goes first', () => {
    const order = finalizeTurnOrder([
      { playerId: 'p1', roll: 2 },
      { playerId: 'p2', roll: 6 },
      { playerId: 'p3', roll: 4 },
    ]);
    expect(order[0]).toBe('p2');
    expect(order[1]).toBe('p3');
    expect(order[2]).toBe('p1');
  });

  it('turn order persists through gameplay', () => {
    const order = finalizeTurnOrder([
      { playerId: 'p1', roll: 5 },
      { playerId: 'p2', roll: 3 },
    ]);
    // Order stays the same across turns
    expect(order).toEqual(['p1', 'p2']);
  });
});

// ─── Multi-Player Elimination Scenario ───────────────────────

describe('Multi-Player Elimination Scenario', () => {
  it('4→3 players: eliminated player removed, index adjusted', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 1)
      .withPlayer('p3', 'P3', 'green', 1, 15)
      .withPlayer('p4', 'P4', 'red', 15, 15)
      .withTurnOrder(['p1', 'p2', 'p3', 'p4'])
      .withCurrentPlayerIndex(0)
      .build();

    eliminatePlayer(grid, gameState, 'p3', { x: 1, y: 15 }, 18, 18);
    expect(gameState.turnOrder.length).toBe(3);
    expect(gameState.turnOrder).not.toContain('p3');
  });

  it('3→2 players: another elimination', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 1)
      .withPlayer('p4', 'P4', 'red', 15, 15)
      .withTurnOrder(['p1', 'p2', 'p4'])
      .withCurrentPlayerIndex(0)
      .build();

    eliminatePlayer(grid, gameState, 'p2', { x: 15, y: 1 }, 18, 18);
    expect(gameState.turnOrder.length).toBe(2);
    expect(gameState.turnOrder).toEqual(['p1', 'p4']);
  });

  it('2→1 players: final elimination triggers victory', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p4', 'P4', 'red', 15, 15)
      .withTurnOrder(['p1', 'p4'])
      .withCurrentPlayerIndex(0)
      .build();

    eliminatePlayer(grid, gameState, 'p4', { x: 15, y: 15 }, 18, 18);
    expect(gameState.turnOrder.length).toBe(1);
    const winner = checkVictory(gameState.turnOrder);
    expect(winner).toBe('p1');
  });
});

// ─── Chest System Integration ────────────────────────────────

describe('Chest System Integration', () => {
  it('collecting chest while placing should add bonus to player', () => {
    const { grid, gameState } = new GameStateBuilder()
      .withPlayer('p1', 'P1', 'blue', 1, 1)
      .withPlayer('p2', 'P2', 'yellow', 15, 15)
      .withChestAt(3, 1, 'defense')
      .build();

    const result = placeUnit(grid, gameState, 3, 1, 'p1');
    expect(result.chestCollected).toBe(true);
    expect(gameState.players['p1'].activeBonuses[0].type).toBe('defense');
    // Cell should become unit after placement
    expect(grid[1][3].type).toBe('unit');
    expect(grid[1][3].ownerId).toBe('p1');
  });

  it('chest bonus should affect combat rolls', () => {
    // Player has attack bonus: +1 to roll
    const result = resolveCombatRolls(3, 4, true, false);
    // 3+1=4 vs 4: tie → defender wins
    expect(result.attackerWins).toBe(false);
    expect(result.isTie).toBe(true);

    // Without bonus: 3 vs 4 → defender wins outright
    const result2 = resolveCombatRolls(3, 4, false, false);
    expect(result2.attackerWins).toBe(false);
    expect(result2.isTie).toBe(false);
  });
});

// ─── Game State Factory Integration ──────────────────────────

describe('Game State Factory Integration', () => {
  it('creates a valid 4-player flat game', () => {
    const { grid, gameState } = createInitialGameState(4, 'flat');
    expect(grid.length).toBe(18);
    expect(grid[0].length).toBe(18);
    expect(Object.keys(gameState.players).length).toBe(4);
    expect(gameState.turnOrder.length).toBe(4);
    expect(gameState.currentTurn).toBe(1);
    expect(gameState.chests.length).toBe(0);

    // All castles at HP 4
    for (const player of Object.values(gameState.players)) {
      expect(player.castleHP).toBe(4);
      expect(player.isAlive).toBe(true);
      expect(player.unitCount).toBe(0);
    }
  });

  it('creates a valid 2-player river game with terrain', () => {
    const { grid, gameState } = createInitialGameState(2, 'river');
    expect(Object.keys(gameState.players).length).toBe(2);

    // Should have river tiles in center
    const centerX = 9;
    expect(grid[0][centerX].type).toBe('river');

    // Should have bridge tiles
    expect(grid[4][centerX].type).toBe('bridge');
  });
});
