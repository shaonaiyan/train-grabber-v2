import {
  ItemId,
  SlotType,
  RunTelemetryData,
  SiteRecord,
  EncounterRecord,
  ItemStatsRecord,
  DiscardRecord,
  TimelineSnapshot,
  TelemetryEventRecord,
} from '../core/Types';
import { EventBus } from '../core/EventBus';
import { TrainManager } from '../train/TrainManager';
import { JourneyProgress } from '../journey/JourneyProgress';

export class TelemetryManager {
  private static instance: TelemetryManager;
  private seed: string;
  private startTime: number;
  private endTime: number = 0;
  private currentRunTimeSec: number = 0;
  private currentDistanceM: number = 0;
  private finalScore: number = 0;
  private outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED' = 'WIN';

  private sites: SiteRecord[] = [];
  private encounters: EncounterRecord[] = [];
  private itemStats: Record<ItemId, ItemStatsRecord>;
  private grabSnapshots: RunTelemetryData['grabSnapshots'] = [];
  private discards: DiscardRecord[] = [];
  private timeline: TimelineSnapshot[] = [];
  private events: TelemetryEventRecord[] = [];

  private timelineTimer: number = 0;
  private trainManager: TrainManager | null = null;
  private journeyProgress: JourneyProgress | null = null;
  private boundListeners: Array<{ event: string; fn: (...args: any[]) => void }> = [];

  // Summary accumulator metrics
  public maxLoadRatio: number = 0;
  public minSpeedKmh: number = 999;
  public totalSpeedSampleSum: number = 0;
  public totalSpeedSamples: number = 0;
  public timeInHeavy: number = 0;
  public timeInOverload: number = 0;
  public timeInDanger: number = 0;
  public fuelPicked: number = 0;
  public encounterDamageTotal: number = 0;
  public turretDamageTotal: number = 0;

  public static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  constructor() {
    this.seed = Date.now().toString();
    this.startTime = Date.now();
    this.itemStats = this.initItemStats();
    this.bindEventListeners();
  }

  public init(seed: string | number, trainManager: TrainManager, journeyProgress?: JourneyProgress): void {
    this.unbindEventListeners();
    this.bindEventListeners();

    this.seed = seed.toString();
    this.trainManager = trainManager;
    this.journeyProgress = journeyProgress || null;
    this.startTime = Date.now();
    this.endTime = 0;
    this.currentRunTimeSec = 0;
    this.currentDistanceM = 0;
    this.finalScore = 0;
    this.outcome = 'WIN';

    this.sites = [];
    this.encounters = [];
    this.itemStats = this.initItemStats();
    this.grabSnapshots = [];
    this.discards = [];
    this.timeline = [];
    this.events = [];
    this.timelineTimer = 0;

    this.maxLoadRatio = 0;
    this.minSpeedKmh = 999;
    this.totalSpeedSampleSum = 0;
    this.totalSpeedSamples = 0;
    this.timeInHeavy = 0;
    this.timeInOverload = 0;
    this.timeInDanger = 0;
    this.fuelPicked = 0;
    this.encounterDamageTotal = 0;
    this.turretDamageTotal = 0;
  }

  public setRunContext(timeSec: number, distanceM: number): void {
    this.currentRunTimeSec = timeSec;
    this.currentDistanceM = distanceM;
  }

  private initItemStats(): Record<ItemId, ItemStatsRecord> {
    const ids: ItemId[] = [
      'parts', 'fuel', 'gold', 'turret', 'battery', 'flat_car',
      'sheep', 'survivor', 'fridge', 'egg', 'explosive', 'junk'
    ];
    const map: any = {};
    for (const id of ids) {
      map[id] = { seen: 0, attempted: 0, grabbed: 0, ignored: 0, discarded: 0 };
    }
    return map;
  }

  private addListener(event: string, fn: (...args: any[]) => void): void {
    const bus = EventBus.getInstance();
    bus.on(event, fn);
    this.boundListeners.push({ event, fn });
  }

  private unbindEventListeners(): void {
    const bus = EventBus.getInstance();
    for (const { event, fn } of this.boundListeners) {
      bus.off(event, fn);
    }
    this.boundListeners = [];
  }

  private bindEventListeners(): void {
    this.addListener('ITEM_SEEN', (d: { item: ItemId }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].seen++;
      this.recordEvent('ITEM_SEEN', d);
    });

