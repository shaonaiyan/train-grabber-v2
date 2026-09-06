import { SeededRandom } from '../src/core/SeededRandom';
import { LoadSystem } from '../src/train/LoadSystem';
import { PowerSystem } from '../src/train/PowerSystem';
import { TrainStatsManager } from '../src/train/TrainStats';
import itemsData from '../src/data/items.json';
import oppsData from '../src/data/opportunities.json';
import phasesData from '../src/data/phases.json';
import balanceData from '../src/data/balance.json';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- STARTING TRAIN GRABBER V2 CORE VALIDATION ---');

// 1. Test SeededRandom reproducibility
console.log('1. Testing SeededRandom reproducibility...');
const rng1 = new SeededRandom(1337);
const rng2 = new SeededRandom(1337);
for (let i = 0; i < 50; i++) {
  const v1 = rng1.nextFloat();
  const v2 = rng2.nextFloat();
  assert(v1 === v2, `PRNG mismatch at step ${i}: ${v1} vs ${v2}`);
}
console.log('  ✓ SeededRandom is 100% deterministic');

// 2. Test LoadSystem
console.log('2. Testing LoadSystem...');
const loadSys = new LoadSystem();
assert(loadSys.getCurrentLoad() === 0, 'Initial load should be 0');
assert(loadSys.getMaxLoad() === 48, 'Initial max load should be 48');
assert(loadSys.getLoadRatio() === 0, 'Initial load ratio should be 0');
assert(loadSys.getSpeedMultiplier() === 1.0, 'Initial speed mul should be 1.0');

// Add 35 load -> 35/48 = 72.9% (Tier 2: 70% ~ 85%)
loadSys.recalculate(35, 0);
assert(loadSys.getSpeedMultiplier() === 0.95, 'Speed mul at 72.9% should be 0.95');
assert(loadSys.getFuelMultiplier() === 1.12, 'Fuel mul at 72.9% should be 1.12');

// Add 42 load -> 42/48 = 87.5% (Tier 3: 85% ~ 100%)
loadSys.recalculate(42, 0);
assert(loadSys.getSpeedMultiplier() === 0.88, 'Speed mul at 87.5% should be 0.88');
assert(loadSys.getFuelMultiplier() === 1.28, 'Fuel mul at 87.5% should be 1.28');

// Add Flat Car -> Max Load should increase by +22 (48 + 22 = 70), Install Load +8
loadSys.recalculate(0, 1);
assert(loadSys.getMaxLoad() === 70, 'Max load with 1 flat car should be 70');
assert(loadSys.getCurrentLoad() === 8, 'Current load with 1 flat car should be 8');
console.log('  ✓ LoadSystem passed all tier and flat car capacity tests');

// 3. Test PowerSystem
console.log('3. Testing PowerSystem...');
const powerSys = new PowerSystem();
assert(powerSys.getSupply() === 2, 'Initial supply should be 2');
assert(powerSys.getDemand() === 0, 'Initial demand should be 0');
assert(powerSys.getEfficiency() === 1.0, 'Initial efficiency should be 100%');
assert(!powerSys.hasShortage(), 'Initial state has no shortage');

// Add 2 turrets -> Demand = 4, Supply = 2 -> Ratio = 0.5 -> Efficiency = 0.5
powerSys.recalculate(0, 2);
assert(powerSys.hasShortage(), 'Should have shortage with 2 turrets (demand 4) and supply 2');
assert(powerSys.getPowerRatio() === 0.5, 'Power ratio should be 0.5');
assert(powerSys.getEfficiency() === 0.5, 'Efficiency should be 0.5');

// Add 4 turrets -> Demand = 8, Supply = 2 -> Ratio = 0.25 -> Efficiency clamped to max(0.35, 0.25) = 0.35
powerSys.recalculate(0, 4);
assert(powerSys.getEfficiency() === 0.35, 'Efficiency should clamp to min 0.35');

// Add 2 Batteries -> Supply = 2 + 2*3 = 8, Demand = 8 -> Shortage resolved!
powerSys.recalculate(2, 4);
assert(!powerSys.hasShortage(), 'Shortage should be resolved when supply reaches demand');
assert(powerSys.getEfficiency() === 1.0, 'Efficiency should be 1.0 when resolved');
console.log('  ✓ PowerSystem passed all shortage and efficiency tests');

// 4. Test TrainStatsManager
console.log('4. Testing TrainStatsManager...');
const stats = new TrainStatsManager();
assert(stats.hp === 100, 'Initial HP should be 100');
assert(stats.fuel === 70, 'Initial Fuel should be 70');

stats.takeDamage(30, 'test');
assert(stats.hp === 70, 'HP after 30 damage should be 70');
stats.addHp(15);
assert(stats.hp === 85, 'HP after 15 heal should be 85');

// Fuel drain calculation
const drain = stats.calculateFuelDrain(0, 0, 1.0, 1.0);
assert(Math.abs(drain - 0.12) < 0.001, 'Base fuel drain should be 0.12/s');

// Dryland (x1.35) + 1 Flat Car (+0.035) + 1 Survivor (+0.008)
const drainDryland = stats.calculateFuelDrain(1, 1, 1.0, 1.35);
// (0.12 + 0.035 + 0.008) * 1.35 = 0.163 * 1.35 = 0.22005
assert(Math.abs(drainDryland - 0.22005) < 0.001, 'Complex fuel drain should match formula');

// Out of fuel timer test
stats.fuel = 0;
stats.update(6.0, drain);
assert(stats.isOutOfFuel === true, 'Should be out of fuel');
assert(stats.outOfFuelTimer >= 6.0, 'Timer should have tracked 6.0s');
stats.addFuel(10);
assert(stats.isOutOfFuel === false, 'Should no longer be out of fuel');
assert(stats.outOfFuelTimer === 0, 'Timer should reset to 0');
console.log('  ✓ TrainStatsManager passed all stat, drain, and fuel tests');

// 5. Verify Data Configuration Integrity
console.log('5. Validating JSON data configurations...');
const items = (itemsData as any).items || (itemsData as any);
const requiredItems = ['parts', 'fuel', 'gold', 'turret', 'battery', 'flat_car', 'sheep', 'survivor', 'fridge', 'egg', 'explosive', 'junk'];
for (const req of requiredItems) {
  assert(items[req] !== undefined, `Missing item in items.json: ${req}`);
}
assert(items['gold'].finishScore === 140, 'Gold finish score should be 140');
assert(items['turret'].damage === 8, 'Turret damage should be 8');
assert(items['turret'].baseFireRate === 3, 'Turret base fire rate should be 3');
assert(items['turret'].range === 500, 'Turret range should be 500');
assert(items['flat_car'].maxLoadBonus === 22, 'Flat car max load bonus should be 22');

const oppGroups = (oppsData as any).groups;
const requiredGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
for (const g of requiredGroups) {
  assert(oppGroups[g] !== undefined, `Missing opportunity group: ${g}`);
  assert(oppGroups[g].items.length >= 2, `Group ${g} must have at least 2 items`);
}

assert(phasesData.totalDuration === 480, 'Total run duration must be 480 seconds (8 minutes)');
assert(phasesData.phases.length === 6, 'Must have 6 phase configurations (0 to 5)');

console.log('  ✓ All 12 items, 12 opportunity groups, and 6 phases validated');
console.log('--- ALL VALIDATIONS PASSED CLEANLY ---');
