import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { SeededRandom } from '../core/SeededRandom';
import { AudioManager } from '../fx/AudioManager';
import { JuiceManager } from '../fx/JuiceManager';
import { EventBus } from '../core/EventBus';

export class ItemEffectSystem {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private rng: SeededRandom;
  private audio: AudioManager;
  private juice: JuiceManager;
  private eventBus: EventBus;

  private survivorTimer: number = 0;
  private sheepBleatTimer: number = 6.0;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    rng: SeededRandom,
    juice: JuiceManager
  ) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.rng = rng;
    this.audio = AudioManager.getInstance();
    this.juice = juice;
    this.eventBus = EventBus.getInstance();
  }

  public update(delta: number): void {
    const dt = delta * 0.001;
    const modules = this.trainManager.getAllInstalledModules();

    // 1. Survivor HP regen (Every 4.0s +1 HP)
    const survivorCount = this.trainManager.getSurvivorCount();
    if (survivorCount > 0) {
      this.survivorTimer += dt;
      if (this.survivorTimer >= 4.0) {
        this.survivorTimer = 0;
        const totalHeal = survivorCount * 1;
        this.trainManager.stats.addHp(totalHeal);
        this.audio.playRepair();
        this.juice.showFloatingText(480, 650, `+${totalHeal} HP`, '#2ecc71', '22px');
      }
    }

    // 2. Sheep occasional bleat
    const hasSheep = modules.some((m) => m.itemId === 'sheep');
    if (hasSheep) {
      this.sheepBleatTimer -= dt;
      if (this.sheepBleatTimer <= 0) {
        this.sheepBleatTimer = this.rng.range(8.0, 16.0);
        this.audio.playSheep();
        this.juice.showFloatingText(420, 640, 'Baa~', '#ffffff', '18px');
      }
    }

    // 3. Fridge and Egg Timers
    for (const mod of modules) {
      if (mod.isProcessed) continue;

      if (mod.itemId === 'fridge') {
        mod.stateTimer = (mod.stateTimer || 0) + dt;
        if (mod.stateTimer >= 12.0) {
          mod.isProcessed = true;
          this.resolveFridge(mod);
        }
      } else if (mod.itemId === 'egg') {
        mod.stateTimer = (mod.stateTimer || 0) + dt;
        if (mod.stateTimer >= 20.0) {
          mod.isProcessed = true;
          this.resolveEgg(mod);
        }
      }
    }
  }

  private resolveFridge(mod: any): void {
    // Section 30: Deterministic outcome based on unique outcomeSeed
    const itemSeed = mod.data?.outcomeSeed || 42;
    const mysteryRng = new SeededRandom(itemSeed);
    const roll = mysteryRng.nextFloat(); // 0 to 1

    if (roll < 0.40) {
      // 40% Food: Finish score +80, fridge remains
      mod.customData = { outcome: 'FOOD', bonusScore: 80 };
      this.juice.showFloatingText(450, 630, 'FRIDGE: FOOD! (+80)', '#f1c40f', '24px');
      this.audio.playFuelGulp();
      this.eventBus.emit('FRIDGE_OPEN', { outcome: 'FOOD', scoreBonus: 80 });
    } else if (roll < 0.75) {
      // 35% Repair Bot: HP +25, fridge disappears, releases Slot & Load -9
      this.trainManager.stats.addHp(25);
      this.trainManager.discardModule(mod);
      this.juice.showFloatingText(450, 630, 'REPAIR BOT! (+25 HP)', '#2ecc71', '24px');
      this.audio.playRepair();
      this.eventBus.emit('FRIDGE_OPEN', { outcome: 'REPAIR_BOT', hpBonus: 25 });
    } else {
      // 25% Hostile Critter: HP -18, fridge disappears, releases Slot & Load -9
      this.trainManager.stats.takeDamage(18, 'fridge_critter');
      this.trainManager.discardModule(mod);
      this.juice.flashDamage();
      this.juice.showFloatingText(450, 630, 'CRITTER ATTACK! (-18 HP)', '#e74c3c', '24px');
      this.eventBus.emit('FRIDGE_OPEN', { outcome: 'HOSTILE', damage: 18 });
    }
  }

  private resolveEgg(mod: any): void {
    // Section 30: Deterministic outcome based on unique outcomeSeed
    const itemSeed = (mod.data?.outcomeSeed || 88) + 1337;
    const mysteryRng = new SeededRandom(itemSeed);
    const roll = mysteryRng.nextFloat();

    if (roll < 0.60) {
      // 60% Friendly Creature: attacks nearest enemy every 0.9s for 4 dmg, stays on car
      mod.customData = { outcome: 'FRIENDLY', isCreature: true, attackTimer: 0 };
      this.juice.showFloatingText(450, 630, 'EGG HATCHED: FRIENDLY!', '#9b59b6', '24px');
      this.audio.playSheep();
      this.eventBus.emit('EGG_HATCH', { outcome: 'FRIENDLY' });
    } else {
      // 40% Hostile: HP -25, egg disappears, releases Slot & Load -7
      this.trainManager.stats.takeDamage(25, 'egg_hostile');
      this.trainManager.discardModule(mod);
      this.juice.flashDamage();
      this.juice.showFloatingText(450, 630, 'HOSTILE BEAST! (-25 HP)', '#e74c3c', '24px');
      this.eventBus.emit('EGG_HATCH', { outcome: 'HOSTILE', damage: 25 });
    }
  }
}
