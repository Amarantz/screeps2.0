import { Manager } from "managers/Manager";
import { CreepSetup } from "creepSetup/CreepSetup";
import { profile } from "../profiler";
import { Component } from "./Component";
import { Brain } from "Brian";
import { Mem } from "memory/memory";

export interface SpawnReqeust {
    setup: CreepSetup;
    manager: Manager;
    priority: number;
    partners?: (CreepSetup)[];
    options?: SpawnRequestOptions;
}

export interface SpawnRequestOptions {
    spawn?: StructureSpawn;
    direction?: DirectionConstant[];
}

export interface SpawnerMemory {
    stats: {
        manager: number;
        uptime: number;
        longUptime: number;
    };
}

const getDefaultSpawnerMemory: () => SpawnerMemory = () => ({
    stats: {
        manager: 0,
        uptime: 0,
        longUptime: 0,
    }
});

@profile
export class Spawner extends Component {

    constructor(brain: Brain, headSpawn: StructureSpawn) {
        super(brain, headSpawn, 'spawner');
        this.memory = Mem.wrap(this.brain.memory, 'spawner', getDefaultSpawnerMemory)
    }
    refresh(): void {

    }
    init(): void {

    }
    higherManagers(): void {

    }
    run(): void {

    }

}
