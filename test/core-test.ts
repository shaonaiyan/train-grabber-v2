import { SeededRandom } from '../src/core/SeededRandom';
import { LoadSystem } from '../src/train/LoadSystem';
import { CargoSystem } from '../src/train/CargoSystem';
import { PowerSystem } from '../src/train/PowerSystem';
import { TrainStatsManager } from '../src/train/TrainStats';
import { JourneyProgress } from '../src/journey/JourneyProgress';
import itemsData from '../src/data/items.json';
import balanceData from '../src/data/balance.json';
import journeyData from '../src/data/journey_v3.json';
import sitesData from '../src/data/salvage_sites_v3.json';
import encountersData from '../src/data/encounters_v3.json';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('================================================================');
console.log('--- STARTING TRAIN GRABBER V3.0 CORE ARCHITECTURE VALIDATION ---');
console.log('================================================================\n');

// 1. DistanceProgressTest (Section 212.1)
console.log('1. DistanceProgressTest: Verifying distance-based progression...');
const progress = new JourneyProgress();
assert(progress.targetDistanceM === 4800, 'Target distance must be 4800m');
assert(progress.metersPerPixel === 0.111, 'metersPerPixel must be 0.111');
assert(progress.baseSpeedPx === 160, 'baseWorldSpeedPx must be 160');
assert(Math.abs(progress.actualSpeedKmh - 63.936) < 0.01, 'Base speed must be ~63.94 km/h');
assert(progress.distanceTravelledM === 0, 'Initial distance must be 0m');
assert(progress.isCompleted() === false, 'Should not be completed initially');

// Simulate 10 seconds of travel at base speed (160 px/s)
progress.update(10, 160);
// 160 px/s * 0.111 m/px * 10s = 177.6m
assert(Math.abs(progress.distanceTravelledM - 177.6) < 0.01, 'Distance after 10s must be 177.6m');
assert(Math.abs(progress.distanceRemainingM - (4800 - 177.6)) < 0.01, 'Distance remaining must match');

// Complete the journey
progress.update(300, 160);
assert(progress.distanceTravelledM >= 4800, 'Distance should reach 4800m');
assert(progress.progress01 === 1.0, 'Progress must be 100%');
assert(progress.isCompleted() === true, 'Journey must report completed at 4800m');
console.log('  ✓ DistanceProgressTest passed (Speed conversion, integration & 4800m completion verified)\n');

// 2. SoftLoadNormalTest (Section 212.2)
console.log('2. SoftLoadNormalTest: Verifying load ratio <= 0.70 NORMAL tier...');
const loadSys = new LoadSystem();
assert(loadSys.safeMaxLoad === 48, 'Safe max load must be 48 base');
loadSys.recalculate(30, 0); // 30 / 48 = 0.625 <= 0.70
assert(loadSys.getTier() === 'NORMAL', 'Tier at 62.5% load must be NORMAL');
assert(loadSys.getSpeedMultiplier() === 1.00, 'Speed multiplier in NORMAL must be 1.00');
assert(loadSys.getFuelMultiplier() === 1.00, 'Fuel multiplier in NORMAL must be 1.00');
assert(loadSys.canAcceptLoad(10) === true, 'Should accept load when within 1.30');
console.log('  ✓ SoftLoadNormalTest passed (Tier NORMAL at 1.00x speed and 1.00x fuel)\n');

// 3. SoftLoadOverloadTest (Section 212.3)
console.log('3. SoftLoadOverloadTest: Verifying load ratio 1.00~1.15 OVERLOAD tier...');
loadSys.recalculate(48, 0); // 48 / 48 = 1.00 (HEAVY edge / OVERLOAD threshold)
assert(Math.abs(loadSys.getSpeedMultiplier() - 0.88) < 0.001, 'Speed mul at 1.00 ratio must be 0.88');
assert(Math.abs(loadSys.getFuelMultiplier() - 1.18) < 0.001, 'Fuel mul at 1.00 ratio must be 1.18');

