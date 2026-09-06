import Phaser from 'phaser';
import { TrainManager } from '../train/TrainManager';
import { Grapple } from '../grapple/Grapple';
import { OpportunityDirector } from '../opportunity/OpportunityDirector';
import { EnemyManager } from '../enemies/EnemyManager';
import { ItemFactory } from '../items/ItemFactory';
import { WorldItem } from '../items/WorldItem';
import { ItemId } from '../core/Types';
import { EventBus } from '../core/EventBus';

export class DebugPanel {
  private scene: Phaser.Scene;
  private trainManager: TrainManager;
  private grapple: Grapple;
  private director: OpportunityDirector;
  private enemyManager: EnemyManager;
  private itemFactory: ItemFactory;
  private allWorldItems: WorldItem[];
  private seed: number;

  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private debugStatsText!: Phaser.GameObjects.Text;
  private overlayGraphics: Phaser.GameObjects.Graphics;

  // Debug states
  public isPaused: boolean = false;
  public timeScale: number = 1.0;
  public ignoreLoadLimit: boolean = false;
  public showOverlays: boolean = false;
  public showInteractionZone: boolean = false;

  private adaptiveBtnText!: Phaser.GameObjects.Text;
  private worldLockBtnText!: Phaser.GameObjects.Text;
  private zoneBtnText!: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    trainManager: TrainManager,
    grapple: Grapple,
    director: OpportunityDirector,
    enemyManager: EnemyManager,
    itemFactory: ItemFactory,
    allWorldItems: WorldItem[],
    seed: number
  ) {
    this.scene = scene;
    this.trainManager = trainManager;
    this.grapple = grapple;
    this.director = director;
    this.enemyManager = enemyManager;
    this.itemFactory = itemFactory;
    this.allWorldItems = allWorldItems;
    this.seed = seed;

    this.container = scene.add.container(20, 60);
    this.container.setDepth(300);
    this.container.setVisible(false);

    this.overlayGraphics = scene.add.graphics();
    this.overlayGraphics.setDepth(290);

    this.buildPanelUI();

    // Toggle with F1
    scene.input.keyboard?.on('keydown-F1', (evt: KeyboardEvent) => {
      evt.preventDefault();
      this.toggle();
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
    if (!this.isVisible) {
      this.overlayGraphics.clear();
    }
  }

  private buildPanelUI(): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0e14, 0.95);
    bg.fillRoundedRect(0, 0, 840, 680, 8);
    bg.lineStyle(2, 0x00ffff, 1);
    bg.strokeRoundedRect(0, 0, 840, 680, 8);
    this.container.add(bg);

    const title = this.scene.add.text(20, 12, '🛠️ DEBUG SYSTEM PANEL [F1]', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00ffff',
    });
    this.container.add(title);

    // Left Column: Real-time Stats Display
    this.debugStatsText = this.scene.add.text(20, 42, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '12px',
      color: '#ecf0f1',
      lineSpacing: 3,
    });
    this.container.add(this.debugStatsText);

    // Right Column: Interactive Buttons
    let btnX = 390;
    let btnY = 42;

    const createBtn = (label: string, onClick: () => void, color: number = 0x2980b9) => {
      const bCont = this.scene.add.container(btnX, btnY);
      const bG = this.scene.add.graphics();
      bG.fillStyle(color, 1);
      bG.fillRoundedRect(0, 0, 102, 24, 4);
      bG.lineStyle(1, 0xffffff, 0.6);
      bG.strokeRoundedRect(0, 0, 102, 24, 4);

      const bTxt = this.scene.add.text(51, 12, label, {
        fontFamily: 'Arial',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      bTxt.setOrigin(0.5);

      const hit = this.scene.add.rectangle(51, 12, 102, 24, 0x000000, 0.001);
      hit.setInteractive({ cursor: 'pointer' });
      hit.on('pointerdown', onClick);

      bCont.add([bG, bTxt, hit]);
      this.container.add(bCont);

      btnX += 110;
      if (btnX > 790) {
        btnX = 390;
        btnY += 28;
      }
      return bTxt;
    };

    const nextRow = () => {
      btnX = 390;
      btnY += 30;
    };

    // Row 1: Flow Controls
    createBtn('Pause/Resume', () => {
      this.isPaused = !this.isPaused;
    });
    createBtn('Speed x0.5', () => (this.timeScale = 0.5));
    createBtn('Speed x1.0', () => (this.timeScale = 1.0));
    createBtn('Speed x2.0', () => (this.timeScale = 2.0));

    // Row 2: V2.1 Director & World Mode Toggles
    nextRow();
    this.adaptiveBtnText = createBtn(
      `Adaptive: ${this.director.isAdaptiveEnabled ? 'ON' : 'OFF'}`,
      () => {
        this.director.isAdaptiveEnabled = !this.director.isAdaptiveEnabled;
        this.adaptiveBtnText.setText(`Adaptive: ${this.director.isAdaptiveEnabled ? 'ON' : 'OFF'}`);
      },
      0x8e44ad
    );
    this.worldLockBtnText = createBtn(
      `WorldLock: ${this.director.isWorldLocked ? 'ON' : 'OFF'}`,
      () => {
        this.director.isWorldLocked = !this.director.isWorldLocked;
        this.worldLockBtnText.setText(`WorldLock: ${this.director.isWorldLocked ? 'ON' : 'OFF'}`);
      },
      0x16a085
    );
    this.zoneBtnText = createBtn(
      `ShowZone: ${this.showInteractionZone ? 'ON' : 'OFF'}`,
      () => {
        this.showInteractionZone = !this.showInteractionZone;
        this.zoneBtnText.setText(`ShowZone: ${this.showInteractionZone ? 'ON' : 'OFF'}`);
        if (!this.showInteractionZone && !this.showOverlays) {
          this.overlayGraphics.clear();
        }
      },
      0x2c3e50
    );
    createBtn('Overlays', () => {
      this.showOverlays = !this.showOverlays;
      if (!this.showOverlays && !this.showInteractionZone) {
        this.overlayGraphics.clear();
      }
    }, 0x34495e);

    // Row 3: Train Cheats
    nextRow();
    createBtn('HP +20', () => this.trainManager.stats.addHp(20), 0x27ae60);
    createBtn('Fuel +20', () => this.trainManager.stats.addFuel(20), 0xd35400);
    createBtn('Power +3', () => {
      const dummyData = this.itemFactory.getItemData('battery');
      this.trainManager.installItem(dummyData);
    }, 0x8e44ad);
    createBtn('Toggle MaxLoad', () => {
      this.ignoreLoadLimit = !this.ignoreLoadLimit;
      if (this.ignoreLoadLimit) {
        (this.trainManager.load as any).currentMaxLoad = 9999;
      } else {
        this.trainManager.recalculateAllStats();
      }
    }, 0x16a085);

    // Row 4: Phase Jump
    nextRow();
    const phases = ['Tutorial', 'Bandit', 'Dryland', 'Trade', 'Hazard', 'Final'];
    phases.forEach((pName, idx) => {
      createBtn(pName, () => {
        const targetTimes = [0, 56, 151, 251, 361, 451];
        (this.scene as any).runTimeSec = targetTimes[idx];
        EventBus.getInstance().emit('PHASE_CHANGE', {
          phaseId: idx,
          name: pName,
          banner: `JUMPED TO: ${pName.toUpperCase()}`,
        });
      }, 0x7f8c8d);
    });

    // Row 5: Spawning Entities
    nextRow();
    createBtn('+ Bandit', () => (this.enemyManager as any).spawnBandit(), 0xc0392b);
    createBtn('+ Drone', () => (this.enemyManager as any).spawnDrone(), 0xd35400);
    createBtn('Clear Enemies', () => {
      for (const e of this.enemyManager.enemies) {
        e.destroy();
      }
      this.enemyManager.enemies = [];
    }, 0x95a5a6);

    // Row 6: Spawn Individual Items
    nextRow();
    const itemIds: ItemId[] = [
      'parts', 'fuel', 'gold', 'turret', 'battery', 'flat_car',
      'sheep', 'survivor', 'fridge', 'egg', 'explosive', 'junk'
    ];
    itemIds.forEach((id) => {
      createBtn(`+ ${id}`, () => {
        const item = this.itemFactory.spawnWorldItem(1800, 560, id, 'near');
        this.allWorldItems.push(item);
      }, 0x2c3e50);
    });

    // Row 7: Spawn Opportunity Groups A ~ L
    nextRow();
    const oppLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    oppLetters.forEach((letter) => {
      createBtn(`Group ${letter}`, () => {
        const grp = (this.director as any).groups[letter];
        if (grp) {
          const runTime = (this.scene as any).runTimeSec || 0;
          this.director.spawnWindowWithItems(
            `debug_${letter}_${Date.now()}`,
            letter,
            grp.name,
            grp.items,
            runTime,
            4.0,
            this.allWorldItems
          );
        }
      }, 0xd35400);
    });

    // Force Win / Fail
    nextRow();
    createBtn('Force WIN', () => EventBus.getInstance().emit('RUN_WIN'), 0x27ae60);
    createBtn('Force FAIL', () => EventBus.getInstance().emit('RUN_FAIL', { reason: 'FAIL_HP' }), 0xc0392b);
  }

  public update(timeSec: number, phaseId: number, phaseName: string): void {
    if (!this.isVisible && !this.showInteractionZone && !this.showOverlays) return;

    if (this.isVisible) {
      const stats = this.trainManager.stats;
      const power = this.trainManager.power;
      const load = this.trainManager.load;
      const hookState = this.grapple.getState();
      const latched = this.grapple.getLatchedItem();
      const activeWin = this.director.getActiveWindow();
      const winState = activeWin
        ? (activeWin as any).hasStarted
          ? 'INTERACTING'
          : 'APPROACHING'
        : 'IDLE';

      const info = [
        `=== REAL-TIME METRICS ===`,
        `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
        `Seed: ${this.seed}`,
        `RunTime: ${timeSec.toFixed(1)}s (Scale: x${this.timeScale})`,
        `Phase: [${phaseId}] ${phaseName}`,
        `Cargo Value: $${this.trainManager.getCargoValue()}`,
        `Score Potential: ${Math.round(this.calculateScorePotential())}`,
        ``,
        `=== TRAIN STATUS ===`,
        `HP: ${Math.ceil(stats.hp)} / ${stats.maxHp}`,
        `Fuel: ${Math.ceil(stats.fuel)} / ${stats.maxFuel}`,
        `Load: ${load.getCurrentLoad()} / ${load.getMaxLoad()} (${(load.getLoadRatio() * 100).toFixed(0)}%)`,
        `Power: ${power.getSupply()} / ${power.getDemand()} (${(power.getEfficiency() * 100).toFixed(0)}%)`,
        `Cars: ${this.trainManager.getCarCount()} (Flat: ${this.trainManager.getFlatCarCount()})`,
        `Discarded Count: ${this.trainManager.getDiscardedCount()}`,
        ``,
        `=== GRAPPLE & WINDOWS ===`,
        `Hook State: ${hookState}`,
        `Hook Target: ${latched ? latched.data.id : 'None'}`,
        `Active Window: ${activeWin ? activeWin.windowId : 'None'}`,
        `Window State: ${winState}`,
        `World Items: ${this.allWorldItems.filter((i) => !i.isDestroyed).length}`,
        `Enemies: ${this.enemyManager.enemies.length}`,
        ``,
        `=== DIRECTOR CONFIG ===`,
        `Adaptive Director: ${this.director.isAdaptiveEnabled ? 'ON' : 'OFF'}`,
        `World Locked: ${this.director.isWorldLocked ? 'ON' : 'OFF'}`,
      ];

      this.debugStatsText.setText(info.join('\n'));
    }

    // Visual overlays (hitboxes, bands, interaction zone)
    if (this.showInteractionZone || this.showOverlays) {
      this.renderOverlays();
    }
  }

  private calculateScorePotential(): number {
    return 100 + this.trainManager.getCargoValue() * 1.5;
  }

  private renderOverlays(): void {
    const g = this.overlayGraphics;
    g.clear();

    // Render Interaction Zone (Section 20: enter ≈ 1150, exit ≈ 290)
    if (this.showInteractionZone || this.showOverlays) {
      // Zone boundary lines
      g.lineStyle(2, 0x2ecc71, 0.85);
      g.lineBetween(1150, 420, 1150, 750);

      g.lineStyle(2, 0xe74c3c, 0.85);
      g.lineBetween(290, 420, 290, 750);

      // Zone fill
      g.fillStyle(0x3498db, 0.08);
      g.fillRect(290, 420, 1150 - 290, 330);
    }

    if (this.showOverlays) {
      // Depth bands lines (V2.1: FAR 485-535, MID 535-595, NEAR 595-655, Track 710)
      g.lineStyle(1, 0x00ffff, 0.35);
      g.lineBetween(0, 485, 1920, 485);
      g.lineBetween(0, 535, 1920, 535);
      g.lineBetween(0, 595, 1920, 595);
      g.lineBetween(0, 655, 1920, 655);
      g.lineBetween(0, 710, 1920, 710);

      // World items hitboxes
      g.lineStyle(2, 0xffff00, 0.7);
      for (const item of this.allWorldItems) {
        if (!item.isDestroyed) {
          g.strokeCircle(item.container.x, item.container.y, 34);
        }
      }

      // Enemies hitboxes
      g.lineStyle(2, 0xff0000, 0.7);
      for (const enemy of this.enemyManager.enemies) {
        if (!enemy.isDead) {
          g.strokeRect(enemy.container.x - 25, enemy.container.y - 20, 50, 40);
        }
      }
    }
  }
}
