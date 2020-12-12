import { profile } from 'profiler';
import { Mem } from 'memory/memory';
import { $ } from 'caching/GlobalCache';
import { DirectiveHarvest } from 'directives/resource/harvest';

export enum DEFCON {
    safe,
    invasionNPC,
    boostedNPC,
    playerInvasion,
    bigPlayerInvasion,
}


export interface BrainMemory{
    defcon: {
        level: number,
        tick: number,
    }
}

const defaultBrainMemory: BrainMemory = {
    defcon: {
        level: DEFCON.safe,
        tick: -Infinity
    }
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
    drops: {
        [resourceType: string]: Resource[];
    };

    constructor(roomName: string) {
        const room = Game.rooms[roomName];
        this.ref = roomName;
        this.name = roomName;
        this.room = room;
        this.rooms = [this.room];
        this.flags = [];
        this.memory = Mem.wrap(Memory.brains, this.name, defaultBrainMemory);
        this.build();
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
    }


    refresh():void {
        this.memory = Mem.wrap(Memory.brains, this.room.name, defaultBrainMemory, true);
		// Refresh rooms
        this.room = Game.rooms[this.room.name];
        this.creeps = this.creeps = BigBrain.cache.creepsByBrain[this.name] || [];
        this.creepsByRoles = _.groupBy(this.creeps, creep => creep.memory.role);
        $.refresh(this, 'controller', 'spawns', 'storage', 'sources', 'repairables', 'rechargeables');
        $.set(this, 'constructionSites', () => _.flatten(_.map(this.rooms, room => room.constructionSites)), 10);
        $.set(this, 'tombstones', () => _.flatten(_.map(this.rooms, room => room.tombstones)), 5);
        // console.log(JSON.stringify(this.sources));
        this.drops = _.merge(_.map(this.rooms, room => room.drops));
    }
}
