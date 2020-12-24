import { Directive } from "directives/directive";
import { NotifierPriority } from "directives/Notifier";
import { OutpostDefenseManager } from "managers/defence/OutpostDefenseManager";

interface DirectiveInvasionDefenceMemory extends FlagMemory {
    persistent: boolean;
    created: number;
    safeSince: number;
}

export class DirectiveOutpostDefence extends Directive {
    static directiveName = 'outpostDefence';
    static color = COLOR_BLUE;
    static secondaryColor = COLOR_RED;

    memory: DirectiveInvasionDefenceMemory;

    constructor(flag: Flag) {
        super(flag);
    }
    HigherManager(): void {
        this.managers.outpostDefence = new OutpostDefenseManager(this);
    }
    init(): void {
        const numHostiles: string = this.room && this.room.hostiles.length.toString() || '???';
        this.alert(`Outpost defense (hostiles: (${numHostiles}))`, NotifierPriority.High);
    }
    run(): void {
        if(!this.room || this.room.hostiles.length > 0) {
            this.memory.safeSince = Game.time;
        }

        if(this.room && this.room.hostiles.length == 0
            && Game.time - this.memory.safeSince > 100) {
                if(_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0){
                    this.remove()
                }
            }
    }

}
