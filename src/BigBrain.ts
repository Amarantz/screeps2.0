import { GameCache } from "./caching/GameCache";
import SETTINGS from "./settings";
import { profile } from "./profiler/Profiler";
import { Harvester } from "roles/harvester";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";
import { Transport } from "roles/transport";
import { Filler } from "roles/filler";
import { Roles, Setups } from "creepSetup/setup"
import { Brain } from "Brian";
import { CEO } from "CEO";
import { Directive } from "directives/directive";
import { AnyBot } from "bot/AnyBot";

@profile
export class BigBrain implements IBigBrain {
  public expiration: number;
  public shouldBuild: boolean;
  public cache: ICache;
  public brains: { [roomName: string]: any };
  public units: { [creepName: string]: any };
  public brainsMaps: { [roomName: string]: any };
  public memory: IBigBrainMemory;
  managers: { [managerName:string]: any};
  public creepsByRole: { [roleName: string]: Creep[] };
  bots: {[botName:string]: AnyBot };
  powerBots: {[botName:string]: AnyBot };
  public directives: { [flagName: string]: Directive };
  public CEO: ICeo;
  constructionSites: ConstructionSite<BuildableStructureConstant>[];
  errors: Error[];


  public constructor() {
    this.shouldBuild = false;
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
  }

  public build(): void {
      this.cache.build();
      this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
      this.findConstructionSites();
      _.forEach(Game.rooms, (room) => {
        if (room.controller && room.controller.my) {
          this.brains[room.name] = new Brain(room.name);
        }
      });
  }

  public postRun(): void {
    // todo
    _.forEach(this.errors, error => console.log(error.name))
  }

  public init(): void {
    this.CEO.init();
    this.errors = [];
    this.oldInit();
  }

  private oldInit() {
    const spawn = Game.spawns['Spawn1'];
    if (!this.creepsByRole.harvester || this.creepsByRole.harvester && this.creepsByRole.harvester.length < 2) {
      const newName = 'Harvester' + Game.time;
      spawn.spawnCreep(Setups.worker.miner.bootstrap.generateBody(spawn.room.energyCapacityAvailable), newName,
        { memory: { role: Roles.harvester } });
    }

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
    this.cache.refresh();
    this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
    this.CEO.refresh();
    // console.log('refresh', JSON.stringify(this.brains));
    _.forEach(this.brains, brain => {
      brain.refresh();
    })
    this.findConstructionSites();
  }

  public run(): void {
    this.CEO.run();
    this.oldRun();
  }

  private oldRun() {
    if (this.creepsByRole && this.creepsByRole.upgrader && this.creepsByRole.upgrader.length > 0) {
      _.forEach(this.creepsByRole.harvester, creep => Harvester.run(creep))
    }

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

  private findConstructionSites() {
    this.constructionSites = _.flatten(_.map(Game.rooms, room => room.find(FIND_MY_CONSTRUCTION_SITES)));
  }
}
