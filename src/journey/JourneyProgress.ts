import journeyData from '../data/journey_v3.json';

export class JourneyProgress {
  public targetDistanceM: number;
  public distanceTravelledM: number = 0;
  public metersPerPixel: number;
  public baseSpeedPx: number;

  public actualSpeedPx: number = 0;
  public actualSpeedMps: number = 0;
  public actualSpeedKmh: number = 0;

  constructor(targetDistanceM?: number) {
    this.targetDistanceM = targetDistanceM ?? journeyData.targetDistanceM;
    this.metersPerPixel = journeyData.metersPerPixel;
    this.baseSpeedPx = journeyData.baseWorldSpeedPx;
    this.actualSpeedPx = this.baseSpeedPx;
    this.calculateSpeedUnits();
  }

  public reset(targetDistanceM?: number): void {
    this.targetDistanceM = targetDistanceM ?? journeyData.targetDistanceM;
    this.distanceTravelledM = 0;
    this.actualSpeedPx = this.baseSpeedPx;
    this.calculateSpeedUnits();
  }

  public update(dt: number, actualSpeedPx: number): void {
    this.actualSpeedPx = actualSpeedPx;
    this.calculateSpeedUnits();

    // Section 10: distanceTravelledM += actualSpeedPx * metersPerPixel * dt;
    if (this.actualSpeedPx > 0 && dt > 0) {
      this.distanceTravelledM += this.actualSpeedPx * this.metersPerPixel * dt;
    }

    if (this.distanceTravelledM > this.targetDistanceM) {
      this.distanceTravelledM = this.targetDistanceM;
    }
  }

  private calculateSpeedUnits(): void {
    // 160 px/s * 0.111 = 17.76 m/s * 3.6 = 63.936 km/h
    this.actualSpeedMps = this.actualSpeedPx * this.metersPerPixel;
    this.actualSpeedKmh = this.actualSpeedMps * 3.6;
  }

  public get distanceRemainingM(): number {
    return Math.max(0, this.targetDistanceM - this.distanceTravelledM);
  }

  public get progress01(): number {
    return Math.min(1.0, Math.max(0.0, this.distanceTravelledM / this.targetDistanceM));
  }

  public isCompleted(): boolean {
    return this.distanceTravelledM >= this.targetDistanceM;
  }
}
