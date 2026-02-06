import { GridCell, GameState, Position } from '../types/GameTypes';

export function eliminatePlayer(
  grid: GridCell[][],
  gameState: GameState,
  playerId: string,
  castlePos: Position,
  gridWidth: number,
  gridHeight: number
): void {
  // Clear castle cells
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      const cell = grid[castlePos.y + dy][castlePos.x + dx];
      cell.type = 'empty';
      cell.ownerId = null;
      cell.isCastle = false;
    }
  }

  // Remove all units
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (grid[y][x].ownerId === playerId) {
        grid[y][x].type = 'empty';
        grid[y][x].ownerId = null;
      }
    }
  }

  // Remove from turn order
  const idx = gameState.turnOrder.indexOf(playerId);
  if (idx !== -1) {
    gameState.turnOrder.splice(idx, 1);
    if (idx < gameState.currentPlayerIndex) {
      gameState.currentPlayerIndex--;
    } else if (idx === gameState.currentPlayerIndex && gameState.currentPlayerIndex >= gameState.turnOrder.length) {
      gameState.currentPlayerIndex = 0;
    }
  }

  // Mark dead
  gameState.players[playerId].isAlive = false;
}

export function checkVictory(turnOrder: string[]): string | null {
  if (turnOrder.length === 1) {
    return turnOrder[0];
  }
  return null;
}
