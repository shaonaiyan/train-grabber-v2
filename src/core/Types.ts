export type ItemId =
  | 'parts'
  | 'fuel'
  | 'gold'
  | 'turret'
  | 'battery'
  | 'flat_car'
  | 'sheep'
  | 'survivor'
  | 'fridge'
  | 'egg'
  | 'explosive'
  | 'junk';

export type ItemType = 'Consumable' | 'Persistent' | 'Car';
export type SlotType = 'TOP' | 'BODY' | 'SIDE';

export interface ItemData {
  id: ItemId;
  name: string;
  type: ItemType;
  slot?: SlotType;
  hookWeight?: number;
  load?: number;
  installLoad?: number;
  maxLoadBonus?: number;
  powerDemand?: number;
  powerSupply?: number;
  damage?: number;
  baseFireRate?: number;
  range?: number;
  hpBonus?: number;
  fuelBonus?: number;
  scoreBonus?: number;
  finishScore?: number;
  tradeLineBonusMultiplier?: number;
  fuelDrain?: number;
  regenInterval?: number;
  regenHp?: number;
  openTime?: number;
  hatchTime?: number;
  friendlyDmg?: number;
  friendlyInterval?: number;
  friendlyScore?: number;
  explodeDelay?: number;
  explodeRadius?: number;
  enemyDamage?: number;
  trainDamage?: number;
  canDiscard?: boolean;
  description: string;
}

export type DepthBand = 'far' | 'mid' | 'near';

export interface DepthConfig {
  minY: number;
  maxY: number;
  minScale: number;
  maxScale: number;
  depth: number;
}

export type HookState =
  | 'IDLE'
  | 'AIM'
  | 'FIRE'
  | 'FLYING'
  | 'HIT'
  | 'LATCHED'
  | 'PULLING'
  | 'DELIVER'
  | 'REJECTED'
  | 'RELEASE'
  | 'MISS'
  | 'RETURN';

export interface OpportunityGroup {
  id: string;
  name: string;
  items: ItemId[];
  tags: string[];
  phaseWeight: Record<string, number>;
}

export interface PhaseConfig {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  banner: string;
  bannerDuration: number;
  fuelDrainMultiplier: number;
  speedMultiplier: number;
  enemyBanditInterval: [number, number];
  enemyDroneInterval: [number, number];
  fixedWindows: Array<{ time: number; items: ItemId[] }>;
}

export interface EnemyConfig {
  id: 'bandit' | 'drone';
  name: string;
  hp: number;
  speed: number;
  attackInterval: number;
  damage: number;
  range: number;
  targetPriority: number;
  color: number;
}

export interface TrainStats {
  hp: number;
  maxHp: number;
  fuel: number;
  maxFuel: number;
  load: number;
  maxLoad: number;
  baseMaxLoad: number;
  powerSupply: number;
  powerDemand: number;
  worldSpeed: number;
  fuelDrain: number;
  carCount: number;
  outOfFuelTimer: number;
  isOutOfFuel: boolean;
}

export interface InstalledModule {
  uid: string;
  itemId: ItemId;
  data: ItemData;
  carIndex: number;
  slotType: SlotType;
  installedTime: number;
  fromTradeLine?: boolean;
  stateTimer?: number;
  isProcessed?: boolean; // For fridge or egg
  customData?: Record<string, any>;
}

export interface TelemetryEventRecord {
  time: number;
  event: string;
  data?: Record<string, any>;
}

export interface WindowChoiceRecord {
  windowId: string;
  spawnTime: number;
  endTime: number;
  itemsPresented: ItemId[];
  trainStateAtSpawn: {
    hp: number;
    fuel: number;
    load: number;
    maxLoad: number;
    powerSupply: number;
    powerDemand: number;
    cars: number;
    attachedItems: ItemId[];
  };
  itemsAttempted: ItemId[];
  itemsSuccessfullyGrabbed: ItemId[];
  itemsIgnored: ItemId[];
  firstTargetAttempted: ItemId | null;
  timeToFirstDecision: number | null;
}

export interface ItemStatsRecord {
  seen: number;
  attempted: number;
  grabbed: number;
  ignored: number;
  discarded: number;
}

export interface DiscardRecord {
  time: number;
  item: ItemId;
  reasonContext: {
    currentLoad: number;
    maxLoad: number;
    fuel: number;
    powerSupply: number;
    powerDemand: number;
    phase: string;
    incomingItemWaiting?: ItemId;
  };
}

export interface TimelineSnapshot {
  time: number;
  hp: number;
  fuel: number;
  load: number;
  maxLoad: number;
  powerSupply: number;
  powerDemand: number;
  scorePotential: number;
  cars: number;
  enemies: number;
}

export interface RunTelemetryData {
  seed: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  finalScore: number;
  outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED';
  windows: WindowChoiceRecord[];
  itemStats: Record<ItemId, ItemStatsRecord>;
  grabSnapshots: Array<{
    time: number;
    item: ItemId;
    fuel: number;
    load: number;
    maxLoad: number;
    powerSupply: number;
    powerDemand: number;
    slotAvailability: Record<SlotType, number>;
    phase: string;
  }>;
  discards: DiscardRecord[];
  timeline: TimelineSnapshot[];
  events: TelemetryEventRecord[];
  finalTrain: {
    length: number;
    load: number;
    maxLoad: number;
    powerSupply: number;
    powerDemand: number;
    goldCount: number;
    sheepCount: number;
    survivorCount: number;
    turretCount: number;
    batteryCount: number;
    discardCount: number;
    modules: Array<{ id: ItemId; slot: SlotType; car: number }>;
  };
}
