import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { Grapple } from '../grapple/Grapple';
import { SalvageSiteDirector } from '../sites/SalvageSiteDirector';
import { EncounterDirector } from '../encounters/EncounterDirector';
import { JourneyDirector } from '../journey/JourneyDirector';
import { EnemyManager } from '../enemies/EnemyManager';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { ItemId } from '../core/Types';
import { EventBus } from '../core/EventBus';
import { GoldSafeBehavior } from '../v4/behaviors/GoldSafeBehavior';
import { SheepBehavior } from '../v4/behaviors/SheepBehavior';
import { FridgeBehavior } from '../v4/behaviors/FridgeBehavior';
import { ExplosiveBarrelBehavior } from '../v4/behaviors/ExplosiveBarrelBehavior';
import { DroneBehavior } from '../v4/behaviors/DroneBehavior';
import { GiantMagnetBehavior } from '../v4/behaviors/GiantMagnetBehavior';
import { BanditJeepBehavior } from '../v4/behaviors/BanditJeepBehavior';
import { FlatCarEvent } from '../v4/behaviors/FlatCarEvent';
import { GremlinBehavior } from '../v4/behaviors/GremlinBehavior';
import { V4ObjectRegistry } from '../v4/V4ObjectRegistry';
import { V4Telemetry } from '../v4/V4Telemetry';

export class DebugPanel {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private grapple: Grapple;
  private siteDirector: SalvageSiteDirector;
  private encounterDirector: EncounterDirector;
  private journeyDirector: JourneyDirector;
  private enemyManager: EnemyManager;
  private itemFactory: ItemFactory;
  private allWorldItems: WorldItem[];
  private seed: number;

  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private debugStatsText!: Phaser.GameObjects.Text;
  private overlayGraphics: Phaser.GameObjects.Graphics;

