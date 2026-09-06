import Phaser from 'phaser';

export class Projectile {
  public scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  public damage: number;
  public targetEnemy: any;
  public isDestroyed: boolean = false;
  private speed: number = 950;

  constructor(
    scene: Phaser.Scene,
    startX: number,
    startY: number,
    targetEnemy: any,
    damage: number
  ) {
    this.scene = scene;
    this.targetEnemy = targetEnemy;
    this.damage = damage;

    this.container = scene.add.container(startX, startY);
    this.container.setDepth(32);

    const g = scene.add.graphics();
    g.fillStyle(0xfff176, 1);
    g.fillCircle(0, 0, 3.5);
    g.lineStyle(1.5, 0xff9800, 1);
    g.lineBetween(-6, 0, 6, 0);
    this.container.add(g);

    const angle = Phaser.Math.Angle.Between(
      startX,
      startY,
      targetEnemy.container.x,
      targetEnemy.container.y
    );
    this.container.setRotation(angle);
  }

  public update(deltaSeconds: number): boolean {
    if (this.isDestroyed) return true;

    if (!this.targetEnemy || this.targetEnemy.isDead) {
      this.destroy();
      return true;
    }

    const tx = this.targetEnemy.container.x;
    const ty = this.targetEnemy.container.y;
    const dist = Phaser.Math.Distance.Between(this.container.x, this.container.y, tx, ty);
    const step = this.speed * deltaSeconds;

    if (dist <= step) {
      // Hit target!
      this.targetEnemy.takeDamage(this.damage);
      this.destroy();
      return true;
    }

    const angle = Phaser.Math.Angle.Between(this.container.x, this.container.y, tx, ty);
    this.container.x += Math.cos(angle) * step;
    this.container.y += Math.sin(angle) * step;
    this.container.setRotation(angle);

    return false;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.container.destroy();
  }
}
