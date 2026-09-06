import Phaser from 'phaser';
import { ItemData, ItemId, DepthBand } from '../core/Types';
import { DepthManager } from '../world/DepthManager';
import { EventBus } from '../core/EventBus';

export class WorldItem {
  public scene: Phaser.Scene;
  public data: ItemData;
  public container: Phaser.GameObjects.Container;
  public shadow: Phaser.GameObjects.Graphics;
  public depthBand: DepthBand;
  public isLatched: boolean = false;
  public isDelivered: boolean = false;
  public isDiscarded: boolean = false;
  public isDestroyed: boolean = false;
  public hookWeight: number;

  private depthManager: DepthManager;
  private firstSeenLabel: Phaser.GameObjects.Container | null = null;
  private outlineGlow: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    data: ItemData,
    depthBand: DepthBand,
    showFirstSeenTip: boolean = false
  ) {
    this.scene = scene;
    this.data = data;
    this.depthBand = depthBand;
    this.depthManager = DepthManager.getInstance();
    this.hookWeight = data.hookWeight || data.load || 5;

    const props = this.depthManager.getPropertiesForY(y);

    // Shadow
    this.shadow = scene.add.graphics();
    this.shadow.fillStyle(0x000000, 0.35);
    this.shadow.fillEllipse(0, 0, 36 * props.shadowScale, 14 * props.shadowScale);
    this.shadow.setPosition(x, y + props.shadowYOffset);
    this.shadow.setDepth(props.depth - 0.5);

    // Container
    this.container = scene.add.container(x, y);
    this.container.setScale(props.scale);
    this.container.setDepth(props.depth);

    // Outline for mouse hover
    this.outlineGlow = scene.add.graphics();
    this.outlineGlow.setVisible(false);
    this.container.add(this.outlineGlow);

    // Item visuals
    this.buildItemVisuals();

    // First seen tooltip (Section 86)
    if (showFirstSeenTip) {
      this.createFirstSeenTooltip();
    }

    // Set interactive
    const hitArea = scene.add.rectangle(0, 0, 48, 48, 0x000000, 0.001);
    hitArea.setInteractive({ cursor: 'crosshair' });
    hitArea.on('pointerover', () => {
      this.setHoverHighlight(true);
    });
    hitArea.on('pointerout', () => {
      this.setHoverHighlight(false);
    });
    this.container.add(hitArea);

    EventBus.getInstance().emit('ITEM_SEEN', { item: data.id, x, y });
  }

  private buildItemVisuals(): void {
    const g = this.scene.add.graphics();
    this.container.add(g);

    switch (this.data.id) {
      case 'parts':
        // Wooden repair toolbox crate with wrench emblem
        g.fillStyle(0x795548, 1);
        g.fillRoundedRect(-16, -14, 32, 28, 3);
        g.lineStyle(2, 0x4e342e, 1);
        g.strokeRoundedRect(-16, -14, 32, 28, 3);
        g.fillStyle(0x4caf50, 1);
        g.fillRect(-10, -4, 20, 8);
        g.fillStyle(0xffffff, 1);
        g.fillRect(-2, -8, 4, 16);
        break;

      case 'fuel':
        // Fuel drum / canister
        g.fillStyle(0xd32f2f, 1); // Hazard red
        g.fillRoundedRect(-14, -18, 28, 36, 4);
        g.lineStyle(2, 0x851414, 1);
        g.strokeRoundedRect(-14, -18, 28, 36, 4);
        g.fillStyle(0xffeb3b, 1); // Fuel flame icon
        g.fillTriangle(0, -10, -6, 4, 6, 4);
        g.fillCircle(0, 5, 4);
        break;

      case 'gold':
        // Solid heavy gold chest
        g.fillStyle(0xd4ac0d, 1);
        g.fillRoundedRect(-16, -14, 32, 28, 3);
        g.lineStyle(2, 0x9a7d0a, 1);
        g.strokeRoundedRect(-16, -14, 32, 28, 3);
        g.fillStyle(0xfef9e7, 1);
        g.fillCircle(4, -6, 3); // Glimmer
        break;

      case 'turret':
        // Auto turret package
        g.fillStyle(0x2e7d32, 1);
        g.fillCircle(0, 0, 15);
        g.fillStyle(0x1b5e20, 1);
        g.fillRect(-14, 5, 28, 8);
        g.fillStyle(0x212121, 1);
        g.fillRect(0, -5, 20, 5);
        g.fillRect(0, 2, 20, 5);
        break;

      case 'battery':
        // High voltage battery pack
        g.fillStyle(0x1565c0, 1);
        g.fillRoundedRect(-14, -15, 28, 30, 4);
        g.fillStyle(0x00e676, 1);
        g.fillRect(-10, -8, 20, 4);
        g.fillRect(-10, 0, 20, 4);
        g.fillStyle(0xffeb3b, 1);
        g.beginPath();
        g.moveTo(2, -12);
        g.lineTo(-4, 0);
        g.lineTo(0, 0);
        g.lineTo(-2, 10);
        g.lineTo(4, 0);
        g.closePath();
        g.fill();
        break;

      case 'flat_car':
        // Mini flatbed car frame on skids
        g.fillStyle(0x424242, 1);
        g.fillRect(-24, -8, 48, 16);
        g.lineStyle(2, 0xf57c00, 1); // Orange caution boundary
        g.strokeRect(-24, -8, 48, 16);
        g.fillStyle(0x616161, 1);
        g.fillRect(-20, -12, 6, 4);
        g.fillRect(14, -12, 6, 4);
        break;

      case 'sheep':
        // Woolly sheep
        g.fillStyle(0xf5f5f5, 1);
        g.fillCircle(0, 0, 14);
        g.fillCircle(-8, -3, 10);
        g.fillStyle(0x212121, 1);
        g.fillCircle(12, -4, 6);
        g.fillStyle(0xffffff, 1);
        g.fillCircle(13, -5, 2);
        break;

      case 'survivor':
        // Wasteland survivor standing / waving
        g.fillStyle(0xff9800, 1);
        g.fillRoundedRect(-8, -6, 16, 20, 3);
        g.fillStyle(0xffcc80, 1);
        g.fillCircle(0, -12, 7);
        g.fillStyle(0x37474f, 1);
        g.fillRect(-6, -14, 12, 4); // Goggles
        break;

      case 'fridge':
        // Vintage rounded fridge with tape
        g.fillStyle(0xb0bec5, 1);
        g.fillRoundedRect(-12, -18, 24, 36, 4);
        g.lineStyle(2, 0x37474f, 1);
        g.strokeRoundedRect(-12, -18, 24, 36, 4);
        g.fillStyle(0xff5722, 1);
        g.fillRect(-10, 8, 20, 3);
        break;

      case 'egg':
        // Bioluminescent monster egg
        g.fillStyle(0x7b1fa2, 1);
        g.fillEllipse(0, 0, 18, 26);
        g.fillStyle(0x69f0ae, 0.9);
        g.fillCircle(-3, -5, 3.5);
        g.fillCircle(3, 4, 4);
        break;

      case 'explosive':
        // Red TNT explosive barrel
        g.fillStyle(0xc62828, 1);
        g.fillRoundedRect(-14, -16, 28, 32, 3);
        g.fillStyle(0x212121, 1);
        g.fillRect(-14, -8, 28, 4);
        g.fillRect(-14, 4, 28, 4);
        g.fillStyle(0xffea00, 1);
        g.fillTriangle(0, -14, -6, -4, 6, -4);
        break;

      case 'junk':
        // Scrap bundle with ropes
        g.fillStyle(0x546e7a, 1);
        g.fillRect(-14, -10, 28, 20);
        g.fillStyle(0x78909c, 1);
        g.fillCircle(4, -8, 8);
        g.lineStyle(2, 0xe65100, 1);
        g.lineBetween(-14, 0, 14, 0);
        g.lineBetween(-6, -10, 6, 10);
        break;
    }

    // Prepare hover outline graphics
    this.outlineGlow.clear();
    this.outlineGlow.lineStyle(3, 0x00ffff, 0.85);
    this.outlineGlow.strokeCircle(0, 0, 24);
  }

  private createFirstSeenTooltip(): void {
    const tipContainer = this.scene.add.container(0, -45);
    const bg = this.scene.add.graphics();
    const text = this.scene.add.text(0, 0, `${this.data.name}\n${this.data.description.split('\n')[0]}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    });
    text.setOrigin(0.5);

    const b = text.getBounds();
    bg.fillStyle(0x1a252f, 0.85);
    bg.fillRoundedRect(b.x - 4, b.y - 3, b.width + 8, b.height + 6, 4);
    bg.lineStyle(1.5, 0x00ffcc, 1);
    bg.strokeRoundedRect(b.x - 4, b.y - 3, b.width + 8, b.height + 6, 4);

    tipContainer.add([bg, text]);
    this.container.add(tipContainer);
    this.firstSeenLabel = tipContainer;

    // Fade out after 1.5s (Section 86)
    this.scene.tweens.add({
      targets: tipContainer,
      alpha: 0,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        tipContainer.destroy();
        this.firstSeenLabel = null;
      },
    });
  }

  public setHoverHighlight(enabled: boolean): void {
    this.outlineGlow.setVisible(enabled);
  }

  public update(deltaSeconds: number, worldSpeed: number): void {
    if (this.isLatched || this.isDelivered || this.isDestroyed) return;

    // Move left with world speed
    this.container.x -= worldSpeed * deltaSeconds;
    this.shadow.x = this.container.x;

    // Destroy if scrolled way past left screen
    if (this.container.x < -100) {
      this.destroy();
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.shadow) this.shadow.destroy();
    if (this.container) this.container.destroy();
  }
}
