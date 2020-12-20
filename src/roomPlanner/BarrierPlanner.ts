import { getAllStructureCoordsFromLayout, RoomPlanner, translatePositions } from "./RoomPlanner";
import { Brain } from "Brian";
import { Mem } from "memory/memory";
import { BUNKER_RADIUS, insideBunkerBounds, bunkerLayout } from "./layout/bunker";
import { minMax } from "utils/utils";
import { profile } from "profiler";
import { getCutTiles } from "algorithms/minCut";
import { log } from "console/log";
import { packCoordList, packCoord, unpackCoordListAsPosList } from "utils/packrat";

export interface BarrierPlannerMemory {
	barrierCoordsPacked: string;
}

const getDefaultBarrierPlannerMemory: () => BarrierPlannerMemory = () => ({
	barrierCoordsPacked: '',
});

@profile
export class BarrierPlanner {

	private brain: Brain;
	private memory: BarrierPlannerMemory;
	private roomPlanner: RoomPlanner;
	private barrierPositions: RoomPosition[];
	private _barrierLookup: ((pos: RoomPosition) => boolean) | undefined;

	static settings = {
		buildBarriersAtRCL: 3,
		padding           : 3, // allow this much space between structures and barriers (if possible)
		bunkerizeRCL      : 7
	};

	constructor(roomPlanner: RoomPlanner) {
		this.roomPlanner = roomPlanner;
		this.brain = roomPlanner.brain;
		this.memory = Mem.wrap(this.brain.memory, 'barrierPlanner', getDefaultBarrierPlannerMemory);
		this.barrierPositions = [];
	}

	refresh(): void {
		this.memory = Mem.wrap(this.brain.memory, 'barrierPlanner', getDefaultBarrierPlannerMemory);
		this.barrierPositions = [];
	}

