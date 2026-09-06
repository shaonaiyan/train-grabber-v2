import Phaser from 'phaser';
import { ItemId, DepthBand, OpportunityGroup, WindowChoiceRecord } from '../core/Types';
import { OpportunityWindow } from './OpportunityWindow';
import { OpportunityConfigLoader } from './OpportunityData';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { TrainManager } from '../train/TrainManager';
import { SeededRandom } from '../core/SeededRandom';
import { DepthManager } from '../world/DepthManager';
import { EventBus } from '../core/EventBus';
import phasesData from '../data/phases.json';

export class OpportunityDirector {
  private scene: Phaser.Scene;
  private itemFactory: ItemFactory;
  private trainManager: TrainManager;
  private rng: SeededRandom;
  private depthManager: DepthManager;
  private eventBus: EventBus;

  public groups: Record<string, OpportunityGroup>;
  private activeWindows: OpportunityWindow[] = [];
  private completedRecords: WindowChoiceRecord[] = [];

  private nextWindowTimer: number = 0;
  private windowCounter: number = 0;
  private lastGroupId: string = '';
  private spawnedFixedTimes: Set<number> = new Set();
  private hasSpawnedTutorialBandit: boolean = false;

  // Section 27-28: Adaptive Director Context Multipliers (Default OFF)
  public isAdaptiveEnabled: boolean = false;
  public isWorldLocked: boolean = true;

  // Interaction Zone metrics (Section 20)
  public interactionEnterX: number = 1150;
  public interactionExitX: number = 290;

  constructor(
    scene: Phaser.Scene,
    itemFactory: ItemFactory,
    trainManager: TrainManager,
    rng: SeededRandom
  ) {
    this.scene = scene;
    this.itemFactory = itemFactory;
    this.trainManager = trainManager;
    this.rng = rng;
    this.depthManager = DepthManager.getInstance();
    this.eventBus = EventBus.getInstance();
    this.groups = OpportunityConfigLoader.getGroups();

    // Hook decision listeners for telemetry
    this.eventBus.on('GRAPPLE_HIT', (data: { item: ItemId }) => {
      const activeWin = this.getActiveWindow();
      if (activeWin) {
        const runTime = (this.scene as any).runTimeSec || 0;
        activeWin.recordAttempt(data.item, runTime);
      }
    });
    this.eventBus.on('ITEM_DELIVERED', (data: { item: ItemId }) => {
      const activeWin = this.getActiveWindow();
      if (activeWin) {
        activeWin.recordGrab(data.item);
      }
    });
  }

  public update(
    runTimeSec: number,
    scaledDelta: number,
    currentPhaseId: number,
    allWorldItems: WorldItem[],
    worldSpeed: number
  ): void {
    const dt = scaledDelta * 0.001;

    // Dynamic Interaction Zone calculation (Section 20)
    const cranePos = this.trainManager.getCranePosition();
    this.interactionEnterX = cranePos.x + 760 - 80;
    this.interactionExitX = cranePos.x - 180;

    // 1. Check fixed windows in Phase 0 (Tutorial) and Final Stretch (Section 32, 72)
    this.checkFixedWindows(runTimeSec, currentPhaseId, allWorldItems, worldSpeed);

    // Special 34s Tutorial Bandit Spawn (Section 32)
    if (runTimeSec >= 34 && !this.hasSpawnedTutorialBandit && currentPhaseId === 0) {
      this.hasSpawnedTutorialBandit = true;
      this.eventBus.emit('SPAWN_TUTORIAL_BANDIT');
    }

    // 2. Update active windows
    for (let i = this.activeWindows.length - 1; i >= 0; i--) {
      const win = this.activeWindows[i];
      if (win.update(runTimeSec, this.interactionEnterX, this.interactionExitX)) {
        // Section 23: finishWindow called exactly once by Director
        const record = win.finishWindow(runTimeSec);
        this.completedRecords.push(record);
        this.activeWindows.splice(i, 1);

        // Section 24: Cooldown 0.75 ~ 1.20s between windows
        this.nextWindowTimer = this.rng.range(0.75, 1.20);
      }
    }

    // 3. Spawning dynamic windows outside Phase 0 and Phase 5
    if (this.activeWindows.length === 0 && currentPhaseId !== 0 && currentPhaseId !== 5) {
      this.nextWindowTimer -= dt;
      if (this.nextWindowTimer <= 0) {
        this.spawnDynamicWindow(runTimeSec, currentPhaseId, allWorldItems, worldSpeed);
      }
    }
  }

