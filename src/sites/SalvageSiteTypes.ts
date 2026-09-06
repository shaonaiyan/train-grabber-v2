import { ItemId, DepthBand } from '../core/Types';

export interface SitePropDefinition {
  type: string;
  offsetX: number;
  band: DepthBand;
}

export interface SiteLootDefinition {
  item: ItemId;
  offsetX: number;
  band: DepthBand;
}

export interface SalvageSiteDefinition {
  id: string;
  displayName: string;
  triggerDistanceM: number;
  lengthPx: number;
  visualTheme: string;
  isMajor?: boolean;
  props: SitePropDefinition[];
  loot: SiteLootDefinition[];
}
