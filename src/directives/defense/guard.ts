import { Directive } from "directives/directive";
import { OutpostDefenseManager } from "managers/defence/OutpostDefenseManager";
import { DefenseNPCManager } from "managers/defence/npcDefence";

interface DirectiveGuardMemory extends FlagMemory {
    invaderCore?: boolean;
    enhanced?: boolean;
}

export class DirectiveGuard extends Directive {
    constructor(flag: Flag) {
        super(flag);
    }
    HigherManager(): void {
        this.managers.outpostDefence = new DefenseNPCManager(this);
    }
    init(): void {

        if(this.room && this.room.invaderCore) {
            this.memory.invaderCore = true;
        }
    }

    run(): void {
        if(this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
            const creepsNeedingHealing = _.filter(this.room.creeps, creep => creep.hits < creep.hitsMax);
            if(creepsNeedingHealing.length == 0 && this.room.isSafe) {
                this.remove();
            }
        }
    }
    static directiveName = 'guard';
    static color = COLOR_BLUE;
    static secondaryColor = COLOR_BLUE;
    memory: DirectiveGuardMemory
}
