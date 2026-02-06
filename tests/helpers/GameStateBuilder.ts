import {
  GameState,
  PlayerState,
  PlayerColor,
  BonusType,
  ChestState,
  GridCell,
  Position,
} from '../../src/types/GameTypes';
import { createEmptyGrid, setCastle, setUnit, setCell } from './GridBuilder';

const DEFAULT_WIDTH = 18;
const DEFAULT_HEIGHT = 18;

function createPlayer(
  id: string,
  displayName: string,
  color: PlayerColor,
  castlePosition: Position
): PlayerState {
  return {
    id,
    displayName,
    color,
    castleHP: 4,
    castleMaxHP: 4,
    castleFirstDamageTurn: null,
    castlePosition,
    activeBonuses: [],
    isAlive: true,
    isConnected: true,
    unitCount: 0,
    level: 1,
  };
}

export class GameStateBuilder {
  private grid: GridCell[][];
  private players: Record<string, PlayerState> = {};
  private turnOrder: string[] = [];
  private currentPlayerIndex = 0;
  private currentTurn = 1;
  private chests: ChestState[] = [];
  private gridWidth: number;
  private gridHeight: number;

  constructor(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    this.gridWidth = width;
    this.gridHeight = height;
    this.grid = createEmptyGrid(width, height);
  }

  withPlayer(
    id: string,
    displayName: string,
    color: PlayerColor,
    castleX: number,
    castleY: number
  ): this {
    const player = createPlayer(id, displayName, color, { x: castleX, y: castleY });
    this.players[id] = player;
    this.turnOrder.push(id);
    setCastle(this.grid, castleX, castleY, id);
    return this;
  }

  withCastleHP(playerId: string, hp: number): this {
    this.players[playerId].castleHP = hp;
    return this;
  }

  withPlayerBonus(playerId: string, bonusType: BonusType, turnsRemaining: number, usesRemaining?: number): this {
    this.players[playerId].activeBonuses.push({
      type: bonusType,
      turnsRemaining,
      usesRemaining,
    });
    return this;
  }

  withUnitAt(x: number, y: number, playerId: string): this {
    setUnit(this.grid, x, y, playerId);
    this.players[playerId].unitCount++;
    return this;
  }

  withRiverAt(x: number, y: number): this {
    setCell(this.grid, x, y, { type: 'river' });
    return this;
  }

  withMountainAt(x: number, y: number): this {
    setCell(this.grid, x, y, { type: 'mountain' });
    return this;
  }

  withBridgeAt(x: number, y: number): this {
    setCell(this.grid, x, y, { type: 'bridge' });
    return this;
  }

  withChestAt(x: number, y: number, bonusType: BonusType): this {
    setCell(this.grid, x, y, { type: 'chest' });
    this.chests.push({ x, y, bonusType, isCollected: false });
    return this;
  }

  withTurnOrder(order: string[]): this {
    this.turnOrder = order;
    return this;
  }

  withCurrentPlayerIndex(index: number): this {
    this.currentPlayerIndex = index;
    return this;
  }

  withCurrentTurn(turn: number): this {
    this.currentTurn = turn;
    return this;
  }

  build(): { grid: GridCell[][]; gameState: GameState } {
    const gameState: GameState = {
      gameId: 'test-game',
      status: 'playing',
      mapType: 'flat',
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      turnTimerSeconds: 10,
      currentTurn: this.currentTurn,
      currentPlayerIndex: this.currentPlayerIndex,
      turnOrder: this.turnOrder,
      grid: this.grid,
      players: this.players,
      rebels: null,
      chests: this.chests,
      rebelSpawnCountdown: 10,
      winner: null,
    };
    return { grid: this.grid, gameState };
  }
}
