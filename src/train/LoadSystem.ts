import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';

export class LoadSystem {
  private baseMaxLoad: number = balanceData.train.baseMaxLoad;
  private currentMaxLoad: number = balanceData.train.baseMaxLoad;
  private currentLoad: number = 0;
  private isHeavy: boolean = false;
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public recalculate(installedLoadSum: number, flatCarCount: number): void {
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
    } else if (hadHeavy && !this.isHeavy) {
      this.eventBus.emit('HEAVY_TRAIN_END', {
        load: this.currentLoad,
        maxLoad: this.currentMaxLoad,
        ratio,
      });
    }
  }

  public getCurrentLoad(): number {
    return this.currentLoad;
  }

  public getMaxLoad(): number {
    return this.currentMaxLoad;
  }

  public getLoadRatio(): number {
    if (this.currentMaxLoad <= 0) return 1.0;
    return this.currentLoad / this.currentMaxLoad;
  }

  public canFitLoad(additionalLoad: number): boolean {
    return this.currentLoad + additionalLoad <= this.currentMaxLoad;
  }

  public getSpeedMultiplier(): number {
    const r = this.getLoadRatio();
    if (r < balanceData.loadTiers.tier1Threshold) {
      return balanceData.loadTiers.tier1SpeedMultiplier;
    } else if (r < balanceData.loadTiers.tier2Threshold) {
      return balanceData.loadTiers.tier2SpeedMultiplier;
    } else {
      return balanceData.loadTiers.tier3SpeedMultiplier;
    }
  }

  public getFuelMultiplier(): number {
    const r = this.getLoadRatio();
    if (r < balanceData.loadTiers.tier1Threshold) {
      return balanceData.loadTiers.tier1FuelMultiplier;
    } else if (r < balanceData.loadTiers.tier2Threshold) {
      return balanceData.loadTiers.tier2FuelMultiplier;
    } else {
      return balanceData.loadTiers.tier3FuelMultiplier;
    }
  }
}
