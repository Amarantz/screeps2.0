import { Directive } from "directives/directive";
import { Pathing } from "movement/Pathing";
import { getCacheExpiration, ema } from "utils/utils";

// Because harvest directives are the most common, they have special shortened memory keys to minimize memory impact
export const enum HARVEST_MEM {
	PATHING  = 'P',
	USAGE    = 'u',
	DOWNTIME = 'd',
}

interface DirectiveHarvestMemory extends FlagMemory {
	[HARVEST_MEM.PATHING]?: {
		[MEM.DISTANCE]: number,
		[MEM.EXPIRATION]: number
	};
	[HARVEST_MEM.USAGE]: number;
	[HARVEST_MEM.DOWNTIME]: number;
}

const defaultDirectiveHarvestMemory: DirectiveHarvestMemory = {
	[HARVEST_MEM.USAGE]   : 1,
	[HARVEST_MEM.DOWNTIME]: 0,
};

export class DirectiveHarvest extends Directive {
    static directiveName = 'harvest';
    static color = COLOR_YELLOW;
    static secondaryColor = COLOR_YELLOW;
    memory: DirectiveHarvestMemory;
    managers: {
        mine: any;
    }

    constructor(flag: Flag){
        super(flag);
        if(this.brain){
            this.brain.miningSites[this.name] = this;
            this.brain.destinations.push({pos: this.pos, order: this.memory[MEM.TICK] || Game.time});
        }
        _.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
    }

	// Hauling distance
	get distance(): number {
		if (!this.memory[HARVEST_MEM.PATHING] || Game.time >= this.memory[HARVEST_MEM.PATHING]![MEM.EXPIRATION]) {
			const distance = Pathing.distance(this.brain.pos, this.pos) || Infinity;
			const expiration = getCacheExpiration(this.brain.storage ? 5000 : 1000);
			this.memory[HARVEST_MEM.PATHING] = {
				[MEM.DISTANCE]  : distance,
				[MEM.EXPIRATION]: expiration
			};
		}
		return this.memory[HARVEST_MEM.PATHING]![MEM.DISTANCE];
	}
    HigherManager(): void {

    }
    init(): void {

    }
    run(): void {
        this.computeStats();
    }

    private computeStats() {
		const source = this.managers.mine.source;
		if (source && source.ticksToRegeneration == 1) {
			this.memory[HARVEST_MEM.USAGE] = (source.energyCapacity - source.energy) / source.energyCapacity;
		}
		const container = this.managers.mine.container;
		this.memory[HARVEST_MEM.DOWNTIME] = +(ema(container ? +container.isFull : 0,
												  this.memory[HARVEST_MEM.DOWNTIME],
												  CREEP_LIFE_TIME)).toFixed(5);
	}
}
