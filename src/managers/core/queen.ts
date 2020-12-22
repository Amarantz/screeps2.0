import { ManagerPriority } from "priorities/priorities_managers";
import { Spawner } from "components/spawner";
import { Manager, DEFAULT_PRESPAWN } from "managers/Manager";
import { profile } from 'profiler';
import { Setups, Roles } from "creepSetup/setup";
import { CreepSetup } from "creepSetup/CreepSetup";
import { Bot } from "bot/Bot";
import { Tasks } from "tasks/Tasks";

type rechargeObjectType = StructureStorage
	| StructureTerminal
	| StructureContainer
	| StructureLink
	| Tombstone
	| Resource;

/**
 * Spawns a dedicated spawner attendant to refill spawns and extensions
 */
@profile
export class QueenManager extends Manager {

	spawner: Spawner;
	queenSetup: CreepSetup;
	queens: Bot[];
	settings: any;

	constructor(spawner: Spawner, priority = ManagerPriority.core.queen) {
		super(spawner, 'supply', priority);
		this.spawner = spawner;
		this.queenSetup = this.brain.storage && !this.brain.state.isRebuilding ? Setups.queens.default
																				 : Setups.queens.early;
		this.queens = this.bots(Roles.queen);
		this.settings = {
			refillTowersBelow: 500,
		};
	}

	init() {
		const amount = 2;
		const prespawn = this.spawner.spawns.length <= 1 ? 100 : DEFAULT_PRESPAWN;
		this.wishlist(amount, this.queenSetup, {prespawn: prespawn});
	}

	private supplyActions(queen: Bot) {
		// Select the closest supply target out of the highest priority and refill it
		const request = this.spawner.transportRequests.getPrioritizedClosetRequest(queen.pos, 'supply');
		if (request) {
			queen.task = Tasks.transfer(request.target);
		} else {
			this.rechargeActions(queen); // if there are no targets, refill yourself
		}
	}

	private rechargeActions(queen: Bot): void {
		if (this.spawner.link && !this.spawner.link.isEmpty) {
			queen.task = Tasks.withdraw(this.spawner.link);
		} else if (this.spawner.battery && this.spawner.battery.energy > 0) {
			queen.task = Tasks.withdraw(this.spawner.battery);
		} else {
			queen.task = Tasks.recharge();
		}
	}

	private idleActions(queen: Bot): void {
		if (this.spawner.link) {
			// Can energy be moved from the link to the battery?
			if (this.spawner.battery && !this.spawner.battery.isFull && !this.spawner.link.isEmpty) {
				// Move energy to battery as needed
				if (queen.carry.energy < queen.carryCapacity) {
					queen.task = Tasks.withdraw(this.spawner.link);
				} else {
					queen.task = Tasks.transfer(this.spawner.battery);
				}
			} else {
				if (queen.carry.energy < queen.carryCapacity) { // make sure you're recharged
					if (!this.spawner.link.isEmpty) {
						queen.task = Tasks.withdraw(this.spawner.link);
					} else if (this.spawner.battery && !this.spawner.battery.isEmpty) {
						queen.task = Tasks.withdraw(this.spawner.battery);
					}
				}
			}
		} else {
			if (this.spawner.battery && queen.carry.energy < queen.carryCapacity) {
				queen.task = Tasks.withdraw(this.spawner.battery);
			}
		}
	}

	private handleQueen(queen: Bot): void {
		if (queen.carry.energy > 0) {
			this.supplyActions(queen);
		} else {
			this.rechargeActions(queen);
		}
		// If there aren't any tasks that need to be done, recharge the battery from link
		if (queen.isIdle) {
			this.idleActions(queen);
		}
		// // If all of the above is done and spawner is not in emergencyMode, move to the idle point and renew as needed
		// if (!this.emergencyMode && queen.isIdle) {
		// 	if (queen.pos.isEqualTo(this.idlePos)) {
		// 		// If queen is at idle position, renew her as needed
		// 		if (queen.ticksToLive < this.settings.renewQueenAt && this.availableSpawns.length > 0) {
		// 			this.availableSpawns[0].renewCreep(queen.creep);
		// 		}
		// 	} else {
		// 		// Otherwise, travel back to idle position
		// 		queen.goTo(this.idlePos);
		// 	}
		// }
	}

	run() {
		for (const queen of this.queens) {
			// Get a task
			this.handleQueen(queen);
			// Run the task if you have one; else move back to idle pos
			if (queen.hasValidTask) {
				queen.run();
			} else {
				if (this.queens.length > 1) {
					queen.goTo(this.spawner.idlePos, {range: 1});
				} else {
					queen.goTo(this.spawner.idlePos);
				}
			}
		}
	}
}