  // Debug states
  public isPaused: boolean = false;
  public timeScale: number = 1.0;
  public showOverlays: boolean = false;
  public showSiteBounds: boolean = false;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    grapple: Grapple,
    siteDirector: SalvageSiteDirector,
    encounterDirector: EncounterDirector,
    journeyDirector: JourneyDirector,
    enemyManager: EnemyManager,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[],
    seed: number
  ) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.grapple = grapple;
    this.siteDirector = siteDirector;
    this.encounterDirector = encounterDirector;
    this.journeyDirector = journeyDirector;
    this.enemyManager = enemyManager;
    this.itemFactory = itemFactory;
    this.allWorldItems = allWorldItems;
    this.seed = seed;

    this.container = scene.add.container(20, 50);
    this.container.setDepth(300);
    this.container.setVisible(false);

    this.overlayGraphics = scene.add.graphics();
    this.overlayGraphics.setDepth(290);

    this.buildPanelUI();

    // Toggle with F1
    scene.input.keyboard?.on('keydown-F1', (evt: KeyboardEvent) => {
      evt.preventDefault();
      this.toggle();
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
    if (!this.isVisible) {
      this.overlayGraphics.clear();
    }
  }

  public isV4: boolean = false;

  public setV4Mode(isV4: boolean): void {
    this.isV4 = isV4;
  }

  private buildPanelUI(): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0e14, 0.95);
    bg.fillRoundedRect(0, 0, 860, 840, 8);
    bg.lineStyle(2, 0x00ffcc, 1);
    bg.strokeRoundedRect(0, 0, 860, 840, 8);
    this.container.add(bg);

    const title = this.scene.add.text(20, 12, '🛠️ DEBUG SYSTEM PANEL [F1]', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00ffcc',
    });
    this.container.add(title);

    // Left Column: Real-time Stats Display
    this.debugStatsText = this.scene.add.text(20, 42, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: '#ecf0f1',
      lineSpacing: 3,
    });
    this.container.add(this.debugStatsText);

    // Right Column: Interactive Buttons
    let btnX = 390;
    let btnY = 42;

    const createBtn = (label: string, onClick: () => void, color: number = 0x2980b9) => {
      const bCont = this.scene.add.container(btnX, btnY);
      const bG = this.scene.add.graphics();
      bG.fillStyle(color, 1);
      bG.fillRoundedRect(0, 0, 106, 24, 4);
      bG.lineStyle(1, 0xffffff, 0.6);
      bG.strokeRoundedRect(0, 0, 106, 24, 4);

      const bTxt = this.scene.add.text(53, 12, label, {
        fontFamily: 'Arial',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      bTxt.setOrigin(0.5);

      const hit = this.scene.add.rectangle(53, 12, 106, 24, 0x000000, 0.001);
      hit.setInteractive({ cursor: 'pointer' });
      hit.on('pointerdown', onClick);

      bCont.add([bG, bTxt, hit]);
      this.container.add(bCont);

      btnX += 114;
      if (btnX > 800) {
        btnX = 390;
        btnY += 28;
      }
      return bTxt;
    };

    const nextRow = () => {
      btnX = 390;
      btnY += 30;
    };

    // Row 1: Flow Controls
    createBtn('Pause/Resume', () => (this.isPaused = !this.isPaused));
    createBtn('Speed x0.5', () => (this.timeScale = 0.5));
    createBtn('Speed x1.0', () => (this.timeScale = 1.0));
    createBtn('Speed x2.0', () => (this.timeScale = 2.0));

    // Row 2: V3 Distance Jumps (Section 147)
    nextRow();
    createBtn('DIST +100m', () => {
      this.journeyDirector.progress.distanceTravelledM += 100;
    }, 0x16a085);
    createBtn('DIST +500m', () => {
      this.journeyDirector.progress.distanceTravelledM += 500;
    }, 0x16a085);
    createBtn('DIST to 4750m', () => {
      this.journeyDirector.progress.distanceTravelledM = 4750;
    }, 0x8e44ad);
    createBtn('Bounds [T]', () => {
      this.showSiteBounds = !this.showSiteBounds;
      if (!this.showSiteBounds && !this.showOverlays) this.overlayGraphics.clear();
    }, 0x34495e);

    // Row 3: Set Load Ratio (Section 147)
    nextRow();
    createBtn('Ratio 0.50', () => this.setTestLoadRatio(0.50), 0x27ae60);
    createBtn('Ratio 0.80', () => this.setTestLoadRatio(0.80), 0xf39c12);
    createBtn('Ratio 1.00', () => this.setTestLoadRatio(1.00), 0xe67e22);
    createBtn('Ratio 1.15', () => this.setTestLoadRatio(1.15), 0xd35400);

    // Row 4: Train Cheats & Flat Car
    nextRow();
    createBtn('Ratio 1.29', () => this.setTestLoadRatio(1.29), 0xc0392b);
    createBtn('CARGO +10', () => {
      const dummyGold = this.itemFactory.getItemData('gold');
      this.trainManager.installItem(dummyGold);
    }, 0x8e44ad);
    createBtn('CLEAR CARGO', () => {
      this.trainManager.cargo.reset();
      for (const car of this.trainManager.cars) car.clearCargoVisuals();
      this.trainManager.recalculateAllStats();
    }, 0x95a5a6);
    createBtn('+ FLAT CAR', () => {
      const dummyCar = this.itemFactory.getItemData('flat_car');
      this.trainManager.attachFlatCar(dummyCar);
    }, 0x2980b9);

    // Row 5: Fuel & HP Cheats
    nextRow();
    createBtn('HP +25', () => this.trainManager.stats.addHp(25), 0x27ae60);
    createBtn('Fuel +20', () => this.trainManager.stats.addFuel(20), 0xd35400);
    createBtn('Fuel FULL', () => this.trainManager.stats.addFuel(100), 0xe67e22);
    createBtn('Overlays', () => {
      this.showOverlays = !this.showOverlays;
      if (!this.showOverlays && !this.showSiteBounds) this.overlayGraphics.clear();
    }, 0x34495e);

    // Row 6: Spawn Sites 1~5 (Section 147)
    nextRow();
    const sites = [
      'intro_scrap',
      'gas_station',
      'farm_ruin',
      'rail_yard',
      'dry_scrap',
      'military_wreck',
      'lab_accident',
      'broken_freight',
      'last_temptation',
    ];
    sites.slice(0, 4).forEach((siteId) => {
      createBtn(siteId.substring(0, 10), () => {
        const runTime = (this.scene as any).runTimeSec || 0;
        const curDist = this.journeyDirector.progress.distanceTravelledM;
        const curSpeed = this.journeyDirector.progress.actualSpeedKmh;
        this.siteDirector.spawnSite(siteId, this.allWorldItems, runTime, curDist, curSpeed, 1950);
      }, 0x34495e);
    });

    // Row 7: Spawn Sites 5~9
    nextRow();
    sites.slice(4, 8).forEach((siteId) => {
      createBtn(siteId.substring(0, 10), () => {
        const runTime = (this.scene as any).runTimeSec || 0;
        const curDist = this.journeyDirector.progress.distanceTravelledM;
        const curSpeed = this.journeyDirector.progress.actualSpeedKmh;
        this.siteDirector.spawnSite(siteId, this.allWorldItems, runTime, curDist, curSpeed, 1950);
      }, 0x34495e);
    });

    // Row 8: Site 9 & Spawn Encounters
    nextRow();
    createBtn('last_tempt', () => {
      const runTime = (this.scene as any).runTimeSec || 0;
      const curDist = this.journeyDirector.progress.distanceTravelledM;
      const curSpeed = this.journeyDirector.progress.actualSpeedKmh;
      this.siteDirector.spawnSite('last_temptation', this.allWorldItems, runTime, curDist, curSpeed, 1950);
    }, 0x34495e);

    const encounters = ['bandit_intro', 'raider_attack', 'drone_ambush', 'mixed_raid'];
    encounters.forEach((encId) => {
      createBtn(encId.substring(0, 10), () => {
        const curDist = this.journeyDirector.progress.distanceTravelledM;
        this.encounterDirector.triggerEncounter(encId, curDist);
      }, 0xc0392b);
    });

    // Row 9: Spawn Individual Items
    nextRow();
    const itemIds: ItemId[] = [
      'parts', 'fuel', 'gold', 'turret', 'battery', 'flat_car',
      'sheep', 'survivor', 'fridge', 'egg', 'explosive', 'junk',
    ];
    itemIds.forEach((id) => {
      createBtn(`+ ${id}`, () => {
        const item = this.itemFactory.spawnWorldItem(1850, 560, id, 'near');
        this.allWorldItems.push(item);
      }, 0x2c3e50);
    });

    // Row 10: Force Win / Fail
    nextRow();
    createBtn('Force WIN', () => EventBus.getInstance().emit('RUN_WIN'), 0x27ae60);
    createBtn('Force FAIL', () => EventBus.getInstance().emit('RUN_FAIL', { reason: 'FAIL_HP' }), 0xc0392b);

    // Row 11: V4 Hero Spawns
    nextRow();
    createBtn('+ Safe', () => new GoldSafeBehavior(this.scene, 1850, 530), 0xd35400);
    createBtn('+ Sheep', () => new SheepBehavior(this.scene, 1850, 580), 0x27ae60);
    createBtn('+ Fridge', () => new FridgeBehavior(this.scene, 1850, 570), 0x2980b9);
    createBtn('+ Barrel', () => new ExplosiveBarrelBehavior(this.scene, 1850, 580), 0xc0392b);

    nextRow();
    createBtn('+ Drone', () => new DroneBehavior(this.scene, 1850, 380), 0x8e44ad);
    createBtn('+ Magnet', () => new GiantMagnetBehavior(this.scene, 1850, 580), 0x16a085);
    createBtn('+ Jeep', () => new BanditJeepBehavior(this.scene, 1850, 610), 0xe67e22);
    createBtn('+ FlatCar', () => new FlatCarEvent(this.scene, 1850, 690), 0x34495e);

    // Row 12: V4 Interactions & Presets
    nextRow();
    createBtn('+ Gremlin', () => new GremlinBehavior(this.scene, 600, 650), 0xc0392b);
    createBtn('Panic Sheep', () => {
      const sheep = V4ObjectRegistry.getInstance().getAll().find((e) => e.typeId === 'sheep_v4') as any;
      if (sheep && sheep.panic) sheep.panic();
    }, 0xf39c12);
    createBtn('Overcharge', () => {
      const magnet = V4ObjectRegistry.getInstance().getAll().find((e) => e.typeId === 'giant_magnet_v4') as any;
      if (magnet && magnet.triggerOvercharge) magnet.triggerOvercharge();
    }, 0xe74c3c);
    createBtn('W: 60 (Safe)', () => {
      this.trainManager.load.physicalLoad = 60;
      this.trainManager.load.effectiveLoad = 60;
      this.trainManager.recalculateAllStats();
    }, 0x27ae60);

    nextRow();
    createBtn('W: 80 (Hvy)', () => {
      this.trainManager.load.physicalLoad = 80;
      this.trainManager.load.effectiveLoad = 80;
      this.trainManager.recalculateAllStats();
    }, 0xf39c12);
    createBtn('W: 100 (Dan)', () => {
      this.trainManager.load.physicalLoad = 100;
      this.trainManager.load.effectiveLoad = 100;
      this.trainManager.recalculateAllStats();
    }, 0xe67e22);
    createBtn('W: 120 (Crit)', () => {
      this.trainManager.load.physicalLoad = 120;
      this.trainManager.load.effectiveLoad = 120;
      this.trainManager.recalculateAllStats();
    }, 0xc0392b);
    createBtn('Export F2', () => {
      V4Telemetry.getInstance().exportDataToFile();
    }, 0x2980b9);
  }

  private setTestLoadRatio(targetRatio: number): void {
    const safeMax = this.trainManager.load.getSafeMaxLoad();
    const targetEffectiveLoad = safeMax * targetRatio;
    this.trainManager.load.effectiveLoad = targetEffectiveLoad;
    this.trainManager.load.physicalLoad = targetEffectiveLoad;
    this.trainManager.recalculateAllStats();
  }

  public update(timeSec: number): void {
    if (!this.isVisible && !this.showSiteBounds && !this.showOverlays) return;

    if (this.isVisible) {
      const stats = this.trainManager.stats;
      const power = this.trainManager.power;
      const load = this.trainManager.load;
      const cargo = this.trainManager.cargo;
      const progress = this.journeyDirector.progress;
      const hookState = this.grapple.getState();
      const latched = this.grapple.getLatchedItem();
      const activeSite = this.siteDirector.getActiveSite();

      const info = [
        `=== V3 REAL-TIME METRICS ===`,
        `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
        `Seed: ${this.seed}`,
        `RunTime: ${timeSec.toFixed(1)}s (Scale: x${this.timeScale})`,
        `Distance: ${progress.distanceTravelledM.toFixed(0)}m / ${progress.targetDistanceM}m (${(progress.progress01 * 100).toFixed(1)}%)`,
        `Speed: ${progress.actualSpeedKmh.toFixed(1)} km/h (${progress.actualSpeedPx.toFixed(0)} px/s)`,
        `Speed Mul: ${load.getSpeedMultiplier().toFixed(2)} | Fuel Mul: ${load.getFuelMultiplier().toFixed(2)}`,
        ``,
        `=== SOFT OVERLOAD & CARGO ===`,
        `Effective Load: ${load.getCurrentLoad().toFixed(0)} / ${load.getSafeMaxLoad()} (${(load.getLoadRatio() * 100).toFixed(0)}%)`,
        `Load Tier: [${load.getTier()}]`,
        `Cargo: ${cargo.cargoUsed} / ${cargo.cargoCapacity} (Overflow: ${cargo.getCargoOverflow()})`,
        `Cargo Value: $${cargo.getTotalCargoValue()}`,
        `HP: ${Math.ceil(stats.hp)} / ${stats.maxHp} | Fuel: ${Math.ceil(stats.fuel)} / ${stats.maxFuel}`,
        `Power: ${power.getSupply()} / ${power.getDemand()} (${(power.getEfficiency() * 100).toFixed(0)}%)`,
        `Cars: ${this.trainManager.getCarCount()} (Flat: ${this.trainManager.getFlatCarCount()})`,
        `Discarded: ${this.trainManager.getDiscardedCount()}`,
        ``,
        `=== SITES & COMBAT ===`,
        `Hook: [${hookState}] Target: ${latched ? latched.data.id : 'None'}`,
        `Active Site: ${activeSite ? activeSite.def.id : 'None'} (x: ${activeSite ? Math.round(activeSite.siteAnchorX) : 0})`,
        `Encounter: ${this.encounterDirector.activeEncounter ? this.encounterDirector.activeEncounter.encounterId : 'None'}`,
        `World Items: ${this.allWorldItems.filter((i) => !i.isDestroyed).length}`,
        `Enemies: ${this.enemyManager.enemies.length}`,
      ];

      this.debugStatsText.setText(info.join('\n'));
    }

    if (this.showSiteBounds || this.showOverlays) {
      this.renderOverlays();
    }
  }

  public updateV4(timeSec: number): void {
    if (!this.isVisible && !this.showSiteBounds && !this.showOverlays) return;

    if (this.isVisible) {
      const stats = this.trainManager.stats;
      const load = this.trainManager.load;
      const telemetry = V4Telemetry.getInstance();
      const hookState = this.grapple.getState();
      const latched = this.grapple.getLatchedItem();
      const curLoad = load.getCurrentLoad();

      let tier = 'SAFE';
      if (curLoad > 105) tier = 'CRITICAL';
      else if (curLoad > 90) tier = 'DANGER';
      else if (curLoad > 70) tier = 'HEAVY';

      const info = [
        `=== V4 CORE SLICE METRICS ===`,
        `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
        `Seed: ${this.seed}`,
        `RunTime: ${timeSec.toFixed(1)}s / 90.0s (Scale: x${this.timeScale})`,
        `HP: ${Math.ceil(stats.hp)} / ${stats.maxHp} | Fuel: ${Math.ceil(stats.fuel)} / ${stats.maxFuel}`,
        `Train Weight: ${curLoad.toFixed(0)} / 70 [${tier}]`,
        `Loot Value: $${this.trainManager.getCargoValue()}`,
        `Cars: ${this.trainManager.getCarCount()} (Flat: ${this.trainManager.getFlatCarCount()})`,
        ``,
        `=== V4 TELEMETRY SUMMARY ===`,
        `Grab Rate: ${telemetry.getSummary().grabRate}% | Jettisoned: ${telemetry.getSummary().jettisonCount}`,
        `Coverage: ${telemetry.getSummary().targetCoveragePercent}% | Max Idle Gap: ${telemetry.getSummary().maxIdleGap.toFixed(2)}s`,
        `Regret Triggers: ${telemetry.getSummary().regretResponses}`,
        `Cross-Interactions: ${telemetry.getSummary().crossInteractions}`,
        `Threats: Turret ${telemetry.getSummary().turretEnemyResolutions} | Grapple/Impact ${telemetry.getSummary().grappleEnemyResolutions}`,
        ``,
        `=== LIVE OBJECTS ===`,
        `Hook State: [${hookState}] Target: ${latched ? latched.data.id : 'None'}`,
        `Loose Entities: ${V4ObjectRegistry.getInstance().getAll().filter((e) => !e.isDestroyed()).length}`,
        `Enemies: ${this.enemyManager.enemies.length}`,
      ];

      this.debugStatsText.setText(info.join('\n'));
    }

    if (this.showSiteBounds || this.showOverlays) {
      this.renderOverlays();
    }
  }

  private renderOverlays(): void {
    const g = this.overlayGraphics;
    g.clear();

    if (this.showSiteBounds) {
      const activeSite = this.siteDirector.getActiveSite();
      if (activeSite) {
        g.lineStyle(2, 0x00ffcc, 0.85);
        g.strokeRect(activeSite.siteAnchorX, 450, activeSite.def.lengthPx, 240);
        g.fillStyle(0x00ffcc, 0.08);
        g.fillRect(activeSite.siteAnchorX, 450, activeSite.def.lengthPx, 240);
      }
    }

    if (this.showOverlays) {
      // Depth bands lines
      g.lineStyle(1, 0x00ffff, 0.35);
      g.lineBetween(0, 485, 1920, 485);
      g.lineBetween(0, 535, 1920, 535);
      g.lineBetween(0, 595, 1920, 595);
      g.lineBetween(0, 655, 1920, 655);
      g.lineBetween(0, 710, 1920, 710);

      // World items hitboxes
      g.lineStyle(2, 0xffff00, 0.7);
      for (const item of this.allWorldItems) {
        if (!item.isDestroyed) {
          g.strokeCircle(item.container.x, item.container.y, 34);
        }
      }

      // Enemies hitboxes
      g.lineStyle(2, 0xff0000, 0.7);
      for (const enemy of this.enemyManager.enemies) {
        if (!enemy.isDead) {
          g.strokeRect(enemy.container.x - 25, enemy.container.y - 20, 50, 40);
        }
      }
    }
  }
}
