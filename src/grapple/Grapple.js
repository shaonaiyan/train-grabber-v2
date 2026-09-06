import { GrappleController } from './GrappleController';
export class Grapple {
    controller;
    constructor(scene, trainManager, particles, juice) {
        this.controller = new GrappleController(scene, trainManager, particles, juice);
    }
    fire(targetX, targetY, items) {
        return this.controller.fire(targetX, targetY, items);
    }
    release() {
        this.controller.releaseCurrentTarget();
    }
    update(delta, items) {
        this.controller.update(delta, items);
    }
    getState() {
        return this.controller.fsm.getState();
    }
    getLatchedItem() {
        return this.controller.getLatchedItem();
    }
}
