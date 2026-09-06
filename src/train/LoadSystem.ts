import { EventBus } from '../core/EventBus';
import { LoadTier } from '../core/Types';
import balanceData from '../data/balance.json';

export class LoadSystem {
  public baseSafeMaxLoad: number = balanceData.train.baseMaxLoad; // 48
  public safeMaxLoad: number = balanceData.train.baseMaxLoad;
  public physicalLoad: number = 0;
  public effectiveLoad: number = 0;
  public cargoOverflowLoad: number = 0;

  private currentTier: LoadTier = 'NORMAL';
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public recalculate(
    installedLoadSum: number,
    flatCarCount: number,
    cargoOverflowLoad: number = 0
  ): void {
    // Safe Max Load increases by +22 per Flat Car
    this.safeMaxLoad = this.baseSafeMaxLoad + flatCarCount * balanceData.train.flatCarMaxLoadBonus;

    // Physical load includes installed modules, cargo, and flat car weights
    this.physicalLoad = installedLoadSum + flatCarCount * balanceData.train.flatCarInstallLoad;
    this.cargoOverflowLoad = cargoOverflowLoad;

    // Section 32: effectiveLoad = physicalLoad + cargoOverflow * 5
    this.effectiveLoad = this.physicalLoad + this.cargoOverflowLoad;

    const prevTier = this.currentTier;
    this.currentTier = this.getTier();

    if (prevTier !== this.currentTier) {
      this.eventBus.emit('LOAD_TIER_CHANGED', {
        prevTier,
        tier: this.currentTier,
        ratio: this.getLoadRatio(),
        effectiveLoad: this.effectiveLoad,
        safeMaxLoad: this.safeMaxLoad,
      });

      if (this.currentTier === 'OVERLOAD' || this.currentTier === 'DANGER') {
        this.eventBus.emit('HEAVY_TRAIN_START', {
          load: this.effectiveLoad,
          maxLoad: this.safeMaxLoad,
          ratio: this.getLoadRatio(),
        });
      } else if (prevTier === 'OVERLOAD' || prevTier === 'DANGER') {
        this.eventBus.emit('HEAVY_TRAIN_END', {
          load: this.effectiveLoad,
          maxLoad: this.safeMaxLoad,
          ratio: this.getLoadRatio(),
        });
      }
    }
  }

  public getLoadRatio(): number {
    if (this.safeMaxLoad <= 0) return 1.0;
    return this.effectiveLoad / this.safeMaxLoad;
  }

  public getTier(): LoadTier {
    const r = this.getLoadRatio();
    if (r <= 0.70) return 'NORMAL';
    if (r <= 1.00) return 'HEAVY';
    if (r <= 1.15) return 'OVERLOAD';
    if (r <= 1.30) return 'DANGER';
    return 'HARD_LIMIT';
  }

  // Section 19: Only reject when projectedLoad / safeMaxLoad > 1.30
  public canAcceptLoad(additionalLoad: number): boolean {
    const projected = this.effectiveLoad + additionalLoad;
    return projected / this.safeMaxLoad <= 1.30;
  }

  // Section 20: Flat Car capacity calculation
  public canAcceptFlatCar(): boolean {
    const projectedSafeMax = this.safeMaxLoad + balanceData.train.flatCarMaxLoadBonus;
    const projectedLoad = this.effectiveLoad + balanceData.train.flatCarInstallLoad;
    return projectedLoad / projectedSafeMax <= 1.30;
  }

  // Legacy compatibility
  public canFitLoad(additionalLoad: number): boolean {
    return this.canAcceptLoad(additionalLoad);
  }

  public getCurrentLoad(): number {
    return this.effectiveLoad;
  }

  public getMaxLoad(): number {
    return this.safeMaxLoad;
  }

  public getSafeMaxLoad(): number {
    return this.safeMaxLoad;
  }

  // Section 16: Speed Multiplier Exact Formula
  public getSpeedMultiplier(): number {
    const r = this.getLoadRatio();
    if (r <= 0.70) {
      return 1.00;
    } else if (r <= 1.00) {
      // 0.70 ~ 1.00: Linear 1.00 -> 0.88
      const t = (r - 0.70) / (1.00 - 0.70);
      return 1.00 - t * (1.00 - 0.88);
    } else if (r <= 1.15) {
      // 1.00 ~ 1.15: Linear 0.88 -> 0.75
      const t = (r - 1.00) / (1.15 - 1.00);
      return 0.88 - t * (0.88 - 0.75);
    } else if (r <= 1.30) {
      // 1.15 ~ 1.30: Linear 0.75 -> 0.62
      const t = (r - 1.15) / (1.30 - 1.15);
      return 0.75 - t * (0.75 - 0.62);
    } else {
      return 0.62;
    }
  }

  // Section 17: Fuel Multiplier Exact Formula
  public getFuelMultiplier(): number {
    const r = this.getLoadRatio();
    if (r <= 0.70) {
      return 1.00;
    } else if (r <= 1.00) {
      // 0.70 ~ 1.00: Linear 1.00 -> 1.18
      const t = (r - 0.70) / (1.00 - 0.70);
      return 1.00 + t * (1.18 - 1.00);
    } else if (r <= 1.15) {
      // 1.00 ~ 1.15: Linear 1.18 -> 1.45
      const t = (r - 1.00) / (1.15 - 1.00);
      return 1.18 + t * (1.45 - 1.18);
    } else if (r <= 1.30) {
      // 1.15 ~ 1.30: Linear 1.45 -> 1.80
      const t = (r - 1.15) / (1.30 - 1.15);
      return 1.45 + t * (1.80 - 1.45);
    } else {
      return 1.80;
    }
  }
}
