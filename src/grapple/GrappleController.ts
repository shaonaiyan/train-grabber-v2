import Phaser from 'phaser';
import { GrappleFSM } from './GrappleFSM';
import { GrappleVisual } from './GrappleVisual';
import { WorldItem } from '../items/WorldItem';
import { TrainManager } from '../train/TrainManager';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { AudioManager } from '../fx/AudioManager';
import { EventBus } from '../core/EventBus';
import { V4ObjectRegistry, HookableEntity } from '../v4/V4ObjectRegistry';
import balanceData from '../data/balance.json';

export class GrappleController {
  private scene: Phaser.Scene;
  public fsm: GrappleFSM;
  public visual: GrappleVisual;
  private trainManager: TrainManager;
  private particles: ParticleManager;
  private juice: JuiceManager;
  private audio: AudioManager;
  private eventBus: EventBus;

  // Hook position
  public hookX: number = 0;
  public hookY: number = 0;
  private fireOriginX: number = 0;
  private fireOriginY: number = 0;
  private fireDirX: number = 0;
  private fireDirY: number = 0;
  private distanceTraveled: number = 0;

  // Active target
  private latchedItem: WorldItem | null = null;
  public latchedV4Entity: HookableEntity | null = null;
  private rejectionTimer: number = 0;
  private rejectionReason: string | null = null;

  // V2.1 Damped Spring & Heavy Tightening Physics
  private itemVisualX: number = 0;
  private itemVisualY: number = 0;
  private itemVx: number = 0;
  private itemVy: number = 0;
  private tightenTimer: number = 0;
  private dragParticleTimer: number = 0;

