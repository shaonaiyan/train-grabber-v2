import Phaser from 'phaser';
import { SeededRandom } from '../core/SeededRandom';
import { EventBus } from '../core/EventBus';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { AudioManager } from '../fx/AudioManager';
import { WorldScroller } from '../world/WorldScroller';
import { TrainManager } from '../train/TrainManager';
import { Grapple } from '../grapple/Grapple';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { SalvageSiteDirector } from '../sites/SalvageSiteDirector';
import { EncounterDirector } from '../encounters/EncounterDirector';
import { JourneyDirector } from '../journey/JourneyDirector';
import { EnemyManager } from '../enemies/EnemyManager';
import { ItemEffectSystem } from '../items/ItemEffectSystem';
import { HUD } from '../ui/HUD';
import { DebugPanel } from '../ui/DebugPanel';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import balanceData from '../data/balance.json';

// V4 Imports
import { GameMode, getActiveGameMode } from '../core/Types';
import { CoreSliceDirector } from '../v4/CoreSliceDirector';
import { ContinuousSalvageDirector } from '../v4/ContinuousSalvageDirector';
import { V4InteractionSystem } from '../v4/V4InteractionSystem';
import { V4Telemetry } from '../v4/V4Telemetry';
import { V4Audio } from '../v4/V4Audio';
import { V4ObjectRegistry } from '../v4/V4ObjectRegistry';

export class GameScene extends Phaser.Scene {
  private seed: number = 0;
  private rng!: SeededRandom;
  private eventBus!: EventBus;

  // Managers & Directors
  public particles!: ParticleManager;
  public juice!: JuiceManager;
  public audio!: AudioManager;
  public worldScroller!: WorldScroller;
  public trainManager!: TrainManager;
  public grapple!: Grapple;
  public itemFactory!: ItemFactory;

  public journeyDirector!: JourneyDirector;
  public siteDirector!: SalvageSiteDirector;
  public encounterDirector!: EncounterDirector;
  public enemyManager!: EnemyManager;
  private itemEffectSystem!: ItemEffectSystem;

  public hud!: HUD;
  public debugPanel!: DebugPanel;
  public telemetry!: TelemetryManager;

  // V4 Specific
  public isV4: boolean = false;
  public coreSliceDirector!: CoreSliceDirector;
  public continuousSalvageDirector!: ContinuousSalvageDirector;
  public v4InteractionSystem!: V4InteractionSystem;
  public v4Telemetry!: V4Telemetry;
  public v4Audio!: V4Audio;

  // Run State
  public runTimeSec: number = 0;
  public get currentTime(): number {
    return this.runTimeSec;
  }
  public set currentTime(val: number) {
    this.runTimeSec = val;
  }

  private isStationArriving: boolean = false;
  private isGameOver: boolean = false;
  public allWorldItems: WorldItem[] = [];
  private isUserPaused: boolean = false;
  private pauseText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  public init(data: { seed?: number | string }): void {
    this.seed = data && data.seed !== undefined ? Number(data.seed) : Math.floor(Math.random() * 1000000);
    this.runTimeSec = 0;
    this.isStationArriving = false;
    this.isGameOver = false;
    this.allWorldItems = [];
    this.isUserPaused = false;
  }

