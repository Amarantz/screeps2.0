/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable no-var */

// example declaration file - remove these and add your own custom typings

declare const require: (module: string) => any;
declare var global: any;

declare const MARKET_FEE: 300; // missing in the typed-screeps declarations
global.MARKET_FEE = MARKET_FEE;

declare const NO_ACTION: 1;
declare type NO_ACTION = NO_ACTION;
global.NO_ACTION = NO_ACTION;

type TickPhase = 'assimilating' | 'build' | 'refresh' | 'init' | 'run' | 'postRun';
declare var PHASE: TickPhase;
declare var LATEST_BUILD_TICK: number;
declare var LATEST_GLOBAL_RESET_TICK: number;
declare var LATEST_GLOBAL_RESET_DATE: Date;
declare var Profiler: Profiler;
declare namespace NodeJS {
  interface Global {
    LATEST_GLOBAL_RESET_TICK: number;
    LATEST_GLOBAL_RESET_DATE: Date;
    log: any;
    Profiler?: Profiler;
    BigBrain: IBigBrain;
    _cache: IGlobalCache;
    gc(quick?: boolean): void;
    print(...args: any[]): string;
    derefRoomPosition(protoPos: ProtoPos): RoomPosition;
    deref(ref: string): RoomObject | null;
    [anyProper: string]: any;
  }
}

declare function print(...args: any[]): void;

interface IBigBrainMemory {}

interface IBigBrain {
  CEO: ICeo;
  directives: { [flagName: string]: any };
  expiration: number;
  shouldBuild: boolean;
  cache: ICache;
  bots: { [creepName: string]: any };
  powerBots: {[creepName:string ]: any};
  brains: { [roomName: string]: any };
  brainsMaps: { [roomName: string]: any };
  memory: IBigBrainMemory;
  managers: { [managerName: string]: any};
  errors: Error[];
  build(): void;
  init(): void;
  refresh(): void;
  run(): void;
  postRun(): void;
}
interface INotifier {
  alert(message: string, roomName: string, priority?: number): void;
  generateNotificationsList(links: boolean): string[];
}
interface ICeo {
  notifier: INotifier;
  registerDirective(directive: Directive): void;
  removeDirective(directive: Directive): void;
  registerManager(manager: Manger): any;
  getDirectivesOfType(directiveName: string): any[];
	getDirectivesInRoom(roomName: string): any[];
	getDirectivesForBrain(brain: {name: string}): any[];
  getManagersForBrain(brain: Brain): Manager[];
  refresh(): void;
  init(): void;
  run(): void;
  getCreepReport(brain: any): string[][];

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
  creepsByBrain: { [brain: string]: Creeps[] };
  managers: {[manager: string]: { [roleName:string]: string[] }}
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

type Full<T> = {
	[P in keyof T]-?: T[P];
};

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare var PERMACACHE: { [key: string]: any };
