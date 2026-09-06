import itemsData from '../data/items.json';
import { WorldItem } from './WorldItem';
export class ItemFactory {
    scene;
    itemsMap = new Map();
    seenItemTypes = new Set();
    constructor(scene) {
        this.scene = scene;
        const rawMap = itemsData.items || itemsData;
        for (const key in rawMap) {
            this.itemsMap.set(key, rawMap[key]);
        }
    }
    getItemData(id) {
        const data = this.itemsMap.get(id);
        if (!data) {
            throw new Error(`Item ID not found: ${id}`);
        }
        return data;
    }
    spawnWorldItem(x, y, id, depthBand) {
        const data = this.getItemData(id);
        const isFirstTime = !this.seenItemTypes.has(id);
        if (isFirstTime) {
            this.seenItemTypes.add(id);
        }
        return new WorldItem(this.scene, x, y, data, depthBand, isFirstTime);
    }
}
