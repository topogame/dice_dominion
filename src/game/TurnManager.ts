/**
 * Dice Dominion - Turn Management Logic
 * Pure functions, NO Phaser dependencies.
 */

import { GridCell } from '../types/GameTypes';

/**
 * Sort players by roll descending. Returns ordered player IDs.
 * Highest roller goes first.
 */
export function finalizeTurnOrder(
  rolls: { playerId: string; roll: number }[]
): string[] {
  return [...rolls]
    .sort((a, b) => b.roll - a.roll)
    .map((r) => r.playerId);
}

/**
 * Map turn option to phase and attacks.
 * A → place only (0 attacks)
 * B → attack once then place
 * C → attack twice (no placements)
 */
export function selectTurnOption(
  option: 'A' | 'B' | 'C'
): { turnPhase: 'placing' | 'attacking'; attacksRemaining: number } {
  switch (option) {
    case 'A':
      return { turnPhase: 'placing', attacksRemaining: 0 };
    case 'B':
      return { turnPhase: 'attacking', attacksRemaining: 1 };
    case 'C':
      return { turnPhase: 'attacking', attacksRemaining: 2 };
  }
}

/**
 * Advance to next player. Returns new index and turn number.
 * When the index wraps back to 0, the turn counter increments.
 */
export function advanceToNextPlayer(
  currentPlayerIndex: number,
  turnOrderLength: number,
  currentTurn: number
): { nextPlayerIndex: number; newTurn: number } {
  const nextPlayerIndex = (currentPlayerIndex + 1) % turnOrderLength;
  const newTurn = nextPlayerIndex === 0 ? currentTurn + 1 : currentTurn;
  return { nextPlayerIndex, newTurn };
}

// Cardinal direction offsets: up, down, left, right
const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/**
 * Check if player has any attack options.
 * Returns true if any owned unit or castle cell is adjacent to an enemy unit or castle.
 */
export function playerHasAttackOptions(
  grid: GridCell[][],
  currentPlayerId: string,
  gridWidth: number,
  gridHeight: number
): boolean {
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cell = grid[y][x];
      if (cell.ownerId !== currentPlayerId) continue;
      if (cell.type !== 'unit' && cell.type !== 'castle') continue;

      for (const { dx, dy } of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;

        const neighbor = grid[ny][nx];
        if (
          neighbor.ownerId !== null &&
          neighbor.ownerId !== currentPlayerId &&
          (neighbor.type === 'unit' || neighbor.type === 'castle')
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Find enemies adjacent to a specific unit position.
 * Returns a Set of "x,y" strings for each attackable enemy cell.
 */
export function calculateAttackableEnemies(
  grid: GridCell[][],
  unitX: number,
  unitY: number,
  currentPlayerId: string,
  gridWidth: number,
  gridHeight: number
): Set<string> {
  const enemies = new Set<string>();

  for (const { dx, dy } of DIRECTIONS) {
    const nx = unitX + dx;
    const ny = unitY + dy;
    if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;

    const neighbor = grid[ny][nx];
    if (
      neighbor.ownerId !== null &&
      neighbor.ownerId !== currentPlayerId &&
      (neighbor.type === 'unit' || neighbor.type === 'castle')
    ) {
      enemies.add(`${nx},${ny}`);
    }
  }

  return enemies;
}
