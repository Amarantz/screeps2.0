import { profile } from "../profiler";
import { Brain } from "Brian";
import { CreepSetup } from "creepSetup/CreepSetup";
import { Mem } from "memory/memory";
import { log } from "console/log";


export interface ManagerInitializer {
    ref: string;
    room: Room | undefined;
    pos: RoomPosition;
    brain: Brain;
    memory: any;
    waypoints?: RoomPosition[];
}

export interface CreepRequestOptions {
	reassignIdle?: boolean;
	noLifetimeFilter?: boolean;
	prespawn?: number;
	priority?: number;
	partners?: CreepSetup[];
	// options?: SpawnRequestOptions;
}

export const DEFAULT_PRESPAWN = 50;
export const MAX_SPAWN_REQUESTS = 100; // this stops division by zero or related errors from sending infinite requests



export interface ManagerStats {
	start: number;
	end?: number;
	cpu: number;
	spawnCost: number;
	deaths: number; // TODO: track deaths
}
export interface ManagerStatsSuspendOptions {
	endTick?: number;
	condition?: {
		fn: string; // stringified function with signature () => boolean;
		freq: number; // how often to check if the condition is met
	};
}
export interface ManagerMemory {
    suspend?: ManagerStatsSuspendOptions;
    [MEM.STATS]?: ManagerStats;
    debug?: boolean;
}

const getDefaultManagerMemory = (): ManagerMemory => ({

})
export const hasBrain = (initializer: ManagerInitializer | Brain): initializer is ManagerInitializer {
    return (initializer as ManagerInitializer).brain !== undefined;
}

@profile
export abstract class Manager {
    protected initializer: ManagerInitializer | Brain;
    room: Room | undefined;
    ref: string;
    priority: number;
    name: string;
    pos: RoomPosition;
    brain: Brain;
    memory: ManagerMemory;
    private _creeps: { [roleName:string]: Creep[] };
    creepUsageReport: { [roleName: string]: [number, number] | undefined };

    constructor(initializer: ManagerInitializer | Brain, name: string, priority: number, memDefaults: () => ManagerMemory = getDefaultManagerMemory) {
        this.memory = Mem.wrap(initializer.memory, name, memDefaults);
        this.initializer = initializer;
        this.room = initializer.room
        this.ref = `${initializer.ref}>${name}`;
        this.priority = priority;
        this.name = name;
        this.pos = initializer.pos;
        this._creeps = {};
        this.brain = hasBrain(initializer) ? initializer.brain : initializer;
        this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);
        BigBrain.managers[this.ref] = this;
        BigBrain.CEO.registerManager(this);
    }


    get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
	}


    get isSuspended(): boolean {
        if (this.memory.suspend) {
			if (this.memory.suspend.endTick) {
				if (Game.time < this.memory.suspend.endTick) {
					return true;
				} else {
					delete this.memory.suspend;
					return false;
				}
			}
			if (this.memory.suspend.condition) {
				log.error('NOT IMPLEMENTED'); // TODO
				const {fn, freq} = this.memory.suspend.condition;
				if (Game.time % freq == 0) {
					const condition = new Function(fn);
					// TODO - finish this
				}
			}
		}
		return false;
    }

    suspendedFor(ticks: number){
        this.memory.suspend = {
			endTick: Game.time + ticks
		};
    }

    suspendUntil(endTick: number){
        this.memory.suspend = {
			endTick: endTick
		};
    }

    refresh() {
        this.memory = Mem.wrap(this.initializer.memory, this.name);
        this.room = Game.rooms[this.pos.roomName];
        this.recalculateCreeps();
        for(const role in this._creeps) {
            for(const creep of this._creeps[role]){
                if(BigBrain.bots[creep.name]){
                    BigBrain.bots[creep.name].refresh();
                } else {
                    log.warning(`${this.print}: could not find and refresh bot with name ${creep.name}!`);
                }
            }
        }
    }

    recalculateCreeps() {
        this._creeps = _.mapValues(BigBrain.cache.managers[this.ref], creepsOfRole => _.map(creepsOfRole, creepName => Game.creeps[creepName]));
    }

    abstract init(): void;
    abstract run(): void;

    preInit(): void {

    }
}
