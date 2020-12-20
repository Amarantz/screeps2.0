import { Directive } from "directives/directive";
import { ManagerPriority } from "priorities/priorities_managers";
import { Bot } from "bot/Bot";
import { Roles, Setups } from "creepSetup/setup";
import { Manager } from "managers/Manager";

export class StationaryScoutManager extends Manager {
    scouts: Bot[];

    constructor(directive: Directive, priority = ManagerPriority.scouting.stationary) {
        super(directive, 'scout', priority);
        this.scouts = this.bots(Roles.scout, {notifyWhenAttacked: false});
    }

    init(): void {
        this.wishlist(1, Setups.scout)
    }

    run():void {
        for(const scout of this.scouts) {
            if(!(scout.pos.inRangeTo(this.pos,3) && !scout.pos.isEdge)) {
                scout.goTo(this.pos, {range: 3})
            }
        }
    }
}
