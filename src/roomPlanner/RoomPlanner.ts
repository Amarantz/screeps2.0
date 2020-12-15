
export interface BuildingPlannerOutput {
	name?: string;
	shard?: string;
	rcl?: string | number;
	buildings: { [structureType: string]: { pos: Coord[] } };
}

export interface StructureLayout {
	[rcl: number]: BuildingPlannerOutput | undefined;

	data: {
		anchor: Coord;
		pointsOfInterest?: {
			[pointLabel: string]: Coord | Coord[];
		}
	};
}

export function getAllStructureCoordsFromLayout(layout: StructureLayout, rcl: number): Coord[] {
	if (!layout[rcl]) {
		return [];
	}
	const positionsByType = layout[rcl]!.buildings;
	let coords: Coord[] = [];
	for (const structureType in positionsByType) {
		coords = coords.concat(positionsByType[structureType].pos);
	}
	return _.unique(coords, coord => coord.x + 50 * coord.y);
}
