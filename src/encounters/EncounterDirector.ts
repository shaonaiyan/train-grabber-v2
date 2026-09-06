import Phaser from 'phaser';
import { EncounterDefinition, EncounterRecord } from '../core/Types';
import { EventBus } from '../core/EventBus';
import encountersData from '../data/encounters_v3.json';

export class EncounterDirector {
  private scene: Phaser.Scene;
  private eventBus: EventBus;
  private encountersMap: Map<string, EncounterDefinition> = new Map();
  private triggeredEncounters: Set<string> = new Set();

  public activeEncounter: EncounterRecord | null = null;
  public completedEncounters: EncounterRecord[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    for (const enc of (encountersData as any).encounters) {
      this.encountersMap.set(enc.id, enc);
    }

    this.setupListeners();
  }

  private setupListeners(): void {
    this.eventBus.on('JOURNEY_TRIGGER_ENCOUNTER', (data: { encounterId: string; distanceM: number }) => {
      this.triggerEncounter(data.encounterId, data.distanceM);
    });

    // Listen to damage taken during encounter
    this.eventBus.on('TRAIN_DAMAGE', (data: { amount: number }) => {
      if (this.activeEncounter) {
        this.activeEncounter.damageTaken += data.amount;
      }
    });

    // Listen to turret damage
    this.eventBus.on('TURRET_DAMAGE_DEALT', (data: { damage: number }) => {
      if (this.activeEncounter) {
        this.activeEncounter.turretDamageDealt += data.damage;
      }
    });

    // Listen to enemy killed
    this.eventBus.on('ENEMY_KILLED', () => {
      if (this.activeEncounter) {
        this.activeEncounter.kills++;
        this.checkEncounterCompletion();
      }
    });

    // Listen to enemy escaped
    this.eventBus.on('ENEMY_ESCAPED', () => {
      if (this.activeEncounter) {
        this.activeEncounter.escapedEnemies++;
        this.checkEncounterCompletion();
      }
    });
  }

  public reset(): void {
    this.triggeredEncounters.clear();
    this.activeEncounter = null;
    this.completedEncounters = [];
  }

  public triggerEncounter(encounterId: string, currentDistanceM: number): void {
    if (this.triggeredEncounters.has(encounterId)) return;
    this.triggeredEncounters.add(encounterId);

    const def = this.encountersMap.get(encounterId);
    if (!def) return;

    const runTime = (this.scene as any).runTimeSec || 0;
    const trainMgr = (this.scene as any).trainManager;

    const turretCount = trainMgr
      ? trainMgr.getAllInstalledModules().filter((m: any) => m.itemId === 'turret').length
      : 0;
    const batteryCount = trainMgr
      ? trainMgr.getAllInstalledModules().filter((m: any) => m.itemId === 'battery').length
      : 0;
    const powerEff = trainMgr ? trainMgr.power.getEfficiency() : 1.0;

    // Section 112: Encounter Telemetry initialization
    this.activeEncounter = {
      encounterId: def.id,
      startTime: runTime,
      startDistance: currentDistanceM,
      enemyTypes: def.enemies.map((e) => e.type),
      enemyCount: def.enemies.length,
      turretCountAtStart: turretCount,
      batteryCountAtStart: batteryCount,
      powerEfficiencyAtStart: powerEff,
      damageTaken: 0,
      turretDamageDealt: 0,
      kills: 0,
      escapedEnemies: 0,
    };

    this.eventBus.emit('ENCOUNTER_START', {
      encounterId: def.id,
      displayName: def.displayName,
      distanceM: currentDistanceM,
    });

    // Spawn enemies with specified delays
    for (const enemyDef of def.enemies) {
      if (enemyDef.delaySec <= 0) {
        this.eventBus.emit('SPAWN_ENEMY_DIRECT', { type: enemyDef.type });
      } else {
        this.scene.time.delayedCall(enemyDef.delaySec * 1000, () => {
          this.eventBus.emit('SPAWN_ENEMY_DIRECT', { type: enemyDef.type });
        });
      }
    }
  }

  private checkEncounterCompletion(): void {
    if (!this.activeEncounter) return;

    const totalResolved = this.activeEncounter.kills + this.activeEncounter.escapedEnemies;
    if (totalResolved >= this.activeEncounter.enemyCount) {
      const runTime = (this.scene as any).runTimeSec || 0;
      const curDist = (this.scene as any).journeyDirector?.progress.distanceTravelledM || 0;

      this.activeEncounter.endTime = runTime;
      this.activeEncounter.endDistance = curDist;

      this.completedEncounters.push(this.activeEncounter);
      this.eventBus.emit('ENCOUNTER_END', { record: this.activeEncounter });
      this.activeEncounter = null;
    }
  }

  public update(): void {
    // Active encounter tracking is event-driven
  }
}
