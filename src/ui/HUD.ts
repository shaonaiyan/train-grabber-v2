import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { EventBus } from '../core/EventBus';
import phasesData from '../data/phases.json';

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
  private timeText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private outOfFuelBanner!: Phaser.GameObjects.Container;
  private outOfFuelText!: Phaser.GameObjects.Text;
  private bannerContainer!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, trainManager: TrainManager) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);

    this.createBars();
    this.createBanners();

    // Listen for phase change banner
    EventBus.getInstance().on('PHASE_CHANGE', (data: { phaseId: number; name: string; banner: string }) => {
      this.showPhaseBanner(data.banner);
    });
  }

  private createBars(): void {
    // Top Bar HUD panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f141c, 0.88);
    bg.fillRoundedRect(20, 16, 1880, 68, 8);
    bg.lineStyle(2, 0x243342, 1);
    bg.strokeRoundedRect(20, 16, 1880, 68, 8);
    this.container.add(bg);

    // 1. HP
    const hpIcon = this.scene.add.text(45, 34, '❤️ HP', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.hpBar = this.scene.add.graphics();
    this.hpText = this.scene.add.text(125, 52, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    this.container.add([hpIcon, this.hpBar, this.hpText]);

    // 2. FUEL
    const fuelIcon = this.scene.add.text(320, 34, '⛽ FUEL', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#f39c12',
    });
    this.fuelBar = this.scene.add.graphics();
    this.fuelText = this.scene.add.text(405, 52, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    this.container.add([fuelIcon, this.fuelBar, this.fuelText]);

    // 3. LOAD (Section 83)
    const loadIcon = this.scene.add.text(610, 34, '📦 LOAD', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#3498db',
    });
    this.loadBar = this.scene.add.graphics();
    this.loadText = this.scene.add.text(700, 52, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#ffffff',
    });
    this.heavyBadge = this.createHeavyBadge();
    this.container.add([loadIcon, this.loadBar, this.loadText, this.heavyBadge]);

    // 4. POWER (Section 82)
    this.powerText = this.scene.add.text(920, 34, '⚡ 2 / 0', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#2ecc71',
    });
    this.powerWarningIcon = this.scene.add.text(1050, 34, '⚠️ LOW POWER', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.powerWarningIcon.setVisible(false);
    this.container.add([this.powerText, this.powerWarningIcon]);

    // 5. RUN TIME & PHASE
    this.timeText = this.scene.add.text(1420, 34, 'TIME: 00:00 / 08:00', {
      fontFamily: 'Consolas, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    });
    this.phaseText = this.scene.add.text(1700, 34, 'PHASE: TUTORIAL', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#00ffff',
    });
    this.container.add([this.timeText, this.phaseText]);
  }

  private createHeavyBadge(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(830, 42);
    const g = this.scene.add.graphics();
    g.fillStyle(0xe74c3c, 1);
    g.fillRoundedRect(0, 0, 110, 22, 4);
    const txt = this.scene.add.text(55, 11, 'HEAVY TRAIN', {
      fontFamily: 'Arial',
      fontSize: '12px',
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
    this.outOfFuelBanner = this.scene.add.container(960, 130);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x900c3f, 0.9);
    bg.fillRoundedRect(-220, -22, 440, 44, 6);
    bg.lineStyle(2, 0xff5733, 1);
    bg.strokeRoundedRect(-220, -22, 440, 44, 6);

    this.outOfFuelText = this.scene.add.text(0, 0, 'OUT OF FUEL! STALLING: 12.0s', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.outOfFuelText.setOrigin(0.5);
    this.outOfFuelBanner.add([bg, this.outOfFuelText]);
    this.outOfFuelBanner.setVisible(false);
    this.container.add(this.outOfFuelBanner);

    // Large World Phase Announcement Banner
    this.bannerContainer = this.scene.add.container(960, 200);
    const bbg = this.scene.add.graphics();
    bbg.fillStyle(0x1a252f, 0.88);
    bbg.fillRoundedRect(-400, -30, 800, 60, 8);
    bbg.lineStyle(2, 0xf39c12, 1);
    bbg.strokeRoundedRect(-400, -30, 800, 60, 8);

    this.bannerText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 4,
    });
    this.bannerText.setOrigin(0.5);
    this.bannerContainer.add([bbg, this.bannerText]);
    this.bannerContainer.setVisible(false);
    this.container.add(this.bannerContainer);
  }

  public showPhaseBanner(text: string): void {
    this.bannerText.setText(text);
    this.bannerContainer.setVisible(true);
    this.bannerContainer.setAlpha(0);
    this.bannerContainer.setScale(0.8);

    this.scene.tweens.add({
      targets: this.bannerContainer,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(3000, () => {
          this.scene.tweens.add({
            targets: this.bannerContainer,
            alpha: 0,
            duration: 500,
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

    // 1. HP Bar
    this.hpBar.clear();
    const hpPct = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0x2c3e50, 1);
    this.hpBar.fillRect(125, 34, 150, 16);
    this.hpBar.fillStyle(hpPct > 0.4 ? 0x2ecc71 : 0xe74c3c, 1);
    this.hpBar.fillRect(125, 34, 150 * hpPct, 16);
    this.hpText.setText(`${Math.ceil(stats.hp)} / ${stats.maxHp}`);

    // 2. FUEL Bar (Section 84: warning < 30, critical < 15)
    this.fuelBar.clear();
    const fuelPct = Phaser.Math.Clamp(stats.fuel / stats.maxFuel, 0, 1);
    this.fuelBar.fillStyle(0x2c3e50, 1);
    this.fuelBar.fillRect(405, 34, 150, 16);

    let fuelColor = 0x3498db;
    if (stats.fuel < 15) {
      fuelColor = Math.floor(timeSec * 4) % 2 === 0 ? 0xe74c3c : 0xc0392b;
    } else if (stats.fuel < 30) {
      fuelColor = 0xf39c12;
    }
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRect(405, 34, 150 * fuelPct, 16);
    this.fuelText.setText(`${Math.ceil(stats.fuel)} / ${stats.maxFuel}`);

    // Out of fuel alert
    if (stats.isOutOfFuel) {
      this.outOfFuelBanner.setVisible(true);
      const remain = Math.max(0, 12.0 - stats.outOfFuelTimer).toFixed(1);
      this.outOfFuelText.setText(`OUT OF FUEL! STALLING: ${remain}s`);
    } else {
      this.outOfFuelBanner.setVisible(false);
    }

    // 3. LOAD Bar (Section 83)
    this.loadBar.clear();
    const currentLoad = load.getCurrentLoad();
    const maxLoad = load.getMaxLoad();
    const loadPct = Phaser.Math.Clamp(currentLoad / maxLoad, 0, 1);

    this.loadBar.fillStyle(0x2c3e50, 1);
    this.loadBar.fillRect(700, 34, 150, 16);

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
    this.loadBar.fillRect(700, 34, 150 * loadPct, 16);
    this.loadText.setText(`${currentLoad} / ${maxLoad}`);

    // 4. POWER (Section 82: ⚡ 5 / 6)
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

    // 5. TIME & PHASE
    const minutes = Math.floor(timeSec / 60);
    const seconds = Math.floor(timeSec % 60);
    const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    this.timeText.setText(`TIME: ${timeFormatted} / 08:00`);
    this.phaseText.setText(`PHASE: ${phaseName.toUpperCase()}`);
  }
}