  public create(): void {
    this.rng = new SeededRandom(this.seed);
    this.eventBus = EventBus.getInstance();
    this.eventBus.clear();

    this.isV4 = getActiveGameMode() === GameMode.CORE_SLICE_V4;

    // FX & Audio
    this.particles = new ParticleManager(this);
    this.juice = new JuiceManager(this);
    this.audio = AudioManager.getInstance();

    // World & Train
    this.worldScroller = new WorldScroller(this);
    this.trainManager = new TrainManager(this, this.particles);
    this.grapple = new Grapple(this, this.trainManager, this.particles, this.juice);
    this.itemFactory = new ItemFactory(this);

    // V3 Journey & Content Directors
    this.journeyDirector = new JourneyDirector();
    this.siteDirector = new SalvageSiteDirector(this, this.itemFactory);
    this.encounterDirector = new EncounterDirector(this);
    this.enemyManager = new EnemyManager(this, this.trainManager, this.rng, this.particles, this.juice);
    this.itemEffectSystem = new ItemEffectSystem(this, this.trainManager, this.rng, this.juice);

    // HUD & Debug Panel
    this.hud = new HUD(this, this.trainManager);
    this.debugPanel = new DebugPanel(
      this,
      this.trainManager,
      this.grapple,
      this.siteDirector,
      this.encounterDirector,
      this.journeyDirector,
      this.enemyManager,
      this.itemFactory,
      this.allWorldItems,
      this.seed
    );

    // V4 initialization
    if (this.isV4) {
      V4ObjectRegistry.getInstance().reset();
      this.v4Audio = V4Audio.getInstance();
      this.v4Telemetry = V4Telemetry.getInstance();
      this.v4Telemetry.reset(String(this.seed));

      this.continuousSalvageDirector = new ContinuousSalvageDirector(
        this,
        this.rng,
        this.itemFactory,
        this.allWorldItems
      );

      this.coreSliceDirector = new CoreSliceDirector(
        this,
        this.rng,
        this.continuousSalvageDirector,
        this.itemFactory,
        this.allWorldItems
      );

      this.v4InteractionSystem = new V4InteractionSystem(this);

      this.hud.setV4Mode(true);
      this.debugPanel.setV4Mode(true);
    } else {
      // Telemetry V3
      this.telemetry = TelemetryManager.getInstance();
      this.telemetry.init(this.seed, this.trainManager, this.journeyDirector.progress);
    }

    this.setupInput();
    this.setupGameEvents();
  }

  private setupInput(): void {
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.isUserPaused || this.debugPanel.isPaused) return;

