import { profile } from 'profiler';
import { Mem } from 'memory/memory';
import { $ } from 'caching/GlobalCache';
import { DirectiveHarvest, HARVEST_MEM } from 'directives/resource/harvest';
import { Component } from 'components/Component';
import { log } from 'console/log';
import { Spawner } from 'components/spawner';
import { Stats, LOG_STATS_INTERVAL } from 'stats/stats';
import { Roles } from 'creepSetup/setup';
import { ALL_ZERO_ASSETS } from 'resources/map_resoures';
import { mergeSum } from 'utils/utils';
import { Manager } from 'managers/Manager';
import { ColonyExpansionData, ExpansionEvaluator, EXPANSION_EVALUATION_FREQ } from 'strategy/ExpansionEvaluation';
import { CombatIntel } from 'intel/CombatIntel';
import { TransportRequestGroup } from 'logistics/TransportRequestGroup';
import { LogisticsNetwork } from 'logistics/LogisticsNetwork';
import { TransportManager } from 'managers/core/transporter';
import { DefaultManager } from 'managers/core/default';
import { Energetics } from 'logistics/Energetics';
import { RandomWalkerScoutManager } from 'managers/scouting/randomWalker';
import { Cartographer, ROOMTYPE_CONTROLLER } from 'utils/Cartographer';
import { UpgradeSite } from 'components/upgradeSite';
import { WorkerManager } from 'managers/core/worker';
import { RoadLogistics } from 'logistics/RoadLagistics';
import { LinkNetwork } from 'logistics/LinkNetwork';
import { CommandCenter } from 'components/CommandCenter';
import { Bot } from 'bot/Bot';
import { RoomPlanner } from 'roomPlanner/RoomPlanner';
import { USE_TRY_CATCH } from 'settings';
import { Oblisk } from 'components/Oblisk';
import { EngineeringBay } from 'components/EngineeringBay';
import { Visualizer } from 'visuals/Visualizer';

export enum brainStage {
    Infant = 0,		// No storage and no incubator
    Child = 1,		// Has storage but RCL < 8
    Adult = 2,		// RCL 8 room
}

export enum DEFCON {
    safe = 0,
    invasionNPC = 1,
    boostedInvasionNPC = 2,
    playerInvasion = 2,
    bigPlayerInvasion = 3,
}

export const getAllBrains = (): Brain[] => {
    return _.values(BigBrain.brains);
}


export interface BrainMemory {
    debug?: boolean;
    defcon: {
        level: number,
        tick: number,
    },
    expansionData: ColonyExpansionData;
    maxLevel: number;
    outposts: { [roomName: string]: OutpostData };
    suspend?: boolean;
}

// Outpost that is currently not being maintained
export interface OutpostData {
    active: boolean;
    suspendReason?: OutpostDisableReason;
    [MEM.EXPIRATION]?: number; // Tick to recalculate
}

export enum OutpostDisableReason {
    active = 'active',
    inactiveCPU = 'i_cpu', // CPU limitations
    inactiveUpkeep = 'i_upkeep', // room can't sustain this remote because rebooting, spawn pressure, etc
    inactiveHarassment = 'i_harassment',
    inactiveStronghold = 'i_stronghold',
}

const getDefaultBrainMemory = (): BrainMemory => ({
    defcon: {
        level: DEFCON.safe,
        tick: -Infinity
    },
    expansionData: {
        possibleExpansions: {},
        expiration: 0,
    },
    maxLevel: 0,
    outposts: {},
}
);

export interface Assets {
    energy: number;
    power: number;
    ops: number;

    [resourceType: string]: number;
}

export interface BunkerData {
    anchor: RoomPosition;
    rightSpawn: StructureSpawn | undefined;
    leftSpawn: StructureSpawn | undefined;
    bottomSpawn: StructureSpawn | undefined;
}

