import { BoostType } from "resources/map_resoures";
import { Brain } from "Brian";
import { log } from "console/log";
import { Roles } from "./setup";

type PartNonMove = 'attack' | 'ranged' | 'heal' | 'tough' | 'work' | 'carry' | 'claim';

export interface BodyCounts {
	move?: number;
	attack?: number;
	ranged?: number;
	heal?: number;
	tough?: number;
	work?: number;
	carry?: number;
	claim?: number;
}

const allZeroParts: () => Full<BodyCounts> = () => ({
	move  : 0,
	attack: 0,
	ranged: 0,
	heal  : 0,
	tough : 0,
	work  : 0,
	carry : 0,
	claim : 0,
});

export interface BodyOpts {
	moveSpeed?: number;
	putMoveFirstInBody?: boolean;
	bodyRatio?: Omit<BodyCounts, 'move'>;
	maxParts?: Omit<BodyCounts, 'move'>;
	boosts?: BoostType[];
}

export interface SimpleBodyOpts {
	moveSpeed?: number;
	boosted?: boolean;
	armored?: boolean;
	healing?: boolean;
	withRanged?: boolean;
	bodyOpts?: BodyOpts;
}

export interface BodyGeneratorReturn {
	body: BodyPartConstant[];
	boosts: ResourceConstant[];
}

interface AvailableBoosts {
	attack?: ResourceConstant | undefined;
	carry?: ResourceConstant | undefined;
	ranged?: ResourceConstant | undefined;
	heal?: ResourceConstant | undefined;
	tough?: ResourceConstant | undefined;
	harvest?: ResourceConstant | undefined;
	dismantle?: ResourceConstant | undefined;
	upgrade?: ResourceConstant | undefined;
	construct?: ResourceConstant | undefined;
	move?: ResourceConstant | undefined;
}

// This re-declaration is needed to get typings to work since typed-screeps has a hard-on for over-typing things
const BOOST_EFFECTS: { [part: string]: { [boost: string]: { [action: string]: number } } } = BOOSTS;

const BODYPART_COSTS = _.extend(_.clone(BODYPART_COST),
								{ranged: BODYPART_COST[RANGED_ATTACK]}) as { [part: string]: number };

export class CombatCreepSetup /*extends CreepSetup*/ {

	role: string;
	private bodyGenerator: ((brain: Brain, opts: Full<BodyOpts>) => BodyGeneratorReturn);
	private opts: Full<BodyOpts>;
	private cache: { [brainName: string]: { result: BodyGeneratorReturn, expiration: number } };

	constructor(roleName: string, opts: Full<BodyOpts>,
				bodyGenerator: ((brain: Brain, opts: Full<BodyOpts>) => BodyGeneratorReturn)) {
		// super(roleName, {}, []);
		this.role = roleName;
		this.opts = opts;
		this.bodyGenerator = bodyGenerator;
		this.cache = {};
	}

	/**
	 * Generate the body and boosts for a requested creep
	 */
	create(brain: Brain, useCache = false): BodyGeneratorReturn {
		// If you're allowed to use a cached result (e.g. for estimating wait times), return that
		if (useCache && this.cache[brain.name] && Game.time < this.cache[brain.name].expiration) {
			return this.cache[brain.name].result;
		}

		// Otherwise recompute
		const result = this.bodyGenerator(brain, this.opts);
		this.cache[brain.name] = {
			result    : result,
			expiration: Game.time + 20,
		};

		return result;
	}

	// /**
	//  * Here for legacy purposes to that this can extend the old CreepSetup class, but you never want to use this!
	//  */
	// generateBody(availableEnergy: number): BodyPartConstant[] {
	// 	log.error(`CombatCreepSetup.generateBody() should not be used!`);
	// 	return [];
	// }

