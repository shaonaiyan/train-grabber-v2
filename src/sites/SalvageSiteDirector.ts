import Phaser from 'phaser';
import { SalvageSiteInstance } from './SalvageSiteInstance';
import { SalvageSiteFactory } from './SalvageSiteFactory';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { EventBus } from '../core/EventBus';
import { ItemId } from '../core/Types';

export class SalvageSiteDirector {
  private scene: Phaser.Scene;
  private itemFactory: ItemFactory;
  private eventBus: EventBus;
  public activeSites: SalvageSiteInstance[] = [];
  private spawnedSiteIds: Set<string> = new Set();

  constructor(scene: Phaser.Scene, itemFactory: ItemFactory) {
    this.scene = scene;
    this.itemFactory = itemFactory;
    this.eventBus = EventBus.getInstance();

    this.setupListeners();
  }

  private setupListeners(): void {
    this.eventBus.on('JOURNEY_TRIGGER_SITE', (data: { siteId: string; distanceM: number }) => {
      const runTime = (this.scene as any).runTimeSec || 0;
      const speedKmh = (this.scene as any).journeyDirector?.progress.actualSpeedKmh || 60;
      this.spawnSite(data.siteId, (this.scene as any).allWorldItems || [], runTime, data.distanceM, speedKmh);
    });

    this.eventBus.on('ITEM_DELIVERED', (data: { item: ItemId; siteId?: string }) => {
      for (const site of this.activeSites) {
        if (!data.siteId || site.def.id === data.siteId) {
          site.recordGrab(data.item);
        }
      }
    });
  }

  public reset(): void {
    for (const site of this.activeSites) {
      site.destroy();
    }
    this.activeSites = [];
    this.spawnedSiteIds.clear();
  }

  public spawnSite(
    siteId: string,
    allWorldItems: WorldItem[],
    currentRunTimeSec: number,
    currentDistanceM: number,
    currentSpeedKmh: number,
    customSpawnX?: number
  ): SalvageSiteInstance | null {
    if (this.spawnedSiteIds.has(siteId) && customSpawnX === undefined) {
      return null;
    }
    this.spawnedSiteIds.add(siteId);

    // Spawn slightly past right edge of 1920 viewport so it rolls in smoothly
    const spawnX = customSpawnX ?? 2050;
    const site = SalvageSiteFactory.createSite(
      this.scene,
      siteId,
      spawnX,
      this.itemFactory,
      allWorldItems,
      currentRunTimeSec,
      currentDistanceM,
      currentSpeedKmh
    );

    if (site) {
      this.activeSites.push(site);
    }
    return site;
  }

  public update(
    dt: number,
    worldSpeed: number,
    speedMultiplier: number,
    currentRunTimeSec: number,
    currentDistanceM: number
  ): void {
    for (let i = this.activeSites.length - 1; i >= 0; i--) {
      const site = this.activeSites[i];
      site.update(dt, worldSpeed, speedMultiplier, currentRunTimeSec, currentDistanceM);

      if (site.isFinished) {
        this.activeSites.splice(i, 1);
      }
    }
  }

  public getActiveSite(): SalvageSiteInstance | null {
    return this.activeSites.length > 0 ? this.activeSites[0] : null;
  }
}
