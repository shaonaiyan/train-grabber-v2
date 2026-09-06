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

    this.container = scene.add.container(20, 100);
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
    bg.fillStyle(0x0a0e14, 0.94);
    bg.fillRoundedRect(0, 0, 780, 580, 8);
    bg.lineStyle(2, 0x00ffff, 1);
    bg.strokeRoundedRect(0, 0, 780, 580, 8);
    this.container.add(bg);

    const title = this.scene.add.text(20, 12, '🛠️ DEBUG SYSTEM PANEL [F1]', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00ffff',
    });
    this.container.add(title);

    // Left Column: Real-time Stats Display (Section 88)
    this.debugStatsText = this.scene.add.text(20, 45, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      color: '#ecf0f1',
      lineSpacing: 4,
    });
    this.container.add(this.debugStatsText);

    // Right Column: Interactive Buttons (Section 87)
    let btnX = 390;
    let btnY = 45;

    const createBtn = (label: string, onClick: () => void, color: number = 0x2980b9) => {
      const bCont = this.scene.add.container(btnX, btnY);
      const bG = this.scene.add.graphics();
      bG.fillStyle(color, 1);
      bG.fillRoundedRect(0, 0, 115, 26, 4);
      bG.lineStyle(1, 0xffffff, 0.6);
      bG.strokeRoundedRect(0, 0, 115, 26, 4);

      const bTxt = this.scene.add.text(57, 13, label, {
        fontFamily: 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
      });
      bTxt.setOrigin(0.5);

      const hit = this.scene.add.rectangle(57, 13, 115, 26, 0x000000, 0.001);
      hit.setInteractive({ cursor: 'pointer' });
      hit.on('pointerdown', onClick);

      bCont.add([bG, bTxt, hit]);
      this.container.add(bCont);
      btnX += 125;
      if (btnX > 720) {
        btnX = 390;
        btnY += 32;
      }
    };

    // Row 1: Flow Controls
    createBtn('Pause/Resume', () => {
      this.isPaused = !this.isPaused;
    });
    createBtn('Speed x0.5', () => (this.timeScale = 0.5));
    createBtn('Speed x1.0', () => (this.timeScale = 1.0));
    createBtn('Speed x2.0', () => (this.timeScale = 2.0));

    // Row 2: Train Cheats
    createBtn('HP +20', () => this.trainManager.stats.addHp(20), 0x27ae60);
    createBtn('Fuel +20', () => this.trainManager.stats.addFuel(20), 0xd35400);
    createBtn('Power +3', () => {
      // Add virtual battery to boost power
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

    // Row 3: Phase Jump
    btnX = 390;
    btnY += 34;
    const phases = ['Tutorial', 'Bandit', 'Dryland', 'Trade', 'Hazard', 'Final'];
    phases.forEach((pName, idx) => {
      createBtn(pName, () => {
        const targetTimes = [0, 46, 151, 251, 361, 451];
        (this.scene as any).currentTime = targetTimes[idx];
        EventBus.getInstance().emit('PHASE_CHANGE', {
          phaseId: idx,
          name: pName,
          banner: `JUMPED TO: ${pName.toUpperCase()}`,
        });
      }, 0x7f8c8d);
    });

    // Row 4: Spawning Entities
    btnX = 390;
    btnY += 34;
    createBtn('+ Bandit', () => (this.enemyManager as any).spawnBandit(), 0xc0392b);
    createBtn('+ Drone', () => (this.enemyManager as any).spawnDrone(), 0xd35400);
    createBtn('Overlays', () => (this.showOverlays = !this.showOverlays), 0x34495e);

    // Row 5: Spawn Individual Items
    btnX = 390;
    btnY += 34;
    const itemIds: ItemId[] = [
      'parts', 'fuel', 'gold', 'turret', 'battery', 'flat_car',
      'sheep', 'survivor', 'fridge', 'egg', 'explosive', 'junk'
    ];
    itemIds.forEach((id) => {
      createBtn(`+ ${id}`, () => {
        const item = this.itemFactory.spawnWorldItem(1800, 520, id, 'near');
        this.allWorldItems.push(item);
      }, 0x2c3e50);
    });

    // Row 6: Spawn Opportunity Groups A ~ L
    btnX = 390;
    btnY += 34;
    const oppLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    oppLetters.forEach((letter) => {
      createBtn(`Group ${letter}`, () => {
        const grp = (this.director as any).groups[letter];
        if (grp) {
          this.director.spawnWindowWithItems(
            `debug_${letter}_${Date.now()}`,
            letter,
            grp.name,
            grp.items,
            this.scene.time.now * 0.001,
            4.0,
            this.allWorldItems
          );
        }
      }, 0xd35400);
    });

    // Force Win / Fail
    btnX = 390;
    btnY += 34;
    createBtn('Force WIN', () => EventBus.getInstance().emit('RUN_WIN'), 0x27ae60);
    createBtn('Force FAIL', () => EventBus.getInstance().emit('RUN_FAIL', { reason: 'FAIL_HP' }), 0xc0392b);
  }

  public update(timeSec: number, phaseId: number, phaseName: string): void {
    if (!this.isVisible) return;

    const stats = this.trainManager.stats;
    const power = this.trainManager.power;
    const load = this.trainManager.load;
    const hookState = this.grapple.getState();
    const latched = this.grapple.getLatchedItem();
    const activeWin = this.director.getActiveWindow();

    const info = [
      `FPS: ${Math.round(this.scene.game.loop.actualFps)}`,
      `Seed: ${this.seed}`,
      `Time: ${timeSec.toFixed(1)}s (x${this.timeScale})`,
      `Phase: ${phaseId} - ${phaseName}`,
      `Hook State: ${hookState}`,
      `Hook Target: ${latched ? latched.data.id : 'None'}`,
      `HP: ${Math.ceil(stats.hp)} / ${stats.maxHp}`,
      `Fuel: ${Math.ceil(stats.fuel)} / ${stats.maxFuel}`,
      `Load: ${load.getCurrentLoad()} / ${load.getMaxLoad()} (${(load.getLoadRatio() * 100).toFixed(0)}%)`,
      `Power: ${power.getSupply()} / ${power.getDemand()} (Eff: ${(power.getEfficiency() * 100).toFixed(0)}%)`,
      `Cars: ${this.trainManager.getCarCount()} (Flat: ${this.trainManager.getFlatCarCount()})`,
      `Discarded: ${this.trainManager.getDiscardedCount()}`,
      `Active Window: ${activeWin ? activeWin.windowId : 'None'}`,
      `World Items: ${this.allWorldItems.filter((i) => !i.isDestroyed).length}`,
      `Enemies: ${this.enemyManager.enemies.length}`,
    ];

    this.debugStatsText.setText(info.join('\n'));

    // Visual overlays (hitboxes, bands)
    if (this.showOverlays) {
      this.renderOverlays();
    }
  }

  private renderOverlays(): void {
    const g = this.overlayGraphics;
    g.clear();

    // Depth bands lines
    g.lineStyle(1, 0x00ffff, 0.4);
    g.lineBetween(0, 330, 1920, 330);
    g.lineBetween(0, 420, 1920, 420);
    g.lineBetween(0, 530, 1920, 530);
    g.lineBetween(0, 640, 1920, 640);
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
