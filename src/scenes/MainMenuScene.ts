/**
 * Dice Dominion - Main Menu Scene
 * Medieval-themed main menu with game options
 */

import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a3a5c, 0x1a3a5c, 0x281e14, 0x281e14, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    const title = this.add.text(width / 2, height * 0.2, 'DICE DOMINION', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: '64px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#000000',
        blur: 8,
        fill: true,
      },
    });
    title.setOrigin(0.5, 0.5);

    // Subtitle
    const subtitle = this.add.text(width / 2, height * 0.28, 'Medieval Strategy Game', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#E8D5B0',
    });
    subtitle.setOrigin(0.5, 0.5);

    // Menu buttons
    this.createButton(width / 2, height * 0.45, 'Start Game', () => {
      this.scene.start('GameSetupScene');
    });

    this.createButton(width / 2, height * 0.55, 'Settings', () => {
      console.log('Settings clicked');
    });

    this.createButton(width / 2, height * 0.65, 'How to Play', () => {
      console.log('How to Play clicked');
    });

    // Version text
    const version = this.add.text(width - 10, height - 10, 'v1.0.0 - Phaser 3', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#666666',
    });
    version.setOrigin(1, 1);

    // Add atmospheric particles (embers)
    this.createParticles();
  }

  private createButton(x: number, y: number, text: string, callback: () => void): void {
    // Button background
    const buttonBg = this.add.graphics();
    const buttonWidth = 250;
    const buttonHeight = 50;

    // Draw button shape
    buttonBg.fillStyle(0x281e14, 0.95);
    buttonBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);
    buttonBg.lineStyle(2, 0xffd700, 0.5);
    buttonBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);

    // Button text
    const buttonText = this.add.text(x, y, text, {
      fontFamily: 'Georgia, serif',
      fontSize: '22px',
      color: '#FFD700',
    });
    buttonText.setOrigin(0.5, 0.5);

    // Interactive zone
    const hitArea = this.add.zone(x, y, buttonWidth, buttonHeight);
    hitArea.setInteractive({ useHandCursor: true });

    // Hover effects
    hitArea.on('pointerover', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x3a2e24, 0.95);
      buttonBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonBg.lineStyle(2, 0xffd700, 0.8);
      buttonBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonText.setScale(1.05);
    });

    hitArea.on('pointerout', () => {
      buttonBg.clear();
      buttonBg.fillStyle(0x281e14, 0.95);
      buttonBg.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonBg.lineStyle(2, 0xffd700, 0.5);
      buttonBg.strokeRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 8);
      buttonText.setScale(1);
    });

    hitArea.on('pointerdown', callback);
  }

  private createParticles(): void {
    // Create floating ember particles for atmosphere
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create multiple embers
    for (let i = 0; i < 20; i++) {
      const ember = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        0xff6b35,
        0.6
      );

      // Animate ember floating upward
      this.tweens.add({
        targets: ember,
        y: -20,
        x: ember.x + Phaser.Math.Between(-50, 50),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 8000),
        ease: 'Linear',
        repeat: -1,
        onRepeat: () => {
          ember.y = height + 20;
          ember.x = Phaser.Math.Between(0, width);
          ember.alpha = 0.6;
        },
      });
    }
  }
}
