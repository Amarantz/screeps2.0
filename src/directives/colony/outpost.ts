import { Cartographer, ROOMTYPE_CONTROLLER } from "utils/Cartographer";
import { log } from "console/log";
import { profile } from 'profiler';
import { Directive } from "directives/directive";
import { RoomIntel } from "intel/RoomIntel";
import { ReserveringManager } from "../../managers/colonization/reserver";
import { StationaryScoutManager } from "managers/scouting/stationaryScout";

/**
 * Registers an unowned mining outpost for a nearby brain
 */
@profile
export class DirectiveOutpost extends Directive {

	static directiveName = 'outpost';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_PURPLE;

	static settings = {
		canSpawnReserversAtRCL: 3,
	};

	HigherManager() {
		if (this.brain.level >= DirectiveOutpost.settings.canSpawnReserversAtRCL) {
			if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_CONTROLLER) {
				this.managers.reserve = new ReserveringManager(this);
			}
		} else {
			this.managers.scout = new StationaryScoutManager(this);
		}
	}

	init(): void {

	}

	run(): void {
		if (RoomIntel.roomOwnedBy(this.pos.roomName)) {
			log.warning(`Removing ${this.print} since room is owned!`);
			this.remove();
		}
		if (Game.time % 10 == 3 && this.room && this.room.controller
			&& !this.pos.isEqualTo(this.room.controller.pos) && !this.memory.setPos) {
			this.setPosition(this.room.controller.pos);
		}
	}
}
