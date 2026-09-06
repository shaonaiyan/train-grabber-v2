import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';

export type DroneState = 'APPROACH' | 'ATTACK' | 'RETREAT' | 'EXIT';

export class AttackDrone {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public hp: number = 42;
  public maxHp: number = 42;
  public isDead: boolean = false;
  public priority: number = 2; // Priority 2 > 1 (Turret targets Drone first)

  public state: DroneState = 'APPROACH';
  private attackInterval: number = 1.8; // Section 78
  private attackTimer: number = 0;
  private shotsFired: number = 0;
  private maxShots: number = 4; // Section 78
  private damage: number = 4;
  private healthBar: Phaser.GameObjects.Graphics;
  private onAttackTrain: (damage: number) => void;
  private baseY: number;

  constructor(scene: Phaser.Scene, startX: number, startY: number, onAttack: (damage: number) => void) {
    this.scene = scene;
    this.baseY = startY;
    this.onAttackTrain = onAttack;

    // Ground contact shadow for flying drone (Section 10)
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.25);
    this.shadow.fillEllipse(0, 0, 36, 12);
    this.shadow.setPosition(startX, 620);
    this.shadow.setDepth(18);

    this.container = scene.add.container(startX, startY);
    this.container.setDepth(23);

    this.buildVisuals();

    this.healthBar = scene.add.graphics();
    this.container.add(this.healthBar);
    this.updateHealthBar();

    EventBus.getInstance().emit('ENEMY_SPAWN', { type: 'drone', hp: this.hp });
  }

  private buildVisuals(): void {
    const g = this.scene.add.graphics();

    // Quad-rotor arms
    g.lineStyle(2, 0x34495e, 1);
    g.lineBetween(-22, -10, 22, 10);
    g.lineBetween(-22, 10, 22, -10);

    // Rotors
    g.fillStyle(0x7f8c8d, 0.7);
    g.fillEllipse(-22, -10, 14, 4);
    g.fillEllipse(22, -10, 14, 4);
    g.fillEllipse(-22, 10, 14, 4);
    g.fillEllipse(22, 10, 14, 4);

    // Central fuselage
    g.fillStyle(0xd35400, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(2, 0xa04000, 1);
    g.strokeCircle(0, 0, 12);

    // Glowing red eye
    g.fillStyle(0xff0033, 1);
    g.fillCircle(0, 2, 4.5);

    // Pulse laser under-barrel
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

  public update(dt: number, worldSpeed: number, trainFrontX: number): void {
    if (this.isDead) return;

    // Hover bobbing
    const hover = Math.sin(this.scene.time.now * 0.005) * 12;
    this.container.y = this.baseY + hover;
    this.shadow.x = this.container.x;

    switch (this.state) {
      case 'APPROACH':
        this.container.x -= (worldSpeed + 35) * dt;
        if (this.container.x - trainFrontX <= 540) {
          this.state = 'ATTACK';
          this.attackTimer = 0.5; // Short delay before first laser
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
        // Section 78: Flies up and away
        this.container.x -= (worldSpeed + 60) * dt;
        this.baseY -= 45 * dt;
        if (this.container.x < -160 || this.container.y < 100) {
          this.state = 'EXIT';
          this.isDead = true;
          this.shadow.destroy();
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
    laser.lineStyle(2, 0xff0044, 0.9);
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
