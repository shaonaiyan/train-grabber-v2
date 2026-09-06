import { EventBus } from '../core/EventBus';
import balanceData from '../data/balance.json';

export class PowerSystem {
  private baseSupply: number = balanceData.train.basePowerSupply;
  private currentSupply: number = balanceData.train.basePowerSupply;
  private currentDemand: number = 0;
  private isShortage: boolean = false;
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public recalculate(batteriesCount: number, turretsCount: number): void {
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
    } else if (hadShortage && !this.isShortage) {
      this.eventBus.emit('POWER_SHORTAGE_END', {
        supply: this.currentSupply,
        demand: this.currentDemand,
      });
    }
  }

  public getSupply(): number {
    return this.currentSupply;
  }

  public getDemand(): number {
    return this.currentDemand;
  }

  public getPowerRatio(): number {
    if (this.currentDemand <= 0) return 1.0;
    return this.currentSupply / this.currentDemand;
  }

  public getEfficiency(): number {
    if (this.currentDemand <= this.currentSupply) {
      return 1.0;
    }
    const ratio = this.getPowerRatio();
    return Math.max(balanceData.power.minEfficiency, ratio);
  }

  public hasShortage(): boolean {
    return this.isShortage;
  }
}
