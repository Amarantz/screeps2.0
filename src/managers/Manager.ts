import { profile } from "../profiler";
import { Brain } from "Brian";
import { CreepSetup } from "creepSetup/CreepSetup";


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

export interface ManagerMemory {
    suspendUntil?: number;
}

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
    private creeps: { [roleName:string]: Creep[] };
    private boosts: { [roleName: string]: _ResourceConstantSansEnergy[] | undefined };
    creepUsageReport: { [roleName: string]: [number, number] | undefined };

    constructor(initializer: ManagerInitializer | Brain, name: string, priority: number) {
        this.initializer = initializer;
        this.room = initializer.room
        this.ref = `${initializer.ref}>${name}`;
        this.priority = priority;
        this.name = name;
        this.pos = initializer.pos;
        this.brain = hasBrain(initializer) ? initializer.brain : initializer;
        this.creepUsageReport = _.mapValues(this.creeps, creep => undefined);
        this.boosts = _.mapValues(this.creeps, creep => undefined);
        BigBrain.managers[this.ref] = this;
        BigBrain.CEO.registerManager(this);
    }

    get isSuspended(): boolean {
        return BigBrain.CEO.isManagerSuspended(this);
    }

    suspendedFor(ticks: number){
        return BigBrain.CEO.suspendManagerFor(this, ticks);
    }

    suspendUntil(tick: number){
        return BigBrain.CEO.suspendManagerUntil(this, tick);
    }

    refresh() {
        this.room = Game.rooms[this.pos.name];
    }

    recalculateCreeps() {
        this.creeps = _.mapValues(BigBrain.cache.managers[this.ref], creepsOfRole => _.map(creepsOfRole, creepName => Game.creeps[creepName]));
    }

    abstract init(): void;
    abstract run(): void;

    preInit(): void {
        
    }
}