@profile
export class Brain {
    name: string;
    ref: string;
    memory: BrainMemory;
    room: Room;
    rooms: Room[];
    creeps: Creep[];
    flags: Flag[];
    creepsByRoles: { [roleName: string]: Creep[] };
    controller: StructureController;
    spawns: StructureSpawn[];
    pos: RoomPosition;
    storage: StructureStorage | undefined;
    terminal: StructureTerminal | undefined;
    sources: Source[];
    constructionSites: ConstructionSite[];
    tombstones: Tombstone[];
    repairables: Structure[];
    rechargeables: rechargeObjectType[];
    destinations: { pos: RoomPosition, order: number }[];
    miningSites: { [flagName: string]: any };
    spawnGroup: undefined;
    extractionSites: { [flagName: string]: any };
    components: Component[];
    drops: {
        [resourceType: string]: Resource[];
    };
    spawner: Spawner;
    commandCenter: CommandCenter;
    upgradeSite: UpgradeSite;
    bunker: BunkerData;
    roomPlanner: any;
    level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    assets: Assets;
    powerSpawn: StructurePowerSpawn | undefined;
    extensions: StructureExtension[];
    links: StructureLink[];
    availableLinks: StructureLink[];
    towers: StructureTower[];
    managers: {
        default: DefaultManager,
        work: WorkerManager,
        logistics: TransportManager,
        scout?: RandomWalkerScoutManager,
    };
    id: number;
    roomNames: string[];
    stage: brainStage;
    state: {
        bootstrapping?: boolean;
        isIncubating?: boolean;
        lowPowerMode?: boolean;
        isRebuilding?: boolean;
        isEvacuating?: boolean;
        isBeingNuked?: boolean;
    };
    extractors: StructureExtractor[];
    defcon: number;
    transportRequest: TransportRequestGroup;
    logisticsNetwork: LogisticsNetwork;
    labs: StructureLab[];
    factory: StructureFactory | undefined;
    outposts: Room[];
    observer: StructureObserver | undefined;
    roadLogistics: RoadLogistics;
    linkNetwork: LinkNetwork;
    nuker: StructureNuker | undefined;
    layout: 'twoPart' | 'bunker';

    static settings = {
        remoteSourcesByLevel: {
            1: 1,
            2: 2,
            3: 3,
            4: 4,
            5: 5,
            6: 6,
            7: 7,
            8: 9,
        },
        maxSourceDistance: 100
    };
    towersComponent: Oblisk;
    engineeringBay: EngineeringBay;

    constructor(id: number, roomName: string, outpost: string[]) {
        this.room = Game.rooms[roomName];
        this.id = id;
        this.ref = roomName;
        this.name = roomName;
        this.rooms = [this.room];
        this.flags = [];
        this.level = 1;
        this.memory = Mem.wrap(Memory.brains, this.name, getDefaultBrainMemory);
        this.spawnGroup = undefined;
        this.layout = 'bunker';
        global[this.name] = this;
        global[this.name.toLowerCase()] = this;
        this.build(outpost);
    }

    get print(): string {
        return `<a href="#!/room/${Game.shard.name}/${this.room.name}">[${this.name}]</a>`
    }

    protected debug(...args: any[]) {
        if (this.memory.debug) {
            log.alert(this.print, args);
        }
    }

    toString(): string {
        return this.print;
    }

    get printAligned(): string {
        const msg = '<a href="#!/room/' + Game.shard.name + '/' + this.room.name + '">[' + this.name + ']</a>';
        const extraSpaces = 'E12S34'.length - this.room.name.length;
        return msg + ' '.repeat(extraSpaces);
    }

