import Phaser from 'phaser';
import { GrappleFSM } from './GrappleFSM';
import { GrappleVisual } from './GrappleVisual';
import { WorldItem } from '../items/WorldItem';
import { TrainManager } from '../train/TrainManager';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { AudioManager } from '../fx/AudioManager';
import { EventBus } from '../core/EventBus';
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
  private rejectionTimer: number = 0;
  private rejectionReason: 'OVERLOAD' | 'NO_SLOT' | null = null;

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

    if (this.latchedItem) {
      this.latchedItem.isLatched = false;
      this.latchedItem = null;
    }
    this.clearHoldingUI();
    this.fsm.setState('RETURN');
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
        // Transition immediately into pulling
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

    // Check hit collision against available items
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

    // Check max range
    if (this.distanceTraveled >= balanceData.hook.range) {
      this.fsm.setState('MISS');
      this.eventBus.emit('GRAPPLE_MISS', { distance: this.distanceTraveled });
      this.fsm.setState('RETURN');
    }
  }

  private onHitItem(item: WorldItem): void {
    this.latchedItem = item;
    item.isLatched = true;

    this.fsm.setState('HIT');
    this.juice.triggerHitStop(balanceData.hook.hitStopDuration);
    this.juice.screenShake(0.005, 120);
    this.particles.emitHitSparks(this.hookX, this.hookY, 12);
    this.audio.playHookHit();

    this.eventBus.emit('GRAPPLE_HIT', { item: item.data.id });
    this.fsm.setState('PULLING');
  }

  private updatePulling(dt: number, cranePos: { x: number; y: number }): void {
    if (!this.latchedItem) {
      this.fsm.setState('RETURN');
      return;
    }

    // Formula: clamp(650 - HookWeight * 15, 260, 650)
    const weight = this.latchedItem.hookWeight;
    const pullSpeed = Phaser.Math.Clamp(
      balanceData.hook.basePullSpeed - weight * balanceData.hook.weightPullPenalty,
      balanceData.hook.minPullSpeed,
      balanceData.hook.basePullSpeed
    );

    const dist = Phaser.Math.Distance.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);

    // Section 27: final 90px auxiliary snap mode
    if (dist <= balanceData.hook.snapDistance) {
      this.fsm.setState('DELIVER');
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.hookX, this.hookY, cranePos.x, cranePos.y);
    const step = pullSpeed * dt;

    this.hookX += Math.cos(angle) * step;
    this.hookY += Math.sin(angle) * step;

    // Attach item to hook with slight inertia sway
    this.latchedItem.container.setPosition(this.hookX, this.hookY);
    this.latchedItem.shadow.setPosition(this.hookX, this.hookY + 20);

    // Dust particles for heavy items
    if (weight >= 8) {
      this.particles.emitWheelDust(this.hookX, this.hookY + 10);
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

      this.eventBus.emit('ITEM_DELIVERED', { item: itemData.id });
      this.fsm.setState('IDLE');
      return;
    }

    // 2. Handle Persistent / Car items
    const fitsLoad = this.trainManager.canFitLoad(itemData);
    const hasSlot = this.trainManager.hasSlotFor(itemData);

    if (fitsLoad && hasSlot) {
      // Successful installation!
      const installed = this.trainManager.installItem(itemData);
      if (installed) {
        this.latchedItem.isDelivered = true;
        this.latchedItem.destroy();
        this.latchedItem = null;

        this.eventBus.emit('ITEM_DELIVERED', { item: itemData.id });
        this.fsm.setState('IDLE');
        return;
      }
    }

    // 3. Failed fit: Enter 1.0 second holding window (Sections 108, 109, 110)
    this.fsm.setState('REJECTED');
    this.rejectionTimer = balanceData.hook.decisionWindowDuration; // 1.0 second
    this.rejectionReason = !fitsLoad ? 'OVERLOAD' : 'NO_SLOT';

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
      const label = this.rejectionReason === 'OVERLOAD' ? 'OVERLOAD' : 'NO SLOT';
      this.holdingText.setText(`[${label}! DROP ITEM: ${remainingSec}s]`);
    }

    if (this.rejectionTimer <= 0) {
      // 1.0s expired without resolution: release item!
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
      // Player dropped an item to make room within the 1.0s window! (Section 109)
      const installed = this.trainManager.installItem(itemData);
      if (installed) {
        this.juice.showFloatingText(this.hookX, this.hookY - 40, 'SPACE FREED: INSTALLED!', '#2ecc71', '24px');
        this.latchedItem.isDelivered = true;
        this.latchedItem.destroy();
        this.latchedItem = null;

        this.clearHoldingUI();
        this.eventBus.emit('ITEM_DELIVERED', { item: itemData.id });
        this.fsm.setState('IDLE');
      }
    }
  }

  private releaseAndDiscardLatchedItem(): void {
    if (!this.latchedItem) return;

    const item = this.latchedItem;
    item.isLatched = false;
    this.latchedItem = null;

    // Fling item backwards away onto track
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

  private showHoldingUI(reason: 'OVERLOAD' | 'NO_SLOT'): void {
    if (!this.holdingText) {
      this.holdingText = this.scene.add.text(this.hookX, this.hookY - 60, '', {
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
