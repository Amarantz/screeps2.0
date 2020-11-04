/* eslint-disable sort-imports */
import "./prototypes/Creep";
import "./prototypes/Miscellaneous";
import "./prototypes/Room";
import "./prototypes/RoomObjects";
import "./prototypes/RoomPosition";
import "./prototypes/RoomStructures";
import "./prototypes/Structures";
import * as Profiler from "profiler/Profiler";
import { BigBrain as _BigBrain } from "BigBrain";
import { ErrorMapper } from "utils/ErrorMapper";
import { Mem } from "./memory/memory";
import profiler from "screeps-profiler";
import { init } from "profiler/Profiler";

global.Profiler = Profiler.init();
// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
const onGlobalReset = () => {
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
};

export const loop = ErrorMapper.wrapLoop(() => {
  profiler.wrap(() => main());
});

onGlobalReset();
