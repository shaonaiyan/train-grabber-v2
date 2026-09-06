import Phaser from 'phaser';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import { V4Telemetry } from '../v4/V4Telemetry';
import { getActiveGameMode, GameMode } from '../core/Types';

export class ResultScene extends Phaser.Scene {
  private runData: any;
  private sameSeed: string | number = '';

  constructor() {
    super({ key: 'ResultScene' });
  }

  public init(data: any): void {
    this.runData = data ? (data.telemetry || data) : null;
    this.sameSeed = data && data.seed !== undefined ? data.seed : '';
  }

  public create(): void {
    const isV4 =
      (this.runData && this.runData.mode === 'v4') ||
      getActiveGameMode() === GameMode.CORE_SLICE_V4;

    if (isV4) {
      this.createV4Result();
    } else {
      this.createV3Result();
    }
  }

  private createV4Result(): void {
    const v4 = V4Telemetry.getInstance();
    const data = v4.exportJSON();
    const summary = data.summary;

    const isWin = data.result === 'COMPLETE';

    // Dark semi-transparent result overlay panel
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d14, 0.94);
    bg.fillRoundedRect(340, 50, 1240, 950, 16);
    bg.lineStyle(3, isWin ? 0x00ffcc : 0xe74c3c, 1);
    bg.strokeRoundedRect(340, 50, 1240, 950, 16);

