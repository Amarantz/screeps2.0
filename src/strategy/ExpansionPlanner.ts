import { profile } from "console";
import { Mem } from "memory/memory";
import { getAllBrains } from "Brian";

const CHECK_EXPANSION_FREQUENCY = 1000;

const UNOWNED_MINERAL_BONUS = 100;
const CATALYST_BONUS = 75;
const MAX_SCORE_BONUS = _.sum([UNOWNED_MINERAL_BONUS, CATALYST_BONUS]);

const TOO_CLOSE_PENALTY = 100;

interface ExpansionPlannerMemory {

}

const defaultExpansionPlannerMemory: () => ExpansionPlannerMemory = () => ({});

@profile
export class ExpansionPlanner implements IExpansionPlanner {
    memory: ExpansionPlanner;
    constructor() {
        this.memory = Mem.wrap(Memory, 'expansionPlanner', defaultExpansionPlannerMemory);
    }
    refresh(): void {
        this.memory = Mem.wrap(Memory, 'expansionPlanner', defaultExpansionPlannerMemory);
    }

    private handleExpansion(): void {
        const allBrains = getAllBrains();
        if(allBrains.length >= Math.min(Game.gcl.level, MAX_OWNED_ROOMS))
    }
    init(): void {
        throw new Error("Method not implemented.");
    }
    run(): void {
        throw new Error("Method not implemented.");
    }

}
