import { AudioManager } from './AudioManager';
export class JuiceManager {
    scene;
    audio;
    hitStopTimer = 0;
    isHitStopActive = false;
    constructor(scene) {
        this.scene = scene;
        this.audio = AudioManager.getInstance();
    }
    update(delta) {
        if (this.isHitStopActive) {
            this.hitStopTimer -= delta;
            if (this.hitStopTimer <= 0) {
                this.isHitStopActive = false;
            }
            return true; // Skip normal update during hit-stop
        }
        return false;
    }
    triggerHitStop(durationMs = 60) {
        this.hitStopTimer = durationMs;
        this.isHitStopActive = true;
    }
    screenShake(intensity = 0.005, durationMs = 150) {
        this.scene.cameras.main.shake(durationMs, intensity);
    }
    flashDamage() {
        this.scene.cameras.main.flash(120, 180, 0, 0, false);
        this.screenShake(0.008, 180);
    }
    flashInstall() {
        this.screenShake(0.004, 100);
        this.audio.playInstall();
    }
    showFloatingText(x, y, text, color = '#ffffff', fontSize = '24px') {
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
