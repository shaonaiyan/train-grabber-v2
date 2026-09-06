import Phaser from 'phaser';
import { ItemData, ItemId, DepthBand } from '../core/Types';
import itemsData from '../data/items.json';
import { WorldItem } from './WorldItem';

export class ItemFactory {
  private scene: Phaser.Scene;
  private itemsMap: Map<ItemId, ItemData> = new Map();
  private seenItemTypes: Set<ItemId> = new Set();
  private instanceCounter: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const rawMap = (itemsData as any).items || (itemsData as any);
    for (const key in rawMap) {
      this.itemsMap.set(key as ItemId, rawMap[key]);
    }
  }

  public getItemData(id: ItemId): ItemData {
    const data = this.itemsMap.get(id);
    if (!data) {
      throw new Error(`Item ID not found: ${id}`);
    }
    return { ...data };
  }

  public spawnWorldItem(
    x: number,
    y: number,
    id: ItemId,
    depthBand: DepthBand,
    windowId: string = 'win_0',
    spawnPhaseId: number = 0,
    outcomeSeed: number = 0
  ): WorldItem {
    this.instanceCounter++;
    const baseData = this.getItemData(id);

    // Section 60-62: WorldItem metadata and Trade Line bonus detection
    const isTradeLine = spawnPhaseId === 3;
    const data: ItemData = {
      ...baseData,
      instanceId: `inst_${this.instanceCounter}_${id}`,
      windowId,
      spawnPhaseId,
      outcomeSeed,
      fromTradeLine: isTradeLine,
    };

    const isFirstTime = !this.seenItemTypes.has(id);
    if (isFirstTime) {
      this.seenItemTypes.add(id);
    }

    return new WorldItem(this.scene, x, y, data, depthBand, isFirstTime);
  }
}
