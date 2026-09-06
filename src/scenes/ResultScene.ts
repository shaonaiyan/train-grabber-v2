import Phaser from 'phaser';
import { TelemetryManager } from '../telemetry/TelemetryManager';

export class ResultScene extends Phaser.Scene {
  private runData: any;
  private sameSeed: string | number = '';

  constructor() {
    super({ key: 'ResultScene' });
  }

  public init(data: any): void {
    this.runData = data.telemetry;
    this.sameSeed = data.seed;
  }

  public create(): void {
    const telemetry = TelemetryManager.getInstance();
    const fullData = telemetry.getFullTelemetry();

    // Dark semi-transparent result overlay panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d14, 0.94);
    bg.fillRoundedRect(340, 60, 1240, 940, 16);
    bg.lineStyle(3, fullData.outcome === 'WIN' ? 0x00ffcc : 0xe74c3c, 1);
    bg.strokeRoundedRect(340, 60, 1240, 940, 16);

    // Title
    const titleText = fullData.outcome === 'WIN' ? 'RUN COMPLETE: HAVEN REACHED' : 'TRAIN ABANDONED IN WASTELAND';
    const title = this.add.text(960, 120, titleText, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: fullData.outcome === 'WIN' ? '#00ffcc' : '#e74c3c',
      stroke: '#000000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Seed & Duration subtitle
    const sub = this.add.text(
      960,
      175,
      `SEED: ${fullData.seed}   |   DURATION: ${fullData.durationSeconds}s   |   OUTCOME: ${fullData.outcome}`,
      {
        fontFamily: 'Consolas, monospace',
        fontSize: '18px',
        color: '#95a5a6',
      }
    );
    sub.setOrigin(0.5);

    // Main Score & Cargo Value Display
    const scoreVal = this.add.text(800, 245, `FINAL SCORE: ${fullData.finalScore}`, {
      fontFamily: 'Arial',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 6,
    });
    scoreVal.setOrigin(0.5);

    const cargoVal = this.add.text(1120, 245, `CARGO VALUE: $${fullData.cargoValue || 0}`, {
      fontFamily: 'Arial',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 6,
    });
    cargoVal.setOrigin(0.5);

    // Detailed Stats Grid (Section 75)
    const stats = [
      { label: 'Train Length (Cars)', value: `${fullData.finalTrain.length} CARS` },
      { label: 'Total Cargo Value', value: `$${fullData.cargoValue || 0}` },
      { label: 'Final Load Capacity', value: `${fullData.finalTrain.load} / ${fullData.finalTrain.maxLoad}` },
      { label: 'Power Supply / Demand', value: `${fullData.finalTrain.powerSupply} / ${fullData.finalTrain.powerDemand}` },
      { label: 'Gold Cargo Secured', value: `${fullData.finalTrain.goldCount}` },
      { label: 'Sheep Carried', value: `${fullData.finalTrain.sheepCount}` },
      { label: 'Survivors Rescued', value: `${fullData.finalTrain.survivorCount}` },
      { label: 'Turrets Installed', value: `${fullData.finalTrain.turretCount}` },
      { label: 'Batteries Mounted', value: `${fullData.finalTrain.batteryCount}` },
      { label: 'Items Discarded (Sacrifices)', value: `${fullData.finalTrain.discardCount}` },
    ];

    let startY = 320;
    stats.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 440 : 1000;
      const y = startY + row * 62;

      const card = this.add.graphics();
      card.fillStyle(0x161f2c, 0.85);
      card.fillRoundedRect(x, y, 480, 50, 6);
      card.lineStyle(1.5, 0x2c3e50, 1);
      card.strokeRoundedRect(x, y, 480, 50, 6);

      const lbl = this.add.text(x + 20, y + 15, item.label, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#bdc3c7',
      });
      const val = this.add.text(x + 460, y + 15, item.value, {
        fontFamily: 'Consolas, monospace',
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'right',
      });
      val.setOrigin(1, 0);
    });

    // Three Interactive Action Buttons (Section 75)
    this.createButton(620, 890, '🔄 RETRY SAME SEED', 0x2980b9, () => {
      this.scene.start('GameScene', { seed: this.sameSeed });
    });

    this.createButton(960, 890, '🚀 NEW RUN', 0x27ae60, () => {
      this.scene.start('GameScene', { seed: Date.now() });
    });

    this.createButton(1300, 890, '💾 EXPORT DATA (JSON)', 0xd35400, () => {
      telemetry.exportDataToFile();
    });
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void
  ): void {
    const btn = this.add.container(x, y);

    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-150, -28, 300, 56, 8);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRoundedRect(-150, -28, 300, 56, 8);

    const txt = this.add.text(0, 0, text, {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    txt.setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, 300, 56, 0x000000, 0.001);
    hit.setInteractive({ cursor: 'pointer' });

    hit.on('pointerover', () => {
      this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 120 });
    });
    hit.on('pointerout', () => {
      this.tweens.add({ targets: btn, scaleX: 1.0, scaleY: 1.0, duration: 120 });
    });
    hit.on('pointerdown', onClick);

    btn.add([g, txt, hit]);
  }
}
