import { packCoord } from '../../utils/packrat';
import { StructureLayout, getAllStructureCoordsFromLayout } from 'roomPlanner/RoomPlanner';
import { Brain } from 'Brian';

export const BUNKER_RADIUS = 4;

export const bunkerLayout: StructureLayout = {
	data: {
		anchor: { 'x': 25, 'y': 25 }
	},
	1: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	2: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '2',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	3: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '3',
		'buildings': {
			"extension": { "pos":
			[
				{ "x": 25, "y": 23 },
				{ "x": 26, "y": 23 },
				{ "x": 27, "y": 23 },
				{ "x": 25, "y": 24 },
				{ "x": 26, "y": 25 }
			]},
			"spawn": { "pos": [{ "x": 27, "y": 24 }] },
			"container": { "pos": [{ "x": 27, "y": 25 }] } }
	},
	4: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	5: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	6: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	7: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
	8: {
		'name': 'bunkerCore',
		'shard': 'shard2',
		'rcl': '1',
		'buildings': {
			'spawn': { 'pos': [{ 'x': 29, 'y': 25 }] }
		}
	},
};


let _allBunkerCoords: { [rcl: number]: Coord[] } = {};
for (let rcl of [1, 2, 3, 4, 5, 6, 7, 8]) {
	if (bunkerLayout[rcl]!.buildings) {
		_allBunkerCoords[rcl] = getAllStructureCoordsFromLayout(bunkerLayout, rcl);
	}
	if (rcl == 7 || rcl == 8) { // add center tile for advanced bunkers
		_allBunkerCoords[rcl].push(bunkerLayout.data.anchor);
	}
}
export const allBunkerCoords = _allBunkerCoords;

export const bunkerCoordLookup = _.mapValues(_allBunkerCoords,
	(coordArr: Coord[]) =>
		_.zipObject(_.map(coordArr,
			c => [packCoord(c), true])
		)) as { [rcl: number]: { [coordName: string]: true | undefined } };


// Fast function for checking if a position is inside the bunker
export function insideBunkerBounds(pos: RoomPosition, brain: Brain): boolean {
	if (brain.roomPlanner.memory.bunkerData && brain.roomPlanner.memory.bunkerData.anchor) {
		const dx = bunkerLayout.data.anchor.x - brain.roomPlanner.memory.bunkerData.anchor.x;
		const dy = bunkerLayout.data.anchor.y - brain.roomPlanner.memory.bunkerData.anchor.y;
		const coord = { x: pos.x + dx, y: pos.y + dy };
		return (!!bunkerCoordLookup[brain.level][packCoord(coord)]);
	}
	return false;
}
