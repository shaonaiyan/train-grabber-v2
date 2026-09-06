import { ItemId, OpportunityGroup } from '../core/Types';
import oppsConfig from '../data/opportunities.json';

export interface ActiveOpportunityWindowData {
  windowId: string;
  groupId: string;
  groupName: string;
  spawnTime: number;
  duration: number;
  items: ItemId[];
}

export class OpportunityConfigLoader {
  public static getGroups(): Record<string, OpportunityGroup> {
    return oppsConfig.groups as unknown as Record<string, OpportunityGroup>;
  }

  public static getWindowDurationRange(): [number, number] {
    return [oppsConfig.windowDurationMin, oppsConfig.windowDurationMax];
  }

  public static getWindowCooldownRange(): [number, number] {
    return [oppsConfig.windowCooldownMin, oppsConfig.windowCooldownMax];
  }
}
