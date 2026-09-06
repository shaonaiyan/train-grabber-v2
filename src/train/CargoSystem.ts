import { ItemId, ItemData, CargoItem } from '../core/Types';
import balanceData from '../data/balance.json';

export class CargoSystem {
  public cargoCapacity: number = balanceData.cargo.baseCapacity; // 6
  public cargoUsed: number = 0;
  private cargoItems: CargoItem[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cargoCapacity = balanceData.cargo.baseCapacity;
    this.cargoUsed = 0;
    this.cargoItems = [];
  }

  public recalculateCapacity(flatCarCount: number): void {
    const bonusPerFlatCar = balanceData.cargo.flatCarCapacityBonus; // 5
    this.cargoCapacity = balanceData.cargo.baseCapacity + flatCarCount * bonusPerFlatCar;
  }

  public canAcceptCargo(size: number): boolean {
    // Section 31-33: Allow cargoUsed <= cargoCapacity + 2 (Max 2 overstack units)
    const maxAllowed = this.cargoCapacity + balanceData.cargo.maxOverstackUnits;
    return this.cargoUsed + size <= maxAllowed;
  }

  public addCargo(itemData: ItemData, preferredCarIndex?: number): CargoItem | null {
    const size = itemData.cargoSize ?? 1;
    if (!this.canAcceptCargo(size)) {
      return null;
    }

    const instanceId = itemData.instanceId || `cargo_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const carIdx = preferredCarIndex ?? 2; // Default to car 2 (first cargo car)
    const anchorIdx = this.cargoItems.length;

    const cargoItem: CargoItem = {
      instanceId,
      itemId: itemData.id,
      cargoSize: size,
      load: itemData.load ?? 5,
      cargoValue: itemData.cargoValue ?? 0,
      carIndex: carIdx,
      anchorIndex: anchorIdx,
      installedTime: Date.now(),
      customData: {},
    };

    this.cargoItems.push(cargoItem);
    this.cargoUsed += size;
    return cargoItem;
  }

  public removeCargo(instanceId: string): CargoItem | null {
    const idx = this.cargoItems.findIndex((c) => c.instanceId === instanceId);
    if (idx === -1) return null;

    const removed = this.cargoItems.splice(idx, 1)[0];
    this.cargoUsed = Math.max(0, this.cargoUsed - removed.cargoSize);
    return removed;
  }

  public removeCargoByIndex(index: number): CargoItem | null {
    if (index < 0 || index >= this.cargoItems.length) return null;
    const removed = this.cargoItems.splice(index, 1)[0];
    this.cargoUsed = Math.max(0, this.cargoUsed - removed.cargoSize);
    return removed;
  }

  public getCargoOverflow(): number {
    // Section 32: Extra units beyond comfortable cargoCapacity
    return Math.max(0, this.cargoUsed - this.cargoCapacity);
  }

  public getOverflowLoadPenalty(): number {
    // Section 32: Each overflow unit adds +5 effective load
    const multiplier = balanceData.cargo.overflowLoadMultiplier; // 5
    return this.getCargoOverflow() * multiplier;
  }

  public getTotalPhysicalLoad(): number {
    return this.cargoItems.reduce((acc, c) => acc + c.load, 0);
  }

  public getTotalCargoValue(): number {
    return this.cargoItems.reduce((acc, c) => acc + c.cargoValue, 0);
  }

  public getCargoItems(): CargoItem[] {
    return [...this.cargoItems];
  }

  public getCargoCount(): number {
    return this.cargoItems.length;
  }

  public isOverstacked(): boolean {
    return this.cargoUsed > this.cargoCapacity;
  }
}
