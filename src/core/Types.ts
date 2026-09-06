export enum GameMode {
  CORE_SLICE_V4 = 'CORE_SLICE_V4',
  JOURNEY_V3 = 'JOURNEY_V3',
}

export function getActiveGameMode(): GameMode {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const m = params.get('mode');
    if (m === 'v3') return GameMode.JOURNEY_V3;
    if (m === 'v4') return GameMode.CORE_SLICE_V4;
  }
  return GameMode.CORE_SLICE_V4; // Default V4
}

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
  | 'junk'
  | 'gold_safe_v4'
  | 'sheep_v4'
  | 'fridge_v4'
  | 'explosive_v4'
  | 'drone_v4'
  | 'giant_magnet_v4'
  | 'bandit_jeep_v4'
  | 'flat_car_v4'
  | string;

export type ItemType = 'Consumable' | 'Cargo' | 'Module' | 'Car' | 'Persistent';
export type SlotType = 'TOP' | 'BODY' | 'SIDE' | 'CRANE';
export type LoadTier = 'NORMAL' | 'HEAVY' | 'OVERLOAD' | 'DANGER' | 'HARD_LIMIT';

export interface ItemData {
  id: ItemId;
  name: string;
  type: ItemType;
  slot?: SlotType;
  cargoSize?: number;
  cargoValue?: number;
  hookWeight?: number;
  load?: number;
  installLoad?: number;
  maxLoadBonus?: number;
  safeMaxLoadBonus?: number;
  cargoCapacityBonus?: number;
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
  hint?: string;
  description: string;
  instanceId?: string;
  windowId?: string;
  siteId?: string;
  spawnPhaseId?: number;
  outcomeSeed?: number;
  fromTradeLine?: boolean;
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

export interface CargoItem {
  instanceId: string;
  itemId: ItemId;
  cargoSize: number;
  load: number;
  cargoValue: number;
  carIndex: number;
  anchorIndex: number;
  installedTime: number;
  customData?: Record<string, any>;
}

export interface SitePropDefinition {
  type: string;
  offsetX: number;
  band: DepthBand;
}

export interface SiteLootDefinition {
  item: ItemId;
  offsetX: number;
  band: DepthBand;
}

export interface SalvageSiteDefinition {
  id: string;
  displayName: string;
  triggerDistanceM: number;
  lengthPx: number;
  visualTheme: string;
  isMajor?: boolean;
  props: SitePropDefinition[];
  loot: SiteLootDefinition[];
}

export interface EncounterEnemyDefinition {
  type: 'bandit' | 'drone';
  delaySec: number;
}

export interface EncounterDefinition {
  id: string;
  displayName: string;
  distanceM: number;
  enemies: EncounterEnemyDefinition[];
}

export interface JourneyBeat {
  distanceM: number;
  type: 'site' | 'encounter' | 'segment_start' | 'segment_end' | 'haven';
  id: string;
}

export interface JourneySegment {
  id: string;
  name: string;
  startDistanceM: number;
  endDistanceM: number;
  fuelDrainMultiplier: number;
}

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
  isProcessed?: boolean;
  customData?: Record<string, any>;
}

export interface TelemetryEventRecord {
  time: number;
  event: string;
  data?: Record<string, any>;
}

export interface WindowChoiceRecord {
  windowId: string;
  groupId?: string;
  spawnTime: number;
  decisionStartTime?: number;
  decisionEndTime?: number;
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

export interface SiteRecord {
  siteId: string;
  displayName: string;
  triggerDistanceM: number;
  enterTime: number;
  exitTime?: number;
  enterDistanceM: number;
  exitDistanceM?: number;
  enterSpeedKmh: number;
  itemsPresented: ItemId[];
  itemsAttempted: ItemId[];
  itemsGrabbed: ItemId[];
  itemsMissed: ItemId[];
  itemsIgnored: ItemId[];
  captureRate?: number;
  timeInSite?: number;
}

export interface EncounterRecord {
  encounterId: string;
  startTime: number;
  endTime?: number;
  startDistance: number;
  endDistance?: number;
  enemyTypes: string[];
  enemyCount: number;
  turretCountAtStart: number;
  batteryCountAtStart: number;
  powerEfficiencyAtStart: number;
  damageTaken: number;
  turretDamageDealt: number;
  kills: number;
  escapedEnemies: number;
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
  distance?: number;
  item: ItemId;
  discardedItem?: ItemId;
  loadBefore?: number;
  loadAfter?: number;
  cargoBefore?: number;
  cargoAfter?: number;
  powerBefore?: number;
  powerAfter?: number;
  speedBefore?: number;
  speedAfter?: number;
  currentWindowId?: string;
  siteId?: string;
  reasonContext?: {
    currentLoad: number;
    maxLoad: number;
    effectiveLoad?: number;
    loadRatio?: number;
    fuel: number;
    powerSupply: number;
    powerDemand: number;
    phase?: string;
    incomingItemWaiting?: ItemId;
  };
}

export interface TimelineSnapshot {
  time: number;
  distance?: number;
  speed?: number;
  hp: number;
  fuel: number;
  load: number;
  maxLoad: number;
  loadRatio?: number;
  powerSupply: number;
  powerDemand: number;
  scorePotential: number;
  cargoValue?: number;
  cars: number;
  enemies: number;
}

export interface RunTelemetryData {
  seed: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  distanceTravelledM?: number;
  targetDistanceM?: number;
  finalScore: number;
  cargoValue?: number;
  outcome: 'WIN' | 'FAIL_HP' | 'FAIL_FUEL' | 'FORCED';
  sites?: SiteRecord[];
  encounters?: EncounterRecord[];
  windows: WindowChoiceRecord[];
  itemStats: Record<ItemId, ItemStatsRecord>;
  grabSnapshots: Array<{
    time: number;
    distance?: number;
    item: ItemId;
    instanceId?: string;
    windowId?: string;
    siteId?: string;
    spawnPhaseId?: number;
    fuel: number;
    hp?: number;
    load: number;
    effectiveLoad?: number;
    maxLoad: number;
    loadRatio?: number;
    powerSupply: number;
    powerDemand: number;
    cargoUsed?: number;
    cargoCapacity?: number;
    cargoOverflow?: number;
    cargoValue?: number;
    slotAvailability: Record<SlotType, number>;
    phase?: string;
  }>;
  discards: DiscardRecord[];
  timeline: TimelineSnapshot[];
  events: TelemetryEventRecord[];
  finalTrain: {
    length: number;
    load: number;
    safeMaxLoad?: number;
    maxLoad: number;
    loadRatio?: number;
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
