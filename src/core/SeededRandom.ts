export class SeededRandom {
  private initialSeed: number;
  private state: number;

  constructor(seed: string | number = Date.now()) {
    if (typeof seed === 'string') {
      this.initialSeed = this.hashString(seed);
    } else {
      this.initialSeed = seed | 0;
    }
    this.state = this.initialSeed;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
  }

  public reset(): void {
    this.state = this.initialSeed;
  }

  public getSeed(): number {
    return this.initialSeed;
  }

  /**
   * Mulberry32 algorithm for deterministic 32-bit PRNG
   */
  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public pick<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const idx = this.rangeInt(0, arr.length - 1);
    return arr[idx];
  }

  public shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.rangeInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  public chance(probability: number): boolean {
    return this.nextFloat() < probability;
  }
}
