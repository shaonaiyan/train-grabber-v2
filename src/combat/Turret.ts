import Phaser from 'phaser';
import { Projectile } from './Projectile';
import { AudioManager } from '../fx/AudioManager';

export class TurretWeapon {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private fireTimer: number = 0;
  public baseFireRate: number = 3.0; // 3 rounds per second
  public damage: number = 8;
  public range: number = 720; // Section 117: Range 720

  public shotsFired: number = 0;

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

    // Effective fire rate scaled by power efficiency
    const effectiveRate = this.baseFireRate * powerEfficiency;
    const interval = 1.0 / effectiveRate;

    this.fireTimer += dt;
    if (this.fireTimer >= interval) {
      // Section 110: Smart targeting (telegraphing > closest > drone > other)
      const target = this.selectTarget(turretWorldX, turretWorldY, enemies);
      if (target) {
        this.fireTimer = 0;
        this.fireAt(turretWorldX, turretWorldY, target, projectiles);
      }
    }
  }

  private selectTarget(x: number, y: number, enemies: any[]): any | null {
    let bestTarget: any = null;
    let highestScore = -Infinity;

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isRetreating) continue;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
      if (dist <= this.range) {
        // Section 110 Targeting formula:
        // +1000 if enemy is currently preparing attack (telegraphing)
        // +300 if drone
        // + (range - dist) for closeness
        let score = (this.range - dist);
        if (enemy.isTelegraphing) {
          score += 1000;
        }
        if (enemy.id === 'drone' || enemy.type === 'drone') {
          score += 300;
        }

        if (score > highestScore) {
          highestScore = score;
          bestTarget = enemy;
        }
      }
    }

    return bestTarget;
  }

  private fireAt(startX: number, startY: number, target: any, projectiles: Projectile[]): void {
    this.audio.playTurretFire();
    this.shotsFired++;
    const p = new Projectile(this.scene, startX, startY, target, this.damage);
    projectiles.push(p);
  }
}
