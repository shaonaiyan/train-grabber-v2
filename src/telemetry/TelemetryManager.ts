import {
  ItemId,
  SlotType,
  RunTelemetryData,
  WindowChoiceRecord,
  ItemStatsRecord,
  DiscardRecord,
  TimelineSnapshot,
  TelemetryEventRecord,
} from '../core/Types';
import { EventBus } from '../core/EventBus';
import { TrainManager } from '../train/TrainManager';
import balanceData from '../data/balance.json';

export class TelemetryManager {
  private static instance: TelemetryManager;
  private seed: string;
  private startTime: number;
  private endTime: number = 0;
  private finalScore: number = 0;
  private outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED' = 'WIN';

  private windows: WindowChoiceRecord[] = [];
  private itemStats: Record<ItemId, ItemStatsRecord>;
  private grabSnapshots: RunTelemetryData['grabSnapshots'] = [];
  private discards: DiscardRecord[] = [];
  private timeline: TimelineSnapshot[] = [];
  private events: TelemetryEventRecord[] = [];

  private timelineTimer: number = 0;
  private trainManager: TrainManager | null = null;
  private currentPhaseName: string = 'Tutorial';

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
    this.setupEventListeners();
  }

  public init(seed: string | number, trainManager: TrainManager): void {
    this.seed = seed.toString();
    this.trainManager = trainManager;
    this.startTime = Date.now();
    this.endTime = 0;
    this.finalScore = 0;
    this.outcome = 'WIN';

    this.windows = [];
    this.itemStats = this.initItemStats();
    this.grabSnapshots = [];
    this.discards = [];
    this.timeline = [];
    this.events = [];
    this.timelineTimer = 0;
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

  private setupEventListeners(): void {
    const bus = EventBus.getInstance();

    bus.on('ITEM_SEEN', (d: { item: ItemId }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].seen++;
      this.recordEvent('ITEM_SEEN', d);
    });

    bus.on('GRAPPLE_FIRE', (d: any) => this.recordEvent('GRAPPLE_FIRE', d));
    bus.on('GRAPPLE_HIT', (d: { item: ItemId }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].attempted++;
      this.recordEvent('GRAPPLE_HIT', d);
    });
    bus.on('GRAPPLE_MISS', (d: any) => this.recordEvent('GRAPPLE_MISS', d));

    bus.on('ITEM_DELIVERED', (d: { item: ItemId }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].grabbed++;
      this.recordEvent('ITEM_DELIVERED', d);

      // Section 93: Condition Value Snapshot
      if (this.trainManager) {
        this.grabSnapshots.push({
          time: (Date.now() - this.startTime) * 0.001,
          item: d.item,
          fuel: this.trainManager.stats.fuel,
          load: this.trainManager.load.getCurrentLoad(),
          maxLoad: this.trainManager.load.getMaxLoad(),
          powerSupply: this.trainManager.power.getSupply(),
          powerDemand: this.trainManager.power.getDemand(),
          slotAvailability: this.trainManager.getAvailableSlotCount(),
          phase: this.currentPhaseName,
        });
      }
    });

    bus.on('ITEM_REJECTED', (d: any) => this.recordEvent('ITEM_REJECTED', d));

    bus.on('ITEM_DISCARDED', (d: { item: ItemId; time: number; reasonContext: any }) => {
      if (this.itemStats[d.item]) this.itemStats[d.item].discarded++;
      this.discards.push({
        time: d.time,
        item: d.item,
        reasonContext: {
          ...d.reasonContext,
          phase: this.currentPhaseName,
        },
      });
      this.recordEvent('ITEM_DISCARDED', d);
    });

    bus.on('CAR_ATTACHED', (d: any) => this.recordEvent('CAR_ATTACHED', d));
    bus.on('POWER_SHORTAGE_START', (d: any) => this.recordEvent('POWER_SHORTAGE_START', d));
    bus.on('POWER_SHORTAGE_END', (d: any) => this.recordEvent('POWER_SHORTAGE_END', d));
    bus.on('HEAVY_TRAIN_START', (d: any) => this.recordEvent('HEAVY_TRAIN_START', d));
    bus.on('HEAVY_TRAIN_END', (d: any) => this.recordEvent('HEAVY_TRAIN_END', d));
    bus.on('ENEMY_SPAWN', (d: any) => this.recordEvent('ENEMY_SPAWN', d));
    bus.on('ENEMY_KILLED', (d: any) => this.recordEvent('ENEMY_KILLED', d));
    bus.on('TRAIN_DAMAGE', (d: any) => this.recordEvent('TRAIN_DAMAGE', d));
    bus.on('FRIDGE_OPEN', (d: any) => this.recordEvent('FRIDGE_OPEN', d));
    bus.on('EGG_HATCH', (d: any) => this.recordEvent('EGG_HATCH', d));
    bus.on('PHASE_CHANGE', (d: any) => {
      this.currentPhaseName = d.name;
      this.recordEvent('PHASE_CHANGE', d);
    });
    bus.on('WINDOW_START', (d: any) => this.recordEvent('WINDOW_START', d));
    bus.on('WINDOW_END', (d: { record: WindowChoiceRecord }) => {
      this.windows.push(d.record);
      for (const ign of d.record.itemsIgnored) {
        if (this.itemStats[ign]) this.itemStats[ign].ignored++;
      }
      this.recordEvent('WINDOW_END', { windowId: d.record.windowId });
    });
  }

  public recordEvent(event: string, data?: any): void {
    this.events.push({
      time: parseFloat(((Date.now() - this.startTime) * 0.001).toFixed(2)),
      event,
      data,
    });
  }

  public update(delta: number, enemyCount: number): void {
    if (!this.trainManager) return;
    const dt = delta * 0.001;
    this.timelineTimer += dt;

    // Section 96: Snapshot every 5 seconds
    if (this.timelineTimer >= 5.0) {
      this.timelineTimer = 0;
      const t = parseFloat(((Date.now() - this.startTime) * 0.001).toFixed(1));
      this.timeline.push({
        time: t,
        hp: Math.ceil(this.trainManager.stats.hp),
        fuel: Math.ceil(this.trainManager.stats.fuel),
        load: this.trainManager.load.getCurrentLoad(),
        maxLoad: this.trainManager.load.getMaxLoad(),
        powerSupply: this.trainManager.power.getSupply(),
        powerDemand: this.trainManager.power.getDemand(),
        scorePotential: this.calculateCurrentScore(),
        cars: this.trainManager.getCarCount(),
        enemies: enemyCount,
      });
    }
  }

  public calculateCurrentScore(): number {
    if (!this.trainManager) return 100;
    let score = balanceData.score.base;

    const modules = this.trainManager.getAllInstalledModules();
    for (const m of modules) {
      if (m.itemId === 'gold') {
        score += m.fromTradeLine ? 168 : 140;
      } else if (m.itemId === 'sheep') {
        score += m.fromTradeLine ? 108 : 90;
      } else if (m.itemId === 'survivor') {
        score += 50;
      } else if (m.itemId === 'junk') {
        score += 5;
      } else if (m.itemId === 'fridge' && m.customData?.outcome === 'FOOD') {
        score += 80;
      } else if (m.itemId === 'egg' && m.customData?.outcome === 'FRIENDLY') {
        score += 60;
      }
    }

    score += Math.round(this.trainManager.stats.hp * balanceData.score.hpMultiplier);
    score += Math.round(this.trainManager.stats.fuel * balanceData.score.fuelMultiplier);
    return score;
  }

  public setRunOutcome(outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED'): void {
    this.outcome = outcome;
    this.endTime = Date.now();
    this.finalScore = this.calculateCurrentScore();
  }

  public getFullTelemetry(): RunTelemetryData {
    const modules = this.trainManager ? this.trainManager.getAllInstalledModules() : [];

    const goldCount = modules.filter((m) => m.itemId === 'gold').length;
    const sheepCount = modules.filter((m) => m.itemId === 'sheep').length;
    const survivorCount = modules.filter((m) => m.itemId === 'survivor').length;
    const turretCount = modules.filter((m) => m.itemId === 'turret').length;
    const batteryCount = modules.filter((m) => m.itemId === 'battery').length;

    return {
      seed: this.seed,
      startTime: this.startTime,
      endTime: this.endTime || Date.now(),
      durationSeconds: parseFloat((( (this.endTime || Date.now()) - this.startTime) * 0.001).toFixed(1)),
      finalScore: this.finalScore || this.calculateCurrentScore(),
      outcome: this.outcome,
      windows: this.windows,
      itemStats: this.itemStats,
      grabSnapshots: this.grabSnapshots,
      discards: this.discards,
      timeline: this.timeline,
      events: this.events,
      finalTrain: {
        length: this.trainManager ? this.trainManager.getCarCount() : 3,
        load: this.trainManager ? this.trainManager.load.getCurrentLoad() : 0,
        maxLoad: this.trainManager ? this.trainManager.load.getMaxLoad() : 48,
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
    a.download = `train_grabber_v2_${this.seed}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
