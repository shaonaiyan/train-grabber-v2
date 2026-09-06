import { OpportunityWindow } from './OpportunityWindow';
import { OpportunityConfigLoader } from './OpportunityData';
import { DepthManager } from '../world/DepthManager';
import { EventBus } from '../core/EventBus';
import phasesData from '../data/phases.json';
export class OpportunityDirector {
    scene;
    itemFactory;
    trainManager;
    rng;
    depthManager;
    eventBus;
    groups;
    activeWindows = [];
    completedRecords = [];
    nextWindowTimer = 2.5;
    windowCounter = 0;
    lastGroupId = '';
    spawnedFixedTimes = new Set();
    constructor(scene, itemFactory, trainManager, rng) {
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
        this.eventBus.on('GRAPPLE_HIT', (data) => {
            const activeWin = this.getActiveWindow();
            if (activeWin) {
                const time = this.scene.time.now * 0.001;
                activeWin.recordAttempt(data.item, time);
            }
        });
        this.eventBus.on('ITEM_DELIVERED', (data) => {
            const activeWin = this.getActiveWindow();
            if (activeWin) {
                activeWin.recordGrab(data.item);
            }
        });
    }
    update(time, delta, currentPhaseId, allWorldItems) {
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
    checkFixedWindows(currentTimeSec, currentPhaseId, allWorldItems) {
        const phaseConfig = phasesData.phases[currentPhaseId];
        if (!phaseConfig || !phaseConfig.fixedWindows)
            return;
        for (const fw of phaseConfig.fixedWindows) {
            if (currentTimeSec >= fw.time && !this.spawnedFixedTimes.has(fw.time)) {
                this.spawnedFixedTimes.add(fw.time);
                this.spawnWindowWithItems(`fixed_${fw.time}`, 'FIXED', 'Preset Window', fw.items, currentTimeSec, 3.8, allWorldItems);
            }
        }
    }
    spawnDynamicWindow(currentTimeSec, phaseId, allWorldItems) {
        const selectedGroup = this.selectGroupForContext(phaseId);
        const [dMin, dMax] = OpportunityConfigLoader.getWindowDurationRange();
        const duration = this.rng.range(dMin, dMax);
        this.windowCounter++;
        const windowId = `win_${this.windowCounter}_${selectedGroup.id}`;
        this.spawnWindowWithItems(windowId, selectedGroup.id, selectedGroup.name, selectedGroup.items, currentTimeSec, duration, allWorldItems);
        const [cdMin, cdMax] = OpportunityConfigLoader.getWindowCooldownRange();
        this.nextWindowTimer = duration + this.rng.range(cdMin, cdMax);
    }
    spawnWindowWithItems(windowId, groupId, groupName, itemIds, currentTimeSec, duration, allWorldItems) {
        const win = new OpportunityWindow(windowId, groupId, groupName, currentTimeSec, duration, itemIds, this.trainManager);
        // Layout items across different depths (Section 34)
        const bands = ['far', 'mid', 'near'];
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
    selectGroupForContext(phaseId) {
        const candidates = [];
        const isLowFuel = this.trainManager.stats.fuel < 35;
        const hasPowerShortage = this.trainManager.power.hasShortage();
        const isHeavy = this.trainManager.load.getLoadRatio() >= 0.85;
        for (const key in this.groups) {
            const g = this.groups[key];
            let weight = g.phaseWeight[phaseId.toString()] || 0;
            if (weight <= 0)
                continue;
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
    getActiveWindow() {
        return this.activeWindows.length > 0 ? this.activeWindows[0] : null;
    }
    getCompletedRecords() {
        return this.completedRecords;
    }
}
