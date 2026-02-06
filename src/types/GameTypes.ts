/**
 * Dice Dominion - Game Type Definitions
 * Phaser 3 Version
 */

// Position type (x, y coordinates)
export interface Position {
  x: number;
  y: number;
}

// Grid cell types
export type CellType =
  | 'empty'      // Empty cell
  | 'unit'       // Soldier unit
  | 'castle'     // Castle
  | 'river'      // River (impassable)
  | 'mountain'   // Mountain (impassable)
  | 'bridge'     // Bridge
  | 'chest';     // Treasure chest

// Single grid cell
export interface GridCell {
  x: number;
  y: number;
  type: CellType;
  ownerId: string | null;  // Player ID, 'rebel' or null
  isCastle: boolean;
}

// Player colors
export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';

// Bonus types
export type BonusType = 'defense' | 'attack' | 'speed' | 'bridge';

// Active bonus
export interface ActiveBonus {
  type: BonusType;
  turnsRemaining: number;
  usesRemaining?: number;  // Only for 'bridge' (max 2)
}

// Player state
export interface PlayerState {
  id: string;
  displayName: string;
  color: PlayerColor;
  castleHP: number;           // 0-4
  castleMaxHP: 4;
  castleFirstDamageTurn: number | null;
  castlePosition: Position;   // Top-left corner of 2x2 castle
  activeBonuses: ActiveBonus[];
  isAlive: boolean;
  isConnected: boolean;
  unitCount: number;
  level: number;
}

// Rebel state
export interface RebelState {
  units: Position[];
  activeBonuses: ActiveBonus[];
}

// Treasure chest state
export interface ChestState {
  x: number;
  y: number;
  bonusType: BonusType;
  isCollected: boolean;
}

// Map types
export type MapType = 'flat' | 'river' | 'mountain';

// Game status
export type GameStatus = 'waiting' | 'playing' | 'finished';

// Main game state
export interface GameState {
  gameId: string;
  status: GameStatus;
  mapType: MapType;
  gridWidth: number;          // 24 or 28
  gridHeight: number;         // 12
  turnTimerSeconds: 10 | 15;
  currentTurn: number;
  currentPlayerIndex: number;
  turnOrder: string[];        // Sorted player IDs

  grid: GridCell[][];         // 2D grid state
  players: Record<string, PlayerState>;
  rebels: RebelState | null;
  chests: ChestState[];

  rebelSpawnCountdown: number;
  winner: string | null;
}

// Player actions
export type PlayerAction =
  | { type: 'expand'; placements: Position[] }
  | { type: 'attackAndExpand'; attackFrom: Position; attackTarget: Position; placements: Position[] }
  | { type: 'doubleAttack'; attack1From: Position; attack1Target: Position; attack2From: Position; attack2Target: Position }
  | { type: 'skipTurn' };

// Turn options
export type TurnOption = 'A' | 'B' | 'C';

// Colors for rendering
export const PlayerColors: Record<PlayerColor, number> = {
  blue: 0x4488ff,
  red: 0xff4444,
  green: 0x44cc44,
  yellow: 0xffcc00,
};

export const TerrainColors = {
  grass: {
    base: 0x4a7c34,
    light: 0x5a8c44,
    dark: 0x3a6c24,
  },
  water: {
    base: 0x3a7ca5,
    light: 0x5a9cc5,
  },
  rock: {
    base: 0x5a5a6a,
    light: 0x7a7a8a,
    dark: 0x3a3a4a,
  },
  wood: {
    base: 0x8b7355,
    plank: 0xa08060,
  },
};
