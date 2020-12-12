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
    print(...args: any[]): string;
    derefRoomPosition(protoPos: ProtoPos): RoomPosition;
    deref(ref: string): RoomObject | null;
    [anyProper: string]: any;
  }
}

declare function print(...args: any[]): void;

interface IBigBrainMemory {}

interface IBigBrain {
  CEO: ICEO;
  directives: { [flagName: string]: any };
  expiration: number;
  shouldBuild: boolean;
  cache: ICache;
  units: { [creepName: string]: any };
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
interface ICEO {
  notifier: INotifier;
  registerDirective(directive: Directive): void;
  removeDirective(directive: Directive): void;
  registerManager(manager: Manger): any;
  getManagersForBrain(Brain: Brain): Manager[];
  isManagerSuspended(manager: Manager): boolean;
  suspendManagerFor(manager: Manger, ticks: number): void;
  suspendManagerUntil(manager: Manager, untilTicks: number): void;
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
