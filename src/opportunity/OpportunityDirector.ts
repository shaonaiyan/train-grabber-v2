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

  private groups: Record<string, OpportunityGroup>;
  private activeWindows: OpportunityWindow[] = [];
  private completedRecords: WindowChoiceRecord[] = [];

  private nextWindowTimer: number = 2.5;
  private windowCounter: number = 0;
  private lastGroupId: string = '';
  private spawnedFixedTimes: Set<number> = new Set();

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

    // Listen for hook events to track player decisions for telemetry
    this.eventBus.on('GRAPPLE_FIRE', () => {
      // Find closest active item to crosshair / hook path
      const hookLatched = this.trainManager; // checked via item events
    });
    this.eventBus.on('GRAPPLE_HIT', (data: { item: ItemId }) => {
      const activeWin = this.getActiveWindow();
      if (activeWin) {
        const time = this.scene.time.now * 0.001;
        activeWin.recordAttempt(data.item, time);
      }
    });
    this.eventBus.on('ITEM_DELIVERED', (data: { item: ItemId }) => {
      const activeWin = this.getActiveWindow();
      if (activeWin) {
        activeWin.recordGrab(data.item);
      }
    });
  }

  public update(time: number, delta: number, currentPhaseId: number, allWorldItems: WorldItem[]): void {
    const currentTimeSec = time * 0.001;
    const dt = delta * 0.001;

    // 1. Check fixed windows in Phase 0 or Final Stretch (Sections 59, 72)
    this.checkFixedWindows(currentTimeSec, currentPhaseId, allWorldItems);

    // 2. Update active windows
    for (let i = this.activeWindows.length - 1; i >= 0; i--) {
      const win = this.activeWindows[i];
      if (win.update(currentTimeSec)) {
        this.completedRecords.push(win.finishWindow(currentTimeSec));
        this.activeWindows.splice(i, 1);
      }
    }

    // 3. If in normal dynamic phases (or between fixed windows), spawn dynamic windows
    if (this.activeWindows.length === 0) {
      this.nextWindowTimer -= dt;
      if (this.nextWindowTimer <= 0) {
        // Do not spawn dynamic windows in Phase 0 (it only uses fixed ones)
        if (currentPhaseId !== 0 && currentPhaseId !== 5) {
          this.spawnDynamicWindow(currentTimeSec, currentPhaseId, allWorldItems);
        }
      }
    }
  }

  private checkFixedWindows(currentTimeSec: number, currentPhaseId: number, allWorldItems: WorldItem[]): void {
    const phaseConfig = phasesData.phases[currentPhaseId];
    if (!phaseConfig || !phaseConfig.fixedWindows) return;

    for (const fw of phaseConfig.fixedWindows) {
      if (currentTimeSec >= fw.time && !this.spawnedFixedTimes.has(fw.time)) {
        this.spawnedFixedTimes.add(fw.time);
        this.spawnWindowWithItems(
          `fixed_${fw.time}`,
          'FIXED',
          'Preset Window',
          fw.items as ItemId[],
          currentTimeSec,
          3.8,
          allWorldItems
        );
      }
    }
  }

  private spawnDynamicWindow(currentTimeSec: number, phaseId: number, allWorldItems: WorldItem[]): void {
    const selectedGroup = this.selectGroupForContext(phaseId);
    const [dMin, dMax] = OpportunityConfigLoader.getWindowDurationRange();
    const duration = this.rng.range(dMin, dMax);

    this.windowCounter++;
    const windowId = `win_${this.windowCounter}_${selectedGroup.id}`;

    this.spawnWindowWithItems(
      windowId,
      selectedGroup.id,
      selectedGroup.name,
      selectedGroup.items,
      currentTimeSec,
      duration,
      allWorldItems
    );

    const [cdMin, cdMax] = OpportunityConfigLoader.getWindowCooldownRange();
    this.nextWindowTimer = duration + this.rng.range(cdMin, cdMax);
  }

  public spawnWindowWithItems(
    windowId: string,
    groupId: string,
    groupName: string,
    itemIds: ItemId[],
    currentTimeSec: number,
    duration: number,
    allWorldItems: WorldItem[]
  ): OpportunityWindow {
    const win = new OpportunityWindow(
      windowId,
      groupId,
      groupName,
      currentTimeSec,
      duration,
      itemIds,
      this.trainManager
    );

    // Layout items across different depths (Section 34)
    const bands: DepthBand[] = ['far', 'mid', 'near'];
    const shuffledBands = this.rng.shuffle(bands);

    let startX = 2000;
    for (let i = 0; i < itemIds.length; i++) {
      const band = shuffledBands[i % shuffledBands.length];
      const y = this.depthManager.getRandomYInBand(band, () => this.rng.nextFloat());
      const itemX = startX + i * this.rng.range(90, 150);

      const worldItem = this.itemFactory.spawnWorldItem(itemX, y, itemIds[i], band);
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

      // Penalize repeat
      if (g.id === this.lastGroupId) {
        weight *= 0.3;
      }

      // Context modifiers (Section 32)
      if (isLowFuel && g.items.includes('fuel')) {
        weight *= 2.5;
      }
      if (hasPowerShortage && g.items.includes('battery')) {
        weight *= 3.0;
      }
      if (isHeavy && g.items.includes('flat_car')) {
        weight *= 2.0;
      }

      candidates.push({ group: g, weight });
    }

    if (candidates.length === 0) {
      return this.groups['A'];
    }

    // Weighted roll
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