loadSys.recalculate(53, 0); // 53 / 48 = 1.104 (OVERLOAD)
assert(loadSys.getTier() === 'OVERLOAD', 'Tier at 110.4% load must be OVERLOAD');

loadSys.recalculate(55.2, 0); // 55.2 / 48 = 1.15
assert(Math.abs(loadSys.getSpeedMultiplier() - 0.75) < 0.001, 'Speed mul at 1.15 ratio must be 0.75');
assert(Math.abs(loadSys.getFuelMultiplier() - 1.45) < 0.001, 'Fuel mul at 1.15 ratio must be 1.45');
console.log('  ✓ SoftLoadOverloadTest passed (Tier OVERLOAD linear degradation: 0.88->0.75 speed, 1.18->1.45 fuel)\n');

// 4. SoftLoadDangerTest (Section 212.4)
console.log('4. SoftLoadDangerTest: Verifying load ratio 1.15~1.30 DANGER tier...');
loadSys.recalculate(60, 0); // 60 / 48 = 1.25
assert(loadSys.getTier() === 'DANGER', 'Tier at 125% load must be DANGER');

loadSys.recalculate(62.4, 0); // 62.4 / 48 = 1.30 (Hard limit boundary)
assert(Math.abs(loadSys.getSpeedMultiplier() - 0.62) < 0.001, 'Speed mul at 1.30 ratio must be 0.62');
assert(Math.abs(loadSys.getFuelMultiplier() - 1.80) < 0.001, 'Fuel mul at 1.30 ratio must be 1.80');
console.log('  ✓ SoftLoadDangerTest passed (Tier DANGER linear degradation: 0.75->0.62 speed, 1.45->1.80 fuel)\n');

// 5. SoftLoadHardLimitTest (Section 212.5)
console.log('5. SoftLoadHardLimitTest: Verifying load ratio > 1.30 HARD LIMIT rejection...');
loadSys.recalculate(63, 0); // 63 / 48 = 1.3125
assert(loadSys.getTier() === 'HARD_LIMIT', 'Tier at >130% load must be HARD_LIMIT');
assert(loadSys.canAcceptLoad(1) === false, 'Must reject additional load when exceeding 1.30');
console.log('  ✓ SoftLoadHardLimitTest passed (Hard limit > 1.30 strictly enforced)\n');

// 6. CargoCapacityTest (Section 212.6)
console.log('6. CargoCapacityTest: Verifying base capacity 6 + 5 per flat car...');
const cargoSys = new CargoSystem();
assert(cargoSys.cargoCapacity === 6, 'Base cargo capacity must be 6');
assert(cargoSys.canAcceptCargo(1) === true, 'Can accept 1 unit initially');

// Add items of size 1 and 2
const fakeGold: any = { id: 'gold', cargoSize: 1, load: 12, cargoValue: 140 };
const fakeSheep: any = { id: 'sheep', cargoSize: 2, load: 8, cargoValue: 70 };
cargoSys.addCargo(fakeGold);
cargoSys.addCargo(fakeSheep);
assert(cargoSys.cargoUsed === 3, 'Cargo used should be 1 + 2 = 3');
assert(cargoSys.getTotalCargoValue() === 210, 'Total cargo value should be 140 + 70 = 210');

// Flat car capacity increases
cargoSys.recalculateCapacity(1);
assert(cargoSys.cargoCapacity === 11, 'Cargo capacity with 1 flat car must be 6 + 5 = 11');
cargoSys.recalculateCapacity(2);
assert(cargoSys.cargoCapacity === 16, 'Cargo capacity with 2 flat cars must be 6 + 10 = 16');
console.log('  ✓ CargoCapacityTest passed (Base capacity 6 + 5/flatcar verified)\n');

