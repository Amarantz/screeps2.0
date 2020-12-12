/* eslint-disable sort-imports */
import "./prototypes/Creep";
import "./prototypes/Miscellaneous";
import "./prototypes/Room";
import "./prototypes/RoomObjects";
import "./prototypes/RoomPosition";
import "./prototypes/RoomStructures";
import "./prototypes/Structures";
import "./globals";
import * as Profiler from "profiler/Profiler";
import { BigBrain as _BigBrain } from "BigBrain";
import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory/memory";
import profiler from "screeps-profiler";
import { init } from "profiler/Profiler";
import stats from './stats/stats.js';

global.Profiler = Profiler.init();
const onGlobalReset = () => {
  delete global.BigBrain;
  Mem.format();
  global.BigBrain = new _BigBrain();
};

const main = (): void => {
  Mem.load();
  if (!Mem.shouldRun()) return;
  Mem.clean();
  if (!BigBrain || BigBrain.shouldBuild || Game.time >= BigBrain.expiration) {
    delete global.BigBrain;
    global.BigBrain = new _BigBrain();
    BigBrain.build();
  } else {
    BigBrain.refresh();
  }
  BigBrain.init();
  BigBrain.run();
  stats();
  BigBrain.postRun();
};

export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(() => main());
});

onGlobalReset();
