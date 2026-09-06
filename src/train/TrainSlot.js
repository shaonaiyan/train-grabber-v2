export class TrainSlot {
    type;
    relativeX;
    relativeY;
    installedModule = null;
    container = null;
    constructor(type, relativeX, relativeY) {
        this.type = type;
        this.relativeX = relativeX;
        this.relativeY = relativeY;
    }
    isOccupied() {
        return this.installedModule !== null;
    }
    install(module, visualContainer) {
        this.installedModule = module;
        this.container = visualContainer;
        this.container.setPosition(this.relativeX, this.relativeY);
    }
    clear() {
        const prev = this.installedModule;
        this.installedModule = null;
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        return prev;
    }
}