  private checkFixedWindows(
    runTimeSec: number,
    currentPhaseId: number,
    allWorldItems: WorldItem[],
    worldSpeed: number
  ): void {
    const phaseConfig = phasesData.phases[currentPhaseId];
    if (!phaseConfig || !phaseConfig.fixedWindows) return;

    for (const fw of phaseConfig.fixedWindows) {
      if (runTimeSec >= fw.time && !this.spawnedFixedTimes.has(fw.time)) {
        this.spawnedFixedTimes.add(fw.time);
        this.spawnWindowWithItems(
          `fixed_${fw.time}`,
          'FIXED',
          'Preset Window',
          fw.items as ItemId[],
          runTimeSec,
          3.8,
          allWorldItems,
          currentPhaseId,
          worldSpeed
        );
      }
    }
  }

  private spawnDynamicWindow(
    runTimeSec: number,
    phaseId: number,
    allWorldItems: WorldItem[],
    worldSpeed: number
  ): void {
    const selectedGroup = this.selectGroupForContext(phaseId);
    const duration = this.rng.range(3.2, 4.2);

    this.windowCounter++;
    const windowId = `win_${this.windowCounter}_${selectedGroup.id}`;

    this.spawnWindowWithItems(
      windowId,
      selectedGroup.id,
      selectedGroup.name,
      selectedGroup.items,
      runTimeSec,
      duration,
      allWorldItems,
      phaseId,
      worldSpeed
    );
  }

  public spawnWindowWithItems(
    windowId: string,
    groupId: string,
    groupName: string,
    itemIds: ItemId[],
    runTimeSec: number,
    duration: number,
    allWorldItems: WorldItem[],
    phaseId: number = 0,
    worldSpeed: number = 160
  ): OpportunityWindow {
    const win = new OpportunityWindow(
      windowId,
      groupId,
      groupName,
      runTimeSec,
      duration,
      itemIds,
      this.trainManager
    );

    // Section 25-26: Pre-spawn items just outside interaction zone so they enter 0.3s after cooldown
    const leadDistance = Math.max(80, worldSpeed * 0.35);
    const baseSpawnX = Math.max(1400, this.interactionEnterX + leadDistance);

    const bands: DepthBand[] = ['far', 'mid', 'near'];
    const shuffledBands = this.rng.shuffle(bands);

    for (let i = 0; i < itemIds.length; i++) {
      const band = shuffledBands[i % shuffledBands.length];
      const y = this.depthManager.getRandomYInBand(band, () => this.rng.nextFloat());
      // Section 26: Staggered horizontally by 80~120px
      const itemX = baseSpawnX + i * this.rng.range(80, 120);

      // Section 30: Deterministic outcome seed for mystery items
      const outcomeSeed = (this.rng.getSeed() + this.windowCounter * 17 + i * 31) % 999983;

      const worldItem = this.itemFactory.spawnWorldItem(
        itemX,
        y,
        itemIds[i],
        band,
        windowId,
        phaseId,
        outcomeSeed
      );
      allWorldItems.push(worldItem);
      win.activeWorldItems.push(worldItem);
    }

    this.activeWindows.push(win);
    return win;
  }

  private selectGroupForContext(phaseId: number): OpportunityGroup {
    const candidates: Array<{ group: OpportunityGroup; weight: number }> = [];

    const isLowFuel = this.trainManager.stats.fuel < 35;
    const hasPowerShortage = this.trainManager.power.hasShortage();
    const isHeavy = this.trainManager.load.getLoadRatio() >= 0.85;

    for (const key in this.groups) {
      const g = this.groups[key];
      let weight = g.phaseWeight[phaseId.toString()] || 0;
      if (weight <= 0) continue;

      if (g.id === this.lastGroupId) {
        weight *= 0.3;
      }

      // Section 27-28: Context multipliers ONLY active when isAdaptiveEnabled is true
      if (this.isAdaptiveEnabled) {
        if (isLowFuel && g.items.includes('fuel')) {
          weight *= 2.5;
        }
        if (hasPowerShortage && g.items.includes('battery')) {
          weight *= 3.0;
        }
        if (isHeavy && g.items.includes('flat_car')) {
          weight *= 2.0;
        }
      }

      candidates.push({ group: g, weight });
    }

    if (candidates.length === 0) {
      return this.groups['A'];
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = this.rng.nextFloat() * totalWeight;

    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) {
        this.lastGroupId = c.group.id;
        return c.group;
      }
    }

    this.lastGroupId = candidates[0].group.id;
    return candidates[0].group;
  }

  public getActiveWindow(): OpportunityWindow | null {
    return this.activeWindows.length > 0 ? this.activeWindows[0] : null;
  }

  public getCompletedRecords(): WindowChoiceRecord[] {
    return this.completedRecords;
  }
}
