import balanceData from '../data/balance.json';
import { DepthBand } from '../core/Types';

export interface DepthProperties {
  scale: number;
  depth: number;
  shadowYOffset: number;
  shadowScale: number;
}

export class DepthManager {
  private static instance: DepthManager;

  public static getInstance(): DepthManager {
    if (!DepthManager.instance) {
      DepthManager.instance = new DepthManager();
    }
    return DepthManager.instance;
  }

  public getPropertiesForY(y: number): DepthProperties {
    const { far, mid, near } = balanceData.depth;

    if (y <= far.maxY) {
      // Far band
      const t = Phaser.Math.Clamp((y - far.minY) / (far.maxY - far.minY), 0, 1);
      const scale = far.minScale + t * (far.maxScale - far.minScale);
      return {
        scale,
        depth: far.depth + t * 5,
        shadowYOffset: 12 * scale,
        shadowScale: scale * 0.9,
      };
    } else if (y <= mid.maxY) {
      // Mid band
      const t = Phaser.Math.Clamp((y - mid.minY) / (mid.maxY - mid.minY), 0, 1);
      const scale = mid.minScale + t * (mid.maxScale - mid.minScale);
      return {
        scale,
        depth: mid.depth + t * 5,
        shadowYOffset: 15 * scale,
        shadowScale: scale * 0.95,
      };
    } else {
      // Near band
      const t = Phaser.Math.Clamp((y - near.minY) / (near.maxY - near.minY), 0, 1);
      const scale = near.minScale + t * (near.maxScale - near.minScale);
      return {
        scale,
        depth: near.depth + t * 5,
        shadowYOffset: 18 * scale,
        shadowScale: scale,
      };
    }
  }

  public getBandForY(y: number): DepthBand {
    if (y <= balanceData.depth.far.maxY) return 'far';
    if (y <= balanceData.depth.mid.maxY) return 'mid';
    return 'near';
  }

  public getRandomYInBand(band: DepthBand, randFloat: () => number): number {
    const b = balanceData.depth[band];
    return b.minY + randFloat() * (b.maxY - b.minY);
  }
}
