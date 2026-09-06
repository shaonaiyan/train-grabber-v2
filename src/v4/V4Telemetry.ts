export interface V4ObjectStat {
  seen: number;
  targeted: number;
  latched: number;
  delivered: number;
  released: number;
  jettisoned: number;
  missed: number;
}

export interface V4EnemyStat {
  killedByTurret: number;
  killedByImpact: number;
  killedByExplosion: number;
  grappled: number;
  captured: number;
  gunTorn: number;
  escaped: number;
}

export interface V4TelemetryData {
  seed: string;
  duration: number;
  result: 'COMPLETE' | 'FAILED_HP' | 'FAILED_FUEL' | 'QUIT';
  hook: {
    shots: number;
    hits: number;
    misses: number;
    averageCycleTime: number;
    hookBusyTime: number;
    hookIdleTime: number;
  };
  coverage: {
    samples: number;
    meaningfulSamples: number;
    targetCoveragePercent: number;
    idleGaps: Array<{ start: number; end: number; duration: number }>;
    maxIdleGap: number;
  };
  objects: Record<string, V4ObjectStat>;
  consequences: Record<string, number>;
  threats: Record<string, V4EnemyStat>;
  regretResponses: Array<{ time: number; type: string; details: string }>;
  missedWhileBusy: Array<{ time: number; objectType: string }>;
  crossInteractions: Array<{ time: number; type: string; details?: string }>;
  summary: {
    targetCoveragePercent: number;
    maxIdleGap: number;
    grabRate: number;
    heroGrabRate: number;
    missedWhileBusy: number;
    jettisonCount: number;
    regretResponses: number;
    crossInteractions: number;
    grappleEnemyResolutions: number;
    turretEnemyResolutions: number;
    finalWeight: number;
    finalLootValue: number;
  };
}

export class V4Telemetry {
  private static instance: V4Telemetry;
  public seed: string = 'V4_SHOWCASE_001';
  public startTime: number = 0;
  public runTimeSec: number = 0;
  public result: 'COMPLETE' | 'FAILED_HP' | 'FAILED_FUEL' | 'QUIT' = 'COMPLETE';

  // Hook metrics
  public hookShots: number = 0;
  public hookHits: number = 0;
  public hookMisses: number = 0;
  public hookBusyTime: number = 0;
  public hookIdleTime: number = 0;
  public hookCycles: number[] = [];
  private currentCycleStart: number = 0;
  private isHookBusy: boolean = false;

  // Coverage metrics
  private coverageTimer: number = 0;
  private totalCoverageSamples: number = 0;
  private coveredSamples: number = 0;
  private currentIdleGapDuration: number = 0;
  public idleGaps: Array<{ start: number; end: number; duration: number }> = [];
  public maxIdleGap: number = 0;

  // Objects & Threats
  public objects: Record<string, V4ObjectStat> = {};
  public consequences: Record<string, number> = {};
  public threats: Record<string, V4EnemyStat> = {};
  public regretResponses: Array<{ time: number; type: string; details: string }> = [];
  public missedWhileBusy: Array<{ time: number; objectType: string }> = [];
  public crossInteractions: Array<{ time: number; type: string; details?: string }> = [];

  // Train state cache for final evaluation
  public finalWeight: number = 0;
  public finalLootValue: number = 0;

  public static getInstance(): V4Telemetry {
    if (!V4Telemetry.instance) {
      V4Telemetry.instance = new V4Telemetry();
    }
    return V4Telemetry.instance;
  }

  constructor() {
    this.reset();
  }

  public reset(seed: string = 'V4_SHOWCASE_001'): void {
    this.seed = seed;
    this.startTime = Date.now();
    this.runTimeSec = 0;
    this.result = 'COMPLETE';

    this.hookShots = 0;
    this.hookHits = 0;
    this.hookMisses = 0;
    this.hookBusyTime = 0;
    this.hookIdleTime = 0;
    this.hookCycles = [];
    this.currentCycleStart = 0;
    this.isHookBusy = false;

    this.coverageTimer = 0;
    this.totalCoverageSamples = 0;
    this.coveredSamples = 0;
    this.currentIdleGapDuration = 0;
    this.idleGaps = [];
    this.maxIdleGap = 0;

    this.objects = {};
    this.consequences = {};
    this.threats = {};
    this.regretResponses = [];
    this.missedWhileBusy = [];
    this.crossInteractions = [];

    this.finalWeight = 0;
    this.finalLootValue = 0;
  }

