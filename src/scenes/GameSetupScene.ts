/**
 * Dice Dominion - Game Setup Scene
 * Allows players to configure game options before starting
 */

import Phaser from 'phaser';

export interface GameSetupOptions {
  playerCount: number;
  mapType: 'flat' | 'river' | 'mountain' | 'bridge';
}

export class GameSetupScene extends Phaser.Scene {
  private selectedPlayerCount: number = 4;
  private selectedMapType: 'flat' | 'river' | 'mountain' | 'bridge' = 'flat';
  private playerButtons: Phaser.GameObjects.Container[] = [];
  private mapButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'GameSetupScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Reset arrays for scene re-entry
    this.playerButtons = [];
    this.mapButtons = [];

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a3a5c, 0x1a3a5c, 0x281e14, 0x281e14, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, 60, 'GAME SETUP', {
      fontFamily: 'Georgia, serif',
      fontSize: '48px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    // Player Count Section
    this.add.text(width / 2, 140, 'Number of Players', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#E8D5B0',
    }).setOrigin(0.5, 0.5);

    this.createPlayerCountButtons();

    // Map Type Section
    this.add.text(width / 2, 280, 'Map Type', {
      fontFamily: 'Georgia, serif',
      fontSize: '24px',
      color: '#E8D5B0',
    }).setOrigin(0.5, 0.5);

    this.createMapTypeButtons();

    // Start Game Button
    this.createStartButton();

    // Back Button
    this.createBackButton();

