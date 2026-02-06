import { GridCell, GameState, Position } from '../types/GameTypes';

// ─── Combat Roll Resolution ─────────────────────────────────

export interface CombatResult {
  attackerRoll: number;
  defenderRoll: number;
  attackBonus: number;
  defenseBonus: number;
  finalAttackerRoll: number;
  finalDefenderRoll: number;
  attackerWins: boolean;
  isTie: boolean;
}

/**
 * Given raw dice rolls and bonus flags, compute the combat result.
 * Tie goes to defender.
 */
export function resolveCombatRolls(
  attackerRoll: number,
  defenderRoll: number,
  hasAttackBonus: boolean,
  hasDefenseBonus: boolean
): CombatResult {
  const attackBonus = hasAttackBonus ? 1 : 0;
  const defenseBonus = hasDefenseBonus ? 1 : 0;
  const finalAttackerRoll = attackerRoll + attackBonus;
  const finalDefenderRoll = defenderRoll + defenseBonus;
  const isTie = finalAttackerRoll === finalDefenderRoll;
  const attackerWins = finalAttackerRoll > finalDefenderRoll;

  return {
    attackerRoll,
    defenderRoll,
    attackBonus,
    defenseBonus,
    finalAttackerRoll,
    finalDefenderRoll,
    attackerWins,
    isTie,
  };
}

// ─── Combat Outcome Application ─────────────────────────────

export interface CombatOutcome {
  eliminatedPlayer?: string;
  castleDamaged?: boolean;
  newCastleHP?: number;
  unitCaptured?: boolean;
  attackerDestroyed?: boolean;
}

/**
 * Apply the result of combat to the game state (grid + gameState).
 * Returns a descriptor of what happened so the UI layer can display it.
 */
export function applyCombatResult(
  grid: GridCell[][],
  gameState: GameState,
  attackerPos: Position,
  defenderPos: Position,
  attackerWins: boolean,
  currentPlayerId: string
): CombatOutcome {
  const currentPlayer = gameState.players[currentPlayerId];

  if (attackerWins) {
    const defenderCell = grid[defenderPos.y][defenderPos.x];
    const defenderId = defenderCell.ownerId!;
    const defender = gameState.players[defenderId];

    if (defenderCell.isCastle) {
      // Attacking castle: reduce HP
      defender.castleHP--;
      const outcome: CombatOutcome = {
        castleDamaged: true,
        newCastleHP: defender.castleHP,
      };

      // Check for elimination (castle destroyed)
      if (defender.castleHP <= 0) {
        eliminatePlayer(grid, gameState, defenderId);
        outcome.eliminatedPlayer = defenderId;
      }

      return outcome;
    } else {
      // Attacking a unit: convert ownership
      defender.unitCount--;
      defenderCell.ownerId = currentPlayerId;
      currentPlayer.unitCount++;

      return { unitCaptured: true };
    }
  } else {
    // Attacker loses: remove attacking unit
    const attackerCell = grid[attackerPos.y][attackerPos.x];
    attackerCell.type = 'empty';
    attackerCell.ownerId = null;
    currentPlayer.unitCount--;

    return { attackerDestroyed: true };
  }
}

// ─── Player Elimination ─────────────────────────────────────

/**
 * Eliminate a player from the game: clear all their cells, remove
 * from turn order, and mark as not alive.
 */
function eliminatePlayer(
  grid: GridCell[][],
  gameState: GameState,
  playerId: string
): void {
  const player = gameState.players[playerId];
  const castlePos = player.castlePosition;

  // Clear all 4 castle cells (2x2 starting at castlePosition)
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const cx = castlePos.x + dx;
      const cy = castlePos.y + dy;
      if (cy < grid.length && cx < grid[0].length) {
        grid[cy][cx].type = 'empty';
        grid[cy][cx].ownerId = null;
        grid[cy][cx].isCastle = false;
      }
    }
  }

  // Clear all cells owned by this player across the entire grid
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x].ownerId === playerId) {
        grid[y][x].type = 'empty';
        grid[y][x].ownerId = null;
      }
    }
  }

  // Remove from turn order and adjust currentPlayerIndex
  const turnOrderIndex = gameState.turnOrder.indexOf(playerId);
  if (turnOrderIndex !== -1) {
    gameState.turnOrder.splice(turnOrderIndex, 1);

    if (turnOrderIndex < gameState.currentPlayerIndex) {
      gameState.currentPlayerIndex--;
    }
    if (gameState.currentPlayerIndex >= gameState.turnOrder.length) {
      gameState.currentPlayerIndex = 0;
    }
  }

  // Mark player as eliminated
  player.isAlive = false;
}

// ─── Next Phase Determination ───────────────────────────────

/**
 * After combat resolves, determine what phase comes next.
 *
 * - If the attacker lost, the turn always ends ('done').
 * - Option B + won: proceed to placement phase.
 * - Option C + won + attacks remaining + has targets: continue attacking.
 * - Otherwise: turn ends.
 */
export function determineNextPhaseAfterCombat(
  attackerWon: boolean,
  selectedTurnOption: 'A' | 'B' | 'C',
  attacksRemaining: number,
  hasAttackOptions: boolean
): 'placing' | 'attacking' | 'done' {
  if (!attackerWon) {
    return 'done';
  }

  if (selectedTurnOption === 'B') {
    return 'placing';
  }

  if (selectedTurnOption === 'C' && attacksRemaining > 0 && hasAttackOptions) {
    return 'attacking';
  }

  return 'done';
}
