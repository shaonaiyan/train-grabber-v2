import { EventBus } from '../core/EventBus';
export class OpportunityWindow {
    windowId;
    groupId;
    groupName;
    spawnTime;
    duration;
    itemsPresented;
    activeWorldItems = [];
    trainStateAtSpawn;
    itemsAttempted = new Set();
    itemsGrabbed = new Set();
    firstTargetAttempted = null;
    timeToFirstDecision = null;
    isFinished = false;
    constructor(windowId, groupId, groupName, spawnTime, duration, items, trainManager) {
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
    recordAttempt(itemId, currentTime) {
        if (!this.firstTargetAttempted) {
            this.firstTargetAttempted = itemId;
            this.timeToFirstDecision = currentTime - this.spawnTime;
        }
        this.itemsAttempted.add(itemId);
    }
    recordGrab(itemId) {
        this.itemsGrabbed.add(itemId);
    }
    update(currentTime) {
        if (this.isFinished)
            return true;
        // Check if all items have either been destroyed/delivered/scrolled off
        const anyRemaining = this.activeWorldItems.some((item) => !item.isDestroyed && !item.isDelivered);
        const timeExpired = currentTime >= this.spawnTime + this.duration + 5.0; // Allow transit time
        if (!anyRemaining || timeExpired) {
            this.finishWindow(currentTime);
            return true;
        }
        return false;
    }
    finishWindow(endTime) {
        this.isFinished = true;
        const itemsIgnored = [];
        for (const item of this.itemsPresented) {
            if (!this.itemsGrabbed.has(item)) {
                itemsIgnored.push(item);
            }
        }
        const record = {
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
    isComplete() {
        return this.isFinished;
    }
}
