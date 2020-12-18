import { profile } from "../profiler/Profiler";
import { DirectiveOutpost } from "directives/colony/outpost";

@profile
export class GameCache implements ICache {
  creepsByBrain: { [brain: string]: any[]; };
  managers: { [manager: string]: { [roleName: string]: string[]; }; };
  public targets: { [ref: string]: string[] };
  public outpostFlags: Flag[];
  public constructor() {
    this.creepsByBrain = {};
    this.managers = {};
    this.targets = {};
    this.outpostFlags = _.filter(Game.flags, flag => DirectiveOutpost.filter(flag));
  }

  private cacheCreepsByBrain(): void {
    this.creepsByBrain = _.groupBy(Game.creeps, creep => creep.memory[MEM.BRAIN]);
  }

  private cacheManagers(): void {
    this.managers = {};
    const creepNamesByManager = _.groupBy(_.keys(Game.creeps), creep => Game.creeps[creep].memory[MEM.MANAGER]);
    const powerCreepsByManager = _.groupBy(_.keys(Game.powerCreeps), power => Game.powerCreeps[power].memory[MEM.MANAGER])
    for (const ref in creepNamesByManager) {
      this.managers[ref] = _.groupBy([...creepNamesByManager[ref]], name => (Game.creeps[name] || Game.powerCreeps[name]).memory.role);
    }

  }

  private cacheTargets() {
    this.targets = {};
    for(const i in Game.creeps){
      const creep = Game.creeps[i];
      let task = creep.memory.task;
      while (task) {
        if(!this.targets[task._target.ref])  {
          this.targets[task._target.ref] = [];
        }
				this.targets[task._target.ref].push(creep.name);
				task = task._parent;
      }
    }

  }
  public build(): void {
    this.cacheCreepsByBrain();
    this.cacheManagers();
    this.cacheTargets();
  }
  public refresh(): void {
    this.cacheCreepsByBrain();
    this.cacheManagers();
    this.cacheTargets();
  }
}
