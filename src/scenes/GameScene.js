import Phaser from 'phaser';
import { SeededRandom } from '../core/SeededRandom';
import { EventBus } from '../core/EventBus';
import { ParticleManager } from '../fx/Particles';
import { JuiceManager } from '../fx/JuiceManager';
import { AudioManager } from '../fx/AudioManager';
import { WorldScroller } from '../world/WorldScroller';
import { TrainManager } from '../train/TrainManager';
import { Grapple } from '../grapple/Grapple';
import { ItemFactory } from '../items/ItemFactory';
import { OpportunityDirector } from '../opportunity/OpportunityDirector';
import { EnemyManager } from '../enemies/EnemyManager';
import { ItemEffectSystem } from '../items/ItemEffectSystem';
import { HUD } from '../ui/HUD';
import { DebugPanel } from '../ui/DebugPanel';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import phasesData from '../data/phases.json';
import balanceData from '../data/balance.json';
export class GameScene extends Phaser.Scene {
    seed = 0;
    rng;
    eventBus;
    // Managers
    particles;
    juice;
    audio;
    worldScroller;
    trainManager;
    grapple;
    itemFactory;
    director;
    enemyManager;
    itemEffectSystem;
    hud;
    debugPanel;
    telemetry;
    // State
    currentTime = 0;
    currentPhaseId = 0;
    isStationArriving = false;
    isGameOver = false;
    allWorldItems = [];
    isUserPaused = false;
    pauseText = null;
    constructor() {
        super({ key: 'GameScene' });
    }
    init(data) {
        this.seed = data && data.seed !== undefined ? Number(data.seed) : Math.floor(Math.random() * 1000000);
        this.currentTime = 0;
        this.currentPhaseId = 0;
        this.isStationArriving = false;
        this.isGameOver = false;
        this.allWorldItems = [];
        this.isUserPaused = false;
    }
    create() {
        this.rng = new SeededRandom(this.seed);
        this.eventBus = EventBus.getInstance();
        this.eventBus.clear();
        // FX & Audio
        this.particles = new ParticleManager(this);
        this.juice = new JuiceManager(this);
        this.audio = AudioManager.getInstance();
        // World & Train
        this.worldScroller = new WorldScroller(this);
        this.trainManager = new TrainManager(this, this.particles);
        this.grapple = new Grapple(this, this.trainManager, this.particles, this.juice);
        // Items & Opportunities
        this.itemFactory = new ItemFactory(this);
        this.director = new OpportunityDirector(this, this.itemFactory, this.trainManager, this.rng);
        this.itemEffectSystem = new ItemEffectSystem(this, this.trainManager, this.rng, this.juice);
        // Enemies & Combat
        this.enemyManager = new EnemyManager(this, this.trainManager, this.rng, this.particles, this.juice);
        // HUD & Debug
        this.hud = new HUD(this, this.trainManager);
        this.debugPanel = new DebugPanel(this, this.trainManager, this.grapple, this.director, this.enemyManager, this.itemFactory, this.allWorldItems, this.seed);
        // Telemetry
        this.telemetry = TelemetryManager.getInstance();
        this.telemetry.init(this.seed, this.trainManager);
        this.setupInput();
        this.setupGameEvents();
        // Initial tutorial banner
        this.hud.showPhaseBanner(phasesData.phases[0].banner);
    }
    setupInput() {
        // Disable right-click browser menu
        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        // Pointer controls (Section 24)
        this.input.on('pointerdown', (pointer) => {
            if (this.isGameOver || this.isUserPaused || this.debugPanel.isPaused)
                return;
            if (pointer.leftButtonDown()) {
                // Left click: fire grapple hook
                this.grapple.fire(pointer.worldX, pointer.worldY, this.allWorldItems);
            }
            else if (pointer.rightButtonDown()) {
                // Right click: release hook target if busy
                this.grapple.release();
            }
        });
        // Pause toggle with ESC (Section 24)
        this.input.keyboard?.on('keydown-ESC', () => {
            this.toggleUserPause();
        });
        // F2 to export run data directly (Section 97)
        this.input.keyboard?.on('keydown-F2', (evt) => {
            evt.preventDefault();
            this.telemetry.exportDataToFile();
        });
    }
    toggleUserPause() {
        this.isUserPaused = !this.isUserPaused;
        if (this.isUserPaused) {
            this.pauseText = this.add.text(960, 540, 'PAUSED [ESC to Resume]', {
                fontFamily: 'Arial',
                fontSize: '36px',
                fontStyle: 'bold',
                color: '#f1c40f',
                stroke: '#000000',
                strokeThickness: 6,
            });
            this.pauseText.setOrigin(0.5);
            this.pauseText.setDepth(400);
        }
        else {
            if (this.pauseText) {
                this.pauseText.destroy();
                this.pauseText = null;
            }
        }
    }
    setupGameEvents() {
        this.eventBus.on('RUN_FAIL', (data) => {
            if (this.isGameOver)
                return;
            this.isGameOver = true;
            this.telemetry.setRunOutcome(data.reason);
            this.juice.showFloatingText(960, 500, 'TRAIN CRITICAL FAILURE!', '#e74c3c', '44px');
            this.audio.playWarning();
            this.time.delayedCall(1800, () => {
                this.scene.start('ResultScene', { seed: this.seed, telemetry: this.telemetry });
            });
        });
        this.eventBus.on('RUN_WIN', () => {
            this.triggerWinSequence();
        });
    }
    triggerWinSequence() {
        if (this.isGameOver)
            return;
        this.isGameOver = true;
        this.isStationArriving = true;
        this.worldScroller.triggerStationArrival();
        this.telemetry.setRunOutcome('WIN');
        // Section 74: Show YOUR TRAIN showcase
        const yourTrainText = this.add.text(960, 240, 'YOUR TRAIN', {
            fontFamily: 'Arial',
            fontSize: '52px',
            fontStyle: 'bold',
            color: '#00ffcc',
            stroke: '#000000',
            strokeThickness: 8,
        });
        yourTrainText.setOrigin(0.5);
        yourTrainText.setDepth(350);
        // Zoom out slightly to admire the whole train for 2.0s
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 0.82,
            duration: 1200,
            ease: 'Quad.easeOut',
        });
        // After 2.2 seconds, slide in the Result UI
        this.time.delayedCall(2200, () => {
            this.scene.start('ResultScene', { seed: this.seed, telemetry: this.telemetry });
        });
    }
    update(time, delta) {
        // Check hit stop
        if (this.juice.update(delta)) {
            return;
        }
        if (this.isUserPaused || this.debugPanel.isPaused) {
            return;
        }
        const timeScale = this.debugPanel.timeScale;
        const scaledDelta = delta * timeScale;
        const dt = scaledDelta * 0.001;
        if (!this.isGameOver) {
            this.currentTime += dt;
        }
        // 1. Check Phases (0 to 5, Section 56-73)
        this.updatePhases();
        // 2. Calculate Train Fuel Drain and Speed
        const currentPhase = phasesData.phases[this.currentPhaseId];
        const fuelDrainRate = this.trainManager.stats.calculateFuelDrain(this.trainManager.getFlatCarCount(), this.trainManager.getSurvivorCount(), this.trainManager.load.getFuelMultiplier(), currentPhase ? currentPhase.fuelDrainMultiplier : 1.0);
        if (!this.isGameOver) {
            this.trainManager.stats.update(dt, fuelDrainRate);
        }
        // 3. World Scrolling
        const baseSpeed = balanceData.train.baseWorldSpeed;
        const loadSpeedMul = this.trainManager.load.getSpeedMultiplier();
        const phaseSpeedMul = currentPhase ? currentPhase.speedMultiplier : 1.0;
        const worldSpeed = this.worldScroller.update(scaledDelta, baseSpeed, loadSpeedMul * phaseSpeedMul, this.trainManager.stats.isOutOfFuel);
        // 4. Update Train visuals
        this.trainManager.update(time, scaledDelta, worldSpeed);
        // 5. Update World Items
        for (let i = this.allWorldItems.length - 1; i >= 0; i--) {
            const item = this.allWorldItems[i];
            item.update(dt, worldSpeed);
            if (item.isDestroyed) {
                this.allWorldItems.splice(i, 1);
            }
        }
        // 6. Update Grapple Hook
        this.grapple.update(scaledDelta, this.allWorldItems);
        // 7. Update Opportunities
        if (!this.isGameOver && !this.isStationArriving) {
            this.director.update(time, scaledDelta, this.currentPhaseId, this.allWorldItems);
        }
        // 8. Update Combat & Enemies
        this.enemyManager.update(time, scaledDelta, this.currentPhaseId, worldSpeed);
        // 9. Update Installed Modules abilities
        this.itemEffectSystem.update(scaledDelta);
        // 10. Update HUD & Debug
        const phaseName = currentPhase ? currentPhase.name : 'Finished';
        this.hud.update(this.currentTime, this.currentPhaseId, phaseName);
        this.debugPanel.update(this.currentTime, this.currentPhaseId, phaseName);
        // 11. Audio train rhythm
        this.audio.updateTrainRhythm(scaledDelta, worldSpeed / baseSpeed);
        // 12. Telemetry
        this.telemetry.update(scaledDelta, this.enemyManager.enemies.length);
        // 13. Check 480s Arrival (Section 73)
        if (this.currentTime >= phasesData.totalDuration && !this.isStationArriving && !this.isGameOver) {
            this.triggerWinSequence();
        }
    }
    updatePhases() {
        const phases = phasesData.phases;
        for (let i = phases.length - 1; i >= 0; i--) {
            const p = phases[i];
            if (this.currentTime >= p.startTime) {
                if (this.currentPhaseId !== p.id) {
                    this.currentPhaseId = p.id;
                    this.eventBus.emit('PHASE_CHANGE', {
                        phaseId: p.id,
                        name: p.name,
                        banner: p.banner,
                    });
                }
                break;
            }
        }
    }
}
