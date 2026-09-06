import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { JourneyProgress } from '../journey/JourneyProgress';
import { EventBus } from '../core/EventBus';
import { ItemId } from '../core/Types';

export class HUD {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private container: Phaser.GameObjects.Container;

  // UI elements
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private fuelBar!: Phaser.GameObjects.Graphics;
  private fuelText!: Phaser.GameObjects.Text;

  // V3 Soft Load
  private loadBar!: Phaser.GameObjects.Graphics;
  private loadText!: Phaser.GameObjects.Text;
  private loadBadgeCont!: Phaser.GameObjects.Container;
  private loadBadgeText!: Phaser.GameObjects.Text;
  private loadBadgeBg!: Phaser.GameObjects.Graphics;

  // V3 Cargo System
  private cargoText!: Phaser.GameObjects.Text;
  private cargoValueText!: Phaser.GameObjects.Text;
  private cargoOverstackedBadge!: Phaser.GameObjects.Container;

  // Power
  private powerText!: Phaser.GameObjects.Text;
  private powerWarningIcon!: Phaser.GameObjects.Text;

  // V3 Speed Display
  private speedText!: Phaser.GameObjects.Text;

  // V3 Haven Distance Goal & Progress Bar
  private havenGoalText!: Phaser.GameObjects.Text;
  private havenProgressBar!: Phaser.GameObjects.Graphics;

  // V3 Secondary Time & Segment
  private timeText!: Phaser.GameObjects.Text;
  private segmentBadgeText!: Phaser.GameObjects.Text;

  // Alerts & Banners
  private outOfFuelBanner!: Phaser.GameObjects.Container;
  private outOfFuelText!: Phaser.GameObjects.Text;

  // Site Entrance Toast
  private siteToastCont!: Phaser.GameObjects.Container;
  private siteToastText!: Phaser.GameObjects.Text;

  // First-time item hint
  private itemHintCont!: Phaser.GameObjects.Container;
  private itemHintText!: Phaser.GameObjects.Text;
  private seenItemTypes: Set<ItemId> = new Set();

