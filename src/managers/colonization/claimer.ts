import { profile } from "profiler";
import { Manager } from "managers/Manager";
import { Tasks } from "tasks/Tasks";
import { Bot } from "bot/Bot";
import { Pathing } from "movement/Pathing";
import { Directive } from "directives/directive";
import { ManagerPriority } from "priorities/priorities_managers";
import { Roles } from "creepSetup/setup";
import { $ } from 'caching/GlobalCache'


@profile
export class ClaimerManager extends Manager {
    claimers: Bot[];
    directive: Directive;

    constructor(directive: Directive, priority = ManagerPriority.colonization.claim) {
        super(directive, 'claim', priority);
        this.directive = directive;
        this.claimers = this.bots(Roles.claim);

    }
    init(): void {
        const amount = $.number(this, 'claimerAmount', () => {
            if(this.room) {
                if(this.room.my) {
                    return 0;
                } else {
                    const pathablepos = this.room.creeps[0] ? this.room.creeps[0].pos : Pathing.findPathablePosition(this.room.name);
                    if(!Pathing.isReachable(pathablepos, this.room.controller!.pos, _.filter(this.room.structures, s => !s.isWalkable))) {
                        return 0;
                    }
                }
            }
            return 1;
        })
    }

    private handleClaimer(claimer: Bot) {
        if(claimer.room == this.room && claimer.pos.isEdge) {
            if(!this.room.controller!.signedByMe) {
                if(!this.room.my && this.room.controller!.signedByScreeps){
                    claimer.task = Tasks.claim(this.room.controller!);
                } else {
                    claimer.task = Tasks.signController(this.room.controller!);
                }
            } else {
                claimer.task = Tasks.claim(this.room.controller!)
            }
        } else {
            claimer.goTo(this.pos, {pathOpts: { ensurePath: true, avoidSK: true}});
        }
    }
    run(): void {
        this.autoRun(this.claimers, claimer => this.handleClaimer(claimer));
        if(this.room && this.room.controller && this.room.controller.my && this.room.controller.signedByMe) {
            for(const claimer of this.claimers) {
                claimer.suicide();
            }
        }
    }

}
