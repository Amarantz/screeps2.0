import { getAllBrains, Brain } from "Brian";
import { log } from "console/log";
import { Cartographer, ROOMTYPE_CONTROLLER } from "utils/Cartographer";
import { onPublicServer, canClaimAnotherRoom, getAllRooms, hasJustSpawned, minBy } from "utils/utils";
import { RoomIntel } from "intel/RoomIntel";
import { DirectiveHarvest } from "directives/resource/harvest";
import { Manager } from "managers/Manager";
import { Directive } from "directives/directive";
import { USE_TRY_CATCH, PROFILER_COLONY_LIMIT } from "settings";
import { Notifier } from "directives/Notifier";
import { profile } from "profiler";
import { Mem } from "memory/memory";
import { p } from "utils/random";
import { Pathing } from "movement/Pathing";
import { DirectiveOutpost } from "directives/colony/outpost";
import { LogisticsNetwork } from "logistics/LogisticsNetwork";
import { Roles } from "creepSetup/setup";
import { bodyCost } from "creepSetup/CreepSetup";
import { DirectiveBootstrap } from "directives/situational/bootstrap";
import settings from 'settings';

// export const DIRECTIVE_CHECK_FREQUENCY = 2;

interface OverseerMemory {

}

const getDefaultOverseerMemory: () => OverseerMemory = () => ({});

/**
 * The Overseer object acts as a scheduler, running directives and managers for all brains each tick. It is also
 * in charge of starting new "processes" (directives) to respond to various situations.
 */
@profile
export class CEO implements ICeo {

    private memory: OverseerMemory;

    private directives: Directive[];
    private directivesByType: { [directiveName: string]: Directive[] };
    private directivesByRoom: { [roomName: string]: Directive[] };
    private directivesByBrain: { [brainName: string]: Directive[] };

    private managers: Manager[];
    private managersByBrain: { [col: string]: Manager[] };

    private _directiveCached: boolean;
    private _managersCached: boolean;

    // combatPlanner: CombatPlanner;
    notifier: Notifier;

    static settings = {
        outpostCheckFrequency: onPublicServer() ? 250 : 100
    };

    constructor() {
        this.memory = Mem.wrap(Memory, 'overseer', getDefaultOverseerMemory);
        this.directives = [];
        this.managers = [];
        this.managersByBrain = {};
        this._managersCached = false;
        this.notifier = new Notifier();
        // this.combatPlanner = new CombatPlanner();
    }

    refresh() {
        this.memory = Mem.wrap(Memory, 'overseer', getDefaultOverseerMemory);
        this.notifier.clear();
    }

    private try(callback: () => any, identifier?: string): void {
        if (USE_TRY_CATCH) {
            try {
                callback();
            } catch (e) {
                if (identifier) {
                    e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
                        + e.name + '\n' + e.stack;
                } else {
                    e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
                }
                BigBrain.errors.push(e);
            }
        } else {
            callback();
        }
    }

    registerDirective(directive: Directive): void {
        this.directives.push(directive);
        this._directiveCached = false;
    }

    removeDirective(directive: Directive): void {
        _.remove(this.directives, dir => dir.name == directive.name);
        for (const name in directive.managers) {
            this.removeManager(directive.managers[name]);
        }
        this._directiveCached = false;
    }

    private ensureDirectivesCached(): void {
        if (!this._directiveCached) {
            this.directivesByType = _.groupBy(this.directives, directive => directive.directiveName);
            this.directivesByRoom = _.groupBy(this.directives, directive => directive.pos.roomName);
            this.directivesByBrain = _.groupBy(this.directives, directive => directive.brain.name || 'none');
            this._directiveCached = true;
        }
    }

    getDirectivesOfType(directiveName: string): Directive[] {
        this.ensureDirectivesCached();
        return this.directivesByType[directiveName] || [];
    }

    getDirectivesInRoom(roomName: string): Directive[] {
        this.ensureDirectivesCached();
        return this.directivesByRoom[roomName] || [];
    }

    getDirectivesForBrain(brain: Brain): Directive[] {
        this.ensureDirectivesCached();
        return this.directivesByBrain[brain.name] || [];
    }

    registerManager(manager: Manager): void {
        this.managers.push(manager);
        this._managersCached = false;
    }

