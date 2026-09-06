import Phaser from 'phaser';
import { AudioManager } from './AudioManager';

export class JuiceManager {
  private scene: Phaser.Scene;
  private audio: AudioManager;
  private hitStopTimer: number = 0;
  private isHitStopActive: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.audio = AudioManager.getInstance();
  }

  public update(delta: number): boolean {
    if (this.isHitStopActive) {
      this.hitStopTimer -= delta;
      if (this.hitStopTimer <= 0) {
        this.isHitStopActive = false;
      }
      return true; // Skip normal update during hit-stop
    }
    return false;
  }

  public triggerHitStop(durationMs: number = 60): void {
    this.hitStopTimer = durationMs;
    this.isHitStopActive = true;
  }

  public screenShake(intensity: number = 0.005, durationMs: number = 150): void {
    this.scene.cameras.main.shake(durationMs, intensity);
  }

  public flashDamage(): void {
    this.scene.cameras.main.flash(120, 180, 0, 0, false);
    this.screenShake(0.008, 180);
  }

  public flashInstall(): void {
    this.screenShake(0.004, 100);
    this.audio.playInstall();
  }

  public showFloatingText(
    x: number,
    y: number,
    text: string,
    color: string = '#ffffff',
    fontSize: string = '24px'
  ): void {
    const txt = this.scene.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      fontStyle: 'bold',
      color: color,
      stroke: '#000000',
      strokeThickness: 4,
    });
    txt.setOrigin(0.5);
    txt.setDepth(100);

    this.scene.tweens.add({
      targets: txt,
      y: y - 45,
      alpha: 0,
      duration: 1100,
      ease: 'Power2',
      onComplete: () => {
        txt.destroy();
      },
    });
  }
}
