/* eslint-disable sort-imports */
global.LATEST_BUILD_TICK = Game.time;
global.PHASE = 'assimilating';
import "./globals";
import "./prototypes/Creep";
import "./prototypes/Game";
import "./prototypes/PowerCreep";
import "./prototypes/Miscellaneous";
import "./prototypes/Room";
import "./prototypes/RoomObjects";
import "./prototypes/RoomPosition";
import "./prototypes/RoomStructures";
import "./prototypes/Structures";
import "./prototypes/RoomVisual";
import * as Profiler from "profiler/Profiler";
import { BigBrain as _BigBrain } from "BigBrain";
import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory/memory";
import profiler from "screeps-profiler";
import { Stats } from './stats/stats.js';
import { USE_SCREEPS_PROFILER } from "settings";

const onGlobalReset = () => {
  global.LATEST_GLOBAL_RESET_TICK = Game.time;
  global.LATEST_GLOBAL_RESET_DATE = new Date();
  if (USE_SCREEPS_PROFILER) profiler.enable();
  delete global.BigBrain;
  Mem.format();
  Memory.stats.persistent.lastGlobalReset = Game.time;
  global.BigBrain = new _BigBrain();
};

const main = (): void => {
  Mem.load();
  if (!Mem.shouldRun()) return;
  Mem.clean();
  if (!BigBrain || BigBrain.shouldBuild || Game.time >= BigBrain.expiration) {
    PHASE = 'build';
    delete global.BigBrain;
    Mem.garbageCollect(true);
    global.BigBrain = new _BigBrain();
    BigBrain.build();
    LATEST_BUILD_TICK = Game.time;
  } else {
    PHASE = 'refresh';
    BigBrain.refresh();
  }
  PHASE = 'init';
  BigBrain.init();
  PHASE = 'run';
  BigBrain.run();
  PHASE = 'postRun';
  Stats.run();
  Memory.tick++;

  BigBrain.postRun();
};

let _loop: () => void;
if(USE_SCREEPS_PROFILER) {
  _loop = () => profiler.wrap(main);
} else {
  _loop = main;
}
export const loop = _loop;


onGlobalReset();
