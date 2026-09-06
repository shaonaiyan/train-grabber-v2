import Phaser from 'phaser';
import { SeededRandom } from '../core/SeededRandom';
import { V4_BALANCE } from './V4Balance';
import { V4Telemetry } from './V4Telemetry';
import { V4Audio } from '../v4/V4Audio';
import { ContinuousSalvageDirector } from './ContinuousSalvageDirector';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';

import { GoldSafeBehavior } from './behaviors/GoldSafeBehavior';
import { SheepBehavior } from './behaviors/SheepBehavior';
import { FridgeBehavior } from './behaviors/FridgeBehavior';
import { ExplosiveBarrelBehavior } from './behaviors/ExplosiveBarrelBehavior';
import { DroneBehavior } from './behaviors/DroneBehavior';
import { GiantMagnetBehavior } from './behaviors/GiantMagnetBehavior';
import { BanditJeepBehavior } from './behaviors/BanditJeepBehavior';
import { FlatCarEvent } from './behaviors/FlatCarEvent';

export class CoreSliceDirector {
  private scene: Phaser.Scene;
  private rng: SeededRandom;
  private continuousDirector: ContinuousSalvageDirector;
  private itemFactory: ItemFactory;
  private allWorldItems: WorldItem[];
  private telemetry: V4Telemetry;
  private audio: V4Audio;

