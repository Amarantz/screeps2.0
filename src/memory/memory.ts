/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import SETTINGS from "../settings";
import { profile } from "../profiler/Profiler";

let lastMemory: any;
let lastTime = 0;

const MAX_BUCKET = 10000;
const HEAP_CLEAN_FREQUENCY = 200;
const BUCKET_CLEAR_CACHE = 7000;
const BUCKET_CPU_HALT = 4000;

@profile
export class Mem {
  public static shouldRun() {
    let shouldRun = true;
    if (Game.cpu.bucket < 500) {
      if (_.keys(Game.spawns).length > 1 && !Memory.resetBucket && !Memory.haltTick) {
        Memory.resetBucket = true;
        Memory.haltTick = Game.time + 1;
      }
      shouldRun = false;
    }
    if (Memory.resetBucket) {
      if (Game.cpu.bucket < MAX_BUCKET - Game.cpu.limit) {
        console.log(`Operation suspended until bucket recovery. Bucket: ${Game.cpu.bucket}/${MAX_BUCKET}`);
        shouldRun = false;
      } else {
        delete Memory.resetBucket;
      }
    }
    if (Memory.haltTick) {
      if (Memory.haltTick === Game.time) {
        (<any>Game.cpu).halt(); // TODO: remove any typing when typed-screeps updates to include this method
        shouldRun = false;
      } else if (Memory.haltTick < Game.time) {
        delete Memory.haltTick;
      }
    }

    return shouldRun;
  }

  /**
   * Attempt to load the parsed memory from a previous tick to avoid parsing costs
   */
  public static load() {
    if (lastTime && lastMemory && Game.time === lastTime + 1) {
      delete global.Memory;
      global.Memory = lastMemory;
      RawMemory._parsed = lastMemory;
    } else {
      Memory.rooms; // forces parsing
      lastMemory = RawMemory._parsed;
      Memory.stats.persistent.lastMemoryReset = Game.time;
    }
    lastTime = Game.time;
    // Handle global time
    if (!global.age) {
      global.age = 0;
    }
    global.age++;
    Memory.stats.persistent.globalAge = global.age;
  }

  public static garbageCollect(quick?: boolean) {
    if (global.gc) {
      // sometimes garbage collection isn't available
      const start = Game.cpu.getUsed();
      global.gc(quick);
      console.debug(
        `Running ${quick ? "quick" : "FULL"} garbage collection. ` + `Elapsed time: ${Game.cpu.getUsed() - start}.`
      );
    } else {
      console.debug(`Manual garbage collection is unavailable on this server.`);
    }
  }

  private static _setDeep(object: any, keys: string[], value: any): void {
    const key = _.first(keys);
    keys = _.drop(keys);
    if (keys.length === 0) {
      // at the end of the recursion
      object[key] = value;
      return;
    } else {
      if (!object[key]) {
        object[key] = {};
      }
      return Mem._setDeep(object[key], keys, value);
    }
  }

  /**
   * Recursively set a value of an object given a dot-separated key, adding intermediate properties as necessary
   * Ex: Mem.setDeep(Memory.colonies, 'E1S1.miningSites.siteID.stats.uptime', 0.5)
   */
  public static setDeep(object: any, keyString: string, value: any): void {
    const keys = keyString.split(".");
    return Mem._setDeep(object, keys, value);
  }

  public static clean(): void {
    this.cleanCreeps();
  }

  private static cleanCreeps(): void {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  }

  public static format(): void {
    this.formatDefaultMemory();
    this.formatPathingMemory();
    if (!Memory.settings) {
      Memory.settings = {} as any;
    }
    Memory.settings.signature = SETTINGS.SIGNATURE;
    if (!Memory.stats) {
      Memory.stats = {};
    }
    if (!Memory.stats.persistent) {
      Memory.stats.persistent = {};
    }

    this.initGlobalMemory();
  }

  private static formatDefaultMemory() {
    if (!Memory.room) {
      Memory.room = {};
    }

    if (!Memory.creeps) {
      Memory.creeps = {};
    }

    if (!Memory.flags) {
      Memory.flags = {};
    }

    if (!Memory.constructionSites) {
      Memory.constructionSites = {};
    }

    if (!Memory.brains) {
      Memory.brains = {};
    }

    if (!Memory.BigBrain) {
      Memory.BigBrain = {};
    }
  }

  private static formatPathingMemory() {
    if (!Memory.pathing) {
      Memory.pathing = {} as PathingMemory; // Hacky workaround
    }
    _.defaults(Memory.pathing, {
      paths: {},
      distances: {},
      weightedDistances: {}
    });
  }

  public static wrap(memory: any, memName: string, defaults = {}, deep = false): any {
    if (!memory[memName]) {
      memory[memName] = _.clone(defaults);
    }
    if (deep) {
      _.defaultsDeep(memory[memName], defaults);
    } else {
      _.defaults(memory[memName], defaults);
    }
    return memory[memName];
  }

  private static initGlobalMemory() {
    global._cache = {
      accessed: {},
      expiration: {},
      structures: {},
      numbers: {},
      lists: {},
      costMatrices: {},
      roomPositions: {},
      things: {}
    } as IGlobalCache;
  }
}
