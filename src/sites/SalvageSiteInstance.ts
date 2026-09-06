import Phaser from 'phaser';
import { SalvageSiteDefinition, SiteRecord, ItemId } from '../core/Types';
import { WorldItem } from '../items/WorldItem';
import { ItemFactory } from '../items/ItemFactory';
import { SalvageSiteVisuals } from './SalvageSiteVisuals';
import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';

export class SalvageSiteInstance {
  public scene: Phaser.Scene;
  public def: SalvageSiteDefinition;
  public siteAnchorX: number;
  public isFinished: boolean = false;
  public hasEnteredScreen: boolean = false;

  public props: Phaser.GameObjects.Container[] = [];
  public lootEntries: Array<{
    item: WorldItem;
    offsetX: number;
    isLatchedOrGrabbed: boolean;
  }> = [];

  // Telemetry Record
  public record: SiteRecord;
  private eventBus: EventBus;

  constructor(
    scene: Phaser.Scene,
    def: SalvageSiteDefinition,
    startScreenX: number,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[],
    currentRunTimeSec: number,
    currentDistanceM: number,
    currentSpeedKmh: number
  ) {
    this.scene = scene;
    this.def = def;
    this.siteAnchorX = startScreenX;
    this.eventBus = EventBus.getInstance();

    this.record = {
      siteId: def.id,
      displayName: def.displayName,
      triggerDistanceM: def.triggerDistanceM,
      enterTime: currentRunTimeSec,
      enterDistanceM: currentDistanceM,
      enterSpeedKmh: currentSpeedKmh,
      itemsPresented: def.loot.map((l) => l.item),
      itemsAttempted: [],
      itemsGrabbed: [],
      itemsMissed: [],
      itemsIgnored: [],
    };

    // 1. Build Props
    for (const propDef of def.props) {
      const propCont = SalvageSiteVisuals.createProp(
        scene,
        propDef.type,
        this.siteAnchorX + propDef.offsetX,
        propDef.band
      );
      this.props.push(propCont);
    }

    // 2. Spawn Loot attached to Site
    for (const lootDef of def.loot) {
      const spawnX = this.siteAnchorX + lootDef.offsetX;
      const worldItem = itemFactory.spawnWorldItem(
        spawnX,
        0, // Y will be aligned to depth band
        lootDef.item,
        lootDef.band
      );
      worldItem.siteId = def.id;

      this.lootEntries.push({
        item: worldItem,
        offsetX: lootDef.offsetX,
        isLatchedOrGrabbed: false,
      });

      allWorldItems.push(worldItem);
    }
  }

  public update(
    dt: number,
    worldSpeed: number,
    speedMultiplier: number,
    currentRunTimeSec: number,
    currentDistanceM: number
  ): void {
    if (this.isFinished) return;

    // Section 62: Visual Local Scroll Multiplier clamp(speedMultiplier, 0.75, 1.05)
    const localScrollMultiplier = Phaser.Math.Clamp(
      speedMultiplier,
      balanceData.journey.localScrollMinMultiplier,
      balanceData.journey.localScrollMaxMultiplier
    );
    const scrollDelta = worldSpeed * localScrollMultiplier * dt;

    this.siteAnchorX -= scrollDelta;

    // Check on-screen enter
    if (!this.hasEnteredScreen && this.siteAnchorX <= 1920 + 50) {
      this.hasEnteredScreen = true;
      this.record.enterTime = currentRunTimeSec;
      this.record.enterDistanceM = currentDistanceM;
      this.eventBus.emit('SITE_ENTER', {
        siteId: this.def.id,
        displayName: this.def.displayName,
        distanceM: currentDistanceM,
      });
    }

    // Update Prop positions
    for (let i = 0; i < this.props.length; i++) {
      const propCont = this.props[i];
      const propDef = this.def.props[i];
      propCont.x = this.siteAnchorX + propDef.offsetX;
    }

    // Update Loot positions while unlatched
    for (const entry of this.lootEntries) {
      if (!entry.isLatchedOrGrabbed) {
        if (entry.item.isLatched) {
          entry.isLatchedOrGrabbed = true;
          if (!this.record.itemsAttempted.includes(entry.item.data.id)) {
            this.record.itemsAttempted.push(entry.item.data.id);
          }
        } else if (!entry.item.isDestroyed) {
          // Keep loot strictly anchored to Site coordinates
          entry.item.container.x = this.siteAnchorX + entry.offsetX;
        }
      }
    }

    // Check Site Completion / Offscreen Cleanup
    const siteRearX = this.siteAnchorX + this.def.lengthPx;
    const allLootResolved = this.lootEntries.every(
      (e) => e.item.isDestroyed || e.isLatchedOrGrabbed || e.item.container.x < -100
    );

    if (siteRearX < -150 && allLootResolved) {
      this.finish(currentRunTimeSec, currentDistanceM);
    }
  }

  public recordGrab(itemId: ItemId): void {
    if (!this.record.itemsGrabbed.includes(itemId)) {
      this.record.itemsGrabbed.push(itemId);
    }
  }

  private finish(currentRunTimeSec: number, currentDistanceM: number): void {
    if (this.isFinished) return;
    this.isFinished = true;

    this.record.exitTime = currentRunTimeSec;
    this.record.exitDistanceM = currentDistanceM;
    this.record.timeInSite = parseFloat((this.record.exitTime - this.record.enterTime).toFixed(1));

    // Calculate missed & ignored
    for (const presented of this.record.itemsPresented) {
      if (!this.record.itemsGrabbed.includes(presented)) {
        if (this.record.itemsAttempted.includes(presented)) {
          this.record.itemsMissed.push(presented);
        } else {
          this.record.itemsIgnored.push(presented);
        }
      }
    }

    this.record.captureRate =
      this.record.itemsPresented.length > 0
        ? parseFloat((this.record.itemsGrabbed.length / this.record.itemsPresented.length).toFixed(2))
        : 0;

    this.eventBus.emit('SITE_EXIT', { record: this.record });

    // Clean up props
    for (const prop of this.props) {
      prop.destroy();
    }
    this.props = [];
  }

  public destroy(): void {
    for (const prop of this.props) {
      prop.destroy();
    }
    this.props = [];
    this.isFinished = true;
  }
}