    this.addListener('GRAPPLE_FIRE', (d: any) => this.recordEvent('GRAPPLE_FIRE', d));
    this.addListener('GRAPPLE_HIT', (d: { item: ItemId }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].attempted++;
      this.recordEvent('GRAPPLE_HIT', d);
    });
    this.addListener('GRAPPLE_MISS', (d: any) => this.recordEvent('GRAPPLE_MISS', d));

    this.addListener('ITEM_DELIVERED', (d: { item: ItemId; instanceId?: string; siteId?: string }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].grabbed++;
      if (d.item === 'fuel') this.fuelPicked += 20;
      this.recordEvent('ITEM_DELIVERED', d);

      // Section 153: Grab Snapshot
      if (this.trainManager) {
        const load = this.trainManager.load;
        const cargo = this.trainManager.cargo;
        const speedKmh = this.journeyProgress ? this.journeyProgress.actualSpeedKmh : 60;

        this.grabSnapshots.push({
          time: parseFloat(this.currentRunTimeSec.toFixed(2)),
          distance: Math.round(this.currentDistanceM),
          item: d.item,
          instanceId: d.instanceId,
          siteId: d.siteId,
          fuel: Math.ceil(this.trainManager.stats.fuel),
          hp: Math.ceil(this.trainManager.stats.hp),
          load: load.getCurrentLoad(),
          effectiveLoad: load.effectiveLoad,
          maxLoad: load.getSafeMaxLoad(),
          loadRatio: parseFloat(load.getLoadRatio().toFixed(2)),
          cargoUsed: cargo.cargoUsed,
          cargoCapacity: cargo.cargoCapacity,
          cargoOverflow: cargo.getCargoOverflow(),
          powerSupply: this.trainManager.power.getSupply(),
          powerDemand: this.trainManager.power.getDemand(),
          cargoValue: cargo.getTotalCargoValue(),
          slotAvailability: this.trainManager.getAvailableSlotCount(),
        });
      }
    });

    this.addListener('ITEM_REJECTED', (d: any) => this.recordEvent('ITEM_REJECTED', d));

    this.addListener('ITEM_DISCARDED', (d: {
      item: ItemId;
      discardedItem?: ItemId;
      loadAfter?: number;
      cargoAfter?: number;
      time?: number;
      siteId?: string;
      reasonContext?: any;
    }) => {
      const discItem = d.discardedItem || d.item;
      if (this.itemStats[discItem]) this.itemStats[discItem].discarded++;

      this.discards.push({
        time: d.time ?? parseFloat(this.currentRunTimeSec.toFixed(2)),
        distance: Math.round(this.currentDistanceM),
        item: discItem,
        discardedItem: discItem,
        loadAfter: d.loadAfter,
        cargoAfter: d.cargoAfter,
        siteId: d.siteId,
        reasonContext: d.reasonContext,
      });
      this.recordEvent('ITEM_DISCARDED', d);
    });

    // Sites
    this.addListener('SITE_ENTER', (d: any) => this.recordEvent('SITE_ENTER', d));
    this.addListener('SITE_EXIT', (d: { record: SiteRecord }) => {
      this.sites.push(d.record);
      for (const ign of d.record.itemsIgnored) {
        if (this.itemStats[ign]) this.itemStats[ign].ignored++;
      }
      this.recordEvent('SITE_EXIT', { siteId: d.record.siteId, captureRate: d.record.captureRate });
    });

    // Encounters
    this.addListener('ENCOUNTER_START', (d: any) => this.recordEvent('ENCOUNTER_START', d));
    this.addListener('ENCOUNTER_END', (d: { record: EncounterRecord }) => {
      this.encounters.push(d.record);
      this.encounterDamageTotal += d.record.damageTaken;
      this.turretDamageTotal += d.record.turretDamageDealt;
      this.recordEvent('ENCOUNTER_END', { encounterId: d.record.encounterId });
    });

    this.addListener('TRAIN_DAMAGE', (d: any) => this.recordEvent('TRAIN_DAMAGE', d));
    this.addListener('FRIDGE_OPEN', (d: any) => this.recordEvent('FRIDGE_OPEN', d));
    this.addListener('EGG_HATCH', (d: any) => this.recordEvent('EGG_HATCH', d));
  }

  public recordEvent(event: string, data?: any): void {
    this.events.push({
      time: parseFloat(this.currentRunTimeSec.toFixed(2)),
      event,
      data,
    });
  }

  public update(delta: number, enemyCount: number): void {
    if (!this.trainManager) return;
    const dt = delta * 0.001;
    this.timelineTimer += dt;

    const ratio = this.trainManager.load.getLoadRatio();
    if (ratio > this.maxLoadRatio) {
      this.maxLoadRatio = ratio;
    }

    const tier = this.trainManager.load.getTier();
    if (tier === 'HEAVY') this.timeInHeavy += dt;
    else if (tier === 'OVERLOAD') this.timeInOverload += dt;
    else if (tier === 'DANGER' || tier === 'HARD_LIMIT') this.timeInDanger += dt;

    const speedKmh = this.journeyProgress ? this.journeyProgress.actualSpeedKmh : 60;
    if (speedKmh < this.minSpeedKmh) {
      this.minSpeedKmh = speedKmh;
    }
    this.totalSpeedSampleSum += speedKmh;
    this.totalSpeedSamples++;

    // Section 155: Snapshot every 5 seconds
    if (this.timelineTimer >= 5.0) {
      this.timelineTimer = 0;
      this.timeline.push({
        time: parseFloat(this.currentRunTimeSec.toFixed(1)),
        distance: Math.round(this.currentDistanceM),
        speed: Math.round(speedKmh),
        hp: Math.ceil(this.trainManager.stats.hp),
        fuel: Math.ceil(this.trainManager.stats.fuel),
        load: this.trainManager.load.getCurrentLoad(),
        maxLoad: this.trainManager.load.getSafeMaxLoad(),
        loadRatio: parseFloat(ratio.toFixed(2)),
        powerSupply: this.trainManager.power.getSupply(),
        powerDemand: this.trainManager.power.getDemand(),
        scorePotential: this.calculateCurrentScore(),
        cargoValue: this.trainManager.getCargoValue(),
        cars: this.trainManager.getCarCount(),
        enemies: enemyCount,
      });
    }
  }

  public calculateCurrentScore(): number {
    if (!this.trainManager) return 100;
    // Score based on Cargo Value + Train integrity
    let score = 100;
    score += this.trainManager.getCargoValue();
    score += Math.round(this.trainManager.stats.hp * 0.5);
    score += Math.round(this.trainManager.stats.fuel * 0.5);
    return score;
  }

  public setRunOutcome(outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED'): void {
    this.outcome = outcome;
    this.endTime = Date.now();
    this.finalScore = this.calculateCurrentScore();
  }

  public getFullTelemetry(): RunTelemetryData {
    const modules = this.trainManager ? this.trainManager.getAllInstalledModules() : [];
    const cargoItems = this.trainManager ? this.trainManager.cargo.getCargoItems() : [];

    const goldCount = cargoItems.filter((c) => c.itemId === 'gold').length;
    const sheepCount = cargoItems.filter((c) => c.itemId === 'sheep').length;
    const survivorCount = cargoItems.filter((c) => c.itemId === 'survivor').length;
    const turretCount = modules.filter((m) => m.itemId === 'turret').length;
    const batteryCount = modules.filter((m) => m.itemId === 'battery').length;

    return {
      seed: this.seed,
      startTime: this.startTime,
      endTime: this.endTime || Date.now(),
      durationSeconds: parseFloat(this.currentRunTimeSec.toFixed(1)),
      distanceTravelledM: Math.round(this.currentDistanceM),
      targetDistanceM: this.journeyProgress?.targetDistanceM || 4800,
      finalScore: this.finalScore || this.calculateCurrentScore(),
      cargoValue: this.trainManager ? this.trainManager.getCargoValue() : 0,
      outcome: this.outcome,
      sites: this.sites,
      encounters: this.encounters,
      windows: [], // Legacy empty
      itemStats: this.itemStats,
      grabSnapshots: this.grabSnapshots,
      discards: this.discards,
      timeline: this.timeline,
      events: this.events,
      finalTrain: {
        length: this.trainManager ? this.trainManager.getCarCount() : 3,
        load: this.trainManager ? this.trainManager.load.getCurrentLoad() : 0,
        safeMaxLoad: this.trainManager ? this.trainManager.load.getSafeMaxLoad() : 48,
        maxLoad: this.trainManager ? this.trainManager.load.getSafeMaxLoad() : 48,
        loadRatio: this.trainManager ? parseFloat(this.trainManager.load.getLoadRatio().toFixed(2)) : 0,
        powerSupply: this.trainManager ? this.trainManager.power.getSupply() : 2,
        powerDemand: this.trainManager ? this.trainManager.power.getDemand() : 0,
        goldCount,
        sheepCount,
        survivorCount,
        turretCount,
        batteryCount,
        discardCount: this.trainManager ? this.trainManager.getDiscardedCount() : 0,
        modules: modules.map((m) => ({ id: m.itemId, slot: m.slotType, car: m.carIndex })),
      },
    };
  }

  public exportDataToFile(): void {
    const data = this.getFullTelemetry();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    // Section 157: train_grabber_v3_<seed>_<timestamp>.json
    a.download = `train_grabber_v3_${this.seed}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
