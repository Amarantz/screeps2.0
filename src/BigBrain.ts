import { GameCache } from "./caching/GameCache";
import SETTINGS, { USE_TRY_CATCH, USE_SCREEPS_PROFILER, SUPPRESS_INVALID_DIRECTIVE_ALERTS, PROFILER_COLONY_LIMIT } from "./settings";
import { profile } from "./profiler/Profiler";
import { Harvester } from "roles/harvester";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";
import { Transport } from "roles/transport";
import { Filler } from "roles/filler";
import { Roles, Setups } from "creepSetup/setup"
import { Brain, brainStage } from "Brian";
import { CEO } from "CEO";
import { Directive } from "directives/directive";
import { AnyBot } from "bot/AnyBot";
import { DirectiveWrapper } from "directives/initializer";
import { log } from "console/log";
import { alignedNewline } from "utils/utils";
import { harvestTaskName } from "tasks/instances/harvest";
import { NotifierPriority } from "directives/Notifier";
import { Z_MEM_ERROR } from "zlib";
import { RoomIntel } from "intel/RoomIntel";
import { Stats } from "stats/stats";
import { TerminalNetworkV2 } from "logistics/TerminalNetwork";
import { TraderJoe } from "logistics/TradeNetwork";


const profilerRooms: {[roomName:string]: boolean} = {};
@profile
export class BigBrain implements IBigBrain {
  public expiration: number;
  public shouldBuild: boolean;
  public cache: ICache;
  public brains: { [roomName: string]: Brain };
  public brainsMaps: { [roomName: string]: string };
  outpost: { [flagName: string]: any };
  public memory: IBigBrainMemory;
  managers: { [managerName: string]: any };
  public creepsByRole: { [roleName: string]: Creep[] };
  bots: { [botName: string]: AnyBot };
  powerBots: { [botName: string]: AnyBot };
  private roomIntel: RoomIntel;
  public directives: { [flagName: string]: Directive };
  public CEO: ICeo;
  constructionSites: ConstructionSite<BuildableStructureConstant>[];
  errors: Error[];
  terminalNetwork: TerminalNetworkV2;
  tradeNetwork: ITradeNetwork;


  public constructor() {
    this.shouldBuild = true;
    this.expiration = Game.time + SETTINGS.BIG_BRAIN_INTERVAL;
    this.cache = new GameCache();
    this.CEO = new CEO();
    this.brains = {};
    this.bots = {}
    this.powerBots = {};
    this.managers = {};
    this.brainsMaps = {};
    this.directives = {};
    this.terminalNetwork = new TerminalNetworkV2();
    global.terminalNetwork = this.terminalNetwork;
    this.tradeNetwork = new TraderJoe();
    global.tradeNetwork = this.tradeNetwork;
    // this.expantionPlanner = new ExpansionPlanner();
    this.errors = [];
    this.roomIntel = new RoomIntel();
  }
  traderJoe: ITradeNetwork;

  public build(): void {
    this.memory = Memory.BigBrain;
    this.cache.build();
    this.buildBrains();
    _.forEach(this.brains, brain => brain.higherManagers());
    this.buildDirectives();
    _.forEach(this.directives, directive => directive.HigherManager());
    this.shouldBuild = false;
  }

  private buildDirectives(spawn = false) {
    for(const name in Game.flags) {
      if(this.directives[name]) {
        continue;
      }
      const brain = Game.flags[name].memory[MEM.BRAIN];
      if(brain) {
        if(USE_SCREEPS_PROFILER && !profilerRooms[brain]){
          continue;
        }
        const brainMemory = Memory.brains[brain];
        if(brainMemory && brainMemory.suspend){
          continue;
        }
      }
      const dir = DirectiveWrapper(Game.flags[name]);
      const exist = !!this.directives[name];
      if(dir && exist && spawn) {
        dir.HigherManager();
      }
      if(!dir && !SUPPRESS_INVALID_DIRECTIVE_ALERTS && Game.time % 11 == 0) {
        log.alert(`Invalid Directive ${name} at position: ${Game.flags[name].pos.roomName}`)
      }
    }
  }

