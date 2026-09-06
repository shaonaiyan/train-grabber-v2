import Phaser from 'phaser';
import { TrainCar, CarType } from './TrainCar';
import { TrainStatsManager } from './TrainStats';
import { PowerSystem } from './PowerSystem';
import { LoadSystem } from './LoadSystem';
import { CargoSystem } from './CargoSystem';
import { ItemData, ItemId, InstalledModule, CargoItem, SlotType, GameMode, getActiveGameMode } from '../core/Types';
import { EventBus } from '../core/EventBus';
import { ParticleManager } from '../fx/Particles';
import { AudioManager } from '../fx/AudioManager';
import balanceData from '../data/balance.json';

export class TrainManager {
  private scene: Phaser.Scene;
  public cars: TrainCar[] = [];
  public stats: TrainStatsManager;
  public power: PowerSystem;
  public load: LoadSystem;
  public cargo: CargoSystem;
  private eventBus: EventBus;
  private particles: ParticleManager;
  private audio: AudioManager;

  private rootX: number;
  private rootY: number;
  private flatCarCount: number = 0;
  private discardedCount: number = 0;
  private moduleCounter: number = 0;

  private tooltipText: Phaser.GameObjects.Text | null = null;
  private tooltipBg: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, particles: ParticleManager) {
    this.scene = scene;
    this.particles = particles;
    this.audio = AudioManager.getInstance();
    this.eventBus = EventBus.getInstance();

    this.stats = new TrainStatsManager();
    this.power = new PowerSystem();
    this.load = new LoadSystem();
    this.cargo = new CargoSystem();

    this.rootX = 650;
    this.rootY = balanceData.depth.trackY - 2;

    this.initTrain();
    this.createTooltipUI();
  }

  private initTrain(): void {
    // Tail <- Cargo (2) - Crane (1) - Locomotive (0) -> Front
    this.addCar('locomotive', 0);
    this.addCar('crane', 1);
    this.addCar('cargo', 2);
    this.repositionCars();
    this.recalculateAllStats();
  }

  private addCar(type: CarType, index: number): TrainCar {
    const car = new TrainCar(
      this.scene,
      type,
      index,
      (module) => this.discardModule(module),
      (module, screenX, screenY) => this.updateModuleTooltip(module, screenX, screenY),
      (instanceId) => this.discardCargo(instanceId),
      (cargo, screenX, screenY) => this.updateCargoTooltip(cargo, screenX, screenY)
    );
    this.cars.push(car);
    return car;
  }

  private repositionCars(): void {
    let currentX = this.rootX;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      car.baseCarX = currentX;
      car.baseCarY = this.rootY;
      car.container.setPosition(car.baseCarX, car.baseCarY);
      currentX -= car.width - 8; // overlap couplers
    }
  }

  public getCranePosition(): { x: number; y: number } {
    const craneCar = this.cars[1];
    return {
      x: craneCar.baseCarX,
      y: craneCar.baseCarY - 26,
    };
  }

  public attachFlatCar(itemData: ItemData): boolean {
    // Section 46 & 91: Max 2 flat cars in V3
    if (this.flatCarCount >= balanceData.train.maxFlatCars) {
      return false;
    }

    this.flatCarCount++;
    const newCarIndex = this.cars.length;
    const newCar = this.addCar('flat', newCarIndex);
    this.repositionCars();
    this.recalculateAllStats();

    newCar.dipOnInstall();
    this.particles.emitInstallBurst(newCar.baseCarX, newCar.baseCarY);
    this.audio.playInstall();

    this.eventBus.emit('CAR_ATTACHED', {
      carIndex: newCarIndex,
      totalCars: this.cars.length,
      flatCars: this.flatCarCount,
    });

    this.updateCameraFraming();
    return true;
  }

  private updateCameraFraming(): void {
    const cam = this.scene.cameras.main;
    let targetZoom = 1.0;
    if (this.cars.length >= 6) {
      targetZoom = 0.88;
    } else if (this.cars.length === 5) {
      targetZoom = 0.92;
    } else if (this.cars.length === 4) {
      targetZoom = 0.96;
    }

    this.scene.tweens.add({
      targets: cam,
      zoom: targetZoom,
      duration: 600,
      ease: 'Quad.easeInOut',
    });
  }

  public hasSlotFor(item: ItemData): boolean {
    if (item.type === 'Consumable') return true;

    // V4 Mode: Bypass Cargo Capacity limit completely (Sections 15-16)
    if (getActiveGameMode() === GameMode.CORE_SLICE_V4) {
      if (item.type === 'Cargo') return true;
      if (item.type === 'Car') return true;
      // Module can install or sit on deck
      return true;
    }

    if (item.type === 'Car') {
      return this.flatCarCount < balanceData.train.maxFlatCars;
    }

    if (item.type === 'Cargo') {
      const size = item.cargoSize ?? 1;
      return this.cargo.canAcceptCargo(size);
    }

    // Module (TOP or SIDE)
    const slotType = item.slot;
    if (!slotType) return false;

    for (const car of this.cars) {
      if (car.getAvailableSlot(slotType)) {
        return true;
      }
    }
    return false;
  }

  public canFitLoad(item: ItemData): boolean {
    if (item.type === 'Consumable') return true;

    // V4 Mode: Weight is soft, never hard reject (Section 23-24)
    if (getActiveGameMode() === GameMode.CORE_SLICE_V4) {
      return true;
    }

    // Section 20: Flat Car special calculation
    if (item.type === 'Car') {
      return this.load.canAcceptFlatCar();
    }

    const weight = item.installLoad || item.load || 0;
    return this.load.canAcceptLoad(weight);
  }

  public installItem(item: ItemData): boolean {
    if (item.type === 'Consumable') {
      if (item.hpBonus) {
        this.stats.addHp(item.hpBonus);
      }
      if (item.fuelBonus) {
        this.stats.addFuel(item.fuelBonus);
      }
      return true;
    }

    if (item.type === 'Car') {
      return this.attachFlatCar(item);
    }

    if (item.type === 'Cargo') {
      const cargoItem = this.cargo.addCargo(item);
      if (!cargoItem) return false;

      // Place visual inside car with lowest cargo count
      const eligibleCars = this.cars.filter((c) => c.type === 'cargo' || c.type === 'flat');
      if (eligibleCars.length > 0) {
        let bestCar = eligibleCars[0];
        for (const car of eligibleCars) {
          if (car.cargoVisuals.size < bestCar.cargoVisuals.size) {
            bestCar = car;
          }
        }
        cargoItem.carIndex = bestCar.carIndex;
        bestCar.addCargoVisual(cargoItem, bestCar.cargoVisuals.size);

        this.particles.emitInstallBurst(bestCar.baseCarX, bestCar.baseCarY - 10);
        this.audio.playInstall();
        this.recalculateAllStats();
        return true;
      }
      return false;
    }

    // Module (turret or battery)
    if (!item.slot) return false;
    for (const car of this.cars) {
      const slot = car.getAvailableSlot(item.slot);
      if (slot) {
        this.moduleCounter++;
        const module: InstalledModule = {
          uid: `mod_${this.moduleCounter}`,
          itemId: item.id,
          data: item,
          carIndex: car.carIndex,
          slotType: item.slot,
          installedTime: (this.scene as any).runTimeSec || 0,
          fromTradeLine: false,
          stateTimer: 0,
        };

        const success = car.installModule(module);
        if (success) {
          this.particles.emitInstallBurst(
            car.baseCarX + slot.relativeX,
            car.baseCarY + slot.relativeY
          );
          this.audio.playInstall();
          this.recalculateAllStats();
          return true;
        }
      }
    }

    return false;
  }

  public discardCargo(instanceId: string): void {
    const cargoItem = this.cargo.removeCargo(instanceId);
    if (!cargoItem) return;

    // Find car that rendered this cargo
    const car = this.cars.find((c) => c.carIndex === cargoItem.carIndex);
    if (car) {
      car.removeCargoVisual(instanceId);
    }

    this.discardedCount++;
    this.audio.playDiscard();

    const carX = car ? car.baseCarX : this.rootX - 100;
    const carY = car ? car.baseCarY : this.rootY;
    this.spawnDiscardedVisual(carX, carY - 15, cargoItem.itemId);

    // Section 41: Explosive discard detonation
    if (cargoItem.itemId === 'explosive') {
      this.eventBus.emit('ITEM_DISCARDED_EXPLOSIVE', {
        x: carX - 40,
        y: carY + 10,
      });
    }

    this.recalculateAllStats();

    this.eventBus.emit('ITEM_DISCARDED', {
      item: cargoItem.itemId,
      discardedItem: cargoItem.itemId,
      loadAfter: this.load.getCurrentLoad(),
      cargoAfter: this.getCargoValue(),
      time: (this.scene as any).runTimeSec || 0,
      reasonContext: {
        currentLoad: this.load.getCurrentLoad(),
        safeMaxLoad: this.load.getSafeMaxLoad(),
        fuel: this.stats.fuel,
      },
    });
  }

  public discardModule(module: InstalledModule): void {
    const car = this.cars[module.carIndex];
    if (!car) return;

    const removed = car.removeModule(module.uid);
    if (removed) {
      this.discardedCount++;
      this.audio.playDiscard();

      this.spawnDiscardedVisual(car.baseCarX, car.baseCarY - 15, module.itemId);
      this.recalculateAllStats();

      this.eventBus.emit('ITEM_DISCARDED', {
        item: module.itemId,
        discardedItem: module.itemId,
        loadAfter: this.load.getCurrentLoad(),
        cargoAfter: this.getCargoValue(),
        time: (this.scene as any).runTimeSec || 0,
        reasonContext: {
          currentLoad: this.load.getCurrentLoad(),
          safeMaxLoad: this.load.getSafeMaxLoad(),
          fuel: this.stats.fuel,
        },
      });
    }
  }

  private spawnDiscardedVisual(startX: number, startY: number, itemId: ItemId): void {
    const discardSprite = this.scene.add.container(startX, startY);
    discardSprite.setDepth(27);

    const g = this.scene.add.graphics();
    g.fillStyle(0x7f8c8d, 0.9);
    g.fillCircle(0, 0, 12);
    discardSprite.add(g);

    this.scene.tweens.add({
      targets: discardSprite,
      x: startX - 180,
      y: startY + 45,
      angle: 360,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: discardSprite,
          x: discardSprite.x - 300,
          alpha: 0,
          duration: 2200,
          ease: 'Linear',
          onComplete: () => {
            discardSprite.destroy();
          },
        });
      },
    });
  }

  public recalculateAllStats(): void {
    // 1. Cargo capacity
    this.cargo.recalculateCapacity(this.flatCarCount);

    // 2. Installed modules stats
    let moduleLoadSum = 0;
    let batteries = 0;
    let turrets = 0;

    for (const car of this.cars) {
      for (const slot of car.slots) {
        if (slot.installedModule) {
          const mod = slot.installedModule;
          moduleLoadSum += mod.data.load || 0;
          if (mod.itemId === 'battery') batteries++;
          if (mod.itemId === 'turret') turrets++;
        }
      }
    }

    // 3. Cargo physical load & overflow penalty
    const cargoPhysicalLoad = this.cargo.getTotalPhysicalLoad();
    const cargoOverflowLoad = this.cargo.getOverflowLoadPenalty();

    // 4. Update Power & Load systems
    this.power.recalculate(batteries, turrets);
    this.load.recalculate(moduleLoadSum + cargoPhysicalLoad, this.flatCarCount, cargoOverflowLoad);
  }

  public getCargoValue(): number {
    return this.cargo.getTotalCargoValue();
  }

  public getSurvivorCount(): number {
    return this.cargo.getCargoItems().filter((c) => c.itemId === 'survivor').length;
  }

  public getAllInstalledModules(): InstalledModule[] {
    const list: InstalledModule[] = [];
    for (const car of this.cars) {
      for (const slot of car.slots) {
        if (slot.installedModule) {
          list.push(slot.installedModule);
        }
      }
    }
    return list;
  }

  public getCarCount(): number {
    return this.cars.length;
  }

  public getFlatCarCount(): number {
    return this.flatCarCount;
  }

  public getDiscardedCount(): number {
    return this.discardedCount;
  }

  public getAvailableSlotCount(): Record<SlotType, number> {
    const counts: Record<SlotType, number> = { TOP: 0, SIDE: 0, BODY: 0, CRANE: 0 };
    for (const car of this.cars) {
      for (const slot of car.slots) {
        if (!slot.isOccupied()) {
          counts[slot.type]++;
        }
      }
    }
    return counts;
  }

  private createTooltipUI(): void {
    this.tooltipBg = this.scene.add.graphics();
    this.tooltipBg.setDepth(250);
    this.tooltipBg.setVisible(false);

    this.tooltipText = this.scene.add.text(0, 0, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
    });
    this.tooltipText.setDepth(251);
    this.tooltipText.setVisible(false);
  }

  private updateModuleTooltip(module: InstalledModule | null, screenX: number, screenY: number): void {
    if (!module || !this.tooltipBg || !this.tooltipText) {
      this.tooltipBg?.setVisible(false);
      this.tooltipText?.setVisible(false);
      return;
    }

    const lines = [
      module.data.name.toUpperCase(),
      `Slot: ${module.slotType} | Load: ${module.data.load || 0}`,
      '[Right-Click to Discard]',
    ];
    this.renderTooltipBox(lines, screenX, screenY);
  }

  private updateCargoTooltip(cargo: CargoItem | null, screenX: number, screenY: number): void {
    if (!cargo || !this.tooltipBg || !this.tooltipText) {
      this.tooltipBg?.setVisible(false);
      this.tooltipText?.setVisible(false);
      return;
    }

    const lines = [
      cargo.itemId.toUpperCase(),
      `Value: $${cargo.cargoValue} | Load: ${cargo.load} (Size ${cargo.cargoSize})`,
      '[Right-Click to Discard]',
    ];
    this.renderTooltipBox(lines, screenX, screenY);
  }

  private renderTooltipBox(lines: string[], screenX: number, screenY: number): void {
    const content = lines.join('\n');
    this.tooltipText!.setText(content);
    this.tooltipText!.setPosition(screenX - 75, screenY - 60);

    const bounds = this.tooltipText!.getBounds();
    this.tooltipBg!.clear();
    this.tooltipBg!.fillStyle(0x0a0d14, 0.92);
    this.tooltipBg!.fillRoundedRect(bounds.x - 8, bounds.y - 6, bounds.width + 16, bounds.height + 12, 6);
    this.tooltipBg!.lineStyle(1.5, 0x00ffcc, 0.8);
    this.tooltipBg!.strokeRoundedRect(bounds.x - 8, bounds.y - 6, bounds.width + 16, bounds.height + 12, 6);

    this.tooltipBg!.setVisible(true);
    this.tooltipText!.setVisible(true);
  }

  public addFlatCarV4(): boolean {
    this.flatCarCount++;
    const newCarIndex = this.cars.length;
    const newCar = this.addCar('flat', newCarIndex);
    this.repositionCars();
    this.load.safeMaxLoad += 20; // Safe weight +20 (Section 158)
    this.recalculateAllStats();

    newCar.dipOnInstall();
    this.particles.emitInstallBurst(newCar.baseCarX, newCar.baseCarY);
    this.updateCameraFraming();
    return true;
  }

  public nudgeTowards(targetX: number, targetY: number, amount: number = 6): void {
    const dx = targetX - this.rootX;
    const dir = Math.sign(dx) || 1;
    this.scene.tweens.add({
      targets: this.cars.map((c) => c.container),
      x: `+=${dir * amount}`,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  public triggerDeckWeightDip(amount: number = 6): void {
    this.scene.tweens.add({
      targets: this.cars.map((c) => c.container),
      y: `+=${amount}`,
      duration: 140,
      yoyo: true,
      ease: 'Bounce.easeOut',
    });
  }

  public wobbleDeckCargo(nearX: number, radius: number = 80): void {
    for (const car of this.cars) {
      for (const [instanceId, visual] of car.cargoVisuals.entries()) {
        const worldPos = car.container.x + visual.container.x;
        if (Math.abs(worldPos - nearX) <= radius) {
          this.scene.tweens.add({
            targets: visual.container,
            angle: { from: -15, to: 15 },
            duration: 80,
            yoyo: true,
            repeat: 3,
          });
        }
      }
    }
  }

  public temporarilyDisableTurretNear(x: number, radius: number = 100, durationSec: number = 1.5): boolean {
    for (const car of this.cars) {
      for (const slot of car.slots) {
        if (slot.installedModule && slot.installedModule.itemId === 'turret') {
          const turretWorldX = car.container.x + (slot.container ? slot.container.x : slot.relativeX);
          if (Math.abs(turretWorldX - x) <= radius) {
            slot.isStalled = true;
            this.scene.time.delayedCall(durationSec * 1000, () => {
              slot.isStalled = false;
            });
            return true;
          }
        }
      }
    }
    return false;
  }

  public getLeadCarPosition(): { x: number; y: number } {
    const lead = this.cars[0];
    return { x: lead ? lead.container.x + 80 : 700, y: lead ? lead.container.y : 710 };
  }

  public getClosestCarPosition(x: number, y: number): { x: number; y: number } {
    let closest = this.cars[0];
    let minDist = 99999;
    for (const car of this.cars) {
      const d = Math.abs(car.container.x - x);
      if (d < minDist) {
        minDist = d;
        closest = car;
      }
    }
    return { x: closest ? closest.container.x : 650, y: closest ? closest.container.y : 710 };
  }

  public getBatteryCount(): number {
    let count = 0;
    for (const car of this.cars) {
      for (const slot of car.slots) {
        if (slot.installedModule && slot.installedModule.itemId === 'battery') {
          count++;
        }
      }
    }
    return count;
  }

  public update(time: number, delta: number, worldSpeed: number): void {
    for (const car of this.cars) {
      car.update(time, delta, worldSpeed);
    }
  }
}
