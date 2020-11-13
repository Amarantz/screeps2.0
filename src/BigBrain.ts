import { GameCache } from "./caching/GameCache";
import SETTINGS from "./settings";
import { profile } from "./profiler/Profiler";
import { Harvester } from "roles/harvester";
import { Upgrader } from "roles/upgrader";
import { Worker } from "roles/worker";
import { Transport } from "roles/transport";
import { Filler } from "roles/filler";

@profile
export class BigBrain implements IBigBrain {
  public expiration: number;
  public shouldBuild: boolean;
  public cache: ICache;
  public pods: { [roomName: string]: any };
  public units: { [creepName: string]: any };
  public podsMap: { [roomName: string]: any };
  public memory: IBigBrainMemory;
  public creepsByRole: { [roleName:string]: Creep[] };
  constructionSites: ConstructionSite<BuildableStructureConstant>[];


  public constructor() {
    this.shouldBuild = false;
    this.expiration = Game.time + SETTINGS.BIG_BRAIN_INTERVAL;
    this.cache = new GameCache();
  }

  public build(): void {
    this.cache.build();
    this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
    this.findConstructionSites();
  }

  public postRun(): void {
    // todo
  }

  public init(): void {
    if (!this.creepsByRole.harvester || this.creepsByRole.harvester && this.creepsByRole.harvester.length < 2) {
      const newName = 'Harvester' + Game.time;
      Game.spawns['Spawn1'].spawnCreep([WORK,WORK,MOVE], newName,
          { memory: { role: 'harvester' } });
    }

    if (!this.creepsByRole.upgrader || this.creepsByRole.upgrader && this.creepsByRole.upgrader.length < 2) {
      const newName = 'Upgrader' + Game.time;
      Game.spawns['Spawn1'].spawnCreep([WORK,CARRY,CARRY,MOVE], newName,
          { memory: { role: 'upgrader' } });
    }

    if (!this.creepsByRole.builder && Object.keys(this.constructionSites).length > 0 || this.creepsByRole.builder && this.creepsByRole.builder.length < 1) {
      const newName = 'Builder' + Game.time;
      Game.spawns['Spawn1'].spawnCreep([WORK,CARRY,CARRY,MOVE], newName,
          { memory: { role: 'builder' } });
    }

    if (!this.creepsByRole.transport || this.creepsByRole.transport && this.creepsByRole.transport.length < 2) {
      const newName = 'Transport' + Game.time;
      Game.spawns['Spawn1'].spawnCreep([CARRY,CARRY,MOVE,MOVE], newName,
          { memory: { role: 'transport' } });
    }
    if (Game.spawns['Spawn1'].room.storage && !this.creepsByRole.filler || this.creepsByRole.filler && this.creepsByRole.filler.length < 2) {
      const newName = 'Transport' + Game.time;
      Game.spawns['Spawn1'].spawnCreep([CARRY,CARRY,MOVE,MOVE], newName,
          { memory: { role: 'filler' } });
    }
  }

  public refresh(): void {
    this.cache.refresh();
    this.creepsByRole = _.groupBy(Game.creeps, creep => creep.memory.role);
    this.findConstructionSites();
  }

  public run(): void {
    if(this.creepsByRole && this.creepsByRole.upgrader && this.creepsByRole.upgrader.length > 0) {
      _.forEach(this.creepsByRole.harvester, creep => Harvester.run(creep))
    }

    if(this.creepsByRole && this.creepsByRole.upgrader && this.creepsByRole.upgrader.length > 0) {
      _.forEach(this.creepsByRole.upgrader, creep => Upgrader.run(creep))
    }

    if(this.creepsByRole && this.creepsByRole.builder && this.creepsByRole.builder.length > 0) {
      _.forEach(this.creepsByRole.builder, creep => Worker.run(creep, this.constructionSites))
    }

    if(this.creepsByRole && this.creepsByRole.transport && this.creepsByRole.transport.length > 0){
      this.creepsByRole.transport.forEach((creep) => Transport.run(creep));
    }
    if(this.creepsByRole && this.creepsByRole.filler && this.creepsByRole.filler.length > 0){
      this.creepsByRole.filler.forEach((creep) => Filler.run(creep));
    }
  }

  private findConstructionSites() {
    this.constructionSites = _.flatten(_.map(Game.rooms, room => room.find(FIND_MY_CONSTRUCTION_SITES)));
  }
}
