import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';
export class TrainStatsManager {
    hp;
    maxHp;
    fuel;
    maxFuel;
    outOfFuelTimer = 0;
    isOutOfFuel = false;
    eventBus;
    constructor() {
        this.eventBus = EventBus.getInstance();
        this.maxHp = balanceData.train.baseHp;
        this.hp = this.maxHp;
        this.maxFuel = balanceData.train.maxFuel;
        this.fuel = balanceData.train.baseFuel;
    }
    reset() {
        this.maxHp = balanceData.train.baseHp;
        this.hp = this.maxHp;
        this.maxFuel = balanceData.train.maxFuel;
        this.fuel = balanceData.train.baseFuel;
        this.outOfFuelTimer = 0;
        this.isOutOfFuel = false;
    }
    addHp(amount) {
        this.hp = Math.min(this.maxHp, Math.max(0, this.hp + amount));
    }
    takeDamage(amount, source = 'unknown') {
        this.hp = Math.max(0, this.hp - amount);
        this.eventBus.emit('TRAIN_DAMAGE', { amount, hpRemaining: this.hp, source });
        if (this.hp <= 0) {
            this.eventBus.emit('RUN_FAIL', { reason: 'FAIL_HP' });
            return true; // Dead
        }
        return false;
    }
    addFuel(amount) {
        this.fuel = Math.min(this.maxFuel, Math.max(0, this.fuel + amount));
        if (this.fuel > 0) {
            this.isOutOfFuel = false;
            this.outOfFuelTimer = 0;
        }
    }
    calculateFuelDrain(flatCarCount, survivorCount, loadFuelMultiplier, phaseFuelMultiplier) {
        const baseDrain = balanceData.train.baseFuelDrain;
        const flatCarDrain = flatCarCount * balanceData.train.flatCarFuelDrain;
        const survivorDrain = survivorCount * 0.008;
        return (baseDrain + flatCarDrain + survivorDrain) * loadFuelMultiplier * phaseFuelMultiplier;
    }
    update(deltaSeconds, drainRate) {
        if (this.fuel > 0) {
            this.fuel -= drainRate * deltaSeconds;
            if (this.fuel <= 0) {
                this.fuel = 0;
                this.isOutOfFuel = true;
                this.outOfFuelTimer = 0;
            }
        }
        else {
            this.isOutOfFuel = true;
            this.outOfFuelTimer += deltaSeconds;
            if (this.outOfFuelTimer >= balanceData.train.outOfFuelFailDuration) {
                this.eventBus.emit('RUN_FAIL', { reason: 'FAIL_FUEL' });
            }
        }
    }
}