  private buildBrains() {
    const outpost: {[roomName:string]: string[]} = {};
    this.brainsMaps = {};
    const flagsByBrain = _.groupBy(this.cache.outpostFlags, flag => flag.memory[MEM.BRAIN]);
    for(const room in Game.rooms){
      if(Game.rooms[room].my){
        const brainMemory = Memory.brains[room];
        if(brainMemory && brainMemory.suspend) {
          this.CEO.notifier.alert("Brain is suspened", room, NotifierPriority.Critical);
          continue;
        }
        if(Game.rooms[room].flags) {
          outpost[room] = _.map(flagsByBrain[room],  flag => flag.memory.setPos ? derefRoomPosition(flag.memory.setPos).roomName : flag.pos.roomName)
        }
        this.brainsMaps[room] = room;
      }
    }
    for(const o in outpost) {
      for(const r in outpost[o]) {
        this.brainsMaps[r] = o;
      }
    }
    let id = 0;
    for(const roomName in outpost) {
      if(USE_SCREEPS_PROFILER && !profilerRooms[roomName]) {
        if(Game.time % 20 == 0) {
          log.alert(`Profiler enabled on room ${roomName}.`);
        }
        continue;
      }
      try {
        this.brains[roomName] = new Brain(id, roomName, outpost[roomName]);
      } catch (e) {
        e.name = `Error while creating brain in room ${roomName}: ${e.name}`;
        log.debug(`${e.name} ${e.stack}`);
        this.errors.push(e);
      }
    }

  }

  public postRun(): void {
    // todo
    if(this.errors.length > 0) {
      for(const e of this.errors) {
        log.error(`${e.name}`);
      }
      this.shouldBuild = true;
    }
  }

  public init(): void {
    this.try(() => RoomIntel.init());
    this.try(() => this.tradeNetwork.init());
    this.try(() => this.terminalNetwork.init())
    this.CEO.init();
    for(const brain in this.brains){
      const start = Game.cpu.getUsed();
      this.try(() => this.brains[brain].init(), brain);
      Stats.log(`brains.${brain}.runtime`, Game.cpu.getUsed() - start);
    }
    this.errors = [];
  }

  public refresh(): void {
    this.shouldBuild = true;
    this.memory = Memory.BigBrain;
    this.errors = [];
    this.cache.refresh();
    this.CEO.refresh();
    this.refreshBrains();
    this.refreshDirectives();

    for(const name in this.bots){
      this.bots[name].refresh();
    }

    for(const name in this.powerBots) {
      this.powerBots[name].refresh();
    }
    this.shouldBuild = false;
  }

  private refreshBrains() {
    for(const brain in this.brains) {
      try{
        this.brains[brain].refresh();
      } catch (e) {
        e.name = `Error occurred while refreshing Brain: ${brain}: ${e.name}`;
        this.errors.push(e);
      }
    }
  }

  private refreshDirectives() {
    for(const name in this.directives) {
      this.directives[name].refresh()
    }
    this.buildDirectives(true);
  }

  public run(): void {
    this.CEO.run();
    for(const brain in this.brains){
      this.try(() => this.brains[brain].run(), brain);
    }
    this.try(() => this.terminalNetwork.run());
    this.try(() => this.tradeNetwork.run());
    // this.try(() => this.expantionPlanner.run());
    this.try(() => RoomIntel.run());
  }

  private try(callback: () => any, identifier?: string): void {
    if (USE_TRY_CATCH) {
      try {
        callback();
      } catch (e) {
        if (identifier) {
          e.name = `Caught unhandled exception at ${'' + callback} (identifer: ${identifier}): \n ${e.name} \n ${e.stack}`;
        } else {
          e.name = `Caught unhandled exception at ${'' + callback}: \n ${e.name} \n ${e.stack}`;
        }
        this.errors.push(e);
      }
    } else {
      callback();
    }
  }

  private findConstructionSites() {
    this.constructionSites = _.flatten(_.map(Game.rooms, room => room.find(FIND_MY_CONSTRUCTION_SITES)));
  }
}
