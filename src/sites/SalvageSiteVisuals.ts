import Phaser from 'phaser';
import { DepthBand } from '../core/Types';
import { DepthManager } from '../world/DepthManager';

export class SalvageSiteVisuals {
  public static createProp(
    scene: Phaser.Scene,
    type: string,
    x: number,
    band: DepthBand
  ): Phaser.GameObjects.Container {
    const depthManager = DepthManager.getInstance();
    const config = depthManager.getBandConfig(band);
    const y = (config.minY + config.maxY) * 0.5;

    const container = scene.add.container(x, y);
    container.setDepth(config.depth - 2); // behind items in the same band
    container.setScale(config.minScale);

    const g = scene.add.graphics();
    container.add(g);

    // Contact shadow
    g.fillStyle(0x05070a, 0.45);
    g.fillEllipse(0, 12, 60, 16);

    switch (type) {
      case 'gas_canopy':
        // Gas station roof canopy
        g.fillStyle(0x3a454d, 1);
        g.fillRect(-120, -110, 240, 20);
        g.fillStyle(0x8a3324, 1); // faded red trim
        g.fillRect(-120, -100, 240, 6);
        // Canopy pillars
        g.fillStyle(0x2c3539, 1);
        g.fillRect(-80, -90, 14, 100);
        g.fillRect(66, -90, 14, 100);
        break;

      case 'gas_pump':
        // Old fuel pump
        g.fillStyle(0x78281f, 1);
        g.fillRoundedRect(-14, -40, 28, 50, 3);
        g.lineStyle(1.5, 0x1a1a1a, 1);
        g.strokeRoundedRect(-14, -40, 28, 50, 3);
        // Dial display
        g.fillStyle(0xd5dbdb, 1);
        g.fillRect(-10, -32, 20, 12);
        // Hose
        g.lineStyle(2, 0x1c2833, 1);
        g.beginPath();
        g.moveTo(14, -20);
        g.lineTo(20, -10);
        g.lineTo(16, 5);
        g.stroke();
        break;

      case 'abandoned_car':
        // Rusted out station wagon
        g.fillStyle(0x515a5a, 1);
        g.fillRoundedRect(-55, -22, 110, 32, 4);
        g.fillStyle(0x424949, 1);
        g.fillRoundedRect(-30, -38, 65, 18, 3);
        // Rusted wheels
        g.fillStyle(0x1b2631, 1);
        g.fillCircle(-35, 10, 12);
        g.fillCircle(35, 10, 12);
        break;

      case 'fallen_sign':
        // Tilted roadside sign
        g.lineStyle(3, 0x424949, 1);
        g.lineBetween(-15, 12, 5, -50);
        g.fillStyle(0x9a7d0a, 0.9);
        g.fillRoundedRect(-15, -65, 45, 25, 2);
        break;

      case 'barn_shed':
        // Half-collapsed wooden barn shed
        g.fillStyle(0x4a3525, 1);
        g.fillRect(-70, -70, 140, 80);
        // Peaked broken roof
        g.fillStyle(0x342215, 1);
        g.beginPath();
        g.moveTo(-80, -70);
        g.lineTo(0, -110);
        g.lineTo(75, -60);
        g.closePath();
        g.fill();
        // Broken door
        g.fillStyle(0x1c140d, 1);
        g.fillRect(-20, -40, 40, 50);
        break;

      case 'broken_fence':
        g.lineStyle(3, 0x5c4033, 1);
        g.lineBetween(-40, 12, -40, -18);
        g.lineBetween(0, 12, 0, -22);
        g.lineBetween(40, 12, 40, -15);
        g.lineBetween(-45, -12, 45, -8);
        break;

      case 'hay_bale':
        g.fillStyle(0xb7950b, 1);
        g.fillRoundedRect(-18, -14, 36, 24, 5);
        g.lineStyle(1.5, 0x7d6608, 1);
        g.strokeRoundedRect(-18, -14, 36, 24, 5);
        break;

      case 'water_trough':
        g.fillStyle(0x566573, 1);
        g.fillRoundedRect(-30, -10, 60, 20, 2);
        g.fillStyle(0x2e4053, 1);
        g.fillRect(-26, -6, 52, 12);
        break;

      case 'rusty_tractor':
        g.fillStyle(0x78281f, 1);
        g.fillRect(-25, -25, 50, 30);
        g.fillStyle(0x424949, 1);
        g.fillRect(5, -42, 22, 20);
        // Big rear wheel
        g.fillStyle(0x1c2833, 1);
        g.fillCircle(18, 4, 18);
        // Small front wheel
        g.fillCircle(-22, 8, 10);
        break;

      case 'maintenance_shed':
        // Railway corrugated metal shed
        g.fillStyle(0x34495e, 1);
        g.fillRect(-85, -65, 170, 75);
        g.fillStyle(0x2c3e50, 1);
        g.fillRect(-90, -75, 180, 12);
        // Roll-up gate
        g.fillStyle(0x1b2631, 1);
        g.fillRect(-45, -45, 90, 55);
        break;

      case 'signal_light':
        g.lineStyle(3, 0x1c2833, 1);
        g.lineBetween(0, 12, 0, -65);
        g.fillStyle(0x2c3e50, 1);
        g.fillRoundedRect(-8, -75, 16, 32, 2);
        g.fillStyle(0xe74c3c, 0.85); // red light
        g.fillCircle(0, -65, 4);
        g.fillStyle(0x566573, 1);
        g.fillCircle(0, -52, 4);
        break;

      case 'broken_wheelset':
        g.lineStyle(4, 0x2c3e50, 1);
        g.lineBetween(-20, 0, 20, 0);
        g.fillStyle(0x1c2833, 1);
        g.fillCircle(-20, 0, 14);
        g.fillCircle(20, 0, 14);
        break;

      case 'derailed_freight':
        // Derailed railway wagon ruin
        g.fillStyle(0x4a235a, 0.95);
        g.fillRoundedRect(-70, -35, 140, 42, 4);
        g.lineStyle(2, 0x1a1a1a, 1);
        g.strokeRoundedRect(-70, -35, 140, 42, 4);
        break;

      case 'stone_cairn':
        g.fillStyle(0x7f8c8d, 1);
        g.fillCircle(0, 8, 14);
        g.fillCircle(2, -4, 10);
        g.fillCircle(-1, -16, 7);
        break;

      case 'rusted_tank':
        g.fillStyle(0x6e2c00, 1);
        g.fillRoundedRect(-35, -30, 70, 38, 8);
        g.lineStyle(2, 0x3e1800, 1);
        g.strokeRoundedRect(-35, -30, 70, 38, 8);
        break;

      case 'armored_apc':
        // Overturned APC hull
        g.fillStyle(0x283747, 1);
        g.fillRoundedRect(-65, -30, 130, 38, 6);
        g.fillStyle(0x1c2833, 1);
        g.fillRect(-45, -45, 50, 18);
        break;

      case 'sandbag_wall':
        g.fillStyle(0xa08050, 1);
        g.fillRoundedRect(-30, -8, 60, 18, 3);
        g.fillRoundedRect(-22, -22, 44, 16, 3);
        break;

      case 'roadblock_barrier':
        g.fillStyle(0xd35400, 1);
        g.fillRect(-35, -18, 70, 10);
        g.fillStyle(0xffffff, 1);
        g.fillRect(-20, -18, 10, 10);
        g.fillRect(10, -18, 10, 10);
        g.lineStyle(2, 0x1c2833, 1);
        g.lineBetween(-28, 10, -28, -18);
        g.lineBetween(28, 10, 28, -18);
        break;

      case 'lab_truck':
        // Overturned bio-hazard lab truck
        g.fillStyle(0xd5dbdb, 1);
        g.fillRoundedRect(-60, -32, 120, 40, 4);
        g.fillStyle(0x16a085, 1); // teal stripe
        g.fillRect(-60, -16, 120, 6);
        break;

      case 'hazard_tank':
        g.fillStyle(0xf39c12, 1);
        g.fillRoundedRect(-16, -38, 32, 48, 6);
        g.lineStyle(2, 0x2c3e50, 1);
        g.strokeRoundedRect(-16, -38, 32, 48, 6);
        break;

      case 'stasis_pod':
        g.fillStyle(0x2e4053, 1);
        g.fillRect(-18, -48, 36, 56);
        g.fillStyle(0x00ffcc, 0.55); // glowing glass
        g.fillRect(-12, -42, 24, 44);
        break;

      case 'cargo_container':
        // Shattered cargo shipping container
        g.fillStyle(0x1b4f72, 1);
        g.fillRect(-75, -45, 150, 52);
        g.lineStyle(2, 0x154360, 1);
        g.strokeRect(-75, -45, 150, 52);
        // Vertical ribs
        for (let i = -60; i <= 60; i += 20) {
          g.lineBetween(i, -45, i, 7);
        }
        break;

      case 'haven_gate':
        // Imposing concrete Haven barrier gate
        g.fillStyle(0x566573, 1);
        g.fillRect(-60, -130, 40, 140);
        g.fillRect(60, -130, 40, 140);
        g.fillStyle(0x2c3e50, 1);
        g.fillRect(-60, -145, 160, 20);
        break;

      default:
        // Generic industrial rubble / scrap pile
        g.fillStyle(0x4d5656, 1);
        g.fillRoundedRect(-25, -12, 50, 22, 4);
        g.fillStyle(0x2c3e50, 1);
        g.fillRect(-12, -22, 24, 14);
        break;
    }

    return container;
  }
}
