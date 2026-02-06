/**
 * Dice Dominion - Main Entry Point
 * Phaser 3 Game Configuration
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloaderScene } from './scenes/PreloaderScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameSetupScene } from './scenes/GameSetupScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,  // WebGL with Canvas fallback
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloaderScene, MainMenuScene, GameSetupScene, GameScene],
  render: {
    pixelArt: false,  // Smooth scaling for painted art style
    antialias: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

// Create the game instance
const game = new Phaser.Game(config);

export default game;
