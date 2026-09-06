export class EventBus {
    static instance;
    listeners = new Map();
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    off(event, callback) {
        const list = this.listeners.get(event);
        if (!list)
            return;
        const index = list.indexOf(callback);
        if (index !== -1) {
            list.splice(index, 1);
        }
    }
    emit(event, ...args) {
        const list = this.listeners.get(event);
        if (!list)
            return;
        // Copy array to prevent mutation issues during dispatch
        const callbacks = [...list];
        for (const cb of callbacks) {
            try {
                cb(...args);
            }
            catch (err) {
                console.error(`Error in event callback for "${event}":`, err);
            }
        }
    }
    clear() {
        this.listeners.clear();
    }
}
