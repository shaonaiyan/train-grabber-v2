import Phaser from 'phaser';

export class ParticleManager {
  private scene: Phaser.Scene;
  private smokeParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private explosionParticles: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createTextureTemplates();

    // Smoke emitter for locomotive chimney
    this.smokeParticles = this.scene.add.particles(0, 0, 'fx_smoke', {
      lifespan: { min: 800, max: 1400 },
      speedX: { min: -160, max: -90 },
      speedY: { min: -40, max: -80 },
      scale: { start: 0.35, end: 1.2 },
      alpha: { start: 0.6, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: 'NORMAL',
      emitting: false,
    });
    this.smokeParticles.setDepth(28);

    // Spark emitter for metal collision / install
    this.sparkParticles = this.scene.add.particles(0, 0, 'fx_spark', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 100, max: 300 },
      scale: { start: 1.2, end: 0.1 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    });
    this.sparkParticles.setDepth(40);

    // Dust emitter for train wheels / heavy drag
    this.dustParticles = this.scene.add.particles(0, 0, 'fx_dust', {
      lifespan: { min: 400, max: 800 },
      speedX: { min: -120, max: -60 },
      speedY: { min: -15, max: -35 },
      scale: { start: 0.2, end: 0.8 },
      alpha: { start: 0.45, end: 0 },
      emitting: false,
    });
    this.dustParticles.setDepth(22);

    // Explosion emitter
    this.explosionParticles = this.scene.add.particles(0, 0, 'fx_spark', {
      lifespan: { min: 400, max: 700 },
      speed: { min: 150, max: 450 },
      scale: { start: 2.0, end: 0.1 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      tint: [0xff4400, 0xffbb00, 0xffffff],
      emitting: false,
    });
    this.explosionParticles.setDepth(45);
  }

  private createTextureTemplates(): void {
    if (!this.scene.textures.exists('fx_smoke')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x7f8c8d, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture('fx_smoke', 32, 32);
      g.destroy();
    }
    if (!this.scene.textures.exists('fx_spark')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffea00, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture('fx_spark', 8, 8);
      g.destroy();
    }
    if (!this.scene.textures.exists('fx_dust')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xd2b48c, 1);
      g.fillCircle(8, 8, 8);
      g.generateTexture('fx_dust', 16, 16);
      g.destroy();
    }
  }

  public emitTrainSmoke(x: number, y: number): void {
    this.smokeParticles.emitParticleAt(x, y, 1);
  }

  public emitWheelDust(x: number, y: number): void {
    this.dustParticles.emitParticleAt(x, y, 1);
  }

  public emitHitSparks(x: number, y: number, count: number = 10): void {
    this.sparkParticles.emitParticleAt(x, y, count);
  }

  public emitInstallBurst(x: number, y: number): void {
    this.sparkParticles.emitParticleAt(x, y, 18);
  }

  public emitExplosion(x: number, y: number): void {
    this.explosionParticles.emitParticleAt(x, y, 35);
  }
}
