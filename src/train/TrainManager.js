import { TrainCar } from './TrainCar';
import { TrainStatsManager } from './TrainStats';
import { PowerSystem } from './PowerSystem';
import { LoadSystem } from './LoadSystem';
import { EventBus } from '../core/EventBus';
import { AudioManager } from '../fx/AudioManager';
import balanceData from '../data/balance.json';
export class TrainManager {
    scene;
    cars = [];
    stats;
    power;
    load;
    eventBus;
    particles;
    audio;
    rootX;
    rootY;
    flatCarCount = 0;
    discardedCount = 0;
    hoveredModule = null;
    tooltipText = null;
    tooltipBg = null;
    constructor(scene, particles) {
        this.scene = scene;
        this.particles = particles;
        this.audio = AudioManager.getInstance();
        this.eventBus = EventBus.getInstance();
        this.stats = new TrainStatsManager();
        this.power = new PowerSystem();
        this.load = new LoadSystem();
        this.rootX = 1920 * balanceData.train.startXPercent + 120; // Locomotive front
        this.rootY = balanceData.depth.trackY - 2;
        this.initTrain();
        this.createTooltipUI();
    }
    initTrain() {
        // Tail <- Cargo (2) - Crane (1) - Locomotive (0) -> Front
        this.addCar('locomotive', 0);
        this.addCar('crane', 1);
        this.addCar('cargo', 2);
        this.repositionCars();
        this.recalculateAllStats();
    }
    addCar(type, index) {
        const car = new TrainCar(this.scene, type, index, (module) => this.discardModule(module), (module, screenX, screenY) => this.updateModuleTooltip(module, screenX, screenY));
        this.cars.push(car);
        return car;
    }
    repositionCars() {
        // Locomotive is at the front (rootX)
        let currentX = this.rootX;
        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            car.baseCarX = currentX;
            car.baseCarY = this.rootY;
            car.container.setPosition(car.baseCarX, car.baseCarY);
            currentX -= car.width - 6; // overlap couplers
        }
    }
    getCranePosition() {
        const craneCar = this.cars[1];
        return {
            x: craneCar.baseCarX,
            y: craneCar.baseCarY - 22,
        };
    }
    attachFlatCar(itemData) {
        if (this.flatCarCount >= balanceData.train.maxFlatCars) {
            return false;
        }
        this.flatCarCount++;
        const newCarIndex = this.cars.length;
        const newCar = this.addCar('flat', newCarIndex);
        this.repositionCars();
        this.recalculateAllStats();
        // Visual dip and particles
        newCar.dipOnInstall();
        this.particles.emitInstallBurst(newCar.baseCarX, newCar.baseCarY);
        this.audio.playInstall();
        this.eventBus.emit('CAR_ATTACHED', {
            carIndex: newCarIndex,
            totalCars: this.cars.length,
            flatCars: this.flatCarCount,
        });
        this.updateCameraFraming();
        return true;
    }
    updateCameraFraming() {
        // Section 106: camera framing based on car count
        const cam = this.scene.cameras.main;
        let targetZoom = 1.0;
        if (this.cars.length >= 6) {
            targetZoom = 0.88;
        }
        else if (this.cars.length >= 4) {
            targetZoom = 0.94;
        }
        this.scene.tweens.add({
            targets: cam,
            zoom: targetZoom,
            duration: 600,
            ease: 'Quad.easeInOut',
        });
    }
    hasSlotFor(item) {
        if (item.type === 'Consumable')
            return true;
        if (item.type === 'Car') {
            return this.flatCarCount < balanceData.train.maxFlatCars;
        }
        const slotType = item.slot;
        if (!slotType)
            return false;
        for (const car of this.cars) {
            if (car.getAvailableSlot(slotType)) {
                return true;
            }
        }
        return false;
    }
    canFitLoad(item) {
        if (item.type === 'Consumable')
            return true;
        const weight = item.installLoad || item.load || 0;
        return this.load.canFitLoad(weight);
    }
    installItem(item, isTradeLine = false) {
        if (item.type === 'Car') {
            return this.attachFlatCar(item);
        }
        if (!item.slot)
            return false;
        // Search from front to back for the first compatible empty slot (Section 21)
        for (const car of this.cars) {
            const slot = car.getAvailableSlot(item.slot);
            if (slot) {
                const module = {
                    uid: 'mod_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
                    itemId: item.id,
                    data: item,
                    carIndex: car.carIndex,
                    slotType: item.slot,
                    installedTime: this.scene.time.now,
                    fromTradeLine: isTradeLine,
                    stateTimer: 0,
                };
                const success = car.installModule(module);
                if (success) {
                    car.dipOnInstall();
                    this.particles.emitInstallBurst(car.baseCarX + slot.relativeX, car.baseCarY + slot.relativeY);
                    this.audio.playInstall();
                    this.recalculateAllStats();
                    return true;
                }
            }
        }
        return false;
    }
    discardModule(module) {
        const car = this.cars[module.carIndex];
        if (!car)
            return;
        const removed = car.removeModule(module.uid);
        if (removed) {
            this.discardedCount++;
            this.audio.playDiscard();
            // Launch physical discarded object flying out (Section 51)
            this.spawnDiscardedVisual(car.baseCarX, car.baseCarY - 15, module.itemId);
            // Check if discarded item is explosive barrel (Section 47)
            if (module.itemId === 'explosive') {
                this.eventBus.emit('ITEM_DISCARDED_EXPLOSIVE', {
                    x: car.baseCarX - 30,
                    y: car.baseCarY + 10,
                });
            }
            this.eventBus.emit('ITEM_DISCARDED', {
                item: module.itemId,
                time: this.scene.time.now * 0.001,
                reasonContext: {
                    currentLoad: this.load.getCurrentLoad(),
                    maxLoad: this.load.getMaxLoad(),
                    fuel: this.stats.fuel,
                    powerSupply: this.power.getSupply(),
                    powerDemand: this.power.getDemand(),
                },
            });
            this.recalculateAllStats();
        }
    }
    spawnDiscardedVisual(startX, startY, itemId) {
        const discardSprite = this.scene.add.container(startX, startY);
        discardSprite.setDepth(27);
        const g = this.scene.add.graphics();
        g.fillStyle(0x7f8c8d, 0.9);
        g.fillCircle(0, 0, 10);
        discardSprite.add(g);
        // Parabolic fling backwards onto the ground
        this.scene.tweens.add({
            targets: discardSprite,
            x: startX - 180,
            y: startY + 45,
            angle: 360,
            duration: 650,
            ease: 'Quad.easeOut',
            onComplete: () => {
                // Slide on ground and fade out over 2.5s (Section 51)
                this.scene.tweens.add({
                    targets: discardSprite,
                    x: discardSprite.x - 300,
                    alpha: 0,
                    duration: 2200,
                    ease: 'Linear',
                    onComplete: () => {
                        discardSprite.destroy();
                    },
                });
            },
        });
    }
    recalculateAllStats() {
        let installedLoad = 0;
        let batteries = 0;
        let turrets = 0;
        for (const car of this.cars) {
            for (const slot of car.slots) {
                if (slot.installedModule) {
                    const mod = slot.installedModule;
                    installedLoad += mod.data.load || 0;
                    if (mod.itemId === 'battery')
                        batteries++;
                    if (mod.itemId === 'turret')
                        turrets++;
                }
            }
        }
        this.power.recalculate(batteries, turrets);
        this.load.recalculate(installedLoad, this.flatCarCount);
    }
    getSurvivorCount() {
        let count = 0;
        for (const car of this.cars) {
            for (const slot of car.slots) {
                if (slot.installedModule && slot.installedModule.itemId === 'survivor') {
                    count++;
                }
            }
        }
        return count;
    }
    getAllInstalledModules() {
        const list = [];
        for (const car of this.cars) {
            for (const slot of car.slots) {
                if (slot.installedModule) {
                    list.push(slot.installedModule);
                }
            }
        }
        return list;
    }
    getAvailableSlotCount() {
        const counts = { TOP: 0, BODY: 0, SIDE: 0 };
        for (const car of this.cars) {
            for (const slot of car.slots) {
                if (!slot.isOccupied()) {
                    counts[slot.type]++;
                }
            }
        }
        return counts;
    }
    getCarCount() {
        return this.cars.length;
    }
    getFlatCarCount() {
        return this.flatCarCount;
    }
    getDiscardedCount() {
        return this.discardedCount;
    }
    aimTurretsAt(targetX, targetY) {
        for (const car of this.cars) {
            car.aimTurrets(targetX, targetY);
        }
    }
    update(time, delta, speed) {
        const powerEfficiency = this.power.getEfficiency();
        const hasShortage = this.power.hasShortage();
        // Update cars vibration and wheel animation
        for (const car of this.cars) {
            car.update(time, speed, powerEfficiency, hasShortage);
        }
        // Locomotive smoke & wheel dust particles
        if (speed > 10) {
            const loco = this.cars[0];
            this.particles.emitTrainSmoke(loco.baseCarX + 45, loco.baseCarY - 50);
            this.particles.emitWheelDust(loco.baseCarX - 30, loco.baseCarY + 30);
        }
    }
    createTooltipUI() {
        this.tooltipBg = this.scene.add.graphics();
        this.tooltipBg.setDepth(150);
        this.tooltipBg.setVisible(false);
        this.tooltipText = this.scene.add.text(0, 0, '', {
            fontFamily: 'Consolas, monospace',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
        });
        this.tooltipText.setDepth(151);
        this.tooltipText.setVisible(false);
    }
    updateModuleTooltip(module, screenX, screenY) {
        if (!module || !this.tooltipText || !this.tooltipBg) {
            if (this.tooltipText)
                this.tooltipText.setVisible(false);
            if (this.tooltipBg)
                this.tooltipBg.setVisible(false);
            this.hoveredModule = null;
            return;
        }
        this.hoveredModule = module;
        const desc = module.data.description || module.data.name;
        const textStr = `${desc}\n[Right Click: DISCARD]`;
        this.tooltipText.setText(textStr);
        this.tooltipText.setPosition(screenX + 15, screenY - 45);
        this.tooltipText.setVisible(true);
        const bounds = this.tooltipText.getBounds();
        this.tooltipBg.clear();
        this.tooltipBg.fillStyle(0x1a252f, 0.9);
        this.tooltipBg.fillRoundedRect(bounds.x - 6, bounds.y - 4, bounds.width + 12, bounds.height + 8, 4);
        this.tooltipBg.lineStyle(1.5, 0xe74c3c, 1);
        this.tooltipBg.strokeRoundedRect(bounds.x - 6, bounds.y - 4, bounds.width + 12, bounds.height + 8, 4);
        this.tooltipBg.setVisible(true);
    }
}
