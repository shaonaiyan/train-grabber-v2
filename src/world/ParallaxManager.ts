import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/GameConfig';

export class ParallaxManager {
  private scene: Phaser.Scene;
  private skyLayer!: Phaser.GameObjects.TileSprite;
  private farMtsLayer!: Phaser.GameObjects.TileSprite;
  private midRuinsLayer!: Phaser.GameObjects.TileSprite;
  private nearGroundLayer!: Phaser.GameObjects.TileSprite;
  private trackLayer!: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.generateTextures();
    this.createLayers();
  }

  private generateTextures(): void {
    // 1. Sky & Dunes
    if (!this.scene.textures.exists('bg_sky')) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      grad.addColorStop(0, '#1c1512');
      grad.addColorStop(0.35, '#452b1e');
      grad.addColorStop(0.55, '#8c5936');
      grad.addColorStop(0.75, '#c98a58');
      grad.addColorStop(1.0, '#dfa872');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 1080);

      // Pale sun glow
      ctx.beginPath();
      ctx.arc(256, 260, 90, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 235, 200, 0.25)';
      ctx.fill();

      this.scene.textures.addCanvas('bg_sky', canvas);
    }

    // 2. Far Mesa Mountains
    if (!this.scene.textures.exists('bg_far_mts')) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 360;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(107, 68, 52, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0, 360);
      ctx.lineTo(0, 180);
      ctx.lineTo(120, 140);
      ctx.lineTo(240, 190);
      ctx.lineTo(380, 110);
      ctx.lineTo(520, 160);
      ctx.lineTo(680, 90);
      ctx.lineTo(820, 170);
      ctx.lineTo(960, 130);
      ctx.lineTo(1024, 180);
      ctx.lineTo(1024, 360);
      ctx.closePath();
      ctx.fill();
      this.scene.textures.addCanvas('bg_far_mts', canvas);
    }

    // 3. Mid Ruins, Factory silhouettes, Wooden Towers, Power Poles
    if (!this.scene.textures.exists('bg_mid_ruins')) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 300;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#633e2c';

      // Rolling mesa ridge
      ctx.beginPath();
      ctx.moveTo(0, 300);
      ctx.lineTo(0, 200);
      ctx.lineTo(180, 160);
      ctx.lineTo(320, 220);
      ctx.lineTo(480, 180);
      ctx.lineTo(720, 210);
      ctx.lineTo(900, 150);
      ctx.lineTo(1024, 200);
      ctx.lineTo(1024, 300);
      ctx.closePath();
      ctx.fill();

      // Industrial silhouette details (Power poles, chimneys, oil tank)
      ctx.fillStyle = '#4a2d20';
      // Chimney
      ctx.fillRect(200, 100, 24, 80);
      ctx.fillRect(240, 120, 18, 60);
      // Pylon
      ctx.fillRect(520, 90, 6, 100);
      ctx.fillRect(500, 110, 46, 4);
      ctx.fillRect(506, 130, 34, 4);
      // Abandoned tank
      ctx.beginPath();
      ctx.arc(800, 170, 35, 0, Math.PI * 2);
      ctx.fill();

      this.scene.textures.addCanvas('bg_mid_ruins', canvas);
    }

    // 4. Near Ground Desert & Cacti
    if (!this.scene.textures.exists('bg_near_ground')) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      // Sandy desert ground
      ctx.fillStyle = '#9e6d45';
      ctx.fillRect(0, 0, 1024, 400);

      // Rocky texture specs
      ctx.fillStyle = '#7a5130';
      for (let i = 0; i < 60; i++) {
        const rx = (i * 37) % 1024;
        const ry = (i * 23) % 400;
        ctx.fillRect(rx, ry, 6, 3);
      }

      // Saguaro Cacti silhouettes
      ctx.fillStyle = '#3a4b2c';
      const drawCactus = (cx: number, cy: number, ch: number) => {
        ctx.fillRect(cx, cy - ch, 10, ch);
        ctx.fillRect(cx - 12, cy - ch * 0.6, 12, 6);
        ctx.fillRect(cx - 12, cy - ch * 0.8, 6, ch * 0.25);
        ctx.fillRect(cx + 10, cy - ch * 0.5, 12, 6);
        ctx.fillRect(cx + 16, cy - ch * 0.7, 6, ch * 0.25);
      };
      drawCactus(150, 240, 55);
      drawCactus(620, 260, 65);
      drawCactus(910, 230, 50);

      this.scene.textures.addCanvas('bg_near_ground', canvas);
    }

    // 5. Track at Y ≈ 710
    if (!this.scene.textures.exists('bg_track')) {
      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;

      // Ballast gravel
      ctx.fillStyle = '#5c4538';
      ctx.fillRect(0, 10, 120, 60);

      // Wooden Ties (Sleepers)
      ctx.fillStyle = '#321f14';
      ctx.fillRect(10, 14, 20, 52);
      ctx.fillRect(70, 14, 20, 52);

      // Steel Rails (Two parallel shiny rails with 3/4 perspective)
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(0, 24, 120, 6);
      ctx.fillRect(0, 50, 120, 6);

      // Rail top highlight
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(0, 24, 120, 2);
      ctx.fillRect(0, 50, 120, 2);

      this.scene.textures.addCanvas('bg_track', canvas);
    }
  }

  private createLayers(): void {
    // Sky
    this.skyLayer = this.scene.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'bg_sky');
    this.skyLayer.setOrigin(0, 0);
    this.skyLayer.setDepth(0);

    // Far Mesa Mountains (Y around 280)
    this.farMtsLayer = this.scene.add.tileSprite(0, 240, GAME_WIDTH, 360, 'bg_far_mts');
    this.farMtsLayer.setOrigin(0, 0);
    this.farMtsLayer.setDepth(2);

    // Mid Ruins (Y around 330)
    this.midRuinsLayer = this.scene.add.tileSprite(0, 320, GAME_WIDTH, 300, 'bg_mid_ruins');
    this.midRuinsLayer.setOrigin(0, 0);
    this.midRuinsLayer.setDepth(5);

    // Near Ground (Y around 500 to bottom)
    this.nearGroundLayer = this.scene.add.tileSprite(0, 520, GAME_WIDTH, 560, 'bg_near_ground');
    this.nearGroundLayer.setOrigin(0, 0);
    this.nearGroundLayer.setDepth(8);

    // Railway Track at Y ≈ 690 - 750
    this.trackLayer = this.scene.add.tileSprite(0, 680, GAME_WIDTH, 80, 'bg_track');
    this.trackLayer.setOrigin(0, 0);
    this.trackLayer.setDepth(24);
  }

  public update(deltaSeconds: number, speed: number): void {
    const shift = speed * deltaSeconds;
    this.skyLayer.tilePositionX += shift * 0.02;
    this.farMtsLayer.tilePositionX += shift * 0.08;
    this.midRuinsLayer.tilePositionX += shift * 0.28;
    this.nearGroundLayer.tilePositionX += shift * 0.65;
    this.trackLayer.tilePositionX += shift * 1.0;
  }
}