    private removeManager(manager: Manager): void {
        _.remove(this.managers, o => o.ref == manager.ref);
        this._managersCached = false;
    }

    private ensureManagersCached(): void {
        if (!this._managersCached) {
            this.managers.sort((o1, o2) => o1.priority - o2.priority);
            this.managersByBrain = _.groupBy(this.managers, manager => manager.brain.name);
            for (const colName in this.managersByBrain) {
                this.managersByBrain[colName].sort((o1, o2) => o1.priority - o2.priority);
            }
            this._managersCached = true;
        }
    }

    getManagersForBrain(brain: Brain): Manager[] {
        return this.managersByBrain[brain.name] || [];
    }

    init(): void {

        this.ensureDirectivesCached();
        this.ensureManagersCached();

        // Initialize directives
        for (const directive of this.directives) {
            directive.init();
        }

        // Initialize managers
        for (const manager of this.managers) {
            if (!manager.isSuspended) {
                if (manager.profilingActive) {
                    const start = Game.cpu.getUsed();
                    manager.preInit();
                    this.try(() => manager.init());
                    manager.memory[MEM.STATS]!.cpu += Game.cpu.getUsed() - start;
                } else {
                    manager.preInit();
                    this.try(() => manager.init());
                }
            }
        }

        // Register cleanup requests to logistics network
        for (const brain of getAllBrains()) {
            this.registerLogisticsRequest(brain);
        }
    }

    // Operation =======================================================================================================

    run(): void {
        for (const directive of this.directives) {
            directive.run();
        }
        for (const manager of this.managers) {
            if (!manager.isSuspended) {
                if (manager.profilingActive) {
                    const start = Game.cpu.getUsed();
                    this.try(() => manager.run());
                    manager.memory[MEM.STATS]!.cpu += Game.cpu.getUsed() - start;
                } else {
                    this.try(() => manager.run());
                }
            }
        }
        this.placeDirectives();
    }

    private placeDirectives() {
        const allBrains = getAllBrains();
        if (LATEST_BUILD_TICK == Game.time) {
            _.forEach(allBrains, brain => this.placeHarvestingDirectives(brain));
        }

        _.forEach(allBrains, brain => this.handleBootStrapping(brain));

        _.forEach(allBrains, brain => {
            if(Game.time % CEO.settings.outpostCheckFrequency == 2 * brain.id) {
                this.handleNewOutpost(brain);
            }
        })
    }

