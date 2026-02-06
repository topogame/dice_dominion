/**
 * Dice Dominion - Boot Scene
 * Initial scene that sets up basic configurations
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load minimal assets needed for the preloader
    // Loading bar background, etc.
  }

  create(): void {
    // Set up any global game settings
    this.scale.on('resize', this.resize, this);

    // Transition to preloader
    this.scene.start('PreloaderScene');
  }

  private resize(gameSize: Phaser.Structs.Size): void {
    // Handle window resize
    const width = gameSize.width;
    const height = gameSize.height;
    this.cameras.resize(width, height);
  }
}
