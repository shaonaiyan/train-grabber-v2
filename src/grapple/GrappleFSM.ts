import { HookState } from '../core/Types';
import { EventBus } from '../core/EventBus';

export class GrappleFSM {
  private currentState: HookState = 'IDLE';
  private eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  public getState(): HookState {
    return this.currentState;
  }

  public setState(nextState: HookState, context?: any): void {
    if (this.currentState === nextState) return;

    const prevState = this.currentState;
    this.currentState = nextState;

    this.eventBus.emit('HOOK_STATE_CHANGE', {
      from: prevState,
      to: nextState,
      context,
    });
  }

  public isIdle(): boolean {
    return this.currentState === 'IDLE' || this.currentState === 'AIM';
  }

  public isBusy(): boolean {
    return !this.isIdle();
  }
}