    private handleNewOutpost(brain: Brain) {
        const numSources = _.sum(brain.roomNames, roomName => Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.SOURCES] ? Memory.rooms[roomName][RMEM.SOURCES]!.length: 0);
        const numRemotes = numSources - brain.room.sources.length;
        if (numRemotes < Brain.settings.remoteSourcesByLevel[brain.level]) {

			const possibleOutposts = this.computePossibleOutposts(brain);

			const origin = brain.pos;
			const bestOutpost = minBy(possibleOutposts, outpostName => {
				const sourceInfo = RoomIntel.getSourceInfo(outpostName);
				if (!sourceInfo) return false;
				const sourceDistances = _.map(sourceInfo, src => Pathing.distance(origin, src.pos));
				if (_.any(sourceDistances, dist => dist == undefined || dist > Brain.settings.maxSourceDistance)) {
					return false;
				}
				return _.sum(sourceDistances) / sourceDistances.length;
			});

			if (bestOutpost) {
				const pos = Pathing.findPathablePosition(bestOutpost);
				log.info(`Brain ${brain.room.print} now remote mining from ${pos.print}`);
				DirectiveOutpost.createIfNotPresent(pos, 'room', {memory: {[MEM.BRAIN]: brain.name}});
			}
		}
    }

    private computePossibleOutposts(brain: Brain, depth = 3): string[] {
		return _.filter(Cartographer.findRoomsInRange(brain.room.name, depth), roomName => {
			if (Cartographer.roomType(roomName) != ROOMTYPE_CONTROLLER) {
				return false;
			}
			const alreadyAnOutpost = _.any(BigBrain.cache.outpostFlags,
										   flag => (flag.memory.setPos || flag.pos).roomName == roomName);
			const alreadyAColony = !!BigBrain.brains[roomName];
			if (alreadyAColony || alreadyAnOutpost) {
				return false;
			}
			const alreadyOwned = RoomIntel.roomOwnedBy(roomName);
			const alreadyReserved = RoomIntel.roomReservedBy(roomName);
			const isBlocked = Game.flags[roomName + '-Block'] != null; // TODO: this is ugly
			if (isBlocked) {
				// Game.notify("Room " + roomName + " is blocked, not expanding there.");
			}
			const disregardReservations = !onPublicServer() || settings.MY_USERNAME == 'Amarantz';
			if (alreadyOwned || (alreadyReserved && !disregardReservations) || isBlocked) {
				return false;
			}
			const neighboringRooms = _.values(Game.map.describeExits(roomName)) as string[];
			const isReachableFromColony = _.any(neighboringRooms, r => brain.roomNames.includes(r));
			return isReachableFromColony && Game.map.isRoomAvailable(roomName);
		});
	}

    private placeHarvestingDirectives(brain: Brain) {
        for (const source of brain.sources) {
            DirectiveHarvest.createIfNotPresent(source.pos, 'pos');
        }
    }

    private registerLogisticsRequest(brain: Brain): void {
        for (const room of brain.rooms) {
            for (const resourceType in room.drops) {
                for (const drop of room.drops[resourceType]) {
                    if (drop.amount > LogisticsNetwork.settings.droppedEnergyThreshold || drop.resourceType != RESOURCE_ENERGY) {
                        brain.logisticsNetwork.requestOutput(drop)
                    }
                }
            }
        }
        for (const tombstone of brain.tombstones) {
            if (tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > LogisticsNetwork.settings.droppedEnergyThreshold || tombstone.store.getUsedCapacity() > tombstone.store.energy) {
                if (brain.bunker && tombstone.pos.isEqualTo(brain.bunker.anchor)) continue;
                brain.logisticsNetwork.requestOutput(tombstone, { resourceType: 'all' });
            }
        }
    }

    private handleBootStrapping(brain: Brain) {
        if (!brain.state.isIncubating) {
            const noQueen = brain.getCreepsByRole(Roles.queen).length == 0;
            if (noQueen && brain.spawner && !brain.spawnGroup) {
                const setup = brain.spawner.manager.queenSetup;
                const energyToMakeQueen = bodyCost(setup.generateBody(brain.room.energyCapacityAvailable));
                if (brain.room.energyAvailable < energyToMakeQueen || hasJustSpawned()) {
                    const result = DirectiveBootstrap.createIfNotPresent(brain.spawner.pos, 'pos');
                    if (typeof result == 'string' || result == OK) { // successfully made flag
                        brain.spawner.settings.suppressSpawning = true;
                    }
                }
            }
        }
    }


    getCreepReport(brain: Brain): string[][] {
        const spoopyBugFix = false;
        const roleOccupancy: { [role: string]: [number, number] } = {};

        for (const manager of this.managersByBrain[brain.name]) {
            for (const role in manager.creepUsageReport) {
                const report = manager.creepUsageReport[role];
                if (report == undefined) {
                    if (Game.time % 100 == 0) {
                        log.info(`Role ${role} is not reported by ${manager.ref}!`);
                    }
                } else {
                    if (roleOccupancy[role] == undefined) {
                        roleOccupancy[role] = [0, 0];
                    }
                    roleOccupancy[role][0] += report[0];
                    roleOccupancy[role][1] += report[1];
                    if (spoopyBugFix) { // bizzarely, if you comment these lines out, the creep report is incorrect
                        log.debug(`report: ${JSON.stringify(report)}`);
                        log.debug(`occupancy: ${JSON.stringify(roleOccupancy)}`);
                    }
                }
            }
        }
        // let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
        const roledata: string[][] = [];
        for (const role in roleOccupancy) {
            const [current, needed] = roleOccupancy[role];
            // if (needed > 0) {
            // 	stringReport.push('| ' + `${role}:`.padRight(padLength) +
            // 					  `${Math.floor(100 * current / needed)}%`.padLeft(4));
            // }
            roledata.push([role, `${current}/${needed}`]);
        }
        return roledata;
    }
}
