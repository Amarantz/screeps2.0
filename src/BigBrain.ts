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
    this.errors = [];
    this.roomIntel = new RoomIntel();
  }

  public build(): void {
    this.memory = Memory.BigBrain;
    this.cache.build();
    this.buildBrains();
    _.forEach(this.brains, brain => brain.higherManagers());
    this.buildDirectives();
    _.forEach(this.directives, directive => directive.HigherManager());
    this.findConstructionSites();

    this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
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
      if(!dir && Game.time % 11 == 0) {
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
        this.errors.push(e);
      }
    }

  }

  public postRun(): void {
    // todo
    if(this.errors.length > 0) {
      for(const e of this.errors) {
        log.error(e)
      }
      this.shouldBuild = true;
    }
  }

  public init(): void {
    this.try(() => RoomIntel.init());
    this.CEO.init();
    for(const brain in this.brains){
      const start = Game.cpu.getUsed();
      this.try(() => this.brains[brain].init(), brain);
      Stats.log(`brains.${brain}.runtime`, Game.cpu.getUsed() - start);
    }
    this.errors = [];
    this.oldInit();
  }

  private oldInit() {
    const spawn = Game.spawns['Spawn1'];
    // if (!this.creepsByRole.harvester || this.creepsByRole.harvester && this.creepsByRole.harvester.length < 2) {
    //   const newName = 'Harvester' + Game.time;
    //   spawn.spawnCreep(Setups.worker.miner.bootstrap.generateBody(spawn.room.energyCapacityAvailable), newName,
    //     { memory: { role: Roles.harvester } });
    // }

    if (!this.creepsByRole.upgrader || this.creepsByRole.upgrader && this.creepsByRole.upgrader.length < 2) {
      const newName = 'Upgrader' + Game.time;
      spawn.spawnCreep(Setups.upgrader.default.generateBody(spawn.room.energyCapacityAvailable), newName,
        { memory: { role: Roles.upgrader } });
    }

    if (!this.creepsByRole.builder && Object.keys(this.constructionSites).length > 0 || this.creepsByRole.builder && this.creepsByRole.builder.length < 1) {
      const newName = 'Builder' + Game.time;
      spawn.spawnCreep(Setups.builder.default.generateBody(spawn.room.energyCapacityAvailable), newName,
        { memory: { role: 'builder' } });
    }

    if (!this.creepsByRole.transport || this.creepsByRole.transport && this.creepsByRole.transport.length < 2) {
      const newName = 'Transport' + Game.time;
      spawn.spawnCreep(Setups.transport.default.generateBody(spawn.room.energyCapacityAvailable), newName,
        { memory: { role: Roles.transport } });
    }

    if (spawn.room.storage && !this.creepsByRole.filler || this.creepsByRole.filler && this.creepsByRole.filler.length < 2) {
      const newName = 'Filller' + Game.time;
      spawn.spawnCreep(Setups.filler.default.generateBody(spawn.room.energyCapacityAvailable), newName,
        { memory: { role: Roles.filler } });
    }
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
    this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
    this.findConstructionSites();
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
      log.alert(this.directives[name].print)
      this.directives[name].refresh()
    }
    this.buildDirectives(true);
  }

  public run(): void {
    this.CEO.run();
    for(const brain in this.brains){
      this.try(() => {
        log.alert(`Attempting to run brain: ${this.brains[brain].print}`);
        this.brains[brain].run();
      }, brain);
    }
    this.oldRun();
    this.try(() => RoomIntel.run());
  }

  private oldRun() {
    // if (this.creepsByRole && this.creepsByRole.harvester && this.creepsByRole.harvester.length > 0) {
    //   _.forEach(this.creepsByRole.harvester, creep => Harvester.run(creep))
    // }

    if (this.creepsByRole && this.creepsByRole.upgrader && this.creepsByRole.upgrader.length > 0) {
      _.forEach(this.creepsByRole.upgrader, creep => Upgrader.run(creep))
    }

    if (this.creepsByRole && this.creepsByRole.builder && this.creepsByRole.builder.length > 0) {
      _.forEach(this.creepsByRole.builder, creep => Worker.run(creep, this.constructionSites))
    }

    if (this.creepsByRole && this.creepsByRole.transport && this.creepsByRole.transport.length > 0) {
      this.creepsByRole.transport.forEach((creep) => Transport.run(creep));
    }

    if (this.creepsByRole && this.creepsByRole.filler && this.creepsByRole.filler.length > 0) {
      this.creepsByRole.filler.forEach((creep) => Filler.run(creep));
    }

    _.forEach(Game.rooms, (room) => {
      const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
      const towers = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === 'tower' });
      _.forEach(towers, (tower: StructureTower) => tower.attack(hostileCreeps[0]));
    })

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
