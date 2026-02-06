import { GameState, PlayerState, BonusType, GridCell } from '../types/GameTypes';

// Find a valid position to spawn a chest using injectable RNG.
export function findChestSpawnPosition(
  grid: GridCell[][],
  players: Record<string, PlayerState>,
  gridWidth: number,
  gridHeight: number,
  minCastleDistance: number,
  rng: () => number  // returns 0-1
): { x: number; y: number } | null {
  let attempts = 0;
  while (attempts < 100) {
    const x = Math.floor(rng() * gridWidth);
    const y = Math.floor(rng() * gridHeight);
    const cell = grid[y][x];
    if (cell.type === 'empty' && !isNearAnyCastle(players, x, y, minCastleDistance)) {
      return { x, y };
    }
    attempts++;
  }
  return null;
}

function isNearAnyCastle(players: Record<string, PlayerState>, x: number, y: number, distance: number): boolean {
  for (const player of Object.values(players)) {
    const cp = player.castlePosition;
    for (let cx = 0; cx < 2; cx++) {
      for (let cy = 0; cy < 2; cy++) {
        if (Math.abs(x - (cp.x + cx)) <= distance && Math.abs(y - (cp.y + cy)) <= distance) {
          return true;
        }
      }
    }
  }
  return false;
}

// Collect a chest at position. Returns bonus info or null.
export function collectChest(
  gameState: GameState,
  x: number,
  y: number,
  playerId: string
): { bonusType: BonusType; bonusName: string } | null {
  const chestIndex = gameState.chests.findIndex(c => c.x === x && c.y === y && !c.isCollected);
  if (chestIndex === -1) return null;

  const chest = gameState.chests[chestIndex];
  chest.isCollected = true;

  const player = gameState.players[playerId];
  const bonusNames: Record<BonusType, string> = {
    defense: 'Defense Shield',
    attack: 'Attack Boost',
    speed: 'Speed Bonus',
    bridge: 'Bridge Builder',
  };

  player.activeBonuses.push({
    type: chest.bonusType,
    turnsRemaining: chest.bonusType === 'bridge' ? 99 : 3,
    usesRemaining: chest.bonusType === 'bridge' ? 2 : undefined,
  });

  return { bonusType: chest.bonusType, bonusName: bonusNames[chest.bonusType] };
}

// Check if a player has an active bonus of a specific type.
export function hasActiveBonus(player: PlayerState, bonusType: BonusType): boolean {
  return player.activeBonuses.some(b => b.type === bonusType && b.turnsRemaining > 0);
}

// Decrement bonuses at end of turn. Removes expired ones.
export function decrementBonuses(player: PlayerState): void {
  player.activeBonuses = player.activeBonuses.filter(bonus => {
    if (bonus.type === 'bridge') {
      return (bonus.usesRemaining ?? 0) > 0;
    }
    bonus.turnsRemaining--;
    return bonus.turnsRemaining > 0;
  });
}