    // Add floating embers for atmosphere
    this.createParticles();
  }

  private createPlayerCountButtons(): void {
    const width = this.cameras.main.width;
    const buttonY = 190;
    const counts = [2, 3, 4];
    const startX = width / 2 - 120;

    counts.forEach((count, index) => {
      const x = startX + index * 120;
      const button = this.createOptionButton(x, buttonY, `${count} Players`, count === this.selectedPlayerCount, () => {
        this.selectedPlayerCount = count;
        this.updatePlayerButtons();
      });
      this.playerButtons.push(button);
    });
  }

  private createMapTypeButtons(): void {
    const width = this.cameras.main.width;
    const buttonY = 340;
    const maps: Array<{ type: 'flat' | 'river' | 'mountain' | 'bridge'; label: string; description: string }> = [
      { type: 'flat', label: 'Flat', description: 'Classic open battlefield' },
      { type: 'river', label: 'River', description: 'Water divides the map' },
      { type: 'mountain', label: 'Mountain', description: 'Rocky terrain blocks paths' },
      { type: 'bridge', label: 'Bridge', description: 'Strategic crossing points' },
    ];

    const startX = width / 2 - 240;

    maps.forEach((map, index) => {
      const x = startX + index * 160;
      const button = this.createMapButton(x, buttonY, map.label, map.description, map.type === this.selectedMapType, () => {
        this.selectedMapType = map.type;
        this.updateMapButtons();
      });
      this.mapButtons.push(button);
    });
  }

  private createOptionButton(x: number, y: number, text: string, selected: boolean, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    this.drawButtonBg(bg, selected, 100, 40);

    const buttonText = this.add.text(0, 0, text, {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      color: selected ? '#000000' : '#FFD700',
    }).setOrigin(0.5, 0.5);

    container.add([bg, buttonText]);
    container.setData('bg', bg);
    container.setData('text', buttonText);
    container.setData('selected', selected);

    const hitArea = new Phaser.Geom.Rectangle(-50, -20, 100, 40);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    container.on('pointerdown', callback);

    container.on('pointerover', () => {
      if (!container.getData('selected')) {
        bg.clear();
        this.drawButtonBg(bg, false, 100, 40, true);
      }
    });

    container.on('pointerout', () => {
      if (!container.getData('selected')) {
        bg.clear();
        this.drawButtonBg(bg, false, 100, 40, false);
      }
    });

    return container;
  }

  private createMapButton(x: number, y: number, label: string, description: string, selected: boolean, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    this.drawButtonBg(bg, selected, 140, 80);

    const labelText = this.add.text(0, -15, label, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: selected ? '#000000' : '#FFD700',
    }).setOrigin(0.5, 0.5);

    const descText = this.add.text(0, 15, description, {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: selected ? '#333333' : '#aaaaaa',
      wordWrap: { width: 120 },
      align: 'center',
    }).setOrigin(0.5, 0.5);

    container.add([bg, labelText, descText]);
    container.setData('bg', bg);
    container.setData('labelText', labelText);
    container.setData('descText', descText);
    container.setData('selected', selected);

    const hitArea = new Phaser.Geom.Rectangle(-70, -40, 140, 80);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    container.on('pointerdown', callback);

    container.on('pointerover', () => {
      if (!container.getData('selected')) {
        bg.clear();
        this.drawButtonBg(bg, false, 140, 80, true);
      }
    });

    container.on('pointerout', () => {
      if (!container.getData('selected')) {
        bg.clear();
        this.drawButtonBg(bg, false, 140, 80, false);
      }
    });

    return container;
  }

  private drawButtonBg(graphics: Phaser.GameObjects.Graphics, selected: boolean, width: number, height: number, hover: boolean = false): void {
    if (selected) {
      graphics.fillStyle(0xffd700, 1);
    } else if (hover) {
      graphics.fillStyle(0x3a2e24, 1);
    } else {
      graphics.fillStyle(0x281e14, 0.95);
    }
    graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    graphics.lineStyle(2, selected ? 0x000000 : 0xffd700, selected ? 0.8 : 0.5);
    graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
  }

  private updatePlayerButtons(): void {
    const counts = [2, 3, 4];
    this.playerButtons.forEach((container, index) => {
      const selected = counts[index] === this.selectedPlayerCount;
      container.setData('selected', selected);
      const bg = container.getData('bg') as Phaser.GameObjects.Graphics;
      const text = container.getData('text') as Phaser.GameObjects.Text;
      bg.clear();
      this.drawButtonBg(bg, selected, 100, 40);
      text.setColor(selected ? '#000000' : '#FFD700');
    });
  }

  private updateMapButtons(): void {
    const maps: Array<'flat' | 'river' | 'mountain' | 'bridge'> = ['flat', 'river', 'mountain', 'bridge'];
    this.mapButtons.forEach((container, index) => {
      const selected = maps[index] === this.selectedMapType;
      container.setData('selected', selected);
      const bg = container.getData('bg') as Phaser.GameObjects.Graphics;
      const labelText = container.getData('labelText') as Phaser.GameObjects.Text;
      const descText = container.getData('descText') as Phaser.GameObjects.Text;
      bg.clear();
      this.drawButtonBg(bg, selected, 140, 80);
      labelText.setColor(selected ? '#000000' : '#FFD700');
      descText.setColor(selected ? '#333333' : '#aaaaaa');
    });
  }

  private createStartButton(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const container = this.add.container(width / 2, height - 120);

    const bg = this.add.graphics();
    bg.fillStyle(0x4a7c34, 1);
    bg.fillRoundedRect(-120, -30, 240, 60, 10);
    bg.lineStyle(3, 0xffd700, 0.8);
    bg.strokeRoundedRect(-120, -30, 240, 60, 10);

    const text = this.add.text(0, 0, 'START GAME', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);

    container.add([bg, text]);

    const hitArea = new Phaser.Geom.Rectangle(-120, -30, 240, 60);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x5a9c44, 1);
      bg.fillRoundedRect(-120, -30, 240, 60, 10);
      bg.lineStyle(3, 0xffd700, 1);
      bg.strokeRoundedRect(-120, -30, 240, 60, 10);
      container.setScale(1.05);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x4a7c34, 1);
      bg.fillRoundedRect(-120, -30, 240, 60, 10);
      bg.lineStyle(3, 0xffd700, 0.8);
      bg.strokeRoundedRect(-120, -30, 240, 60, 10);
      container.setScale(1);
    });

    container.on('pointerdown', () => {
      // Pass game setup options to GameScene
      this.scene.start('GameScene', {
        playerCount: this.selectedPlayerCount,
        mapType: this.selectedMapType,
      } as GameSetupOptions);
    });
  }

  private createBackButton(): void {
    const backButton = this.add.text(20, 20, '← Back', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 10, y: 5 },
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
    backButton.on('pointerover', () => backButton.setColor('#FFD700'));
    backButton.on('pointerout', () => backButton.setColor('#ffffff'));
  }

  private createParticles(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    for (let i = 0; i < 15; i++) {
      const ember = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        0xff6b35,
        0.6
      );

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
