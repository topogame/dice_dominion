/**
 * Dice Dominion - Game Scene
 * Main gameplay scene with isometric grid
 */

import Phaser from 'phaser';
import {
  GridCell,
  GameState,
  PlayerColor,
  PlayerColors,
  TerrainColors,
  Position,
  ChestState,
  BonusType,
} from '../types/GameTypes';
import { GameSetupOptions } from './GameSetupScene';

// Grid adjustment parameters (editable via debug UI)
const GRID_CONFIG = {
  tileWidth: 60,      // Isometric tile width
  tileHeight: 18,     // Isometric tile height
  gridWidth: 18,      // Number of tiles horizontally
  gridHeight: 18,     // Number of tiles vertically
  offsetX: -10,       // Grid horizontal offset from center
  offsetY: -140,      // Grid vertical offset from center
  tileDepth: 0,       // 3D depth of tile sides
  rotation: 0,        // Grid rotation in degrees
};

// For backward compatibility (use GRID_CONFIG values)
const ISO_TILE_WIDTH = 60;
const ISO_TILE_HEIGHT = 18;
const GRID_WIDTH = 18;
const GRID_HEIGHT = 18;

// Castle adjustment parameters for each player (editable via debug UI)
const CASTLE_CONFIGS: Record<string, {
  offsetX: number;
  offsetY: number;
  scale: number;
  originX: number;
  originY: number;
  rotation: number;
}> = {
  player1: {  // Blue (top-left)
    offsetX: -3,
    offsetY: 30,
    scale: 0.12,
    originX: 0.5,
    originY: 0.9,
    rotation: 0,
  },
  player2: {  // Yellow (top-right, uses yellow instead of red)
    offsetX: 7,
    offsetY: 35,
    scale: 0.12,
    originX: 0.5,
    originY: 0.9,
    rotation: 0,
  },
  player3: {  // Blue (bottom-left, uses blue instead of green)
    offsetX: 7,
    offsetY: 30,
    scale: 0.13,
    originX: 0.6,
    originY: 0.9,
    rotation: 0,
  },
  player4: {  // Yellow (bottom-right)
    offsetX: 7,
    offsetY: 30,
    scale: 0.13,
    originX: 0.5,
    originY: 0.9,
    rotation: 1,
  },
};

export class GameScene extends Phaser.Scene {
  private grid: GridCell[][] = [];
  private tileSprites: Phaser.GameObjects.Container[][] = [];
  private gameState!: GameState;
  private gridContainer!: Phaser.GameObjects.Container;
  private castleContainer!: Phaser.GameObjects.Container;  // Separate container for castles (always on top)
  private selectedCell: Position | null = null;
  private validPlacements: Set<string> = new Set();
  private castleSprites: Map<string, Phaser.GameObjects.Image> = new Map();
  private activeMessages: Phaser.GameObjects.Text[] = [];

  // Game setup options
  private playerCount: number = 4;
  private mapType: 'flat' | 'river' | 'mountain' | 'bridge' = 'flat';

  // Game phase
  private gamePhase: 'turn_order' | 'playing' = 'turn_order';
  private turnOrderRolls: { playerId: string; roll: number }[] = [];
  private currentRollIndex: number = 0;

  // Turn option system (A = Expand, B = 1 Attack + Expand, C = 2 Attacks)
  private turnPhase: 'choosing' | 'attacking' | 'placing' | 'done' = 'choosing';
  private selectedTurnOption: 'A' | 'B' | 'C' | null = null;
  private attacksRemaining: number = 0;
  private attackWonThisTurn: boolean = false;

  // Dice state
  private diceValue: number = 0;
  private placementPoints: number = 0;  // How many units player can place this turn
  private diceContainer!: Phaser.GameObjects.Container;
  private diceSprite!: Phaser.GameObjects.Container;
  private isRolling: boolean = false;

  // Combat state
  private selectedUnitForAttack: Position | null = null;
  private attackableEnemies: Set<string> = new Set();
  private isInCombat: boolean = false;
  private combatTarget: Position | null = null;

  // Turn option UI
  private turnOptionContainer!: Phaser.GameObjects.Container;
  private rollDiceButton!: Phaser.GameObjects.Container;

  // Player panel HP hearts (for updating when castle takes damage)
  private playerHearts: Map<string, Phaser.GameObjects.Graphics[]> = new Map();

