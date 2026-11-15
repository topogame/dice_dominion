import { GameState, GridCell, PlayerColor } from '../types/GameTypes';
import { generateTerrain, placeCastle } from './GridLogic';

const PLAYER_CONFIGS: { id: string; displayName: string; color: PlayerColor }[] = [
  { id: 'player1', displayName: 'Player 1', color: 'blue' },
  { id: 'player2', displayName: 'Player 2', color: 'yellow' },
  { id: 'player3', displayName: 'Player 3', color: 'green' },
  { id: 'player4', displayName: 'Player 4', color: 'red' },
];

export function createInitialGameState(
  playerCount: number,
  mapType: string,
  gridWidth: number = 10,
  gridHeight: number = 14,
  /** Empty tiles between each castle and the board edge. 0 puts castles in the very corners. */
  castleInset: number = 1
): { grid: GridCell[][]; gameState: GameState } {
  // Create empty grid
  const grid: GridCell[][] = [];
  for (let y = 0; y < gridHeight; y++) {
    grid[y] = [];
    for (let x = 0; x < gridWidth; x++) {
      grid[y][x] = { x, y, type: 'empty', ownerId: null, isCastle: false };
    }
  }

  // Generate terrain
  generateTerrain(grid, mapType, gridWidth, gridHeight);

  // Place castles based on player count
  const castlePositions = getCastlePositions(playerCount, gridWidth, gridHeight, castleInset);
  const activePlayers = PLAYER_CONFIGS.slice(0, playerCount);
  const players: Record<string, any> = {};
  const turnOrder: string[] = [];

  activePlayers.forEach((config, index) => {
    const pos = castlePositions[index];
    placeCastle(grid, pos.x, pos.y, config.id);
    players[config.id] = {
      id: config.id,
      displayName: config.displayName,
      color: config.color,
      castleHP: 4,
      castleMaxHP: 4,
      castleFirstDamageTurn: null,
      castlePosition: pos,
      activeBonuses: [],
      isAlive: true,
      isConnected: true,
      unitCount: 0,
      level: 1,
    };
    turnOrder.push(config.id);
  });

  const gameState: GameState = {
    gameId: `game-${Date.now()}`,
    status: 'playing',
    mapType: mapType as any,
    gridWidth,
    gridHeight,
    turnTimerSeconds: 10,
    currentTurn: 1,
    currentPlayerIndex: 0,
    turnOrder,
    grid,
    players,
    rebels: null,
    chests: [],
    rebelSpawnCountdown: 10,
    winner: null,
  };

  return { grid, gameState };
}

function getCastlePositions(
  playerCount: number,
  gridWidth: number,
  gridHeight: number,
  inset: number
): { x: number; y: number }[] {
  // A castle covers 2x2 tiles, so its far-side anchor sits 2 + inset from the edge.
  const near = inset;
  const farX = gridWidth - 2 - inset;
  const farY = gridHeight - 2 - inset;

  if (playerCount === 2) {
    return [
      { x: near, y: farY },   // Blue: bottom-left
      { x: farX, y: near },   // Yellow: top-right
    ];
  }
  // 3-4 players: corners
  return [
    { x: near, y: near },     // Blue: top-left
    { x: farX, y: near },     // Yellow: top-right
    { x: near, y: farY },     // Green: bottom-left
    { x: farX, y: farY },     // Red: bottom-right
  ].slice(0, playerCount);
}
