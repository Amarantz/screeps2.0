/* eslint-disable @typescript-eslint/ban-types */
declare const enum MEM {
  TICK = "T",
  EXPIRATION = "X",
  BRAIN = "B",
  DISTANCE = "D",
  MANAGER = "M",
  STATS = "S"
}

declare const enum MEM_DISTANCE {
	UNWEIGHTED = 'u',
	WEIGHTED   = 'w',
}

declare const enum _RM {
  AVOID = "a",
  SOURCES = "s",
  CONTROLLER = "c",
  MINERAL = "m",
  SK_LAIRS = "k",
  EXPANSION_DATA = "e",
  INVASION_DATA = "i",
  HARVEST = "h",
  CASUALTIES = "d",
  SAFETY = "f",
  PREV_POSITIONS = "p",
  CREEPS_IN_ROOM = "cr",
  IMPORTANT_STRUCTURES = "i",
  PORTALS = "pr"
}
interface RawMemory {
  _parsed: any;
}
// memory extension samples
interface CreepMemory {
	[MEM.MANAGER]?: string | null;
	[MEM.BRAIN]?: string | null;
	role: string;
	task?: ProtoTask | null;
	sleepUntil?: number;
	needBoosts?: ResourceConstant[];
	data?: {
		origin: string;
	};
	avoidDanger?: {
		start: number;
		timer: number;
		fallback: string;
	};
	noNotifications?: boolean;
	_go?: MoveData;
	debug?: boolean;
  talkative?: boolean;
  sourceId?: string;
  working?: boolean;
}

interface FlagMemory {
  [MEM.TICK]?: number;
  [MEM.EXPIRATION]?: number;
  [MEM.BRAIN]?: string;
  [MEM.DISTANCE]?: {
		[MEM_DISTANCE.UNWEIGHTED]: number;
		[MEM_DISTANCE.WEIGHTED]: number;
		[MEM.EXPIRATION]: number;
		incomplete?: boolean;
	};
	debug?: boolean;
	amount?: number;
	persistent?: boolean;
	setPos?: ProtoPos;
	rotation?: number;
	parent?: string;
	maxPathLength?: number;
	pathNotRequired?: boolean;
	maxLinearRange?: number;
	keepStorageStructures?: boolean;
	keepRoads?: boolean;
	keepContainers?: boolean;
	// waypoints?: string[];
	allowPortals?: boolean;
  recalcBrainOnTick?: number;
}

/**
 * TODO make this an enum
 * 0: Basic
 * 1: Collect from enemy storage/terminal
 * 2: Collect from all sources TBD
 * 3: Collect all and mine walls for energy TBD
 */
type resourceCollectionMode = number;

interface Memory {
  tick: number,
  build: number,
  BigBrain: {},
  combatPlanner: any,
  profiler: any,
  ceo: any,
  segmenter: any,
  roomIntel: any,
  brains: {[name:string]: any},
  rooms: { [name:string]: RoomMemory },
  creeps: {[creepName:string]: CreepMemory },
  powerCreeps: { [creepName:string]: CreepMemory},
  flags: {[name:string]: FlagMemory },
  spawns: {[name:string]: SpawnMemory },
  pathing: PathingMemory,
  resetBucket?: boolean;
	haltTick?: number;
  constructionSites: {[id: string]: number},
  stats: any,
	playerCreepTracker: { // TODO revisit for a better longterm solution
		[playerName: string]: CreepTracker
  };
  screepsProfiler?: any;
  settings: {
    signature: string,
    log: any,
    resourceCollectionMode: resourceCollectionMode,
    allies: string[],
    powerCollection: {
      enabled: boolean,
      maxRange: number,
      minPower: number,
    },
    autoPoison: {
      enabled: boolean,
      maxRange: number,
      maxConcurrent: number,
    },
  },
}

interface StatsMemory {
  cpu: {
    getUsed: number;
    limit: number;
    bucket: number;
    usage: {
      [podName: string]: {
        init: number;
        run: number;
      };
    };
  };
  gcl: {
    progress: number;
    progressTotal: number;
    level: number;
  };
  brains: {
    [brainName: string]: {
      spawner: {
        uptime: number;
      };
      miningSite: {
        usage: number;
        downtime: number;
      };
      storage: {
        energy: number;
      };
      rcl: {
        level: number;
        progress: number;
        progressTotal: number;
      };
    };
  };
}
interface RoomMemory {
  [_RM.AVOID]: boolean;
}

interface CachedPath {
  path: RoomPosition[];
  length: number;
  tick: number;
}

interface PathingMemory {
  paths?: { [originName: string]: { [destinationName: string]: CachedPath } };
  distances: { [pos1Name: string]: { [pos2Name: string]: number } };
  weightedDistances?: { [pos1Name: string]: { [pos2Name: string]: number } };
}


interface MoveData {
	state: any[];
	path: string;
	roomVisibility: { [roomName: string]: boolean };
	delay?: number;
	fleeWait?: number;
	destination?: ProtoPos;
	priority?: number;
	// waypoints?: string[];
	// waypointsVisited?: string[];
	portaling?: boolean;
}
