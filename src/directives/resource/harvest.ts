import { Directive } from "directives/directive";
import { Pathing } from "movement/Pathing";
import { getCacheExpiration } from "utils/utils";

// Because harvest directives are the most common, they have special shortened memory keys to minimize memory impact
export const _HARVEST_MEM_PATHING = 'P';
export const _HARVEST_MEM_USAGE = 'u';
export const _HARVEST_MEM_DOWNTIME = 'd';

interface DirectiveHarvestMemory extends FlagMemory {
    [_HARVEST_MEM_PATHING]?: {
        [_MEM.DISTANCE]: number,
        [_MEM.EXPIRATION]: number;
    },
    [_HARVEST_MEM_USAGE]: number;
    [_HARVEST_MEM_DOWNTIME]: number;
}

const defaultDirectiveHarvestMemory: DirectiveHarvestMemory = {
    [_HARVEST_MEM_DOWNTIME]: 0,
    [_HARVEST_MEM_USAGE]: 1,
};

export class DirectiveHarvest extends Directive {
    static directiveName = 'harvest';
    static color = COLOR_YELLOW;
    static secondaryColor = COLOR_YELLOW;
    memory: DirectiveHarvestMemory;

    constructor(flag: Flag){
        super(flag);
        if(this.brain){
            this.brain.miningSites[this.name] = this;
            this.brain.destinations.push({pos: this.pos, order: this.memory[_MEM.TICK] || Game.time});
        }
        _.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
    }

    get distance(): number {
        if(!this.memory[_HARVEST_MEM_PATHING] || Game.time >= this.memory[_HARVEST_MEM_PATHING]![_MEM.EXPIRATION]) {
            const distance = Pathing.distance(this.brain.pos, this.pos);
            const expiration = getCacheExpiration(this.brain.storage ? 5000 : 1000);
            this.memory[_HARVEST_MEM_PATHING] = {
                [_MEM.DISTANCE]: distance,
                [_MEM.EXPIRATION]: expiration,
            };
        }
        return this.memory[_HARVEST_MEM_PATHING]![_MEM.DISTANCE];
    }
    HigherManager(): void {

    }
    init(): void {

    }
    run(): void {

    }
}
