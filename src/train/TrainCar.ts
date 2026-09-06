import Phaser from 'phaser';
import { TrainSlot } from './TrainSlot';
import { SlotType, InstalledModule, CargoItem } from '../core/Types';

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
  private onCargoDiscardCallback?: (instanceId: string) => void;
  private onCargoHoverCallback?: (cargo: CargoItem | null, screenX: number, screenY: number) => void;

  // V3 Cargo Visuals inside car
  public cargoVisuals: Map<string, { container: Phaser.GameObjects.Container; item: CargoItem; anchorIndex: number }> = new Map();

  // Section 37: Visual anchors inside wagon bed
  public static readonly CARGO_ANCHORS = [
    { x: -50, y: -9, angle: 0 },
    { x: -25, y: -11, angle: -2 },
    { x: 0, y: -9, angle: 1 },
    { x: 25, y: -11, angle: -1 },
    { x: 50, y: -9, angle: 2 },
    { x: -35, y: -26, angle: 1 },
    { x: -10, y: -27, angle: -2 },
    { x: 15, y: -26, angle: 0 },
    { x: 40, y: -27, angle: 2 },
  ];

  constructor(
    scene: Phaser.Scene,
    type: CarType,
    carIndex: number,
    onDiscard: (module: InstalledModule) => void,
    onHover: (module: InstalledModule | null, screenX: number, screenY: number) => void,
    onCargoDiscard?: (instanceId: string) => void,
    onCargoHover?: (cargo: CargoItem | null, screenX: number, screenY: number) => void
  ) {
    this.scene = scene;
    this.type = type;
    this.carIndex = carIndex;
    this.onModuleDiscardCallback = onDiscard;
    this.onModuleHoverCallback = onHover;
    this.onCargoDiscardCallback = onCargoDiscard;
    this.onCargoHoverCallback = onCargoHover;

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
      this.createWheelAssembly(-65, 34, 17);
      this.createWheelAssembly(0, 34, 20);
      this.createWheelAssembly(65, 34, 20);
    } else if (this.type === 'crane') {
      this.drawCraneCar();
      this.createWheelAssembly(-55, 34, 16);
      this.createWheelAssembly(55, 34, 16);
    } else {
      this.drawOpenWagonCar();
      this.createWheelAssembly(-55, 34, 16);
      this.createWheelAssembly(55, 34, 16);
    }
  }

  private createWheelAssembly(wx: number, wy: number, r: number): void {
    const wheelCont = this.scene.add.container(wx, wy);

    const tireG = this.scene.add.graphics();
    tireG.fillStyle(0x1a252f, 1);
    tireG.fillCircle(0, 0, r);
    tireG.lineStyle(2.5, 0x95a5a6, 1);
    tireG.strokeCircle(0, 0, r);
    wheelCont.add(tireG);

    const spokesG = this.scene.add.graphics();
    spokesG.lineStyle(2, 0x566573, 1);
    spokesG.lineBetween(-r + 3, 0, r - 3, 0);
    spokesG.lineBetween(0, -r + 3, 0, r - 3);
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

    // Cowcatcher
    g.fillStyle(0x2c3e50, 1);
    g.beginPath();
    g.moveTo(90, 36);
    g.lineTo(125, 36);
    g.lineTo(105, 12);
    g.closePath();
    g.fill();
    g.lineStyle(2, 0x7f8c8d, 1);
    g.stroke();

    // Top beveled plate
    g.fillStyle(0x415b76, 1);
    g.fillRect(-50, -32, 155, 8);

    // Boiler body
    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-50, -25, 155, 55, 6);
    g.lineStyle(2.5, 0x1a252f, 1);
    g.strokeRoundedRect(-50, -25, 155, 55, 6);

    // Brass bands
    g.fillStyle(0xf39c12, 1);
    g.fillRect(-20, -25, 6, 55);
    g.fillRect(30, -25, 6, 55);
    g.fillRect(75, -25, 6, 55);

    // Driver Cabin
    g.fillStyle(0x34495e, 1);
    g.fillRoundedRect(-108, -55, 68, 85, 5);
    g.lineStyle(2.5, 0x1a252f, 1);
    g.strokeRoundedRect(-108, -55, 68, 85, 5);

    // Cabin roof
    g.fillStyle(0x415b76, 1);
    g.fillRect(-112, -60, 76, 6);

    // Window
    g.fillStyle(0xf1c40f, 0.85);
    g.fillRect(-85, -42, 28, 22);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRect(-85, -42, 28, 22);

    // Smokestack & Steam dome
    g.fillStyle(0x1a252f, 1);
    g.fillRect(60, -56, 18, 32);
    g.fillStyle(0xf39c12, 1);
    g.fillRect(56, -60, 26, 6);

    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(10, -32, 14);

    // Headlight
    g.fillStyle(0xf1c40f, 1);
    g.fillCircle(112, -2, 11);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(114, -2, 6);

    // Chassis rail beam
    g.fillStyle(0x111111, 1);
    g.fillRect(-112, 26, 224, 10);

    // Coupler
    g.fillStyle(0x111111, 1);
    g.fillRect(-118, 20, 12, 12);
  }

  private drawCraneCar(): void {
    const g = this.bodyGraphics;
    g.clear();

    g.fillStyle(0x111111, 1);
    g.fillRect(-95, 24, 190, 10);

    g.fillStyle(0x27ae60, 1);
    g.fillRect(-90, 0, 180, 24);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRect(-90, 0, 180, 24);

    g.fillStyle(0x1e824c, 1);
    g.fillRect(-90, -4, 180, 5);

    g.fillStyle(0x2c3e50, 1);
    g.fillRoundedRect(-35, -28, 70, 28, 4);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRoundedRect(-35, -28, 70, 28, 4);

    g.fillStyle(0xf39c12, 1);
    g.fillCircle(0, -20, 12);
    g.lineStyle(2, 0x111111, 1);
    g.strokeCircle(0, -20, 12);

    g.fillStyle(0xd35400, 1);
    g.fillRect(-75, -8, 28, 12);
    g.lineStyle(1.5, 0x111111, 1);
    g.strokeRect(-75, -8, 28, 12);

    g.fillStyle(0x111111, 1);
    g.fillRect(-99, 14, 12, 12);
    g.fillRect(87, 14, 12, 12);
  }

  private drawOpenWagonCar(): void {
    const g = this.bodyGraphics;
    g.clear();

    g.fillStyle(0x111111, 1);
    g.fillRect(-95, 24, 190, 10);

    // Bed interior
    g.fillStyle(0x1b2631, 1);
    g.fillRect(-85, -28, 170, 48);

    g.fillStyle(0x151c24, 1);
    g.fillRect(-85, -28, 170, 12);

    // Outer wagon body
    g.fillStyle(this.type === 'flat' ? 0x2e4053 : 0x34495e, 1);
    g.fillRect(-90, 4, 180, 20);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRect(-90, 4, 180, 20);

    // Flanks
    g.fillStyle(0x415b76, 1);
    g.fillRect(-92, -26, 12, 34);
    g.fillRect(80, -26, 12, 34);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRect(-92, -26, 12, 34);
    g.strokeRect(80, -26, 12, 34);

    // Stakes
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-85, -26, 8, 32);
    g.fillRect(-30, -26, 8, 32);
    g.fillRect(22, -26, 8, 32);
    g.fillRect(77, -26, 8, 32);

    // Top mounting hardpoint for Turret
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
    if (this.type === 'locomotive' || this.type === 'crane') {
      return;
    }

    // Section 42: Cargo & Flat Car ONLY retain TOP x1 and SIDE x1 (BODY removed)
    this.slots.push(new TrainSlot('TOP', 0, -42));
    this.slots.push(new TrainSlot('SIDE', 45, 14));
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

    visual.setPosition(targetSlot.relativeX, targetSlot.relativeY - 35);
    visual.setAlpha(0.6);

    this.scene.tweens.add({
      targets: visual,
      y: targetSlot.relativeY + 4,
      alpha: 1.0,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => {
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

  // --- V3 CARGO VISUAL MANAGEMENT ---
  public addCargoVisual(cargo: CargoItem, anchorIdx: number): Phaser.GameObjects.Container {
    const anchor = TrainCar.CARGO_ANCHORS[anchorIdx % TrainCar.CARGO_ANCHORS.length];
    const c = this.scene.add.container(anchor.x, anchor.y - 30);
    c.setAngle(anchor.angle);

    // Hitbox for hover tooltip and right-click discard
    const hitArea = this.scene.add.rectangle(0, 0, 44, 44, 0x000000, 0.001);
    hitArea.setInteractive({ cursor: 'pointer' });

    hitArea.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (this.onCargoHoverCallback) {
        this.onCargoHoverCallback(cargo, pointer.worldX, pointer.worldY);
      }
    });
    hitArea.on('pointerout', () => {
      if (this.onCargoHoverCallback) {
        this.onCargoHoverCallback(null, 0, 0);
      }
    });
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() && this.onCargoDiscardCallback) {
        if (this.onCargoHoverCallback) {
          this.onCargoHoverCallback(null, 0, 0);
        }
        this.onCargoDiscardCallback(cargo.instanceId);
      }
    });

    c.add(hitArea);

    const g = this.scene.add.graphics();
    c.add(g);

    // Draw specific cargo type
    switch (cargo.itemId) {
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

    this.container.add(c);
    this.cargoVisuals.set(cargo.instanceId, { container: c, item: cargo, anchorIndex: anchorIdx });

    // Drop-in animation
    this.scene.tweens.add({
      targets: c,
      y: anchor.y,
      duration: 160,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.dipOnInstall();
      },
    });

    return c;
  }

  public removeCargoVisual(instanceId: string): void {
    const entry = this.cargoVisuals.get(instanceId);
    if (entry) {
      entry.container.destroy();
      this.cargoVisuals.delete(instanceId);
    }
  }

  public clearCargoVisuals(): void {
    for (const [, entry] of this.cargoVisuals) {
      entry.container.destroy();
    }
    this.cargoVisuals.clear();
  }

  // --- MODULE VISUALS ---
  private createModuleVisual(module: InstalledModule): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0);

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

    switch (module.itemId) {
      case 'turret':
        this.drawTurretModule(g, c);
        break;
      case 'battery':
        this.drawBatteryModule(g);
        break;
    }

    return c;
  }

  private drawTurretModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    g.fillStyle(0x2c3e50, 1);
    g.fillRect(-14, 4, 28, 8);
    g.lineStyle(1.5, 0x111111, 1);
    g.strokeRect(-14, 4, 28, 8);

    g.fillStyle(0x7f8c8d, 1);
    g.fillCircle(0, 2, 8);

    const barrelsCont = this.scene.add.container(0, -4);
    const bG = this.scene.add.graphics();
    bG.fillStyle(0x1a252f, 1);
    bG.fillRect(0, -4, 24, 4);
    bG.fillRect(0, 1, 24, 4);
    bG.fillStyle(0xd35400, 1);
    bG.fillRect(20, -5, 5, 6);
    bG.fillRect(20, 0, 5, 6);

    bG.fillStyle(0x27ae60, 1);
    bG.fillRoundedRect(-12, -8, 16, 16, 3);
    bG.lineStyle(1.5, 0x111111, 1);
    bG.strokeRoundedRect(-12, -8, 16, 16, 3);

    bG.fillStyle(0x00ffcc, 1);
    bG.fillCircle(0, 0, 3);

    barrelsCont.add(bG);
    container.add(barrelsCont);

    this.scene.tweens.add({
      targets: barrelsCont,
      angle: { from: -14, to: 8 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawBatteryModule(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x34495e, 1);
    g.fillRect(-16, -14, 32, 28);
    g.lineStyle(2, 0x1a252f, 1);
    g.strokeRect(-16, -14, 32, 28);

    g.fillStyle(0x27ae60, 1);
    g.fillRect(-12, -10, 24, 18);

    g.fillStyle(0x00ffcc, 1);
    g.beginPath();
    g.moveTo(2, -8);
    g.lineTo(-4, 0);
    g.lineTo(1, 0);
    g.lineTo(-2, 7);
    g.lineTo(5, -1);
    g.lineTo(0, -1);
    g.closePath();
    g.fill();

    g.fillStyle(0xf39c12, 1);
    g.fillRect(-10, -18, 6, 4);
    g.fillStyle(0x95a5a6, 1);
    g.fillRect(4, -18, 6, 4);
  }

  private drawGoldModule(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x5d4037, 1);
    g.fillRoundedRect(-16, -8, 32, 20, 3);
    g.lineStyle(2, 0x3e2723, 1);
    g.strokeRoundedRect(-16, -8, 32, 20, 3);

    g.fillStyle(0xf1c40f, 1);
    g.fillRect(-16, -2, 32, 4);
    g.fillRect(-4, -8, 8, 20);

    g.fillStyle(0xffd700, 1);
    g.fillRect(-12, -15, 11, 6);
    g.fillRect(1, -15, 11, 6);
    g.fillRect(-6, -20, 12, 5);
    g.lineStyle(1, 0xb7950b, 1);
    g.strokeRect(-12, -15, 11, 6);
    g.strokeRect(1, -15, 11, 6);
    g.strokeRect(-6, -20, 12, 5);
  }

  private drawSheepModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    g.fillStyle(0x111111, 1);
    g.fillRect(-10, 2, 4, 10);
    g.fillRect(6, 2, 4, 10);

    g.fillStyle(0xecf0f1, 1);
    g.fillCircle(0, -4, 12);
    g.fillCircle(-8, -4, 9);
    g.fillCircle(8, -4, 9);

    const headCont = this.scene.add.container(12, -8);
    const headG = this.scene.add.graphics();
    headG.fillStyle(0x2c3e50, 1);
    headG.fillCircle(0, 0, 6);
    headG.fillStyle(0xffffff, 1);
    headG.fillCircle(2, -1, 1.5);
    headCont.add(headG);
    container.add(headCont);

    this.scene.tweens.add({
      targets: headCont,
      y: { from: -8, to: -5 },
      angle: { from: -5, to: 10 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawSurvivorModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    g.fillStyle(0x2980b9, 1);
    g.fillRect(-4, 0, 4, 12);
    g.fillRect(0, 0, 4, 12);

    g.fillStyle(0xe67e22, 1);
    g.fillRoundedRect(-7, -14, 14, 15, 2);

    g.fillStyle(0xf5b041, 1);
    g.fillCircle(0, -19, 5);

    g.fillStyle(0xf39c12, 1);
    g.fillCircle(0, -22, 6);

    const armCont = this.scene.add.container(6, -10);
    const armG = this.scene.add.graphics();
    armG.fillStyle(0xe67e22, 1);
    armG.fillRect(0, -2, 12, 4);
    armG.fillStyle(0x95a5a6, 1);
    armG.fillRect(10, -7, 4, 12);
    armCont.add(armG);
    container.add(armCont);

    this.scene.tweens.add({
      targets: armCont,
      angle: { from: -30, to: 25 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawFridgeModule(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xbdc3c7, 1);
    g.fillRoundedRect(-14, -26, 28, 42, 3);
    g.lineStyle(2, 0x7f8c8d, 1);
    g.strokeRoundedRect(-14, -26, 28, 42, 3);

    g.lineStyle(1.5, 0x34495e, 1);
    g.lineBetween(-14, -10, 14, -10);

    g.fillStyle(0x34495e, 1);
    g.fillRect(8, -22, 3, 8);
    g.fillRect(8, -6, 3, 14);

    g.lineStyle(2, 0xd35400, 0.9);
    g.lineBetween(-16, -18, 16, -18);
    g.lineBetween(-16, 2, 16, 2);
  }

  private drawEggModule(g: Phaser.GameObjects.Graphics, container: Phaser.GameObjects.Container): void {
    g.fillStyle(0x34495e, 1);
    g.fillRect(-10, 6, 20, 5);
    g.lineStyle(1.5, 0x1a252f, 1);
    g.strokeRect(-10, 6, 20, 5);

    g.fillStyle(0x8e44ad, 1);
    g.fillEllipse(0, -6, 18, 24);
    g.lineStyle(2, 0x4a235a, 1);
    g.strokeEllipse(0, -6, 18, 24);

    g.fillStyle(0x2ecc71, 0.85);
    g.fillCircle(-3, -8, 3.5);
    g.fillCircle(3, -3, 2.5);

    this.scene.tweens.add({
      targets: container,
      scaleX: 1.08,
      scaleY: 0.94,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawExplosiveModule(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0xc0392b, 1);
    g.fillRoundedRect(-12, -14, 24, 28, 3);
    g.lineStyle(2, 0x7b241c, 1);
    g.strokeRoundedRect(-12, -14, 24, 28, 3);

    g.fillStyle(0xf1c40f, 1);
    g.fillRect(-12, -4, 24, 7);

    g.fillStyle(0x000000, 1);
    g.fillRect(-8, -3, 4, 5);
    g.fillRect(4, -3, 4, 5);
  }

  private drawJunkModule(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x7f8c8d, 1);
    g.fillRect(-14, -6, 28, 16);
    g.fillStyle(0x95a5a6, 1);
    g.fillRect(-10, -14, 20, 12);
    g.fillStyle(0xd35400, 1);
    g.fillCircle(4, -6, 7);
    g.lineStyle(1.5, 0x2c3e50, 1);
    g.strokeRect(-14, -6, 28, 16);
  }

  public dipOnInstall(): void {
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseCarY + 6,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }

  public update(time: number, delta: number, worldSpeed: number): void {
    if (worldSpeed > 0) {
      const dt = delta * 0.001;
      const rotationSpeed = (worldSpeed / 20) * 0.45;
      this.wheelAngle += rotationSpeed * dt * 100;

      for (const w of this.wheelAssemblies) {
        w.spokes.setAngle(this.wheelAngle);
      }
    }
  }
}
