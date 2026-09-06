import Phaser from 'phaser';
import { BanditJeep } from './BanditJeep';
import { AttackDrone } from './AttackDrone';
import { TurretWeapon } from '../combat/Turret';
import { AudioManager } from '../fx/AudioManager';
import { EventBus } from '../core/EventBus';
import phasesData from '../data/phases.json';
export class EnemyManager {
    scene;
    trainManager;
    rng;
    particles;
    juice;
    audio;
    eventBus;
    enemies = [];
    projectiles = [];
    turretWeapons = [];
    banditSpawnTimer = 10;
    droneSpawnTimer = 30;
    constructor(scene, trainManager, rng, particles, juice) {
        this.scene = scene;
        this.trainManager = trainManager;
        this.rng = rng;
        this.particles = particles;
        this.juice = juice;
        this.audio = AudioManager.getInstance();
        this.eventBus = EventBus.getInstance();
        // Listen for explosive barrel discard detonation (Section 47)
        this.eventBus.on('ITEM_DISCARDED_EXPLOSIVE', (data) => {
            this.handleExplosiveDetonation(data.x, data.y);
        });
    }
    update(time, delta, currentPhaseId, worldSpeed) {
        const dt = delta * 0.001;
        const phaseConfig = phasesData.phases[currentPhaseId];
        const trainFrontX = 650; // Front of train
        // 1. Spawning timers
        if (phaseConfig) {
            const [bMin, bMax] = phaseConfig.enemyBanditInterval;
            if (bMin < 900) {
                this.banditSpawnTimer -= dt;
                if (this.banditSpawnTimer <= 0) {
                    this.banditSpawnTimer = this.rng.range(bMin, bMax);
                    this.spawnBandit();
                }
            }
            const [dMin, dMax] = phaseConfig.enemyDroneInterval;
            if (dMin < 900) {
                this.droneSpawnTimer -= dt;
                if (this.droneSpawnTimer <= 0) {
                    this.droneSpawnTimer = this.rng.range(dMin, dMax);
                    this.spawnDrone();
                }
            }
        }
        // 2. Update active enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt, worldSpeed, trainFrontX);
            if (enemy.isDead && enemy.container.alpha <= 0.05) {
                this.enemies.splice(i, 1);
            }
        }
        // 3. Update Turrets firing from train
        this.updateTurrets(dt);
        // 4. Update Friendly creatures (Section 46)
        this.updateFriendlyCreatures(dt);
        // 5. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.update(dt)) {
                this.projectiles.splice(i, 1);
            }
        }
    }
    spawnBandit() {
        const startX = 2050;
        const startY = this.rng.range(630, 680);
        const bandit = new BanditJeep(this.scene, startX, startY, (dmg) => {
            this.trainManager.stats.takeDamage(dmg, 'bandit');
            this.juice.flashDamage();
        });
        this.enemies.push(bandit);
    }
    spawnDrone() {
        const startX = 2050;
        const startY = this.rng.range(380, 480);
        const drone = new AttackDrone(this.scene, startX, startY, (dmg) => {
            this.trainManager.stats.takeDamage(dmg, 'drone');
            this.juice.flashDamage();
        });
        this.enemies.push(drone);
    }
    updateTurrets(dt) {
        const modules = this.trainManager.getAllInstalledModules();
        const turrets = modules.filter((m) => m.itemId === 'turret');
        // Ensure we have enough weapon controllers
        while (this.turretWeapons.length < turrets.length) {
            this.turretWeapons.push(new TurretWeapon(this.scene));
        }
        const efficiency = this.trainManager.power.getEfficiency();
        for (let i = 0; i < turrets.length; i++) {
            const weapon = this.turretWeapons[i];
            // Find world position of this turret
            const car = this.trainManager.cars[turrets[i].carIndex];
            if (car) {
                const tx = car.baseCarX;
                const ty = car.baseCarY - 32;
                weapon.update(dt, tx, ty, this.enemies, efficiency, this.projectiles);
                // Aim barrel graphic towards closest enemy
                if (this.enemies.length > 0) {
                    const closest = this.enemies[0];
                    car.aimTurrets(closest.container.x, closest.container.y);
                }
            }
        }
    }
    updateFriendlyCreatures(dt) {
        const modules = this.trainManager.getAllInstalledModules();
        for (const mod of modules) {
            if (mod.customData && mod.customData.isCreature && this.enemies.length > 0) {
                mod.customData.attackTimer = (mod.customData.attackTimer || 0) + dt;
                if (mod.customData.attackTimer >= 0.9) {
                    mod.customData.attackTimer = 0;
                    const target = this.enemies[0];
                    if (target && !target.isDead) {
                        target.takeDamage(4);
                        this.juice.showFloatingText(target.container.x, target.container.y - 20, '-4', '#9b59b6', '16px');
                    }
                }
            }
        }
    }
    handleExplosiveDetonation(x, y) {
        // Detonates after 0.6s delay (Section 47)
        this.scene.time.delayedCall(600, () => {
            this.particles.emitExplosion(x, y);
            this.audio.playExplosion();
            this.juice.screenShake(0.012, 300);
            const radius = 180;
            // Damage enemies
            for (const enemy of this.enemies) {
                if (enemy.isDead)
                    continue;
                const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
                if (dist <= radius) {
                    enemy.takeDamage(90);
                }
            }
            // Check if train is within blast radius (Section 47: HP -10)
            const cranePos = this.trainManager.getCranePosition();
            const trainDist = Phaser.Math.Distance.Between(x, y, cranePos.x, cranePos.y);
            if (trainDist <= radius) {
                this.trainManager.stats.takeDamage(10, 'explosive_self_dmg');
                this.juice.flashDamage();
                this.juice.showFloatingText(cranePos.x, cranePos.y - 40, '-10 HP (BLAST)', '#e74c3c', '22px');
            }
        });
    }
    clearAll() {
        for (const e of this.enemies) {
            if (!e.isDead)
                e.container.destroy();
        }
        this.enemies = [];
        for (const p of this.projectiles) {
            p.destroy();
        }
        this.projectiles = [];
    }
}
