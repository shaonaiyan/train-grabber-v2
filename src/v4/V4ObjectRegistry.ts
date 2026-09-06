export type EntityTag =
  | 'METAL'
  | 'LIVING'
  | 'ELECTRONIC'
  | 'EXPLOSIVE'
  | 'HEAVY'
  | 'CARGO'
  | 'MODULE'
  | 'ENEMY'
  | 'PROJECTILE'
  | 'MAGNETIC'
  | 'HOOKABLE'
  | 'TRAIN_ATTACHED';

export interface HookContext {
  hookX: number;
  hookY: number;
  hookVx?: number;
  hookVy?: number;
  timeSec: number;
  trainPos?: { x: number; y: number };
}

export interface ImpactContext {
  target: any;
  relativeSpeed: number;
  hitX: number;
  hitY: number;
  damage?: number;
}

export interface HookableEntity {
  instanceId: string;
  typeId: string;
  name: string;

  canHook(): boolean;
  onHookLatch(ctx: HookContext): void;
  onHookPull(ctx: HookContext, dt: number): void;
  onHookRelease(ctx: HookContext): void;
  onDeliveredToTrain(trainManager: any): void;
  onImpact(ctx: ImpactContext): void;

  getHookWeight(): number;
  getInstalledWeight(): number;
  getLootValue(): number;
  getTags(): EntityTag[];
  hasTag(tag: EntityTag): boolean;

  getPosition(): { x: number; y: number };
  setPosition(x: number, y: number): void;
  getVelocity?(): { x: number; y: number };
  setVelocity?(vx: number, vy: number): void;

  isLatched(): boolean;
  isDelivered(): boolean;
  isDestroyed(): boolean;
  destroy(): void;

  update?(dt: number, worldSpeed: number): void;
}

export class V4ObjectRegistry {
  private static instance: V4ObjectRegistry;
  private entities: Map<string, HookableEntity> = new Map();

  public static getInstance(): V4ObjectRegistry {
    if (!V4ObjectRegistry.instance) {
      V4ObjectRegistry.instance = new V4ObjectRegistry();
    }
    return V4ObjectRegistry.instance;
  }

  public reset(): void {
    this.entities.clear();
  }

  public register(entity: HookableEntity): void {
    this.entities.set(entity.instanceId, entity);
  }

  public unregister(instanceId: string): void {
    this.entities.delete(instanceId);
  }

  public get(instanceId: string): HookableEntity | undefined {
    return this.entities.get(instanceId);
  }

  public getAll(): HookableEntity[] {
    return Array.from(this.entities.values()).filter((e) => !e.isDestroyed());
  }

  public getByTag(tag: EntityTag): HookableEntity[] {
    return this.getAll().filter((e) => e.hasTag(tag));
  }

  public getMagneticLooseEntities(): HookableEntity[] {
    return this.getAll().filter(
      (e) =>
        e.hasTag('METAL') &&
        e.hasTag('MAGNETIC') &&
        !e.hasTag('TRAIN_ATTACHED') &&
        !e.isLatched() &&
        !e.isDelivered() &&
        !e.isDestroyed()
    );
  }

  public getHookableTargets(): HookableEntity[] {
    return this.getAll().filter(
      (e) =>
        e.canHook() &&
        !e.isLatched() &&
        !e.isDelivered() &&
        !e.isDestroyed()
    );
  }

  public cleanDestroyed(): void {
    for (const [id, entity] of this.entities.entries()) {
      if (entity.isDestroyed()) {
        this.entities.delete(id);
      }
    }
  }
}
