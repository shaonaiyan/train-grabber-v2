import Phaser from 'phaser';
import { TrainSlot } from './TrainSlot';
import { SlotType, InstalledModule } from '../core/Types';

export type CarType = 'locomotive' | 'crane' | 'cargo' | 'flat';

interface WheelAssembly {
  container: Phaser.GameObjects.Container;
  spokes: Phaser.GameObjects.Graphics;
  radius: number;
  baseX: number;
  baseY: number;
}

export class TrainCar {
  public scene: Phaser.Scene;
  public type: CarType;
  public carIndex: number;
  public container: Phaser.GameObjects.Container;
  public width: number;
  public slots: TrainSlot[] = [];
  public baseCarX: number = 0;
  public baseCarY: number = 0;

  private bodyGraphics!: Phaser.GameObjects.Graphics;
  private wheelAssemblies: WheelAssembly[] = [];
  private wheelAngle: number = 0;
  private onModuleDiscardCallback: (module: InstalledModule) => void;
  private onModuleHoverCallback: (module: InstalledModule | null, screenX: number, screenY: number) => void;

  constructor(
    scene: Phaser.Scene,
    type: CarType,
    carIndex: number,
    onDiscard: (module: InstalledModule) => void,
    onHover: (module: InstalledModule | null, screenX: number, screenY: number) => void
  ) {
    this.scene = scene;
    this.type = type;
    this.carIndex = carIndex;
    this.onModuleDiscardCallback = onDiscard;
    this.onModuleHoverCallback = onHover;

    // V2.1: Size increased by ~28% (Section 4)
    this.width = type === 'locomotive' ? 225 : 200;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(25);

    this.buildCarVisuals();
    this.setupSlots();
  }

  private buildCarVisuals(): void {
    this.bodyGraphics = this.scene.add.graphics();
    this.container.add(this.bodyGraphics);

    if (this.type === 'locomotive') {
      this.drawLocomotive();
      // Section 12: 3 visible main wheels (r = 17, 20, 20)
      this.createWheelAssembly(-65, 34, 17);
      this.createWheelAssembly(0, 34, 20);
      this.createWheelAssembly(65, 34, 20);
    } else if (this.type === 'crane') {
      this.drawCraneCar();
      // Section 12: 2 wheels (r ≈ 16)
      this.createWheelAssembly(-55, 34, 16);
      this.createWheelAssembly(55, 34, 16);
    } else {
      this.drawOpenWagonCar();
      // Section 12: 2 wheels (r ≈ 16)
      this.createWheelAssembly(-55, 34, 16);
      this.createWheelAssembly(55, 34, 16);
    }
  }

  private createWheelAssembly(wx: number, wy: number, r: number): void {
    // Section 11: WheelContainer fixed at (wx, wy), only spokes rotate around (0,0)
    const wheelCont = this.scene.add.container(wx, wy);

    // 1. Stationary Tire & Rim
    const tireG = this.scene.add.graphics();
    tireG.fillStyle(0x1a252f, 1);
    tireG.fillCircle(0, 0, r);
    tireG.lineStyle(2.5, 0x95a5a6, 1);
    tireG.strokeCircle(0, 0, r);
    wheelCont.add(tireG);

    // 2. Rotating Spokes & Hub
    const spokesG = this.scene.add.graphics();
    spokesG.lineStyle(2, 0x566573, 1);
    spokesG.lineBetween(-r + 3, 0, r - 3, 0);
    spokesG.lineBetween(0, -r + 3, 0, r - 3);
    // Hub center
    spokesG.fillStyle(0xd35400, 1);
    spokesG.fillCircle(0, 0, r * 0.35);
    spokesG.lineStyle(1.5, 0x111111, 1);
    spokesG.strokeCircle(0, 0, r * 0.35);
    wheelCont.add(spokesG);

    this.container.add(wheelCont);
    this.wheelAssemblies.push({
      container: wheelCont,
      spokes: spokesG,
      radius: r,
      baseX: wx,
      baseY: wy,
    });
  }

  private drawLocomotive(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Cowcatcher (Heavy steel wedge front)
    g.fillStyle(0x2c3e50, 1);
    g.beginPath();
    g.moveTo(90, 36);
    g.lineTo(125, 36);
    g.lineTo(105, 12);
    g.closePath();
    g.fill();
    g.lineStyle(2, 0x7f8c8d, 1);
    g.stroke();

    // 10°~15° Top Oblique perspective: Top beveled plate
    g.fillStyle(0x415b76, 1);
    g.fillRect(-50, -32, 155, 8);

    // Boiler body (dark iron cylinder)
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-50, -25, 155, 55, 6);
    g.lineStyle(2.5, 0x1a252f, 1);
    g.strokeRoundedRect(-50, -25, 155, 55, 6);

