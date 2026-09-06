import { JourneyProgress } from './JourneyProgress';
import { JourneyBeat, JourneySegment } from '../core/Types';
import { EventBus } from '../core/EventBus';
import journeyData from '../data/journey_v3.json';

export class JourneyDirector {
  public progress: JourneyProgress;
  private beats: JourneyBeat[];
  private segments: JourneySegment[];
  private triggeredBeats: Set<string> = new Set();
  private activeSegments: Set<string> = new Set();
  private eventBus: EventBus;

  // Milestone triggers
  private hasTriggeredHaven4300: boolean = false;
  private hasTriggeredHaven4600: boolean = false;
  private hasTriggeredHaven4750: boolean = false;

  constructor() {
    this.progress = new JourneyProgress();
    this.beats = (journeyData as any).beats;
    this.segments = (journeyData as any).segments;
    this.eventBus = EventBus.getInstance();
  }

  public reset(targetDistanceM?: number): void {
    this.progress.reset(targetDistanceM);
    this.triggeredBeats.clear();
    this.activeSegments.clear();
    this.hasTriggeredHaven4300 = false;
    this.hasTriggeredHaven4600 = false;
    this.hasTriggeredHaven4750 = false;
  }

  public update(dt: number, actualSpeedPx: number): void {
    this.progress.update(dt, actualSpeedPx);
    const dist = this.progress.distanceTravelledM;

    // 1. Check Segments
    for (const seg of this.segments) {
      const inSegment = dist >= seg.startDistanceM && dist < seg.endDistanceM;
      if (inSegment && !this.activeSegments.has(seg.id)) {
        this.activeSegments.add(seg.id);
        this.eventBus.emit('SEGMENT_ENTER', seg);
      } else if (!inSegment && this.activeSegments.has(seg.id)) {
        this.activeSegments.delete(seg.id);
        this.eventBus.emit('SEGMENT_EXIT', seg);
      }
    }

    // 2. Check Beats (Site & Encounter triggers)
    for (const beat of this.beats) {
      if (!this.triggeredBeats.has(beat.id)) {
        // Sites spawn when train distance reaches or approaches triggerDistanceM
        // For sites, we trigger at beat.distanceM
        if (dist >= beat.distanceM) {
          this.triggeredBeats.add(beat.id);
          this.dispatchBeat(beat);
        }
      }
    }

    // 3. Haven Milestones (Sections 94-97)
    if (dist >= 4300 && !this.hasTriggeredHaven4300) {
      this.hasTriggeredHaven4300 = true;
      this.eventBus.emit('HAVEN_MILESTONE_4300');
    }
    if (dist >= 4600 && !this.hasTriggeredHaven4600) {
      this.hasTriggeredHaven4600 = true;
      this.eventBus.emit('HAVEN_MILESTONE_4600');
    }
    if (dist >= 4750 && !this.hasTriggeredHaven4750) {
      this.hasTriggeredHaven4750 = true;
      this.eventBus.emit('HAVEN_SIGNAL_4750');
    }
  }

  private dispatchBeat(beat: JourneyBeat): void {
    switch (beat.type) {
      case 'site':
        this.eventBus.emit('JOURNEY_TRIGGER_SITE', { siteId: beat.id, distanceM: beat.distanceM });
        break;
      case 'encounter':
        this.eventBus.emit('JOURNEY_TRIGGER_ENCOUNTER', { encounterId: beat.id, distanceM: beat.distanceM });
        break;
      case 'segment_start':
        // Handled via segment loop
        break;
      case 'segment_end':
        // Handled via segment loop
        break;
      case 'haven':
        this.eventBus.emit('JOURNEY_ARRIVED_HAVEN', { distanceM: beat.distanceM });
        break;
    }
  }

  public getFuelMultiplier(): number {
    let mul = 1.0;
    for (const segId of this.activeSegments) {
      const seg = this.segments.find((s) => s.id === segId);
      if (seg) {
        mul *= seg.fuelDrainMultiplier;
      }
    }
    return mul;
  }

  public getActiveSegmentName(): string | null {
    for (const segId of this.activeSegments) {
      const seg = this.segments.find((s) => s.id === segId);
      if (seg) return seg.name;
    }
    return null;
  }
}
