import Phaser from 'phaser';
import { GrappleController } from './GrappleController';
import { TrainManager } from '../train/TrainManager';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { WorldItem } from '../items/WorldItem';
import { HookState } from '../core/Types';

export class Grapple {
  public controller: GrappleController;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    particles: ParticleManager,
    juice: JuiceManager
  ) {
    this.controller = new GrappleController(scene, trainManager, particles, juice);
  }

  public fire(targetX: number, targetY: number, items: WorldItem[]): boolean {
    return this.controller.fire(targetX, targetY, items);
  }

  public release(): void {
    this.controller.releaseCurrentTarget();
  }

  public update(delta: number, items: WorldItem[]): void {
    this.controller.update(delta, items);
  }

  public getState(): HookState {
    return this.controller.fsm.getState();
  }

  public getLatchedItem(): WorldItem | null {
    return this.controller.getLatchedItem();
  }

  public isHoldingOrReeling(): boolean {
    return this.controller.isHoldingOrReeling();
  }
}