    // Boiler brass reinforcement bands
    g.fillStyle(0xf39c12, 1);
    g.fillRect(-20, -25, 6, 55);
    g.fillRect(30, -25, 6, 55);
    g.fillRect(75, -25, 6, 55);

    // Driver Cabin (Rear)
    g.fillStyle(0x34495e, 1);
    g.fillRoundedRect(-108, -55, 68, 85, 5);
    g.lineStyle(2.5, 0x1a252f, 1);
    g.strokeRoundedRect(-108, -55, 68, 85, 5);

    // Cabin roof with oblique overhang
    g.fillStyle(0x415b76, 1);
    g.fillRect(-112, -60, 76, 6);

    // Cabin glowing windows
    g.fillStyle(0xf1c40f, 0.9);
    g.fillRect(-96, -42, 22, 22);
    g.fillRect(-66, -42, 18, 22);
    g.lineStyle(1.5, 0x1a252f, 1);
    g.strokeRect(-96, -42, 22, 22);
    g.strokeRect(-66, -42, 18, 22);

    // Chimney / Smoke stack
    g.fillStyle(0x1a252f, 1);
    g.fillRect(55, -55, 20, 32);
    g.fillStyle(0x7f8c8d, 1);
    g.fillEllipse(65, -55, 26, 10);

    // Headlight housing & volumetric beam
    g.fillStyle(0xf39c12, 1);
    g.fillRect(105, -12, 14, 18);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(118, -3, 8);

    g.fillStyle(0xfff9d2, 0.15);
    g.beginPath();
    g.moveTo(120, -3);
    g.lineTo(440, -65);
    g.lineTo(440, 55);
    g.closePath();
    g.fill();

