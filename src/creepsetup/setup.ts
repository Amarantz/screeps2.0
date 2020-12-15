import { CreepSetup } from "./CreepSetup"

export const Roles = {
    harvester: 'harvester',
    worker: 'worker',
    scout: 'scout',
    manager: 'manager',
    claim: 'claim',
    upgrader: 'upgrader',
    filler: 'filler',
    builder: 'builder',
    transport: 'transport',
}

export const Setups = {
    worker: {
        extractor: new CreepSetup(Roles.harvester, {
			pattern  : [WORK, WORK, MOVE],
			sizeLimit: Infinity,
			prefix   : [CARRY, CARRY]
		}),
        miner: {
            bootstrap: new CreepSetup(Roles.harvester, {
                pattern: [WORK, WORK, MOVE],
                sizeLimit: 3,
            }),
            default: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 3,
            }),
            standard: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
			}),
            standardCPU: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
            }),
            linkOptimized: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, WORK, CARRY, MOVE, MOVE, WORK],
				sizeLimit: 4,
            }),
            emergency: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 1,
            }),
            double: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
				sizeLimit: 2,
            }),
            sourceKeeper: new CreepSetup(Roles.harvester, {
				pattern  : [WORK, WORK, CARRY, MOVE],
				sizeLimit: 5,
			})
        }
    },
    filler: {
        default: new CreepSetup(Roles.filler, {
            pattern: [CARRY,CARRY,MOVE,MOVE],
            sizeLimit: 3,
        })
    },
    claimer: {
        claim: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 1
		}),

		fastClaim: new CreepSetup(Roles.claim, {
			pattern  : [MOVE, MOVE, MOVE, MOVE, CLAIM, MOVE],
			sizeLimit: 1
		}),

		reserve: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 4,
		}),

		controllerAttacker: new CreepSetup(Roles.claim, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: Infinity,
		}),
    },
    builder: {
		// TODO: implement inhouse workers to reinforce bunker
		inhouse: new CreepSetup(Roles.worker, {
			pattern  : [WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		default: new CreepSetup(Roles.worker, {
			pattern  : [WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.worker, {
			pattern  : [WORK, CARRY, MOVE, MOVE],
			sizeLimit: Infinity,
		}),
    },
    upgrader: {
		default: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		rcl8: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: 5,
		}),

		// rcl8_boosted: new CreepSetup(Roles.upgrader, {
		// 	pattern  : [WORK, WORK, WORK, CARRY, MOVE],
		// 	sizeLimit: 5,
		// }, ['upgrade']),

		remote: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		// remote_boosted: new RemoteUpgraderSetup({boosted: true}),

    },
    transport: {
        default: new CreepSetup(Roles.transport, {
            pattern: [CARRY,CARRY,MOVE],
            sizeLimit: Infinity,
        }),
        early: new CreepSetup(Roles.transport, {
			pattern  : [CARRY, MOVE],
			sizeLimit: Infinity,
		}),
    },
    scout: new CreepSetup(Roles.scout, {
		pattern  : [MOVE],
		sizeLimit: 1,
    }),
    managers: {

		default: new CreepSetup(Roles.manager, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.manager, {
			pattern  : [CARRY, MOVE],
			sizeLimit: Infinity,
		}),

	},
}
