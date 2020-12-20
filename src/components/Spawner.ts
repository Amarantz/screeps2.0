import { Manager } from "managers/Manager";
import { bodyCost, CreepSetup } from "creepSetup/CreepSetup";
import { profile } from "../profiler";
import { Component } from "./Component";
import { Brain, brainStage } from "Brian";
import { Mem } from "memory/memory";
import { $ } from "caching/GlobalCache";
import { Pathing } from "movement/Pathing";
import { Movement } from "movement/Movement";
import { Stats } from "stats/stats";
import { ema, hasMinerals } from "utils/utils";
import { log } from "console/log";
import { Bot } from "bot/Bot";
import { TransportRequestGroup } from "logistics/TransportRequestGroup";
import { Priority } from "priorities/priorities";
import { QueenManager } from "managers/core/queen";

const ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH = -20;
const ERR_SPECIFIED_SPAWN_BUSY = -21;

export interface SpawnRequest {
    setup: CreepSetup;
    manager: Manager;
    priority: number;
    partners?: (CreepSetup)[];
    options?: SpawnRequestOptions;
}

export interface SpawnRequestOptions {
    spawn?: StructureSpawn;
    directions?: DirectionConstant[];
}

export interface SpawnerMemory {
    stats: {
        overload: number;
        uptime: number;
        longUptime: number;
    };
}

const getDefaultSpawnerMemory: () => SpawnerMemory = () => ({
    stats: {
        overload: 0,
        uptime: 0,
        longUptime: 0,
    }
});

@profile
export class Spawner extends Component {
    spawns: StructureSpawn[];
    availableSpawns: StructureSpawn[];
    memory: SpawnerMemory;
    extensions: StructureExtension[]; 						// List of extensions in the hatchery
	energyStructures: (StructureSpawn | StructureExtension)[]; 	// All spawns and extensions
	link: StructureLink | undefined; 						// The input link
	towers: StructureTower[]; 								// All towers that aren't in the command center
	transportRequests: TransportRequestGroup;
	manager: QueenManager;
	battery: StructureContainer | undefined;				// The container to provide an energy buffer
    settings: { refillTowersBelow: number; linksRequestEnergyBelow: number; suppressSpawning: boolean; };
    private productionPriorities: number[];
    private productionQueue: {
        [priority: number]: SpawnRequest[];
    };
	private isOverloaded: boolean;
	private _waitTimes: { [priority: number]: number } | undefined;

    constructor(brain: Brain, headSpawn: StructureSpawn) {
        super(brain, headSpawn, 'spawner');
        this.memory = Mem.wrap(this.brain.memory, 'spawner', getDefaultSpawnerMemory)
        this.spawns = brain.spawns;
        this.availableSpawns = this.spawns.filter((spawn) => !spawn.spawning)
        this.extensions = brain.extensions;
        this.towers = brain.towers;
        $.set(this, 'energyStructures', () => this.computeEnergyStructures());
        this.link = this.pos.findClosestByLimitedRange(brain.availableLinks, 2);
        this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
        this.productionPriorities = [];
		this.productionQueue = {};
        this.isOverloaded = false;
		this._waitTimes = undefined;
        this.settings = {
			refillTowersBelow      : 750,
			linksRequestEnergyBelow: 0,
			suppressSpawning       : false,
		};
		this.transportRequests = brain.transportRequest;
    }
    refresh(): void {
        this.memory = Mem.wrap(this.brain.memory, 'spawner', getDefaultSpawnerMemory);
        $.refreshRoom(this);
        $.refresh(this, 'spawns', 'extensions', 'energyStructures', 'link', 'towers', 'battery');
        this.availableSpawns = _.filter(this.spawns, spawn => !spawn.spawning);
		this.productionPriorities = [];
		this.productionQueue = {};
		this.isOverloaded = false;
		this._waitTimes = undefined;
    }
    init(): void {
		this.registerEnergyRequests();
    }

    private computeEnergyStructures(): (StructureSpawn | StructureExtension)[] {
			// Ugly workaround to [].concat() throwing a temper tantrum
			let spawnsAndExtensions: (StructureSpawn | StructureExtension)[] = [];
			spawnsAndExtensions = spawnsAndExtensions.concat(this.spawns, this.extensions);
			return _.sortBy(spawnsAndExtensions, structure => structure.pos.getRangeTo(this.idlePos));
    }
    	// Idle position for queen
	get idlePos(): RoomPosition {
		if (this.battery) {
			return this.battery.pos;
		} else {
			return this.spawns[0].pos.availableNeighbors(true)[0];
		}
    }

