import { JourneyBeat, JourneySegment } from '../core/Types';

export interface JourneyConfig {
  targetDistanceM: number;
  metersPerPixel: number;
  baseWorldSpeedPx: number;
  segments: JourneySegment[];
  beats: JourneyBeat[];
}
