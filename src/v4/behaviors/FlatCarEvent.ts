import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export class FlatCarEvent implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'flat_car_v4';
  public name: string = 'Rusty Flatbed Car';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public carGraphics: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 24; // Heaviest hook target
  public installedWeight: number = 8;
  public lootValue: number = 100;

  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number = 690, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `flatcar_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.45);
    this.shadow.fillEllipse(0, 0, 150, 20);
    this.shadow.setPosition(x, y + 25);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(33);

    this.carGraphics = scene.add.graphics();
    this.drawVisuals();
    this.container.add(this.carGraphics);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(): void {
    const g = this.carGraphics;
    g.clear();

    // Two 4-wheel bogies (left and right)
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(-45, 16, 9);
    g.fillCircle(-25, 16, 9);
    g.fillCircle(25, 16, 9);
    g.fillCircle(45, 16, 9);
    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(-45, 16, 3);
    g.fillCircle(-25, 16, 3);
    g.fillCircle(25, 16, 3);
    g.fillCircle(45, 16, 3);

    // Heavy dark steel chassis beam
    g.fillStyle(0x34495e, 1);
    g.fillRect(-65, 4, 130, 8);

    // Rusty wooden flatbed deck
    g.fillStyle(0x6e4726, 1);
    g.fillRect(-65, -8, 130, 12);
    g.lineStyle(2, 0x3d2714, 1);
    g.strokeRect(-65, -8, 130, 12);

    // Deck plank lines
    for (let i = -50; i < 60; i += 18) {
      g.lineBetween(i, -8, i, 4);
    }

    // Heavy knuckle couplers on both ends
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(-72, 0, 8, 8);
    g.fillRect(64, 0, 8, 8);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDelivered && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.audio.playHookHit();
    this.audio.playTrainStrain();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.hitStop(70);
      (this.scene as any).juice.screenShake(6, 150);
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 35,
        'HOOKED FLATBED CAR!!',
        '#00ffcc',
        '22px'
      );
    }

    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    this.setPosition(ctx.hookX, ctx.hookY);
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    this.vx = ctx.hookVx ?? -120;
    this.vy = 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.audio.playCouplerSlam();

    // Attach real car to train!
    if (trainManager) {
      trainManager.addFlatCarV4();
    }

    if ((this.scene as any).juice) {
      (this.scene as any).juice.screenShake(9, 280);
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 45,
        'CAR COUPLED! +20 SAFE WEIGHT!',
        '#00ffcc',
        '26px'
      );
    }

    this.telemetry.recordConsequence('FLAT_CAR_COUPLED');
    this.telemetry.onHookDelivered(this.typeId);
    this.destroy();
  }

  public onImpact(ctx: ImpactContext): void {
    this.audio.playCouplerSlam();
  }

  public getHookWeight(): number {
    return this.hookWeight;
  }
  public getInstalledWeight(): number {
    return this.installedWeight;
  }
  public getLootValue(): number {
    return this.lootValue;
  }

  public getTags(): EntityTag[] {
    return ['METAL', 'HEAVY', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 25);
  }

  public isLatched(): boolean {
    return this._isLatched;
  }
  public isDelivered(): boolean {
    return this._isDelivered;
  }
  public isDestroyed(): boolean {
    return this._isDestroyed;
  }

  public update(dt: number, worldSpeed: number): void {
    if (this._isDestroyed) return;

    if (!this._isLatched && !this._isDelivered) {
      // Moves with side rail
      this.container.x += (this.vx - worldSpeed) * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 25);

      if (this.container.x < -200) {
        this.destroy();
        this.telemetry.recordMissed(this.typeId);
      }
    }
  }

  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    V4ObjectRegistry.getInstance().unregister(this.instanceId);
    if (this.shadow) this.shadow.destroy();
    if (this.container) this.container.destroy();
  }
}
