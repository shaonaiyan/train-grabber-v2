import { ItemId, WindowChoiceRecord } from '../core/Types';
import { WorldItem } from '../items/WorldItem';
import { TrainManager } from '../train/TrainManager';
import { EventBus } from '../core/EventBus';

export class OpportunityWindow {
  public windowId: string;
  public groupId: string;
  public groupName: string;
  public spawnTime: number;
  public decisionStartTime: number = 0;
  public duration: number;
  public itemsPresented: ItemId[];
  public activeWorldItems: WorldItem[] = [];

  private trainManager: TrainManager;
  private trainStateAtSpawn!: WindowChoiceRecord['trainStateAtSpawn'];
  private itemsAttempted: Set<ItemId> = new Set();
  private itemsGrabbed: Set<ItemId> = new Set();
  private firstTargetAttempted: ItemId | null = null;
  private timeToFirstDecision: number | null = null;
  private hasStarted: boolean = false;
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
    this.trainManager = trainManager;
  }

  public checkInteractionEnter(interactionEnterX: number, runTimeSec: number): void {
    if (this.hasStarted) return;

    // Section 21: WINDOW_START triggered only when first item enters Interaction Zone!
    const entered = this.activeWorldItems.some((item) => !item.isDestroyed && item.container.x <= interactionEnterX);
    if (entered) {
      this.hasStarted = true;
      this.decisionStartTime = runTimeSec;

      const attachedMods = this.trainManager.getAllInstalledModules().map((m) => m.itemId);
      this.trainStateAtSpawn = {
        hp: this.trainManager.stats.hp,
        fuel: this.trainManager.stats.fuel,
        load: this.trainManager.load.getCurrentLoad(),
        maxLoad: this.trainManager.load.getMaxLoad(),
        powerSupply: this.trainManager.power.getSupply(),
        powerDemand: this.trainManager.power.getDemand(),
        cars: this.trainManager.getCarCount(),
        attachedItems: attachedMods,
      };

      EventBus.getInstance().emit('WINDOW_START', {
        windowId: this.windowId,
        groupId: this.groupId,
        groupName: this.groupName,
        items: this.itemsPresented,
        spawnTime: this.spawnTime,
        decisionStartTime: this.decisionStartTime,
        trainState: this.trainStateAtSpawn,
      });
    }
  }

  public recordAttempt(itemId: ItemId, currentTime: number): void {
    if (!this.firstTargetAttempted) {
      this.firstTargetAttempted = itemId;
      this.timeToFirstDecision = currentTime - (this.decisionStartTime || this.spawnTime);
    }
    this.itemsAttempted.add(itemId);
  }

  public recordGrab(itemId: ItemId): void {
    this.itemsGrabbed.add(itemId);
  }

  public update(runTimeSec: number, interactionEnterX: number, interactionExitX: number): boolean {
    if (this.isFinished) return true;

    this.checkInteractionEnter(interactionEnterX, runTimeSec);
    if (!this.hasStarted) return false;

    // Section 22: Window End when all items in group are grabbed, destroyed, or passed ExitX
    const activeRemaining = this.activeWorldItems.some(
      (item) => !item.isDestroyed && !item.isDelivered && item.container.x >= interactionExitX
    );

    if (!activeRemaining) {
      return true; // Complete, Director will call finishWindow
    }
    return false;
  }

  public finishWindow(endTime: number): WindowChoiceRecord {
    if (this.isFinished) {
      throw new Error(`Window ${this.windowId} already finished`);
    }
    this.isFinished = true;

    const itemsIgnored: ItemId[] = [];
    for (const item of this.itemsPresented) {
      if (!this.itemsGrabbed.has(item)) {
        itemsIgnored.push(item);
      }
    }

    const record: WindowChoiceRecord = {
      windowId: this.windowId,
      groupId: this.groupId,
      spawnTime: this.spawnTime,
      decisionStartTime: this.decisionStartTime || this.spawnTime,
      decisionEndTime: endTime,
      endTime,
      itemsPresented: this.itemsPresented,
      trainStateAtSpawn: this.trainStateAtSpawn || {
        hp: 100,
        fuel: 70,
        load: 0,
        maxLoad: 48,
        powerSupply: 2,
        powerDemand: 0,
        cars: 3,
        attachedItems: [],
      },
      itemsAttempted: Array.from(this.itemsAttempted),
      itemsSuccessfullyGrabbed: Array.from(this.itemsGrabbed),
      itemsIgnored,
      firstTargetAttempted: this.firstTargetAttempted,
      timeToFirstDecision: this.timeToFirstDecision,
    };

    // Section 23: Emitted exactly once
    EventBus.getInstance().emit('WINDOW_END', { record });
    return record;
  }

  public isComplete(): boolean {
    return this.isFinished;
  }
}
