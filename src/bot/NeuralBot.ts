import { Movement } from "movement/Movement";
import { CombatBot } from "./CombatBot";

const AVOID_RANGE = 4;
const APPROACH_RANGE = 1;

export class NeuralBot extends CombatBot {

	isNeuralBot: true;
	isBot: boolean;

	constructor(creep: Creep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		this.isNeuralBot = true;
		this.isBot = creep.name.includes('_BOT');
	}

	approachHostiles() {
		const approach = _.map(this.room.hostiles, hostile => ({pos: hostile.pos, range: APPROACH_RANGE}));
		return Movement.combatMove(this, approach, []);
	}

	avoidHostiles() {
		const avoid = _.map(this.room.hostiles, hostile => ({pos: hostile.pos, range: AVOID_RANGE}));
		return Movement.combatMove(this, [], avoid);
	}

	approachAllies() {
		const approach = _.map(this.room.creeps, friendly => ({pos: friendly.pos, range: APPROACH_RANGE}));
		return Movement.combatMove(this, approach, []);
	}

	avoidAllies() {
		const avoid = _.map(this.room.creeps, friendly => ({pos: friendly.pos, range: AVOID_RANGE}));
		return Movement.combatMove(this, [], avoid);
	}

	maneuver(approachTargs: HasPos[], avoidTargs: HasPos[]) {
		const approach = _.map(approachTargs, targ => ({pos: targ.pos, range: APPROACH_RANGE}));
		const avoid = _.map(avoidTargs, targ => ({pos: targ.pos, range: AVOID_RANGE}));
		return Movement.combatMove(this, approach, avoid);
	}

	autoEngage(combatTarget?: NeuralBot) {
		const target = combatTarget ? [combatTarget.creep] : undefined;
		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(target); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged(target);
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}
	}

}
