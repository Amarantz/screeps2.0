import { Cartographer, ROOMTYPE_CONTROLLER } from "utils/Cartographer";
import { log } from "console/log";
import { profile } from 'profiler';
import { Directive } from "directives/directive";
import { RoomIntel } from "intel/RoomIntel";

/**
 * Registers an unowned mining outpost for a nearby brain
 */
@profile
export class DirectiveOutpostSK extends Directive {

	static directiveName = 'outpostSK';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_YELLOW;
	static settings = {
		canSpawnReserversAtRCL: 3,
	};

	constructor(flag: Flag) {
		super(flag, brain => brain.level >= 7);
		this.refresh();
	}

	HigherManager() {
	}

	init(): void {

	}

	run(): void {
	}
}
