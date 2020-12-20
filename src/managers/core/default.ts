import { profile } from "profiler";
import { Manager } from "managers/Manager";
import { ManagerPriority } from "priorities/priorities_managers";
import { getManager } from "bot/AnyBot";
import { Bot } from "bot/Bot";
import { Brain } from "Brian";

@profile
export class DefaultManager extends Manager {
    idleBots: Bot[];
    constructor(brain: Brain){
        super(brain, 'default', ManagerPriority.default);
        this.idleBots = [];
    }

    init(): void {
        const idleCreeps = _.filter(this.brain.creeps, creep => !getManager(creep));
        this.idleBots = _.map(idleCreeps, creep => BigBrain.bots[creep.name] || new Bot(creep));
        for(const bot of this.idleBots) {
            bot.refresh();
        }
    }

    run(): void {

    }
}
