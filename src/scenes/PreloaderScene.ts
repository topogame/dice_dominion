/**
 * Dice Dominion - Preloader Scene
 * Loads all game assets with a progress bar
 */

import Phaser from 'phaser';

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Progress bar background
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    // Progress bar
    const progressBar = this.add.graphics();

    // Loading text
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#FFD700',
    });
    loadingText.setOrigin(0.5, 0.5);

    // Percentage text
    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffffff',
    });
    percentText.setOrigin(0.5, 0.5);

    // Update progress bar
    this.load.on('progress', (value: number) => {
      percentText.setText(Math.round(value * 100) + '%');
      progressBar.clear();
      progressBar.fillStyle(0xffd700, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    // Clean up when complete
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Load all game assets
    this.loadAssets();
  }

  private loadAssets(): void {
    // Background images
    this.load.image('background', 'assets/background.png');
    this.load.image('menuBackground', 'assets/ui/menu_bg.png');

    // Tile sprites
    this.load.image('tile_grass', 'assets/tiles/grass.png');
    this.load.image('tile_grass5', 'assets/tiles/grass5.png');
    this.load.image('tile_water', 'assets/tiles/water.png');
    this.load.image('tile_mountain', 'assets/tiles/mountain.png');
    this.load.image('tile_bridge', 'assets/tiles/bridge.png');

    // Castle sprites
    this.load.image('castle_blue', 'assets/castles/castle_blue.png');
    this.load.image('castle_red', 'assets/castles/castle_red.png');
    this.load.image('castle_green', 'assets/castles/castle_green.png');
    this.load.image('castle_yellow', 'assets/castles/castle_yellow.png');

    // Unit sprites
    this.load.image('unit_blue', 'assets/sprites/unit_blue.png');
    this.load.image('unit_red', 'assets/sprites/unit_red.png');
    this.load.image('unit_green', 'assets/sprites/unit_green.png');
    this.load.image('unit_yellow', 'assets/sprites/unit_yellow.png');

    // UI elements
    this.load.image('chest', 'assets/sprites/chest.png');
    this.load.image('button', 'assets/ui/button.png');
    this.load.image('panel', 'assets/ui/panel.png');

    // Audio (optional - add later)
    // this.load.audio('bgm', 'assets/audio/bgm.mp3');
    // this.load.audio('click', 'assets/audio/click.wav');
  }

  create(): void {
    // Transition to main menu
    this.scene.start('MainMenuScene');
  }
}