// 7. CargoOverflowTest (Section 212.7)
console.log('7. CargoOverflowTest: Verifying max +2 overstack & +5 load penalty...');
cargoSys.reset(); // base capacity 6
// Fill to 6
for (let i = 0; i < 6; i++) {
  cargoSys.addCargo(fakeGold);
}
assert(cargoSys.cargoUsed === 6, 'Cargo used must be 6');
assert(cargoSys.getCargoOverflow() === 0, 'No overflow at capacity 6');
assert(cargoSys.getOverflowLoadPenalty() === 0, 'No penalty at capacity 6');

// Overstack +1 (7 / 6)
assert(cargoSys.canAcceptCargo(1) === true, 'Can accept +1 overstack');
cargoSys.addCargo(fakeGold);
assert(cargoSys.getCargoOverflow() === 1, 'Overflow must be 1');
assert(cargoSys.getOverflowLoadPenalty() === 5, 'Penalty must be 1 * 5 = 5 load');

// Overstack +2 (8 / 6)
assert(cargoSys.canAcceptCargo(1) === true, 'Can accept +2 overstack');
cargoSys.addCargo(fakeGold);
assert(cargoSys.getCargoOverflow() === 2, 'Overflow must be 2');
assert(cargoSys.getOverflowLoadPenalty() === 10, 'Penalty must be 2 * 5 = 10 load');

// Attempt to overstack +3 (> maxOverstackUnits of 2) -> REJECTED
assert(cargoSys.canAcceptCargo(1) === false, 'Cannot accept beyond max +2 overstack (8 max)');
console.log('  ✓ CargoOverflowTest passed (Max +2 overstack and +5 load/overflow verified)\n');

// 8. FlatCarCapacityTest (Section 212.8)
console.log('8. FlatCarCapacityTest: Verifying max 2 flat cars & load calculation...');
assert(balanceData.train.maxFlatCars === 2, 'Max flat cars in balanceData must be 2');
loadSys.recalculate(20, 0); // 20 / 48
assert(loadSys.canAcceptFlatCar() === true, 'Can accept flat car under safe load');

// Test flat car bonus (+22 safeMaxLoad, +8 installLoad)
loadSys.recalculate(0, 1);
assert(loadSys.safeMaxLoad === 70, 'Safe max load with 1 flat car must be 48 + 22 = 70');
assert(loadSys.physicalLoad === 8, 'Physical load with 1 flat car must be 8');

loadSys.recalculate(0, 2);
assert(loadSys.safeMaxLoad === 92, 'Safe max load with 2 flat cars must be 48 + 44 = 92');
assert(loadSys.physicalLoad === 16, 'Physical load with 2 flat cars must be 16');
console.log('  ✓ FlatCarCapacityTest passed (Max 2 flat cars, +22 max load / +8 install load verified)\n');

// 9. SiteScheduleDeterminismTest (Section 212.9)
console.log('9. SiteScheduleDeterminismTest: Verifying 9 salvage sites and loot clusters...');
assert(sitesData.sites.length === 9, 'Must have exactly 9 salvage sites in V3');
const expectedSites = [
  'intro_scrap', 'gas_station', 'farm_ruin', 'rail_yard',
  'dry_scrap', 'military_wreck', 'lab_accident', 'broken_freight', 'last_temptation'
];
let prevTriggerM = 0;
sitesData.sites.forEach((site: any, idx: number) => {
  assert(site.id === expectedSites[idx], `Site ${idx} must be ${expectedSites[idx]}, got ${site.id}`);
  assert(site.triggerDistanceM > prevTriggerM, `Site ${site.id} triggerDistance must be ascending: ${site.triggerDistanceM} > ${prevTriggerM}`);
  assert(site.props.length > 0, `Site ${site.id} must have props`);
  assert(site.loot.length > 0, `Site ${site.id} must have loot`);
  prevTriggerM = site.triggerDistanceM;
});
console.log('  ✓ SiteScheduleDeterminismTest passed (All 9 sites have ascending distances, props, and clustered loot)\n');

