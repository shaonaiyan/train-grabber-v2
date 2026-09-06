import Phaser from 'phaser';
import { HookableEntity, EntityTag, HookContext, ImpactContext, V4ObjectRegistry } from '../V4ObjectRegistry';
import { V4Audio } from '../V4Audio';
import { V4Telemetry } from '../V4Telemetry';
import { V4_BALANCE } from '../V4Balance';

export type MagnetState = 'OFF' | 'COOLDOWN' | 'CHARGING' | 'ACTIVE' | 'OVERCHARGED';

export class GiantMagnetBehavior implements HookableEntity {
  public instanceId: string;
  public typeId: string = 'giant_magnet_v4';
  public name: string = 'Giant Electromagnet';

  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public magnetGraphics: Phaser.GameObjects.Graphics;
  public coilGlow: Phaser.GameObjects.Graphics;
  public fieldAura: Phaser.GameObjects.Graphics;

  private _isLatched: boolean = false;
  private _isDelivered: boolean = false;
  private _isDestroyed: boolean = false;

  public state: MagnetState = 'OFF';
  private timer: number = 0;
  private isUserDisabled: boolean = false;

  public vx: number = 0;
  public vy: number = 0;
  public hookWeight: number = 12;
  public installedWeight: number = 10;
  public lootValue: number = 40;

  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene, x: number, y: number, instanceId?: string) {
    this.scene = scene;
    this.instanceId = instanceId || `magnet_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.4);
    this.shadow.fillEllipse(0, 0, 48, 14);
    this.shadow.setPosition(x, y + 18);
    this.shadow.setDepth(29);

    this.container = scene.add.container(x, y);
    this.container.setDepth(40);

    // Magnetic field ripple aura
    this.fieldAura = scene.add.graphics();
    this.fieldAura.setVisible(false);

    this.magnetGraphics = scene.add.graphics();
    this.coilGlow = scene.add.graphics();

    this.drawVisuals();
    this.container.add([this.fieldAura, this.magnetGraphics, this.coilGlow]);

    V4ObjectRegistry.getInstance().register(this);
    this.telemetry.recordSeen(this.typeId);
  }

  private drawVisuals(chargeRatio: number = 0): void {
    const g = this.magnetGraphics;
    g.clear();

    // Heavy iron U-shaped chassis
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-18, -16, 36, 32, 4);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-18, -16, 36, 32, 4);

    // Center horseshoe recess
    g.fillStyle(0x111111, 1);
    g.fillRect(-10, -8, 20, 24);

    // Copper winding coils
    g.fillStyle(0xd35400, 1);
    g.fillRect(-16, -12, 6, 20);
    g.fillRect(10, -12, 6, 20);

    // Pole tips (Chrome plated)
    g.fillStyle(0xbdc3c7, 1);
    g.fillRect(-16, 8, 6, 6);
    g.fillRect(10, 8, 6, 6);

    // Yellow warning strobe on top
    g.fillStyle(0xf1c40f, 1);
    g.fillCircle(0, -16, 4);

    // Dynamic Coil Glow
    const glow = this.coilGlow;
    glow.clear();
    if (chargeRatio > 0) {
      glow.fillStyle(0x00ffff, 0.4 * chargeRatio);
      glow.fillCircle(0, 0, 24 * chargeRatio);
      glow.fillStyle(0xffffff, 0.8 * chargeRatio);
      glow.fillCircle(0, 0, 8 * chargeRatio);
    }
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
    this.vx = ctx.hookVx ?? -100;
    this.vy = ctx.hookVy ?? 0;
    this.telemetry.onHookReleased(this.typeId);
  }

  public onDeliveredToTrain(trainManager: any): void {
    this._isLatched = false;
    this._isDelivered = true;
    this.state = 'COOLDOWN';
    this.timer = 1.0; // Quick initial activation
    this.audio.playInstallClank();

    if ((this.scene as any).juice) {
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 30,
        'MAGNET ONLINE (RIGHT-CLICK TO TOGGLE)',
        '#00ffcc',
        '20px'
      );
    }

    this.telemetry.onHookDelivered(this.typeId);
  }

  public toggleUserSwitch(): void {
    if (!this._isDelivered) return;
    this.isUserDisabled = !this.isUserDisabled;

    if (this.isUserDisabled) {
      this.state = 'OFF';
      this.fieldAura.setVisible(false);
      this.drawVisuals(0);
      if ((this.scene as any).juice) {
        (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 25, 'MAGNET OFF', '#e74c3c', '20px');
      }
      this.telemetry.recordRegret('MAGNET_DISABLED_MANUAL', 'Player manually toggled off magnet');
    } else {
      this.state = 'COOLDOWN';
      this.timer = 1.0;
      if ((this.scene as any).juice) {
        (this.scene as any).juice.showFloatingText(this.container.x, this.container.y - 25, 'MAGNET ON', '#2ecc71', '20px');
      }
    }
  }

  public onImpact(ctx: ImpactContext): void {
    this.audio.playInstallClank();
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
    return ['METAL', 'MODULE', 'HOOKABLE'];
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
      this.shadow.setPosition(this.container.x, this.container.y + 18);

      this.vx *= 0.98;
      this.vy *= 0.98;

      if (this.container.x < -150) {
        this.destroy();
        this.telemetry.recordMissed(this.typeId);
      }
      return;
    }

    if (this._isDelivered && !this.isUserDisabled) {
      const trainMgr = (this.scene as any).trainManager;

      // Battery recharge reduction perk (-20% per battery, max -40%)
      let cdMul = 1.0;
      if (trainMgr) {
        const batCount = trainMgr.getBatteryCount();
        cdMul = Math.max(0.6, 1.0 - batCount * 0.2);
      }

      this.timer -= dt;

      if (this.state === 'COOLDOWN') {
        this.drawVisuals(0);
        this.fieldAura.setVisible(false);

        if (this.timer <= 0) {
          this.state = 'CHARGING';
          this.timer = V4_BALANCE.MAGNET.CHARGE_DURATION;
          this.audio.playMagnetCharge();
        }
      } else if (this.state === 'CHARGING') {
        const progress = 1.0 - Math.max(0, this.timer / V4_BALANCE.MAGNET.CHARGE_DURATION);
        this.drawVisuals(progress);

        if (this.timer <= 0) {
          this.state = 'ACTIVE';
          this.timer = V4_BALANCE.MAGNET.ACTIVE_DURATION;
          this.fieldAura.setVisible(true);
          this.audio.playMagnetHum();
          this.telemetry.recordConsequence('MAGNET_PULSE');
        }
      } else if (this.state === 'ACTIVE') {
        this.drawVisuals(1.0);
        this.renderMagneticFieldAura();
        this.attractNearbyEntities(dt);

        if (this.timer <= 0) {
          this.state = 'COOLDOWN';
          this.timer = V4_BALANCE.MAGNET.COOLDOWN * cdMul;
          this.fieldAura.setVisible(false);
        }
      } else if (this.state === 'OVERCHARGED') {
        this.drawVisuals(0.3);
        if (this.timer <= 0) {
          this.state = 'COOLDOWN';
          this.timer = V4_BALANCE.MAGNET.COOLDOWN * cdMul;
        }
      }
    }
  }

  private renderMagneticFieldAura(): void {
    const a = this.fieldAura;
    a.clear();
    const radius = V4_BALANCE.MAGNET.RADIUS;

    // Expanding concentric cyan rings
    const pulse = (this.scene.time.now * 0.003) % 1.0;
    a.lineStyle(2, 0x00ffff, 0.4 * (1 - pulse));
    a.strokeCircle(0, 0, radius * pulse);
    a.fillStyle(0x00ffff, 0.03);
    a.fillCircle(0, 0, radius);
  }

  private attractNearbyEntities(dt: number): void {
    const registry = V4ObjectRegistry.getInstance();
    const targets = registry.getMagneticLooseEntities();
    const magnetX = this.container.x;
    const magnetY = this.container.y;
    const maxRadius = V4_BALANCE.MAGNET.RADIUS;

    let affectedCount = 0;

    for (const entity of targets) {
      const pos = entity.getPosition();
      const dist = Phaser.Math.Distance.Between(magnetX, magnetY, pos.x, pos.y);

      if (dist <= maxRadius && dist > 15) {
        affectedCount++;
        const angle = Phaser.Math.Angle.Between(pos.x, pos.y, magnetX, magnetY);
        // Force scales with inverse distance (350~900 px/s²)
        const t = 1.0 - dist / maxRadius;
        const force = V4_BALANCE.MAGNET.FORCE_MIN + t * (V4_BALANCE.MAGNET.FORCE_MAX - V4_BALANCE.MAGNET.FORCE_MIN);

        const currentVel = entity.getVelocity ? entity.getVelocity() : { x: 0, y: 0 };
        const newVx = currentVel.x + Math.cos(angle) * force * dt;
        const newVy = currentVel.y + Math.sin(angle) * force * dt;

        if (entity.setVelocity) {
          entity.setVelocity(newVx * 0.96, newVy * 0.96);
        } else {
          entity.setPosition(pos.x + newVx * dt, pos.y + newVy * dt);
        }

        // Cross-system telemetry: pulling explosive or safe
        if (entity.hasTag('EXPLOSIVE')) {
          this.telemetry.recordCrossInteraction('MAGNET_PULLED_EXPLOSIVE');
        } else if (entity.hasTag('HEAVY')) {
          this.telemetry.recordCrossInteraction('MAGNET_SLIDING_HEAVY_SAFE');
        }
      }
    }

    // Section 131: Magnet Overcharge if >= 5 metal entities affected simultaneously
    if (affectedCount >= V4_BALANCE.MAGNET.OVERCHARGE_COUNT && this.state === 'ACTIVE') {
      this.triggerOvercharge();
    }
  }

  private triggerOvercharge(): void {
    this.state = 'OVERCHARGED';
    this.timer = V4_BALANCE.MAGNET.OVERCHARGE_OFF_TIME;
    this.fieldAura.setVisible(false);
    this.audio.playMagnetOvercharge();

    const particles = (this.scene as any).particles;
    if (particles) {
      particles.emitSparks(this.container.x, this.container.y, 24);
    }

    if ((this.scene as any).juice) {
      (this.scene as any).juice.screenShake(6, 200);
      (this.scene as any).juice.showFloatingText(
        this.container.x,
        this.container.y - 35,
        'OVERCHARGE!! SHUTDOWN (4s)',
        '#e74c3c',
        '24px'
      );
    }

    // Panic sheep on train
    const registry = V4ObjectRegistry.getInstance();
    const sheeps = registry.getAll().filter((e) => e.typeId === 'sheep_v4');
    for (const sheep of sheeps) {
      (sheep as any).triggerPanic('MAGNET_OVERCHARGE');
    }

    this.telemetry.recordConsequence('MAGNET_OVERCHARGE');
  }

  public destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    V4ObjectRegistry.getInstance().unregister(this.instanceId);
    if (this.shadow) this.shadow.destroy();
    if (this.container) this.container.destroy();
  }
}