	/**
	 * Returns an object with the best boosts available for each type of boost requested. The object will only have
	 * keys for boosts which are requested in opts.boosts and for which opts.bodyRatio has non-zero entries, and
	 * if a boost is requested but not available, the key will be present but the value will be undefined.
	 */
	private static getBestBoostsAvailable(brain: Brain, opts: Full<BodyOpts>): AvailableBoosts {
		const availableBoosts: AvailableBoosts = {};
		if (brain.engineeringBay) {
			if (opts.bodyRatio.tough && opts.boosts.includes('tough')) {
				const toughBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.tough || 0);
				availableBoosts.tough = brain.engineeringBay.bestBoostAvailable('tough', toughBoostNeeded);
			}
			if (opts.bodyRatio.heal && opts.boosts.includes('heal')) {
				const healBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.heal || 0);
				availableBoosts.heal = brain.engineeringBay.bestBoostAvailable('heal', healBoostNeeded);
			}
			if (opts.bodyRatio.ranged && opts.boosts.includes('ranged')) {
				const rangedBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.ranged || 0);
				availableBoosts.ranged = brain.engineeringBay.bestBoostAvailable('ranged', rangedBoostNeeded);
			}
			if (opts.bodyRatio.attack && opts.boosts.includes('attack')) {
				const attackBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.attack || 0);
				availableBoosts.attack = brain.engineeringBay.bestBoostAvailable('attack', attackBoostNeeded);
			}
			if (opts.bodyRatio.carry && opts.boosts.includes('carry')) {
				const carryBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.carry || 0);
				availableBoosts.carry = brain.engineeringBay.bestBoostAvailable('carry', carryBoostNeeded);
			}
			if (opts.bodyRatio.work && opts.boosts.includes('dismantle')) {
				const dismantleBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.work || 0);
				availableBoosts.dismantle = brain.engineeringBay.bestBoostAvailable('dismantle', dismantleBoostNeeded);
			}
			if (opts.bodyRatio.work && opts.boosts.includes('upgrade')) {
				const upgradeBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.work || 0);
				availableBoosts.upgrade = brain.engineeringBay.bestBoostAvailable('upgrade', upgradeBoostNeeded);
			}
			if (opts.bodyRatio.work && opts.boosts.includes('construct')) {
				const constructBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.work || 0);
				availableBoosts.construct = brain.engineeringBay.bestBoostAvailable('construct', constructBoostNeeded);
			}
			if (opts.bodyRatio.work && opts.boosts.includes('harvest')) {
				const harvestBoostNeeded = LAB_BOOST_MINERAL * (opts.maxParts.work || 0);
				availableBoosts.harvest = brain.engineeringBay.bestBoostAvailable('harvest', harvestBoostNeeded);
			}
			if (opts.boosts.includes('move')) {
				const moveBoostNeeded = LAB_BOOST_MINERAL * 50 / 3; // T1 most boost lets you do move ratio of 2 : 1
				availableBoosts.move = brain.engineeringBay.bestBoostAvailable('move', moveBoostNeeded);
			}
		}
		if (_.sum(opts.boosts, b => ['dismantle', 'upgrade', 'construct', 'harvest'].includes(b) ? 1 : 0) > 1) {
			log.warning(`Multiple boost types requested for work part! opts.boosts: ${print(opts.boosts)}`);
		}
		return availableBoosts;
	}

	/**
	 * Generates a body counts based on a body ratio and a required move ratio (which depends on the available boosts
	 * for the generating brain). If carryPartsAreWeighted=true, all carry parts are assumed to be full for the
	 * purposes of computing move speed.
	 */
	private static generateBodyCounts(brain: Brain, opts: Full<BodyOpts>, moveRatio: number,
									  rootPart: PartNonMove, partPriorities: PartNonMove[],
									  unweightedCarryParts = false): Full<BodyCounts> {

		if (partPriorities.includes(rootPart)) {
			log.error(`generateBodyCounts() error: part priorities ${partPriorities} cannot ` +
					  `include root part ${rootPart}`);
			return allZeroParts();
		}

		const bodyRatio = _.defaults(_.clone(opts.bodyRatio), allZeroParts()) as Full<BodyCounts>;
		const maxParts = _.defaults(_.clone(opts.maxParts), allZeroParts()) as Full<BodyCounts>;


		// Compute the most expensive part you may need to add to the body
		const nonZeroParts = _.filter(_.keys(opts.bodyRatio),
									  part => (<{ [p: string]: number }>opts.bodyRatio)[part] > 0);
		const maxPartCost = _.max(_.map(nonZeroParts, part => (<{ [p: string]: number }>BODYPART_COSTS)[part]));

		// Initialize body counts object
		const bodyCounts = {
			move  : 1,
			attack: bodyRatio.attack > 0 ? 1 : 0,
			ranged: bodyRatio.ranged > 0 ? 1 : 0,
			heal  : bodyRatio.heal > 0 ? 1 : 0,
			tough : bodyRatio.tough > 0 ? 1 : 0,
			work  : bodyRatio.work > 0 ? 1 : 0,
			carry : bodyRatio.carry > 0 ? 1 : 0,
			claim : bodyRatio.claim > 0 ? 1 : 0,
		} as { [part: string]: number };

		// Initialize cost of starting body counts
		let cost = 0;
		for (const part in bodyCounts) {
			cost += bodyCounts[part] * BODYPART_COSTS[part];
		}

		// Keep adding stuff until you run out of space on the body or out of energy capacity in the room
		while (_.sum(bodyCounts) < MAX_CREEP_SIZE && cost <= brain.room.energyCapacityAvailable - maxPartCost) {
			// Highest priority is add move parts to maintain the target move speed
			const weightedParts = unweightedCarryParts ? _.sum(bodyCounts) - bodyCounts.move - bodyCounts.carry
													   : _.sum(bodyCounts) - bodyCounts.move;
			if (weightedParts >= moveRatio * bodyCounts.move) {
				bodyCounts.move++;
				cost += BODYPART_COST[MOVE];
			} else {
				// If any non-root parts are below the target ratio and below the maxParts limit, add them
				let nonRootPartAdded = false;
				for (const part of partPriorities) {
					if (bodyCounts[part] < maxParts[part] &&
						bodyCounts[part] / bodyCounts[rootPart] < bodyRatio[part] / bodyRatio[rootPart]) {
						bodyCounts[part]++;
						cost += BODYPART_COSTS[part];
						nonRootPartAdded = true;
						break;
					}
				}
				// Otherwise add another root part
				if (!nonRootPartAdded) {
					bodyCounts[rootPart]++;
					cost += BODYPART_COSTS[rootPart];
				}
			}
		}

		return bodyCounts as Full<BodyCounts>;
	}


	/**
	 * Generate a body array from a count of body parts. Body is ordered as:
	 * - TOUGH -> CARRY -> MOVE -> RANGED -> WORK -> ATTACK -> CLAIM -> HEAL if opts.putMoveFirstInBody is true
	 * - TOUGH -> CARRY -> RANGED -> WORK -> ATTACK -> HEAL -> CLAIM -> MOVE if opts.putMoveFirstInBody is false
	 * - The final MOVE part is always put at the end of the body array
	 */
	private static arrangeBodyParts(partialBodyCounts: BodyCounts, opts: BodyOpts): BodyPartConstant[] {

		const bodyCounts = _.defaults(partialBodyCounts, {
			move  : 1,
			attack: 0,
			ranged: 0,
			heal  : 0,
			tough : 0,
			work  : 0,
			carry : 0,
			claim : 0,
		}) as Full<BodyCounts>;

		const body: BodyPartConstant[] = [];
		_.forEach(_.range(bodyCounts.tough), i => body.push(TOUGH));
		if (opts.putMoveFirstInBody) {
			_.forEach(_.range(bodyCounts.carry), i => body.push(CARRY));
			_.forEach(_.range(bodyCounts.move - 1), i => body.push(MOVE));
			_.forEach(_.range(bodyCounts.ranged), i => body.push(RANGED_ATTACK));
			_.forEach(_.range(bodyCounts.work), i => body.push(WORK));
			_.forEach(_.range(bodyCounts.attack), i => body.push(ATTACK));
			_.forEach(_.range(bodyCounts.claim), i => body.push(CLAIM));
			_.forEach(_.range(bodyCounts.heal), i => body.push(HEAL));
		} else {
			_.forEach(_.range(bodyCounts.carry), i => body.push(CARRY));
			_.forEach(_.range(bodyCounts.ranged), i => body.push(RANGED_ATTACK));
			_.forEach(_.range(bodyCounts.work), i => body.push(WORK));
			_.forEach(_.range(bodyCounts.attack), i => body.push(ATTACK));
			_.forEach(_.range(bodyCounts.claim), i => body.push(CLAIM));
			_.forEach(_.range(bodyCounts.move - 1), i => body.push(MOVE));
			_.forEach(_.range(bodyCounts.heal), i => body.push(HEAL));
		}
		body.push(MOVE);
		return body;
	}


	/**
	 * Creates a body plan for a creep with body ratios based around melee attack parts. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateMeleeAttackerBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.attack) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No attack!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.work) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using work parts requires dismantler body!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.ranged) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using ranged parts requires ranged body!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_MELEE = {attack: 50, tough: 10, heal: 2};
		opts.maxParts.attack = opts.maxParts.attack || DEFAULT_MAX_PARTS_MELEE.attack;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_MELEE.tough;
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_MELEE.heal;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
						  * opts.moveSpeed;

		// We need attack to be defined for bodyRatio and maxParts
		opts.bodyRatio.attack = opts.bodyRatio.attack || 1;
		opts.bodyRatio.tough = opts.bodyRatio.tough || 0;
		opts.bodyRatio.heal = opts.bodyRatio.heal || 0;

		const rootPart: PartNonMove = 'attack';
		const partPriorities: PartNonMove[] = ['tough','heal'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}


	/**
	 * Creates a body plan for a creep with body ratios based around ranged attack parts. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateRangedAttackerBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.ranged) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No ranged!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.work) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using work parts requires dismantler body!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.attack) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using ranged parts requires melee body!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_RANGED = {ranged: 40, tough: 10, heal: 20};
		opts.maxParts.ranged = opts.maxParts.ranged || DEFAULT_MAX_PARTS_RANGED.ranged;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_RANGED.tough;
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_RANGED.heal;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
								 * opts.moveSpeed;

		// We need ranged to be defined for bodyRatio and maxParts
		opts.bodyRatio.ranged = opts.bodyRatio.ranged || 1;

		const rootPart: PartNonMove = 'ranged';
		const partPriorities: PartNonMove[] = ['tough','heal'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}


	/**
	 * Creates a body plan for a creep with body ratios based around heal parts. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateHealerBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.heal) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No heal!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.work) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using work parts requires dismantler body!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.attack) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using ranged parts requires melee body!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_HEAL = {heal: 40, tough: 10, ranged: 30};
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_HEAL.heal;
		opts.maxParts.ranged = opts.maxParts.ranged || DEFAULT_MAX_PARTS_HEAL.ranged;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_HEAL.tough;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
								 * opts.moveSpeed;

		// We need heal to be defined for bodyRatio and maxParts
		opts.bodyRatio.heal = opts.bodyRatio.heal || 1;

		const rootPart: PartNonMove = 'heal';
		const partPriorities: PartNonMove[] = ['tough','ranged'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}


	/**
	 * Creates a body plan for a creep with body ratios based around work parts. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateDismantlerBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.work) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No dismantle!`);
			return {body: [], boosts: []};
		}
		if (opts.bodyRatio.attack) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; using attack parts requires melee body!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_DISMANTLER = {work: 40, tough: 10, ranged: 10, heal: 2};
		opts.maxParts.work = opts.maxParts.work || DEFAULT_MAX_PARTS_DISMANTLER.work;
		opts.maxParts.ranged = opts.maxParts.ranged || DEFAULT_MAX_PARTS_DISMANTLER.ranged;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_DISMANTLER.tough;
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_DISMANTLER.heal;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
								 * opts.moveSpeed;

		// We need work to be defined for bodyRatio and maxParts
		opts.bodyRatio.work = opts.bodyRatio.work || 1;

		const rootPart: PartNonMove = 'work';
		const partPriorities: PartNonMove[] = ['tough','ranged','heal'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}


	/**
	 * Creates a body plan for a creep with body ratios based around work parts. Move speed for this method
	 * assumes that all carry parts are empty, as you won't move an upgrader with energy. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateUpgraderBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.work) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No dismantle!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_UPGRADER = {work: 50, tough: 10, carry: 20, heal: 2};
		opts.maxParts.work = opts.maxParts.work || DEFAULT_MAX_PARTS_UPGRADER.work;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_UPGRADER.tough;
		opts.maxParts.carry = opts.maxParts.carry || DEFAULT_MAX_PARTS_UPGRADER.carry;
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_UPGRADER.heal;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
								 * opts.moveSpeed;

		// We need work to be defined for bodyRatio and maxParts
		opts.bodyRatio.work = opts.bodyRatio.work || 1;

		const rootPart: PartNonMove = 'work';
		const partPriorities: PartNonMove[] = ['tough','carry', 'heal'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities, true);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}


	/**
	 * Creates a body plan for a creep with body ratios based around carry parts. The method will try to create
	 * the largest creep which can be spawned from a brain, which has a target move speed after the best available
	 * requested move boosts are applied, which has a body ratio specified by opts.bodyRatio, and where max part
	 * counts are capped by opts.maxParts.
	 */
	static generateCarrierBody(brain: Brain, opts: Full<BodyOpts>): BodyGeneratorReturn {

		if (!opts.bodyRatio.carry) {
			log.error(`Bad opts.bodyRatio: ${opts.bodyRatio}; No carry!`);
			return {body: [], boosts: []};
		}

		const DEFAULT_MAX_PARTS_CARRIER = {carry: 50, tough: 10, heal: 3};
		opts.maxParts.carry = opts.maxParts.attack || DEFAULT_MAX_PARTS_CARRIER.carry;
		opts.maxParts.tough = opts.maxParts.tough || DEFAULT_MAX_PARTS_CARRIER.tough;
		opts.maxParts.heal = opts.maxParts.heal || DEFAULT_MAX_PARTS_CARRIER.heal;

		const availableBoosts = CombatCreepSetup.getBestBoostsAvailable(brain, opts);

		if (!availableBoosts.tough) { // no point in adding tough parts if they can't be boosted
			opts.bodyRatio.tough = 0;
		}

		const moveRatio = (availableBoosts.move ? BOOST_EFFECTS.move[availableBoosts.move].fatigue : 1)
								 * opts.moveSpeed;

		// We need carry to be defined for bodyRatio and maxParts
		opts.bodyRatio.carry = opts.bodyRatio.carry || 1;
		opts.bodyRatio.tough = opts.bodyRatio.tough || 0;
		opts.bodyRatio.heal = opts.bodyRatio.heal || 0;

		const rootPart: PartNonMove = 'carry';
		const partPriorities: PartNonMove[] = ['tough','heal'];
		const bodyCounts = CombatCreepSetup.generateBodyCounts(brain, opts, moveRatio, rootPart, partPriorities);

		const body = CombatCreepSetup.arrangeBodyParts(bodyCounts, opts);
		const boosts = _.compact(_.values(availableBoosts)) as ResourceConstant[];
		return {body: body, boosts: boosts};

	}

}

