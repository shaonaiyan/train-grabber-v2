import Phaser from 'phaser';
import { V4ObjectRegistry, HookableEntity } from './V4ObjectRegistry';
import { V4Audio } from './V4Audio';
import { V4Telemetry } from './V4Telemetry';
import { V4_BALANCE } from './V4Balance';

export class V4InteractionSystem {
  private scene: Phaser.Scene;
  private registry: V4ObjectRegistry;
  private audio: V4Audio;
  private telemetry: V4Telemetry;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.registry = V4ObjectRegistry.getInstance();
    this.audio = V4Audio.getInstance();
    this.telemetry = V4Telemetry.getInstance();
  }

  public update(dt: number, enemies: any[]): void {
    const looseEntities = this.registry.getAll().filter(
      (e) => !e.isDelivered() && !e.isLatched() && !e.isDestroyed()
    );

    for (const entity of looseEntities) {
      // 1. Check Impact against Enemies
      const vel = entity.getVelocity ? entity.getVelocity() : { x: 0, y: 0 };
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

      // Only fast-moving items deal impact damage
      if (speed >= 120 && enemies && enemies.length > 0) {
        const pos = entity.getPosition();

        for (const enemy of enemies) {
          if (!enemy.active || enemy.hp <= 0) continue;

          const dist = Phaser.Math.Distance.Between(pos.x, pos.y, enemy.x, enemy.y);
          // Collision radius ~ 45px
          if (dist <= 48) {
            this.handleEntityEnemyImpact(entity, enemy, speed);
            break;
          }
        }
      }

      // 2. Check Ground Collision for fast falling objects
      const pos = entity.getPosition();
      if (pos.y >= 710 && vel.y > 180) {
        this.handleEntityGroundImpact(entity, speed);
      }
    }
  }

  private handleEntityEnemyImpact(entity: HookableEntity, enemy: any, speed: number): void {
    // If it is an explosive barrel -> boom!
    if (entity.hasTag('EXPLOSIVE')) {
      entity.onImpact({
        target: enemy,
        relativeSpeed: speed,
        hitX: entity.getPosition().x,
        hitY: entity.getPosition().y,
      });
      return;
    }

    // Impact damage based on object type
    let impactScale = 0.05;
    let maxDmg = 20;

    if (entity.typeId === 'gold_safe_v4') {
      impactScale = V4_BALANCE.IMPACT.GOLD_SAFE.scale;
      maxDmg = V4_BALANCE.IMPACT.GOLD_SAFE.maxDmg;
    } else if (entity.typeId === 'fridge_v4') {
      impactScale = V4_BALANCE.IMPACT.FRIDGE.scale;
      maxDmg = V4_BALANCE.IMPACT.FRIDGE.maxDmg;
    } else if (entity.typeId === 'battery') {
      impactScale = V4_BALANCE.IMPACT.BATTERY.scale;
      maxDmg = V4_BALANCE.IMPACT.BATTERY.maxDmg;
    } else if (entity.typeId === 'junk') {
      impactScale = V4_BALANCE.IMPACT.JUNK.scale;
      maxDmg = V4_BALANCE.IMPACT.JUNK.maxDmg;
    }

    const damage = Phaser.Math.Clamp(speed * impactScale, 5, maxDmg);
    enemy.takeDamage(damage, `IMPACT_${entity.typeId}`);

    entity.onImpact({
      target: enemy,
      relativeSpeed: speed,
      hitX: entity.getPosition().x,
      hitY: entity.getPosition().y,
      damage,
    });

    this.telemetry.recordThreatResolution(enemy.typeId || 'enemy', 'killedByImpact');
    this.telemetry.recordCrossInteraction('OBJECT_IMPACT_ENEMY', `${entity.typeId} hit ${enemy.typeId || 'enemy'}`);

    // Rebound or slow down
    if (entity.setVelocity) {
      entity.setVelocity(-speed * 0.3, -80);
    }
  }

  private handleEntityGroundImpact(entity: HookableEntity, speed: number): void {
    if (entity.hasTag('EXPLOSIVE') && speed > 220) {
      entity.onImpact({
        target: null,
        relativeSpeed: speed,
        hitX: entity.getPosition().x,
        hitY: entity.getPosition().y,
      });
      return;
    }

    // Ground bounce damping
    const vel = entity.getVelocity ? entity.getVelocity() : { x: 0, y: 0 };
    if (entity.setVelocity) {
      entity.setVelocity(vel.x * 0.6, -vel.y * 0.35);
    }
  }
}
