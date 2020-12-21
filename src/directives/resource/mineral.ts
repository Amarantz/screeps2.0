import { Directive } from "directives/directive";
import { ManagerPriority } from "priorities/priorities_managers";
import { ExtractorManager } from "managers/mining/extractor";
import { log } from "console/log";

export class DirectiveMineral extends Directive {
    static directiveName = 'extract';
    static color = COLOR_YELLOW;
    static secondaryColor = COLOR_CYAN;

    managers: {
        mineral: ExtractorManager;
    }

    constructor(flag: Flag) {
        super(flag);
        if(this.brain){
            this.brain.destinations.push({pos: this.pos, order: this.memory[MEM.TICK] || Game.time });
        }
    }
    HigherManager(): void {
        let priority: number = ManagerPriority.ownedRoom.mineral;
        if(this.room && this.room.my) {
            if(this.brain.level == 8) {
                priority = ManagerPriority.ownedRoom.mineralRCL8;
            }
        } else {
            priority = ManagerPriority.remoteSKRoom.mineral;
        }
        this.managers.mineral = new ExtractorManager(this, ManagerPriority.ownedRoom.mineral);
    }
    init(): void {

    }
    run(): void {
        if(this.brain.level < 6) {
            log.notify(`Removing extraction directive in ${this.pos.room}: room RCL insufficient`);
            this.remove();
        } else if (
            !this.brain.terminal
        ) {
            log.notify(`Removing extraction directive in ${this.pos.room}: room is missing terminal.`);
            this.remove();
        }
    }

}
