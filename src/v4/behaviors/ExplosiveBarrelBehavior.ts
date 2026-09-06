import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export class ExplosiveBarrelBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'explosive_v4';
  public name: string = 'Explosive Barrel';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public barrelGraphics: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;
  private isArmedForDetonation: boolean = false;
  private fuseTimer: number = 0;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 6;
  public installedWeight: number = 7;
  public lootValue: number = 10;

  private sparkTimer: number = 0;
  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `barrel_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.4);
    this.shadow.fillEllipse(0, 0, 36, 12);
    this.shadow.setPosition(x, y + 16);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(35);

    this.barrelGraphics = scene.add.graphics();
    this.drawVisuals();
    this.container.add(this.barrelGraphics);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(): void {
    const g = this.barrelGraphics;
    g.clear();

    // Red industrial metal drum (28x38 px)
    g.fillStyle(0xc0392b, 1);
    g.fillRoundedRect(-14, -19, 28, 38, 4);
    g.lineStyle(2, 0x78281f, 1);
    g.strokeRoundedRect(-14, -19, 28, 38, 4);

    // Reinforcing steel bands
    g.fillStyle(0x4a1813, 1);
    g.fillRect(-14, -10, 28, 3);
    g.fillRect(-14, 7, 28, 3);

    // Yellow Hazard Warning Trefoil
    g.fillStyle(0xf1c40f, 1);
    g.fillCircle(0, -1, 7);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(0, -1, 3);
    g.fillTriangle(-4, -6, 0, -1, 4, -6);
    g.fillTriangle(-5, 4, 0, -1, -2, 7);
    g.fillTriangle(5, 4, 0, -1, 2, 7);

    // Danger cap
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(-5, -22, 10, 3);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDelivered && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.audio.playHookHit();
    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    this.setPosition(ctx.hookX, ctx.hookY);
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    this.vx = ctx.hookVx ?? -120;
    this.vy = ctx.hookVy ?? 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.audio.playInstallClank();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        '+$10 (CAUTION: BOOM!)',
        '#e74c3c',
        '20px'
      );
    }

    this.telemetry.onHookDelivered(this.typeId);
  }

  // Section 100-102: Right-click Jettison weapon throw towards mouse position
  public jettisonThrow(targetWorldX: number, targetWorldY: number): void {
    this._isDelivered = false;
    this._isLatched = false;

    // Vector towards mouse
    const angle = Phaser.Math.Angle.Between(this.container.x, this.container.y, targetWorldX, targetWorldY);
    const speed = 620;

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 90; // Upward initial boost

    // Arm for detonation in 0.7 seconds
    this.isArmedForDetonation = true;
    this.fuseTimer = 0.7;
    this.audio.playExplosiveFuse();

    this.scene.tweens.add({
      targets: this.barrelGraphics,
      angle: 720,
      duration: 700,
    });

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 30, 'LAUNCHED!', '#f39c12', '20px');
    }

    this.telemetry.recordJettison(this.typeId);
  }

  public onImpact(ctx: ImpactContext): void {
    // Detonates on impact!
    this.explode('IMPACT');
  }

  public explode(triggerSource: string = 'GENERIC'): void {
    if (this._isDestroyed) return;
    this.audio.playExplosion();

    const blastX = this.container.x;
    const blastY = this.container.y;
    const blastRadius = 180;

    // Juice & Camera
    if ((this.scene as any).juice) {
      (this.scene as any).juice.screenShake(7, 220);
      (this.scene as any).juice.showFloatingText(blastX, blastY - 40, 'KABOOM!!', '#e74c3c', '32px');
    }

    // Particles
    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitExplosion(blastX, blastY);
    }

    // Damage enemies in radius
    const enemyMgr = (this.scene as any).enemyManager;
    if (enemyMgr && enemyMgr.enemies) {
      for (const enemy of enemyMgr.enemies) {
        const dist = Phaser.Math.Distance.Between(blastX, blastY, enemy.x, enemy.y);
        if (dist <= blastRadius) {
          enemy.takeDamage(100, 'EXPLOSIVE_BARREL');
          this.telemetry.recordThreatResolution(enemy.typeId || 'enemy', 'killedByExplosion');
        }
      }
    }

    // Train self-damage if within 140px
    const trainMgr = (this.scene as any).trainManager;
    if (trainMgr) {
      const trainPos = trainMgr.getClosestCarPosition(blastX, blastY);
      const trainDist = Phaser.Math.Distance.Between(blastX, blastY, trainPos.x, trainPos.y);
      if (trainDist <= 140) {
        trainMgr.stats.takeDamage(16, 'EXPLOSIVE_BARREL_BLAST');
        this.telemetry.recordConsequence('EXPLOSION_SELF_DAMAGE');
        this.telemetry.recordRegret('EXPLOSION_SELF_DAMAGE', 'Explosive barrel hurt train');
      }
    }

    // Cross-system 1: Panic all sheep nearby
    const registry = V4ObjectRegistry.getInstance();
    const sheeps = registry.getAll().filter((e) => e.typeId === 'sheep_v4');
    for (const sheep of sheeps) {
      const sPos = sheep.getPosition();
      if (Phaser.Math.Distance.Between(blastX, blastY, sPos.x, sPos.y) <= blastRadius + 120) {
        (sheep as any).triggerPanic('EXPLOSION');
      }
    }

    // Cross-system 2: Accelerate nearby unopened fridge
    const fridges = registry.getAll().filter((e) => e.typeId === 'fridge_v4');
    for (const fridge of fridges) {
      const fPos = fridge.getPosition();
      if (Phaser.Math.Distance.Between(blastX, blastY, fPos.x, fPos.y) <= blastRadius + 100) {
        (fridge as any).onExplosionNearby();
      }
    }

    this.telemetry.recordConsequence('EXPLOSION_TRIGGERED');
    this.telemetry.recordCrossInteraction('EXPLOSION_TRIGGERED', triggerSource);
    this.destroy();
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
    return ['METAL', 'EXPLOSIVE', 'CARGO', 'MAGNETIC', 'HOOKABLE'];
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
  public getVelocity(): { x: number; y: number } {
    return { x: this.vx, y: this.vy };
  }
  public setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
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

    // Sputtering sparks
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.2;
      const particles = (this.scene as any).particles;
      if (particles) particles.emitSparks(this.container.x, this.container.y - 18, 1);
    }

    if (this.isArmedForDetonation) {
      this.fuseTimer -= dt;
      this.container.x += this.vx * dt;
      this.container.y += this.vy * dt;
      this.vy += 280 * dt; // Gravity
      this.shadow.setPosition(this.container.x, this.container.y + 16);

      if (this.fuseTimer <= 0 || this.container.y >= 710) {
        this.explode('FUSE_DETONATION');
      }
      return;
    }

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
