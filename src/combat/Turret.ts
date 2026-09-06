import Phaser from 'phaser';
import { Projectile } from './Projectile';
import { AudioManager } from '../fx/AudioManager';

export class TurretWeapon {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private fireTimer: number = 0;
  private baseFireRate: number = 3.0; // 3 rounds per second
  private damage: number = 8;
  private range: number = 500;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.audio = AudioManager.getInstance();
  }

  public update(
    dt: number,
    turretWorldX: number,
    turretWorldY: number,
    enemies: any[],
    powerEfficiency: number,
    projectiles: Projectile[]
  ): void {
    if (enemies.length === 0) return;

    // Effective fire rate scaled by power efficiency (Section 23, 40)
    const effectiveRate = this.baseFireRate * powerEfficiency;
    const interval = 1.0 / effectiveRate;

    this.fireTimer += dt;
    if (this.fireTimer >= interval) {
      // Find best enemy target (Drone > Bandit, then closest, Section 81)
      const target = this.selectTarget(turretWorldX, turretWorldY, enemies);
      if (target) {
        this.fireTimer = 0;
        this.fireAt(turretWorldX, turretWorldY, target, projectiles);
      }
    }
  }

  private selectTarget(x: number, y: number, enemies: any[]): any | null {
    let bestTarget: any = null;
    let highestPriority = -1;
    let closestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
      if (dist <= this.range) {
        if (enemy.priority > highestPriority) {
          highestPriority = enemy.priority;
          closestDist = dist;
          bestTarget = enemy;
        } else if (enemy.priority === highestPriority && dist < closestDist) {
          closestDist = dist;
          bestTarget = enemy;
        }
      }
    }

    return bestTarget;
  }

  private fireAt(startX: number, startY: number, target: any, projectiles: Projectile[]): void {
    this.audio.playTurretFire();
    const p = new Projectile(this.scene, startX, startY, target, this.damage);
    projectiles.push(p);
  }
}
