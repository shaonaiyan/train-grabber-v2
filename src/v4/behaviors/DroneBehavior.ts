import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export type DroneState =
  | 'APPROACH'
  | 'ATTACK'
  | 'HOOKED'
  | 'CRASHING'
  | 'CAPTURED'
  | 'ALLY'
  | 'SHORT_OUT'
  | 'DESTROYED';

export class DroneBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'drone_v4';
  public name: string = 'Attack Drone';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public droneGraphics: Phaser.GameObjects.Graphics;
  public eyeGraphics: Phaser.GameObjects.Graphics;

  public state: DroneState = 'APPROACH';
  public hp: number = 35;
  public maxHp: number = 35;
  public damage: number = 4;
  public attackInterval: number = 1.6;
  private attackTimer: number = 1.6;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 7;
  public installedWeight: number = 0;
  public lootValue: number = 50;

  private allyTimer: number = 12.0;
  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `drone_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.35);
    this.shadow.fillEllipse(0, 0, 44, 14);
    this.shadow.setPosition(x, y + 60);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(55);

    this.droneGraphics = scene.add.graphics();
    this.eyeGraphics = scene.add.graphics();

    this.drawVisuals(false);
    this.container.add([this.droneGraphics, this.eyeGraphics]);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
    this.audio.playDroneBuzz();
  }

  private drawVisuals(isAlly: boolean = false): void {
    const g = this.droneGraphics;
    g.clear();

    // Quad rotor arms
    g.lineStyle(3, 0x2c3e50, 1);
    g.lineBetween(-18, -14, 18, 14);
    g.lineBetween(-18, 14, 18, -14);

    // Rotor blades spinning (circles)
    g.fillStyle(0x7f8c8d, 0.6);
    g.fillCircle(-18, -14, 6);
    g.fillCircle(18, 14, 6);
    g.fillCircle(-18, 14, 6);
    g.fillCircle(18, -14, 6);

    // Main armoured chassis
    g.fillStyle(0x34495e, 1);
    g.fillRoundedRect(-14, -12, 28, 24, 4);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-14, -12, 28, 24, 4);

    // Twin underslung gun barrels
    g.fillStyle(0x111111, 1);
    g.fillRect(-8, 10, 4, 10);
    g.fillRect(4, 10, 4, 10);

    // Central Eye Lens
    const e = this.eyeGraphics;
    e.clear();
    const eyeColor = isAlly ? 0x00ffcc : 0xe74c3c;
    e.fillStyle(eyeColor, 1);
    e.fillCircle(0, -1, 5);
    e.fillStyle(0xffffff, 0.9);
    e.fillCircle(-1, -2, 1.8);
  }

  public canHook(): boolean {
    return (
      this.state !== 'HOOKED' &&
      this.state !== 'CRASHING' &&
      this.state !== 'ALLY' &&
      this.state !== 'DESTROYED'
    );
  }

  public onHookLatch(ctx: HookContext): void {
    this.state = 'HOOKED';
    this.audio.playHookHit();
    this.audio.playDroneBuzz();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 25,
        'DRONE HOOKED!',
        '#f1c40f',
        '20px'
      );
    }

    this.telemetry.recordConsequence('DRONE_GRAPPLED');
    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    // Erratic struggle offset
    const jitterX = (Math.random() - 0.5) * 8;
    const jitterY = (Math.random() - 0.5) * 8;
    this.setPosition(ctx.hookX + jitterX, ctx.hookY + jitterY);

    if (Math.random() < 0.05) {
      this.audio.playDroneBuzz();
    }
  }

  public onHookRelease(ctx: HookContext): void {
    this.vx = ctx.hookVx ?? -240;
    this.vy = ctx.hookVy ?? 180;

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed >= 320) {
      // Section 109: Ground crash if speed > 320 px/s
      this.state = 'CRASHING';
    } else {
      this.state = 'APPROACH';
    }

    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    // Section 110: Hijacked into Allied Drone!
    this.state = 'CAPTURED';
    this.audio.playDroneHijack();

    // 0.6s electric arc transition
    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitSparks(this.container.x, this.container.y, 16);
    }

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 35,
        'HIJACKED ALLY DRONE!!',
        '#00ffcc',
        '24px'
      );
      (this.scene as any).juice.screenShake(5, 150);
    }

    // Battery bonus duration (+3s per battery, max +6s)
    let bonusSec = 0;
    if (trainManager) {
      const batteryCount = trainManager.getBatteryCount();
      bonusSec = Math.min(6, batteryCount * 3.0);
    }
    this.allyTimer = 12.0 + bonusSec;

    this.scene.time.delayedCall(600, () => {
      this.state = 'ALLY';
      this.drawVisuals(true);
    });

    this.telemetry.recordConsequence('DRONE_HIJACKED');
    this.telemetry.recordThreatResolution(this.typeId, 'captured');
  }

  public onImpact(ctx: ImpactContext): void {
    this.takeDamage(ctx.damage || 35, 'IMPACT');
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
        '18px'
      );
    }

    if (this.hp <= 0) {
      this.explodeCrash();
    }
  }

  private explodeCrash(): void {
    this.audio.playDroneCrash();
    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitExplosion(this.container.x, this.container.y);
    }
    this.telemetry.recordConsequence('DRONE_CRASHED');
    this.telemetry.recordThreatResolution(this.typeId, 'killedByImpact');
    this.destroy();
  }

  public getHookWeight(): number {
    return this.hookWeight;
  }
  public getInstalledWeight(): number {
    return 0;
  }
  public getLootValue(): number {
    return this.state === 'ALLY' ? 50 : 0;
  }

  public getTags(): EntityTag[] {
    const base: EntityTag[] = ['METAL', 'ELECTRONIC', 'HOOKABLE', 'MAGNETIC'];
    if (this.state === 'ALLY') {
      base.push('TRAIN_ATTACHED');
    } else {
      base.push('ENEMY');
    }
    return base;
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 60);
  }
  public getVelocity(): { x: number; y: number } {
    return { x: this.vx, y: this.vy };
  }
  public setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  public isLatched(): boolean {
    return this.state === 'HOOKED';
  }
  public isDelivered(): boolean {
    return this.state === 'ALLY';
  }
  public isDestroyed(): boolean {
    return this.state === 'DESTROYED';
  }

  public update(dt: number, worldSpeed: number): void {
    if (this.state === 'DESTROYED' || this.state === 'HOOKED') return;

    const trainMgr = (this.scene as any).trainManager;

    if (this.state === 'CRASHING') {
      this.container.x += this.vx * dt;
      this.container.y += this.vy * dt;
      this.vy += 450 * dt; // Gravity
      this.shadow.setPosition(this.container.x, this.container.y + 30);

      if (this.container.y >= 680) {
        this.explodeCrash();
      }
      return;
    }

    if (this.state === 'APPROACH') {
      // Hovering at top right (x ~ 1400, y ~ 380)
      const targetX = 1350;
      const targetY = 420;
      const dx = targetX - this.container.x;
      const dy = targetY - this.container.y;
      this.container.x += dx * 2.0 * dt;
      this.container.y += dy * 2.0 * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 60);

      if (Math.abs(dx) < 60) {
        this.state = 'ATTACK';
      }
    } else if (this.state === 'ATTACK') {
      // Bobbing attack pattern
      this.attackTimer -= dt;
      this.container.y += Math.sin(this.scene.time.now * 0.004) * 35 * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 60);

      if (this.attackTimer <= 0 && trainMgr) {
        this.attackTimer = this.attackInterval;
        this.audio.playDroneFire();
        trainMgr.stats.takeDamage(this.damage, 'DRONE_FIRE');

        const particles = (this.scene as any).particles;
        if (particles) {
          particles.emitSparks(this.container.x - 10, this.container.y + 12, 4);
        }

        // Projectile visual towards train
        this.scene.tweens.add({
          targets: this.container,
          x: this.container.x - 8,
          duration: 60,
          yoyo: true,
        });
      }
    } else if (this.state === 'ALLY') {
      // Ally Drone: hovers above train car 1 or 2, shoots at Bandits/Hostile Drones!
      this.allyTimer -= dt;
      if (trainMgr) {
        const leadPos = trainMgr.getLeadCarPosition();
        this.container.x = leadPos.x + 80;
        this.container.y = 520 + Math.sin(this.scene.time.now * 0.005) * 15;
        this.shadow.setPosition(this.container.x, 680);
      }

      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackTimer = 1.2;
        this.performAllyAttack();
      }

      if (this.allyTimer <= 0) {
        this.state = 'SHORT_OUT';
        this.audio.playDroneCrash();
        // Smoke & drop away
        this.scene.tweens.add({
          targets: this.container,
          y: 750,
          angle: 180,
          alpha: 0,
          duration: 800,
          onComplete: () => this.destroy(),
        });
      }
    }
  }

  private performAllyAttack(): void {
    const enemyMgr = (this.scene as any).enemyManager;
    if (enemyMgr && enemyMgr.enemies && enemyMgr.enemies.length > 0) {
      const target = enemyMgr.enemies[0];
      this.audio.playDroneFire();
      target.takeDamage(8, 'ALLY_DRONE');

      if ((this.scene as any).juice) {
        (this.scene as any).juice.showFloatingText(target.x, target.y - 20, '-8 ALLY!', '#00ffcc', '18px');
      }
      this.telemetry.recordCrossInteraction('ALLY_DRONE_ATTACKED_ENEMY');
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
