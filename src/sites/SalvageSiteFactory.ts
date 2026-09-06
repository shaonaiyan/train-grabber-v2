import Phaser from 'phaser';
import { SalvageSiteDefinition } from '../core/Types';
import { SalvageSiteInstance } from './SalvageSiteInstance';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import siteData from '../data/salvage_sites_v3.json';

export class SalvageSiteFactory {
  private static sitesMap: Map<string, SalvageSiteDefinition> = new Map();

  private static initSites(): void {
    if (this.sitesMap.size === 0) {
      for (const site of (siteData as any).sites) {
        this.sitesMap.set(site.id, site);
      }
    }
  }

  public static getDefinition(id: string): SalvageSiteDefinition | undefined {
    this.initSites();
    return this.sitesMap.get(id);
  }

  public static getAllDefinitions(): SalvageSiteDefinition[] {
    this.initSites();
    return Array.from(this.sitesMap.values());
  }

  public static createSite(
    scene: Phaser.Scene,
    id: string,
    startScreenX: number,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[],
    currentRunTimeSec: number,
    currentDistanceM: number,
    currentSpeedKmh: number
  ): SalvageSiteInstance | null {
    const def = this.getDefinition(id);
    if (!def) {
      console.warn(`SalvageSiteFactory: Site definition "${id}" not found.`);
      return null;
    }

    return new SalvageSiteInstance(
      scene,
      def,
      startScreenX,
      itemFactory,
      allWorldItems,
      currentRunTimeSec,
      currentDistanceM,
      currentSpeedKmh
    );
  }
}
