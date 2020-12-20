import { profile } from "profiler";
import { Roles } from "creepSetup/setup";
import { Directive } from "directives/directive";
import { NotifierPriority } from "directives/Notifier";
import { log } from "console/log";
import { Brain } from "Brian";
import { BootstrappingManager } from "managers/situational/bootstrap";

@profile
export class DirectiveBootstrap extends Directive {
    static directiveName = 'bootstrap';
    static color = COLOR_ORANGE;
    static secondaryColor = COLOR_ORANGE;

    brain: Brain;
    room: Room;
    private needsMiners: boolean;
    private needsManagers: boolean;
    private needsFillers: boolean;
    private needsQueens: boolean;

    constructor(flag: Flag) {
        super(flag);
        this.refresh();
    }

    refresh() {
        super.refresh();
        this.brain.state.bootstrapping = true;
        this.needsMiners = (this.brain.getCreepsByRole(Roles.harvester).length == 0);
        this.needsFillers = (this.brain.getCreepsByRole(Roles.filler).length == 0);
        this.needsManagers = (this.brain.commandCenter != undefined &&
            this.brain.commandCenter.manager != undefined &&
            this.brain.commandCenter.link != undefined &&
            this.brain.getCreepsByRole(Roles.manager).length == 0);
        this.needsQueens = (this.brain.getCreepsByRole(Roles.queen).length == 0);
    }

    HigherManager(): void {
        this.managers.bootstrap = new BootstrappingManager(this);
    }

    init(): void {
        this.alert(`Brain in bootstrap mode!`, NotifierPriority.High);
        if(Game.time % 100 == 0) {
            log.alert(`Brain ${this.room.print} is in emergency recovery mode`);
        }
    }
    run(): void {
        if(!this.needsQueens && !this.needsMiners) {
            if(this.brain.storage && this.brain.assets.energy < 5000) {
                return;
            }
            log.alert(`Colony ${this.room.print} has recovered from crash; removing bootstrap directive`);
            const overlord = this.managers.bootstrap as BootstrappingManager;
            for(const filler of overlord.fillers) {
                filler.suicide();
            }
            this.remove();
        }
    }


}
