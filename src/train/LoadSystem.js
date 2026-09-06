import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';
export class LoadSystem {
    baseMaxLoad = balanceData.train.baseMaxLoad;
    currentMaxLoad = balanceData.train.baseMaxLoad;
    currentLoad = 0;
    isHeavy = false;
    eventBus;
    constructor() {
        this.eventBus = EventBus.getInstance();
    }
    recalculate(installedLoadSum, flatCarCount) {
        this.currentMaxLoad = this.baseMaxLoad + flatCarCount * balanceData.train.flatCarMaxLoadBonus;
        this.currentLoad = installedLoadSum + flatCarCount * balanceData.train.flatCarInstallLoad;
        const hadHeavy = this.isHeavy;
        const ratio = this.getLoadRatio();
        this.isHeavy = ratio >= balanceData.loadTiers.tier2Threshold;
        if (!hadHeavy && this.isHeavy) {
            this.eventBus.emit('HEAVY_TRAIN_START', {
                load: this.currentLoad,
                maxLoad: this.currentMaxLoad,
                ratio,
            });
        }
        else if (hadHeavy && !this.isHeavy) {
            this.eventBus.emit('HEAVY_TRAIN_END', {
                load: this.currentLoad,
                maxLoad: this.currentMaxLoad,
                ratio,
            });
        }
    }
    getCurrentLoad() {
        return this.currentLoad;
    }
    getMaxLoad() {
        return this.currentMaxLoad;
    }
    getLoadRatio() {
        if (this.currentMaxLoad <= 0)
            return 1.0;
        return this.currentLoad / this.currentMaxLoad;
    }
    canFitLoad(additionalLoad) {
        return this.currentLoad + additionalLoad <= this.currentMaxLoad;
    }
    getSpeedMultiplier() {
        const r = this.getLoadRatio();
        if (r < balanceData.loadTiers.tier1Threshold) {
            return balanceData.loadTiers.tier1SpeedMultiplier;
        }
        else if (r < balanceData.loadTiers.tier2Threshold) {
            return balanceData.loadTiers.tier2SpeedMultiplier;
        }
        else {
            return balanceData.loadTiers.tier3SpeedMultiplier;
        }
    }
    getFuelMultiplier() {
        const r = this.getLoadRatio();
        if (r < balanceData.loadTiers.tier1Threshold) {
            return balanceData.loadTiers.tier1FuelMultiplier;
        }
        else if (r < balanceData.loadTiers.tier2Threshold) {
            return balanceData.loadTiers.tier2FuelMultiplier;
        }
        else {
            return balanceData.loadTiers.tier3FuelMultiplier;
        }
    }
}
