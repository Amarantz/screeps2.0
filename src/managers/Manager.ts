import { profile } from "../profiler";
import { Brain } from "Brian";
import { CreepSetup } from "creepSetup/CreepSetup";
import { Mem } from "memory/memory";
import { log } from "console/log";
import { Bot } from "bot/Bot";
import { Pathing } from "movement/Pathing";
import { getManager, setManager } from "bot/AnyBot";
import { SpawnRequest, SpawnRequestOptions } from "components/spawner";
import { Abathur } from "resources/abathur";
import { CombatBot } from "bot/CombatBot";
import { Tasks } from "tasks/Tasks";
import { CombatCreepSetup } from "creepSetup/CombatCreepSetup";


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
    options?: SpawnRequestOptions;
    spawnOneAtATime?: boolean;
}

export const DEFAULT_PRESPAWN = 50;
export const MAX_SPAWN_REQUESTS = 100; // this stops division by zero or related errors from sending infinite requests

export interface BotOptions {
	notifyWhenAttacked?: boolean;
}


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

});

export const hasBrain = (initializer: ManagerInitializer | Brain): initializer is ManagerInitializer => {
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
    spawnGroup: undefined;
    memory: ManagerMemory;
    private _creeps: { [roleName:string]: Creep[] };
	private _bots: {[roleName:string]: Bot[]};
	private _combatBots: {[roleName:string]: CombatBot[]};
    creepUsageReport: { [roleName: string]: [number, number] | undefined };
    private shouldSpawnAt?: number;

    constructor(initializer: ManagerInitializer | Brain, name: string, priority: number, memDefaults: () => ManagerMemory = getDefaultManagerMemory) {
        this.memory = Mem.wrap(initializer.memory, name, memDefaults);
        this.initializer = initializer;
        this.room = initializer.room
        this.ref = `${initializer.ref}>${name}`;
        this.priority = priority;
        this.name = name;
        this.pos = initializer.pos;
        this.brain = hasBrain(initializer) ? initializer.brain : initializer;
        this._creeps = {};
		this._bots = {};
		this._combatBots = {};
        this.recalculateCreeps();
        this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);
        BigBrain.managers[this.ref] = this;
        BigBrain.CEO.registerManager(this);
    }


    get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
	}

	debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
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
        for(const role in this._bots){
			this.synchronizeBots(role);

			for (const role in this._combatBots) {
				this.synchronizeCombatBots(role);
			}
        }
	}

	protected combatBots(role: string, opts: BotOptions = {}): CombatBot[] {
		if (!this._combatBots[role]) {
			this._combatBots[role] = [];
			this.synchronizeCombatBots(role, opts.notifyWhenAttacked);
		}
		return this._combatBots[role];
	}

	private synchronizeCombatBots(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of CombatBots
		const zergNames = _.zipObject(_.map(this._combatBots[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _combatBots record
		for (const creep of this._creeps[role] || []) {
			if (!zergNames[creep.name]) {
				if (BigBrain.bots[creep.name] && (<CombatBot>BigBrain.bots[creep.name]).isCombatBot) {
					this._combatBots[role].push(BigBrain.bots[creep.name]);
				} else {
					this._combatBots[role].push(new CombatBot(creep, notifyWhenAttacked));
				}
			}
		}
		// Remove dead/reassigned creeps from the _combatBots record
		const removeBotsNames: string[] = [];
		for (const zerg of this._combatBots[role]) {
			if (!creepNames[zerg.name]) {
				removeBotsNames.push(zerg.name);
			}
		}
		_.remove(this._combatBots[role], deadBots => removeBotsNames.includes(deadBots.name));
	}

	getAllCombatBots(): CombatBot[] {
		const allCombatBots: CombatBot[] = [];
		for (const role in this._creeps) {
			for (const combatBots of this.combatBots(role)) {
				allCombatBots.push(combatBots);
			}
		}
		return allCombatBots;
	}

    /**
	 * Gets the "ID" of the outpost this overlord is operating in. 0 for owned rooms, >= 1 for outposts, -1 for other
	 */
	get outpostIndex(): number {
		return _.findIndex(this.brain.roomNames, roomName => roomName == this.pos.roomName);
	}


    /**
	 * Check if profiling is active, also shuts it down if it is past end tick
	 */
	get profilingActive(): boolean {
		if (this.memory[MEM.STATS]) {
			if (this.memory[MEM.STATS]!.end) {
				if (Game.time > this.memory[MEM.STATS]!.end!) {
					this.finishProfiling();
					return false;
				}
			}
			return true;
		}
		return false;
    }

    	/**
	 * Starts profiling on this overlord and initializes memory to defaults
	 */
	startProfiling(ticks?: number): void {
		if (!this.memory[MEM.STATS]) {
			this.memory[MEM.STATS] = {
				start    : Game.time,
				cpu      : 0,
				spawnCost: 0,
				deaths   : 0,
			};
			if (ticks) {
				this.memory[MEM.STATS]!.end = Game.time + ticks;
			}
		} else {
			log.alert(`Overlord ${this.print} is already being profiled!`);
		}
    }

    	/**
	 * Finishes profiling this overlord and deletes the memory objects
	 */
	finishProfiling(verbose = true): void {
		if (!this.memory[MEM.STATS]) {
			log.error(`Overlord ${this.print} is not being profiled, finishProfiling() invalid!`);
			return;
		}
		if (verbose) {
			log.alert(`Profiling finished for overlord ${this.print}. Results:\n` +
					  JSON.stringify(this.memory[MEM.STATS]));
		}
		delete this.memory[MEM.STATS];
    }

    	/**
	 * Wraps all creeps of a given role to Bots objects and updates the contents in future ticks to avoid having to
	 * explicitly refresh groups of Bots
	 */
	protected bots(role: string, opts: BotOptions = {}): Bot[] {
		if (!this._bots[role]) {
			this._bots[role] = [];
			this.synchronizeBots(role, opts.notifyWhenAttacked);
		}
		return this._bots[role];
    }

    private synchronizeBots(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of Bots
		const botsNames = _.zipObject(_.map(this._bots[role] || [],
											bots => [bots.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _bots record
		for (const creep of this._creeps[role] || []) {
			if (!botsNames[creep.name]) {
				this._bots[role].push(BigBrain.bots[creep.name] || new Bot(creep, notifyWhenAttacked));
			}
		}
		// Remove dead/reassigned creeps from the _bots record
		const removeBotsNames: string[] = [];
		for (const bots of this._bots[role]) {
			if (!creepNames[bots.name]) {
				removeBotsNames.push(bots.name);
			}
		}
		_.remove(this._bots[role], deadBots => removeBotsNames.includes(deadBots.name));
	}

    getAllBots(): Bot[] {
		const allBots: Bot[] = [];
		for (const role in this._creeps) {
			for (const bot of this.bots(role)) {
				allBots.push(bot);
			}
		}
		return allBots;
	}


    abstract init(): void;
    abstract run(): void;

    	/**
	 * Contains logic for shutting down the overlord
	 */
	finish(successful: boolean): void {
		for (const bot of this.getAllBots()) {
			bot.reassign(this.brain.managers.default);
		}
		// TODO: CombatOverlord
	}

	protected handleBoosting(bot: Bot | CombatBot): void {
		const brain = BigBrain.brains[bot.room.name] as Brain | undefined;
		const engineeringBay = brain ? brain.engineeringBay : undefined;

		if(engineeringBay) {
			if(!bot.needsBoosts){
				log.error(`BigBrain.handleBoosting() called for ${bot.print}, but not boosts needed!`);
			}

			const neededBoosts = bot.getNeededBoosts();
			const neededBoostResources = _.keys(neededBoosts);

			const [moveBoosts, nonMoveBoosts] = _.partition(neededBoostResources,
															resource => Abathur.isMoveBoost(<ResourceConstant>resource));

			for (const boost of [...moveBoosts, nonMoveBoosts]) { // try to get move boosts first if they're available
				const boostLab = _.find(engineeringBay.boostingLabs, lab => lab.mineralType == boost);
				if (boostLab) {
					bot.task = Tasks.getBoosted(boostLab, <ResourceConstant>boost);
					return;
				}
			}
		}
	}

	protected reassignIdleCreeps(role: string, maxPerTick=1): boolean {
		// Find all creeps without an overlord
		const idleCreeps = _.filter(this.brain.getCreepsByRole(role), creep => !getManager(creep));
		// Reassign them all to this flag
		let reassigned = 0;
		for (const creep of idleCreeps) {
			// TODO: check range of creep from overlord
			setManager(creep, this);
			reassigned++;
			if (reassigned >= maxPerTick) {
				break;
			}
		}
		return reassigned > 0;
	}


    	/**
	 * Standard sequence of actions for running task-based creeps
	 */
	autoRun(roleCreeps: Bot[], taskHandler: (creep: Bot) => void, fleeCallback?: (creep: Bot) => boolean) {
		for (const creep of roleCreeps) {
			if (creep.spawning) {
				return;
			}
			if (!!fleeCallback) {
				if (fleeCallback(creep)) continue;
			}
			if (creep.isIdle) {
				if (creep.needsBoosts) {
					this.handleBoosting(creep);
				} else {
					taskHandler(creep);
				}
			}
			creep.run();
		}
    }

    	// TODO: include creep move speed
	lifetimeFilter(creeps: (Creep | Bot)[], prespawn = DEFAULT_PRESPAWN, spawnDistance?: number): (Creep | Bot)[] {
		if (!spawnDistance) {
			spawnDistance = 0;
			// if (this.spawnGroup) {
			// 	const distances = _.take(_.sortBy(this.spawnGroup.memory.distances), 2);
			// 	spawnDistance = (_.sum(distances) / distances.length) || 0;
			// } else if (this.brain.spawner) {
			// 	// Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
			// 	spawnDistance = Pathing.distance(this.pos, this.brain.spawner.pos) || 0;
			// }
			// if (this.brain.state.isIncubating && this.brain.spawnGroup) {
			// 	spawnDistance += this.brain.spawnGroup.stats.avgDistance;
			// }
		}

		/* The last condition fixes a bug only present on private servers that took me a fucking week to isolate.
		 * At the tick of birth, creep.spawning = false and creep.ticksTolive = undefined
		 * See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process */
		return _.filter(creeps, creep =>
			creep.ticksToLive! > CREEP_SPAWN_TIME * creep.body.length + spawnDistance! + prespawn ||
			creep.spawning || (!creep.spawning && !creep.ticksToLive));
    }

    	/**
	 * Wishlist of creeps to simplify spawning logic; includes automatic reporting
	 */
	protected wishlist(quantity: number, setup: CreepSetup, opts = {} as CreepRequestOptions): void {

		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN, reassignIdle: false});

		// TODO Don't spawn if spawning is halted
		if (this.shouldSpawnAt && this.shouldSpawnAt > Game.time) {
			log.info(`Disabled spawning for ${this.print} for another ${this.shouldSpawnAt - Game.time} ticks`);
			return;
		}

		let creepQuantity: number;
		if (opts.noLifetimeFilter) {
			creepQuantity = (this._creeps[setup.role] || []).length;
		} else if (_.has(this.initializer, 'waypoints')) {
			// TODO: replace hardcoded distance with distance computed through portals
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn, 500).length;
		} else {
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn).length;
		}

		let spawnQuantity = quantity - creepQuantity;
		if (opts.reassignIdle && spawnQuantity > 0) {
            const idleCreeps = _.filter(this.brain.getCreepsByRole(setup.role), creep => !getManager(creep));
			for (let i = 0; i < Math.min(idleCreeps.length, spawnQuantity); i++) {
				setManager(idleCreeps[i], this);
				spawnQuantity--;
			}
		}

		// A bug in outpostDefenseOverlord caused infinite requests and cost me two botarena rounds before I found it...
		if (spawnQuantity > MAX_SPAWN_REQUESTS) {
			log.error(`Too many requests for ${setup.role}s submitted by ${this.print}! (Check for errors.)`);
		} else {
			for (let i = 0; i < spawnQuantity; i++) {
				if (i >= 1 && opts.spawnOneAtATime) break;
				this.requestCreep(setup, opts);
			}
		}

		this.creepReport(setup.role, creepQuantity, quantity);
    }

    	/**
	 * Create a creep setup and enqueue it to the Hatchery; does not include automatic reporting
	 */
	protected requestCreep(setup: CreepSetup | CombatCreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		const spawner = this.spawnGroup || this.brain.spawnGroup || this.brain.spawner;
		if (spawner) {
			const request: SpawnRequest = {
				setup   : setup,
				manager: this,
				priority: opts.priority!,
			};
			if (opts.partners) {
				request.partners = opts.partners;
			}
			if (opts.options) {
				request.options = opts.options;
			}
			spawner.enqueue(request);
		} else {
			if (Game.time % 100 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
    }

    protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
	}

	/**
	 * Requests that should be handled for all overlords prior to the init() phase
	 */
	preInit(): void {
		// Handle requesting boosts from the evolution chamber
		const allBots = _.flatten([..._.values(this._bots)]) as (Bot)[];
		for (const bot of allBots) {
			if (bot.needsBoosts) {
				const brain = BigBrain.brains[bot.room.name] as Brain | undefined;
				const evolutionChamber = brain ? brain.engineeringBay : undefined;
				if (evolutionChamber) {
					evolutionChamber.requestBoosts(bot.getNeededBoosts());
				}
			}
		}
	}

	visuals(): void {

	}
}