// 10. MysteryOutcomeDeterminismTest (Section 212.10)
console.log('10. MysteryOutcomeDeterminismTest: Verifying PRNG determinism for mystery items...');
const rngSeed = 2026;
const rngA = new SeededRandom(rngSeed);
const rngB = new SeededRandom(rngSeed);
const sequenceA: number[] = [];
const sequenceB: number[] = [];
for (let i = 0; i < 50; i++) {
  sequenceA.push(rngA.nextFloat());
  sequenceB.push(rngB.nextFloat());
}
assert(JSON.stringify(sequenceA) === JSON.stringify(sequenceB), 'RNG sequences must be 100% identical for same seed');
console.log('  ✓ MysteryOutcomeDeterminismTest passed (PRNG reproducible across runs)\n');

// 11. EncounterTriggerDistanceTest (Section 212.11)
console.log('11. EncounterTriggerDistanceTest: Verifying 4 encounters at exact distances...');
assert(encountersData.encounters.length === 4, 'Must have exactly 4 encounters in V3');
const expectedEncounters = [
  { id: 'bandit_intro', dist: 850 },
  { id: 'raider_attack', dist: 2950 },
  { id: 'drone_ambush', dist: 3150 },
  { id: 'mixed_raid', dist: 3820 },
];
encountersData.encounters.forEach((enc: any, idx: number) => {
  assert(enc.id === expectedEncounters[idx].id, `Encounter ${idx} id must be ${expectedEncounters[idx].id}`);
  assert(enc.distanceM === expectedEncounters[idx].dist, `Encounter ${idx} distance must be ${expectedEncounters[idx].dist}m`);
  assert(enc.enemies.length > 0, `Encounter ${enc.id} must have enemies`);
});
console.log('  ✓ EncounterTriggerDistanceTest passed (4 encounters at 850m, 2950m, 3150m, 3820m verified)\n');

// 12. TurretPowerEfficiencyTest (Section 212.12)
console.log('12. TurretPowerEfficiencyTest: Verifying Turret stats, range 720, and power efficiency...');
const turretItem = (itemsData as any).items?.turret || (itemsData as any).turret;
assert(turretItem.range === 720, 'Turret range must be 720 (extended from 500)');
assert(turretItem.damage === 8, 'Turret damage must be 8');
assert(turretItem.baseFireRate === 3, 'Turret base fire rate must be 3/s');
assert(turretItem.powerDemand === 2, 'Turret power demand must be 2');

const powerSys = new PowerSystem();
assert(powerSys.getSupply() === 2, 'Base engine supply must be 2');
assert(powerSys.getEfficiency() === 1.0, 'Base power efficiency must be 1.0');

// 1 turret (demand 2) -> supply 2, demand 2
powerSys.recalculate(0, 1);
assert(powerSys.getEfficiency() === 1.0, 'Efficiency with 1 turret must be 1.0');
assert(powerSys.hasShortage() === false, 'No shortage with 1 turret');

// 2 turrets (demand 4) -> supply 2, demand 4
powerSys.recalculate(0, 2);
assert(powerSys.getEfficiency() === 0.5, 'Efficiency with 2 turrets must be 0.5');
assert(powerSys.hasShortage() === true, 'Shortage with 2 turrets');

// 4 turrets (demand 8) -> supply 2, demand 8 -> clamps to 0.35
powerSys.recalculate(0, 4);
assert(powerSys.getEfficiency() === 0.35, 'Efficiency clamped to min 0.35 with 4 turrets');

// Add 1 battery (+3 supply) -> supply 2 + 3 = 5, demand 4 -> shortage resolved
powerSys.recalculate(1, 2);
assert(powerSys.getSupply() === 5, 'Supply with 1 battery must be 2 + 3 = 5');
assert(powerSys.getEfficiency() === 1.0, 'Efficiency resolved to 1.0 with battery');
assert(powerSys.hasShortage() === false, 'Shortage resolved with battery');
console.log('  ✓ TurretPowerEfficiencyTest passed (Turret 720 range, power scaling and battery resolution verified)\n');

console.log('================================================================');
console.log('--- ALL 12 CORE SPECIFICATION TESTS PASSED SUCCESSFULLY! ---');
console.log('================================================================');
