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
import balanceData from '../data/balance.json';

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

    // Section 100: Spawn enemies directed by EncounterDirector
    this.eventBus.on('SPAWN_ENEMY_DIRECT', (data: { type: 'bandit' | 'drone' }) => {
      if (data.type === 'bandit') {
        this.spawnBandit();
      } else if (data.type === 'drone') {
        this.spawnDrone();
      }
    });
  }

  public reset(): void {
    for (const e of this.enemies) {
      if (e.container) e.container.destroy();
      if (e.shadow) e.shadow.destroy();
      if (e.laserPointer) e.laserPointer.destroy();
    }
    this.enemies = [];

    for (const p of this.projectiles) {
      p.destroy();
    }
    this.projectiles = [];
    this.turretWeapons = [];
  }

  public update(time: number, delta: number, worldSpeed: number): void {
    const dt = delta * 0.001;
    const trainFrontX = 650;
    const baseSpeedPx = balanceData.train.baseWorldSpeed;

    // 1. Update active enemies (with speed closing bonus)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, worldSpeed, trainFrontX, baseSpeedPx);

      if (enemy.isDead && enemy.container.alpha <= 0.05) {
        this.enemies.splice(i, 1);
      }
    }

    // 2. Update Turrets firing from train
    this.updateTurrets(dt);

    // 3. Update Friendly creatures from hatched egg
    this.updateFriendlyCreatures(dt);

    // 4. Update Projectiles
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
      }
    }
  }

  private updateFriendlyCreatures(dt: number): void {
    // Check CargoSystem for friendly creature egg
    const cargoItems = this.trainManager.cargo.getCargoItems();
    for (const cargo of cargoItems) {
      if (cargo.itemId === 'egg' && cargo.customData?.outcome === 'FRIENDLY' && this.enemies.length > 0) {
        cargo.customData.attackTimer = (cargo.customData.attackTimer || 0) + dt;
        if (cargo.customData.attackTimer >= 0.9) {
          cargo.customData.attackTimer = 0;
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
        if (!enemy.isDead) {
          const dist = Phaser.Math.Distance.Between(x, y, enemy.container.x, enemy.container.y);
          if (dist <= radius) {
            enemy.takeDamage(90);
          }
        }
      }

      // Check distance to train rear
      const lastCar = this.trainManager.cars[this.trainManager.cars.length - 1];
      if (lastCar) {
        const distToTrain = Phaser.Math.Distance.Between(x, y, lastCar.baseCarX, lastCar.baseCarY);
        if (distToTrain < 130) {
          this.trainManager.stats.takeDamage(10, 'friendly_explosive');
          this.juice.flashDamage();
        }
      }
    });
  }
}
