import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';
import { EventBus } from '../../core/EventBus';
import { GremlinBehavior } from './GremlinBehavior';

export type FridgeOutcome = 'GREMLIN' | 'FOOD' | 'REPAIR_BOT' | 'RANDOM';

export class FridgeBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'fridge_v4';
  public name: string = 'Mystery Fridge';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public fridgeBody: Phaser.GameObjects.Graphics;
  public fridgeDoor: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;
  public isOpen: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 9;
  public installedWeight: number = 8;
  public lootValue: number = 20;

  // Opening sequence timer
  private openTimer: number = 4.0;
  private hasThump1: boolean = false;
  private hasThump2: boolean = false;
  private hasCreak: boolean = false;
  private roadsideThumpTimer: number = 2.0;

  // Outcome
  public forcedOutcome: FridgeOutcome | null = null;
  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `fridge_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.4);
    this.shadow.fillEllipse(0, 0, 42, 14);
    this.shadow.setPosition(x, y + 20);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(35);

    this.fridgeBody = scene.add.graphics();
    this.fridgeDoor = scene.add.graphics();
    this.drawVisuals();

    this.container.add([this.fridgeBody, this.fridgeDoor]);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(): void {
    const b = this.fridgeBody;
    b.clear();

    // Vintage fridge body (32x44 px)
    b.fillStyle(0xd5dbdb, 1);
    b.fillRoundedRect(-16, -22, 32, 44, 4);
    b.lineStyle(2, 0x566573, 1);
    b.strokeRoundedRect(-16, -22, 32, 44, 4);

    // Rust patches
    b.fillStyle(0xba4a00, 0.6);
    b.fillCircle(-10, -14, 3);
    b.fillCircle(8, 12, 4);
    b.fillCircle(-8, 15, 2.5);

    // Interior darkness visible when door opens
    b.fillStyle(0x1a1a1a, 1);
    b.fillRect(-12, -18, 24, 36);

    // Wire shelves
    b.lineStyle(1.5, 0x7f8c8d, 1);
    b.lineBetween(-12, -6, 12, -6);
    b.lineBetween(-12, 6, 12, 6);

    // Door Graphics (hinged on left side at x = -16)
    const d = this.fridgeDoor;
    d.clear();
    d.fillStyle(0xecf0f1, 1);
    d.fillRoundedRect(-16, -22, 30, 44, 3);
    d.lineStyle(2, 0x7f8c8d, 1);
    d.strokeRoundedRect(-16, -22, 30, 44, 3);

    // Chrome handle on right
    d.fillStyle(0x95a5a6, 1);
    d.fillRect(8, -4, 4, 12);

    // Strange biohazard/alien sticker
    d.fillStyle(0xf1c40f, 1);
    d.fillTriangle(-4, -14, 4, -14, 0, -6);
    d.fillStyle(0x000000, 1);
    d.fillCircle(0, -10, 2);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDelivered && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.audio.playHookHit();
    this.audio.playFridgeThump();
    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    this.setPosition(ctx.hookX, ctx.hookY);
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    this.vx = ctx.hookVx ?? -100;
    this.vy = ctx.hookVy ?? 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.audio.playInstallClank();
    this.openTimer = 4.0;
    this.hasThump1 = false;
    this.hasThump2 = false;
    this.hasCreak = false;

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        '+$20 (THUMP?)',
        '#3498db',
        '20px'
      );
    }

    this.telemetry.onHookDelivered(this.typeId);

    EventBus.getInstance().on('ITEM_DISCARDED', (evt: any) => {
      if (evt && (evt.item === 'fridge' || evt.item === 'fridge_v4' || evt.instanceId === this.instanceId)) {
        this.destroy();
      }
    });
  }

  public onExplosionNearby(): void {
    if (!this._isDelivered || this.isOpen) return;
    // Section 175: Explosion knocks opening timer down by 1.5s & violently shakes
    this.openTimer = Math.max(0.2, this.openTimer - 1.5);
    this.audio.playFridgeThump();

    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + 8,
      duration: 60,
      yoyo: true,
      repeat: 4,
    });

    this.telemetry.recordCrossInteraction('EXPLOSION_ACCELERATES_FRIDGE');
  }

  public onImpact(ctx: ImpactContext): void {
    const damage = Phaser.Math.Clamp(ctx.relativeSpeed * 0.1, 5, 45);
    ctx.damage = damage;
    this.audio.playFridgeBang();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        ctx.hitX,
        ctx.hitY,
        `-${Math.round(damage)} SMASH!`,
        '#e67e22',
        '22px'
      );
    }
  }

  private triggerOpenSequence(): void {
    this.isOpen = true;
    this.audio.playFridgeBang();

    // Door swings wide open
    this.scene.tweens.add({
      targets: this.fridgeDoor,
      scaleX: 0.15,
      x: -12,
      duration: 180,
      ease: 'Back.easeOut',
    });

    if ((this.scene as any).juice) {
      (this.scene as any).juice.screenShake(4, 140);
      (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 35, 'BANG!!', '#e74c3c', '24px');
    }

    // Determine outcome
    const outcome = this.forcedOutcome || this.determineOutcome();

    if (outcome === 'GREMLIN') {
      this.spawnGremlin();
    } else if (outcome === 'FOOD') {
      this.spawnFood();
    } else if (outcome === 'REPAIR_BOT') {
      this.spawnRepairBot();
    }
  }

  private determineOutcome(): FridgeOutcome {
    // Default showcase seed V4_SHOWCASE_001 guarantees Gremlin
    const seed = (this.scene as any).seed?.toString() || '';
    if (seed.includes('SHOWCASE') || Math.random() < 0.65) {
      return 'GREMLIN';
    }
    return Math.random() < 0.5 ? 'FOOD' : 'REPAIR_BOT';
  }

  private spawnGremlin(): void {
    this.audio.playGremlinSqueal();
    new GremlinBehavior(this.scene, this.container.x, this.container.y - 10);
    this.telemetry.recordConsequence('FRIDGE_GREMLIN');
    this.telemetry.recordRegret('FRIDGE_GREMLIN_SPAWN', 'Gremlin emerged from fridge');
  }

  private spawnFood(): void {
    const trainMgr = (this.scene as any).trainManager;
    if (trainMgr) {
      trainMgr.stats.addHp(20);
      trainMgr.cargo.cargoUsed = Math.max(0, trainMgr.cargo.cargoUsed);
    }
    this.lootValue += 40;

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 40,
        '+20 HP! +$40 FOOD!',
        '#2ecc71',
        '22px'
      );
    }
    this.telemetry.recordConsequence('FRIDGE_FOOD');
  }

  private spawnRepairBot(): void {
    const trainMgr = (this.scene as any).trainManager;
    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 40,
        'REPAIR BOT DEPLOYED (+1 HP/s)',
        '#3498db',
        '20px'
      );
    }

    // Repair 1 HP/sec for 8 seconds
    let count = 0;
    const repairTimer = this.scene.time.addEvent({
      delay: 1000,
      repeat: 7,
      callback: () => {
        if (trainMgr) trainMgr.stats.addHp(1);
        count++;
        const particles = (this.scene as any).particles;
        if (particles) particles.emitSparks(this.container.x, this.container.y, 4);
      },
    });

    this.telemetry.recordConsequence('FRIDGE_REPAIR');
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
    return ['METAL', 'CARGO', 'MAGNETIC', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 20);
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
      // Free on roadside
      this.container.x += (this.vx - worldSpeed) * dt;
      this.container.y += this.vy * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 20);

      this.vx *= 0.98;
      this.vy *= 0.98;

      // Roadside occasional thump
      this.roadsideThumpTimer -= dt;
      if (this.roadsideThumpTimer <= 0) {
        this.roadsideThumpTimer = 2.5;
        this.audio.playFridgeThump();
        this.scene.tweens.add({
          targets: this.container,
          y: this.container.y - 3,
          duration: 90,
          yoyo: true,
        });
      }

      if (this.container.x < -150) {
        this.destroy();
        this.telemetry.recordMissed(this.typeId);
      }
      return;
    }

    if (this._isDelivered && !this.isOpen) {
      const trainMgr = (this.scene as any).trainManager;
      if (trainMgr && trainMgr.cars && trainMgr.cars.length > 0) {
        const car = trainMgr.cars.find((c: any) => c.type === 'cargo' || c.type === 'flat') || trainMgr.cars[trainMgr.cars.length - 1];
        const carX = car.container ? car.container.x : car.baseCarX;
        const carY = car.container ? car.container.y : car.baseCarY;
        this.container.setPosition(carX + 25, carY - 22);
        this.shadow.setPosition(carX + 25, carY + 8);
      }

      this.openTimer -= dt;

      // T-1.5: first thump
      if (this.openTimer <= 1.5 && !this.hasThump1) {
        this.hasThump1 = true;
        this.audio.playFridgeThump();
        this.scene.tweens.add({
          targets: this.container,
          y: this.container.y - 2,
          duration: 80,
          yoyo: true,
        });
      }

      // T-1.0: second heavier thump
      if (this.openTimer <= 1.0 && !this.hasThump2) {
        this.hasThump2 = true;
        this.audio.playFridgeThump();
        this.scene.tweens.add({
          targets: this.container,
          y: this.container.y - 5,
          duration: 90,
          yoyo: true,
        });
      }

      // T-0.5: door creaks ajar
      if (this.openTimer <= 0.5 && !this.hasCreak) {
        this.hasCreak = true;
        this.scene.tweens.add({
          targets: this.fridgeDoor,
          scaleX: 0.8,
          duration: 150,
        });
      }

      // T0: BANG!
      if (this.openTimer <= 0) {
        this.triggerOpenSequence();
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
