import Phaser from 'phaser';
import { TrainSlot } from './TrainSlot';
import { SlotType, InstalledModule } from '../core/Types';

export type CarType = 'locomotive' | 'crane' | 'cargo' | 'flat';

export class TrainCar {
  public scene: Phaser.Scene;
  public type: CarType;
  public carIndex: number; // 0 is Locomotive, 1 is Crane, 2 is Cargo, 3+ are Flat cars
  public container: Phaser.GameObjects.Container;
  public width: number;
  public slots: TrainSlot[] = [];
  public baseCarX: number = 0;
  public baseCarY: number = 0;

  private bodySprite!: Phaser.GameObjects.Graphics;
  private wheelSprites: Phaser.GameObjects.Graphics[] = [];
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

    this.width = type === 'locomotive' ? 180 : 160;
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(25);

    this.buildCarVisuals();
    this.setupSlots();
  }

  private buildCarVisuals(): void {
    this.bodySprite = this.scene.add.graphics();
    this.container.add(this.bodySprite);

    if (this.type === 'locomotive') {
      this.drawLocomotive();
    } else if (this.type === 'crane') {
      this.drawCraneCar();
    } else {
      this.drawFlatbedCar();
    }

    // Wheels
    const wheelXPositions =
      this.type === 'locomotive'
        ? [-60, -20, 25, 65]
        : [-50, -20, 20, 50];

    for (const wx of wheelXPositions) {
      const wheel = this.scene.add.graphics();
      this.drawWheel(wheel, wx, 28, this.type === 'locomotive' && wx > 0 ? 16 : 13);
      this.container.add(wheel);
      this.wheelSprites.push(wheel);
    }
  }

  private drawLocomotive(): void {
    const g = this.bodySprite;
    g.clear();

    // Cowcatcher (wedge)
    g.fillStyle(0x2c3e50, 1);
    g.beginPath();
    g.moveTo(70, 30);
    g.lineTo(100, 30);
    g.lineTo(85, 10);
    g.closePath();
    g.fill();
    g.lineStyle(2, 0x7f8c8d, 1);
    g.stroke();

    // Heavy Boiler body
    g.fillStyle(0x34495e, 1);
    g.fillRoundedRect(-40, -22, 125, 45, 6);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-40, -22, 125, 45, 6);

    // Boiler iron bands
    g.fillStyle(0xf39c12, 1);
    g.fillRect(-15, -22, 5, 45);
    g.fillRect(25, -22, 5, 45);
    g.fillRect(60, -22, 5, 45);

    // Cabin
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-85, -45, 55, 68, 4);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-85, -45, 55, 68, 4);

    // Cabin window (warm glowing yellow)
    g.fillStyle(0xf1c40f, 0.85);
    g.fillRect(-75, -35, 18, 18);
    g.fillRect(-50, -35, 14, 18);

    // Chimney / Smoke stack
    g.fillStyle(0x1a252f, 1);
    g.fillRect(45, -45, 16, 25);
    g.fillStyle(0x7f8c8d, 1);
    g.fillEllipse(53, -45, 20, 8);

    // Headlight cone & lamp
    g.fillStyle(0xf39c12, 1);
    g.fillRect(85, -10, 10, 14);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(95, -3, 6);

    // Headlight volumetric beam forward
    g.fillStyle(0xfff9d2, 0.15);
    g.beginPath();
    g.moveTo(96, -3);
    g.lineTo(340, -50);
    g.lineTo(340, 45);
    g.closePath();
    g.fill();

    // Coupling joint at rear
    g.fillStyle(0x111111, 1);
    g.fillRect(-92, 12, 10, 12);
  }

  private drawCraneCar(): void {
    const g = this.bodySprite;
    g.clear();

    // Chassis flatbed
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-75, 5, 150, 20, 3);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-75, 5, 150, 20, 3);

    // Crane base pedestal
    g.fillStyle(0xd35400, 1); // Industrial hazard orange
    g.fillRect(-20, -18, 40, 25);
    g.lineStyle(2, 0x7e3000, 1);
    g.strokeRect(-20, -18, 40, 25);

    // Crane turntable ring
    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(0, -18, 14);
    g.lineStyle(2, 0x2c3e50, 1);
    g.strokeCircle(0, -18, 14);

    // Couplers
    g.fillStyle(0x111111, 1);
    g.fillRect(-82, 10, 10, 10);
    g.fillRect(72, 10, 10, 10);
  }

  private drawFlatbedCar(): void {
    const g = this.bodySprite;
    g.clear();

    // Heavy industrial cargo chassis
    g.fillStyle(0x3e2723, 1); // Rugged dark brown/steel
    g.fillRoundedRect(-75, -5, 150, 30, 3);
    g.lineStyle(2, 0x21130d, 1);
    g.strokeRoundedRect(-75, -5, 150, 30, 3);

    // Side metal railings / brackets
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-70, -12, 6, 8);
    g.fillRect(-25, -12, 6, 8);
    g.fillRect(20, -12, 6, 8);
    g.fillRect(65, -12, 6, 8);
    g.fillRect(-70, -14, 140, 3);

    // Rivets
    g.fillStyle(0x95a5a6, 1);
    for (let x = -65; x <= 65; x += 22) {
      g.fillCircle(x, 10, 2);
    }

    // Couplers
    g.fillStyle(0x111111, 1);
    g.fillRect(-82, 10, 10, 10);
    g.fillRect(72, 10, 10, 10);
  }

  private drawWheel(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    g.clear();
    // Dark steel tire
    g.fillStyle(0x1a252f, 1);
    g.fillCircle(x, y, r);
    // Outer metallic rim
    g.lineStyle(2, 0x95a5a6, 1);
    g.strokeCircle(x, y, r);
    // Inner hub
    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(x, y, r * 0.4);
    // Spokes
    g.lineStyle(1.5, 0x34495e, 1);
    g.lineBetween(x - r + 2, y, x + r - 2, y);
    g.lineBetween(x, y - r + 2, x, y + r - 2);
  }

  private setupSlots(): void {
    if (this.type === 'locomotive') {
      // Locomotive has no installable slots
      return;
    }

    if (this.type === 'crane') {
      // Crane Car has BODY and SIDE slots (TOP is occupied by crane turntable)
      this.slots.push(new TrainSlot('BODY', -35, -5));
      this.slots.push(new TrainSlot('SIDE', 35, 12));
    } else {
      // Cargo and Flat Cars have TOP, BODY, SIDE
      this.slots.push(new TrainSlot('TOP', 0, -32));
      this.slots.push(new TrainSlot('BODY', -25, -10));
      this.slots.push(new TrainSlot('SIDE', 25, 12));
    }
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

    // Pop bounce animation on install
    visual.setScale(0.2);
    this.scene.tweens.add({
      targets: visual,
      scaleX: 1.0,
      scaleY: 1.0,
      duration: 220,
      ease: 'Back.easeOut',
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

    // Interactive hitbox for hover tooltip and right-click discard
    const hitArea = this.scene.add.rectangle(0, 0, 48, 48, 0x000000, 0.001);
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

    // Render detailed visual representation based on item type
    const g = this.scene.add.graphics();
    c.add(g);

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
        this.drawSheepModule(g);
        break;
      case 'survivor':
        this.drawSurvivorModule(g);
        break;
      case 'fridge':
        this.drawFridgeModule(g, module);
        break;
      case 'egg':
        this.drawEggModule(g, module);
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
    // Heavy base
    g.fillStyle(0x34495e, 1);
    g.fillRect(-16, -2, 32, 10);
    g.lineStyle(1.5, 0x1a252f, 1);
    g.strokeRect(-16, -2, 32, 10);

    // Swivel dome
    g.fillStyle(0x27ae60, 1);
    g.fillCircle(0, -5, 12);
    g.lineStyle(2, 0x1e8449, 1);
    g.strokeCircle(0, -5, 12);

    // Barrels container (allows dynamic rotation towards targets)
    const barrels = this.scene.add.graphics();
    barrels.name = 'turretBarrels';
    barrels.fillStyle(0x111111, 1);
    barrels.fillRect(0, -9, 22, 4);
    barrels.fillRect(0, -3, 22, 4);
    barrels.lineStyle(1, 0x7f8c8d, 1);
    barrels.strokeRect(0, -9, 22, 4);
    barrels.strokeRect(0, -3, 22, 4);
    barrels.setPosition(0, -5);
    container.add(barrels);

    // Power status LED indicator
    const led = this.scene.add.graphics();
    led.name = 'powerLed';
    led.fillStyle(0x00ffcc, 1);
    led.fillCircle(0, -5, 3);
    container.add(led);
  }

  private drawBatteryModule(g: Phaser.GameObjects.Graphics): void {
    // Battery casing
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-14, -14, 28, 28, 4);
    g.lineStyle(2, 0x3498db, 1);
    g.strokeRoundedRect(-14, -14, 28, 28, 4);

    // Glowing electric charge cells
    g.fillStyle(0x2ecc71, 1);
    g.fillRect(-10, -9, 20, 4);
    g.fillRect(-10, -2, 20, 4);
    g.fillRect(-10, 5, 20, 4);

    // Lightning bolt emblem
    g.fillStyle(0xf1c40f, 1);
    g.beginPath();
    g.moveTo(2, -12);
    g.lineTo(-4, 0);
    g.lineTo(0, 0);
    g.lineTo(-2, 12);
    g.lineTo(4, 0);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
  }

  private drawGoldModule(g: Phaser.GameObjects.Graphics): void {
    // Wooden / metal chest
    g.fillStyle(0x784212, 1);
    g.fillRoundedRect(-15, -12, 30, 24, 3);
    g.lineStyle(2, 0x4d2a07, 1);
    g.strokeRoundedRect(-15, -12, 30, 24, 3);

    // Gold ingots piled overflowing
    g.fillStyle(0xf1c40f, 1);
    g.fillRect(-11, -16, 12, 6);
    g.fillRect(-1, -18, 12, 6);
    g.fillRect(-7, -14, 14, 5);
    g.lineStyle(1, 0xb7950b, 1);
    g.strokeRect(-11, -16, 12, 6);
    g.strokeRect(-1, -18, 12, 6);

    // Sparkle star
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(2, -15, 2);
  }

  private drawSheepModule(g: Phaser.GameObjects.Graphics): void {
    // Fluffy sheep body
    g.fillStyle(0xecf0f1, 1);
    g.fillCircle(0, 0, 12);
    g.fillCircle(-6, -2, 9);
    g.fillCircle(6, -2, 9);

    // Black head and ears
    g.fillStyle(0x2c3e50, 1);
    g.fillCircle(12, -4, 6);
    g.fillEllipse(12, -9, 4, 2); // Ear

    // Eye
    g.fillStyle(0xffffff, 1);
    g.fillCircle(13, -5, 1.5);

    // 4 legs
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(-8, 9, 3, 7);
    g.fillRect(-3, 9, 3, 7);
    g.fillRect(3, 9, 3, 7);
    g.fillRect(8, 9, 3, 7);
  }

  private drawSurvivorModule(g: Phaser.GameObjects.Graphics): void {
    // Mechanic survivor with helmet / bandana
    // Body (orange jumpsuit)
    g.fillStyle(0xe67e22, 1);
    g.fillRoundedRect(-7, -6, 14, 18, 3);

    // Head
    g.fillStyle(0xf5b041, 1);
    g.fillCircle(0, -12, 7);

    // Welder goggles
    g.fillStyle(0x111111, 1);
    g.fillRect(-6, -14, 12, 4);
    g.fillStyle(0x3498db, 1);
    g.fillCircle(-2, -12, 2);
    g.fillCircle(3, -12, 2);

    // Wrench in hand
    g.fillStyle(0xbdc3c7, 1);
    g.fillRect(7, -8, 3, 12);
    g.fillRect(5, -12, 7, 4);
  }

  private drawFridgeModule(g: Phaser.GameObjects.Graphics, module: InstalledModule): void {
    // Retro refrigerator
    g.fillStyle(0x95a5a6, 1);
    g.fillRoundedRect(-12, -18, 24, 34, 4);
    g.lineStyle(2, 0x2c3e50, 1);
    g.strokeRoundedRect(-12, -18, 24, 34, 4);

    // Freezer line
    g.lineStyle(1.5, 0x2c3e50, 1);
    g.lineBetween(-12, -5, 12, -5);

    // Chrome handle
    g.fillStyle(0xecf0f1, 1);
    g.fillRect(7, -12, 3, 6);
    g.fillRect(7, 2, 3, 8);

    // Caution stripes
    g.fillStyle(0xf39c12, 1);
    g.fillRect(-10, 10, 20, 3);
  }

  private drawEggModule(g: Phaser.GameObjects.Graphics, module: InstalledModule): void {
    // Glowing alien/monster egg
    g.fillStyle(0x8e44ad, 1);
    g.fillEllipse(0, -2, 16, 24);
    g.lineStyle(2, 0x5b2c6f, 1);
    g.strokeEllipse(0, -2, 16, 24);

    // Bio-luminescent veins
    g.fillStyle(0x2ecc71, 0.85);
    g.fillCircle(-3, -6, 3);
    g.fillCircle(4, 2, 3.5);
    g.fillCircle(-2, 5, 2.5);
  }

  private drawExplosiveModule(g: Phaser.GameObjects.Graphics): void {
    // Red hazardous barrel
    g.fillStyle(0xc0392b, 1);
    g.fillRoundedRect(-12, -14, 24, 28, 3);
    g.lineStyle(2, 0x922b21, 1);
    g.strokeRoundedRect(-12, -14, 24, 28, 3);

    // Barrel black ribs
    g.fillStyle(0x111111, 1);
    g.fillRect(-12, -7, 24, 3);
    g.fillRect(-12, 4, 24, 3);

    // Hazard symbol
    g.fillStyle(0xf1c40f, 1);
    g.fillTriangle(0, -12, -6, -2, 6, -2);
    g.fillStyle(0x111111, 1);
    g.fillCircle(0, -5, 1.5);
  }

  private drawJunkModule(g: Phaser.GameObjects.Graphics): void {
    // Bundled scrap metal / gears
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-14, -8, 28, 18);
    g.fillStyle(0x95a5a6, 1);
    g.fillCircle(-4, -10, 8);
    g.fillCircle(6, -6, 7);

    // Steel ropes binding it
    g.lineStyle(2, 0xd35400, 1);
    g.lineBetween(-14, -2, 14, -2);
    g.lineBetween(-14, 4, 14, 4);
    g.lineBetween(-6, -14, 2, 10);
  }

  public update(time: number, speed: number, powerEfficiency: number, hasPowerShortage: boolean): void {
    // Wheels rotation
    const rotationSpeed = (speed * 0.05) % (Math.PI * 2);
    this.wheelAngle += rotationSpeed;

    // Slight vertical out-of-phase oscillation (Section 14)
    const bounceOffset = Math.sin(time * 0.012 + this.carIndex * 0.9) * 1.5;
    this.container.y = this.baseCarY + bounceOffset;

    // Update wheels
    for (const w of this.wheelSprites) {
      w.setRotation(this.wheelAngle);
    }

    // Update installed modules visuals (e.g. turrets power state LED)
    for (const slot of this.slots) {
      if (slot.installedModule && slot.container) {
        if (slot.installedModule.itemId === 'turret') {
          const led = slot.container.getByName('powerLed') as Phaser.GameObjects.Graphics | null;
          if (led) {
            if (hasPowerShortage) {
              // Flicker amber/red on shortage
              const blink = Math.sin(time * 0.02) > 0;
              led.clear();
              led.fillStyle(blink ? 0xe74c3c : 0xf39c12, 1);
              led.fillCircle(0, -5, 3);
            } else {
              led.clear();
              led.fillStyle(0x00ffcc, 1);
              led.fillCircle(0, -5, 3);
            }
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
    // Section 28: car dips vertically and bounces back
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseCarY + 8,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }
}
