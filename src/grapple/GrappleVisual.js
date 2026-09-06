import Phaser from 'phaser';
export class GrappleVisual {
    scene;
    craneArmGraphics;
    chainGraphics;
    clawContainer;
    clawGraphics;
    boomLength = 55;
    recoilOffset = 0;
    constructor(scene) {
        this.scene = scene;
        this.chainGraphics = scene.add.graphics();
        this.chainGraphics.setDepth(29);
        this.craneArmGraphics = scene.add.graphics();
        this.craneArmGraphics.setDepth(30);
        this.clawContainer = scene.add.container(0, 0);
        this.clawContainer.setDepth(31);
        this.clawGraphics = scene.add.graphics();
        this.clawContainer.add(this.clawGraphics);
        this.drawClaw(false);
    }
    triggerRecoil() {
        this.recoilOffset = 14;
        this.scene.tweens.add({
            targets: this,
            recoilOffset: 0,
            duration: 180,
            ease: 'Back.easeOut',
        });
    }
    drawClaw(isClamping) {
        const g = this.clawGraphics;
        g.clear();
        // Central hub
        g.fillStyle(0xd35400, 1);
        g.fillCircle(0, 0, 9);
        g.lineStyle(2, 0x111111, 1);
        g.strokeCircle(0, 0, 9);
        // Glowing actuator core
        g.fillStyle(0x00ffff, 1);
        g.fillCircle(0, 0, 3.5);
        // 3 articulated mechanical claws
        const spread = isClamping ? 0.35 : 0.75;
        const angles = [-spread, 0, spread];
        g.lineStyle(3, 0x7f8c8d, 1);
        for (const a of angles) {
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const jointX = cos * 14;
            const jointY = sin * 14;
            const tipX = cos * 22 + (isClamping ? -sin * 5 : sin * 4);
            const tipY = sin * 22 + (isClamping ? cos * 5 : -cos * 4);
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(jointX, jointY);
            g.lineTo(tipX, tipY);
            g.stroke();
            // Sharp claw tip
            g.fillStyle(0xe74c3c, 1);
            g.fillCircle(tipX, tipY, 2.5);
        }
    }
    updateVisuals(craneBaseX, craneBaseY, hookX, hookY, isIdle, isLatched) {
        // 1. Calculate crane boom angle pointing towards hook or aim
        const angle = Phaser.Math.Angle.Between(craneBaseX, craneBaseY, hookX, hookY);
        const boomTipX = craneBaseX + Math.cos(angle) * (this.boomLength - this.recoilOffset);
        const boomTipY = craneBaseY + Math.sin(angle) * (this.boomLength - this.recoilOffset);
        // 2. Draw articulated industrial crane arm
        const cg = this.craneArmGraphics;
        cg.clear();
        // Crane hydraulic piston base
        cg.lineStyle(6, 0xd35400, 1);
        cg.lineBetween(craneBaseX, craneBaseY, boomTipX, boomTipY);
        // Steel reinforcement truss
        cg.lineStyle(2, 0x2c3e50, 1);
        cg.lineBetween(craneBaseX, craneBaseY, boomTipX, boomTipY);
        // Boom tip pulley wheel
        cg.fillStyle(0x7f8c8d, 1);
        cg.fillCircle(boomTipX, boomTipY, 6);
        cg.lineStyle(1.5, 0x111111, 1);
        cg.strokeCircle(boomTipX, boomTipY, 6);
        // 3. Draw heavy steel chain connecting boom tip to claw
        const chg = this.chainGraphics;
        chg.clear();
        if (!isIdle) {
            const dist = Phaser.Math.Distance.Between(boomTipX, boomTipY, hookX, hookY);
            const links = Math.floor(dist / 14);
            chg.lineStyle(3, 0x34495e, 0.95);
            chg.lineBetween(boomTipX, boomTipY, hookX, hookY);
            // Chain links dots
            for (let i = 0; i <= links; i++) {
                const t = links > 0 ? i / links : 0;
                const lx = Phaser.Math.Linear(boomTipX, hookX, t);
                const ly = Phaser.Math.Linear(boomTipY, hookY, t);
                chg.fillStyle(i % 2 === 0 ? 0x95a5a6 : 0x7f8c8d, 1);
                chg.fillCircle(lx, ly, 2.5);
            }
        }
        // 4. Update claw position and rotation
        this.clawContainer.setPosition(hookX, hookY);
        this.clawContainer.setRotation(angle);
        this.drawClaw(isLatched);
    }
    destroy() {
        this.craneArmGraphics.destroy();
        this.chainGraphics.destroy();
        this.clawContainer.destroy();
    }
}
