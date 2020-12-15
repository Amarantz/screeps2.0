import { profile } from 'profiler';
import { Mem } from 'memory/memory';
import { $ } from 'caching/GlobalCache';
import { DirectiveHarvest } from 'directives/resource/harvest';
import { Component } from 'components/Component';
import { log } from 'console/log';
import { Spawner } from 'components/spawner';

export enum DEFCON {
    safe,
    invasionNPC,
    boostedNPC,
    playerInvasion,
    bigPlayerInvasion,
}

export const getAllBrains = () => {
    return Object.values(BigBrain.brains);
}


export interface BrainMemory{
    debug?: boolean;
    defcon: {
        level: number,
        tick: number,
    }
}

const getDefaultBrainMemory = (): BrainMemory => ({
    defcon: {
        level: DEFCON.safe,
        tick: -Infinity
    }
}
);

export interface BunkerData {
	anchor: RoomPosition;
	topSpawn: StructureSpawn | undefined;
	coreSpawn: StructureSpawn | undefined;
	rightSpawn: StructureSpawn | undefined;
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
    creepsByRoles: {[roleName:string]: Creep[]};
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
    destinations: {pos: RoomPosition, order:number}[];
    miningSites: {[flagName: string]: any};
    extractionSites: {[flagName: string]: any};
    components: Component[];
    drops: {
        [resourceType: string]: Resource[];
    };
    spawner: Spawner;
    bunker: BunkerData;
    roomPlanner: any;
    level: 1|2|3|4|5|6|7|8;

    constructor(roomName: string) {
        const room = Game.rooms[roomName];
        this.ref = roomName;
        this.name = roomName;
        this.room = room;
        this.rooms = [this.room];
        this.flags = [];
        this.level = 1;
        this.memory = Mem.wrap(Memory.brains, this.name, getDefaultBrainMemory);
        this.build();
    }

    get print(): string {
        return `<a href="#!/room/${Game.shard.name}/${this.room.name}">[${this.name}]</a>`
    }

    protected debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
	}

    build() {
        this.miningSites = {};
        this.extractionSites = {};
        this.creeps = BigBrain.cache.creepsByBrain[this.name] || [];
        this.creepsByRoles = _.groupBy(this.creeps, creep => creep.memory.role);
        this.controller = this.room.controller!;
        $.set(this, 'spawns', () => _.sortBy(_.filter(this.room.spawns, spawn => spawn.my && spawn.isActive()), spawn => spawn.ref));
        $.set(this, 'storage', () => this.room.storage && this.room.storage.isActive() ? this.room.storage : undefined);
        $.set(this, 'terminal', () => this.room.terminal && this.room.terminal.isActive() ? this.room.terminal : undefined);
        this.pos = (this.storage || this.terminal || this.spawns[0] || this.controller).pos;
        $.set(this, 'sources', () => _.sortBy(_.flatten(_.map(this.rooms, room => room.sources)), source => source.pos.getMultiRoomRangeTo(this.pos)));
        _.forEach(this.sources, source => {
            // console.log(JSON.stringify(source))
            DirectiveHarvest.createIfNotPresent(source.pos, 'pos');
        })
        $.set(this, 'repairables', () => _.flatten(_.map(this.rooms, room => room.repairables)));
        $.set(this, 'rechargeables', () => _.flatten(_.map(this.rooms, room => room.rechargeables)));
        $.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
        $.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
        this.drops = _.merge(_.map(this.rooms, room => room.drops));
        this.registerComponents();
    }


    refresh():void {
        this.memory = Mem.wrap(Memory.brains, this.room.name, getDefaultBrainMemory);
		// Refresh rooms
        this.room = Game.rooms[this.room.name];
        this.creeps = this.creeps = BigBrain.cache.creepsByBrain[this.name] || [];
        this.creepsByRoles = _.groupBy(this.creeps, creep => creep.memory.role);
        $.refresh(this, 'controller', 'spawns', 'storage', 'sources', 'repairables', 'rechargeables');
        $.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
        $.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
        // console.log(JSON.stringify(this.sources));
        this.drops = _.merge(_.map(this.rooms, room => room.drops));
        this.refreshComponents();
    }

    private registerComponents() {
        this.components = [];
        if(this.spawns[0]){
            this.spawner = new Spawner(this, this.spawns[0]);
        }

        this.components.reverse();
    }

    private refreshComponents() {
        for(let i of this.components) {
            i.refresh();
        }
    }
}
