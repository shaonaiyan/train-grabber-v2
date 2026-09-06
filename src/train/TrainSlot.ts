import { SlotType, InstalledModule } from '../core/Types';

export class TrainSlot {
  public type: SlotType;
  public relativeX: number;
  public relativeY: number;
  public installedModule: InstalledModule | null = null;
  public container: Phaser.GameObjects.Container | null = null;

  constructor(type: SlotType, relativeX: number, relativeY: number) {
    this.type = type;
    this.relativeX = relativeX;
    this.relativeY = relativeY;
  }

  public isOccupied(): boolean {
    return this.installedModule !== null;
  }

  public install(module: InstalledModule, visualContainer: Phaser.GameObjects.Container): void {
    this.installedModule = module;
    this.container = visualContainer;
    this.container.setPosition(this.relativeX, this.relativeY);
  }

  public clear(): InstalledModule | null {
    const prev = this.installedModule;
    this.installedModule = null;
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    return prev;
  }
}
