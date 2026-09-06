import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { EventBus } from '../core/EventBus';

export class HUD {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private container: Phaser.GameObjects.Container;

  // UI elements
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private fuelBar!: Phaser.GameObjects.Graphics;
  private fuelText!: Phaser.GameObjects.Text;
  private loadBar!: Phaser.GameObjects.Graphics;
  private loadText!: Phaser.GameObjects.Text;
  private heavyBadge!: Phaser.GameObjects.Container;
  private powerText!: Phaser.GameObjects.Text;
  private powerWarningIcon!: Phaser.GameObjects.Text;

  // V2.1 Haven Goal & Cargo Value (Sections 63-70)
  private havenGoalText!: Phaser.GameObjects.Text;
  private havenProgressBar!: Phaser.GameObjects.Graphics;
  private cargoValueText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private phaseBadgeText!: Phaser.GameObjects.Text;

  private outOfFuelBanner!: Phaser.GameObjects.Container;
  private outOfFuelText!: Phaser.GameObjects.Text;
  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private tutorialHintText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, trainManager: TrainManager) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);

    this.createBars();
    this.createBanners();

    EventBus.getInstance().on('PHASE_CHANGE', (data: { phaseId: number; name: string; banner: string }) => {
      this.showPhaseBanner(data.banner);
    });
  }

  private createBars(): void {
    // Top Bar HUD panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f141c, 0.90);
    bg.fillRoundedRect(20, 14, 1880, 64, 8);
    bg.lineStyle(2, 0x243342, 1);
    bg.strokeRoundedRect(20, 14, 1880, 64, 8);
    this.container.add(bg);

    // 1. HP
    const hpIcon = this.scene.add.text(40, 26, '❤️ HP', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.hpBar = this.scene.add.graphics();
    this.hpText = this.scene.add.text(105, 48, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    this.container.add([hpIcon, this.hpBar, this.hpText]);

    // 2. FUEL
    const fuelIcon = this.scene.add.text(250, 26, '⛽ FUEL', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f39c12',
    });
    this.fuelBar = this.scene.add.graphics();
    this.fuelText = this.scene.add.text(320, 48, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    this.container.add([fuelIcon, this.fuelBar, this.fuelText]);

    // 3. LOAD
    const loadIcon = this.scene.add.text(480, 26, '📦 LOAD', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#3498db',
    });
    this.loadBar = this.scene.add.graphics();
    this.loadText = this.scene.add.text(560, 48, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#ffffff',
    });
    this.heavyBadge = this.createHeavyBadge();
    this.container.add([loadIcon, this.loadBar, this.loadText, this.heavyBadge]);

    // 4. POWER
    this.powerText = this.scene.add.text(730, 32, '⚡ 2 / 0', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#2ecc71',
    });
    this.powerWarningIcon = this.scene.add.text(840, 32, '⚠️ LOW POWER', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.powerWarningIcon.setVisible(false);
    this.container.add([this.powerText, this.powerWarningIcon]);

    // 5. CARGO VALUE (Section 66-67)
    this.cargoValueText = this.scene.add.text(980, 32, '💰 CARGO: 0', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f1c40f',
    });
    this.container.add(this.cargoValueText);

    // 6. Section 63-65: HAVEN PRIMARY GOAL & PROGRESS BAR
    this.havenGoalText = this.scene.add.text(1220, 26, '🎯 HAVEN: 8.0 km (0%)', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#00ffcc',
    });
    this.havenProgressBar = this.scene.add.graphics();
    this.container.add([this.havenGoalText, this.havenProgressBar]);

    // 7. Mini phase tag & demoted secondary time
    this.phaseBadgeText = this.scene.add.text(1600, 34, '[TUTORIAL]', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#00e5ff',
    });
    this.timeText = this.scene.add.text(1760, 34, '00:00', {
      fontFamily: 'Consolas, monospace',
      fontSize: '16px',
      color: '#95a5a6',
    });
    this.container.add([this.phaseBadgeText, this.timeText]);
  }

  private createHeavyBadge(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(660, 36);
    const g = this.scene.add.graphics();
    g.fillStyle(0xe74c3c, 1);
    g.fillRoundedRect(0, 0, 95, 20, 4);
    const txt = this.scene.add.text(47, 10, 'HEAVY TRAIN', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    txt.setOrigin(0.5);
    c.add([g, txt]);
    c.setVisible(false);
    return c;
  }

  private createBanners(): void {
    // Out of fuel banner
    this.outOfFuelBanner = this.scene.add.container(960, 115);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x900c3f, 0.92);
    bg.fillRoundedRect(-220, -20, 440, 40, 6);
    bg.lineStyle(2, 0xff5733, 1);
    bg.strokeRoundedRect(-220, -20, 440, 40, 6);

    this.outOfFuelText = this.scene.add.text(0, 0, 'OUT OF FUEL! STALLING: 12.0s', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.outOfFuelText.setOrigin(0.5);
    this.outOfFuelBanner.add([bg, this.outOfFuelText]);
    this.outOfFuelBanner.setVisible(false);
    this.container.add(this.outOfFuelBanner);

    // Section 33: Sleek compact Phase Announcement Banner at Y=130, 560x44, fades out after 1.5s
    this.bannerContainer = this.scene.add.container(960, 135);
    const bbg = this.scene.add.graphics();
    bbg.fillStyle(0x1a252f, 0.92);
    bbg.fillRoundedRect(-280, -22, 560, 44, 6);
    bbg.lineStyle(1.5, 0xf39c12, 1);
    bbg.strokeRoundedRect(-280, -22, 560, 44, 6);

    this.bannerText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f1c40f',
    });
    this.bannerText.setOrigin(0.5);
    this.bannerContainer.add([bbg, this.bannerText]);
    this.bannerContainer.setVisible(false);
    this.container.add(this.bannerContainer);

    // Section 32: Subtle Tutorial hint at 0~4s
    this.tutorialHintText = this.scene.add.text(960, 180, 'MOUSE: AIM  |  LEFT CLICK: GRAB  |  RIGHT CLICK: DISCARD', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ecf0f1',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.tutorialHintText.setOrigin(0.5);
    this.tutorialHintText.setDepth(205);
    this.container.add(this.tutorialHintText);
  }

  public showPhaseBanner(text: string): void {
    this.bannerText.setText(text);
    this.bannerContainer.setVisible(true);
    this.bannerContainer.setAlpha(0);

    // Fade in, hold 1.5s, fade out (Section 33)
    this.scene.tweens.add({
      targets: this.bannerContainer,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1500, () => {
          this.scene.tweens.add({
            targets: this.bannerContainer,
            alpha: 0,
            duration: 350,
            onComplete: () => {
              this.bannerContainer.setVisible(false);
            },
          });
        });
      },
    });
  }

  public update(timeSec: number, phaseId: number, phaseName: string): void {
    const stats = this.trainManager.stats;
    const power = this.trainManager.power;
    const load = this.trainManager.load;

    // Fade out tutorial hint after 5 seconds (Section 32)
    if (timeSec >= 5.0 && this.tutorialHintText.visible) {
      this.tutorialHintText.setVisible(false);
    }

    // 1. HP Bar
    this.hpBar.clear();
    const hpPct = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0x2c3e50, 1);
    this.hpBar.fillRect(105, 26, 120, 14);
    this.hpBar.fillStyle(hpPct > 0.4 ? 0x2ecc71 : 0xe74c3c, 1);
    this.hpBar.fillRect(105, 26, 120 * hpPct, 14);
    this.hpText.setText(`${Math.ceil(stats.hp)} / ${stats.maxHp}`);

    // 2. FUEL Bar
    this.fuelBar.clear();
    const fuelPct = Phaser.Math.Clamp(stats.fuel / stats.maxFuel, 0, 1);
    this.fuelBar.fillStyle(0x2c3e50, 1);
    this.fuelBar.fillRect(320, 26, 120, 14);

    let fuelColor = 0x3498db;
    if (stats.fuel < 15) {
      fuelColor = Math.floor(timeSec * 4) % 2 === 0 ? 0xe74c3c : 0xc0392b;
    } else if (stats.fuel < 30) {
      fuelColor = 0xf39c12;
    }
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRect(320, 26, 120 * fuelPct, 14);
    this.fuelText.setText(`${Math.ceil(stats.fuel)} / ${stats.maxFuel}`);

    // Out of fuel alert
    if (stats.isOutOfFuel) {
      this.outOfFuelBanner.setVisible(true);
      const remain = Math.max(0, 12.0 - stats.outOfFuelTimer).toFixed(1);
      this.outOfFuelText.setText(`OUT OF FUEL! STALLING: ${remain}s`);
    } else {
      this.outOfFuelBanner.setVisible(false);
    }

    // 3. LOAD Bar
    this.loadBar.clear();
    const currentLoad = load.getCurrentLoad();
    const maxLoad = load.getMaxLoad();
    const loadPct = Phaser.Math.Clamp(currentLoad / maxLoad, 0, 1);

    this.loadBar.fillStyle(0x2c3e50, 1);
    this.loadBar.fillRect(560, 26, 120, 14);

    let loadColor = 0x27ae60;
    if (loadPct >= 0.85) {
      loadColor = 0xe74c3c;
      this.heavyBadge.setVisible(true);
    } else if (loadPct >= 0.70) {
      loadColor = 0xf39c12;
      this.heavyBadge.setVisible(false);
    } else {
      this.heavyBadge.setVisible(false);
    }
    this.loadBar.fillStyle(loadColor, 1);
    this.loadBar.fillRect(560, 26, 120 * loadPct, 14);
    this.loadText.setText(`${currentLoad} / ${maxLoad}`);

    // 4. POWER (⚡ 2 / 0)
    const supply = power.getSupply();
    const demand = power.getDemand();
    const hasShortage = power.hasShortage();

    this.powerText.setText(`⚡ ${supply} / ${demand}`);
    if (hasShortage) {
      const blink = Math.floor(timeSec * 3) % 2 === 0;
      this.powerText.setColor(blink ? '#e74c3c' : '#f39c12');
      this.powerWarningIcon.setVisible(true);
    } else {
      this.powerText.setColor('#2ecc71');
      this.powerWarningIcon.setVisible(false);
    }

    // 5. CARGO VALUE (Section 66-67)
    const cargoVal = this.trainManager.getCargoValue();
    this.cargoValueText.setText(`💰 CARGO: ${cargoVal}`);

    // 6. Section 63-65: HAVEN GOAL & SLIM PROGRESS BAR
    const totalDistKm = 8.0;
    const progress = Phaser.Math.Clamp(timeSec / 480, 0, 1);
    const distRemaining = Math.max(0, totalDistKm * (1 - progress)).toFixed(1);
    const pct = Math.round(progress * 100);
    this.havenGoalText.setText(`🎯 HAVEN: ${distRemaining} km (${pct}%)`);

    this.havenProgressBar.clear();
    this.havenProgressBar.fillStyle(0x2c3e50, 1);
    this.havenProgressBar.fillRect(1220, 48, 200, 6);
    this.havenProgressBar.fillStyle(0x00ffcc, 1);
    this.havenProgressBar.fillRect(1220, 48, 200 * progress, 6);

    // 7. TIME & PHASE BADGE
    const minutes = Math.floor(timeSec / 60);
    const seconds = Math.floor(timeSec % 60);
    const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timeText.setText(timeFormatted);
    this.phaseBadgeText.setText(`[${phaseName.toUpperCase()}]`);
  }
}
