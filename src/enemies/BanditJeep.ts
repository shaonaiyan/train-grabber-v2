import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';

export class BanditJeep {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public hp: number = 75;
  public maxHp: number = 75;
  public isDead: boolean = false;
  public priority: number = 1;

  private attackInterval: number = 1.3;
  private attackTimer: number = 0;
  private damage: number = 6;
  private speed: number = 190;
  private healthBar: Phaser.GameObjects.Graphics;
  private onAttackTrain: (damage: number) => void;

  constructor(scene: Phaser.Scene, startX: number, startY: number, onAttack: (damage: number) => void) {
    this.scene = scene;
    this.onAttackTrain = onAttack;

    this.container = scene.add.container(startX, startY);
    this.container.setDepth(26);

    this.buildVisuals();

    this.healthBar = scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar();

    EventBus.getInstance().emit('ENEMY_SPAWN', { type: 'bandit', hp: this.hp });
  }

  private buildVisuals(): void {
    const g = this.scene.add.graphics();

    // Spiked bumper
    g.fillStyle(0x7f8c8d, 1);
    g.fillTriangle(-45, 10, -30, 2, -30, 18);
    g.fillTriangle(-40, 6, -26, 0, -26, 14);

    // Rusty armored buggy body
    g.fillStyle(0x8e44ad, 1);
    g.fillRoundedRect(-32, -10, 64, 22, 3);
    g.lineStyle(2, 0x4a235a, 1);
    g.strokeRoundedRect(-32, -10, 64, 22, 3);

    // Roll cage
    g.lineStyle(2.5, 0x2c3e50, 1);
    g.lineBetween(-15, -10, -5, -24);
    g.lineBetween(-5, -24, 22, -24);
    g.lineBetween(22, -24, 28, -10);

    // Bandit gunner
    g.fillStyle(0xe74c3c, 1);
    g.fillCircle(8, -18, 5); // Red bandana
    g.fillStyle(0x111111, 1);
    g.fillRect(10, -20, 18, 4); // Machinegun barrel

    // Massive off-road wheels
    g.fillStyle(0x1a252f, 1);
    g.fillCircle(-20, 14, 11);
    g.fillCircle(20, 14, 11);
    g.fillStyle(0x95a5a6, 1);
    g.fillCircle(-20, 14, 4);
    g.fillCircle(20, 14, 4);

    this.container.add(g);
  }

  private updateHealthBar(): void {
    const g = this.healthBar;
    g.clear();
    const width = 36;
    const height = 4;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);

    g.fillStyle(0x000000, 0.7);
    g.fillRect(-width / 2, -32, width, height);

    g.fillStyle(pct > 0.5 ? 0x2ecc71 : 0xe74c3c, 1);
    g.fillRect(-width / 2, -32, width * pct, height);
  }

  public takeDamage(dmg: number): void {
    if (this.isDead) return;
    this.hp -= dmg;
    this.updateHealthBar();

    // Damage flash
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0.5,
      yoyo: true,
      duration: 60,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  public update(dt: number, worldSpeed: number, trainFrontX: number): void {
    if (this.isDead) return;

    // Movement: drives towards the train's side
    if (this.container.x > trainFrontX + 180) {
      // Approach from ahead/behind
      this.container.x -= (worldSpeed + 35) * dt;
    } else if (this.container.x < trainFrontX - 250) {
      // Catching up from behind
      this.container.x += 60 * dt;
    } else {
      // Cruising beside train
      this.container.x += Math.sin(this.scene.time.now * 0.003) * 0.5;
    }

    // Attack cycle
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackInterval) {
      this.attackTimer = 0;
      this.fireAtTrain();
    }
  }

  private fireAtTrain(): void {
    // Muzzle flash on gunner
    const flash = this.scene.add.graphics();
    flash.fillStyle(0xffeb3b, 1);
    flash.fillCircle(this.container.x + 30, this.container.y - 20, 7);
    flash.setDepth(33);
    this.scene.time.delayedCall(70, () => flash.destroy());

    this.onAttackTrain(this.damage);
  }

  private die(): void {
    this.isDead = true;
    EventBus.getInstance().emit('ENEMY_KILLED', { type: 'bandit' });

    // Wreck flip animation
    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y + 30,
      x: this.container.x - 120,
      angle: 60,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.container.destroy();
      },
    });
  }
}
