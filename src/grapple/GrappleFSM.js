import { EventBus } from '../core/EventBus';
export class GrappleFSM {
    currentState = 'IDLE';
    eventBus;
    constructor() {
        this.eventBus = EventBus.getInstance();
    }
    getState() {
        return this.currentState;
    }
    setState(nextState, context) {
        if (this.currentState === nextState)
            return;
        const prevState = this.currentState;
        this.currentState = nextState;
        this.eventBus.emit('HOOK_STATE_CHANGE', {
            from: prevState,
            to: nextState,
            context,
        });
    }
    isIdle() {
        return this.currentState === 'IDLE' || this.currentState === 'AIM';
    }
    isBusy() {
        return !this.isIdle();
    }
}
