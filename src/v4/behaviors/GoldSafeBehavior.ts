import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';

export class GoldSafeBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'gold_safe_v4';
  public name: string = 'Heavy Gold Safe';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public safeGraphics: Phaser.GameObjects.Graphics;
  public strapsGraphics: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 20;
  public installedWeight: number = 18;
  public lootValue: number = 200;

  private audio: V4Audio;
  private telemetry: V4Telemetry;
  public installedCarIndex: number = -1;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `safe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    // Shadow
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.45);
    this.shadow.fillEllipse(0, 0, 48, 14);
    this.shadow.setPosition(x, y + 18);
    this.shadow.setDepth(29);

    // Main Container
    this.container = scene.add.container(x, y);
    this.container.setDepth(35);

    // Visuals: Heavy Iron Safe with Brass Dial, Hinges, and Rivets
    this.safeGraphics = scene.add.graphics();
    this.strapsGraphics = scene.add.graphics();
    this.strapsGraphics.setVisible(false);

    this.drawVisuals();
    this.container.add([this.safeGraphics, this.strapsGraphics]);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(): void {
    const g = this.safeGraphics;
    g.clear();

    // Heavy dark steel body (38x36 px)
    g.fillStyle(0x232b38, 1);
    g.fillRoundedRect(-19, -18, 38, 36, 4);
    g.lineStyle(3, 0x10151c, 1);
    g.strokeRoundedRect(-19, -18, 38, 36, 4);

    // Corner reinforcement plates
    g.fillStyle(0x3a475a, 1);
    g.fillRect(-19, -18, 8, 8);
    g.fillRect(11, -18, 8, 8);
    g.fillRect(-19, 10, 8, 8);
    g.fillRect(11, 10, 8, 8);

    // Rivets
    g.fillStyle(0x8fa1b8, 1);
    g.fillCircle(-15, -14, 1.5);
    g.fillCircle(15, -14, 1.5);
    g.fillCircle(-15, 14, 1.5);
    g.fillCircle(15, 14, 1.5);

    // Safe door inner bevel
    g.lineStyle(1.5, 0x18202a, 1);
    g.strokeRect(-13, -12, 26, 24);

    // Heavy brass combination dial
    g.fillStyle(0xd4ac0d, 1);
    g.fillCircle(0, 0, 7);
    g.lineStyle(2, 0x7d6608, 1);
    g.strokeCircle(0, 0, 7);

    // Dial notch & handle
    g.fillStyle(0xfff176, 1);
    g.fillRect(-1, -6, 2, 4);
    g.fillStyle(0x1a252f, 1);
    g.fillRect(6, -2, 4, 4);

    // Straps (shown when mounted on train deck)
    const st = this.strapsGraphics;
    st.clear();
    st.fillStyle(0xc0392b, 0.9);
    st.fillRect(-16, -19, 4, 38);
    st.fillRect(12, -19, 4, 38);
    st.fillStyle(0xf1c40f, 1); // buckle
    st.fillRect(-17, -2, 6, 4);
    st.fillRect(11, -2, 6, 4);
  }

  public canHook(): boolean {
    return !this._isLatched && !this._isDelivered && !this._isDestroyed;
  }

  public onHookLatch(ctx: HookContext): void {
    this._isLatched = true;
    this.audio.playHookHit();
    this.audio.playChainTighten();

    // Step 1: 60ms HitStop
    if ((this.scene as any).juice) {
      (this.scene as any).juice.hitStop(60);
      (this.scene as any).juice.screenShake(5, 120);
    }

    // Step 3: Train visual offset 4~7px towards safe
    const trainMgr = (this.scene as any).trainManager;
    if (trainMgr) {
      trainMgr.nudgeTowards(this.container.x, this.container.y, 6);
      this.audio.playTrainStrain();
    }

    // Step 4: Engine black smoke puff
    const particles = (this.scene as any).particles;
    if (particles && trainMgr) {
      particles.emitEngineStrainSmoke(trainMgr.getLeadCarPosition());
    }

    this.telemetry.onHookHit(this.typeId);
  }

  public onHookPull(ctx: HookContext, dt: number): void {
    // Heavy slow drag with dust particles
    this.setPosition(ctx.hookX, ctx.hookY);
    if (Math.random() < 0.2) {
      this.audio.playHeavyDrag();
      const particles = (this.scene as any).particles;
      if (particles) {
        particles.emitDust(this.container.x, this.container.y + 16, 2);
      }
    }
  }

  public onHookRelease(ctx: HookContext): void {
    this._isLatched = false;
    // Keep momentum for fling impact
    this.vx = ctx.hookVx ?? -120;
    this.vy = ctx.hookVy ?? 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.strapsGraphics.setVisible(true);
    this.audio.playInstallClank();

    // Train dips down 5~7px and springs back
    if (trainManager) {
      trainManager.triggerDeckWeightDip(6);
    }
    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        '+$200 (HEAVY)',
        '#f1c40f',
        '20px'
      );
    }

    this.telemetry.onHookDelivered(this.typeId);
    this.destroy();
  }

  public onImpact(ctx: ImpactContext): void {
    // Heavy weapon impact: damage = clamp(relativeSpeed * 0.18, 10, 80)
    const damage = Phaser.Math.Clamp(ctx.relativeSpeed * 0.18, 10, 80);
    ctx.damage = damage;
    this.audio.playHookHit();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        ctx.hitX,
        ctx.hitY,
        `-${Math.round(damage)} SMASH!`,
        '#e74c3c',
        '24px'
      );
      (this.scene as any).juice.screenShake(6, 150);
    }

    this.telemetry.recordCrossInteraction('HEAVY_OBJECT_HIT_ENEMY', `Safe dealt ${Math.round(damage)} dmg`);
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
    return ['METAL', 'HEAVY', 'CARGO', 'MAGNETIC', 'HOOKABLE'];
  }
  public hasTag(tag: EntityTag): boolean {
    return this.getTags().includes(tag);
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }
  public setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
    this.shadow.setPosition(x, y + 18);
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

    if (!this._isLatched && !this._isDelivered) {
      // Free flying / drifting with world speed or momentum
      this.container.x += (this.vx - worldSpeed) * dt;
      this.container.y += this.vy * dt;
      this.shadow.setPosition(this.container.x, this.container.y + 18);

      // Natural drag
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
