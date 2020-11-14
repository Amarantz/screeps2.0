import { CreepSetup } from "./CreepSetup"

export const roles = {
    harvester: 'harvester',
    worker: 'worker',
    upgrader: 'upgrader',
    filler: 'filler',
    builder: 'builder',
    transport: 'transport',
}

export const setups = {
    worker: {
        miner: {
            bootstrap: new CreepSetup(roles.harvester, {
                pattern: [WORK, WORK, MOVE],
                sizeLimit: 3,
            })
        }
    },
    filler: {
        default: new CreepSetup(roles.filler, {
            pattern: [CARRY,CARRY,MOVE,MOVE],
        })
    },
    builder: {
        default: new CreepSetup(roles.builder, {
            pattern: [WORK,WORK,CARRY,MOVE],
        })
    },
    upgrader: {
        default: new CreepSetup(roles.upgrader, {
            pattern: [WORK,CARRY,CARRY,MOVE],
        })
    },
    transport: {
        default: new CreepSetup(roles.transport, {
            pattern: [CARRY,CARRY,MOVE],
        })
    }
}
