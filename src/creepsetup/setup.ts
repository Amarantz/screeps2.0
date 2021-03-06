import { CreepSetup } from "./CreepSetup"
import { MeleeBotSetup, RangedBotSetup, HealingBotSetup } from "./CombatCreepSetup"

export const Roles = {
	harvester: 'harvester',
	worker: 'worker',
	scout: 'scout',
	manager: 'manager',
	claim: 'claimer',
	reserver: 'reserver',
	queen: 'queen',
	upgrader: 'upgrader',
	filler: 'filler',
	builder: 'builder',
	transport: 'transport',
	melee: 'melee',
	ranged: 'ranged',
	healer: 'healer',
	guardMelee: 'guardMelee',
	dismantler: 'dismantler',
}

export const Setups = {
	worker: {
		extractor: new CreepSetup(Roles.harvester, {
			pattern: [WORK, WORK, MOVE],
			sizeLimit: Infinity,
			prefix: [CARRY, CARRY]
		}),
		miner: {
			bootstrap: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, MOVE],
				sizeLimit: 1,
			}),
			default: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, CARRY, MOVE],
				sizeLimit: 3,
			}),
			standard: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
			}),
			standardCPU: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, WORK],
				sizeLimit: 1,
			}),
			linkOptimized: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, WORK, CARRY, MOVE, MOVE, WORK],
				sizeLimit: 4,
			}),
			emergency: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, CARRY, MOVE],
				sizeLimit: 1,
			}),
			double: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
				sizeLimit: 2,
			}),
			sourceKeeper: new CreepSetup(Roles.harvester, {
				pattern: [WORK, WORK, CARRY, MOVE],
				sizeLimit: 5,
			})
		},
		builders: {
			// TODO: implement inhouse workers to reinforce bunker
			inhouse: new CreepSetup(Roles.worker, {
				pattern: [WORK, WORK, CARRY, MOVE],
				sizeLimit: Infinity,
			}),

			default: new CreepSetup(Roles.worker, {
				pattern: [WORK, CARRY, MOVE],
				sizeLimit: Infinity,
			}),

			early: new CreepSetup(Roles.worker, {
				pattern: [WORK, CARRY, MOVE, MOVE],
				sizeLimit: Infinity,
			}),

		}
	},
	filler: {
		default: new CreepSetup(Roles.filler, {
			pattern: [CARRY, CARRY, MOVE, MOVE],
			sizeLimit: 1,
		})
	},
	claimer: {
		claim: new CreepSetup(Roles.claim, {
			pattern: [CLAIM, MOVE],
			sizeLimit: 1
		}),

		fastClaim: new CreepSetup(Roles.claim, {
			pattern: [MOVE, MOVE, MOVE, MOVE, CLAIM, MOVE],
			sizeLimit: 1
		}),

		reserve: new CreepSetup(Roles.claim, {
			pattern: [CLAIM, MOVE],
			sizeLimit: 4,
		}),

		controllerAttacker: new CreepSetup(Roles.claim, {
			pattern: [CLAIM, MOVE],
			sizeLimit: Infinity,
		}),
	},
	reserver: new CreepSetup(Roles.reserver, {
		pattern: [CLAIM, MOVE],
		sizeLimit: 4,
	}),
	upgrader: {
		default: new CreepSetup(Roles.upgrader, {
			pattern: [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		rcl8: new CreepSetup(Roles.upgrader, {
			pattern: [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: 5,
		}),

		rcl8_boosted: new CreepSetup(Roles.upgrader, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: 5,
		}, ['upgrade']),

		remote: new CreepSetup(Roles.upgrader, {
			pattern: [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		// remote_boosted: new RemoteUpgraderSetup({boosted: true}),

	},
	transport: {
		default: new CreepSetup(Roles.transport, {
			pattern: [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,
		}),
		early: new CreepSetup(Roles.transport, {
			pattern: [CARRY, MOVE],
			sizeLimit: Infinity,
		}),
	},
	scout: new CreepSetup(Roles.scout, {
		pattern: [MOVE],
		sizeLimit: 1,
	}),
	managers: {
		default: new CreepSetup(Roles.manager, {
			pattern: [CARRY, CARRY, CARRY, CARRY, MOVE],
			sizeLimit: 3,
		}),

		twoPart: new CreepSetup(Roles.manager, {
			pattern: [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		}),

		stationary: new CreepSetup(Roles.manager, {
			pattern: [CARRY, CARRY],
			sizeLimit: 16,
		}),

		stationary_work: new CreepSetup(Roles.manager, {
			pattern: [WORK, WORK, WORK, WORK, CARRY, CARRY],
			sizeLimit: 8,
		}),

	},
	queens: {

		default: new CreepSetup(Roles.queen, {
			pattern: [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,
		}),

		early: new CreepSetup(Roles.queen, {
			pattern: [CARRY, MOVE],
			sizeLimit: Infinity,
		}),

	},
}

export const CombatSetups = {
	melee: {
		default: new MeleeBotSetup(),
		healing: new MeleeBotSetup({ healing: true }),
		boosted: {
			default: new MeleeBotSetup({ boosted: true }),
			armored: new MeleeBotSetup({ boosted: true, armored: true }),
			armoredHealing: new MeleeBotSetup({ boosted: true, armored: true, healing: true }),
		},
		sourceKeeper: new CreepSetup(Roles.melee, {
			pattern: [MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, HEAL, MOVE],
			sizeLimit: Infinity,
		}),
	},
	ranged: {
		default: new RangedBotSetup(),

		noHeal: new RangedBotSetup({ healing: false }),

		boosted: {
			default: new RangedBotSetup({ boosted: true }),
			armored: new RangedBotSetup({ boosted: true, armored: true }),
			noHeal: new RangedBotSetup({ boosted: true, healing: false }),
		},
	},
	healing: {
		default: new HealingBotSetup(),

		boosted: {
			default: new HealingBotSetup({boosted: true}),
			armored: new HealingBotSetup({boosted: true, armored: true}),
		}
	},
	broodlings: {

		early: new CreepSetup(Roles.guardMelee, {
			pattern  : [ATTACK, MOVE],
			sizeLimit: Infinity,
		}),

		default: new CreepSetup(Roles.guardMelee, {
			pattern  : [ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL],
			sizeLimit: Infinity,
		}),

	},

		/**
	 * Dismantlers (lurkers) are creeps with work parts for dismantle sieges
	 */
	dismantlers: {
		default: new CreepSetup(Roles.dismantler, {
			pattern  : [WORK, MOVE],
			sizeLimit: Infinity,
		}),

		attackDismantlers: new CreepSetup(Roles.dismantler, {
			pattern  : [ATTACK, MOVE],
			sizeLimit: Infinity,
		}),

		armored: new CreepSetup(Roles.dismantler, {
			pattern  : [TOUGH, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE],
			sizeLimit: Infinity,
		}),

		boosted_armored_T3: new CreepSetup(Roles.dismantler, {
			pattern  : [TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
			sizeLimit: Infinity,
		}),


	},
}
