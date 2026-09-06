import Phaser from 'phaser';
import { Projectile } from './Projectile';
import { AudioManager } from '../fx/AudioManager';
export class TurretWeapon {
    scene;
    audio;
    fireTimer = 0;
    baseFireRate = 3.0; // 3 rounds per second
    damage = 8;
    range = 500;
    constructor(scene) {
        this.scene = scene;
        this.audio = AudioManager.getInstance();
    }
    update(dt, turretWorldX, turretWorldY, enemies, powerEfficiency, projectiles) {
        if (enemies.length === 0)
            return;
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
    selectTarget(x, y, enemies) {
        let bestTarget = null;
        let highestPriority = -1;
        let closestDist = Infinity;
        for (const enemy of enemies) {
            if (enemy.isDead)
                continue;
            const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
            if (dist <= this.range) {
                if (enemy.priority > highestPriority) {
                    highestPriority = enemy.priority;
                    closestDist = dist;
                    bestTarget = enemy;
                }
                else if (enemy.priority === highestPriority && dist < closestDist) {
                    closestDist = dist;
                    bestTarget = enemy;
                }
            }
        }
        return bestTarget;
    }
    fireAt(startX, startY, target, projectiles) {
        this.audio.playTurretFire();
        const p = new Projectile(this.scene, startX, startY, target, this.damage);
        projectiles.push(p);
    }
}
