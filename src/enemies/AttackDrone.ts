import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';

export type DroneState = 'APPROACH' | 'TELEGRAPH' | 'ATTACK' | 'RETREAT' | 'EXIT';

export class AttackDrone {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public id: string = 'drone';
  public hp: number = 45; // Section 109: HP = 45
  public maxHp: number = 45;
  public isDead: boolean = false;
  public priority: number = 2;

  public state: DroneState = 'APPROACH';
  private attackInterval: number = 1.5; // Section 109: 1.5s
  private attackTimer: number = 0;
  private telegraphTimer: number = 0.8; // Section 109: 0.8s
  private shotsFired: number = 0;
  private maxShots: number = 3; // Section 109: Max 3 shots (12 dmg max)
  private damage: number = 4;
  private healthBar: Phaser.GameObjects.Graphics;
  private laserPointer: Phaser.GameObjects.Graphics;
  private onAttackTrain: (damage: number) => void;
  private baseY: number;

  public get isTelegraphing(): boolean {
    return this.state === 'TELEGRAPH';
  }

  public get isRetreating(): boolean {
    return this.state === 'RETREAT' || this.state === 'EXIT';
  }

  constructor(scene: Phaser.Scene, startX: number, startY: number, onAttack: (damage: number) => void) {
    this.scene = scene;
    this.baseY = startY;
    this.onAttackTrain = onAttack;

    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.25);
    this.shadow.fillEllipse(0, 0, 36, 12);
    this.shadow.setPosition(startX, 620);
    this.shadow.setDepth(18);

    this.container = scene.add.container(startX, startY);
    this.container.setDepth(23);

    this.buildVisuals();

    this.laserPointer = scene.add.graphics();
    this.laserPointer.setDepth(24);
    this.laserPointer.setVisible(false);

    this.healthBar = scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar();

    EventBus.getInstance().emit('ENEMY_SPAWN', { type: 'drone', hp: this.hp });
  }

  private buildVisuals(): void {
    const g = this.scene.add.graphics();

    g.lineStyle(2, 0x34495e, 1);
    g.lineBetween(-22, -10, 22, 10);
    g.lineBetween(-22, 10, 22, -10);

    g.fillStyle(0x7f8c8d, 0.7);
    g.fillEllipse(-22, -10, 14, 4);
    g.fillEllipse(22, -10, 14, 4);
    g.fillEllipse(-22, 10, 14, 4);
    g.fillEllipse(22, 10, 14, 4);

    g.fillStyle(0xd35400, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(2, 0xa04000, 1);
    g.strokeCircle(0, 0, 12);

    g.fillStyle(0xff0033, 1);
    g.fillCircle(0, 2, 4.5);

    g.fillStyle(0x111111, 1);
    g.fillRect(-2, 10, 4, 8);

    this.container.add(g);
  }

  private updateHealthBar(): void {
    const g = this.healthBar;
    g.clear();
    const width = 30;
    const height = 3;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);

    g.fillStyle(0x000000, 0.7);
    g.fillRect(-width / 2, -22, width, height);

    g.fillStyle(pct > 0.5 ? 0x2ecc71 : 0xe74c3c, 1);
    g.fillRect(-width / 2, -22, width * pct, height);
  }

  public takeDamage(dmg: number): void {
    if (this.isDead) return;
    this.hp -= dmg;
    this.updateHealthBar();

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0.4,
      yoyo: true,
      duration: 50,
    });

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  public update(dt: number, worldSpeed: number, trainFrontX: number, baseSpeedPx: number = 160): void {
    if (this.isDead) return;

    const hover = Math.sin(this.scene.time.now * 0.005) * 12;
    this.container.y = this.baseY + hover;
    this.shadow.x = this.container.x;

    const closingBonus = Math.max(0, (baseSpeedPx - worldSpeed) * 0.8);

    switch (this.state) {
      case 'APPROACH':
        this.container.x -= (worldSpeed + 35 + closingBonus) * dt;
        if (this.container.x - trainFrontX <= 540) {
          this.state = 'TELEGRAPH';
          this.telegraphTimer = 0.8;
          this.laserPointer.setVisible(true);
        }
        break;

      case 'TELEGRAPH':
        this.container.x -= (worldSpeed + 10) * dt;
        this.telegraphTimer -= dt;

        // Render faint targeting line
        this.laserPointer.clear();
        this.laserPointer.lineStyle(1, 0xff0000, 0.4);
        this.laserPointer.lineBetween(this.container.x, this.container.y, trainFrontX - 50, 710);

        if (this.telegraphTimer <= 0) {
          this.laserPointer.setVisible(false);
          this.state = 'ATTACK';
          this.attackTimer = 0;
          this.fireLaserAtTrain();
        }
        break;

      case 'ATTACK':
        if (this.container.x > trainFrontX + 160) {
          this.container.x -= (worldSpeed + 15) * dt;
        } else if (this.container.x < trainFrontX) {
          this.container.x += 40 * dt;
        }

        this.attackTimer += dt;
        if (this.attackTimer >= this.attackInterval) {
          this.attackTimer = 0;
          this.fireLaserAtTrain();
        }
        break;

      case 'RETREAT':
        this.container.x -= (worldSpeed + 65) * dt;
        this.baseY -= 45 * dt;
        if (this.container.x < -160 || this.container.y < 100) {
          this.state = 'EXIT';
          this.isDead = true;
          this.shadow.destroy();
          this.laserPointer.destroy();
          EventBus.getInstance().emit('ENEMY_ESCAPED', { type: 'drone' });
          this.container.destroy();
        }
        break;
    }
  }

  private fireLaserAtTrain(): void {
    if (this.shotsFired >= this.maxShots) {
      this.state = 'RETREAT';
      return;
    }

    this.shotsFired++;

    const laser = this.scene.add.graphics();
    laser.lineStyle(2.5, 0xff0044, 0.95);
    laser.lineBetween(this.container.x, this.container.y + 12, 530, 710);
    laser.setDepth(33);
    this.scene.time.delayedCall(90, () => laser.destroy());

    this.onAttackTrain(this.damage);

    if (this.shotsFired >= this.maxShots) {
      this.state = 'RETREAT';
    }
  }

  private die(): void {
    this.isDead = true;
    EventBus.getInstance().emit('ENEMY_KILLED', { type: 'drone' });
    this.shadow.destroy();
    this.laserPointer.destroy();

    this.scene.tweens.add({
      targets: this.container,
      y: this.container.y + 120,
      x: this.container.x - 80,
      angle: 360,
      alpha: 0,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.destroy();
      },
    });
  }
}