  private tutorialHintText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, trainManager: TrainManager) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);

    this.createBars();
    this.createBanners();
    this.setupListeners();
  }

  private setupListeners(): void {
    const bus = EventBus.getInstance();

    // Section 132: Site toast on enter
    bus.on('SITE_ENTER', (data: { siteId: string; displayName: string }) => {
      this.showSiteToast(data.displayName);
    });

    // Section 131: First-time item hint
    bus.on('ITEM_SEEN', (data: { item: ItemId; hint?: string }) => {
      if (!this.seenItemTypes.has(data.item)) {
        this.seenItemTypes.add(data.item);
        if (data.hint) {
          this.showItemHint(data.hint);
        }
      }
    });
  }

  private createBars(): void {
    // Top Bar HUD panel background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0e14, 0.92);
    bg.fillRoundedRect(16, 10, 1888, 66, 8);
    bg.lineStyle(2, 0x1f2c39, 1);
    bg.strokeRoundedRect(16, 10, 1888, 66, 8);
    this.container.add(bg);

    // 1. HP (x = 35)
    const hpIcon = this.scene.add.text(35, 20, '❤️ HP', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.hpBar = this.scene.add.graphics();
    this.hpText = this.scene.add.text(95, 42, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: '#ffffff',
    });
    this.container.add([hpIcon, this.hpBar, this.hpText]);

    // 2. FUEL (x = 210)
    const fuelIcon = this.scene.add.text(210, 20, '⛽ FUEL', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f39c12',
    });
    this.fuelBar = this.scene.add.graphics();
    this.fuelText = this.scene.add.text(275, 42, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: '#ffffff',
    });
    this.container.add([fuelIcon, this.fuelBar, this.fuelText]);

    // 3. LOAD (x = 395)
    const loadIcon = this.scene.add.text(395, 20, '📦 LOAD', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#3498db',
    });
    this.loadBar = this.scene.add.graphics();
    this.loadText = this.scene.add.text(465, 42, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: '#ffffff',
    });
    this.createLoadBadge();
    this.container.add([loadIcon, this.loadBar, this.loadText, this.loadBadgeCont]);

    // 4. CARGO (x = 640)
    this.cargoText = this.scene.add.text(640, 20, 'CARGO 0 / 6', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ecf0f1',
    });
    this.cargoValueText = this.scene.add.text(640, 42, 'VALUE $0', {
      fontFamily: 'Arial',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#f1c40f',
    });
    this.createOverstackedBadge();
    this.container.add([this.cargoText, this.cargoValueText, this.cargoOverstackedBadge]);

    // 5. POWER (x = 810)
    this.powerText = this.scene.add.text(810, 26, '⚡ 2 / 0', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#2ecc71',
    });
    this.powerWarningIcon = this.scene.add.text(810, 46, 'LOW POWER', {
      fontFamily: 'Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#e74c3c',
    });
    this.powerWarningIcon.setVisible(false);
    this.container.add([this.powerText, this.powerWarningIcon]);

    // 6. SPEED (x = 940, Section 138)
    this.speedText = this.scene.add.text(940, 28, 'SPEED 64 km/h', {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#00e5ff',
    });
    this.container.add(this.speedText);

    // 7. HAVEN DISTANCE & PROGRESS (x = 1140, Section 139)
    this.havenGoalText = this.scene.add.text(1140, 20, '🎯 HAVEN 4.8 km', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00ffcc',
    });
    this.havenProgressBar = this.scene.add.graphics();
    this.container.add([this.havenGoalText, this.havenProgressBar]);

    // 8. SEGMENT & TIME (x = 1680)
    this.segmentBadgeText = this.scene.add.text(1640, 32, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#e67e22',
    });
    this.timeText = this.scene.add.text(1780, 32, '00:00', {
      fontFamily: 'Consolas, monospace',
      fontSize: '16px',
      color: '#95a5a6',
    });
    this.container.add([this.segmentBadgeText, this.timeText]);
  }

  private createLoadBadge(): void {
    this.loadBadgeCont = this.scene.add.container(530, 26);
    this.loadBadgeBg = this.scene.add.graphics();
    this.loadBadgeText = this.scene.add.text(38, 7, 'NORMAL', {
      fontFamily: 'Arial',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    this.loadBadgeText.setOrigin(0.5);
    this.loadBadgeCont.add([this.loadBadgeBg, this.loadBadgeText]);
  }

  private createOverstackedBadge(): void {
    this.cargoOverstackedBadge = this.scene.add.container(740, 20);
    const g = this.scene.add.graphics();
    g.fillStyle(0xd35400, 1);
    g.fillRoundedRect(0, 0, 68, 16, 3);
    const txt = this.scene.add.text(34, 8, 'OVERSTACK', {
      fontFamily: 'Arial',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    txt.setOrigin(0.5);
    this.cargoOverstackedBadge.add([g, txt]);
    this.cargoOverstackedBadge.setVisible(false);
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

    // Section 132: Sleek Site Toast at Y=105, 1.2s duration
    this.siteToastCont = this.scene.add.container(960, 105);
    const sbg = this.scene.add.graphics();
    sbg.fillStyle(0x161f2c, 0.92);
    sbg.fillRoundedRect(-200, -18, 400, 36, 6);
    sbg.lineStyle(1.5, 0x00e5ff, 0.9);
    sbg.strokeRoundedRect(-200, -18, 400, 36, 6);

    this.siteToastText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00e5ff',
    });
    this.siteToastText.setOrigin(0.5);
    this.siteToastCont.add([sbg, this.siteToastText]);
    this.siteToastCont.setVisible(false);
    this.container.add(this.siteToastCont);

    // Section 131: First-time item hint toast
    this.itemHintCont = this.scene.add.container(960, 150);
    const hbg = this.scene.add.graphics();
    hbg.fillStyle(0x0f1722, 0.90);
    hbg.fillRoundedRect(-240, -15, 480, 30, 4);
    hbg.lineStyle(1, 0xf1c40f, 0.8);
    hbg.strokeRoundedRect(-240, -15, 480, 30, 4);

    this.itemHintText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f1c40f',
    });
    this.itemHintText.setOrigin(0.5);
    this.itemHintCont.add([hbg, this.itemHintText]);
    this.itemHintCont.setVisible(false);
    this.container.add(this.itemHintCont);

    // Initial controls tutorial hint
    this.tutorialHintText = this.scene.add.text(960, 180, 'LEFT CLICK: GRAB  |  RIGHT CLICK ON CAR: DISCARD', {
      fontFamily: 'Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ecf0f1',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.tutorialHintText.setOrigin(0.5);
    this.container.add(this.tutorialHintText);
  }

  public showSiteToast(text: string): void {
    this.siteToastText.setText(text);
    this.siteToastCont.setVisible(true);
    this.siteToastCont.setAlpha(0);

    this.scene.tweens.add({
      targets: this.siteToastCont,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(1200, () => {
          this.scene.tweens.add({
            targets: this.siteToastCont,
            alpha: 0,
            duration: 250,
            onComplete: () => {
              this.siteToastCont.setVisible(false);
            },
          });
        });
      },
    });
  }

  public showItemHint(text: string): void {
    this.itemHintText.setText(text);
    this.itemHintCont.setVisible(true);
    this.itemHintCont.setAlpha(0);

    this.scene.tweens.add({
      targets: this.itemHintCont,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(2200, () => {
          this.scene.tweens.add({
            targets: this.itemHintCont,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              this.itemHintCont.setVisible(false);
            },
          });
        });
      },
    });
  }

  public update(timeSec: number, progress: JourneyProgress, segmentName: string | null): void {
    const stats = this.trainManager.stats;
    const power = this.trainManager.power;
    const load = this.trainManager.load;
    const cargo = this.trainManager.cargo;

    if (timeSec >= 5.0 && this.tutorialHintText.visible) {
      this.tutorialHintText.setVisible(false);
    }

    // 1. HP Bar
    this.hpBar.clear();
    const hpPct = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0x2c3e50, 1);
    this.hpBar.fillRect(95, 22, 100, 14);
    this.hpBar.fillStyle(hpPct > 0.4 ? 0x2ecc71 : 0xe74c3c, 1);
    this.hpBar.fillRect(95, 22, 100 * hpPct, 14);
    this.hpText.setText(`${Math.ceil(stats.hp)} / ${stats.maxHp}`);

    // 2. FUEL Bar
    this.fuelBar.clear();
    const fuelPct = Phaser.Math.Clamp(stats.fuel / stats.maxFuel, 0, 1);
    this.fuelBar.fillStyle(0x2c3e50, 1);
    this.fuelBar.fillRect(275, 22, 100, 14);

    let fuelColor = 0x3498db;
    if (stats.fuel < 15) {
      fuelColor = Math.floor(timeSec * 4) % 2 === 0 ? 0xe74c3c : 0xc0392b;
    } else if (stats.fuel < 30) {
      fuelColor = 0xf39c12;
    }
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRect(275, 22, 100 * fuelPct, 14);
    this.fuelText.setText(`${Math.ceil(stats.fuel)} / ${stats.maxFuel}`);

    // Out of fuel alert
    if (stats.isOutOfFuel) {
      this.outOfFuelBanner.setVisible(true);
      const remain = Math.max(0, 12.0 - stats.outOfFuelTimer).toFixed(1);
      this.outOfFuelText.setText(`OUT OF FUEL! STALLING: ${remain}s`);
    } else {
      this.outOfFuelBanner.setVisible(false);
    }

    // 3. LOAD Bar & Soft Load Badge (Sections 134-135)
    this.loadBar.clear();
    const effectiveLoad = load.getCurrentLoad();
    const safeMaxLoad = load.getSafeMaxLoad();
    const ratio = load.getLoadRatio();
    const tier = load.getTier();

    // Bar fills up to 1.30 max
    const barFillPct = Phaser.Math.Clamp(ratio / 1.30, 0, 1);
    this.loadBar.fillStyle(0x2c3e50, 1);
    this.loadBar.fillRect(465, 22, 110, 14);

    let loadBarColor = 0x27ae60;
    let badgeColor = 0x27ae60;
    let badgeLabel = 'NORMAL';

    if (tier === 'DANGER' || tier === 'HARD_LIMIT') {
      const blink = Math.floor(timeSec * 4) % 2 === 0;
      loadBarColor = blink ? 0xe74c3c : 0xc0392b;
      badgeColor = 0xe74c3c;
      badgeLabel = 'DANGER';
    } else if (tier === 'OVERLOAD') {
      loadBarColor = 0xd35400;
      badgeColor = 0xd35400;
      badgeLabel = 'OVERLOAD';
    } else if (tier === 'HEAVY') {
      loadBarColor = 0xf39c12;
      badgeColor = 0xf39c12;
      badgeLabel = 'HEAVY';
    }

    this.loadBar.fillStyle(loadBarColor, 1);
    this.loadBar.fillRect(465, 22, 110 * barFillPct, 14);
    this.loadText.setText(`${effectiveLoad} / ${safeMaxLoad}`);

    // Badge
    this.loadBadgeBg.clear();
    this.loadBadgeBg.fillStyle(badgeColor, 1);
    this.loadBadgeBg.fillRoundedRect(0, 0, 76, 16, 3);
    this.loadBadgeText.setText(badgeLabel);

    // 4. CARGO (Section 136)
    this.cargoText.setText(`CARGO ${cargo.cargoUsed} / ${cargo.cargoCapacity}`);
    this.cargoValueText.setText(`VALUE $${cargo.getTotalCargoValue()}`);
    this.cargoOverstackedBadge.setVisible(cargo.isOverstacked());

    // 5. POWER (Section 137)
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

    // 6. SPEED (Section 138)
    const speedKmh = Math.round(progress.actualSpeedKmh);
    this.speedText.setText(`SPEED ${speedKmh} km/h`);
    if (speedKmh < 45) {
      this.speedText.setColor('#e74c3c');
    } else if (speedKmh < 55) {
      this.speedText.setColor('#f39c12');
    } else {
      this.speedText.setColor('#00e5ff');
    }

    // 7. HAVEN (Section 139)
    const distKm = (progress.distanceRemainingM / 1000).toFixed(1);
    const distPct = Math.round(progress.progress01 * 100);
    this.havenGoalText.setText(`🎯 HAVEN ${distKm} km (${distPct}%)`);

    this.havenProgressBar.clear();
    this.havenProgressBar.fillStyle(0x2c3e50, 1);
    this.havenProgressBar.fillRect(1140, 44, 220, 6);
    this.havenProgressBar.fillStyle(0x00ffcc, 1);
    this.havenProgressBar.fillRect(1140, 44, 220 * progress.progress01, 6);

    // 8. SEGMENT & TIME
    if (segmentName) {
      this.segmentBadgeText.setText(`[${segmentName}]`);
      this.segmentBadgeText.setVisible(true);
    } else {
      this.segmentBadgeText.setVisible(false);
    }

    const minutes = Math.floor(timeSec / 60);
    const seconds = Math.floor(timeSec % 60);
    this.timeText.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }

  public setV4Mode(isV4: boolean): void {
    if (!isV4) return;
    this.powerText.setVisible(false);
    this.powerWarningIcon.setVisible(false);
    this.speedText.setVisible(false);
    this.havenGoalText.setVisible(false);
    this.havenProgressBar.setVisible(false);
    this.cargoOverstackedBadge.setVisible(false);
    this.cargoText.setVisible(false);
    this.segmentBadgeText.setVisible(false);

    // Reposition Cargo Value text
    this.cargoValueText.setPosition(650, 26);
    this.cargoValueText.setFontSize('18px');

    // Reposition Time text
    this.timeText.setPosition(860, 26);
    this.timeText.setFontSize('18px');
    this.timeText.setColor('#00ffff');
  }

  public updateV4(timeSec: number, lootValue: number): void {
    const stats = this.trainManager.stats;
    const load = this.trainManager.load;

    if (timeSec >= 5.0 && this.tutorialHintText.visible) {
      this.tutorialHintText.setVisible(false);
    }

    // 1. HP Bar
    this.hpBar.clear();
    const hpPct = Phaser.Math.Clamp(stats.hp / stats.maxHp, 0, 1);
    this.hpBar.fillStyle(0x2c3e50, 1);
    this.hpBar.fillRect(95, 22, 100, 14);
    this.hpBar.fillStyle(hpPct > 0.4 ? 0x2ecc71 : 0xe74c3c, 1);
    this.hpBar.fillRect(95, 22, 100 * hpPct, 14);
    this.hpText.setText(`${Math.ceil(stats.hp)} / ${stats.maxHp}`);

    // 2. FUEL Bar
    this.fuelBar.clear();
    const fuelPct = Phaser.Math.Clamp(stats.fuel / stats.maxFuel, 0, 1);
    this.fuelBar.fillStyle(0x2c3e50, 1);
    this.fuelBar.fillRect(275, 22, 100, 14);

    let fuelColor = 0x3498db;
    if (stats.fuel < 15) {
      fuelColor = Math.floor(timeSec * 4) % 2 === 0 ? 0xe74c3c : 0xc0392b;
    } else if (stats.fuel < 30) {
      fuelColor = 0xf39c12;
    }
    this.fuelBar.fillStyle(fuelColor, 1);
    this.fuelBar.fillRect(275, 22, 100 * fuelPct, 14);
    this.fuelText.setText(`${Math.ceil(stats.fuel)} / ${stats.maxFuel}`);

    // Out of fuel alert
    if (stats.isOutOfFuel) {
      this.outOfFuelBanner.setVisible(true);
      const remain = Math.max(0, 12.0 - stats.outOfFuelTimer).toFixed(1);
      this.outOfFuelText.setText(`OUT OF FUEL! STALLING: ${remain}s`);
    } else {
      this.outOfFuelBanner.setVisible(false);
    }

    // 3. WEIGHT Bar & Badge (Safe 70, Heavy 70-90, Danger 90-105, Critical >105)
    this.loadBar.clear();
    const curWeight = load.getCurrentLoad();
    const safeWeight = 70;
    const weightPct = Phaser.Math.Clamp(curWeight / 115, 0, 1);

    this.loadBar.fillStyle(0x2c3e50, 1);
    this.loadBar.fillRect(465, 22, 110, 14);

    let weightColor = 0x27ae60;
    let badgeColor = 0x27ae60;
    let badgeLabel = 'SAFE';

    if (curWeight > 105) {
      const blink = Math.floor(timeSec * 6) % 2 === 0;
      weightColor = blink ? 0xe74c3c : 0xc0392b;
      badgeColor = 0xe74c3c;
      badgeLabel = 'CRITICAL';
    } else if (curWeight > 90) {
      weightColor = 0xe67e22;
      badgeColor = 0xe67e22;
      badgeLabel = 'DANGER';
    } else if (curWeight > 70) {
      weightColor = 0xf39c12;
      badgeColor = 0xf39c12;
      badgeLabel = 'HEAVY';
    }

    this.loadBar.fillStyle(weightColor, 1);
    this.loadBar.fillRect(465, 22, 110 * weightPct, 14);
    this.loadText.setText(`${Math.round(curWeight)} / ${safeWeight}`);

    // Badge
    this.loadBadgeBg.clear();
    this.loadBadgeBg.fillStyle(badgeColor, 1);
    this.loadBadgeBg.fillRoundedRect(0, 0, 76, 16, 3);
    this.loadBadgeText.setText(badgeLabel);

    // 4. LOOT VALUE
    this.cargoValueText.setText(`LOOT: $${lootValue}`);

    // 5. TIMER: MM:SS / 01:30
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    this.timeText.setText(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} / 01:30`);
  }
}
