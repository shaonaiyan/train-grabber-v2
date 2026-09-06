import oppsConfig from '../data/opportunities.json';
export class OpportunityConfigLoader {
    static getGroups() {
        return oppsConfig.groups;
    }
    static getWindowDurationRange() {
        return [oppsConfig.windowDurationMin, oppsConfig.windowDurationMax];
    }
    static getWindowCooldownRange() {
        return [oppsConfig.windowCooldownMin, oppsConfig.windowCooldownMax];
    }
}