    private generateCreepName(roleName: string): string {
		// Generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	}

    higherManagers(): void {
		this.manager = new QueenManager(this)
    }
    run(): void {
        		// Handle spawning
		if (!this.settings.suppressSpawning) {

			// Spawn all queued creeps that you can
			while (this.availableSpawns.length > 0) {
				const result = this.spawnHighestPriorityCreep();
				if (result == ERR_NOT_ENOUGH_ENERGY) { // if you can't spawn something you want to
					this.isOverloaded = true;
				}
				if (result != OK && result != ERR_SPECIFIED_SPAWN_BUSY) {
					// Can't spawn creep right now
					break;
				}
			}
			// Move creeps off of exit position to let the spawning creep out if necessary
			for (const spawn of this.spawns) {
				if (spawn.spawning && spawn.spawning.remainingTime <= 1
					&& spawn.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) {
					let directions: DirectionConstant[];
					if (spawn.spawning.directions) {
						directions = spawn.spawning.directions;
					} else {
						directions = _.map(spawn.pos.availableNeighbors(true), pos => spawn.pos.getDirectionTo(pos));
					}
					const exitPos = Pathing.positionAtDirection(spawn.pos, _.first(directions)) as RoomPosition;
					Movement.vacatePos(exitPos);
				}
			}
		}

		this.recordStats();
    }

    	/**
	 * Enqueues a spawn request to the hatchery production queue
	 */
	enqueue(request: SpawnRequest): void {
		// const protoCreep = this.generateProtoCreep(request.setup, request.overlord);
		// TODO: ^shouldn't need to do this at enqueue, just at spawn. Implement approximateSize() method?
		const priority = request.priority;
		// Spawn the creep yourself if you can
		this._waitTimes = undefined; // invalidate cache
		// this._queuedSpawnTime = undefined;
		if (!this.productionQueue[priority]) {
			this.productionQueue[priority] = [];
			this.productionPriorities.push(priority); // this is necessary because keys interpret number as string
		}
		this.productionQueue[priority].push(request);
	}

		/* Request more energy when appropriate either via link or hauler */
		private registerEnergyRequests(): void {
			// Register requests for input into the hatchery (goes on brain store group)
			if (this.link && this.link.isEmpty) {
				this.brain.linkNetwork.requestReceive(this.link);
			}
			if (this.battery) {
				const threshold = this.brain.stage == brainStage.Infant ? 0.75 : 0.5;
				if (this.battery.energy < threshold * this.battery.storeCapacity) {
					this.brain.logisticsNetwork.requestInput(this.battery, {multiplier: 1.5});
				}
				// get rid of any minerals in the container if present
				//@ts-ignore
				if (hasMinerals(this.battery.store)) {
					this.brain.logisticsNetwork.requestOutputMinerals(this.battery);
				}
			}

			_.forEach(this.energyStructures, struct => this.transportRequests.requestInput(struct, Priority.Normal));

			const refillTowers = _.filter(this.towers, tower => tower.energy < this.settings.refillTowersBelow);
			_.forEach(refillTowers, tower => this.transportRequests.requestInput(tower, Priority.NormalLow));
		}

    private spawnCreep(protoCreep: ProtoCreep, options: SpawnRequestOptions = {}): number {
		// If you can't build it, return this error
		if (bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
			return ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH;
		}
		// Get a spawn to use
		let spawnToUse: StructureSpawn | undefined;
		if (options.spawn) {
			spawnToUse = options.spawn;
			if (spawnToUse.spawning) {
				return ERR_SPECIFIED_SPAWN_BUSY;
			} else {
				_.remove(this.availableSpawns, spawn => spawn.id == spawnToUse!.id); // mark as used
			}
		} else {
			spawnToUse = this.availableSpawns.shift();
		}
		// If you have a spawn available then spawn the creep
		if (spawnToUse) {
			if (this.brain.bunker && this.brain.bunker.coreSpawn
				&& spawnToUse.id == this.brain.bunker.coreSpawn.id && !options.directions) {
				options.directions = [TOP, RIGHT]; // don't spawn into the manager spot
			}
			protoCreep.name = this.generateCreepName(protoCreep.name); // modify the creep name to make it unique
			protoCreep.memory.data.origin = spawnToUse.pos.roomName;

			// Spawn the creep
			const result = spawnToUse.spawnCreep(protoCreep.body, protoCreep.name, {
				memory          : protoCreep.memory,
				energyStructures: this.energyStructures,
				directions      : options.directions
			});

			if (result == OK) {
				// Creep has been successfully spawned; add cost into profiling
				const managerRef = protoCreep.memory[MEM.MANAGER];
				const manager = BigBrain.managers[managerRef] as Manager | undefined;
				if (manager) {
					if (manager.memory[MEM.STATS]) {
						manager.memory[MEM.STATS]!.spawnCost += bodyCost(protoCreep.body);
					}
				} else {
					// This shouldn't ever happen
					log.error(`No overlord for protocreep ${protoCreep.name} at hatchery ${this.print}!`);
				}
				return result;
			} else {
				this.availableSpawns.unshift(spawnToUse); // return the spawn to the available spawns list
				return result;
			}
		} else { // otherwise, if there's no spawn to use, return busy
			return ERR_BUSY;
		}
	}

	canSpawn(body: BodyPartConstant[]): boolean {
		return bodyCost(body) <= this.room.energyCapacityAvailable;
	}

	canSpawnBot(bot: Bot): boolean {
		return this.canSpawn(_.map(bot.body, part => part.type));
	}


	private spawnHighestPriorityCreep(): number | undefined {
		const sortedKeys = _.sortBy(this.productionPriorities);
		for (const priority of sortedKeys) {
			// if (this.brain.defcon >= DEFCON.playerInvasion
			// 	&& !this.brain.controller.safeMode
			// 	&& priority > OverlordPriority.warSpawnCutoff) {
			// 	continue; // don't spawn non-critical creeps during wartime
			// }

			const request = this.productionQueue[priority].shift();
			if (request) {
				// Generate a protocreep from the request
				const protoCreep = this.generateProtoCreep(request.setup, request.manager);
				if (this.canSpawn(protoCreep.body) && protoCreep.body.length > 0) {
					// Try to spawn the creep
					const result = this.spawnCreep(protoCreep, request.options);
					if (result == OK) {
						return result;
					} else if (result == ERR_SPECIFIED_SPAWN_BUSY) {
						return result; // continue to spawn other things while waiting on specified spawn
					} else {
						// If there's not enough energyCapacity to spawn, ignore and move on, otherwise block and wait
						if (result != ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH) {
							this.productionQueue[priority].unshift(request);
							return result;
						}
					}
				} else {
					log.debug(`${this.room.print}: cannot spawn creep ${protoCreep.name} with body ` +
							  `${JSON.stringify(protoCreep.body)}!`);
				}
			}
        }
        return;
    }

    	/* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	private generateProtoCreep(setup: CreepSetup, manager: Manager): ProtoCreep {

		// Generate the creep memory
		const creepMemory: CreepMemory = {
			[MEM.BRAIN]  : manager.brain.name, 				// name of the brain the creep is assigned to
			[MEM.MANAGER]: manager.ref,						// name of the Overlord running this creep
			role          : setup.role,						// role of the creep
			task          : null, 								// task the creep is performing
			data          : { 									// rarely-changed data about the creep
				origin: '',										// where it was spawned, filled in at spawn time
			},
		};

		// Generate the creep body
		const {body, boosts} = setup.create(this.brain);

		if (boosts.length > 0) {
			creepMemory.needBoosts = boosts; // tell the creep what boosts it will need to get
		}

		// Create the protocreep and return it
		const protoCreep: ProtoCreep = { 							// object to add to spawner queue
			body  : body, 											// body array
			name  : setup.role, 									// name of the creep; gets modified by hatchery
			memory: creepMemory,									// memory to initialize with
		};
		return protoCreep;
	}

    private recordStats() {
		// Compute uptime and overload status
		const spawnUsageThisTick = _.filter(this.spawns, spawn => spawn.spawning).length / this.spawns.length;
		const uptime = ema(spawnUsageThisTick, this.memory.stats.uptime, CREEP_LIFE_TIME);
		const longUptime = ema(spawnUsageThisTick, this.memory.stats.longUptime, 3 * CREEP_LIFE_TIME);
		const overload = ema(this.isOverloaded ? 1 : 0, this.memory.stats.overload, CREEP_LIFE_TIME);

		Stats.log(`brains.${this.brain.name}.spawner.uptime`, uptime);
		Stats.log(`brains.${this.brain.name}.spawner.overload`, overload);

		this.memory.stats = { overload, uptime, longUptime };
	}

}
