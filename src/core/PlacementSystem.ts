import { GridCell, GameState, BonusType } from '../types/GameTypes';
import { collectChest } from './ChestSystem';

export function placeUnit(
  grid: GridCell[][],
  gameState: GameState,
  x: number,
  y: number,
  currentPlayerId: string
): { chestCollected: boolean; chestBonusType?: BonusType } {
  const cell = grid[y][x];
  let chestCollected = false;
  let chestBonusType: BonusType | undefined;

  if (cell.type === 'chest') {
    const result = collectChest(gameState, x, y, currentPlayerId);
    if (result) {
      chestCollected = true;
      chestBonusType = result.bonusType;
    }
  }

  cell.type = 'unit';
  cell.ownerId = currentPlayerId;
  gameState.players[currentPlayerId].unitCount++;

  return { chestCollected, chestBonusType };
}

export function calculatePlacementPoints(diceValue: number, hasSpeedBonus: boolean): number {
  return diceValue + (hasSpeedBonus ? 2 : 0);
}
