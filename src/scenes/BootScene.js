import Phaser from 'phaser';
export class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }
    preload() {
        // Show a clean loading text
        const txt = this.add.text(960, 540, 'INITIALIZING RAILWAY SYSTEMS...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#00ffff',
        });
        txt.setOrigin(0.5);
    }
    create() {
        this.scene.start('GameScene');
    }
}
