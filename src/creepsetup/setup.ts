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
            sizeLimit: 3,
        })
    },
    builder: {
        default: new CreepSetup(roles.builder, {
            pattern: [WORK,WORK,CARRY,MOVE],
            sizeLimit: 3,
        })
    },
    upgrader: {
        default: new CreepSetup(roles.upgrader, {
            pattern: [WORK,CARRY,CARRY,MOVE],
            sizeLimit: 3,
        })
    },
    transport: {
        default: new CreepSetup(roles.transport, {
            pattern: [CARRY,CARRY,MOVE],
            sizeLimit: 3,
        })
    }
}