  // Holding warning text
  private holdingText: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    particles: ParticleManager,
    juice: JuiceManager
  ) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.particles = particles;
    this.juice = juice;
    this.audio = AudioManager.getInstance();
    this.eventBus = EventBus.getInstance();

    this.fsm = new GrappleFSM();
    this.visual = new GrappleVisual(scene);

    const cranePos = this.trainManager.getCranePosition();
    this.hookX = cranePos.x;
    this.hookY = cranePos.y;

    // Listen for module discards to handle the 1-second holding window resolution (Section 109-110)
    this.eventBus.on('ITEM_DISCARDED', () => {
      this.checkHoldingResolution();
    });
  }

  public fire(targetX: number, targetY: number, availableItems: WorldItem[]): boolean {
    if (this.fsm.isBusy()) return false;

    const cranePos = this.trainManager.getCranePosition();
    this.fireOriginX = cranePos.x;
    this.fireOriginY = cranePos.y;
    this.hookX = cranePos.x;
    this.hookY = cranePos.y;

    const angle = Phaser.Math.Angle.Between(this.hookX, this.hookY, targetX, targetY);
    this.fireDirX = Math.cos(angle);
    this.fireDirY = Math.sin(angle);
    this.distanceTraveled = 0;
    this.latchedItem = null;

    this.fsm.setState('FLYING');
    this.visual.triggerRecoil();
    this.audio.playHookLaunch();

    this.eventBus.emit('GRAPPLE_FIRE', { targetX, targetY });
    return true;
  }

  public releaseCurrentTarget(): void {
    if (this.fsm.isIdle()) return;

    if (this.latchedV4Entity) {
      const cranePos = this.trainManager.getCranePosition();
      const angle = Phaser.Math.Angle.Between(cranePos.x, cranePos.y, this.hookX, this.hookY);
      const throwSpeed = 260;
      this.latchedV4Entity.onHookRelease({
        hookX: this.hookX,
        hookY: this.hookY,
        hookVx: Math.cos(angle) * throwSpeed,
        hookVy: Math.sin(angle) * throwSpeed,
        timeSec: (this.scene as any).currentTime || 0,
      });
      this.latchedV4Entity = null;
      this.clearHoldingUI();
      this.fsm.setState('RETURN');
      return;
    }

    if (this.latchedItem) {
      this.releaseAndDiscardLatchedItem();
      this.clearHoldingUI();
      this.fsm.setState('RETURN');
    }
  }

  public isHoldingOrReeling(): boolean {
    return this.latchedItem !== null || this.latchedV4Entity !== null;
  }

  public update(delta: number, availableItems: WorldItem[]): void {
    const dt = delta * 0.001;
    const cranePos = this.trainManager.getCranePosition();
    const state = this.fsm.getState();

    switch (state) {
      case 'IDLE':
      case 'AIM':
        this.hookX = cranePos.x;
        this.hookY = cranePos.y;
        break;

      case 'FLYING':
        this.updateFlying(dt, availableItems, cranePos);
        break;

      case 'HIT':
        this.fsm.setState('PULLING');
        break;

      case 'PULLING':
        this.updatePulling(dt, cranePos);
        break;

      case 'DELIVER':
        this.updateDeliver(cranePos);
        break;

      case 'REJECTED':
        this.updateRejected(dt, cranePos);
        break;

      case 'MISS':
      case 'RETURN':
        this.updateReturn(dt, cranePos);
        break;
    }

    // Update visuals
    this.visual.updateVisuals(
      cranePos.x,
      cranePos.y,
      this.hookX,
      this.hookY,
      this.fsm.isIdle(),
      this.latchedItem !== null
    );
  }

  private updateFlying(dt: number, availableItems: WorldItem[], cranePos: { x: number; y: number }): void {
    const step = balanceData.hook.flySpeed * dt;
    this.hookX += this.fireDirX * step;
    this.hookY += this.fireDirY * step;
    this.distanceTraveled += step;

    // Check V4 entities first
    const v4Targets = V4ObjectRegistry.getInstance().getHookableTargets();
    for (const v4 of v4Targets) {
      const pos = v4.getPosition();
      const dist = Phaser.Math.Distance.Between(this.hookX, this.hookY, pos.x, pos.y);
      if (dist <= 42) {
        this.onHitV4Entity(v4);
        return;
      }
    }

    for (const item of availableItems) {
      if (item.isLatched || item.isDelivered || item.isDestroyed) continue;

      const dist = Phaser.Math.Distance.Between(
        this.hookX,
        this.hookY,
        item.container.x,
        item.container.y
      );

      // Hitbox: HookRadius (18) + item visual radius (~16) = ~34px
      if (dist <= 34) {
        this.onHitItem(item);
        return;
      }
    }

    if (this.distanceTraveled >= balanceData.hook.range) {
      this.fsm.setState('MISS');
      this.eventBus.emit('GRAPPLE_MISS', { distance: this.distanceTraveled });
      this.fsm.setState('RETURN');
    }
  }

  private onHitItem(item: WorldItem): void {
    this.latchedItem = item;
    item.isLatched = true;

    // Initialize Damped Spring state
    this.itemVisualX = item.container.x;
    this.itemVisualY = item.container.y;
    this.itemVx = 0;
    this.itemVy = 0;

    // Section 39: Heavy chain tightening phase (80~140ms)
    const weight = item.hookWeight;
    if (weight >= 11) {
      this.tightenTimer = balanceData.hook.tightenDuration * 0.001;
    } else {
      this.tightenTimer = 0;
    }

    this.fsm.setState('HIT');
    this.juice.triggerHitStop(balanceData.hook.hitStopDuration);
    this.juice.screenShake(0.004, 100);
    this.particles.emitHitSparks(this.hookX, this.hookY, 12);
    this.audio.playHookHit();

    this.eventBus.emit('GRAPPLE_HIT', { item: item.data.id });
    this.fsm.setState('PULLING');
  }

  private onHitV4Entity(entity: HookableEntity): void {
    this.latchedV4Entity = entity;
    const timeSec = (this.scene as any).currentTime || 0;
    entity.onHookLatch({
      hookX: this.hookX,
      hookY: this.hookY,
      timeSec,
    });

    const weight = entity.getHookWeight();
    this.tightenTimer = weight >= 11 ? 0.12 : 0;

    this.fsm.setState('HIT');
    this.juice.triggerHitStop(balanceData.hook.hitStopDuration);
    this.juice.screenShake(0.005, 120);
    this.particles.emitHitSparks(this.hookX, this.hookY, 14);
    this.audio.playHookHit();

    this.eventBus.emit('GRAPPLE_HIT', { item: entity.typeId });
    this.fsm.setState('PULLING');
  }

  private deliverV4Entity(entity: HookableEntity, cranePos: { x: number; y: number }): void {
    entity.onDeliveredToTrain(this.trainManager);

    // Install as persistent cargo or module
    if (entity.typeId !== 'flat_car_v4' && entity.typeId !== 'drone_v4') {
      this.trainManager.installItem({
        id: entity.typeId as any,
        name: entity.name,
        type: entity.hasTag('MODULE') ? 'Module' : 'Cargo',
        load: entity.getInstalledWeight(),
        cargoValue: entity.getLootValue(),
        slot: entity.hasTag('MODULE') ? 'SIDE' : undefined,
        description: '',
      });
    }

    this.eventBus.emit('ITEM_DELIVERED', {
      item: entity.typeId as any,
      instanceId: entity.instanceId,
    });

    this.latchedV4Entity = null;
    this.fsm.setState('IDLE');
  }

  public transformLatchedItemIntoTurret(): void {
    this.latchedV4Entity = null;
    this.trainManager.installItem({
      id: 'turret',
      name: 'Salvaged Machine Gun',
      type: 'Module',
      slot: 'TOP',
      load: 6,
      damage: 7,
      baseFireRate: 2.5,
      range: 650,
      description: 'Torn directly from Bandit Jeep!',
    });
    this.clearHoldingUI();
    this.fsm.setState('RETURN');
  }

  private updatePulling(dt: number, cranePos: { x: number; y: number }): void {
    if (this.latchedV4Entity) {
      const weight = this.latchedV4Entity.getHookWeight();
      if (this.tightenTimer > 0) {
        this.tightenTimer -= dt;
        return;
      }

      // Base reel speed with heavy object drag
      const baseReel = balanceData.hook.basePullSpeed;
      const weightPenalty = Math.min(0.65, (weight / 25) * 0.65);
      const effectiveReel = baseReel * (1.0 - weightPenalty);
      const step = effectiveReel * dt;

      const dist = Phaser.Math.Distance.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);

      if (dist <= Math.max(step, 36)) {
        this.deliverV4Entity(this.latchedV4Entity, cranePos);
      } else {
        const angle = Phaser.Math.Angle.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);
        this.hookX += Math.cos(angle) * step;
        this.hookY += Math.sin(angle) * step;
        this.latchedV4Entity.onHookPull(
          { hookX: this.hookX, hookY: this.hookY, timeSec: (this.scene as any).currentTime || 0 },
          dt
        );
      }
      return;
    }

    if (!this.latchedItem) {
      this.fsm.setState('RETURN');
      return;
    }

    const weight = this.latchedItem.hookWeight;

    // Section 39: Chain tightening pause for heavy items
    if (this.tightenTimer > 0) {
      this.tightenTimer -= dt;
      // Slight budge towards crane
      const angle = Phaser.Math.Angle.Between(this.itemVisualX, this.itemVisualY, cranePos.x, cranePos.y);
      this.itemVisualX += Math.cos(angle) * 12 * dt;
      this.itemVisualY += Math.sin(angle) * 12 * dt;
      this.latchedItem.container.setPosition(this.itemVisualX, this.itemVisualY);
      return;
    }

    // Pull Speed formula: clamp(650 - HookWeight * 15, 260, 650)
    const pullSpeed = Phaser.Math.Clamp(
      balanceData.hook.basePullSpeed - weight * balanceData.hook.weightPullPenalty,
      balanceData.hook.minPullSpeed,
      balanceData.hook.basePullSpeed
    );

    const dist = Phaser.Math.Distance.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);

    // Section 27: final 90px auxiliary snap
    if (dist <= balanceData.hook.snapDistance) {
      this.fsm.setState('DELIVER');
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);
    const step = pullSpeed * dt;

    this.hookX += Math.cos(angle) * step;
    this.hookY += Math.sin(angle) * step;

    // Section 37-38: Damped Spring Follow (Lag based on weight)
    let springK = 26;
    let damping = 0.70;
    if (weight >= 12) {
      springK = 10;
      damping = 0.55;
    } else if (weight >= 7) {
      springK = 18;
      damping = 0.65;
    }

    // Spring force towards hook
    const dx = this.hookX - this.itemVisualX;
    const dy = this.hookY - this.itemVisualY;
    const ax = dx * springK;
    const ay = dy * springK;

    this.itemVx = (this.itemVx + ax * dt) * Math.pow(damping, dt * 60);
    this.itemVy = (this.itemVy + ay * dt) * Math.pow(damping, dt * 60);

    this.itemVisualX += this.itemVx * dt;
    this.itemVisualY += this.itemVy * dt;

    // Clamp lag distance to max 65px (Section 38)
    const currentLag = Phaser.Math.Distance.Between(this.itemVisualX, this.itemVisualY, this.hookX, this.hookY);
    if (currentLag > balanceData.hook.maxLag) {
      const lagAngle = Phaser.Math.Angle.Between(this.hookX, this.hookY, this.itemVisualX, this.itemVisualY);
      this.itemVisualX = this.hookX + Math.cos(lagAngle) * balanceData.hook.maxLag;
      this.itemVisualY = this.hookY + Math.sin(lagAngle) * balanceData.hook.maxLag;
    }

    // Section 40: Rotation swing ±8°~18° based on velocity
    const swing = Phaser.Math.Clamp(this.itemVx * 0.04, -0.28, 0.28);
    this.latchedItem.container.setRotation(swing);

    this.latchedItem.container.setPosition(this.itemVisualX, this.itemVisualY);
    this.latchedItem.shadow.setPosition(this.itemVisualX, this.itemVisualY + 16);

    // Section 41: Ground dragging dust/sparks for heavy ground loot
    const itemId = this.latchedItem.data.id;
    const isGroundScrap = itemId === 'gold' || itemId === 'fridge' || itemId === 'junk' || itemId === 'flat_car' || itemId === 'explosive';
    if (isGroundScrap && this.itemVisualY >= 530) {
      this.dragParticleTimer += dt;
      if (this.dragParticleTimer >= 0.12) {
        this.dragParticleTimer = 0;
        this.particles.emitWheelDust(this.itemVisualX, this.itemVisualY + 14);
        if (weight >= 12) {
          this.particles.emitHitSparks(this.itemVisualX, this.itemVisualY + 14, 3);
        }
      }
    }
  }

  private updateDeliver(cranePos: { x: number; y: number }): void {
    if (!this.latchedItem) {
      this.fsm.setState('RETURN');
      return;
    }

    this.hookX = cranePos.x;
    this.hookY = cranePos.y;
    this.latchedItem.container.setPosition(this.hookX, this.hookY);

    const itemData = this.latchedItem.data;

    // 1. Handle Consumables immediately
    if (itemData.type === 'Consumable') {
      if (itemData.hpBonus) {
        this.trainManager.stats.addHp(itemData.hpBonus);
        this.audio.playRepair();
        this.juice.showFloatingText(cranePos.x, cranePos.y - 30, `+${itemData.hpBonus} HP`, '#2ecc71', '24px');
      }
      if (itemData.fuelBonus) {
        this.trainManager.stats.addFuel(itemData.fuelBonus);
        this.audio.playFuelGulp();
        this.juice.showFloatingText(cranePos.x, cranePos.y - 30, `+${itemData.fuelBonus} FUEL`, '#f39c12', '24px');
      }

      this.latchedItem.isDelivered = true;
      this.latchedItem.destroy();
      this.latchedItem = null;

      this.eventBus.emit('ITEM_DELIVERED', { item: itemData.id, instanceId: itemData.instanceId, windowId: itemData.windowId, spawnPhaseId: itemData.spawnPhaseId });
      this.fsm.setState('IDLE');
      return;
    }

    // 2. Handle Cargo / Module / Car items
    const fitsLoad = this.trainManager.canFitLoad(itemData);
    const hasSlot = this.trainManager.hasSlotFor(itemData);

    if (fitsLoad && hasSlot) {
      // Successful installation!
      const installed = this.trainManager.installItem(itemData);
      if (installed) {
        const cargoBonus = itemData.cargoValue || 0;
        if (cargoBonus > 0) {
          this.juice.showFloatingText(cranePos.x, cranePos.y - 45, `CARGO +$${cargoBonus}`, '#f1c40f', '24px');
        }

        this.latchedItem.isDelivered = true;
        this.latchedItem.destroy();
        this.latchedItem = null;

        this.eventBus.emit('ITEM_DELIVERED', {
          item: itemData.id,
          instanceId: itemData.instanceId,
          siteId: itemData.siteId,
          windowId: itemData.windowId,
          spawnPhaseId: itemData.spawnPhaseId,
        });
        this.fsm.setState('IDLE');
        return;
      }
    }

    // 3. Failed fit: Enter 1.0 second holding window (Sections 33, 91, 186-187)
    this.fsm.setState('REJECTED');
    this.rejectionTimer = balanceData.hook.decisionWindowDuration; // 1.0 second
    if (itemData.type === 'Car' && !hasSlot) {
      this.rejectionReason = 'NO COUPLER CAPACITY';
    } else if (!hasSlot) {
      this.rejectionReason = itemData.type === 'Cargo' ? 'CARGO LIMIT (+2 MAX)' : 'NO MODULE SLOT';
    } else {
      this.rejectionReason = 'CRITICAL OVERLOAD (>130%)';
    }

    this.showHoldingUI(this.rejectionReason);
    this.audio.playWarning();
  }

  private updateRejected(dt: number, cranePos: { x: number; y: number }): void {
    if (!this.latchedItem) {
      this.clearHoldingUI();
      this.fsm.setState('RETURN');
      return;
    }

    this.hookX = cranePos.x;
    this.hookY = cranePos.y;
    this.latchedItem.container.setPosition(this.hookX, this.hookY);

    this.rejectionTimer -= dt;
    if (this.holdingText) {
      const remainingSec = Math.max(0, this.rejectionTimer).toFixed(1);
      this.holdingText.setText(`[${this.rejectionReason}! DISCARD TO FIT: ${remainingSec}s]`);
    }

    if (this.rejectionTimer <= 0) {
      this.eventBus.emit('ITEM_REJECTED', {
        item: this.latchedItem.data.id,
        reason: this.rejectionReason,
      });

      this.releaseAndDiscardLatchedItem();
      this.clearHoldingUI();
      this.fsm.setState('RETURN');
    }
  }

  private checkHoldingResolution(): void {
    if (this.fsm.getState() !== 'REJECTED' || !this.latchedItem) return;

    const itemData = this.latchedItem.data;
    const fitsLoad = this.trainManager.canFitLoad(itemData);
    const hasSlot = this.trainManager.hasSlotFor(itemData);

    if (fitsLoad && hasSlot) {
      const installed = this.trainManager.installItem(itemData);
      if (installed) {
        this.juice.showFloatingText(this.hookX, this.hookY - 40, 'SPACE FREED: INSTALLED!', '#2ecc71', '24px');
        this.latchedItem.isDelivered = true;
        this.latchedItem.destroy();
        this.latchedItem = null;

        this.clearHoldingUI();
        this.eventBus.emit('ITEM_DELIVERED', {
          item: itemData.id,
          instanceId: itemData.instanceId,
          siteId: itemData.siteId,
          windowId: itemData.windowId,
          spawnPhaseId: itemData.spawnPhaseId,
        });
        this.fsm.setState('IDLE');
      }
    }
  }

  private releaseAndDiscardLatchedItem(): void {
    if (!this.latchedItem) return;

    const item = this.latchedItem;
    item.isLatched = false;
    this.latchedItem = null;

    this.scene.tweens.add({
      targets: item.container,
      x: item.container.x - 220,
      y: item.container.y + 45,
      angle: 180,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        item.destroy();
      },
    });
  }

  private updateReturn(dt: number, cranePos: { x: number; y: number }): void {
    const dist = Phaser.Math.Distance.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);
    const step = balanceData.hook.flySpeed * dt;

    if (dist <= step) {
      this.hookX = cranePos.x;
      this.hookY = cranePos.y;
      this.fsm.setState('IDLE');
    } else {
      const angle = Phaser.Math.Angle.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);
      this.hookX += Math.cos(angle) * step;
      this.hookY += Math.sin(angle) * step;
    }
  }

  private showHoldingUI(reason: string): void {
    if (!this.holdingText) {
      this.holdingText = this.scene.add.text(this.hookX, this.hookY - 60, reason, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#e74c3c',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      });
      this.holdingText.setOrigin(0.5);
      this.holdingText.setDepth(160);
    } else {
      this.holdingText.setText(reason);
    }
    this.holdingText.setVisible(true);
  }

  private clearHoldingUI(): void {
    if (this.holdingText) {
      this.holdingText.destroy();
      this.holdingText = null;
    }
  }

  public getLatchedItem(): WorldItem | null {
    return this.latchedItem;
  }
}
