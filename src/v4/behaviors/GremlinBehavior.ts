import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export type GremlinState = 'EMERGE' | 'SCURRY' | 'SABOTAGE' | 'FLEE' | 'HOOKED';

export class GremlinBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'gremlin_v4';
  public name: string = 'Train Gremlin';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public gremlinGraphics: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 2;
  public installedWeight: number = 0;
  public lootValue: number = 0;

  // AI & Sabotage
  public state: GremlinState = 'EMERGE';
  private stateTimer: number = 1.0;
  private sabotageInterval: number = 1.8;
  private sabotageTimer: number = 1.8;
  private currentCarIndex: number = 1;
  private targetX: number = 0;

  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `gremlin_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.container = scene.add.container(x, y);
    this.container.setDepth(45); // Above train deck

    this.gremlinGraphics = scene.add.graphics();
    this.drawVisuals();
    this.container.add(this.gremlinGraphics);

    // Initial hop out of fridge
    this.scene.tweens.add({
      targets: this.container,
      y: y - 35,
      duration: 250,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.state = 'SCURRY';
        this.stateTimer = 1.2;
      },
    });

    V4ObjectRegistry.getInstance().register(this);
    this.audio.playGremlinSqueal();
  }

  private drawVisuals(): void {
    const g = this.gremlinGraphics;
    g.clear();

    // Spindly black body & limbs
    g.fillStyle(0x1c2833, 1);
    g.fillCircle(0, -4, 9); // body
    g.fillCircle(0, -12, 6); // head

    // Twitchy claws & legs
    g.lineStyle(2, 0x111111, 1);
    g.lineBetween(-6, 2, -10, 8);
    g.lineBetween(6, 2, 10, 8);
    g.lineBetween(-8, -4, -14, -8);
    g.lineBetween(8, -4, 14, -8);

    // Pointy ears
    g.fillStyle(0xc0392b, 1);
    g.fillTriangle(-4, -16, -1, -22, 1, -16);
    g.fillTriangle(4, -16, 1, -22, -1, -16);

    // Glowing menacing yellow eyes
    g.fillStyle(0xf1c40f, 1);
    g.fillCircle(-2.5, -12, 2.5);
    g.fillCircle(2.5, -12, 2.5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(-2.5, -12, 1);
    g.fillCircle(2.5, -12, 1);

    // Sharp fangs
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(-2, -9, 0, -6, 2, -9);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.state = 'HOOKED';
    this.audio.playHookHit();
    this.audio.playGremlinSqueal();

    // Violent struggle jitter
    this.scene.tweens.add({
      targets: this.container,
      angle: { from: -25, to: 25 },
      duration: 70,
      yoyo: true,
      repeat: -1,
    });

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 25,
        'CAUGHT!',
        '#e74c3c',
        '20px'
      );
    }
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    this.setPosition(ctx.hookX, ctx.hookY);
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    // When released or thrown off the train -> problem solved!
    this.vx = ctx.hookVx ?? -150;
    this.vy = ctx.hookVy ?? -80;

    this.audio.playGremlinSqueal();
    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        'GOOD RIDDANCE!',
        '#2ecc71',
        '24px'
      );
    }

    this.telemetry.recordConsequence('GREMLIN_REMOVED');
    this.telemetry.recordRegret('GREMLIN_DISPOSED', 'Player manually caught & discarded Gremlin');

    // Fling off screen and destroy
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x - 400,
      y: this.container.y + 120,
      angle: 720,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  public onDeliveredToTrain(trainManager: any): void {
    // If dropped back onto train, returns to scurrying!
    this._isLatched = false;
    this.state = 'SCURRY';
    this.stateTimer = 1.0;
  }

  public onImpact(ctx: ImpactContext): void {
    this.destroy();
  }

  public getHookWeight(): number {
    return this.hookWeight;
  }
  public getInstalledWeight(): number {
    return 0;
  }
  public getLootValue(): number {
    return 0;
  }

  public getTags(): EntityTag[] {
    return ['LIVING', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public isLatched(): boolean {
    return this._isLatched;
  }
  public isDelivered(): boolean {
    return false;
  }
  public isDestroyed(): boolean {
    return this._isDestroyed;
  }

  public update(dt: number, worldSpeed: number): void {
    if (this._isDestroyed || this._isLatched) return;

    const trainMgr = (this.scene as any).trainManager;
    if (!trainMgr) return;

    this.stateTimer -= dt;
    this.sabotageTimer -= dt;

    if (this.state === 'SCURRY') {
      // Pick random car on train and scurry towards it
      const cars = trainMgr.cars;
      if (cars && cars.length > 0) {
        const car = cars[this.currentCarIndex % cars.length];
        const carX = car.container ? car.container.x : car.baseCarX;
        const carY = car.container ? car.container.y : car.baseCarY;
        this.targetX = carX + (Math.random() * 60 - 30);
        this.container.y = carY - 20;

        const dx = this.targetX - this.container.x;
        const dir = Math.sign(dx);
        this.container.x += dir * 140 * dt;
        this.container.setScale(dir || 1, 1);

        // Check if passing sheep -> triggers panic!
        this.checkSheepProximity();

        if (Math.abs(dx) < 15 || this.stateTimer <= 0) {
          this.state = 'SABOTAGE';
          this.stateTimer = 1.0;
        }
      }
    } else if (this.state === 'SABOTAGE') {
      const cars = trainMgr.cars;
      if (cars && cars.length > 0) {
        const car = cars[this.currentCarIndex % cars.length];
        const carY = car.container ? car.container.y : car.baseCarY;
        this.container.y = carY - 20;
      }

      if (this.sabotageTimer <= 0) {
        this.sabotageTimer = this.sabotageInterval;
        this.performSabotage(trainMgr);
      }

      if (this.stateTimer <= 0) {
        this.state = 'SCURRY';
        this.stateTimer = 2.0;
        this.currentCarIndex = Math.floor(Math.random() * (trainMgr.cars?.length || 3));
      }
    }
  }

  private performSabotage(trainMgr: any): void {
    this.audio.playGremlinSabotage();
    trainMgr.stats.takeDamage(2, 'GREMLIN_SABOTAGE');

    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitSparks(this.container.x, this.container.y, 8);
    }

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 20,
        '-2 HP SABOTAGE!',
        '#e74c3c',
        '16px'
      );
    }

    // Check if near Turret -> temporarily disable turret for 1.5s!
    const disabledTurret = trainMgr.temporarilyDisableTurretNear(this.container.x, 100, 1.5);
    if (disabledTurret) {
      this.telemetry.recordCrossInteraction('GREMLIN_DISABLE_TURRET', 'Turret stalled by Gremlin');
    }

    this.telemetry.recordConsequence('GREMLIN_SABOTAGE');
  }

  private checkSheepProximity(): void {
    const registry = V4ObjectRegistry.getInstance();
    const sheeps = registry.getAll().filter((e) => e.typeId === 'sheep_v4' && e.isDelivered());
    for (const sheep of sheeps) {
      const dist = Math.abs(sheep.getPosition().x - this.container.x);
      if (dist < 60) {
        (sheep as any).triggerPanic('GREMLIN');
        this.telemetry.recordCrossInteraction('GREMLIN_SCARED_SHEEP');
      }
    }
  }

  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    V4ObjectRegistry.getInstance().unregister(this.instanceId);
    if (this.container) this.container.destroy();
  }
}