      if (pointer.leftButtonDown()) {
        this.grapple.fire(pointer.worldX, pointer.worldY, this.allWorldItems);
      } else if (pointer.rightButtonDown()) {
        if (this.grapple.isHoldingOrReeling()) {
          this.grapple.release();
        }
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.toggleUserPause();
    });

    this.input.keyboard?.on('keydown-F2', (evt: KeyboardEvent) => {
      evt.preventDefault();
      if (this.isV4) {
        this.v4Telemetry.exportDataToFile();
      } else {
        this.telemetry.exportDataToFile();
      }
    });
  }

  private toggleUserPause(): void {
    this.isUserPaused = !this.isUserPaused;
    if (this.isUserPaused) {
      this.pauseText = this.add.text(960, 540, 'PAUSED [ESC to Resume]', {
        fontFamily: 'Arial',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#f1c40f',
        stroke: '#000000',
        strokeThickness: 6,
      });
      this.pauseText.setOrigin(0.5);
      this.pauseText.setDepth(400);
    } else {
      if (this.pauseText) {
        this.pauseText.destroy();
        this.pauseText = null;
      }
    }
  }

  private setupGameEvents(): void {
    this.eventBus.on('RUN_FAIL', (data: { reason: 'FAIL_HP' | 'FAIL_FUEL' }) => {
      if (this.isGameOver) return;
      this.isGameOver = true;

      if (this.isV4) {
        this.v4Telemetry.result = data.reason === 'FAIL_HP' ? 'FAILED_HP' : 'FAILED_FUEL';
        this.v4Telemetry.finalWeight = this.trainManager.load.getCurrentLoad();
        this.v4Telemetry.finalLootValue = this.trainManager.getCargoValue();
      } else {
        this.telemetry.setRunOutcome(data.reason);
      }

      this.juice.showFloatingText(960, 500, 'TRAIN CRITICAL FAILURE!', '#e74c3c', '44px');
      this.audio.playWarning();

      this.time.delayedCall(1800, () => {
        this.scene.start('ResultScene', {
          mode: this.isV4 ? 'v4' : 'v3',
          seed: this.seed,
          telemetry: this.isV4 ? this.v4Telemetry.exportJSON() : this.telemetry,
        });
      });
    });

    this.eventBus.on('RUN_WIN', () => {
      if (this.isV4) {
        this.coreSliceDirector.triggerCoreSliceComplete();
      } else {
        this.triggerWinSequence();
      }
    });

    // Haven Distance Milestones (V3)
    this.eventBus.on('HAVEN_MILESTONE_4300', () => {
      if (!this.isV4) this.worldScroller.triggerHavenApproachVisuals();
    });

    this.eventBus.on('HAVEN_SIGNAL_4750', () => {
      if (!this.isV4) {
        this.worldScroller.triggerGreenStationSignal();
        this.audio.playTrainWhistle();
      }
    });

    this.eventBus.on('JOURNEY_ARRIVED_HAVEN', () => {
      if (!this.isV4) this.triggerWinSequence();
    });
  }

  private triggerWinSequence(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isStationArriving = true;

    // Decelerate to stop at Haven platform
    this.worldScroller.triggerStationArrival();
    this.telemetry.setRunOutcome('WIN');

    // Section 143: 2.5s "YOUR TRAIN" showcase view
    const yourTrainText = this.add.text(960, 220, 'YOUR TRAIN', {
      fontFamily: 'Arial',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#00ffcc',
      stroke: '#000000',
      strokeThickness: 8,
    });
    yourTrainText.setOrigin(0.5);
    yourTrainText.setDepth(350);

    this.tweens.add({
      targets: this.cameras.main,
      zoom: 0.8,
      duration: 1500,
      ease: 'Quad.easeOut',
    });

    this.time.delayedCall(2500, () => {
      this.scene.start('ResultScene', { seed: this.seed, telemetry: this.telemetry });
    });
  }

  public update(time: number, delta: number): void {
    // 0. Hit stop & Pause checks
    if (this.juice.update(delta)) return;
    if (this.isUserPaused || this.debugPanel.isPaused) return;

    const timeScale = this.debugPanel.timeScale;
    const scaledDelta = delta * timeScale;
    const dt = scaledDelta * 0.001;

    // 1. Update RunTime
    if (!this.isGameOver) {
      this.runTimeSec += dt;
    }

    // ==========================================
    // V4 CORE SLICE UPDATE PATH
    // ==========================================
    if (this.isV4) {
      // Constant presentation speed 155 px/s, clamped to >= 0.92
      const baseSpeed = 155;
      const loadSpeedMul = Math.max(0.92, this.trainManager.load.getSpeedMultiplier());
      const actualSpeedPx = this.worldScroller.update(
        scaledDelta,
        baseSpeed,
        loadSpeedMul,
        this.trainManager.stats.isOutOfFuel
      );

      // Soft weight calculations
      const currentWeight = this.trainManager.load.getCurrentLoad();
      let fuelDrainRate = 1.0;
      if (currentWeight > 105) {
        // Critical: +25% enemy closing speed, engine strain audio
        fuelDrainRate = 1.8;
        this.v4Audio.playTrainStrain();
      } else if (currentWeight > 90) {
        fuelDrainRate = 1.4;
      } else if (currentWeight > 70) {
        fuelDrainRate = 1.2;
      }

      if (!this.isGameOver) {
        this.trainManager.stats.update(dt, fuelDrainRate);
      }

      // Update Train
      this.trainManager.update(time, scaledDelta, actualSpeedPx);

      // Update World Items
      for (let i = this.allWorldItems.length - 1; i >= 0; i--) {
        const item = this.allWorldItems[i];
        item.update(dt, actualSpeedPx);
        if (item.isDestroyed) {
          this.allWorldItems.splice(i, 1);
        }
      }

      // Update V4 Hero Entities (Safe, Sheep, Fridge, Barrel, Magnet, Drone, Jeep, FlatCar, Gremlin)
      const v4Entities = V4ObjectRegistry.getInstance().getAll();
      for (let i = v4Entities.length - 1; i >= 0; i--) {
        const entity = v4Entities[i];
        if (entity.update) {
          entity.update(dt, actualSpeedPx);
        }
      }
      V4ObjectRegistry.getInstance().cleanDestroyed();

      // Update Grapple Hook
      this.grapple.update(scaledDelta, this.allWorldItems);

      // Update Enemies (+25% closing speed if critical weight)
      const enemyDelta = currentWeight > 105 ? scaledDelta * 1.25 : scaledDelta;
      this.enemyManager.update(time, enemyDelta, actualSpeedPx);

      // Update V4 Directors & Interactions
      if (!this.isGameOver) {
        this.coreSliceDirector.update(dt, this.runTimeSec, actualSpeedPx);
        this.v4InteractionSystem.update(dt, this.enemyManager.enemies);
      }

      // Update HUD & Debug
      this.hud.updateV4(this.runTimeSec, this.trainManager.getCargoValue());
      this.debugPanel.updateV4(this.runTimeSec);

      // Audio Train Rhythm
      this.audio.updateTrainRhythm(scaledDelta, actualSpeedPx / baseSpeed);

      // Update V4 Telemetry
      const hookState = this.grapple.getState();
      const isHookBusy = hookState !== 'IDLE' && hookState !== 'AIM';
      if (isHookBusy) {
        this.v4Telemetry.hookBusyTime += dt;
      } else {
        this.v4Telemetry.hookIdleTime += dt;
      }

      const activeV4Count = V4ObjectRegistry.getInstance()
        .getAll()
        .filter(
          (e) =>
            !e.isDestroyed() &&
            !e.isDelivered() &&
            e.getPosition().x > -50 &&
            e.getPosition().x < 1920
        ).length;
      const activeCount =
        this.allWorldItems.filter((i) => !i.isDestroyed && i.container.x > -50 && i.container.x < 1920).length +
        activeV4Count +
        this.enemyManager.enemies.length;
      this.v4Telemetry.update(dt, this.runTimeSec, activeCount);
      return;
    }

    // ==========================================
    // V3 JOURNEY UPDATE PATH
    // ==========================================
    // 2. Recalculate Train load / speed / fuel (Section 210 Step 2)
    const segmentFuelMul = this.journeyDirector.getFuelMultiplier();
    const fuelDrainRate = this.trainManager.stats.calculateFuelDrain(
      this.trainManager.getFlatCarCount(),
      this.trainManager.load.getFuelMultiplier(),
      segmentFuelMul
    );

    if (!this.isGameOver) {
      this.trainManager.stats.update(dt, fuelDrainRate);
    }

    // 3. Update JourneyProgress & World Scrolling (Section 210 Step 3)
    const baseSpeed = balanceData.train.baseWorldSpeed;
    const loadSpeedMul = this.trainManager.load.getSpeedMultiplier();
    const actualSpeedPx = this.worldScroller.update(
      scaledDelta,
      baseSpeed,
      loadSpeedMul,
      this.trainManager.stats.isOutOfFuel
    );

    // 4. Update Journey Beats (Section 210 Step 4)
    if (!this.isGameOver && !this.isStationArriving) {
      this.journeyDirector.update(dt, actualSpeedPx);
    }

    // 5. Update Salvage Sites (Section 210 Step 5)
    if (!this.isGameOver && !this.isStationArriving) {
      this.siteDirector.update(
        dt,
        actualSpeedPx,
        loadSpeedMul,
        this.runTimeSec,
        this.journeyDirector.progress.distanceTravelledM
      );
    }

    // 6. Update Train (Section 210 Step 6)
    this.trainManager.update(time, scaledDelta, actualSpeedPx);

    // 7. Update World Items
    for (let i = this.allWorldItems.length - 1; i >= 0; i--) {
      const item = this.allWorldItems[i];
      if (!item.siteId) {
        item.update(dt, actualSpeedPx);
      }
      if (item.isDestroyed) {
        this.allWorldItems.splice(i, 1);
      }
    }

    // 8. Update Grapple Hook (Section 210 Step 7)
    this.grapple.update(scaledDelta, this.allWorldItems);

    // 9. Update Enemy Manager & Turret Combat (Section 210 Step 8)
    this.enemyManager.update(time, scaledDelta, actualSpeedPx);

    // 10. Update Item Effects (Fridge / Egg / Survivor regen, Section 210 Step 9)
    this.itemEffectSystem.update(scaledDelta);

    // 11. Update HUD & Debug (Section 210 Step 10)
    this.hud.update(
      this.runTimeSec,
      this.journeyDirector.progress,
      this.journeyDirector.getActiveSegmentName()
    );
    this.debugPanel.update(this.runTimeSec);

    // 12. Audio Train Rhythm
    this.audio.updateTrainRhythm(scaledDelta, actualSpeedPx / baseSpeed);

    // 13. Telemetry Snapshot (Section 210 Step 11)
    this.telemetry.setRunContext(this.runTimeSec, this.journeyDirector.progress.distanceTravelledM);
    this.telemetry.update(scaledDelta, this.enemyManager.enemies.length);

    // 14. Check Win Condition (Section 210 Step 12: Distance >= 4800m)
    if (this.journeyDirector.progress.isCompleted() && !this.isStationArriving && !this.isGameOver) {
      this.triggerWinSequence();
    }
  }
}