  private ensureObjectStat(type: string): V4ObjectStat {
    if (!this.objects[type]) {
      this.objects[type] = {
        seen: 0,
        targeted: 0,
        latched: 0,
        delivered: 0,
        released: 0,
        jettisoned: 0,
        missed: 0,
      };
    }
    return this.objects[type];
  }

  private ensureThreatStat(type: string): V4EnemyStat {
    if (!this.threats[type]) {
      this.threats[type] = {
        killedByTurret: 0,
        killedByImpact: 0,
        killedByExplosion: 0,
        grappled: 0,
        captured: 0,
        gunTorn: 0,
        escaped: 0,
      };
    }
    return this.threats[type];
  }

  // Hook Logging
  public onHookFire(): void {
    this.hookShots++;
    this.isHookBusy = true;
    this.currentCycleStart = this.runTimeSec;
  }

  public onHookHit(itemType: string): void {
    this.hookHits++;
    this.ensureObjectStat(itemType).targeted++;
    this.ensureObjectStat(itemType).latched++;
  }

  public onHookMiss(): void {
    this.hookMisses++;
    this.onHookCycleEnd();
  }

  public onHookDelivered(itemType: string): void {
    this.ensureObjectStat(itemType).delivered++;
    this.onHookCycleEnd();
  }

  public onHookReleased(itemType: string): void {
    this.ensureObjectStat(itemType).released++;
    this.onHookCycleEnd();
  }

  private onHookCycleEnd(): void {
    if (this.isHookBusy && this.currentCycleStart > 0) {
      const cycleDuration = Math.max(0.1, this.runTimeSec - this.currentCycleStart);
      this.hookCycles.push(cycleDuration);
    }
    this.isHookBusy = false;
    this.currentCycleStart = 0;
  }

  public isHookCurrentlyBusy(): boolean {
    return this.isHookBusy;
  }

  // Object events
  public recordSeen(itemType: string): void {
    this.ensureObjectStat(itemType).seen++;
  }

  public recordMissed(itemType: string): void {
    this.ensureObjectStat(itemType).missed++;
    if (this.isHookBusy) {
      this.missedWhileBusy.push({
        time: parseFloat(this.runTimeSec.toFixed(1)),
        objectType: itemType,
      });
    }
  }

  public recordJettison(itemType: string): void {
    this.ensureObjectStat(itemType).jettisoned++;
    this.recordRegret('JETTISON_OBJECT', `Jettisoned ${itemType}`);
  }

  // Consequence & Cross-interaction
  public recordConsequence(key: string): void {
    this.consequences[key] = (this.consequences[key] || 0) + 1;
  }

  public recordCrossInteraction(type: string, details?: string): void {
    this.crossInteractions.push({
      time: parseFloat(this.runTimeSec.toFixed(1)),
      type,
      details,
    });
  }

  public recordRegret(type: string, details: string): void {
    this.regretResponses.push({
      time: parseFloat(this.runTimeSec.toFixed(1)),
      type,
      details,
    });
  }

  // Threat resolution
  public recordThreatResolution(enemyType: string, method: keyof V4EnemyStat): void {
    const stat = this.ensureThreatStat(enemyType);
    stat[method]++;
  }

  // Periodic update for coverage & busy timer
  public update(dt: number, currentTimeSec: number, activeInteractableCount: number): void {
    this.runTimeSec = currentTimeSec;

    if (this.isHookBusy) {
      this.hookBusyTime += dt;
    } else {
      this.hookIdleTime += dt;
    }

    // Only measure coverage between 10s and 85s
    if (this.runTimeSec >= 10.0 && this.runTimeSec <= 85.0) {
      this.coverageTimer += dt;
      if (this.coverageTimer >= 0.1) {
        this.coverageTimer -= 0.1;
        this.totalCoverageSamples++;

        if (activeInteractableCount > 0) {
          this.coveredSamples++;
          if (this.currentIdleGapDuration > 0) {
            const gapStart = parseFloat((this.runTimeSec - this.currentIdleGapDuration).toFixed(1));
            const gapEnd = parseFloat(this.runTimeSec.toFixed(1));
            this.idleGaps.push({
              start: gapStart,
              end: gapEnd,
              duration: parseFloat(this.currentIdleGapDuration.toFixed(2)),
            });
            if (this.currentIdleGapDuration > this.maxIdleGap) {
              this.maxIdleGap = parseFloat(this.currentIdleGapDuration.toFixed(2));
            }
            this.currentIdleGapDuration = 0;
          }
        } else {
          this.currentIdleGapDuration += 0.1;
          if (this.currentIdleGapDuration > this.maxIdleGap) {
            this.maxIdleGap = parseFloat(this.currentIdleGapDuration.toFixed(2));
          }
        }
      }
    }
  }

