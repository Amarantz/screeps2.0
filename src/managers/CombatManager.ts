import { Manager, ManagerMemory } from "./Manager";
import { DirectiveGuard } from "directives/defense/guard";
import { Directive } from "directives/directive";
import { CombatBot } from "bot/CombatBot";

export interface CombatManagerMemory extends ManagerMemory {
    [MEM.TICK]: number;
}

export interface CombatManagerOptions {

}

const getDefaultCombatManagerMemory: () => CombatManagerMemory = () => ({
    [MEM.TICK]: Game.time,
})

export abstract class CombatManager extends Manager {
    directive: Directive;
    requiredRCL: any;
    memory: CombatManagerMemory;
    constructor(directive: Directive, name:string, priority: number, requiredRCL: number, maxPathDistance?: number) {
        super(directive, name, priority, getDefaultCombatManagerMemory);
        this.directive = directive;
        this.requiredRCL;
    }

    get age(): number {
        return Game.time - this.memory[MEM.TICK];
    }

    autoRun(roleCreep: CombatBot[], creepHandler: (creep: CombatBot) => void) {
        for(const creep of roleCreep){
            if(creep.spawning){
                return;
            }
            if(creep.hasValidTask) {
                creep.run();
            } else {
                if(creep.needsBoosts) {
                    this.handleBoosting(creep);
                } else {
                    creepHandler(creep);
                }
            }
        }
    }

    finish(successful: boolean): void {
        for(const bot of this.getAllBots()) {
            bot.reassign(this.brain.managers.default);
        }
    }

}