	private computeBunkerBarrierPositions(bunkerPos: RoomPosition, upgradeSitePos: RoomPosition): RoomPosition[] {
		const rectArray = [];
		const padding = BarrierPlanner.settings.padding;
		if (bunkerPos) {
			const {x, y} = bunkerPos;
			const r = BUNKER_RADIUS - 1;
			let [x1, y1] = [Math.max(x - r - padding, 0), Math.max(y - r - padding, 0)];
			let [x2, y2] = [Math.min(x + r + padding, 49), Math.min(y + r + padding, 49)];
			// Make sure you don't leave open walls
			x1 = minMax(x1, 3, 50 - 3);
			x2 = minMax(x2, 3, 50 - 3);
			y1 = minMax(y1, 3, 50 - 3);
			y2 = minMax(y2, 3, 50 - 3);
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		const barrierCoords = getCutTiles(this.brain.name, rectArray, false, 2, false);
		let positions = _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.brain.name));
		positions = positions.concat(upgradeSitePos.availableNeighbors(true));
		return positions;
	}

	private computeBarrierPositions(hatcheryPos: RoomPosition, commandCenterPos: RoomPosition,
									upgradeSitePos: RoomPosition): RoomPosition[] {
		const rectArray = [];
		const padding = BarrierPlanner.settings.padding;
		if (hatcheryPos) {
			const {x, y} = hatcheryPos;
			const [x1, y1] = [Math.max(x - 5 - padding, 0), Math.max(y - 4 - padding, 0)];
			const [x2, y2] = [Math.min(x + 5 + padding, 49), Math.min(y + 6 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (commandCenterPos) {
			const {x, y} = commandCenterPos;
			const [x1, y1] = [Math.max(x - 3 - padding, 0), Math.max(y - 0 - padding, 0)];
			const [x2, y2] = [Math.min(x + 0 + padding, 49), Math.min(y + 5 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (upgradeSitePos) {
			const {x, y} = upgradeSitePos;
			const [x1, y1] = [Math.max(x - 1, 0), Math.max(y - 1, 0)];
			const [x2, y2] = [Math.min(x + 1, 49), Math.min(y + 1, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		const barrierCoords = getCutTiles(this.brain.name, rectArray, true, 2, false);
		return _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.brain.name));
	}

	init(): void {

	}

	/* Write everything to memory after roomPlanner is closed */
	finalize(): void {
		if (this.barrierPositions.length == 0) {
			if (this.roomPlanner.bunkerPos) {
				this.barrierPositions = this.computeBunkerBarrierPositions(this.roomPlanner.bunkerPos,
																		   this.brain.controller.pos);
			} else if (this.roomPlanner.storagePos && this.roomPlanner.spawnerPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.spawnerPos,
																	 this.roomPlanner.storagePos,
																	 this.brain.controller.pos);
			} else {
				log.error(`${this.brain.print} BARRIER PLANNER: couldn't generate barrier plan!`);
				return;
			}
		}
		this.memory.barrierCoordsPacked = packCoordList(this.barrierPositions);
	}

	/* Quick lookup for if a barrier should be in this position. Barriers returning false won't be maintained. */
	barrierShouldBeHere(pos: RoomPosition): boolean {
		// Once you are high level, only maintain ramparts at bunker or controller
		if (this.brain.layout == 'bunker' && this.brain.level >= BarrierPlanner.settings.bunkerizeRCL) {
			return insideBunkerBounds(pos, this.brain) || pos.getRangeTo(this.brain.controller) == 1;
		}
		// Otherwise look up from memory
		if (this._barrierLookup == undefined) {
			this._barrierLookup = _.memoize((p: RoomPosition) =>
												this.memory.barrierCoordsPacked.includes(packCoord(p)));
		}
		return this._barrierLookup(pos);
	}

	/* Create construction sites for any buildings that need to be built */
	private buildMissingRamparts(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerBrain - this.brain.constructionSites.length;

		// Build missing ramparts
		const barrierPositions = unpackCoordListAsPosList(this.memory.barrierCoordsPacked, this.brain.room.name);

		// Add critical structures to barrier lookup
		const criticalStructures: Structure[] = _.compact([...this.brain.towers,
														   ...this.brain.spawns,
														   this.brain.storage!,
														   this.brain.terminal!]);
		for (const structure of criticalStructures) {
			barrierPositions.push(structure.pos);
		}

		for (const pos of barrierPositions) {
			if (count > 0 && RoomPlanner.canBuild(STRUCTURE_RAMPART, pos) && this.barrierShouldBeHere(pos)) {
				const ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.brain.name}: couldn't create rampart site at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	private buildMissingBunkerRamparts(): void {
		if (!this.roomPlanner.bunkerPos) return;
		const bunkerCoords = getAllStructureCoordsFromLayout(bunkerLayout, this.brain.level);
		bunkerCoords.push(bunkerLayout.data.anchor); // add center bunker tile
		let bunkerPositions = _.map(bunkerCoords, coord => new RoomPosition(coord.x, coord.y, this.brain.name));
		bunkerPositions = translatePositions(bunkerPositions, bunkerLayout.data.anchor, this.roomPlanner.bunkerPos);
		let count = RoomPlanner.settings.maxSitesPerBrain - this.brain.constructionSites.length;
		for (const pos of bunkerPositions) {
			if (count > 0 && !pos.lookForStructure(STRUCTURE_RAMPART)
				&& pos.lookFor(LOOK_CONSTRUCTION_SITES).length == 0) {
				const ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.brain.name}: couldn't create bunker rampart at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	run(): void {
		if (this.roomPlanner.active) {
			if (this.roomPlanner.bunkerPos) {
				this.barrierPositions = this.computeBunkerBarrierPositions(this.roomPlanner.bunkerPos,
																		   this.brain.controller.pos);
			} else if (this.roomPlanner.storagePos && this.roomPlanner.spawnerPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.spawnerPos,
																	 this.roomPlanner.storagePos,
																	 this.brain.controller.pos);
			}
			this.visuals();
		} else {
			if (!this.roomPlanner.memory.relocating && this.brain.level >= BarrierPlanner.settings.buildBarriersAtRCL
				&& this.roomPlanner.shouldRecheck(2)) {
				this.buildMissingRamparts();
				if (this.brain.layout == 'bunker' && this.brain.level >= 7) {
					this.buildMissingBunkerRamparts();
				}
			}
		}
	}

	visuals(): void {
		for (const pos of this.barrierPositions) {
			this.brain.room.visual.structure(pos.x, pos.y, STRUCTURE_RAMPART);
		}
	}

}
