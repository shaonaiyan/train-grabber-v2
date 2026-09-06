import { ItemId, WindowChoiceRecord } from '../core/Types';
import { WorldItem } from '../items/WorldItem';
import { TrainManager } from '../train/TrainManager';
import { EventBus } from '../core/EventBus';

export class OpportunityWindow {
  public windowId: string;
  public groupId: string;
  public groupName: string;
  public spawnTime: number;
  public duration: number;
  public itemsPresented: ItemId[];
  public activeWorldItems: WorldItem[] = [];

  private trainStateAtSpawn: WindowChoiceRecord['trainStateAtSpawn'];
  private itemsAttempted: Set<ItemId> = new Set();
  private itemsGrabbed: Set<ItemId> = new Set();
  private firstTargetAttempted: ItemId | null = null;
  private timeToFirstDecision: number | null = null;
  private isFinished: boolean = false;

  constructor(
    windowId: string,
    groupId: string,
    groupName: string,
    spawnTime: number,
    duration: number,
    items: ItemId[],
    trainManager: TrainManager
  ) {
    this.windowId = windowId;
    this.groupId = groupId;
    this.groupName = groupName;
    this.spawnTime = spawnTime;
    this.duration = duration;
    this.itemsPresented = [...items];

    const attachedMods = trainManager.getAllInstalledModules().map((m) => m.itemId);
    this.trainStateAtSpawn = {
      hp: trainManager.stats.hp,
      fuel: trainManager.stats.fuel,
      load: trainManager.load.getCurrentLoad(),
      maxLoad: trainManager.load.getMaxLoad(),
      powerSupply: trainManager.power.getSupply(),
      powerDemand: trainManager.power.getDemand(),
      cars: trainManager.getCarCount(),
      attachedItems: attachedMods,
    };

    EventBus.getInstance().emit('WINDOW_START', {
      windowId: this.windowId,
      groupId: this.groupId,
      groupName: this.groupName,
      items: this.itemsPresented,
      spawnTime: this.spawnTime,
      trainState: this.trainStateAtSpawn,
    });
  }

  public recordAttempt(itemId: ItemId, currentTime: number): void {
    if (!this.firstTargetAttempted) {
      this.firstTargetAttempted = itemId;
      this.timeToFirstDecision = currentTime - this.spawnTime;
    }
    this.itemsAttempted.add(itemId);
  }

  public recordGrab(itemId: ItemId): void {
    this.itemsGrabbed.add(itemId);
  }

  public update(currentTime: number): boolean {
    if (this.isFinished) return true;

    // Check if all items have either been destroyed/delivered/scrolled off
    const anyRemaining = this.activeWorldItems.some((item) => !item.isDestroyed && !item.isDelivered);
    const timeExpired = currentTime >= this.spawnTime + this.duration + 5.0; // Allow transit time

    if (!anyRemaining || timeExpired) {
      this.finishWindow(currentTime);
      return true;
    }
    return false;
  }

  public finishWindow(endTime: number): WindowChoiceRecord {
    this.isFinished = true;

    const itemsIgnored: ItemId[] = [];
    for (const item of this.itemsPresented) {
      if (!this.itemsGrabbed.has(item)) {
        itemsIgnored.push(item);
      }
    }

    const record: WindowChoiceRecord = {
      windowId: this.windowId,
      spawnTime: this.spawnTime,
      endTime,
      itemsPresented: this.itemsPresented,
      trainStateAtSpawn: this.trainStateAtSpawn,
      itemsAttempted: Array.from(this.itemsAttempted),
      itemsSuccessfullyGrabbed: Array.from(this.itemsGrabbed),
      itemsIgnored,
      firstTargetAttempted: this.firstTargetAttempted,
      timeToFirstDecision: this.timeToFirstDecision,
    };

    EventBus.getInstance().emit('WINDOW_END', { record });
    return record;
  }

  public isComplete(): boolean {
    return this.isFinished;
  }
}
