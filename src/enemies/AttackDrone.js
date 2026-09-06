import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
export class AttackDrone {
    scene;
    container;
    hp = 42;
    maxHp = 42;
    isDead = false;
    priority = 2; // Priority 2 > 1 (Drone > Bandit)
    attackInterval = 1.6;
    attackTimer = 0;
    damage = 4;
    speed = 160;
    healthBar;
    onAttackTrain;
    baseY;
    constructor(scene, startX, startY, onAttack) {
        this.scene = scene;
        this.baseY = startY;
        this.onAttackTrain = onAttack;
        this.container = scene.add.container(startX, startY);
        this.container.setDepth(23);
        this.buildVisuals();
        this.healthBar = scene.add.graphics();
        this.container.add(this.healthBar);
        this.updateHealthBar();
        EventBus.getInstance().emit('ENEMY_SPAWN', { type: 'drone', hp: this.hp });
    }
    buildVisuals() {
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
        // Glowing red eye / camera
        g.fillStyle(0xff0033, 1);
        g.fillCircle(0, 2, 4.5);
        // Pulse laser under-barrel
        g.fillStyle(0x111111, 1);
        g.fillRect(-2, 10, 4, 8);
        this.container.add(g);
    }
    updateHealthBar() {
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
    takeDamage(dmg) {
        if (this.isDead)
            return;
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
    update(dt, worldSpeed, trainFrontX) {
        if (this.isDead)
            return;
        // Hover bobbing
        const hover = Math.sin(this.scene.time.now * 0.005) * 12;
        this.container.y = this.baseY + hover;
        // Pacing alongside or above train
        if (this.container.x > trainFrontX + 120) {
            this.container.x -= (worldSpeed + 25) * dt;
        }
        else if (this.container.x < trainFrontX - 220) {
            this.container.x += 50 * dt;
        }
        // Attack cycle
        this.attackTimer += dt;
        if (this.attackTimer >= this.attackInterval) {
            this.attackTimer = 0;
            this.fireLaserAtTrain();
        }
    }
    fireLaserAtTrain() {
        const laser = this.scene.add.graphics();
        laser.lineStyle(2, 0xff0044, 0.9);
        laser.lineBetween(this.container.x, this.container.y + 12, 530, 710);
        laser.setDepth(33);
        this.scene.time.delayedCall(90, () => laser.destroy());
        this.onAttackTrain(this.damage);
    }
    die() {
        this.isDead = true;
        EventBus.getInstance().emit('ENEMY_KILLED', { type: 'drone' });
        // Spiral explosion fall
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