    // Coupler
    g.fillStyle(0x111111, 1);
    g.fillRect(-115, 16, 12, 14);
  }

  private drawCraneCar(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Heavy industrial flat chassis
    // Top beveled walkway
    g.fillStyle(0x415b76, 1);
    g.fillRect(-95, -6, 190, 8);

    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-95, 2, 190, 26, 4);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-95, 2, 190, 26, 4);

    // Crane turntable pedestal (Reinforced hazard base)
    g.fillStyle(0xd35400, 1);
    g.fillRoundedRect(-28, -26, 56, 30, 4);
    g.lineStyle(2, 0x7e3000, 1);
    g.strokeRoundedRect(-28, -26, 56, 30, 4);

    // Turntable ring
    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(0, -26, 18);
    g.lineStyle(2, 0x2c3e50, 1);
    g.strokeCircle(0, -26, 18);

    // Hydraulic cylinders on sides of pedestal
    g.fillStyle(0x95a5a6, 1);
    g.fillRect(-35, -18, 7, 20);
    g.fillRect(28, -18, 7, 20);

    // Couplers
    g.fillStyle(0x111111, 1);
    g.fillRect(-102, 14, 12, 12);
    g.fillRect(90, 14, 12, 12);
  }

  private drawOpenWagonCar(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Section 47: Open cargo wagon with 10°~15° top oblique perspective
    // Interior floor of the cargo bed (dark recessed wood/steel)
    g.fillStyle(0x1c130e, 1);
    g.fillRect(-85, -24, 170, 32);

    // Interior bed back-wall shading
    g.fillStyle(0x2d1d16, 1);
    g.fillRect(-85, -24, 170, 12);

    // Front low side-board (allows seeing items inside bed!)
    g.fillStyle(0x4e342e, 1);
    g.fillRoundedRect(-92, 4, 184, 24, 3);
    g.lineStyle(2, 0x271913, 1);
    g.strokeRoundedRect(-92, 4, 184, 24, 3);

    // Metal side stakes and exterior mounting brackets (SIDE slot area)
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-85, -26, 8, 32);
    g.fillRect(-30, -26, 8, 32);
    g.fillRect(22, -26, 8, 32);
    g.fillRect(77, -26, 8, 32);

    // Top mounting hardpoint beam (for TOP Turret)
    g.fillStyle(0x34495e, 1);
    g.fillRect(-22, -30, 44, 7);
    g.lineStyle(1.5, 0x1a252f, 1);
    g.strokeRect(-22, -30, 44, 7);

    // Couplers
    g.fillStyle(0x111111, 1);
    g.fillRect(-99, 14, 12, 12);
    g.fillRect(87, 14, 12, 12);
  }

  private setupSlots(): void {
    if (this.type === 'locomotive') {
      return;
    }

    if (this.type === 'crane') {
      // Section 46: Crane Car NO LONGER has item slots!
      return;
    }

    // Cargo and Flat Cars have TOP, BODY, SIDE slots
    // TOP: Turret hardpoint above wagon
    this.slots.push(new TrainSlot('TOP', 0, -42));
    // BODY: Inside open wagon bed (Section 48)
    this.slots.push(new TrainSlot('BODY', -32, -10));
    // SIDE: Exterior steel mounting bracket on wagon flank
    this.slots.push(new TrainSlot('SIDE', 32, 16));
  }

  public getAvailableSlot(type: SlotType): TrainSlot | null {
    for (const s of this.slots) {
      if (s.type === type && !s.isOccupied()) {
        return s;
      }
    }
    return null;
  }

  public installModule(module: InstalledModule): boolean {
    const targetSlot = this.getAvailableSlot(module.slotType);
    if (!targetSlot) return false;

    const visual = this.createModuleVisual(module);
    targetSlot.install(module, visual);
    this.container.add(visual);

    // Section 56: Multi-phase installation animation
    visual.setPosition(targetSlot.relativeX, targetSlot.relativeY - 35);
    visual.setAlpha(0.6);

    // Phase A: drop into slot
    this.scene.tweens.add({
      targets: visual,
      y: targetSlot.relativeY + 4,
      alpha: 1.0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Phase B & C: Impact, dip, rebound
        this.dipOnInstall();
        this.scene.tweens.add({
          targets: visual,
          y: targetSlot.relativeY,
          duration: 90,
          ease: 'Back.easeOut',
        });
      },
    });

    return true;
  }

  public removeModule(moduleUid: string): InstalledModule | null {
    for (const slot of this.slots) {
      if (slot.installedModule && slot.installedModule.uid === moduleUid) {
        return slot.clear();
      }
    }
    return null;
  }

  private createModuleVisual(module: InstalledModule): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);

    // Hitbox for hover and right-click discard
    const hitArea = this.scene.add.rectangle(0, 0, 54, 54, 0x000000, 0.001);
    hitArea.setInteractive({ cursor: 'pointer' });

    hitArea.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      this.onModuleHoverCallback(module, pointer.worldX, pointer.worldY);
    });
    hitArea.on('pointerout', () => {
      this.onModuleHoverCallback(null, 0, 0);
    });
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.onModuleHoverCallback(null, 0, 0);
        this.onModuleDiscardCallback(module);
      }
    });

    c.add(hitArea);

    const g = this.scene.add.graphics();
    c.add(g);

    // Section 49-55: Detailed visual representation
    switch (module.itemId) {
      case 'turret':
        this.drawTurretModule(g, c);
        break;
      case 'battery':
        this.drawBatteryModule(g);
        break;
      case 'gold':
        this.drawGoldModule(g);
        break;
      case 'sheep':
        this.drawSheepModule(g, c);
        break;
      case 'survivor':
        this.drawSurvivorModule(g, c);
        break;
      case 'fridge':
        this.drawFridgeModule(g);
        break;
      case 'egg':
        this.drawEggModule(g, c);
        break;
      case 'explosive':
        this.drawExplosiveModule(g);
        break;
      case 'junk':
        this.drawJunkModule(g);
        break;
    }

    return c;
  }

  private drawTurretModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    // Section 54: Magnetic mounting pedestal + twin scanning barrels
    g.fillStyle(0x34495e, 1);
    g.fillRect(-18, 0, 36, 12);
    g.lineStyle(1.5, 0x1a252f, 1);
    g.strokeRect(-18, 0, 36, 12);

    // Turret dome
    g.fillStyle(0x27ae60, 1);
    g.fillCircle(0, -4, 15);
    g.lineStyle(2, 0x1e8449, 1);
    g.strokeCircle(0, -4, 15);

    // Swivel twin barrels
    const barrels = this.scene.add.graphics();
    barrels.name = 'turretBarrels';
    barrels.fillStyle(0x1a252f, 1);
    barrels.fillRect(0, -10, 26, 5);
    barrels.fillRect(0, -2, 26, 5);
    barrels.lineStyle(1, 0x7f8c8d, 1);
    barrels.strokeRect(0, -10, 26, 5);
    barrels.strokeRect(0, -2, 26, 5);
    barrels.setPosition(0, -4);
    container.add(barrels);

    // Power status LED
    const led = this.scene.add.graphics();
    led.name = 'powerLed';
    led.fillStyle(0x00ffcc, 1);
    led.fillCircle(0, -4, 3.5);
    container.add(led);
  }

  private drawBatteryModule(g: Phaser.GameObjects.Graphics): void {
    // Section 55: External side bracket with bolts
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-18, -16, 36, 5);
    g.fillRect(-18, 11, 36, 5);

    // Heavy battery casing
    g.fillStyle(0x1b4f72, 1);
    g.fillRoundedRect(-15, -14, 30, 28, 4);
    g.lineStyle(2, 0x2980b9, 1);
    g.strokeRoundedRect(-15, -14, 30, 28, 4);

    // Charge level bars
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(-11, -9, 22, 4);
    g.fillRect(-11, -2, 22, 4);
    g.fillRect(-11, 5, 22, 4);
  }

  private drawGoldModule(g: Phaser.GameObjects.Graphics): void {
    // Section 49: Real treasure chest resting inside car bed with visible gold bars
    g.fillStyle(0x5c3818, 1);
    g.fillRoundedRect(-18, -12, 36, 26, 4);
    g.lineStyle(2, 0x3d220a, 1);
    g.strokeRoundedRect(-18, -12, 36, 26, 4);

    // Piled gold bars glistening
    g.fillStyle(0xf1c40f, 1);
    g.fillRect(-14, -18, 14, 7);
    g.fillRect(-2, -20, 16, 7);
    g.fillRect(-8, -15, 18, 6);
    g.lineStyle(1, 0xb7950b, 1);
    g.strokeRect(-14, -18, 14, 7);
    g.strokeRect(-2, -20, 16, 7);
  }

  private drawSheepModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    // Section 50: Animated sheep standing inside the wagon bed
    g.fillStyle(0xf5f5f5, 1);
    g.fillCircle(0, -6, 14);
    g.fillCircle(-8, -9, 10);
    g.fillCircle(6, -8, 10);

    // Legs standing on the bed floor
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(-9, 4, 4, 10);
    g.fillRect(-3, 4, 4, 10);
    g.fillRect(3, 4, 4, 10);
    g.fillRect(9, 4, 4, 10);

    // Sheep head container for subtle idle animation
    const head = this.scene.add.graphics();
    head.name = 'sheepHead';
    head.fillStyle(0x2c3e50, 1);
    head.fillCircle(14, -10, 7);
    head.fillEllipse(14, -16, 5, 2.5); // Ear
    head.fillStyle(0xffffff, 1);
    head.fillCircle(15, -11, 2); // Eye
    container.add(head);

    // Subtle 2-step idle twitch
    this.scene.tweens.add({
      targets: head,
      angle: 6,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawSurvivorModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    // Section 51: Mechanic standing in car bed
    // Legs
    g.fillStyle(0x34495e, 1);
    g.fillRect(-5, 4, 4, 10);
    g.fillRect(2, 4, 4, 10);

    // Body (orange jumpsuit)
    g.fillStyle(0xe67e22, 1);
    g.fillRoundedRect(-8, -8, 16, 16, 3);

    // Head
    g.fillStyle(0xf5b041, 1);
    g.fillCircle(0, -15, 8);
    // Goggles
    g.fillStyle(0x111111, 1);
    g.fillRect(-7, -17, 14, 4);
    g.fillStyle(0x3498db, 1);
    g.fillCircle(-3, -15, 2);
    g.fillCircle(3, -15, 2);

    // Animated wrench in hand
    const wrench = this.scene.add.graphics();
    wrench.name = 'survivorWrench';
    wrench.fillStyle(0xbdc3c7, 1);
    wrench.fillRect(7, -12, 4, 14);
    wrench.fillRect(5, -16, 8, 5);
    container.add(wrench);

    this.scene.tweens.add({
      targets: wrench,
      angle: -15,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut',
    });
  }

  private drawFridgeModule(g: Phaser.GameObjects.Graphics): void {
    // Section 52: Upright fridge anchored with tie-down straps
    g.fillStyle(0xb0bec5, 1);
    g.fillRoundedRect(-14, -26, 28, 42, 4);
    g.lineStyle(2, 0x37474f, 1);
    g.strokeRoundedRect(-14, -26, 28, 42, 4);

    // Freezer seam
    g.lineStyle(1.5, 0x37474f, 1);
    g.lineBetween(-14, -10, 14, -10);

    // Handles
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(9, -20, 3, 7);
    g.fillRect(9, -4, 3, 10);

    // Industrial tie-down strap across it
    g.lineStyle(2, 0xf39c12, 1);
    g.lineBetween(-16, -2, 16, -2);
  }

  private drawEggModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    // Section 53: Rested in a small cradle frame, subtle breathing
    g.fillStyle(0x34495e, 1);
    g.fillRect(-12, 8, 24, 6);

    const eggG = this.scene.add.graphics();
    eggG.fillStyle(0x7b1fa2, 1);
    eggG.fillEllipse(0, -6, 20, 30);
    eggG.lineStyle(2, 0x4a148c, 1);
    eggG.strokeEllipse(0, -6, 20, 30);

    // Glowing veins
    eggG.fillStyle(0x00e676, 0.85);
    eggG.fillCircle(-4, -10, 4);
    eggG.fillCircle(4, -2, 4.5);
    container.add(eggG);

    this.scene.tweens.add({
      targets: eggG,
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawExplosiveModule(g: Phaser.GameObjects.Graphics): void {
    // Section 55: Bolted to SIDE bracket with hazard markings
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-16, -14, 32, 4);
    g.fillRect(-16, 10, 32, 4);

    g.fillStyle(0xc0392b, 1);
    g.fillRoundedRect(-14, -15, 28, 30, 3);
    g.lineStyle(2, 0x922b21, 1);
    g.strokeRoundedRect(-14, -15, 28, 30, 3);

    // Black hazard bands
    g.fillStyle(0x111111, 1);
    g.fillRect(-14, -7, 28, 4);
    g.fillRect(-14, 3, 28, 4);

    // Warning symbol
    g.fillStyle(0xf1c40f, 1);
    g.fillTriangle(0, -12, -6, -2, 6, -2);
  }

  private drawJunkModule(g: Phaser.GameObjects.Graphics): void {
    // Side bracket scrap bundle
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-16, -12, 32, 24);
    g.fillStyle(0x95a5a6, 1);
    g.fillCircle(-4, -6, 9);
    g.fillCircle(6, 0, 8);

    g.lineStyle(2, 0xd35400, 1);
    g.lineBetween(-16, -4, 16, -4);
    g.lineBetween(-16, 4, 16, 4);
  }

  public update(time: number, speed: number, powerEfficiency: number, hasPowerShortage: boolean): void {
    // Section 13: Wheel rotation proportional to worldSpeed / wheelRadius
    const dt = this.scene.game.loop.delta * 0.001;
    for (const w of this.wheelAssemblies) {
      const rotDelta = (speed / w.radius) * dt;
      w.spokes.rotation += rotDelta;

      // Slight axle vertical vibration
      const axleJitter = Math.sin(time * 0.02 + w.baseX * 0.1) * 0.6;
      w.container.y = w.baseY + axleJitter;
    }

    // Car body vertical vibration (out-of-phase oscillation)
    const bounceOffset = Math.sin(time * 0.012 + this.carIndex * 0.9) * 1.5;
    this.container.y = this.baseCarY + bounceOffset;

    // Turret LED power alert update
    for (const slot of this.slots) {
      if (slot.installedModule && slot.installedModule.itemId === 'turret' && slot.container) {
        const led = slot.container.getByName('powerLed') as Phaser.GameObjects.Graphics | null;
        if (led) {
          if (hasPowerShortage) {
            const blink = Math.sin(time * 0.02) > 0;
            led.clear();
            led.fillStyle(blink ? 0xe74c3c : 0xf39c12, 1);
            led.fillCircle(0, -4, 3.5);
          } else {
            led.clear();
            led.fillStyle(0x00ffcc, 1);
            led.fillCircle(0, -4, 3.5);
          }
        }
      }
    }
  }

  public aimTurrets(targetX: number, targetY: number): void {
    for (const slot of this.slots) {
      if (slot.installedModule && slot.installedModule.itemId === 'turret' && slot.container) {
        const barrels = slot.container.getByName('turretBarrels') as Phaser.GameObjects.Graphics | null;
        if (barrels) {
          const worldX = this.container.x + slot.relativeX;
          const worldY = this.container.y + slot.relativeY;
          const angle = Phaser.Math.Angle.Between(worldX, worldY, targetX, targetY);
          barrels.setRotation(angle);
        }
      }
    }
  }

  public dipOnInstall(): void {
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseCarY + 9,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }
}
