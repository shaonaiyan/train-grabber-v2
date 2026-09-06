import Phaser from 'phaser';
import { SeededRandom } from '../core/SeededRandom';
import { V4_BALANCE } from './V4Balance';
import { V4ObjectRegistry } from './V4ObjectRegistry';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { DepthBand } from '../core/Types';
import { DepthManager } from '../world/DepthManager';
import { GoldSafeBehavior } from './behaviors/GoldSafeBehavior';
import { SheepBehavior } from './behaviors/SheepBehavior';
import { FridgeBehavior } from './behaviors/FridgeBehavior';
import { ExplosiveBarrelBehavior } from './behaviors/ExplosiveBarrelBehavior';

export class ContinuousSalvageDirector {
  private scene: Phaser.Scene;
  private rng: SeededRandom;
  private itemFactory: ItemFactory;
  private allWorldItems: WorldItem[];

  private nextSpawnTimer: number = 2.0;
  private emptyCoverageTimer: number = 0;
  private isStreamActive: boolean = false;
  private densityMultiplier: number = 1.0;

  constructor(
    scene: Phaser.Scene,
    rng: SeededRandom,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[]
  ) {
    this.scene = scene;
    this.rng = rng;
    this.itemFactory = itemFactory;
    this.allWorldItems = allWorldItems;
  }

  public setDensityMultiplier(mul: number): void {
    this.densityMultiplier = mul;
  }

  public update(dt: number, timeSec: number, worldSpeed: number): void {
    // Continuous stream is active between 8.0s and 85.0s
    if (timeSec < V4_BALANCE.TIMELINE.STREAM_START || timeSec > V4_BALANCE.TIMELINE.STREAM_STOP) {
      this.isStreamActive = false;
      return;
    }
    this.isStreamActive = true;

    // Check screen cap (max 8 active targets)
    const activeTargets = this.getActiveTargetCount();
    if (activeTargets >= V4_BALANCE.MAX_ACTIVE_ITEMS) {
      return;
    }

    // Check minimum coverage: if 0 targets in interaction zone for > 1.8s, force spawn fallback item
    if (activeTargets === 0) {
      this.emptyCoverageTimer += dt;
      if (this.emptyCoverageTimer >= V4_BALANCE.COVERAGE_STARVATION_TIMEOUT) {
        this.emptyCoverageTimer = 0;
        this.spawnFallbackItem(worldSpeed);
      }
    } else {
      this.emptyCoverageTimer = 0;
    }

    // Main Stream Timer
    this.nextSpawnTimer -= dt;
    if (this.nextSpawnTimer <= 0) {
      this.triggerStreamSpawn(timeSec, worldSpeed);
      this.scheduleNextSpawn(timeSec);
    }
  }

  private scheduleNextSpawn(timeSec: number): void {
    let baseInterval = 1.8;
    for (const tier of V4_BALANCE.STREAM_RATES) {
      if (timeSec >= tier.start && timeSec < tier.end) {
        baseInterval = tier.interval;
        break;
      }
    }

    baseInterval /= this.densityMultiplier;
    // Jitter: 0.75 ~ 1.30
    const jitter = this.rng.range(V4_BALANCE.INTERVAL_JITTER_MIN, V4_BALANCE.INTERVAL_JITTER_MAX);
    this.nextSpawnTimer = baseInterval * jitter;
  }

  private triggerStreamSpawn(timeSec: number, worldSpeed: number): void {
    const roll = this.rng.nextFloat();

    if (roll < V4_BALANCE.BURST_CHANCE) {
      // 8% Burst: 3 items within 0.8s
      this.spawnBurst(worldSpeed);
    } else if (roll < V4_BALANCE.BURST_CHANCE + V4_BALANCE.PAIR_CHANCE) {
      // 18% Pair: 2 items staggered by 40~100px in different bands
      this.spawnPair(worldSpeed);
    } else {
      // Standard Single Spawn
      this.spawnSingleItem(2000, worldSpeed);
    }
  }

  private pickItemType(): string {
    const weights = V4_BALANCE.STREAM_WEIGHTS;
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = this.rng.range(0, totalWeight);

    for (const [type, weight] of Object.entries(weights)) {
      r -= weight;
      if (r <= 0) {
        return type;
      }
    }
    return 'junk';
  }

  public spawnSingleItem(spawnX: number, worldSpeed: number, forcedType?: string): void {
    const type = forcedType || this.pickItemType();
    const depthManager = DepthManager.getInstance();
    const bands: DepthBand[] = ['far', 'mid', 'near'];
    const band = bands[Math.floor(this.rng.range(0, bands.length))];
    const bandConfig = depthManager.getBandConfig(band);
    const spawnY = (bandConfig.minY + bandConfig.maxY) * 0.5;

    this.instantiateObject(type, spawnX, spawnY, band);
  }

  private spawnPair(worldSpeed: number): void {
    const type1 = this.pickItemType();
    const type2 = this.pickItemType();

    const depthManager = DepthManager.getInstance();
    const band1: DepthBand = 'near';
    const band2: DepthBand = 'far';

    const y1 = (depthManager.getBandConfig(band1).minY + depthManager.getBandConfig(band1).maxY) * 0.5;
    const y2 = (depthManager.getBandConfig(band2).minY + depthManager.getBandConfig(band2).maxY) * 0.5;

    const spawnX1 = 2000;
    const spawnX2 = spawnX1 + this.rng.range(50, 90);

    this.instantiateObject(type1, spawnX1, y1, band1);
    this.instantiateObject(type2, spawnX2, y2, band2);
  }

  private spawnBurst(worldSpeed: number): void {
    // 3 items within 0.8s, at least 1 valuable/risk
    const valuablePool = ['gold_safe_v4', 'explosive_v4', 'fridge_v4', 'sheep_v4'];
    const heroPick = valuablePool[Math.floor(this.rng.range(0, valuablePool.length))];

    this.spawnSingleItem(2000, worldSpeed, heroPick);
    this.spawnSingleItem(2080, worldSpeed, 'fuel');
    this.spawnSingleItem(2160, worldSpeed, 'junk');
  }

  private spawnFallbackItem(worldSpeed: number): void {
    const fallbackTypes = ['fuel', 'parts', 'junk'];
    const pick = fallbackTypes[Math.floor(this.rng.range(0, fallbackTypes.length))];
    this.spawnSingleItem(1980, worldSpeed, pick);
  }

  public instantiateObject(type: string, x: number, y: number, band: DepthBand): void {
    // Hero Objects
    if (type === 'gold_safe_v4') {
      new GoldSafeBehavior(this.scene, x, y);
      return;
    } else if (type === 'sheep_v4') {
      new SheepBehavior(this.scene, x, y);
      return;
    } else if (type === 'fridge_v4') {
      new FridgeBehavior(this.scene, x, y);
      return;
    } else if (type === 'explosive_v4') {
      new ExplosiveBarrelBehavior(this.scene, x, y);
      return;
    }

    // Standard items via ItemFactory
    const validStandard = ['fuel', 'parts', 'junk', 'battery'];
    const stdType = validStandard.includes(type) ? type : 'junk';
    const worldItem = this.itemFactory.spawnWorldItem(x, y, stdType as any, band);
    this.allWorldItems.push(worldItem);
  }

  public getActiveTargetCount(): number {
    const v4Targets = V4ObjectRegistry.getInstance().getHookableTargets().length;
    const stdTargets = this.allWorldItems.filter((i) => !i.isLatched && !i.isDelivered && !i.isDestroyed).length;
    return v4Targets + stdTargets;
  }
}