  public getSummary() {
    const coveragePercent =
      this.totalCoverageSamples > 0
        ? parseFloat(((this.coveredSamples / this.totalCoverageSamples) * 100).toFixed(1))
        : 100;

    const totalSeen = Object.values(this.objects).reduce((sum, o) => sum + o.seen, 0);
    const totalDelivered = Object.values(this.objects).reduce((sum, o) => sum + o.delivered, 0);
    const grabRate = totalSeen > 0 ? parseFloat(((totalDelivered / totalSeen) * 100).toFixed(1)) : 0;

    const heroKeys = ['gold_safe_v4', 'sheep_v4', 'fridge_v4', 'explosive_v4', 'giant_magnet_v4', 'flat_car_v4'];
    let heroSeen = 0;
    let heroDelivered = 0;
    for (const k of heroKeys) {
      if (this.objects[k]) {
        heroSeen += this.objects[k].seen;
        heroDelivered += this.objects[k].delivered;
      }
    }
    const heroGrabRate = heroSeen > 0 ? parseFloat(((heroDelivered / heroSeen) * 100).toFixed(1)) : 0;

    const avgCycle =
      this.hookCycles.length > 0
        ? parseFloat((this.hookCycles.reduce((a, b) => a + b, 0) / this.hookCycles.length).toFixed(2))
        : 0;

    let grappleResolutions = 0;
    let turretResolutions = 0;
    let jettisons = 0;

    for (const obj of Object.values(this.objects)) {
      jettisons += obj.jettisoned;
    }
    for (const th of Object.values(this.threats)) {
      grappleResolutions += th.grappled + th.captured + th.gunTorn + th.killedByImpact;
      turretResolutions += th.killedByTurret;
    }

    return {
      targetCoveragePercent: coveragePercent,
      maxIdleGap: this.maxIdleGap,
      grabRate,
      heroGrabRate,
      averageCycleTime: avgCycle,
      missedWhileBusy: this.missedWhileBusy.length,
      jettisonCount: jettisons,
      regretResponses: this.regretResponses.length,
      crossInteractions: this.crossInteractions.length,
      grappleEnemyResolutions: grappleResolutions,
      turretEnemyResolutions: turretResolutions,
      finalWeight: this.finalWeight,
      finalLootValue: this.finalLootValue,
    };
  }

  public exportJSON(): V4TelemetryData {
    const summary = this.getSummary();
    const data: V4TelemetryData = {
      seed: this.seed,
      duration: parseFloat(this.runTimeSec.toFixed(1)),
      result: this.result,
      hook: {
        shots: this.hookShots,
        hits: this.hookHits,
        misses: this.hookMisses,
        averageCycleTime: summary.averageCycleTime,
        hookBusyTime: parseFloat(this.hookBusyTime.toFixed(1)),
        hookIdleTime: parseFloat(this.hookIdleTime.toFixed(1)),
      },
      coverage: {
        samples: this.totalCoverageSamples,
        meaningfulSamples: this.coveredSamples,
        targetCoveragePercent: summary.targetCoveragePercent,
        idleGaps: this.idleGaps,
        maxIdleGap: summary.maxIdleGap,
      },
      objects: this.objects,
      consequences: this.consequences,
      threats: this.threats,
      regretResponses: this.regretResponses,
      missedWhileBusy: this.missedWhileBusy,
      crossInteractions: this.crossInteractions,
      summary: {
        targetCoveragePercent: summary.targetCoveragePercent,
        maxIdleGap: summary.maxIdleGap,
        grabRate: summary.grabRate,
        heroGrabRate: summary.heroGrabRate,
        missedWhileBusy: summary.missedWhileBusy,
        jettisonCount: summary.jettisonCount,
        regretResponses: summary.regretResponses,
        crossInteractions: summary.crossInteractions,
        grappleEnemyResolutions: summary.grappleEnemyResolutions,
        turretEnemyResolutions: summary.turretEnemyResolutions,
        finalWeight: summary.finalWeight,
        finalLootValue: summary.finalLootValue,
      },
    };
    return data;
  }

  public downloadTelemetryFile(): void {
    const data = this.exportJSON();
    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `train_grabber_v4_core_${this.seed}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public exportDataToFile(): void {
    this.downloadTelemetryFile();
  }
}
