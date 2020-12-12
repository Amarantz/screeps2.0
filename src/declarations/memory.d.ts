/* eslint-disable @typescript-eslint/ban-types */
declare const enum _MEM {
  TICK = "T",
  EXPIRATION = "X",
  BRAIN = "B",
  DISTANCE = "D"
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
  role: string;
  room?: string;
  working?: boolean;
  [_MEM.BRAIN]?: string;
  sourceId?: any;
}

interface FlagMemory {
  [_MEM.TICK]?: number;
  [_MEM.EXPIRATION]?: number;
  [_MEM.BRAIN]?: string;
  maxLinearRange?: number;
  maxPathLength?: number;
  persistent?: boolean;
  suspendUntil?: number;
  setPosition?: ProtoPos;
  waypoints?: string[];
}

interface Memory {
  uuid: number;
  log: any;
  BigBrain: {};
  pods: { [name: string]: any };
  creeps: { [name: string]: CreepMemory };
  flags: { [name: string]: FlagMemory };
  rooms: { [name: string]: RoomMemory };
  spawns: { [name: string]: SpawnMemory };
  pathing: PathingMemory;
  settings: {
    signature: string;
  };
  stats: any;
  constructionSites: { [id: string]: number };
  resetBucket?: boolean;
  haltTick?: number;
  combatPlanner: any;
  [otherProperty: string]: any;
}

interface StatsMemory {
  cpu: {
    getUsed: number;
    lmit: number;
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
  pods: {
    [podName: string]: {
      hatchery: {
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
  paths: { [originName: string]: { [destinationName: string]: CachedPath } };
  distances: { [pos1Name: string]: { [pos2Name: string]: number } };
  weightedDistances: { [pos1Name: string]: { [pos2Name: string]: number } };
}
