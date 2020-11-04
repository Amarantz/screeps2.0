/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable no-var */
// example declaration file - remove these and add your own custom typings
declare namespace NodeJS {
  interface Global {
    log: any;
    Profiler?: Profiler;
    BigBrain: IBigBrain;
    _cache: IGlobalCache;
    gc(quick?: boolean): void;
    [anyProper: string]: any;
  }
}

interface IBigBrainMemory {}

interface IBigBrain {
  expiration: number;
  shouldBuild: boolean;
  cache: ICache;
  units: { [creepName: string]: any };
  pods: { [roomName: string]: any };
  podsMap: { [roomName: string]: any };
  memory: IBigBrainMemory;
  build(): void;
  init(): void;
  refresh(): void;
  run(): void;
  postRun(): void;
}

interface IGlobalCache {
  accessed: { [key: string]: number };
  expiration: { [key: string]: number };
  structures: { [key: string]: Structure[] };
  numbers: { [key: string]: number };
  lists: { [key: string]: any[] };
  costMatrices: { [key: string]: CostMatrix };
  roomPositions: { [key: string]: RoomPosition | undefined };
  things: { [key: string]: undefined | HasID | HasID[] };
}

interface ICache {
  creepsByPod: { [podName: string]: any[] };
  targets: { [ref: string]: string[] };
  outpostFlags: Flag[];
  build(): void;
  refresh(): void;
}

declare var BigBrain: IBigBrain;
declare var _cache: IGlobalCache;

interface Coord {
  x: number;
  y: number;
}

interface RoomCoord {
  x: number;
  y: number;
  xDir: string;
  yDir: string;
}

interface PathFinderGoal {
  pos: RoomPosition;
  range: number;
  cost?: number;
}

interface ProtoCreep {
  body: BodyPartConstant[];
  name: string;
  memory: any;
}

interface ProtoCreepOptions {
  assignment?: RoomObject;
  patternRepetitionLimit?: number;
}

interface ProtoRoomObject {
  ref: string;
  pos: ProtoPos;
}

interface ProtoPos {
  x: number;
  y: number;
  roomName: string;
}

interface HasPos {
  pos: RoomPosition;
}

interface HasRef {
  ref: string;
}

interface HasID {
  id: string;
}