    build(outpost: string[]) {
        this.miningSites = {};
        this.roomNames = [this.room.name].concat(outpost);
        this.outposts = _.compact(_.map(outpost, outpost => Game.rooms[outpost]));
        this.rooms = [this.room].concat(this.outposts);
        this.extractionSites = {};
        this.creeps = BigBrain.cache.creepsByBrain[this.name] || [];
        this.destinations = [];
        this.creepsByRoles = _.groupBy(this.creeps, creep => creep.memory.role);
        this.controller = this.room.controller!;
        this.extensions = this.room.extensions;
        this.links = this.room.links;
        this.availableLinks = _.clone(this.room.links);
        this.towers = this.room.towers;
        this.nuker = this.room.nuker;
        $.set(this, 'spawns', () => _.sortBy(_.filter(this.room.spawns, spawn => spawn.my && spawn.isActive()), spawn => spawn.ref));
        $.set(this, 'storage', () => this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined);
        $.set(this, 'terminal', () => this.room.terminal && this.room.terminal.isActive() ? this.room.terminal : undefined);
        $.set(this, 'factory', () => this.room.factory && this.room.factory.isActive() ? this.room.factory : undefined);
        $.set(this, 'labs', () => _.sortBy(_.filter(this.room.labs, lab => lab.my && lab.isActive), lab => 50 * lab.pos.y + lab.pos.x));
        this.pos = (this.storage || this.terminal || this.spawns[0] || this.controller).pos;
        $.set(this, 'sources', () => _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)), source => source.pos.getMultiRoomRangeTo(this.pos)));
        $.set(this, 'extractors', () => _(this.rooms)
            .map(room => room.extractor)
            .compact()
            .filter(e => (e!.my && e!.room.my) || Cartographer.roomType(e!.room.name) != ROOMTYPE_CONTROLLER)
            .sortBy(e => e!.pos.getMultiRoomRangeTo(this.pos)).value() as StructureExtractor[]);
        $.set(this, 'repairables', () => _.flatten(_.map(this.rooms, room => room.repairables)));
        $.set(this, 'rechargeables', () => _.flatten(_.map(this.rooms, room => room.rechargeables)));
        $.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
        $.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
        this.drops = _.merge(_.map(this.rooms, room => room.drops));
        this.assets = this.computeAssets();
        this.registerOperationalState();
        this.registerUtilities();
        this.registerComponents();
    }


    refresh(): void {
        this.memory = Mem.wrap(Memory.brains, this.room.name, getDefaultBrainMemory);
        // Refresh rooms
        this.room = Game.rooms[this.room.name];
        const outpostRoomNames = _.filter(this.roomNames, roomName => this.room.name != roomName);
		this.outposts =  _.compact(_.map(outpostRoomNames, outpost => Game.rooms[outpost]));
		this.rooms = [this.room].concat(this.outposts);
        this.creeps = this.creeps = BigBrain.cache.creepsByBrain[this.name] || [];
        this.creepsByRoles = _.groupBy(this.creeps, creep => creep.memory.role);
        $.refresh(this, 'controller', 'extensions', 'links', 'towers', 'spawns', 'storage', 'sources', 'repairables', 'rechargeables', 'powerSpawn', 'extractors', 'factory', 'labs', 'constructionSites');
        $.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
        $.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
        this.drops = _.merge(_.map(this.rooms, room => room.drops));
        this.assets = this.computeAssets();
        this.registerOperationalState();
        this.refreshUtilities();
        this.refreshComponents();
    }

    getCreepsByRole(roleName: string): Creep[] {
        return this.creepsByRoles[roleName] || [];
    }

    getBotsByRole(roleName: string): (Bot | undefined)[] {
        return _.map(this.getCreepsByRole(roleName), creep => BigBrain.bots[creep.name]);
    }

    private registerOperationalState() {
        this.level = this.controller.level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
        if (this.storage && this.spawns[0]) {
            if (this.controller.level == 8) {
                this.stage = brainStage.Adult;
            } else {
                this.stage = brainStage.Child;
            }
        } else {
            this.stage = brainStage.Infant;
        }
        let defcon = DEFCON.safe;
        const defconDecayTime = 200;
        if (this.room.dangerousHostiles.length > 0 && !this.controller.safeMode) {
            const effectiveHostileCount = _.sum(this.room.dangerousHostiles,
                hostile => CombatIntel.uniqueBoosts(hostile).length > 0 ? 2 : 1);
            if (effectiveHostileCount >= 3) {
                defcon = DEFCON.boostedInvasionNPC;
            } else {
                defcon = DEFCON.invasionNPC;
            }
        }
        if (this.memory.defcon) {
            if (defcon < this.memory.defcon.level) { // decay defcon level over time if defcon less than memory value
                if (this.memory.defcon.tick + defconDecayTime < Game.time) {
                    this.memory.defcon.level = defcon;
                    this.memory.defcon.tick = Game.time;
                }
            } else if (defcon > this.memory.defcon.level) { // refresh defcon time if it increases by a level
                this.memory.defcon.level = defcon;
                this.memory.defcon.tick = Game.time;
            }
        } else {
            this.memory.defcon = {
                level: defcon,
                tick: Game.time
            };
        }
        this.defcon = this.memory.defcon.level;

        this.state = {};
        if (Energetics.lowPowerMode(this)) {
            this.state.lowPowerMode = true;
        }
    }
    private computeAssets(verbose = false): Assets {
        // Include storage structures, lab contents, and manager carry
        const assetStructures = _.compact([
            this.storage,
            this.terminal,
            this.factory,
            ...this.labs
        ]);
        const assetCreeps = [
            ...this.getCreepsByRole(Roles.queen),
            ...this.getCreepsByRole(Roles.manager)
        ];
        const assetStores = _.map([...assetStructures, ...assetCreeps], thing => thing!.store);
        // @ts-ignore
        const allAssets = mergeSum([...assetStores, ALL_ZERO_ASSETS]) as Assets;

        if (verbose) log.debug(`${this.room.print} assets: ` + JSON.stringify(allAssets));
        return allAssets;
    }

    private registerComponents() {
        this.components = [];

        if (this.storage) {
            this.commandCenter = new CommandCenter(this, this.storage);
        }
        if (this.spawns[0]) {
            this.spawner = new Spawner(this, this.spawns[0]);
        }

        if (this.terminal && _.filter(this.labs, lab => _.all(this.labs, otherLab => lab.pos.inRangeTo(otherLab,2))).length >= 3){
            this.engineeringBay = new EngineeringBay(this, this.terminal!);
        }

        this.upgradeSite = new UpgradeSite(this, this.controller);

        if(this.towers[0]) {
            this.towersComponent = new Oblisk(this, this.towers[0])
        }

        this.components.reverse();
    }

    private refreshComponents() {
        for (let i of this.components) {
            i.refresh();
        }
    }

    init(): void {
        _.forEach(this.components, component =>
            this.try(() =>  component.init()
        ));	// Initialize each hive cluster
        this.try(() => this.roadLogistics.init());											// Initialize the road network
        this.try(() => this.linkNetwork.init());											// Initialize link network
        this.try(() => this.roomPlanner.init());											// Initialize the room planner
        if (Game.time % EXPANSION_EVALUATION_FREQ == 5 * this.id) {			// Re-evaluate expansion data if needed
            ExpansionEvaluator.refreshExpansionData(this.memory.expansionData, this.room.name);
        }
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

    /**
	 * Returns whether a room is part of this colony and is actively being maintained
	 */
    isRoomActive(roomName: string): boolean {
        if (roomName == this.room.name) {
            return true;
        } else if (!this.roomNames.includes(roomName)) {
            return false;
        } else {
            return this.memory.outposts[roomName] && this.memory.outposts[roomName].active;
        }
    }



    run() {
        _.forEach(this.components, component => component.run());
        this.linkNetwork.run();												// Run the link network
        this.roadLogistics.run();
        this.stats();
    }

    higherManagers() {
        this.managers = {
            default: new DefaultManager(this),
            work: new WorkerManager(this),
            logistics: new TransportManager(this),
        }

        if (!this.observer) {
            this.managers.scout = new RandomWalkerScoutManager(this);
        }

        for (const component of this.components) {
            component.higherManagers();
        }
    }

    private registerUtilities(): void {
        this.linkNetwork = new LinkNetwork(this);
        this.logisticsNetwork = new LogisticsNetwork(this);
        this.transportRequest = new TransportRequestGroup();
        this.roadLogistics = new RoadLogistics(this);
    }

    private refreshUtilities(): void {
        this.linkNetwork.refresh();
        this.logisticsNetwork.refresh();
        this.transportRequest.refresh();
        this.roomPlanner = new RoomPlanner(this);
        this.layout = 'twoPart';
        this.roadLogistics.refresh();
    }

    /**
 * Register colony-wide statistics
 */
    stats(): void {
        if (Game.time % LOG_STATS_INTERVAL == 0) {
            // Log energy and rcl
            Stats.log(`brains.${this.name}.storage.energy`, this.storage ? this.storage.energy : undefined);
            Stats.log(`brains.${this.name}.rcl.level`, this.controller.level);
            Stats.log(`brains.${this.name}.rcl.progress`, this.controller.progress);
            Stats.log(`brains.${this.name}.rcl.progressTotal`, this.controller.progressTotal);
            // Log average miningSite usage and uptime and estimated colony energy income
            const numSites = _.keys(this.miningSites).length;
            const avgDowntime = _.sum(this.miningSites, site => site.memory[HARVEST_MEM.DOWNTIME]) / numSites;
            const avgUsage = _.sum(this.miningSites, site => site.memory[HARVEST_MEM.USAGE]) / numSites;
            const energyInPerTick = _.sum(this.miningSites,
                site => site.managers.mine.energyPerTick * site.memory[HARVEST_MEM.USAGE]);
            Stats.log(`brains.${this.name}.miningSites.avgDowntime`, avgDowntime);
            Stats.log(`brains.${this.name}.miningSites.avgUsage`, avgUsage);
            Stats.log(`brains.${this.name}.miningSites.energyInPerTick`, energyInPerTick);
            Stats.log(`brains.${this.name}.assets`, this.assets);
            Stats.log(`brains.${this.name}.energyAvailable`, this.room.energyAvailable);
            // Log defensive properties
            Stats.log(`brains.${this.name}.defcon`, this.defcon);
            Stats.log(`brains.${this.name}.threatLevel`, this.room.threatLevel);
            const avgBarrierHits = _.sum(this.room.barriers, barrier => barrier.hits) / this.room.barriers.length;
            Stats.log(`brains.${this.name}.avgBarrierHits`, avgBarrierHits);
        }
    }

    private drawCreepReport(coord: Coord): Coord {
		let {x, y} = coord;
		const roledata = BigBrain.CEO.getCreepReport(this);
		const tablePos = new RoomPosition(x, y, this.room.name);
		y = Visualizer.infoBox(`${this.name} Creeps`, roledata, tablePos, 7);
		return {x, y};
	}

    visuals(): void {
		let x = 1;
		let y = 1;
		let coord: Coord;
		coord = this.drawCreepReport({x, y});
		x = coord.x;
		y = coord.y;

		for (const component of _.compact([this.spawner, this.commandCenter, this.engineeringBay])) {
			coord = component!.visuals({x, y});
			x = coord.x;
			y = coord.y;
		}
	}
}
