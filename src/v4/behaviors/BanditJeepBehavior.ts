import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export type BanditState = 'APPROACH' | 'ATTACK' | 'TEARING_GUN' | 'FLEE' | 'DESTROYED';

export class BanditJeepBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'bandit_jeep_v4';
  public name: string = 'Bandit Technical';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public chassisGraphics: Phaser.GameObjects.Graphics;
  public gunGraphics: Phaser.GameObjects.Graphics;

  public state: BanditState = 'APPROACH';
  public hp: number = 70;
  public hasGun: boolean = true;
  private shotsRemaining: number = 3;
  private shotInterval: number = 1.4;
  private shotTimer: number = 1.4;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 16;
  public installedWeight: number = 0;
  public lootValue: number = 60;

  private tearTimer: number = 0;
  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `jeep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.45);
    this.shadow.fillEllipse(0, 0, 75, 18);
    this.shadow.setPosition(x, y + 24);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(34);

    this.chassisGraphics = scene.add.graphics();
    this.gunGraphics = scene.add.graphics();

    this.drawVisuals();
    this.container.add([this.chassisGraphics, this.gunGraphics]);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
    this.audio.playBanditEngine();
  }

  private drawVisuals(): void {
    const c = this.chassisGraphics;
    c.clear();

    // Two big offroad wheels with tread
    c.fillStyle(0x1a1a1a, 1);
    c.fillCircle(-24, 14, 11);
    c.fillCircle(24, 14, 11);
    c.fillStyle(0x7f8c8d, 1);
    c.fillCircle(-24, 14, 4);
    c.fillCircle(24, 14, 4);

    // Armor-plated rusty buggy chassis
    c.fillStyle(0x784212, 1);
    c.fillRoundedRect(-34, -8, 68, 20, 4);
    c.lineStyle(2, 0x3e1f06, 1);
    c.strokeRoundedRect(-34, -8, 68, 20, 4);

    // Roll cage (black steel tubing)
    c.lineStyle(2.5, 0x17202a, 1);
    c.lineBetween(-20, -8, -12, -22);
    c.lineBetween(14, -8, 8, -22);
    c.lineBetween(-12, -22, 8, -22);

    // Front ram bumper
    c.fillStyle(0x2c3e50, 1);
    c.fillRect(-38, 0, 6, 14);

    // Draw Roof Gun Turret
    this.drawGunTurret();
  }

  private drawGunTurret(): void {
    const g = this.gunGraphics;
    g.clear();
    if (!this.hasGun) return;

    // Turret mount & pivot ring on roof
    g.fillStyle(0x27ae60, 1);
    g.fillCircle(-2, -24, 7);
    g.lineStyle(2, 0x145a32, 1);
    g.strokeCircle(-2, -24, 7);

    // Machine gun barrel pointing forward/left towards train
    g.fillStyle(0x111111, 1);
    g.fillRect(-18, -26, 16, 4);
    g.fillRect(-18, -21, 12, 3);
    g.fillStyle(0xd4ac0d, 1); // ammo belt
    g.fillRect(3, -23, 6, 8);
  }

  public canHook(): boolean {
    return this.state !== 'DESTROYED' && this.state !== 'FLEE';
  }

  // Determines whether the hook hit the gun or the body based on hit Y coordinate
  public onHookLatch(ctx: HookContext): void {
    const hitLocalY = ctx.hookY - this.container.y;

    if (this.hasGun && hitLocalY <= -14) {
      // HOOKED THE GUN!
      this.startGunTear();
    } else {
      // HOOKED THE BODY -> TOO BIG!
      this.onHookBody(ctx);
    }
  }

  private onHookBody(ctx: HookContext): void {
    this.audio.playHookHit();
    this.audio.playTrainStrain();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 30, 'TOO BIG!', '#f39c12', '22px');
      (this.scene as any).juice.screenShake(5, 120);
    }

    // 0.45s struggle before chain automatically snaps free
    this.scene.time.delayedCall(450, () => {
      const grapple = (this.scene as any).grapple;
      if (grapple) {
        grapple.releaseLatchedItem();
      }
    });
  }

  private startGunTear(): void {
    this.state = 'TEARING_GUN';
    this.tearTimer = 0.35;
    this.audio.playGunTear();

    // Violent shudder
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + 8,
      duration: 60,
      yoyo: true,
      repeat: 5,
    });

    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitSparks(this.container.x, this.container.y - 24, 18);
    }

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 45,
        'TEARING GUN OFF JEEP!!',
        '#00ffcc',
        '24px'
      );
    }

    this.scene.time.delayedCall(350, () => {
      this.completeGunTear();
    });
  }

  private completeGunTear(): void {
    this.hasGun = false;
    this.drawGunTurret();
    this.state = 'FLEE';

    // Gun becomes loose turret on player's hook!
    const grapple = (this.scene as any).grapple;
    if (grapple) {
      grapple.transformLatchedItemIntoTurret();
    }

    this.telemetry.recordConsequence('BANDIT_GUN_TORN');
    this.telemetry.recordThreatResolution(this.typeId, 'gunTorn');

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 35,
        'DISARMED! DRIVER FLEEING!',
        '#2ecc71',
        '22px'
      );
    }
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    // If gun is being torn, holds still
  }

  public onHookRelease(ctx: HookContext): void {
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    // Body is never delivered
  }

  public onImpact(ctx: ImpactContext): void {
    this.takeDamage(ctx.damage || 40, 'IMPACT');
  }

  public takeDamage(amount: number, source: string = 'GENERIC'): void {
    this.hp -= amount;
    this.audio.playHookHit();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 20,
        `-${amount}`,
        '#e74c3c',
        '20px'
      );
    }

    if (this.hp <= 0) {
      this.explodeDestroy();
    }
  }

  private explodeDestroy(): void {
    this.state = 'DESTROYED';
    this.audio.playExplosion();
    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitExplosion(this.container.x, this.container.y);
    }
    this.telemetry.recordConsequence('BANDIT_DESTROYED');
    this.telemetry.recordThreatResolution(this.typeId, 'killedByTurret');
    this.destroy();
  }

  public getHookWeight(): number {
    return this.hookWeight;
  }
  public getInstalledWeight(): number {
    return 0;
  }
  public getLootValue(): number {
    return 60;
  }

  public getTags(): EntityTag[] {
    return ['METAL', 'ENEMY', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 24);
  }

  public isLatched(): boolean {
    return this.state === 'TEARING_GUN';
  }
  public isDelivered(): boolean {
    return false;
  }
  public isDestroyed(): boolean {
    return this.state === 'DESTROYED';
  }

  public update(dt: number, worldSpeed: number): void {
    if (this.state === 'DESTROYED') return;

    const trainMgr = (this.scene as any).trainManager;

    if (this.state === 'APPROACH') {
      // Approach from right rear
      this.container.x -= 80 * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 24);

      if (this.container.x <= 1450) {
        this.state = 'ATTACK';
      }
    } else if (this.state === 'ATTACK') {
      // Match train distance and fire bursts
      if (this.hasGun && this.shotsRemaining > 0) {
        this.shotTimer -= dt;
        if (this.shotTimer <= 0 && trainMgr) {
          this.shotTimer = this.shotInterval;
          this.shotsRemaining--;
          this.audio.playDroneFire();
          trainMgr.stats.takeDamage(6, 'BANDIT_GUNFIRE');

          const particles = (this.scene as any).particles;
          if (particles) {
            particles.emitSparks(this.container.x - 20, this.container.y - 24, 6);
          }
        }
      } else if (this.shotsRemaining <= 0) {
        this.state = 'FLEE';
      }
    } else if (this.state === 'FLEE') {
      // Accelerate rapidly backwards or forwards away
      this.container.x += 240 * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 24);

      if (this.container.x > 2200) {
        this.destroy();
      }
    }
  }

  public destroy(): void {
    if (this.state === 'DESTROYED') return;
    this.state = 'DESTROYED';
    V4ObjectRegistry.getInstance().unregister(this.instanceId);
    if (this.shadow) this.shadow.destroy();
    if (this.container) this.container.destroy();
  }
}
