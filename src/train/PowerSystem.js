import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';
export class PowerSystem {
    baseSupply = balanceData.train.basePowerSupply;
    currentSupply = balanceData.train.basePowerSupply;
    currentDemand = 0;
    isShortage = false;
    eventBus;
    constructor() {
        this.eventBus = EventBus.getInstance();
    }
    recalculate(batteriesCount, turretsCount) {
        this.currentSupply = this.baseSupply + batteriesCount * 3;
        this.currentDemand = turretsCount * 2;
        const hadShortage = this.isShortage;
        this.isShortage = this.currentDemand > this.currentSupply;
        if (!hadShortage && this.isShortage) {
            this.eventBus.emit('POWER_SHORTAGE_START', {
                supply: this.currentSupply,
                demand: this.currentDemand,
                ratio: this.getPowerRatio(),
            });
        }
        else if (hadShortage && !this.isShortage) {
            this.eventBus.emit('POWER_SHORTAGE_END', {
                supply: this.currentSupply,
                demand: this.currentDemand,
            });
        }
    }
    getSupply() {
        return this.currentSupply;
    }
    getDemand() {
        return this.currentDemand;
    }
    getPowerRatio() {
        if (this.currentDemand <= 0)
            return 1.0;
        return this.currentSupply / this.currentDemand;
    }
    getEfficiency() {
        if (this.currentDemand <= this.currentSupply) {
            return 1.0;
        }
        const ratio = this.getPowerRatio();
        return Math.max(balanceData.power.minEfficiency, ratio);
    }
    hasShortage() {
        return this.isShortage;
    }
}