  // Chest sprites (keyed by "x,y")
  private chestSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSetupOptions): void {
    // Receive setup options from GameSetupScene
    if (data) {
      this.playerCount = data.playerCount || 4;
      this.mapType = data.mapType || 'flat';
    }
    console.log(`Starting game with ${this.playerCount} players on ${this.mapType} map`);
  }

  create(): void {
    // Reset game phase and turn state
    this.gamePhase = 'turn_order';
    this.turnOrderRolls = [];
    this.currentRollIndex = 0;
    this.diceValue = 0;
    this.placementPoints = 0;
    this.turnPhase = 'choosing';
    this.selectedTurnOption = null;
    this.attacksRemaining = 0;
    this.attackWonThisTurn = false;

    // Background
    this.createBackground();

    // Initialize game state
    this.initializeGameState();

    // Create the isometric grid
    this.createIsometricGrid();

    // Create UI
    this.createUI();

    // Create dice display
    this.createDiceUI();

    // Create turn option selection UI
    this.createTurnOptionUI();

    // Setup input handling
    this.setupInput();

    // Start turn order determination phase
    this.startTurnOrderPhase();
  }

  private createBackground(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Gradient background (sky)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x4a7c34, 0x4a7c34, 1);
    bg.fillRect(0, 0, width, height);

    // Try to load background image if available
    if (this.textures.exists('background')) {
      const bgImage = this.add.image(width / 2, height / 2, 'background');
      bgImage.setDisplaySize(width, height);
    }
  }

  private initializeGameState(): void {
    // Initialize empty grid
    this.grid = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        this.grid[y][x] = {
          x,
          y,
          type: 'empty',
          ownerId: null,
          isCastle: false,
        };
      }
    }

    // Add terrain based on map type
    this.generateTerrain();

    // Place castles based on player count
    // For 2 players: Blue at bottom-left, Yellow at top-right (diagonal)
    // For 3+ players: corners clockwise from top-left
    let playerConfigs: Array<{ id: string; name: string; color: PlayerColor; x: number; y: number }>;

    if (this.playerCount === 2) {
      playerConfigs = [
        { id: 'player1', name: 'Blue Kingdom', color: 'blue' as PlayerColor, x: 1, y: GRID_HEIGHT - 3 },
        { id: 'player2', name: 'Yellow Empire', color: 'yellow' as PlayerColor, x: GRID_WIDTH - 3, y: 1 },
      ];
    } else {
      playerConfigs = [
        { id: 'player1', name: 'Blue Kingdom', color: 'blue' as PlayerColor, x: 1, y: 1 },
        { id: 'player2', name: 'Yellow Empire', color: 'yellow' as PlayerColor, x: GRID_WIDTH - 3, y: 1 },
        { id: 'player3', name: 'Green Alliance', color: 'green' as PlayerColor, x: 1, y: GRID_HEIGHT - 3 },
        { id: 'player4', name: 'Red Dynasty', color: 'red' as PlayerColor, x: GRID_WIDTH - 3, y: GRID_HEIGHT - 3 },
      ];
    }

    // Only place castles for active players
    const activePlayers = this.playerCount === 2 ? playerConfigs : playerConfigs.slice(0, this.playerCount);
    activePlayers.forEach(p => this.placeCastle(p.x, p.y, p.id, p.color));

    // Build turn order based on player count
    const turnOrder = activePlayers.map(p => p.id);

    // Build players object
    const players: Record<string, GameState['players'][string]> = {};
    activePlayers.forEach(p => {
      players[p.id] = {
        id: p.id,
        displayName: p.name,
        color: p.color,
        castleHP: 4,
        castleMaxHP: 4,
        castleFirstDamageTurn: null,
        castlePosition: { x: p.x, y: p.y },
        activeBonuses: [],
        isAlive: true,
        isConnected: true,
        unitCount: 0,
        level: 1,
      };
    });

    // Initialize game state object
    this.gameState = {
      gameId: 'game-001',
      status: 'playing',
      mapType: this.mapType,
      gridWidth: GRID_WIDTH,
      gridHeight: GRID_HEIGHT,
      turnTimerSeconds: 15,
      currentTurn: 1,
      currentPlayerIndex: 0,
      turnOrder: turnOrder,
      grid: this.grid,
      players: players,
      rebels: null,
      chests: [],
      rebelSpawnCountdown: 10,
      winner: null,
    };
  }

  private generateTerrain(): void {
    const centerX = Math.floor(GRID_WIDTH / 2);
    const centerY = Math.floor(GRID_HEIGHT / 2);

    switch (this.mapType) {
      case 'river':
        // Vertical river through the center
        for (let y = 0; y < GRID_HEIGHT; y++) {
          this.grid[y][centerX - 1].type = 'river';
          this.grid[y][centerX].type = 'river';
        }
        // Add bridges
        this.grid[4][centerX - 1].type = 'bridge';
        this.grid[4][centerX].type = 'bridge';
        this.grid[GRID_HEIGHT - 5][centerX - 1].type = 'bridge';
        this.grid[GRID_HEIGHT - 5][centerX].type = 'bridge';
        break;

      case 'mountain':
        // Mountain ranges in the center
        for (let i = -2; i <= 2; i++) {
          for (let j = -1; j <= 1; j++) {
            const x = centerX + i;
            const y = centerY + j;
            if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
              this.grid[y][x].type = 'mountain';
            }
          }
        }
        break;

      case 'bridge':
        // Four rivers with bridges at crossings
        // Horizontal river
        for (let x = 3; x < GRID_WIDTH - 3; x++) {
          this.grid[centerY][x].type = 'river';
        }
        // Vertical river
        for (let y = 3; y < GRID_HEIGHT - 3; y++) {
          this.grid[y][centerX].type = 'river';
        }
        // Bridge at intersection
        this.grid[centerY][centerX].type = 'bridge';
        // Additional bridges
        this.grid[centerY][5].type = 'bridge';
        this.grid[centerY][GRID_WIDTH - 6].type = 'bridge';
        this.grid[5][centerX].type = 'bridge';
        this.grid[GRID_HEIGHT - 6][centerX].type = 'bridge';
        break;

      case 'flat':
      default:
        // No terrain modifications
        break;
    }
  }

  private placeCastle(x: number, y: number, playerId: string, color: PlayerColor): void {
    // 2x2 castle
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const cell = this.grid[y + dy][x + dx];
        cell.type = 'castle';
        cell.ownerId = playerId;
        cell.isCastle = true;
      }
    }
  }

  private createIsometricGrid(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Container for all grid elements (using GRID_CONFIG offsets)
    this.gridContainer = this.add.container(
      width / 2 + GRID_CONFIG.offsetX,
      height / 2 + GRID_CONFIG.offsetY
    );

    // Separate container for castles (always renders on top of tiles)
    this.castleContainer = this.add.container(
      width / 2 + GRID_CONFIG.offsetX,
      height / 2 + GRID_CONFIG.offsetY
    );
    this.castleContainer.setDepth(1000);  // Ensure it's above everything

    // Initialize tile sprite array
    this.tileSprites = [];

    // Render tiles from back to front (painter's algorithm)
    for (let y = 0; y < GRID_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GRID_WIDTH; x++) {
        // Use createIsometricTileWithConfig to include grass texture
        const tile = this.createIsometricTileWithConfig(x, y);
        this.tileSprites[y][x] = tile;
        this.gridContainer.add(tile);
      }
    }

    // Sort children by depth for proper rendering
    this.gridContainer.sort('depth');
  }

  private gridToIso(gridX: number, gridY: number): { screenX: number; screenY: number } {
    const screenX = (gridX - gridY) * (ISO_TILE_WIDTH / 2);
    const screenY = (gridX + gridY) * (ISO_TILE_HEIGHT / 2);
    return { screenX, screenY };
  }

  private createIsometricTile(gridX: number, gridY: number): Phaser.GameObjects.Container {
    const { screenX, screenY } = this.gridToIso(gridX, gridY);
    const cell = this.grid[gridY][gridX];

    // Container for this tile
    const tileContainer = this.add.container(screenX, screenY);
    tileContainer.setDepth(gridX + gridY);

    // Get tile color based on cell type
    const color = this.getTileColor(cell);

    // Draw isometric diamond tile
    const tile = this.add.graphics();

    // Top face
    tile.fillStyle(color, 1);
    tile.beginPath();
    tile.moveTo(0, -ISO_TILE_HEIGHT / 2);  // Top
    tile.lineTo(ISO_TILE_WIDTH / 2, 0);     // Right
    tile.lineTo(0, ISO_TILE_HEIGHT / 2);    // Bottom
    tile.lineTo(-ISO_TILE_WIDTH / 2, 0);    // Left
    tile.closePath();
    tile.fillPath();

    // Left side (3D effect)
    tile.fillStyle(this.adjustBrightness(color, 0.7), 1);
    tile.beginPath();
    tile.moveTo(-ISO_TILE_WIDTH / 2, 0);
    tile.lineTo(0, ISO_TILE_HEIGHT / 2);
    tile.lineTo(0, ISO_TILE_HEIGHT / 2 + 8);
    tile.lineTo(-ISO_TILE_WIDTH / 2, 8);
    tile.closePath();
    tile.fillPath();

    // Right side (3D effect)
    tile.fillStyle(this.adjustBrightness(color, 0.5), 1);
    tile.beginPath();
    tile.moveTo(ISO_TILE_WIDTH / 2, 0);
    tile.lineTo(0, ISO_TILE_HEIGHT / 2);
    tile.lineTo(0, ISO_TILE_HEIGHT / 2 + 8);
    tile.lineTo(ISO_TILE_WIDTH / 2, 8);
    tile.closePath();
    tile.fillPath();

    // Subtle border
    tile.lineStyle(1, 0xffffff, 0.1);
    tile.beginPath();
    tile.moveTo(0, -ISO_TILE_HEIGHT / 2);
    tile.lineTo(ISO_TILE_WIDTH / 2, 0);
    tile.lineTo(0, ISO_TILE_HEIGHT / 2);
    tile.lineTo(-ISO_TILE_WIDTH / 2, 0);
    tile.closePath();
    tile.strokePath();

    tileContainer.add(tile);

    // Add castle sprite if this is a castle anchor cell
    if (cell.isCastle && this.isCastleAnchor(gridX, gridY)) {
      this.addCastleSprite(gridX, gridY, cell.ownerId);
    }

    // Add unit sprite if this is a unit
    if (cell.type === 'unit' && cell.ownerId) {
      this.addUnitSprite(tileContainer, cell.ownerId);
    }

    // Make tile interactive
    const hitArea = new Phaser.Geom.Polygon([
      new Phaser.Geom.Point(0, -ISO_TILE_HEIGHT / 2),
      new Phaser.Geom.Point(ISO_TILE_WIDTH / 2, 0),
      new Phaser.Geom.Point(0, ISO_TILE_HEIGHT / 2),
      new Phaser.Geom.Point(-ISO_TILE_WIDTH / 2, 0),
    ]);

    tileContainer.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);
    tileContainer.setData('gridX', gridX);
    tileContainer.setData('gridY', gridY);

    return tileContainer;
  }

  private isCastleAnchor(x: number, y: number): boolean {
    const cell = this.grid[y][x];
    if (!cell.isCastle) return false;

    // Check if this is the top-left cell of the 2x2 castle
    const leftCell = x > 0 ? this.grid[y][x - 1] : null;
    const topCell = y > 0 ? this.grid[y - 1][x] : null;

    const isLeftEdge = !leftCell || !leftCell.isCastle || leftCell.ownerId !== cell.ownerId;
    const isTopEdge = !topCell || !topCell.isCastle || topCell.ownerId !== cell.ownerId;

    return isLeftEdge && isTopEdge;
  }

  private getTileColor(cell: GridCell): number {
    switch (cell.type) {
      case 'river':
        return TerrainColors.water.base;
      case 'mountain':
        return TerrainColors.rock.base;
      case 'bridge':
        return TerrainColors.wood.base;
      case 'castle':
      case 'unit':
        // Show owner color tint on grass
        if (cell.ownerId) {
          const player = this.gameState?.players[cell.ownerId];
          if (player) {
            return PlayerColors[player.color];
          }
        }
        return TerrainColors.grass.base;
      default:
        // Grass variation
        return this.getGrassVariant(cell.x, cell.y);
    }
  }

  private getGrassVariant(x: number, y: number): number {
    const variant = (x * 7 + y * 13) % 4;
    switch (variant) {
      case 0: return TerrainColors.grass.base;
      case 1: return TerrainColors.grass.light;
      case 2: return TerrainColors.grass.dark;
      default: return TerrainColors.grass.base;
    }
  }

  private adjustBrightness(color: number, factor: number): number {
    const r = Math.floor(((color >> 16) & 0xff) * factor);
    const g = Math.floor(((color >> 8) & 0xff) * factor);
    const b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  private addCastleSprite(gridX: number, gridY: number, ownerId: string | null): void {
    if (!ownerId) return;

    const player = this.gameState?.players[ownerId];
    if (!player) return;

    // Get config for this specific castle
    const config = CASTLE_CONFIGS[ownerId] || CASTLE_CONFIGS.player1;

    // Calculate base position from grid coordinates
    const tileW = GRID_CONFIG.tileWidth;
    const tileH = GRID_CONFIG.tileHeight;
    const baseX = (gridX - gridY) * (tileW / 2);
    const baseY = (gridX + gridY) * (tileH / 2);

    // Use blue castle for green, yellow castle for red (images not ready)
    let castleColor = player.color;
    if (player.color === 'green') castleColor = 'blue';
    if (player.color === 'red') castleColor = 'yellow';
    const textureKey = `castle_${castleColor}`;

    // Check if texture exists, otherwise draw placeholder
    if (this.textures.exists(textureKey)) {
      // Position castle in the castle container (always on top)
      const castle = this.add.image(baseX + config.offsetX, baseY + config.offsetY, textureKey);
      castle.setScale(config.scale);
      castle.setOrigin(config.originX, config.originY);
      castle.setRotation(config.rotation * (Math.PI / 180));  // Convert degrees to radians
      castle.setData('baseX', baseX);  // Store base position for updates
      castle.setData('baseY', baseY);
      this.castleContainer.add(castle);
      this.castleSprites.set(ownerId, castle);  // Store reference with owner ID
    } else {
      // Placeholder castle (will be replaced with sprites)
      const castle = this.add.graphics();
      const color = PlayerColors[player.color];

      castle.setPosition(baseX, baseY);

      // Simple castle shape
      castle.fillStyle(color, 1);
      castle.fillRect(-15, -60, 30, 40);

      // Towers
      castle.fillRect(-20, -70, 10, 50);
      castle.fillRect(10, -70, 10, 50);

      // Flag
      castle.fillStyle(0xffffff, 0.9);
      castle.fillTriangle(-15, -75, -15, -65, -5, -70);

      this.castleContainer.add(castle);
    }
  }

  private addUnitSprite(container: Phaser.GameObjects.Container, ownerId: string): void {
    const player = this.gameState?.players[ownerId];
    if (!player) return;

    const textureKey = `unit_${player.color}`;

    if (this.textures.exists(textureKey)) {
      const unit = this.add.image(0, -10, textureKey);
      unit.setScale(0.2);
      container.add(unit);
    } else {
      // Placeholder unit
      const unit = this.add.graphics();
      const color = PlayerColors[player.color];

      // Body
      unit.fillStyle(color, 1);
      unit.fillEllipse(0, -15, 14, 20);

      // Head
      unit.fillStyle(0xffffff, 0.9);
      unit.fillCircle(0, -25, 5);

      container.add(unit);
    }
  }

  private createUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Turn indicator
    const currentPlayer = this.gameState.players[this.gameState.turnOrder[0]];
    this.add.text(20, 20, `Turn 1 - ${currentPlayer?.displayName || 'Blue Kingdom'}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    });

    // Back to menu button
    const backButton = this.add.text(width - 20, 20, '← Menu', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 10, y: 5 },
    });
    backButton.setOrigin(1, 0);
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
    backButton.on('pointerover', () => backButton.setColor('#FFD700'));
    backButton.on('pointerout', () => backButton.setColor('#ffffff'));

    // Game action buttons (bottom center - above player panels)
    this.createGameButtons();

    // Player info panels - dynamically based on player count
    this.createPlayerPanels();
  }

  private createGameButtons(): void {
    // Game buttons are now part of the turn option UI
    // This method is kept for compatibility but does nothing
  }

  private createTurnOptionUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Container for turn option selection (positioned above dice)
    this.turnOptionContainer = this.add.container(width / 2, height - 180);
    this.turnOptionContainer.setVisible(false);

    // Title
    const title = this.add.text(0, -60, 'Choose Your Action', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.turnOptionContainer.add(title);

    // Option A: Expand Only (default color, will be updated per player)
    const optionA = this.createTurnOptionButton(-200, 0, 'A', 'Expand Only', 'Roll die, place units', 0x4a7c34, () => {
      this.selectTurnOption('A');
    });
    this.turnOptionContainer.add(optionA);
    this.turnOptionContainer.setData('optionA', optionA);

    // Option B: 1 Attack + Expand
    const optionB = this.createTurnOptionButton(0, 0, 'B', '1 Attack + Expand', 'Attack, then place if win', 0x7c5a34, () => {
      this.selectTurnOption('B');
    });
    this.turnOptionContainer.add(optionB);
    this.turnOptionContainer.setData('optionB', optionB);

    // Option C: 2 Attacks
    const optionC = this.createTurnOptionButton(200, 0, 'C', '2 Attacks', 'Attack twice, no placement', 0x7c3434, () => {
      this.selectTurnOption('C');
    });
    this.turnOptionContainer.add(optionC);
    this.turnOptionContainer.setData('optionC', optionC);

    // Create Roll Dice button (positioned below dice, initially hidden)
    this.rollDiceButton = this.add.container(width / 2, height - 60);
    this.rollDiceButton.setVisible(false);

    const rollBg = this.add.graphics();
    rollBg.fillStyle(0x4a7c34, 1);
    rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
    rollBg.lineStyle(3, 0xffd700, 0.9);
    rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
    this.rollDiceButton.add(rollBg);

    const rollText = this.add.text(0, 0, '🎲 ROLL DICE', {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.rollDiceButton.add(rollText);

    this.rollDiceButton.setData('bg', rollBg);

    const rollHitArea = new Phaser.Geom.Rectangle(-80, -25, 160, 50);
    this.rollDiceButton.setInteractive(rollHitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    this.rollDiceButton.on('pointerover', () => {
      rollBg.clear();
      rollBg.fillStyle(0x5a9c44, 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 1);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1.05);
    });

    this.rollDiceButton.on('pointerout', () => {
      rollBg.clear();
      rollBg.fillStyle(0x4a7c34, 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 0.9);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1);
    });

    this.rollDiceButton.on('pointerdown', () => {
      this.rollDiceButton.setVisible(false);
      this.rollDiceForPlacement();
    });
  }

  private createTurnOptionButton(x: number, y: number, letter: string, title: string, desc: string, color: number, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.9);
    bg.fillRoundedRect(-80, -50, 160, 100, 10);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.strokeRoundedRect(-80, -50, 160, 100, 10);
    container.add(bg);

    // Letter badge
    const badge = this.add.graphics();
    badge.fillStyle(0xffd700, 1);
    badge.fillCircle(-55, -25, 15);
    container.add(badge);

    const letterText = this.add.text(-55, -25, letter, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    container.add(letterText);

    // Title
    const titleText = this.add.text(0, -15, title, {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    container.add(titleText);

    // Description
    const descText = this.add.text(0, 15, desc, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#cccccc',
      wordWrap: { width: 140 },
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add(descText);

    // Store references
    container.setData('bg', bg);
    container.setData('color', color);

    // Interactive
    const hitArea = new Phaser.Geom.Rectangle(-80, -50, 160, 100);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    container.on('pointerover', () => {
      const currentColor = container.getData('color') as number;
      bg.clear();
      bg.fillStyle(this.adjustBrightness(currentColor, 1.3), 0.95);
      bg.fillRoundedRect(-80, -50, 160, 100, 10);
      bg.lineStyle(3, 0xffd700, 1);
      bg.strokeRoundedRect(-80, -50, 160, 100, 10);
      container.setScale(1.05);
    });

    container.on('pointerout', () => {
      const currentColor = container.getData('color') as number;
      bg.clear();
      bg.fillStyle(currentColor, 0.9);
      bg.fillRoundedRect(-80, -50, 160, 100, 10);
      bg.lineStyle(2, 0xffd700, 0.8);
      bg.strokeRoundedRect(-80, -50, 160, 100, 10);
      container.setScale(1);
    });

    container.on('pointerdown', callback);

    return container;
  }

  private selectTurnOption(option: 'A' | 'B' | 'C'): void {
    this.selectedTurnOption = option;
    this.turnOptionContainer.setVisible(false);

    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];

    console.log(`${currentPlayer.displayName} selected Option ${option}`);

    switch (option) {
      case 'A':
        // Option A: Expand Only - Show roll button
        this.turnPhase = 'placing';
        this.attacksRemaining = 0;
        this.showMessage(`${currentPlayer.displayName}: Expand Only`, 'info');
        this.time.delayedCall(500, () => this.showRollDiceButton());
        break;

      case 'B':
        // Option B: 1 Attack + Expand - Start with attack
        this.turnPhase = 'attacking';
        this.attacksRemaining = 1;
        this.attackWonThisTurn = false;
        this.showMessage(`${currentPlayer.displayName}: Attack + Expand`, 'warning');
        this.startAttackPhase();
        break;

      case 'C':
        // Option C: 2 Attacks - Start with attacks, no placement
        this.turnPhase = 'attacking';
        this.attacksRemaining = 2;
        this.attackWonThisTurn = false;
        this.showMessage(`${currentPlayer.displayName}: Double Attack`, 'warning');
        this.startAttackPhase();
        break;
    }
  }

  private showTurnOptionUI(): void {
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];
    const playerColor = PlayerColors[currentPlayer.color];

    // Check if player has any attack options
    const hasAttackOptions = this.playerHasAttackOptions();

    if (!hasAttackOptions) {
      // No attack possible - auto-select Expand Only (Option A)
      this.showMessage(`${currentPlayer.displayName}: No enemies nearby - Expand Only`, 'info');
      this.selectedTurnOption = 'A';
      this.turnPhase = 'placing';
      this.attacksRemaining = 0;
      this.turnOptionContainer.setVisible(false);
      this.time.delayedCall(500, () => this.showRollDiceButton());
      return;
    }

    // Update button and dice colors to match current player
    this.updateTurnOptionButtonColors(playerColor);
    this.updateDiceBoxColor(playerColor);

    // Show turn options UI
    this.turnPhase = 'choosing';
    this.selectedTurnOption = null;
    this.turnOptionContainer.setVisible(true);
    this.rollDiceButton.setVisible(false);

    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`${currentPlayer.displayName}'s turn - Choose action!`);
  }

  private updateTurnOptionButtonColors(baseColor: number): void {
    // Create color variants for each option
    const colorA = this.adjustBrightness(baseColor, 0.7);  // Darker for expand
    const colorB = baseColor;                              // Normal for attack+expand
    const colorC = this.adjustBrightness(baseColor, 1.2);  // Brighter for double attack

    const options = [
      { key: 'optionA', color: colorA },
      { key: 'optionB', color: colorB },
      { key: 'optionC', color: colorC },
    ];

    options.forEach(opt => {
      const button = this.turnOptionContainer.getData(opt.key) as Phaser.GameObjects.Container;
      if (button) {
        const bg = button.getData('bg') as Phaser.GameObjects.Graphics;
        const color = opt.color;
        button.setData('color', color);
        bg.clear();
        bg.fillStyle(color, 0.9);
        bg.fillRoundedRect(-80, -50, 160, 100, 10);
        bg.lineStyle(2, 0xffd700, 0.8);
        bg.strokeRoundedRect(-80, -50, 160, 100, 10);
      }
    });
  }

  private updateDiceBoxColor(playerColor: number): void {
    const bg = this.diceSprite.getData('bg') as Phaser.GameObjects.Graphics;
    bg.clear();
    bg.fillStyle(this.adjustBrightness(playerColor, 0.4), 0.9);
    bg.fillRoundedRect(-30, -30, 60, 60, 10);
    bg.lineStyle(2, playerColor, 0.8);
    bg.strokeRoundedRect(-30, -30, 60, 60, 10);
  }

  private startAttackPhase(): void {
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`Attack Phase - ${this.attacksRemaining} attack(s) remaining`);

    // Check if player has units that can attack
    if (!this.playerHasAttackOptions()) {
      this.showMessage('No units can attack!', 'warning');
      this.handleNoAttackAvailable();
      return;
    }
  }

  private handleNoAttackAvailable(): void {
    // If player can't attack, handle based on option
    if (this.selectedTurnOption === 'B') {
      // Option B without attack = just expand (show roll button)
      this.time.delayedCall(1000, () => {
        this.turnPhase = 'placing';
        this.showRollDiceButton();
      });
    } else {
      // Option C without attacks = turn ends
      this.time.delayedCall(1000, () => this.endTurn());
    }
  }

  private showRollDiceButton(): void {
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];
    const playerColor = PlayerColors[currentPlayer.color];

    // Update dice box and roll button color to match player
    this.updateDiceBoxColor(playerColor);
    const rollBg = this.rollDiceButton.getData('bg') as Phaser.GameObjects.Graphics;
    this.rollDiceButton.setData('playerColor', playerColor);
    rollBg.clear();
    rollBg.fillStyle(playerColor, 1);
    rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
    rollBg.lineStyle(3, 0xffd700, 0.9);
    rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);

    // Update hover handlers to use player color
    this.rollDiceButton.off('pointerover');
    this.rollDiceButton.off('pointerout');

    this.rollDiceButton.on('pointerover', () => {
      const color = this.rollDiceButton.getData('playerColor') as number;
      rollBg.clear();
      rollBg.fillStyle(this.adjustBrightness(color, 1.3), 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 1);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1.05);
    });

    this.rollDiceButton.on('pointerout', () => {
      const color = this.rollDiceButton.getData('playerColor') as number;
      rollBg.clear();
      rollBg.fillStyle(color, 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 0.9);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1);
    });

    this.rollDiceButton.setVisible(true);

    // Reset the button handler for placement roll
    this.rollDiceButton.off('pointerdown');
    this.rollDiceButton.on('pointerdown', () => {
      this.rollDiceButton.setVisible(false);
      this.rollDiceForPlacement();
    });

    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText('Click to roll for placement!');
  }

  private rollDiceForPlacement(): void {
    if (this.isRolling) return;

    this.isRolling = true;

    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText('Rolling for placement...');

    // Animate rolling
    let rollCount = 0;
    const maxRolls = 12;

    const rollInterval = this.time.addEvent({
      delay: 70,
      callback: () => {
        const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
        const randomValue = Phaser.Math.Between(1, 6);
        text.setText(randomValue.toString());
        text.setColor('#ffffff');

        // Shake effect
        this.tweens.add({
          targets: this.diceSprite,
          x: Phaser.Math.Between(-4, 4),
          y: Phaser.Math.Between(-4, 4),
          duration: 50,
          yoyo: true,
        });

        rollCount++;
        if (rollCount >= maxRolls) {
          rollInterval.destroy();
          this.finishPlacementRoll();
        }
      },
      loop: true,
    });
  }

  private finishPlacementRoll(): void {
    this.diceValue = Phaser.Math.Between(1, 6);
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];

    // Apply speed bonus (+2 placement points)
    const speedBonus = this.hasActiveBonus(currentPlayerId, 'speed') ? 2 : 0;
    this.placementPoints = this.diceValue + speedBonus;

    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const playerColor = PlayerColors[currentPlayer.color];

    text.setText(speedBonus > 0 ? `${this.diceValue}+2` : this.diceValue.toString());
    text.setColor('#ffffff');
    this.diceSprite.setPosition(0, 0);

    // Keep player's color on the dice box
    this.updateDiceBoxColor(playerColor);

    // Pop animation
    this.tweens.add({
      targets: this.diceSprite,
      scale: 1.3,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    const bonusText = speedBonus > 0 ? ` (Speed +${speedBonus})` : '';
    label.setText(`Rolled ${this.diceValue}!${bonusText} Place ${this.placementPoints} unit(s)`);

    this.isRolling = false;

    // Calculate and highlight valid placements
    this.calculateValidPlacements();
    this.highlightValidPlacements();

    console.log(`Rolled: ${this.diceValue} - Can place ${this.placementPoints} units`);
  }

  private createPlayerPanels(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const panelHeight = 100;
    const panelWidth = 150;
    const panelY = height - panelHeight - 10;

    // Get active players from game state
    const players = Object.values(this.gameState.players);

    if (players.length === 2) {
      // 2 players: left and right
      this.createPlayerPanel(20, panelY, players[0].id, players[0].displayName, players[0].color, players[0].castleHP);
      this.createPlayerPanel(width - panelWidth - 20, panelY, players[1].id, players[1].displayName, players[1].color, players[1].castleHP);
    } else if (players.length === 3) {
      // 3 players: left, center, right
      this.createPlayerPanel(20, panelY, players[0].id, players[0].displayName, players[0].color, players[0].castleHP);
      this.createPlayerPanel(width / 2 - panelWidth / 2, panelY, players[1].id, players[1].displayName, players[1].color, players[1].castleHP);
      this.createPlayerPanel(width - panelWidth - 20, panelY, players[2].id, players[2].displayName, players[2].color, players[2].castleHP);
    } else if (players.length === 4) {
      // 4 players: spread evenly
      const spacing = (width - panelWidth * 4) / 5;
      players.forEach((player, index) => {
        const x = spacing + index * (panelWidth + spacing);
        this.createPlayerPanel(x, panelY, player.id, player.displayName, player.color, player.castleHP);
      });
    }
  }

  private createButton(x: number, y: number, text: string, color: number, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-70, -20, 140, 40, 8);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.strokeRoundedRect(-70, -20, 140, 40, 8);

    // Button text
    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    buttonText.setOrigin(0.5, 0.5);

    container.add([bg, buttonText]);

    // Make interactive
    const hitArea = new Phaser.Geom.Rectangle(-70, -20, 140, 40);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    // Hover effects
    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(this.adjustBrightness(color, 1.3), 1);
      bg.fillRoundedRect(-70, -20, 140, 40, 8);
      bg.lineStyle(2, 0xffd700, 1);
      bg.strokeRoundedRect(-70, -20, 140, 40, 8);
      container.setScale(1.05);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-70, -20, 140, 40, 8);
      bg.lineStyle(2, 0xffd700, 0.8);
      bg.strokeRoundedRect(-70, -20, 140, 40, 8);
      container.setScale(1);
    });

    container.on('pointerdown', callback);

    return container;
  }

  private createPlayerPanel(x: number, y: number, playerId: string, name: string, color: PlayerColor, hp: number): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.5);
    panel.fillRoundedRect(x, y, 150, 100, 8);
    panel.lineStyle(2, PlayerColors[color], 0.8);
    panel.strokeRoundedRect(x, y, 150, 100, 8);

    // Player name
    this.add.text(x + 75, y + 15, name, {
      fontFamily: 'Georgia, serif',
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    // HP hearts - store references for updating
    const hearts: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 4; i++) {
      const heartColor = i < hp ? 0xff0000 : 0x333333;
      const heart = this.add.graphics();
      heart.setPosition(x + 30 + i * 25, y + 50);
      heart.fillStyle(heartColor, 1);
      heart.fillCircle(0, 0, 8);
      hearts.push(heart);
    }
    this.playerHearts.set(playerId, hearts);

    // Units count
    this.add.text(x + 75, y + 75, 'Units: 0', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0);
  }

  private updatePlayerHP(playerId: string, newHP: number): void {
    const hearts = this.playerHearts.get(playerId);
    if (!hearts) return;

    hearts.forEach((heart, index) => {
      heart.clear();
      const heartColor = index < newHP ? 0xff0000 : 0x333333;
      heart.fillStyle(heartColor, 1);
      // Redraw at original position (stored in graphic's position)
      heart.fillCircle(0, 0, 8);
    });
  }

  private createDiceUI(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Container for dice display (positioned above the buttons)
    this.diceContainer = this.add.container(width / 2, height - 120);

    // Create single die
    this.diceSprite = this.add.container(0, 0);

    // Die background
    const dieBg = this.add.graphics();
    dieBg.fillStyle(0x222222, 0.8);
    dieBg.fillRoundedRect(-30, -30, 60, 60, 10);
    dieBg.lineStyle(2, 0xffd700, 0.5);
    dieBg.strokeRoundedRect(-30, -30, 60, 60, 10);

    // Die value text
    const dieText = this.add.text(0, 0, '?', {
      fontFamily: 'Georgia, serif',
      fontSize: '36px',
      color: '#888888',
    }).setOrigin(0.5, 0.5);

    this.diceSprite.add([dieBg, dieText]);
    this.diceSprite.setData('bg', dieBg);
    this.diceSprite.setData('text', dieText);
    this.diceContainer.add(this.diceSprite);

    // Dice result label (above die)
    const label = this.add.text(0, -50, 'Roll to get placement points!', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 0.5);
    this.diceContainer.add(label);
    this.diceContainer.setData('label', label);

  }

  private calculateValidPlacements(): void {
    this.validPlacements.clear();
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];

    // Find all cells owned by current player (castle and units)
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const cell = this.grid[y][x];
        if (cell.ownerId === currentPlayerId) {
          // Check all 4 adjacent cells
          const neighbors = [
            { x: x - 1, y: y },
            { x: x + 1, y: y },
            { x: x, y: y - 1 },
            { x: x, y: y + 1 },
          ];

          for (const neighbor of neighbors) {
            if (this.isValidPlacement(neighbor.x, neighbor.y)) {
              this.validPlacements.add(`${neighbor.x},${neighbor.y}`);
            }
          }
        }
      }
    }
  }

  private isValidPlacement(x: number, y: number): boolean {
    // Check bounds
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
      return false;
    }

    const cell = this.grid[y][x];

    // Can only place on empty cells, bridges, or chests
    if (cell.type !== 'empty' && cell.type !== 'bridge' && cell.type !== 'chest') {
      return false;
    }

    return true;
  }

  private highlightValidPlacements(): void {
    // Clear previous highlights and add new ones
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tileContainer = this.tileSprites[y]?.[x];
        if (!tileContainer) continue;

        const isValid = this.validPlacements.has(`${x},${y}`);
        const highlight = tileContainer.getData('highlight') as Phaser.GameObjects.Graphics;

        if (highlight) {
          highlight.clear();
          if (isValid && this.placementPoints > 0) {
            // Draw green highlight for valid placement
            highlight.fillStyle(0x00ff00, 0.3);
            highlight.beginPath();
            highlight.moveTo(0, -GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(GRID_CONFIG.tileWidth / 2, 0);
            highlight.lineTo(0, GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(-GRID_CONFIG.tileWidth / 2, 0);
            highlight.closePath();
            highlight.fillPath();
          }
        }
      }
    }
  }

  private clearHighlights(): void {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tileContainer = this.tileSprites[y]?.[x];
        if (!tileContainer) continue;
        const highlight = tileContainer.getData('highlight') as Phaser.GameObjects.Graphics;
        if (highlight) {
          highlight.clear();
        }
      }
    }
  }

  private endTurn(): void {
    // Clear highlights and combat state
    this.clearHighlights();
    this.validPlacements.clear();
    this.selectedUnitForAttack = null;
    this.attackableEnemies.clear();
    this.isInCombat = false;
    this.combatTarget = null;

    // Decrement bonuses for current player
    const endingPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    this.decrementBonuses(endingPlayerId);

    // Move to next player
    this.gameState.currentPlayerIndex =
      (this.gameState.currentPlayerIndex + 1) % this.gameState.turnOrder.length;

    // Increment turn counter if we've gone through all players
    if (this.gameState.currentPlayerIndex === 0) {
      this.gameState.currentTurn++;
    }

    // Reset turn state
    this.diceValue = 0;
    this.placementPoints = 0;
    this.turnPhase = 'choosing';
    this.selectedTurnOption = null;
    this.attacksRemaining = 0;
    this.attackWonThisTurn = false;

    // Reset dice display
    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const bg = this.diceSprite.getData('bg') as Phaser.GameObjects.Graphics;

    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];
    const playerColor = PlayerColors[currentPlayer.color];

    text.setText('?');
    text.setColor('#888888');

    // Update dice box with next player's color
    this.updateDiceBoxColor(playerColor);

    // Show turn change message
    this.showMessage(`${currentPlayer.displayName}'s turn!`, 'turn');

    console.log(`Turn ended. Now: ${currentPlayer.displayName}'s turn (Turn ${this.gameState.currentTurn})`);

    // Show turn option selection for next player
    this.time.delayedCall(1000, () => {
      this.showTurnOptionUI();
    });
  }

  private showMessage(text: string, type: 'info' | 'success' | 'warning' | 'turn' = 'info'): void {
    const width = this.cameras.main.width;

    // Clear any existing messages to prevent overlap
    this.activeMessages.forEach(m => {
      this.tweens.killTweensOf(m);
      m.destroy();
    });
    this.activeMessages = [];

    // Different styles for different message types
    let bgColor: string;
    let textColor: string;
    let fontSize: string;
    const yPos = 40;  // Fixed position at top

    switch (type) {
      case 'success':
        bgColor = '#d4edda';  // Light green
        textColor = '#155724';  // Dark green
        fontSize = '22px';
        break;
      case 'warning':
        bgColor = '#fff3cd';  // Light yellow
        textColor = '#856404';  // Dark amber
        fontSize = '22px';
        break;
      case 'turn':
        bgColor = '#cce5ff';  // Light blue
        textColor = '#004085';  // Dark blue
        fontSize = '26px';
        break;
      case 'info':
      default:
        bgColor = '#e8e8e8';  // Light gray
        textColor = '#333333';  // Dark gray
        fontSize = '20px';
        break;
    }

    const msg = this.add.text(width / 2, yPos, text, {
      fontFamily: 'Georgia, serif',
      fontSize: fontSize,
      color: textColor,
      backgroundColor: bgColor,
      padding: { x: 20, y: 12 },
      stroke: '#000000',
      strokeThickness: 1,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 4,
        fill: true,
      },
    }).setOrigin(0.5, 0.5);

    this.activeMessages.push(msg);

    // Wait before fading so user can read, then fade out
    this.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 2000,  // Stay visible for 2 seconds
      onComplete: () => {
        this.tweens.add({
          targets: msg,
          alpha: 0,
          y: yPos + 20,  // Fade downward slightly
          duration: 500,
          ease: 'Power2',
          onComplete: () => {
            const index = this.activeMessages.indexOf(msg);
            if (index > -1) this.activeMessages.splice(index, 1);
            msg.destroy();
          },
        });
      },
    });
  }

  private startTurnOrderPhase(): void {
    // Hide turn option UI during turn order phase
    this.turnOptionContainer.setVisible(false);

    // Update dice label for turn order phase
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText('Determining turn order...');

    // Show initial message
    this.showMessage('Rolling for turn order!', 'turn');

    // Show roll button for first player after a delay
    this.time.delayedCall(1500, () => {
      this.promptTurnOrderRoll();
    });
  }

  private promptTurnOrderRoll(): void {
    const players = Object.values(this.gameState.players);
    const currentPlayer = players[this.currentRollIndex];

    if (!currentPlayer) {
      // All players have rolled, determine order
      this.finalizeTurnOrder();
      return;
    }

    // Update UI to show who should roll
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`${currentPlayer.displayName}'s turn to roll!`);

    // Update dice box and roll button color to match current player
    const playerColor = PlayerColors[currentPlayer.color];
    this.updateDiceBoxColor(playerColor);
    const rollBg = this.rollDiceButton.getData('bg') as Phaser.GameObjects.Graphics;
    this.rollDiceButton.setData('playerColor', playerColor);
    rollBg.clear();
    rollBg.fillStyle(playerColor, 1);
    rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
    rollBg.lineStyle(3, 0xffd700, 0.9);
    rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);

    // Update hover handlers for player color
    this.rollDiceButton.off('pointerover');
    this.rollDiceButton.off('pointerout');

    this.rollDiceButton.on('pointerover', () => {
      const color = this.rollDiceButton.getData('playerColor') as number;
      rollBg.clear();
      rollBg.fillStyle(this.adjustBrightness(color, 1.3), 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 1);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1.05);
    });

    this.rollDiceButton.on('pointerout', () => {
      const color = this.rollDiceButton.getData('playerColor') as number;
      rollBg.clear();
      rollBg.fillStyle(color, 1);
      rollBg.fillRoundedRect(-80, -25, 160, 50, 10);
      rollBg.lineStyle(3, 0xffd700, 0.9);
      rollBg.strokeRoundedRect(-80, -25, 160, 50, 10);
      this.rollDiceButton.setScale(1);
    });

    // Show roll button - update its click handler for turn order
    this.rollDiceButton.setVisible(true);
    this.rollDiceButton.off('pointerdown'); // Remove old handler
    this.rollDiceButton.on('pointerdown', () => {
      this.rollDiceButton.setVisible(false);
      this.executeTurnOrderRoll(currentPlayer);
    });
  }

  private executeTurnOrderRoll(currentPlayer: GameState['players'][string]): void {
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`${currentPlayer.displayName} rolling...`);

    // Animate roll
    this.isRolling = true;
    let rollCount = 0;
    const maxRolls = 10;

    const rollInterval = this.time.addEvent({
      delay: 70,
      callback: () => {
        const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
        const randomValue = Phaser.Math.Between(1, 6);
        text.setText(randomValue.toString());
        text.setColor('#ffffff');

        // Shake effect
        this.tweens.add({
          targets: this.diceSprite,
          x: Phaser.Math.Between(-4, 4),
          y: Phaser.Math.Between(-4, 4),
          duration: 50,
          yoyo: true,
        });

        rollCount++;
        if (rollCount >= maxRolls) {
          rollInterval.destroy();
          this.finishTurnOrderRoll(currentPlayer);
        }
      },
      loop: true,
    });
  }

  private finishTurnOrderRoll(player: GameState['players'][string]): void {
    const roll = Phaser.Math.Between(1, 6);

    // Store the roll
    this.turnOrderRolls.push({ playerId: player.id, roll });

    // Update display
    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const playerColor = PlayerColors[player.color];

    text.setText(roll.toString());
    text.setColor('#ffffff');
    this.diceSprite.setPosition(0, 0);

    // Keep player's color on the dice box
    this.updateDiceBoxColor(playerColor);

    // Pop animation
    this.tweens.add({
      targets: this.diceSprite,
      scale: 1.3,
      duration: 150,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    // Update label with result
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`${player.displayName} rolled ${roll}!`);

    this.isRolling = false;

    // Move to next player or finalize
    this.currentRollIndex++;
    this.time.delayedCall(1200, () => {
      this.promptTurnOrderRoll();
    });
  }

  private finalizeTurnOrder(): void {
    // Sort by roll (highest first)
    this.turnOrderRolls.sort((a, b) => b.roll - a.roll);

    // Set the turn order
    this.gameState.turnOrder = this.turnOrderRolls.map(r => r.playerId);
    this.gameState.currentPlayerIndex = 0;

    // Find the winner
    const firstPlayer = this.gameState.players[this.gameState.turnOrder[0]];

    // Update UI
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText(`${firstPlayer.displayName} goes first!`);

    // Show message
    this.showMessage(`${firstPlayer.displayName} starts!`, 'turn');

    // Transition to playing phase after delay
    this.time.delayedCall(2500, () => {
      this.startPlayingPhase();
    });
  }

  private startPlayingPhase(): void {
    this.gamePhase = 'playing';

    // Reset dice display for normal gameplay with first player's color
    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const firstPlayerId = this.gameState.turnOrder[0];
    const firstPlayer = this.gameState.players[firstPlayerId];
    const playerColor = PlayerColors[firstPlayer.color];

    text.setText('?');
    text.setColor('#888888');

    this.updateDiceBoxColor(playerColor);

    console.log(`Game started! Turn order: ${this.gameState.turnOrder.join(' → ')}`);

    // Spawn initial treasure chests
    this.spawnChests(3);

    // Show turn option selection for first player
    this.showTurnOptionUI();
  }

  private spawnChests(count: number): void {
    const bonusTypes: BonusType[] = ['defense', 'attack', 'speed', 'bridge'];

    for (let i = 0; i < count; i++) {
      // Find a random empty cell
      let attempts = 0;
      while (attempts < 100) {
        const x = Math.floor(Math.random() * GRID_WIDTH);
        const y = Math.floor(Math.random() * GRID_HEIGHT);
        const cell = this.grid[y][x];

        // Check if cell is empty and not near any castle
        if (cell.type === 'empty' && !this.isNearCastle(x, y, 3)) {
          // Create chest
          const bonusType = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
          const chest: ChestState = {
            x,
            y,
            bonusType,
            isCollected: false,
          };
          this.gameState.chests.push(chest);

          // Mark cell as chest
          cell.type = 'chest';

          // Render chest
          this.renderChest(chest);
          break;
        }
        attempts++;
      }
    }
  }

  private isNearCastle(x: number, y: number, distance: number): boolean {
    for (const player of Object.values(this.gameState.players)) {
      const castlePos = player.castlePosition;
      // Castle is 2x2, check distance from all castle cells
      for (let cx = 0; cx < 2; cx++) {
        for (let cy = 0; cy < 2; cy++) {
          const dx = Math.abs(x - (castlePos.x + cx));
          const dy = Math.abs(y - (castlePos.y + cy));
          if (dx <= distance && dy <= distance) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private renderChest(chest: ChestState): void {
    const container = this.add.container(0, 0);
    const { screenX, screenY } = this.gridToIso(chest.x, chest.y);
    container.setPosition(screenX, screenY - 10);
    container.setDepth(chest.x + chest.y + 0.5); // Slightly above the tile

    // Chest base (brown box)
    const chestGfx = this.add.graphics();
    chestGfx.fillStyle(0x8B4513, 1); // Brown
    chestGfx.fillRoundedRect(-12, -8, 24, 16, 3);
    chestGfx.lineStyle(2, 0x5D3A1A, 1);
    chestGfx.strokeRoundedRect(-12, -8, 24, 16, 3);

    // Chest lid
    chestGfx.fillStyle(0xA0522D, 1);
    chestGfx.fillRoundedRect(-14, -14, 28, 8, 2);
    chestGfx.lineStyle(2, 0x5D3A1A, 1);
    chestGfx.strokeRoundedRect(-14, -14, 28, 8, 2);

    // Lock/clasp
    chestGfx.fillStyle(0xFFD700, 1); // Gold
    chestGfx.fillCircle(0, -2, 4);

    // Bonus type indicator (colored gem on top)
    const gemColors: Record<BonusType, number> = {
      defense: 0x4444FF, // Blue
      attack: 0xFF4444,  // Red
      speed: 0x44FF44,   // Green
      bridge: 0x44FFFF,  // Cyan
    };
    chestGfx.fillStyle(gemColors[chest.bonusType], 1);
    chestGfx.fillCircle(0, -18, 5);
    chestGfx.lineStyle(1, 0xFFFFFF, 0.5);
    chestGfx.strokeCircle(0, -18, 5);

    container.add(chestGfx);

    // Add sparkle effect
    const sparkle = this.add.graphics();
    sparkle.fillStyle(0xFFFFFF, 0.8);
    sparkle.fillCircle(-3, -20, 2);
    container.add(sparkle);

    // Pulsing animation
    this.tweens.add({
      targets: container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Store reference
    this.chestSprites.set(`${chest.x},${chest.y}`, container);
    this.gridContainer.add(container);
  }

  private collectChest(x: number, y: number, playerId: string): void {
    const chestIndex = this.gameState.chests.findIndex(c => c.x === x && c.y === y && !c.isCollected);
    if (chestIndex === -1) return;

    const chest = this.gameState.chests[chestIndex];
    chest.isCollected = true;

    const player = this.gameState.players[playerId];

    // Apply bonus
    const bonusNames: Record<BonusType, string> = {
      defense: 'Defense Shield',
      attack: 'Attack Boost',
      speed: 'Speed Bonus',
      bridge: 'Bridge Builder',
    };

    // Add bonus to player
    player.activeBonuses.push({
      type: chest.bonusType,
      turnsRemaining: chest.bonusType === 'bridge' ? 99 : 3, // Bridge lasts until used
      usesRemaining: chest.bonusType === 'bridge' ? 2 : undefined,
    });

    // Remove chest sprite
    const sprite = this.chestSprites.get(`${x},${y}`);
    if (sprite) {
      this.tweens.killTweensOf(sprite);
      sprite.destroy();
      this.chestSprites.delete(`${x},${y}`);
    }

    // Show collection message
    this.showMessage(`${player.displayName} found ${bonusNames[chest.bonusType]}!`, 'success');

    // Visual feedback - sparkle effect at collection point
    this.createCollectionEffect(x, y);
  }

  private createCollectionEffect(x: number, y: number): void {
    const { screenX, screenY } = this.gridToIso(x, y);

    // Create particles spreading outward
    for (let i = 0; i < 8; i++) {
      const particle = this.add.graphics();
      particle.fillStyle(0xFFD700, 1);
      particle.fillCircle(0, 0, 4);
      particle.setPosition(screenX, screenY - 10);
      particle.setDepth(100); // Above everything

      const angle = (i / 8) * Math.PI * 2;
      const distance = 30;

      this.gridContainer.add(particle);

      this.tweens.add({
        targets: particle,
        x: screenX + Math.cos(angle) * distance,
        y: screenY - 10 + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.5,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private hasActiveBonus(playerId: string, bonusType: BonusType): boolean {
    const player = this.gameState.players[playerId];
    if (!player) return false;
    return player.activeBonuses.some(b => b.type === bonusType && b.turnsRemaining > 0);
  }

  private decrementBonuses(playerId: string): void {
    const player = this.gameState.players[playerId];
    if (!player) return;

    // Decrement turn-based bonuses
    player.activeBonuses = player.activeBonuses.filter(bonus => {
      if (bonus.type === 'bridge') {
        // Bridge bonus only expires when uses run out
        return (bonus.usesRemaining ?? 0) > 0;
      }
      bonus.turnsRemaining--;
      return bonus.turnsRemaining > 0;
    });
  }

  private setupInput(): void {
    // Handle tile clicks
    this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      const gridX = gameObject.getData('gridX');
      const gridY = gameObject.getData('gridY');

      if (gridX !== undefined && gridY !== undefined) {
        this.onTileClick(gridX, gridY);
      }
    });

    // Hover effects
    this.input.on('gameobjectover', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      gameObject.setScale(1.05);
    });

    this.input.on('gameobjectout', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      gameObject.setScale(1);
    });
  }

  private onTileClick(x: number, y: number): void {
    const cell = this.grid[y][x];
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    console.log(`Clicked tile (${x}, ${y}) - Type: ${cell.type}, Owner: ${cell.ownerId}, Phase: ${this.turnPhase}`);

    // Don't process clicks during combat resolution or rolling
    if (this.isInCombat || this.isRolling || this.gamePhase !== 'playing') {
      return;
    }

    // Don't process during option selection
    if (this.turnPhase === 'choosing') {
      return;
    }

    // Attack phase - select units and attack enemies
    if (this.turnPhase === 'attacking') {
      // Check if clicking on an attackable enemy
      if (this.selectedUnitForAttack && this.attackableEnemies.has(`${x},${y}`)) {
        this.initiateCombat(x, y);
        return;
      }

      // Check if clicking on own unit to select for attack
      if (cell.type === 'unit' && cell.ownerId === currentPlayerId) {
        this.selectUnitForAttack(x, y);
        return;
      }

      // Clicking elsewhere - deselect
      if (this.selectedUnitForAttack) {
        this.clearHighlights();
        this.selectedUnitForAttack = null;
        this.attackableEnemies.clear();
        this.startAttackPhase(); // Show attack instructions again
      }
      return;
    }

    // Placement phase - place units on valid tiles
    if (this.turnPhase === 'placing' && this.placementPoints > 0) {
      if (this.validPlacements.has(`${x},${y}`)) {
        this.placeUnit(x, y);
        return;
      }

      // If clicked on invalid tile, show message
      if (cell.type !== 'empty') {
        this.showMessage('This tile is occupied!', 'warning');
      } else {
        this.showMessage('Must place adjacent to your castle or units!', 'warning');
      }
      return;
    }
  }

  private placeUnit(x: number, y: number): void {
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];

    // Check if placing on a chest - collect it first
    const cell = this.grid[y][x];
    if (cell.type === 'chest') {
      this.collectChest(x, y, currentPlayerId);
    }

    // Update grid cell
    cell.type = 'unit';
    cell.ownerId = currentPlayerId;

    // Update player's unit count
    currentPlayer.unitCount++;

    // Decrease placement points
    this.placementPoints--;

    // Refresh the tile visual
    this.refreshTile(x, y);

    // Recalculate valid placements (new unit can expand territory)
    this.calculateValidPlacements();
    this.highlightValidPlacements();

    // Update UI
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;

    if (this.placementPoints > 0) {
      label.setText(`Place ${this.placementPoints} more unit(s)`);
    }

    console.log(`Placed unit at (${x}, ${y}). Remaining points: ${this.placementPoints}`);

    // Check if placement is complete
    if (this.placementPoints <= 0) {
      this.clearHighlights();
      this.turnPhase = 'done';
      this.time.delayedCall(500, () => {
        this.endTurn();
      });
    }
  }

  private playerHasAttackOptions(): boolean {
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];

    // Check if any owned unit has an adjacent enemy
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const cell = this.grid[y][x];
        if (cell.type === 'unit' && cell.ownerId === currentPlayerId) {
          // Check adjacent cells for enemies
          const neighbors = [
            { x: x - 1, y: y },
            { x: x + 1, y: y },
            { x: x, y: y - 1 },
            { x: x, y: y + 1 },
          ];

          for (const neighbor of neighbors) {
            if (neighbor.x >= 0 && neighbor.x < GRID_WIDTH &&
                neighbor.y >= 0 && neighbor.y < GRID_HEIGHT) {
              const neighborCell = this.grid[neighbor.y][neighbor.x];
              if ((neighborCell.type === 'unit' || neighborCell.type === 'castle') &&
                  neighborCell.ownerId && neighborCell.ownerId !== currentPlayerId) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  private selectUnitForAttack(x: number, y: number): void {
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const cell = this.grid[y][x];

    // Only select units owned by current player
    if (cell.type !== 'unit' || cell.ownerId !== currentPlayerId) {
      return;
    }

    // Clear previous selection
    this.clearHighlights();
    this.attackableEnemies.clear();

    // Set selected unit
    this.selectedUnitForAttack = { x, y };

    // Calculate attackable enemies
    this.calculateAttackableEnemies(x, y);

    // Highlight the selected unit and attackable enemies
    this.highlightSelectedUnit(x, y);
    this.highlightAttackableEnemies();
  }

  private calculateAttackableEnemies(unitX: number, unitY: number): void {
    this.attackableEnemies.clear();
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];

    // Check all 4 adjacent cells
    const neighbors = [
      { x: unitX - 1, y: unitY },
      { x: unitX + 1, y: unitY },
      { x: unitX, y: unitY - 1 },
      { x: unitX, y: unitY + 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x >= 0 && neighbor.x < GRID_WIDTH &&
          neighbor.y >= 0 && neighbor.y < GRID_HEIGHT) {
        const cell = this.grid[neighbor.y][neighbor.x];
        // Can attack enemy units or enemy castles
        if ((cell.type === 'unit' || cell.isCastle) &&
            cell.ownerId && cell.ownerId !== currentPlayerId) {
          this.attackableEnemies.add(`${neighbor.x},${neighbor.y}`);
        }
      }
    }
  }

  private highlightSelectedUnit(x: number, y: number): void {
    const tileContainer = this.tileSprites[y]?.[x];
    if (!tileContainer) return;

    const highlight = tileContainer.getData('highlight') as Phaser.GameObjects.Graphics;
    if (highlight) {
      highlight.clear();
      // Draw yellow highlight for selected unit
      highlight.fillStyle(0xffff00, 0.4);
      highlight.beginPath();
      highlight.moveTo(0, -GRID_CONFIG.tileHeight / 2);
      highlight.lineTo(GRID_CONFIG.tileWidth / 2, 0);
      highlight.lineTo(0, GRID_CONFIG.tileHeight / 2);
      highlight.lineTo(-GRID_CONFIG.tileWidth / 2, 0);
      highlight.closePath();
      highlight.fillPath();

      // Add border
      highlight.lineStyle(2, 0xffff00, 1);
      highlight.beginPath();
      highlight.moveTo(0, -GRID_CONFIG.tileHeight / 2);
      highlight.lineTo(GRID_CONFIG.tileWidth / 2, 0);
      highlight.lineTo(0, GRID_CONFIG.tileHeight / 2);
      highlight.lineTo(-GRID_CONFIG.tileWidth / 2, 0);
      highlight.closePath();
      highlight.strokePath();
    }
  }

  private highlightAttackableEnemies(): void {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tileContainer = this.tileSprites[y]?.[x];
        if (!tileContainer) continue;

        if (this.attackableEnemies.has(`${x},${y}`)) {
          const highlight = tileContainer.getData('highlight') as Phaser.GameObjects.Graphics;
          if (highlight) {
            highlight.clear();
            // Draw red highlight for attackable enemies
            highlight.fillStyle(0xff0000, 0.4);
            highlight.beginPath();
            highlight.moveTo(0, -GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(GRID_CONFIG.tileWidth / 2, 0);
            highlight.lineTo(0, GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(-GRID_CONFIG.tileWidth / 2, 0);
            highlight.closePath();
            highlight.fillPath();

            // Pulsing border effect
            highlight.lineStyle(2, 0xff0000, 1);
            highlight.beginPath();
            highlight.moveTo(0, -GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(GRID_CONFIG.tileWidth / 2, 0);
            highlight.lineTo(0, GRID_CONFIG.tileHeight / 2);
            highlight.lineTo(-GRID_CONFIG.tileWidth / 2, 0);
            highlight.closePath();
            highlight.strokePath();
          }
        }
      }
    }
  }

  private initiateCombat(targetX: number, targetY: number): void {
    if (!this.selectedUnitForAttack) return;
    if (this.isInCombat) return;

    this.isInCombat = true;
    this.combatTarget = { x: targetX, y: targetY };

    const attackerCell = this.grid[this.selectedUnitForAttack.y][this.selectedUnitForAttack.x];
    const defenderCell = this.grid[targetY][targetX];

    const attackerId = attackerCell.ownerId!;
    const defenderId = defenderCell.ownerId!;

    const attacker = this.gameState.players[attackerId];
    const defender = this.gameState.players[defenderId];

    // Show combat message
    this.showMessage(`${attacker.displayName} attacks ${defender.displayName}!`, 'warning');

    // Update UI
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    label.setText('Combat! Rolling dice...');

    // Start combat dice roll after short delay
    this.time.delayedCall(1000, () => {
      this.rollCombatDice(attackerId, defenderId);
    });
  }

  private rollCombatDice(attackerId: string, defenderId: string): void {
    this.isRolling = true;
    let rollCount = 0;
    const maxRolls = 15;

    // Animate rolling
    const rollInterval = this.time.addEvent({
      delay: 60,
      callback: () => {
        const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
        const randomValue = Phaser.Math.Between(1, 6);
        text.setText(randomValue.toString());
        text.setColor('#ffffff');

        // Shake effect
        this.tweens.add({
          targets: this.diceSprite,
          x: Phaser.Math.Between(-5, 5),
          y: Phaser.Math.Between(-5, 5),
          duration: 40,
          yoyo: true,
        });

        rollCount++;
        if (rollCount >= maxRolls) {
          rollInterval.destroy();
          this.resolveCombat(attackerId, defenderId);
        }
      },
      loop: true,
    });
  }

  private resolveCombat(attackerId: string, defenderId: string): void {
    // Roll for both players
    let attackerRoll = Phaser.Math.Between(1, 6);
    let defenderRoll = Phaser.Math.Between(1, 6);

    const attacker = this.gameState.players[attackerId];
    const defender = this.gameState.players[defenderId];

    // Apply bonuses
    const attackBonus = this.hasActiveBonus(attackerId, 'attack') ? 1 : 0;
    const defenseBonus = this.hasActiveBonus(defenderId, 'defense') ? 1 : 0;

    const finalAttackerRoll = attackerRoll + attackBonus;
    const finalDefenderRoll = defenderRoll + defenseBonus;

    // Update dice display with attacker's roll
    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const bg = this.diceSprite.getData('bg') as Phaser.GameObjects.Graphics;

    text.setText(attackBonus > 0 ? `${attackerRoll}+1` : attackerRoll.toString());
    this.diceSprite.setPosition(0, 0);

    // Show both rolls (with bonuses if applicable)
    const label = this.diceContainer.getData('label') as Phaser.GameObjects.Text;
    const attackStr = attackBonus > 0 ? `${attackerRoll}+1=${finalAttackerRoll}` : attackerRoll.toString();
    const defenseStr = defenseBonus > 0 ? `${defenderRoll}+1=${finalDefenderRoll}` : defenderRoll.toString();
    label.setText(`${attacker.displayName}: ${attackStr}  vs  ${defender.displayName}: ${defenseStr}`);

    // Determine winner (using final rolls with bonuses)
    let winner: string;
    let attackerWins: boolean;

    if (finalAttackerRoll > finalDefenderRoll) {
      winner = attackerId;
      attackerWins = true;
      text.setColor('#44ff44');
      bg.clear();
      bg.fillStyle(0x224422, 0.9);
      bg.fillRoundedRect(-30, -30, 60, 60, 10);
      bg.lineStyle(3, 0x44ff44, 1);
      bg.strokeRoundedRect(-30, -30, 60, 60, 10);
    } else if (finalDefenderRoll > finalAttackerRoll) {
      winner = defenderId;
      attackerWins = false;
      text.setColor('#ff4444');
      bg.clear();
      bg.fillStyle(0x442222, 0.9);
      bg.fillRoundedRect(-30, -30, 60, 60, 10);
      bg.lineStyle(3, 0xff4444, 1);
      bg.strokeRoundedRect(-30, -30, 60, 60, 10);
    } else {
      // Tie - defender wins (defender advantage)
      winner = defenderId;
      attackerWins = false;
      text.setColor('#ffaa44');
      bg.clear();
      bg.fillStyle(0x443322, 0.9);
      bg.fillRoundedRect(-30, -30, 60, 60, 10);
      bg.lineStyle(3, 0xffaa44, 1);
      bg.strokeRoundedRect(-30, -30, 60, 60, 10);
    }

    // Pop animation
    this.tweens.add({
      targets: this.diceSprite,
      scale: 1.4,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    const winnerPlayer = this.gameState.players[winner];
    const resultText = finalAttackerRoll === finalDefenderRoll ? 'TIE! Defender wins!' : `${winnerPlayer.displayName} wins!`;
    this.showMessage(resultText, attackerWins ? 'success' : 'warning');

    // Apply combat result after delay
    this.time.delayedCall(1500, () => {
      this.applyCombatResult(attackerWins);
    });

    this.isRolling = false;
  }

  private applyCombatResult(attackerWins: boolean): void {
    if (!this.selectedUnitForAttack || !this.combatTarget) return;

    const attackerPos = this.selectedUnitForAttack;
    const defenderPos = this.combatTarget;
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];

    if (attackerWins) {
      this.attackWonThisTurn = true;
      const defenderCell = this.grid[defenderPos.y][defenderPos.x];
      const defenderId = defenderCell.ownerId!;
      const defender = this.gameState.players[defenderId];

      console.log('Combat result - Attacker wins!', { defenderCell, isCastle: defenderCell.isCastle, type: defenderCell.type });

      if (defenderCell.isCastle) {
        // Attacking castle - reduce HP (castle doesn't convert, just takes damage)
        defender.castleHP--;
        console.log(`Castle HP reduced to ${defender.castleHP}`);
        this.updatePlayerHP(defenderId, defender.castleHP);
        this.showMessage(`${defender.displayName}'s castle damaged! HP: ${defender.castleHP}`, 'warning');

        // Check for castle destruction (victory condition)
        if (defender.castleHP <= 0) {
          this.showMessage(`${defender.displayName} has been eliminated!`, 'warning');
          this.eliminatePlayer(defenderId, defenderPos);

          // Check for victory after a delay
          this.time.delayedCall(1500, () => {
            if (this.checkVictory()) {
              return; // Game ended, don't continue
            }
          });
        }
      } else {
        // CONVERT enemy unit to attacker's unit (not just destroy)
        defender.unitCount--;
        defenderCell.ownerId = currentPlayerId;
        // Cell type stays as 'unit', but now belongs to attacker
        currentPlayer.unitCount++;
        this.refreshTile(defenderPos.x, defenderPos.y);
        this.showMessage('Enemy unit captured!', 'success');
      }
    } else {
      // Attacker loses their unit - turn ends immediately
      const attackerCell = this.grid[attackerPos.y][attackerPos.x];

      attackerCell.type = 'empty';
      attackerCell.ownerId = null;
      currentPlayer.unitCount--;
      this.refreshTile(attackerPos.x, attackerPos.y);
      this.showMessage('Your unit was defeated! Turn ends.', 'warning');
    }

    // Decrement attacks remaining
    this.attacksRemaining--;

    // Reset combat state
    this.isInCombat = false;
    this.selectedUnitForAttack = null;
    this.combatTarget = null;
    this.clearHighlights();
    this.attackableEnemies.clear();

    // Handle next phase based on result
    this.time.delayedCall(1000, () => {
      this.afterCombat(attackerWins);
    });
  }

  private afterCombat(attackerWon: boolean): void {
    // Check if game has ended (victory was achieved)
    if (this.gameState.turnOrder.length <= 1) {
      return; // Game over, don't continue
    }

    // Reset dice display with current player's color
    const text = this.diceSprite.getData('text') as Phaser.GameObjects.Text;
    const currentPlayerId = this.gameState.turnOrder[this.gameState.currentPlayerIndex];
    const currentPlayer = this.gameState.players[currentPlayerId];
    const playerColor = PlayerColors[currentPlayer.color];

    text.setText('?');
    text.setColor('#888888');
    this.updateDiceBoxColor(playerColor);

    // If attacker lost, turn ends immediately (for both Option B and C)
    if (!attackerWon) {
      this.turnPhase = 'done';
      this.endTurn();
      return;
    }

    // Attacker won - handle based on selected option
    if (this.selectedTurnOption === 'B') {
      // Option B: 1 Attack + Expand - now proceed to placement (show roll button)
      this.turnPhase = 'placing';
      this.showMessage('Attack won! Now roll for units.', 'success');
      this.time.delayedCall(500, () => this.showRollDiceButton());
    } else if (this.selectedTurnOption === 'C') {
      // Option C: 2 Attacks - check if more attacks available
      if (this.attacksRemaining > 0 && this.playerHasAttackOptions()) {
        this.showMessage('Attack won! One more attack.', 'success');
        this.startAttackPhase();
      } else {
        // No more attacks or no targets - turn ends
        this.turnPhase = 'done';
        this.endTurn();
      }
    }
  }

  private eliminatePlayer(playerId: string, castlePos: Position): void {
    const player = this.gameState.players[playerId];

    // Remove castle from grid
    const castleCell = this.grid[castlePos.y][castlePos.x];
    castleCell.type = 'empty';
    castleCell.ownerId = null;
    castleCell.isCastle = false;
    this.refreshTile(castlePos.x, castlePos.y);

    // Remove castle sprite
    const castleSprite = this.castleSprites.get(playerId);
    if (castleSprite) {
      castleSprite.destroy();
      this.castleSprites.delete(playerId);
    }

    // Remove all units belonging to this player
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const cell = this.grid[y][x];
        if (cell.ownerId === playerId && cell.type === 'unit') {
          cell.type = 'empty';
          cell.ownerId = null;
          this.refreshTile(x, y);
        }
      }
    }

    // Remove from turn order
    const turnOrderIndex = this.gameState.turnOrder.indexOf(playerId);
    if (turnOrderIndex !== -1) {
      this.gameState.turnOrder.splice(turnOrderIndex, 1);

      // Adjust currentPlayerIndex if needed
      if (this.gameState.currentPlayerIndex >= this.gameState.turnOrder.length) {
        this.gameState.currentPlayerIndex = 0;
      } else if (turnOrderIndex < this.gameState.currentPlayerIndex) {
        this.gameState.currentPlayerIndex--;
      }
    }

    console.log(`${player.displayName} eliminated! Remaining players: ${this.gameState.turnOrder.length}`);
  }

  private checkVictory(): boolean {
    if (this.gameState.turnOrder.length === 1) {
      const winnerId = this.gameState.turnOrder[0];
      this.showVictoryScreen(winnerId);
      return true;
    }
    return false;
  }

  private showVictoryScreen(winnerId: string): void {
    const winner = this.gameState.players[winnerId];
    const winnerColor = PlayerColors[winner.color];
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Darken background
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1000);

    // Victory panel
    const panel = this.add.graphics();
    panel.fillStyle(winnerColor, 0.9);
    panel.fillRoundedRect(width / 2 - 250, height / 2 - 150, 500, 300, 20);
    panel.lineStyle(4, 0xffd700, 1);
    panel.strokeRoundedRect(width / 2 - 250, height / 2 - 150, 500, 300, 20);
    panel.setDepth(1001);

    // Victory text
    const victoryTitle = this.add.text(width / 2, height / 2 - 80, 'VICTORY!', {
      fontFamily: 'Georgia, serif',
      fontSize: '56px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(1002);

    const winnerText = this.add.text(width / 2, height / 2, `${winner.displayName} wins!`, {
      fontFamily: 'Georgia, serif',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(1002);

    // Stats
    const statsText = this.add.text(width / 2, height / 2 + 50, `Turn ${this.gameState.currentTurn}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: '#E8D5B0',
    }).setOrigin(0.5, 0.5).setDepth(1002);

    // Main Menu button
    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(0x4a7c34, 1);
    buttonBg.fillRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
    buttonBg.lineStyle(2, 0xffd700, 0.8);
    buttonBg.strokeRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
    buttonBg.setDepth(1002);

    const buttonText = this.add.text(width / 2, height / 2 + 115, 'Main Menu', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(1003);

    // Make button interactive
    const buttonHitArea = this.add.rectangle(width / 2, height / 2 + 115, 200, 50, 0x000000, 0);
    buttonHitArea.setDepth(1004);
    buttonHitArea.setInteractive({ useHandCursor: true });

    buttonHitArea.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x5a9c44, 1);
      buttonBg.fillRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
      buttonBg.lineStyle(2, 0xffd700, 1);
      buttonBg.strokeRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
    });

    buttonHitArea.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x4a7c34, 1);
      buttonBg.fillRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
      buttonBg.lineStyle(2, 0xffd700, 0.8);
      buttonBg.strokeRoundedRect(width / 2 - 100, height / 2 + 90, 200, 50, 10);
    });

    buttonHitArea.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });

    // Add celebration animation (floating particles)
    for (let i = 0; i < 30; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, width),
        height + 20,
        Phaser.Math.Between(3, 8),
        winnerColor,
        0.8
      );
      particle.setDepth(999);

      this.tweens.add({
        targets: particle,
        y: -50,
        x: particle.x + Phaser.Math.Between(-100, 100),
        alpha: 0,
        duration: Phaser.Math.Between(2000, 4000),
        ease: 'Linear',
        delay: Phaser.Math.Between(0, 2000),
        onComplete: () => particle.destroy(),
      });
    }
  }

  private refreshTile(x: number, y: number): void {
    // Remove old tile container
    const oldTile = this.tileSprites[y][x];
    if (oldTile) {
      this.gridContainer.remove(oldTile, true);
    }

    // Create new tile with updated state
    const newTile = this.createIsometricTileWithConfig(x, y);
    this.tileSprites[y][x] = newTile;
    this.gridContainer.add(newTile);
    this.gridContainer.sort('depth');
  }

  private createGridDebugPanel(): void {
    // Grid adjustment panel (left side)
    const panelX = 10;
    const panelY = 60;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.8);
    panel.fillRoundedRect(panelX, panelY, 210, 340, 8);
    panel.lineStyle(2, 0x44ff44, 0.5);
    panel.strokeRoundedRect(panelX, panelY, 210, 340, 8);

    // Title
    this.add.text(panelX + 105, panelY + 15, 'Grid Adjustments', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#44FF44',
    }).setOrigin(0.5, 0);

    // Current values display
    const valuesText = this.add.text(panelX + 10, panelY + 40, this.getGridConfigText(), {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      lineSpacing: 4,
    });

    // Create adjustment buttons
    const params = [
      { name: 'tileWidth', min: 32, max: 128, step: 4 },
      { name: 'tileHeight', min: 16, max: 64, step: 2 },
      { name: 'gridWidth', min: 8, max: 32, step: 2 },
      { name: 'gridHeight', min: 6, max: 20, step: 2 },
      { name: 'offsetX', min: -200, max: 200, step: 10 },
      { name: 'offsetY', min: -200, max: 200, step: 10 },
      { name: 'tileDepth', min: 0, max: 20, step: 2 },
      { name: 'rotation', min: -180, max: 180, step: 1 },
    ];

    let buttonY = panelY + 100;
    params.forEach((param) => {
      // Parameter label
      this.add.text(panelX + 10, buttonY, param.name, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#aaaaaa',
      });

      // Minus button
      const minusBtn = this.add.text(panelX + 100, buttonY, ' - ', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 8, y: 2 },
      }).setInteractive({ useHandCursor: true });

      // Plus button
      const plusBtn = this.add.text(panelX + 160, buttonY, ' + ', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 8, y: 2 },
      }).setInteractive({ useHandCursor: true });

      minusBtn.on('pointerdown', () => {
        const key = param.name as keyof typeof GRID_CONFIG;
        GRID_CONFIG[key] = Math.max(param.min, GRID_CONFIG[key] - param.step);
        this.updateGrid();
        valuesText.setText(this.getGridConfigText());
      });

      plusBtn.on('pointerdown', () => {
        const key = param.name as keyof typeof GRID_CONFIG;
        GRID_CONFIG[key] = Math.min(param.max, GRID_CONFIG[key] + param.step);
        this.updateGrid();
        valuesText.setText(this.getGridConfigText());
      });

      buttonY += 25;
    });

    // Print config button
    const printBtn = this.add.text(panelX + 105, panelY + 310, 'Print to Console', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#44FF44',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    printBtn.on('pointerdown', () => {
      console.log('=== GRID_CONFIG ===');
      console.log(JSON.stringify(GRID_CONFIG, null, 2));
      console.log('===================');
    });
  }

  private getGridConfigText(): string {
    return `tileWidth:  ${GRID_CONFIG.tileWidth}
tileHeight: ${GRID_CONFIG.tileHeight}
gridWidth:  ${GRID_CONFIG.gridWidth}
gridHeight: ${GRID_CONFIG.gridHeight}
offsetX:    ${GRID_CONFIG.offsetX}
offsetY:    ${GRID_CONFIG.offsetY}
tileDepth:  ${GRID_CONFIG.tileDepth}
rotation:   ${GRID_CONFIG.rotation}°`;
  }

  private updateGrid(): void {
    // Update grid container position and rotation
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.gridContainer.setPosition(
      width / 2 + GRID_CONFIG.offsetX,
      height / 2 + GRID_CONFIG.offsetY
    );
    // Keep castle container in sync with grid container
    this.castleContainer.setPosition(
      width / 2 + GRID_CONFIG.offsetX,
      height / 2 + GRID_CONFIG.offsetY
    );
    // Convert degrees to radians for Phaser
    this.gridContainer.setRotation(GRID_CONFIG.rotation * (Math.PI / 180));
    this.castleContainer.setRotation(GRID_CONFIG.rotation * (Math.PI / 180));

    // Rebuild tiles with new dimensions
    this.rebuildGrid();
  }

  private rebuildGrid(): void {
    // Clear existing tiles and castles
    this.gridContainer.removeAll(true);
    this.castleContainer.removeAll(true);
    this.tileSprites = [];
    this.castleSprites.clear();
    this.playerHearts.clear();
    this.chestSprites.clear();

    // Reinitialize grid array with new dimensions
    this.grid = [];
    for (let y = 0; y < GRID_CONFIG.gridHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < GRID_CONFIG.gridWidth; x++) {
        this.grid[y][x] = {
          x,
          y,
          type: 'empty',
          ownerId: null,
          isCastle: false,
        };
      }
    }

    // Replace castles at corners based on new grid size
    this.placeCastle(1, 1, 'player1', 'blue');
    this.placeCastle(GRID_CONFIG.gridWidth - 3, 1, 'player2', 'red');
    this.placeCastle(1, GRID_CONFIG.gridHeight - 3, 'player3', 'green');
    this.placeCastle(GRID_CONFIG.gridWidth - 3, GRID_CONFIG.gridHeight - 3, 'player4', 'yellow');

    // Rebuild tiles with new config
    for (let y = 0; y < GRID_CONFIG.gridHeight; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GRID_CONFIG.gridWidth; x++) {
        const tile = this.createIsometricTileWithConfig(x, y);
        this.tileSprites[y][x] = tile;
        this.gridContainer.add(tile);
      }
    }

    this.gridContainer.sort('depth');
  }

  private createIsometricTileWithConfig(gridX: number, gridY: number): Phaser.GameObjects.Container {
    const tileW = GRID_CONFIG.tileWidth;
    const tileH = GRID_CONFIG.tileHeight;
    const depth = GRID_CONFIG.tileDepth;

    const screenX = (gridX - gridY) * (tileW / 2);
    const screenY = (gridX + gridY) * (tileH / 2);
    const cell = this.grid[gridY][gridX];

    const tileContainer = this.add.container(screenX, screenY);
    tileContainer.setDepth(gridX + gridY);

    const color = this.getTileColor(cell);

    // Check if grass5 texture exists and use it for grass tiles
    const useGrassTexture = this.textures.exists('tile_grass5') &&
      (cell.type === 'empty' || cell.type === 'unit' || cell.type === 'castle' || cell.type === 'chest');

    if (useGrassTexture) {
      // Create grass tile using image with mask
      const grassSprite = this.add.image(0, 0, 'tile_grass5');

      // Scale the sprite to fit the isometric tile
      const scaleX = tileW / grassSprite.width * 1.5;
      const scaleY = tileH / grassSprite.height * 1.5;
      grassSprite.setScale(scaleX, scaleY);

      // Calculate world position for the mask
      // gridContainer position + tile's local position
      const camWidth = this.cameras.main.width;
      const camHeight = this.cameras.main.height;
      const worldX = camWidth / 2 + GRID_CONFIG.offsetX + screenX;
      const worldY = camHeight / 2 + GRID_CONFIG.offsetY + screenY;

      // Create a mask shape for the isometric diamond at world coordinates
      const maskShape = this.make.graphics({ x: 0, y: 0 });
      maskShape.fillStyle(0xffffff);
      maskShape.beginPath();
      maskShape.moveTo(worldX, worldY - tileH / 2);
      maskShape.lineTo(worldX + tileW / 2, worldY);
      maskShape.lineTo(worldX, worldY + tileH / 2);
      maskShape.lineTo(worldX - tileW / 2, worldY);
      maskShape.closePath();
      maskShape.fillPath();

      const mask = maskShape.createGeometryMask();
      grassSprite.setMask(mask);

      tileContainer.add(grassSprite);

      // Add subtle border
      const border = this.add.graphics();
      border.lineStyle(1, 0xffffff, 0.15);
      border.beginPath();
      border.moveTo(0, -tileH / 2);
      border.lineTo(tileW / 2, 0);
      border.lineTo(0, tileH / 2);
      border.lineTo(-tileW / 2, 0);
      border.closePath();
      border.strokePath();
      tileContainer.add(border);

      // Add color overlay for owned tiles
      if (cell.ownerId && (cell.type === 'unit' || cell.type === 'castle')) {
        const overlay = this.add.graphics();
        overlay.fillStyle(color, 0.4);
        overlay.beginPath();
        overlay.moveTo(0, -tileH / 2);
        overlay.lineTo(tileW / 2, 0);
        overlay.lineTo(0, tileH / 2);
        overlay.lineTo(-tileW / 2, 0);
        overlay.closePath();
        overlay.fillPath();
        tileContainer.add(overlay);
      }
    } else {
      // Fallback to colored tiles
      const tile = this.add.graphics();

      // Top face
      tile.fillStyle(color, 1);
      tile.beginPath();
      tile.moveTo(0, -tileH / 2);
      tile.lineTo(tileW / 2, 0);
      tile.lineTo(0, tileH / 2);
      tile.lineTo(-tileW / 2, 0);
      tile.closePath();
      tile.fillPath();

      // Left side
      tile.fillStyle(this.adjustBrightness(color, 0.7), 1);
      tile.beginPath();
      tile.moveTo(-tileW / 2, 0);
      tile.lineTo(0, tileH / 2);
      tile.lineTo(0, tileH / 2 + depth);
      tile.lineTo(-tileW / 2, depth);
      tile.closePath();
      tile.fillPath();

      // Right side
      tile.fillStyle(this.adjustBrightness(color, 0.5), 1);
      tile.beginPath();
      tile.moveTo(tileW / 2, 0);
      tile.lineTo(0, tileH / 2);
      tile.lineTo(0, tileH / 2 + depth);
      tile.lineTo(tileW / 2, depth);
      tile.closePath();
      tile.fillPath();

      // Border
      tile.lineStyle(1, 0xffffff, 0.1);
      tile.beginPath();
      tile.moveTo(0, -tileH / 2);
      tile.lineTo(tileW / 2, 0);
      tile.lineTo(0, tileH / 2);
      tile.lineTo(-tileW / 2, 0);
      tile.closePath();
      tile.strokePath();

      tileContainer.add(tile);
    }

    // Add castle if anchor
    if (cell.isCastle && this.isCastleAnchor(gridX, gridY)) {
      this.addCastleSprite(gridX, gridY, cell.ownerId);
    }

    // Add unit marker for unit cells
    if (cell.type === 'unit' && cell.ownerId) {
      this.addUnitMarker(tileContainer, cell.ownerId);
    }

    // Add highlight graphics layer (for valid placements)
    const highlight = this.add.graphics();
    tileContainer.add(highlight);
    tileContainer.setData('highlight', highlight);

    // Make interactive
    const hitArea = new Phaser.Geom.Polygon([
      new Phaser.Geom.Point(0, -tileH / 2),
      new Phaser.Geom.Point(tileW / 2, 0),
      new Phaser.Geom.Point(0, tileH / 2),
      new Phaser.Geom.Point(-tileW / 2, 0),
    ]);

    tileContainer.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);
    tileContainer.setData('gridX', gridX);
    tileContainer.setData('gridY', gridY);

    return tileContainer;
  }

  private addUnitMarker(container: Phaser.GameObjects.Container, ownerId: string): void {
    const player = this.gameState?.players[ownerId];
    if (!player) return;

    const color = PlayerColors[player.color];

    // Draw a soldier marker
    const marker = this.add.graphics();

    // Base circle
    marker.fillStyle(color, 1);
    marker.fillCircle(0, -5, 6);

    // Helmet/head
    marker.fillStyle(0x333333, 1);
    marker.fillCircle(0, -10, 4);

    // Border
    marker.lineStyle(1, 0x000000, 0.8);
    marker.strokeCircle(0, -5, 6);

    container.add(marker);
  }

  private selectedCastle: string = 'player1';
  private castleValuesText!: Phaser.GameObjects.Text;
  private castleTabs: Phaser.GameObjects.Text[] = [];

  private createDebugUI(): void {
    const width = this.cameras.main.width;

    // Grid adjustment panel (left side)
    this.createGridDebugPanel();

    // Castle adjustment panel (right side)
    this.createCastleDebugPanel();
  }

  private createCastleDebugPanel(): void {
    const width = this.cameras.main.width;
    const panelX = width - 220;
    const panelY = 60;

    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.8);
    panel.fillRoundedRect(panelX, panelY, 210, 380, 8);
    panel.lineStyle(2, 0xffd700, 0.5);
    panel.strokeRoundedRect(panelX, panelY, 210, 380, 8);

    // Title
    this.add.text(panelX + 105, panelY + 10, 'Castle Adjustments', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);

    // Castle selection tabs
    const castles = [
      { id: 'player1', label: 'P1', color: '#4444FF', name: 'Blue (TL)' },
      { id: 'player2', label: 'P2', color: '#FFFF44', name: 'Yellow (TR)' },
      { id: 'player3', label: 'P3', color: '#4444FF', name: 'Blue (BL)' },
      { id: 'player4', label: 'P4', color: '#FFFF44', name: 'Yellow (BR)' },
    ];

    let tabX = panelX + 15;
    this.castleTabs = [];
    castles.forEach((castle) => {
      const tab = this.add.text(tabX, panelY + 32, castle.label, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: this.selectedCastle === castle.id ? '#000000' : '#ffffff',
        backgroundColor: this.selectedCastle === castle.id ? castle.color : '#444444',
        padding: { x: 8, y: 4 },
      }).setInteractive({ useHandCursor: true });

      tab.on('pointerdown', () => {
        this.selectedCastle = castle.id;
        this.updateCastleTabs();
        this.castleValuesText.setText(this.getConfigText(castle.id));
      });

      this.castleTabs.push(tab);
      tabX += 48;
    });

    // Current castle name
    const castleNameText = this.add.text(panelX + 105, panelY + 58, castles[0].name, {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0);

    // Current values display
    this.castleValuesText = this.add.text(panelX + 10, panelY + 78, this.getConfigText('player1'), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      lineSpacing: 2,
    });

    // Store castle name text for updates
    this.castleTabs.forEach((tab, index) => {
      tab.on('pointerdown', () => {
        castleNameText.setText(castles[index].name);
      });
    });

    // Create adjustment buttons
    const params = [
      { name: 'offsetX', min: -100, max: 100, step: 5 },
      { name: 'offsetY', min: -100, max: 100, step: 5 },
      { name: 'scale', min: 0.02, max: 0.3, step: 0.01 },
      { name: 'originX', min: 0, max: 1, step: 0.1 },
      { name: 'originY', min: 0, max: 1, step: 0.1 },
      { name: 'rotation', min: -180, max: 180, step: 1 },
    ];

    let buttonY = panelY + 158;
    params.forEach((param) => {
      // Parameter label
      this.add.text(panelX + 10, buttonY, param.name, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#aaaaaa',
      });

      // Minus button
      const minusBtn = this.add.text(panelX + 100, buttonY, ' - ', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 6, y: 1 },
      }).setInteractive({ useHandCursor: true });

      // Plus button
      const plusBtn = this.add.text(panelX + 155, buttonY, ' + ', {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 6, y: 1 },
      }).setInteractive({ useHandCursor: true });

      minusBtn.on('pointerdown', () => {
        const config = CASTLE_CONFIGS[this.selectedCastle];
        const key = param.name as keyof typeof config;
        config[key] = Math.max(param.min, config[key] - param.step);
        config[key] = Math.round(config[key] * 100) / 100;
        this.updateCastle(this.selectedCastle);
        this.castleValuesText.setText(this.getConfigText(this.selectedCastle));
      });

      plusBtn.on('pointerdown', () => {
        const config = CASTLE_CONFIGS[this.selectedCastle];
        const key = param.name as keyof typeof config;
        config[key] = Math.min(param.max, config[key] + param.step);
        config[key] = Math.round(config[key] * 100) / 100;
        this.updateCastle(this.selectedCastle);
        this.castleValuesText.setText(this.getConfigText(this.selectedCastle));
      });

      buttonY += 24;
    });

    // Print config button
    const printBtn = this.add.text(panelX + 105, panelY + 310, 'Print Current', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#000000',
      backgroundColor: '#FFD700',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    printBtn.on('pointerdown', () => {
      console.log(`=== CASTLE_CONFIG (${this.selectedCastle}) ===`);
      console.log(JSON.stringify(CASTLE_CONFIGS[this.selectedCastle], null, 2));
      console.log('=============================');
    });

    // Print all button
    const printAllBtn = this.add.text(panelX + 105, panelY + 345, 'Print All', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: '#000000',
      backgroundColor: '#44FF44',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    printAllBtn.on('pointerdown', () => {
      console.log('=== ALL CASTLE_CONFIGS ===');
      console.log(JSON.stringify(CASTLE_CONFIGS, null, 2));
      console.log('==========================');
    });
  }

  private updateCastleTabs(): void {
    const colors = ['#4444FF', '#FFFF44', '#4444FF', '#FFFF44'];
    const ids = ['player1', 'player2', 'player3', 'player4'];

    this.castleTabs.forEach((tab, index) => {
      const isSelected = this.selectedCastle === ids[index];
      tab.setColor(isSelected ? '#000000' : '#ffffff');
      tab.setBackgroundColor(isSelected ? colors[index] : '#444444');
    });
  }

  private getConfigText(playerId: string): string {
    const config = CASTLE_CONFIGS[playerId];
    return `offsetX:  ${config.offsetX}
offsetY:  ${config.offsetY}
scale:    ${config.scale}
originX:  ${config.originX}
originY:  ${config.originY}
rotation: ${config.rotation}°`;
  }

  private updateCastle(playerId: string): void {
    const castle = this.castleSprites.get(playerId);
    if (!castle) return;

    const config = CASTLE_CONFIGS[playerId];
    const baseX = castle.getData('baseX') || 0;
    const baseY = castle.getData('baseY') || 0;
    castle.setPosition(baseX + config.offsetX, baseY + config.offsetY);
    castle.setScale(config.scale);
    castle.setOrigin(config.originX, config.originY);
    castle.setRotation(config.rotation * (Math.PI / 180));
  }

  update(_time: number, _delta: number): void {
    // Game loop updates
    // TODO: Add animations, timer updates, etc.
  }
}