    // Title
    const titleText = isWin ? 'CORE SLICE COMPLETE: 90s SURVIVED' : 'TRAIN CRITICAL FAILURE';
    const title = this.add.text(960, 105, titleText, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: isWin ? '#00ffcc' : '#e74c3c',
      stroke: '#000000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Seed & Duration subtitle
    const sub = this.add.text(
      960,
      155,
      `SEED: ${data.seed}   |   DURATION: ${data.duration}s   |   MODE: CORE SLICE V4`,
      {
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
        color: '#95a5a6',
      }
    );
    sub.setOrigin(0.5);

    // Main Highlight: LOOT SECURED & WEIGHT
    let weightTier = 'SAFE';
    if (summary.finalWeight > 105) weightTier = 'CRITICAL';
    else if (summary.finalWeight > 90) weightTier = 'DANGER';
    else if (summary.finalWeight > 70) weightTier = 'HEAVY';

    const lootVal = this.add.text(800, 220, `LOOT SECURED: $${summary.finalLootValue}`, {
      fontFamily: 'Arial',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 6,
    });
    lootVal.setOrigin(0.5);

    const weightVal = this.add.text(1120, 220, `WEIGHT: ${summary.finalWeight.toFixed(0)} / 70 [${weightTier}]`, {
      fontFamily: 'Arial',
      fontSize: '30px',
      fontStyle: 'bold',
      color: weightTier === 'SAFE' ? '#2ecc71' : weightTier === 'HEAVY' ? '#f39c12' : '#e74c3c',
      stroke: '#000000',
      strokeThickness: 6,
    });
    weightVal.setOrigin(0.5);

    const totalSeen = Object.values(data.objects).reduce((sum, o) => sum + o.seen, 0);
    const totalDelivered = Object.values(data.objects).reduce((sum, o) => sum + o.delivered, 0);

    const stats = [
      { label: 'Objects Grabbed / Total Seen', value: `${totalDelivered} / ${totalSeen} (${summary.grabRate}%)` },
      { label: 'Hero Object Grab Rate', value: `${summary.heroGrabRate}%` },
      { label: 'Objects Jettisoned / Thrown', value: `${summary.jettisonCount}` },
      { label: 'Stream Coverage Ratio', value: `${summary.targetCoveragePercent}% (Goal >= 88%)` },
      { label: 'Max Idle Gap Between Items', value: `${summary.maxIdleGap.toFixed(2)}s (Goal < 2.5s)` },
      { label: 'Missed While Hook Busy', value: `${summary.missedWhileBusy}` },
      { label: 'Regret / Mistake Moments', value: `${summary.regretResponses}` },
      { label: 'Cross-System Interactions', value: `${summary.crossInteractions}` },
      { label: 'Threats (Grapple / Throw)', value: `${summary.grappleEnemyResolutions}` },
      { label: 'Threats (Auto Turret)', value: `${summary.turretEnemyResolutions}` },
      { label: 'Average Hook Cycle Time', value: `${data.hook.averageCycleTime.toFixed(2)}s` },
      { label: 'Hook Accuracy', value: `${data.hook.shots > 0 ? ((data.hook.hits / data.hook.shots) * 100).toFixed(0) : 0}% (${data.hook.hits}/${data.hook.shots})` },
    ];

    const startY = 280;
    stats.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 410 : 990;
      const y = startY + row * 62;

      const card = this.add.graphics();
      card.fillStyle(0x161f2c, 0.88);
      card.fillRoundedRect(x, y, 520, 52, 6);
      card.lineStyle(1.5, 0x2c3e50, 1);
      card.strokeRoundedRect(x, y, 520, 52, 6);

      const lbl = this.add.text(x + 18, y + 16, item.label, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#bdc3c7',
      });
      const val = this.add.text(x + 502, y + 16, item.value, {
        fontFamily: 'Consolas, monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'right',
      });
      val.setOrigin(1, 0);
    });

    // Action Buttons
    this.createButton(620, 890, '🔄 RETRY SAME SEED', 0x2980b9, () => {
      this.scene.start('GameScene', { seed: this.sameSeed });
    });

    this.createButton(960, 890, '🚀 NEW RUN', 0x27ae60, () => {
      this.scene.start('GameScene', { seed: Date.now() });
    });

    this.createButton(1300, 890, '💾 EXPORT TELEMETRY [F2]', 0xd35400, () => {
      v4.exportDataToFile();
    });
  }

  private createV3Result(): void {
    const telemetry = TelemetryManager.getInstance();
    const fullData = telemetry.getFullTelemetry();

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0d14, 0.94);
    bg.fillRoundedRect(340, 60, 1240, 940, 16);
    bg.lineStyle(3, fullData.outcome === 'WIN' ? 0x00ffcc : 0xe74c3c, 1);
    bg.strokeRoundedRect(340, 60, 1240, 940, 16);

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

    const avgSpeed =
      telemetry.totalSpeedSamples > 0
        ? (telemetry.totalSpeedSampleSum / telemetry.totalSpeedSamples).toFixed(1)
        : '60.0';

    const stats = [
      { label: 'Distance Travelled', value: `${fullData.distanceTravelledM}m / ${fullData.targetDistanceM}m` },
      { label: 'Travel Time', value: `${fullData.durationSeconds}s` },
      {
        label: 'Final Load Ratio',
        value: `${((fullData.finalTrain.loadRatio ?? 0) * 100).toFixed(0)}% (${fullData.finalTrain.load}/${fullData.finalTrain.maxLoad})`,
      },
      { label: 'Average Speed', value: `${avgSpeed} km/h` },
      { label: 'Total Cargo Value', value: `$${fullData.cargoValue || 0}` },
      { label: 'Items Discarded (Sacrificed)', value: `${fullData.finalTrain.discardCount}` },
      { label: 'Train Length (Cars)', value: `${fullData.finalTrain.length} CARS` },
      { label: 'Power Supply / Demand', value: `${fullData.finalTrain.powerSupply} / ${fullData.finalTrain.powerDemand}` },
      { label: 'Turrets & Batteries', value: `${fullData.finalTrain.turretCount} Turrets / ${fullData.finalTrain.batteryCount} Batteries` },
      { label: 'Combat (Dealt / Taken)', value: `${telemetry.turretDamageTotal} dmg / ${telemetry.encounterDamageTotal} taken` },
      { label: 'Survivors & Sheep', value: `${fullData.finalTrain.survivorCount} Survivors / ${fullData.finalTrain.sheepCount} Sheep` },
      { label: 'Gold Cargo Secured', value: `${fullData.finalTrain.goldCount}` },
      { label: 'Salvage Sites Explored', value: `${fullData.sites ? fullData.sites.length : 0} sites` },
      { label: 'Time in Overload / Danger', value: `${telemetry.timeInOverload.toFixed(1)}s / ${telemetry.timeInDanger.toFixed(1)}s` },
    ];

    const startY = 310;
    stats.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = col === 0 ? 410 : 990;
      const y = startY + row * 66;

      const card = this.add.graphics();
      card.fillStyle(0x161f2c, 0.88);
      card.fillRoundedRect(x, y, 520, 54, 6);
      card.lineStyle(1.5, 0x2c3e50, 1);
      card.strokeRoundedRect(x, y, 520, 54, 6);

      const lbl = this.add.text(x + 20, y + 16, item.label, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#bdc3c7',
      });
      const val = this.add.text(x + 500, y + 16, item.value, {
        fontFamily: 'Consolas, monospace',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'right',
      });
      val.setOrigin(1, 0);
    });

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