  public isComplete: boolean = false;
  private triggeredTimestamps: Set<number> = new Set();
  private controlHintsText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    rng: SeededRandom,
    continuousDirector: ContinuousSalvageDirector,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[]
  ) {
    this.scene = scene;
    this.rng = rng;
    this.continuousDirector = continuousDirector;
    this.itemFactory = itemFactory;
    this.allWorldItems = allWorldItems;
    this.telemetry = V4Telemetry.getInstance();
    this.audio = V4Audio.getInstance();

    this.showControlsHint();
  }

  private showControlsHint(): void {
    this.controlHintsText = this.scene.add.text(
      960,
      820,
      'MOUSE — AIM    |    LEFT CLICK — GRAB    |    RIGHT CLICK — RELEASE / JETTISON',
      {
        fontFamily: 'Consolas, monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#00ffff',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      }
    );
    this.controlHintsText.setOrigin(0.5);
    this.controlHintsText.setDepth(150);

    // Fade out after 3.8s
    this.scene.tweens.add({
      targets: this.controlHintsText,
      alpha: 0,
      delay: 3800,
      duration: 800,
      onComplete: () => {
        if (this.controlHintsText) {
          this.controlHintsText.destroy();
          this.controlHintsText = null;
        }
      },
    });
  }

  public showHeroHint(title: string, sub: string): void {
    if (this.hintText) {
      this.hintText.destroy();
    }
    this.hintText = this.scene.add.text(960, 480, `${title}\n${sub}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
    });
    this.hintText.setOrigin(0.5);
    this.hintText.setDepth(150);

    this.scene.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: 1200,
      duration: 400,
      onComplete: () => {
        if (this.hintText) {
          this.hintText.destroy();
          this.hintText = null;
        }
      },
    });
  }

  public update(dt: number, timeSec: number, worldSpeed: number): void {
    if (this.isComplete) return;

    // Check fixed timeline milestones
    this.checkTimeline(timeSec, worldSpeed);

    // Update continuous stream
    this.continuousDirector.update(dt, timeSec, worldSpeed);

    // End at 90.0 seconds
    if (timeSec >= V4_BALANCE.TOTAL_DURATION_SEC) {
      this.triggerCoreSliceComplete();
    }
  }

  private checkTimeline(timeSec: number, worldSpeed: number): void {
    // 5.0s: Parts crate intro
    if (timeSec >= 5.0 && !this.triggeredTimestamps.has(5)) {
      this.triggeredTimestamps.add(5);
      this.continuousDirector.spawnSingleItem(2000, worldSpeed, 'parts');
    }

    // 15.0s: Hero 02 — Sheep
    if (timeSec >= 15.0 && !this.triggeredTimestamps.has(15)) {
      this.triggeredTimestamps.add(15);
      new SheepBehavior(this.scene, 2050, 580);
      this.showHeroHint('A SHEEP?', 'Looks friendly.');
    }

    // 20.0s: Hero 01 — Gold Safe + Fuel simultaneously
    if (timeSec >= 20.0 && !this.triggeredTimestamps.has(20)) {
      this.triggeredTimestamps.add(20);
      new GoldSafeBehavior(this.scene, 2050, 530);
      this.continuousDirector.spawnSingleItem(2130, worldSpeed, 'fuel');
      this.showHeroHint('HEAVY SAFE', 'Looks valuable. Really heavy.');
    }

    // 27.0s: Hero 03 — Mystery Fridge
    if (timeSec >= 27.0 && !this.triggeredTimestamps.has(27)) {
      this.triggeredTimestamps.add(27);
      new FridgeBehavior(this.scene, 2050, 570);
      this.showHeroHint('OLD FRIDGE', 'Something is inside...');
    }

    // 38.0s: Hero 05 — Hostile Drone
    if (timeSec >= 38.0 && !this.triggeredTimestamps.has(38)) {
      this.triggeredTimestamps.add(38);
      new DroneBehavior(this.scene, 2050, 380);
      this.continuousDirector.spawnSingleItem(2100, worldSpeed, 'fuel');
      this.continuousDirector.spawnSingleItem(2180, worldSpeed, 'junk');
      this.showHeroHint('INCOMING DRONE', 'Directly hookable!');
    }

    // 45.0s: Hero 04 — Explosive Barrel + Drone 1.0s later
    if (timeSec >= 45.0 && !this.triggeredTimestamps.has(45)) {
      this.triggeredTimestamps.add(45);
      new ExplosiveBarrelBehavior(this.scene, 2050, 580);
      this.scene.time.delayedCall(1000, () => {
        new DroneBehavior(this.scene, 2050, 400);
      });
      this.showHeroHint('EXPLOSIVE BARREL', 'Right-click to jettison throw.');
    }

    // 52.0s: Density Surge
    if (timeSec >= 52.0 && !this.triggeredTimestamps.has(52)) {
      this.triggeredTimestamps.add(52);
      this.continuousDirector.setDensityMultiplier(1.25);
      this.scene.time.delayedCall(5000, () => {
        this.continuousDirector.setDensityMultiplier(1.0);
      });
    }

    // 55.0s: Hero 08 — Flat Car on side track
    if (timeSec >= 55.0 && !this.triggeredTimestamps.has(55)) {
      this.triggeredTimestamps.add(55);
      new FlatCarEvent(this.scene, 2100, 690);
      // Extra loot nearby to force the choice
      this.continuousDirector.spawnSingleItem(2150, worldSpeed, 'gold_safe_v4');
      this.continuousDirector.spawnSingleItem(2220, worldSpeed, 'fuel');
      this.showHeroHint('ABANDONED FLAT CAR', 'Heavy pull! Couples to train.');
    }

    // 63.0s: Hero 06 — Giant Magnet
    if (timeSec >= 63.0 && !this.triggeredTimestamps.has(63)) {
      this.triggeredTimestamps.add(63);
      new GiantMagnetBehavior(this.scene, 2050, 580);
      // Ensure metal & explosive are nearby
      this.continuousDirector.spawnSingleItem(2120, worldSpeed, 'junk');
      this.continuousDirector.spawnSingleItem(2190, worldSpeed, 'explosive_v4');
      this.continuousDirector.spawnSingleItem(2260, worldSpeed, 'gold_safe_v4');
      this.showHeroHint('INDUSTRIAL MAGNET', 'Attracts metal. Beware explosives!');
    }

    // 71.0s: Hero 07 — Bandit Jeep
    if (timeSec >= 71.0 && !this.triggeredTimestamps.has(71)) {
      this.triggeredTimestamps.add(71);
      new BanditJeepBehavior(this.scene, 2100, 610);
      this.continuousDirector.spawnSingleItem(2160, worldSpeed, 'fuel');
      this.continuousDirector.spawnSingleItem(2230, worldSpeed, 'sheep_v4');
      this.showHeroHint('BANDIT TECHNICAL', 'Hook the roof gun to tear it off!');
    }

    // 78.0s: CHAOS BURST
    if (timeSec >= 78.0 && !this.triggeredTimestamps.has(78)) {
      this.triggeredTimestamps.add(78);
      new DroneBehavior(this.scene, 2020, 390);
      new ExplosiveBarrelBehavior(this.scene, 2080, 590);
      new GoldSafeBehavior(this.scene, 2150, 520);
      new SheepBehavior(this.scene, 2220, 570);
      this.continuousDirector.spawnSingleItem(2290, worldSpeed, 'junk');
    }
  }

  // Section 13-14: 90s Complete Sequence:
  // 1.5s decelerate -> UI fades -> camera zooms out -> "YOUR TRAIN" view for 3s -> ResultScene
  public triggerCoreSliceComplete(): void {
    if (this.isComplete) return;
    this.isComplete = true;

    this.telemetry.result = 'COMPLETE';
    const trainMgr = (this.scene as any).trainManager;
    if (trainMgr) {
      this.telemetry.finalWeight = trainMgr.load.getCurrentLoad();
      this.telemetry.finalLootValue = trainMgr.getCargoValue();
    }

    // 1. Decelerate world scroller
    if ((this.scene as any).worldScroller) {
      (this.scene as any).worldScroller.triggerStationArrival();
    }

    // 2. Hide HUD
    if ((this.scene as any).hud) {
      this.scene.tweens.add({
        targets: (this.scene as any).hud.container,
        alpha: 0,
        duration: 1000,
      });
    }

    // 3. Camera subtle zoom out
    this.scene.tweens.add({
      targets: this.scene.cameras.main,
      zoom: 0.94,
      duration: 1500,
      ease: 'Quad.easeInOut',
    });

    // 4. "YOUR TRAIN" showcase text
    const showcaseText = this.scene.add.text(960, 220, 'YOUR TRAIN', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#00ffff',
      stroke: '#000000',
      strokeThickness: 8,
      align: 'center',
    });
    showcaseText.setOrigin(0.5);
    showcaseText.setDepth(160);
    showcaseText.setAlpha(0);

    const subText = this.scene.add.text(960, 280, '90-SECOND CORE SLICE COMPLETE', {
      fontFamily: 'Consolas, monospace',
      fontSize: '22px',
      color: '#bdc3c7',
      stroke: '#000000',
      strokeThickness: 4,
    });
    subText.setOrigin(0.5);
    subText.setDepth(160);
    subText.setAlpha(0);

    this.scene.tweens.add({
      targets: [showcaseText, subText],
      alpha: 1,
      duration: 800,
      delay: 500,
    });

    // 5. Hold for 3.0s, then transition to ResultScene
    this.scene.time.delayedCall(3800, () => {
      this.scene.scene.start('ResultScene', {
        mode: 'v4',
        seed: this.telemetry.seed,
        telemetry: this.telemetry.exportJSON(),
      });
    });
  }
}
