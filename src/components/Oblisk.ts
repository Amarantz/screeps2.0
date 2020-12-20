import { Component } from "./Component";
import { Brain } from "Brian";
import { $ } from "caching/GlobalCache";
import { CombatIntel } from "intel/CombatIntel";
import { WorkerManager } from "managers/core/worker";
import { CombatTargeting } from "targeting/CombatTarging";

export class Oblisk extends Component {

    towers: StructureTower[];
    static settings = {
        requestThreshold: 500,
        criticalEnergyThreshold: 250,
    };

    constructor(brain: Brain, tower: StructureTower){
        super(brain, tower, 'oblisk');
        this.towers = this.brain.towers;
    }
    refresh(): void {
        $.refreshRoom(this);
        $.refresh(this, 'towers');
    }
    get memory() : undefined {
        return undefined;
    }
    private registerEnergyRequest(): void {
        this.towers.forEach(tower => {
            if(tower && tower.store.getUsedCapacity(RESOURCE_ENERGY) < Oblisk.settings.requestThreshold) {
                const multiplier = (tower.store.getUsedCapacity(RESOURCE_ENERGY) < Oblisk.settings.criticalEnergyThreshold && 2 ) || 1;
                const dAmountdt = this.room.hostiles.length  > 0 ? 10 : 0;
                this.brain.logisticsNetwork.requestInput(tower, { multiplier, dAmountdt });
            }
        })
    }


	private attack(target: Creep): void {
		for (const tower of this.towers) {
			const result = tower.attack(target);
			if (result == OK) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.singleTowerDamage(target.pos.getRangeTo(tower));
			}
		}
    }

    private preventStructureDecay(includeRoads=true) {
		if (this.towers.length > 0) {
			// expensive to check all rampart hits; only run in intermediate RCL
			const dyingRamparts = _.filter(this.room.ramparts, rampart =>
				rampart.hits < WorkerManager.settings.barrierHits.critical
				&& this.brain.roomPlanner.barrierPlanner.barrierShouldBeHere(rampart.pos));
			if (dyingRamparts.length > 0) {
				for (const tower of this.towers) {
					tower.repair(tower.pos.findClosestByRange(dyingRamparts)!);
				}
				return;
			}
			// repair roads
			if (includeRoads) {
				const decayingRoads = _.filter(this.room.roads, road => road.hits < 0.2 * road.hitsMax);
				if (decayingRoads.length > 0) {
					const roadsToRepair = _.sample(decayingRoads, this.towers.length);
					// ^ if |towers| > |roads| then this will have length of |roads|
					for (const i in roadsToRepair) {
						this.towers[i].repair(roadsToRepair[i]);
					}
				}
			}
		}
	}


    init(): void {
        this.registerEnergyRequest();
    }
    higherManagers(): void {

    }
    run(): void {
        if (this.room.hostiles.length > 0) {
			const myDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(ATTACK) > 1);
			const myRangedDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(RANGED_ATTACK) > 1);
			const myCreepDamage = ATTACK_POWER * _.sum(myDefenders, creep => CombatIntel.getAttackPotential(creep)) +
								  RANGED_ATTACK_POWER * _.sum(myRangedDefenders,
															  creep => CombatIntel.getRangedAttackPotential(creep));
			const HEAL_FUDGE_FACTOR = 1.0;
			const avgHealing = HEAL_FUDGE_FACTOR * CombatIntel.avgHostileHealingTo(this.room.hostiles);
			let possibleTargets = _.filter(this.room.hostiles, hostile => {
				// let healing = HEAL_FUDGE_FACTOR * CombatIntel.maxHostileHealingTo(hostile);
				const damageTaken = CombatIntel.towerDamageAtPos(hostile.pos)! + myCreepDamage;
				const damageMultiplier = CombatIntel.minimumDamageTakenMultiplier(hostile);
				return damageTaken * damageMultiplier > avgHealing;
			});
			// Only attack dancing targets (drain attack) which are far enough in rooms to be killed off by towers
			possibleTargets = _.filter(possibleTargets, hostile => {
				if (CombatIntel.isEdgeDancing(hostile)) {
					const netDPS = CombatIntel.towerDamageAtPos(hostile.pos)! + myCreepDamage
								   - (HEAL_FUDGE_FACTOR * CombatIntel.maxHostileHealingTo(hostile));
					const isKillable = netDPS * hostile.pos.rangeToEdge > hostile.hits;
					if (isKillable) {
						return true;
					} else {
						// Shoot if they get close enough
						if (this.brain.bunker && this.brain.bunker.anchor &&
							hostile.pos.getRangeTo(this.brain.bunker.anchor) <= 6 + 2) {
							return true;
						}
					}
				} else {
					return true;
                }
                return false;
			});
			if (Game.time % 21 == 0 && _.filter(possibleTargets, target => target.hits < target.hitsMax / 2).length == 0) {
				// console.log('Scattershotting!');
				return this.scatterShot(possibleTargets);
			}
			possibleTargets = possibleTargets.filter(enemy => enemy.hits < enemy.hitsMax / 2
															  || enemy.pos.findInRange(FIND_MY_CREEPS, 3).length > 0);
			const target = CombatTargeting.findBestCreepTargetForTowers(this.room, possibleTargets);
			if (target) {
				return this.attack(target);
			}
		}
    }

    private scatterShot(targets: Creep[]): void {
		for (const tower of this.towers) {
			const target = _.sample(targets);
			const result = tower.attack(target);
			if (result == OK) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.singleTowerDamage(target.pos.getRangeTo(tower));
			}
		}
    }


}
