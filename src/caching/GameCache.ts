import { profile } from "../profiler/Profiler";

@profile
export class GameCache implements ICache {
  public creepsByPod: { [podName: string]: Creep[] };
  public targets: { [ref: string]: string[] };
  public outpostFlags: Flag[];
  public constructor() {
    this.creepsByPod = {};
    this.targets = {};
    this.outpostFlags = [] as Flag[];
  }

  private cacheCreepsByPod(): void {
    this.creepsByPod = _.groupBy(Game.creeps, creep => creep.memory[_MEM.POD]) as { [podName: string]: Creep[] };
  }
  public build(): void {
    this.cacheCreepsByPod();
  }
  public refresh(): void {
    this.cacheCreepsByPod();
  }
}
