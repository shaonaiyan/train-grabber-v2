import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export type SheepState = 'IDLE' | 'WANDER' | 'LOOK' | 'PANIC' | 'BUMP';

export class SheepBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'sheep_v4';
  public name: string = 'Wasteland Sheep';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public sheepGraphics: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 4;
  public installedWeight: number = 4;
  public lootValue: number = 80;

  // Deck wandering FSM
  public state: SheepState = 'IDLE';
  private stateTimer: number = 0;
  private deckMinX: number = -60;
  private deckMaxX: number = 60;
  private localX: number = 0;
  private wanderSpeed: number = 25;
  private facing: number = 1;

  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `sheep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.4);
    this.shadow.fillEllipse(0, 0, 36, 12);
    this.shadow.setPosition(x, y + 16);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(36);

    this.sheepGraphics = scene.add.graphics();
    this.drawVisuals();
    this.container.add(this.sheepGraphics);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(isPanicking: boolean = false): void {
    const g = this.sheepGraphics;
    g.clear();

    // 4 short black legs
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(-12, 6, 4, 10);
    g.fillRect(-4, 6, 4, 10);
    g.fillRect(4, 6, 4, 10);
    g.fillRect(10, 6, 4, 10);

    // Fluffy cloud-like wool body (off-white / cream)
    g.fillStyle(0xecf0f1, 1);
    g.lineStyle(2, 0x2c3e50, 1);

    g.fillCircle(-8, -4, 11);
    g.fillCircle(4, -5, 12);
    g.fillCircle(12, -2, 9);
    g.fillCircle(-4, 2, 11);
    g.fillCircle(6, 2, 10);

    g.strokeCircle(-8, -4, 11);
    g.strokeCircle(4, -5, 12);
    g.strokeCircle(12, -2, 9);
    g.strokeCircle(-4, 2, 11);
    g.strokeCircle(6, 2, 10);

    // Cute dark face
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(10, -10, 14, 12, 3);

    // Curved horn
    g.fillStyle(0xd35400, 1);
    g.beginPath();
    g.arc(14, -12, 5, 0, Math.PI);
    g.stroke();

    // Goofy big white eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, -7, isPanicking ? 4 : 3);
    // Pupil
    g.fillStyle(0x000000, 1);
    g.fillCircle(17, -7, isPanicking ? 1.5 : 1.5);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDelivered && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.audio.playHookHit();
    this.audio.playSheepBaa();

    // Flail legs tween
    this.scene.tweens.add({
      targets: this.sheepGraphics,
      angle: { from: -12, to: 12 },
      duration: 110,
      yoyo: true,
      repeat: 6,
    });

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 25, 'BAAA!', '#ffffff', '20px');
    }

    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    this.setPosition(ctx.hookX, ctx.hookY);
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    this.vx = ctx.hookVx ?? -80;
    this.vy = ctx.hookVy ?? 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.audio.playInstallClank();
    this.audio.playSheepBaa();

    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.localX = 0;

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        '+$80 (BAAA!)',
        '#2ecc71',
        '20px'
      );
    }

    this.telemetry.onHookDelivered(this.typeId);
  }

  public triggerPanic(reason: string = 'EXPLOSION'): void {
    if (!this._isDelivered || this._isDestroyed) return;
    this.state = 'PANIC';
    this.stateTimer = 1.8;
    this.wanderSpeed = 80;
    this.drawVisuals(true);
    this.audio.playSheepPanic();

    // Jitter tween
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y - 8,
      duration: 80,
      yoyo: true,
      repeat: 8,
    });

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 35,
        'PANIC!!',
        '#e74c3c',
        '18px'
      );
    }

    this.telemetry.recordConsequence('SHEEP_PANIC');
    this.telemetry.recordCrossInteraction('SHEEP_PANIC', reason);
  }

  public onImpact(ctx: ImpactContext): void {
    // Sheep impact
    this.audio.playSheepBaa();
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
    return ['LIVING', 'CARGO', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 16);
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
      this.container.x += (this.vx - worldSpeed) * dt;
      this.container.y += this.vy * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 16);

      this.vx *= 0.98;
      this.vy *= 0.98;

      if (this.container.x < -150) {
        this.destroy();
        this.telemetry.recordMissed(this.typeId);
      }
      return;
    }

    if (this._isDelivered) {
      // Wandering inside train car deck bounds
      this.stateTimer -= dt;

      if (this.state === 'IDLE') {
        if (this.stateTimer <= 0) {
          if (Math.random() < 0.6) {
            this.state = 'WANDER';
            this.stateTimer = 1.5;
            this.wanderSpeed = 25;
            this.facing = Math.random() < 0.5 ? -1 : 1;
            this.container.setScale(this.facing, 1);
          } else {
            this.state = 'LOOK';
            this.stateTimer = 1.2;
            if (Math.random() < 0.4) this.audio.playSheepBaa();
          }
        }
      } else if (this.state === 'WANDER') {
        this.localX += this.facing * this.wanderSpeed * dt;
        if (this.localX < this.deckMinX) {
          this.localX = this.deckMinX;
          this.facing = 1;
          this.container.setScale(this.facing, 1);
        } else if (this.localX > this.deckMaxX) {
          this.localX = this.deckMaxX;
          this.facing = -1;
          this.container.setScale(this.facing, 1);
        }

        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 1.8;
        }
      } else if (this.state === 'LOOK') {
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 1.5;
        }
      } else if (this.state === 'PANIC') {
        this.localX += this.facing * this.wanderSpeed * dt;
        if (this.localX <= this.deckMinX || this.localX >= this.deckMaxX) {
          this.facing *= -1;
          this.container.setScale(this.facing, 1);
          // Bump other cargo!
          this.wobbleNearbyCargo();
        }

        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 2.0;
          this.wanderSpeed = 25;
          this.drawVisuals(false);
        }
      }
    }
  }

  private wobbleNearbyCargo(): void {
    const trainMgr = (this.scene as any).trainManager;
    if (trainMgr) {
      trainMgr.wobbleDeckCargo(this.container.x, 80);
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
