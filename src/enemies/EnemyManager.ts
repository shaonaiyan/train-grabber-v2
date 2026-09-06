import Phaser from 'phaser';
import { BanditJeep } from './BanditJeep';
import { AttackDrone } from './AttackDrone';
import { TurretWeapon } from '../combat/Turret';
import { Projectile } from '../combat/Projectile';
import { TrainManager } from '../train/TrainManager';
import { SeededRandom } from '../core/SeededRandom';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { AudioManager } from '../fx/AudioManager';
import { EventBus } from '../core/EventBus';
import phasesData from '../data/phases.json';

export class EnemyManager {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private rng: SeededRandom;
  private particles: ParticleManager;
  private juice: JuiceManager;
  private audio: AudioManager;
  private eventBus: EventBus;

  public enemies: any[] = [];
  public projectiles: Projectile[] = [];
  private turretWeapons: TurretWeapon[] = [];

  private banditSpawnTimer: number = 12;
  private droneSpawnTimer: number = 30;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    rng: SeededRandom,
    particles: ParticleManager,
    juice: JuiceManager
  ) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.rng = rng;
    this.particles = particles;
    this.juice = juice;
    this.audio = AudioManager.getInstance();
    this.eventBus = EventBus.getInstance();

    this.eventBus.on('ITEM_DISCARDED_EXPLOSIVE', (data: { x: number; y: number }) => {
      this.handleExplosiveDetonation(data.x, data.y);
    });

    // Section 32: Tutorial single bandit at 34s
    this.eventBus.on('SPAWN_TUTORIAL_BANDIT', () => {
      this.spawnBandit();
    });
  }

  public update(time: number, delta: number, currentPhaseId: number, worldSpeed: number): void {
    const dt = delta * 0.001;
    const phaseConfig = phasesData.phases[currentPhaseId];
    const trainFrontX = 650;

    // Section 79-80: Concurrent enemy cap (Normal max 2, Hazard Zone max 3)
    const maxCap = currentPhaseId === 4 ? 3 : 2;

    // 1. Spawning timers (only if under cap)
    if (phaseConfig && this.enemies.length < maxCap) {
      const [bMin, bMax] = phaseConfig.enemyBanditInterval;
      if (bMin < 900) {
        this.banditSpawnTimer -= dt;
        if (this.banditSpawnTimer <= 0) {
          this.banditSpawnTimer = this.rng.range(bMin, bMax);
          this.spawnBandit();
        }
      }

      const [dMin, dMax] = phaseConfig.enemyDroneInterval;
      if (dMin < 900 && this.enemies.length < maxCap) {
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

    // 4. Update Friendly creatures
    this.updateFriendlyCreatures(dt);

    // 5. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.update(dt)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  public spawnBandit(): void {
    const startX = 2050;
    const startY = this.rng.range(640, 680);
    const bandit = new BanditJeep(this.scene, startX, startY, (dmg) => {
      this.trainManager.stats.takeDamage(dmg, 'bandit');
      this.juice.flashDamage();
    });
    this.enemies.push(bandit);
  }

  public spawnDrone(): void {
    const startX = 2050;
    // Section 10: Drone altitude Y = 390~470
    const startY = this.rng.range(390, 470);
    const drone = new AttackDrone(this.scene, startX, startY, (dmg) => {
      this.trainManager.stats.takeDamage(dmg, 'drone');
      this.juice.flashDamage();
    });
    this.enemies.push(drone);
  }

  private updateTurrets(dt: number): void {
    const modules = this.trainManager.getAllInstalledModules();
    const turrets = modules.filter((m) => m.itemId === 'turret');

    while (this.turretWeapons.length < turrets.length) {
      this.turretWeapons.push(new TurretWeapon(this.scene));
    }

    const efficiency = this.trainManager.power.getEfficiency();

    for (let i = 0; i < turrets.length; i++) {
      const weapon = this.turretWeapons[i];
      const car = this.trainManager.cars[turrets[i].carIndex];
      if (car) {
        const tx = car.baseCarX;
        const ty = car.baseCarY - 42;

        weapon.update(dt, tx, ty, this.enemies, efficiency, this.projectiles);

        if (this.enemies.length > 0) {
          const closest = this.enemies[0];
          car.aimTurrets(closest.container.x, closest.container.y);
        }
      }
    }
  }

  private updateFriendlyCreatures(dt: number): void {
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

  private handleExplosiveDetonation(x: number, y: number): void {
    this.scene.time.delayedCall(600, () => {
      this.particles.emitExplosion(x, y);
      this.audio.playExplosion();
      this.juice.screenShake(0.012, 300);

      const radius = 180;
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
        if (dist <= radius) {
          enemy.takeDamage(90);
        }
      }

      const cranePos = this.trainManager.getCranePosition();
      const trainDist = Phaser.Math.Distance.Between(x, y, cranePos.x, cranePos.y);
      if (trainDist <= radius) {
        this.trainManager.stats.takeDamage(10, 'explosive_self_dmg');
        this.juice.flashDamage();
        this.juice.showFloatingText(cranePos.x, cranePos.y - 40, '-10 HP (BLAST)', '#e74c3c', '22px');
      }
    });
  }

  public clearAll(): void {
    for (const e of this.enemies) {
      if (!e.isDead) e.container.destroy();
    }
    this.enemies = [];
    for (const p of this.projectiles) {
      p.destroy();
    }
    this.projectiles = [];
  }
}
