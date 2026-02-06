/**
 * Dice Dominion - Oyun Tip Tanımlamaları
 *
 * Bu dosya oyundaki tüm TypeScript tip tanımlamalarını içerir.
 * Izgara hücreleri, oyuncu durumları, bonus türleri vb.
 */

// Pozisyon tipi (x, y koordinatları)
export interface Position {
  x: number;
  y: number;
}

// Izgara hücre türleri
export type CellType =
  | 'empty'      // Boş hücre
  | 'unit'       // Asker birimi
  | 'castle'     // Kale
  | 'river'      // Nehir (geçilemez)
  | 'mountain'   // Dağ (geçilemez)
  | 'bridge'     // Köprü
  | 'chest';     // Hazine sandığı

// Tek bir ızgara hücresi
export interface GridCell {
  x: number;
  y: number;
  type: CellType;
  ownerId: string | null;  // Oyuncu ID, 'rebel' veya null
  isCastle: boolean;
}

// Oyuncu renkleri
export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';

// Bonus türleri
export type BonusType = 'defense' | 'attack' | 'speed' | 'bridge';

// Aktif bonus
export interface ActiveBonus {
  type: BonusType;
  turnsRemaining: number;
  usesRemaining?: number;  // Sadece 'bridge' için (max 2)
}

// Oyuncu durumu
export interface PlayerState {
  id: string;
  displayName: string;
  color: PlayerColor;
  castleHP: number;           // 0-4
  castleMaxHP: 4;
  castleFirstDamageTurn: number | null;
  castlePosition: Position;   // 2x2 kalenin sol üst köşesi
  activeBonuses: ActiveBonus[];
  isAlive: boolean;
  isConnected: boolean;
  unitCount: number;
  level: number;
}

// İsyancı durumu
export interface RebelState {
  units: Position[];
  activeBonuses: ActiveBonus[];
}

// Hazine sandığı durumu
export interface ChestState {
  x: number;
  y: number;
  bonusType: BonusType;
  isCollected: boolean;
}

// Harita türleri
export type MapType = 'flat' | 'river' | 'mountain';

// Oyun durumu
export type GameStatus = 'waiting' | 'playing' | 'finished';

// Ana oyun durumu
export interface GameState {
  gameId: string;
  status: GameStatus;
  mapType: MapType;
  gridWidth: number;          // 24 veya 28
  gridHeight: number;         // 12
  turnTimerSeconds: 10 | 15;
  currentTurn: number;
  currentPlayerIndex: number;
  turnOrder: string[];        // Oyuncu ID'leri sıralı

  grid: GridCell[][];         // 2D ızgara durumu
  players: Record<string, PlayerState>;
  rebels: RebelState | null;
  chests: ChestState[];

  rebelSpawnCountdown: number;
  winner: string | null;
}

// Oyuncu aksiyonları
export type PlayerAction =
  | { type: 'expand'; placements: Position[] }
  | { type: 'attackAndExpand'; attackFrom: Position; attackTarget: Position; placements: Position[] }
  | { type: 'doubleAttack'; attack1From: Position; attack1Target: Position; attack2From: Position; attack2Target: Position }
  | { type: 'skipTurn' };

// Tur seçenekleri
export type TurnOption = 'A' | 'B' | 'C';