export class MeleeBotSetup extends CombatCreepSetup {
    constructor(opts: SimpleBodyOpts = {}) {
        _.defaults(opts, {moveSpeed: 1, boosted: false, healing: false, bodyOpts: {}});
        const combatBodyOpts: Full<BodyOpts> = {
            moveSpeed         : opts.moveSpeed || 1,
			putMoveFirstInBody: true,
			bodyRatio         : {attack: 30, tough: opts.armored ? 10 : 0, heal: opts.healing ? 2 : 0},
			maxParts          : {attack: 50, tough: 10, heal: 2},
			boosts            : opts.boosted ? ['attack', 'tough', 'heal', 'move'] : [],
        }
        const bodyOpts: Full<BodyOpts> = _.defaults(opts.bodyOpts || {}, combatBodyOpts);
		super(Roles.melee, bodyOpts, CombatCreepSetup.generateMeleeAttackerBody);
    }
}

export class RangedBotSetup extends CombatCreepSetup {
	constructor(opts: SimpleBodyOpts = {}) {
		_.defaults(opts, {moveSpeed: 1, boosted: false, armored: false, healing: true, bodyOpts: {}});
		const rangedBodyOpts: Full<BodyOpts> = {
			moveSpeed         : opts.moveSpeed || 1,
			putMoveFirstInBody: false,
			bodyRatio         : {ranged: 12, tough: opts.armored ? 3 : 0, heal: opts.healing ? 4 : 0},
			maxParts          : {ranged: 30, tough: 8, heal: 10},
			boosts            : opts.boosted ? ['ranged', 'tough', 'heal', 'move'] : [],
		};
		const bodyOpts: Full<BodyOpts> = _.defaults(opts.bodyOpts || {}, rangedBodyOpts);
		super(Roles.ranged, bodyOpts, CombatCreepSetup.generateRangedAttackerBody);
	}
}

export class HealingBotSetup extends CombatCreepSetup {
	constructor(opts: SimpleBodyOpts = {}) {
		_.defaults(opts, {moveSpeed: 1, boosted: false, armored: false, withRanged: false, bodyOpts: {}});
		const healerBodyOpts: Full<BodyOpts> = {
			moveSpeed         : opts.moveSpeed || 1,
			putMoveFirstInBody: false,
			bodyRatio         : {heal: 12, tough: opts.armored ? 3 : 0, ranged: opts.withRanged ? 4 : 0},
			maxParts          : {heal: 30, tough: 8, ranged: 10},
			boosts            : opts.boosted ? ['ranged', 'tough', 'heal', 'move'] : [],
		};
		const bodyOpts: Full<BodyOpts> = _.defaults(opts.bodyOpts || {}, healerBodyOpts);
		super(Roles.healer, bodyOpts, CombatCreepSetup.generateHealerBody);
	}
}

global.CombatCreepSetup = CombatCreepSetup;
global.DefaultCombatCreepSetups = {
    meleeBot: MeleeBotSetup,
    rangedBot: RangedBotSetup,
    healingBot: HealingBotSetup,
}

