import { CombatManager } from "managers/CombatManager";
import { CombatBot } from "bot/CombatBot";
import { DirectiveOutpostDefence } from "directives/defense/outpostDefence";
import { ManagerPriority } from "priorities/priorities_managers";
import { CombatIntel, CombatPotentials } from "intel/CombatIntel";
import { Roles, CombatSetups } from "creepSetup/setup";

export class OutpostDefenseManager extends CombatManager {
    meleeBots: CombatBot[];
    rangeBots: CombatBot[];
    healers: CombatBot[];
    constructor(directive: DirectiveOutpostDefence, priority = ManagerPriority.outpostDefense.outpostDefense) {
        super(directive, 'outpostDefense', priority, 1);
        this.meleeBots = this.combatBots(Roles.melee);
        this.rangeBots = this.combatBots(Roles.ranged);
        this.healers = this.combatBots(Roles.healer);
    }

    private handleCombat(bot: CombatBot) {
		if (this.room && this.room.hostiles.length == 0) {
			bot.doMedicActions(this.room.name);
		} else {
			bot.autoSkirmish(this.pos.roomName);
		}
	}
    init(): void {
        const enemyPotentials = this.getEnemyPotentials();
		const needAttack = enemyPotentials.attack * 1.1;
		const needRanged = enemyPotentials.ranged * 1.3;
		const needHeal = enemyPotentials.heal * 1.2;

		if (needAttack > 100 || needRanged > 100 || needHeal > 100) {
			return; // fuck it let's not fight this
		}

		// Only try to obtain one additional creep at a time
		if (this.reassignIdleCreeps(Roles.melee, 1)) return;
		if (this.reassignIdleCreeps(Roles.ranged, 1)) return;
		if (this.reassignIdleCreeps(Roles.healer, 1)) return;

        // const noBigColoniesNearby = _.all(this.spawnGroup.brains, col => col.room.energyCapacityAvailable < 800);
        const noBigColoniesNearby = false;

		const myPotentials = CombatIntel.getMyCombatPotentials([...this.meleeBots,
																...this.rangeBots,
																...this.healers]);

		// if (attack > 30 || rangedAttack > 30) {
		// 	// Handle boost worthy attackers
		// 	this.wishlist(1, CombatSetups.hydralisks.boosted_T3);
		// }

		const hydraliskSetup = noBigColoniesNearby ? CombatSetups.ranged.noHeal : CombatSetups.ranged.default;
		const zerglingSetup = noBigColoniesNearby ? CombatSetups.melee.default : CombatSetups.melee.healing;
		const healerSetup = CombatSetups.healing.default;

		if (myPotentials.ranged < needRanged) {
			this.requestCreep(hydraliskSetup);
		} else if (myPotentials.heal < needHeal) {
			this.requestCreep(healerSetup);
		} else if (myPotentials.attack < needAttack) {
			this.requestCreep(zerglingSetup);
		}

    }
    run(): void {
        this.autoRun(this.meleeBots, zergling => this.handleCombat(zergling));
		this.autoRun(this.rangeBots, hydralisk => this.handleCombat(hydralisk));
		this.autoRun(this.healers, healer => this.handleHealer(healer));
    }

    private handleHealer(healer: CombatBot) {
		if (CombatIntel.isHealer(healer) && healer.getActiveBodyparts(HEAL) == 0) {
			if (this.brain.towers.length > 0) {
				return healer.goToRoom(this.brain.room.name); // go get healed
			} else {
				return healer.suicide(); // you're useless at this point // TODO: this isn't smart
			}
		} else {
			if (this.room && _.any([...this.meleeBots, ...this.rangeBots], creep => creep.room == this.room)) {
				this.handleCombat(healer); // go to room if there are any fighters in there
			} else {
				healer.autoSkirmish(healer.room.name);
			}
        }
        return;
    }

    private getEnemyPotentials(): CombatPotentials {
		if (this.room) {
			return CombatIntel.getCombatPotentials(this.room.hostiles);
		} else {
			return {attack: 0, ranged: 1, heal: 0,};
		}
    }
}
