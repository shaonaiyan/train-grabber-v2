export const V4_BALANCE = {
  // Mode Duration
  TOTAL_DURATION_SEC: 90.0,
  SHOWCASE_DURATION_SEC: 3.0,
  DEFAULT_SHOWCASE_SEED: 'V4_SHOWCASE_001',

  // Presentation & World Speed
  BASE_PRESENTATION_SPEED: 155.0, // px/s
  MIN_PRESENTATION_SPEED: 142.6, // 92% of base
  MAX_PRESENTATION_SPEED: 165.0,

  // Soft Weight Tiers
  SAFE_WEIGHT: 70,
  HEAVY_WEIGHT_THRESHOLD: 70,
  DANGER_WEIGHT_THRESHOLD: 90,
  CRITICAL_WEIGHT_THRESHOLD: 105,

  // Weight Effects
  FUEL_DRAIN: {
    BASE: 0.16,
    HEAVY_MUL: 1.25,
    DANGER_MUL: 1.55,
    CRITICAL_MUL: 1.90,
  },
  CRITICAL_ENEMY_CLOSING_BONUS: 0.25, // +25% enemy closing speed when > 105 weight

  // Continuous Salvage Stream
  STREAM_RATES: [
    { start: 0, end: 8, interval: 999.0 },     // Intro
    { start: 8, end: 25, interval: 1.80 },
    { start: 25, end: 45, interval: 1.45 },
    { start: 45, end: 70, interval: 1.25 },
    { start: 70, end: 85, interval: 1.05 },
    { start: 85, end: 90, interval: 999.0 },    // Final burst only
  ],
  INTERVAL_JITTER_MIN: 0.75,
  INTERVAL_JITTER_MAX: 1.30,
  MAX_ACTIVE_ITEMS: 8,
  COVERAGE_STARVATION_TIMEOUT: 1.8, // Force fallback item if empty for 1.8s
  PAIR_CHANCE: 0.18,
  BURST_CHANCE: 0.08,

  // Stream Weights
  STREAM_WEIGHTS: {
    fuel: 18,
    parts: 16,
    junk: 22,
    battery: 8,
    gold_safe_v4: 8,
    sheep_v4: 8,
    explosive_v4: 8,
    fridge_v4: 6,
    scrap: 6,
  },

  // Battery Perks
  BATTERY_PERK: {
    MAX_STACKS: 2,
    TURRET_FIRE_RATE_BONUS: 0.30, // +30% per battery
    MAGNET_RECHARGE_REDUCTION: 0.20, // -20% per battery
    DRONE_DURATION_BONUS: 3.0, // +3s per battery
  },

  // Fixed Timeline Keyframes (seconds)
  TIMELINE: {
    PARTS_INTRO: 5.0,
    STREAM_START: 8.0,
    SHEEP_APPEAR: 15.0,
    GOLD_SAFE_AND_FUEL: 20.0,
    FRIDGE_APPEAR: 27.0,
    DRONE_HOSTILE_1: 38.0,
    EXPLOSIVE_BARREL: 45.0,
    DRONE_HOSTILE_2: 46.0,
    DENSITY_SURGE: 52.0,
    FLAT_CAR_APPEAR: 55.0,
    GIANT_MAGNET: 63.0,
    BANDIT_JEEP: 71.0,
    CHAOS_BURST: 78.0,
    STREAM_STOP: 85.0,
  },

  // Impact Physics
  IMPACT: {
    JUNK: { scale: 0.05, maxDmg: 20 },
    GOLD_SAFE: { scale: 0.18, maxDmg: 80 },
    BATTERY: { scale: 0.07, maxDmg: 30 },
    FRIDGE: { scale: 0.10, maxDmg: 45 },
    EXPLOSIVE: { radius: 180, enemyDmg: 100, trainDmg: 16, trainRadius: 140 },
    DRONE_CRASH_SPEED: 320,
  },

  // Giant Magnet
  MAGNET: {
    COOLDOWN: 7.0,
    CHARGE_DURATION: 1.2,
    ACTIVE_DURATION: 2.4,
    RADIUS: 560.0,
    FORCE_MIN: 350.0,
    FORCE_MAX: 900.0,
    OVERCHARGE_COUNT: 5,
    OVERCHARGE_OFF_TIME: 4.0,
  },

  // Auto Turret V4
  TURRET: {
    DAMAGE: 7,
    FIRE_RATE: 2.5,
    RANGE: 650,
  },
};
