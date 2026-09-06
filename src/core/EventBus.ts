type EventCallback = (...args: any[]) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: Map<string, EventCallback[]> = new Map();

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: EventCallback): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const index = list.indexOf(callback);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  public emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    // Copy array to prevent mutation issues during dispatch
    const callbacks = [...list];
    for (const cb of callbacks) {
      try {
        cb(...args);
      } catch (err) {
        console.error(`Error in event callback for "${event}":`, err);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
