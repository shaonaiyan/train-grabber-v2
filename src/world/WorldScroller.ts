import Phaser from 'phaser';
import { ParallaxManager } from './ParallaxManager';
import balanceData from '../data/balance.json';

export class WorldScroller {
  private scene: Phaser.Scene;
  private parallax: ParallaxManager;
  private currentSpeed: number = balanceData.train.baseWorldSpeed;
  private isStopping: boolean = false;
  private stopProgress: number = 0;
  private stationPlatform: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.parallax = new ParallaxManager(scene);
  }

  public update(
    delta: number,
    baseSpeed: number,
    speedMultiplier: number,
    isOutOfFuel: boolean
  ): number {
    const dt = delta * 0.001;
    let targetSpeed = baseSpeed * speedMultiplier;

    if (isOutOfFuel) {
      targetSpeed *= balanceData.train.outOfFuelSpeedMultiplier;
    }

    if (this.isStopping) {
      this.stopProgress += dt / 2.0; // Stop over 2 seconds
      const t = Phaser.Math.Clamp(1.0 - this.stopProgress, 0, 1);
      targetSpeed *= t;
      if (t <= 0) {
        targetSpeed = 0;
      }
    }

    this.currentSpeed = targetSpeed;
    this.parallax.update(dt, this.currentSpeed);

    if (this.stationPlatform && this.currentSpeed > 0) {
      this.stationPlatform.x -= this.currentSpeed * dt;
    }

    return this.currentSpeed;
  }

  public getSpeed(): number {
    return this.currentSpeed;
  }

  public triggerHavenApproachVisuals(): void {
    this.parallax.spawnFinalStretchSilhouettes();
  }

  public triggerGreenStationSignal(): void {
    this.parallax.triggerGreenStationSignal();
  }

  public triggerStationArrival(): void {
    this.isStopping = true;
    this.stopProgress = 0;

    // Create a detailed terminal station platform scrolling into view
    this.stationPlatform = this.scene.add.container(2100, 680);
    this.stationPlatform.setDepth(26);

    const g = this.scene.add.graphics();
    // Concrete platform
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(0, 10, 1400, 45);
    // Yellow hazard edge
    g.fillStyle(0xf1c40f, 1);
    g.fillRect(0, 8, 1400, 6);
    // Roof columns
    g.fillStyle(0x2c3e50, 1);
    for (let i = 80; i < 1400; i += 220) {
      g.fillRect(i, -120, 14, 130);
      g.fillRect(i - 40, -120, 94, 12);
    }
    // Terminal sign
    g.fillStyle(0x1a252f, 1);
    g.fillRect(400, -160, 280, 50);
    g.lineStyle(2, 0xecf0f1, 1);
    g.strokeRect(400, -160, 280, 50);

    const signText = this.scene.add.text(540, -135, 'TERMINAL 01: HAVEN', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#00ffcc',
    });
    signText.setOrigin(0.5);

    this.stationPlatform.add([g, signText]);
  }
}
