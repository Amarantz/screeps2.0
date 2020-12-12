import { profile } from "../profiler";
import { MoveOptions } from "./Movement";
import { $ } from '../caching/GlobalCache';
import { Cartographer, ROOMTYPE_SOURCEKEEPER, ROOMTYPE_ALLEY } from "utils/Cartographer";

const DEFAULT_MAXOPS = 20000;		// Default timeout for pathfinding
const CREEP_COST = 0xfe;

export interface TerrainCosts {
    plainCost: number;
    swampCost: number;
}

export const MatrixTypes = {
    direct: 'dir',
    default: 'def',
    sk: 'sk',
    obstacle: 'obst',
    preferRampart: 'preframp'
};

@profile
export class Pathing {
    /**
 * Check if the room should be avoiding when calculating routes
 */
    static shouldAvoid(roomName: string) {
        return Memory.rooms[roomName] && Memory.rooms[roomName][_RM.AVOID];
    }

    /**
 * Update memory on whether a room should be avoided based on controller owner
 */
    static updateRoomStatus(room: Room) {
        if (!room) {
            return;
        }
        if (room.controller) {
            if (room.controller.owner && !room.controller.my && room.towers.length > 0) {
                room.memory[_RM.AVOID] = true;
            } else {
                delete room.memory[_RM.AVOID];
                // if (room.memory.expansionData == false) delete room.memory.expansionData;
            }
        }
    }

    static findPath(origin: RoomPosition, destination: RoomPosition, options: MoveOptions = {}): PathFinderPath {
        _.defaults(options, {
            ignoreCreeps: true,
            maxOps: DEFAULT_MAXOPS,
            range: 1,
            terrainCosts: { plainCost: 1, swampCost: 5 },
        });

        if (options.movingTarget) {
            options.range = 0;
        }

        // check to see whether findRoute should be used
        const roomDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
        let allowedRooms = options.route;
        if (!allowedRooms && (options.useFindRoute || (options.useFindRoute === undefined && roomDistance > 2))) {
            allowedRooms = this.findRoute(origin.roomName, destination.roomName, options);
        }

        if (options.direct) {
            options.terrainCosts = { plainCost: 1, swampCost: 1 };
        }

        const callback = (roomName: string) => this.roomCallback(roomName, origin, destination, allowedRooms, options);
        let ret = PathFinder.search(origin, { pos: destination, range: options.range! }, {
            maxOps: options.maxOps,
            maxRooms: options.maxRooms,
            plainCost: options.terrainCosts!.plainCost,
            swampCost: options.terrainCosts!.swampCost,
            roomCallback: callback,
        });

        if (ret.incomplete && options.ensurePath) {
            if (options.useFindRoute == undefined) {
                // handle case where pathfinder failed at a short distance due to not using findRoute
                // can happen for situations where the creep would have to take an uncommonly indirect path
                // options.allowedRooms and options.routeCallback can also be used to handle this situation
                if (roomDistance <= 2) {
                    options.useFindRoute = true;
                    ret = this.findPath(origin, destination, options);
                    return ret;
                }
            } else {

            }
        }
        return ret;
    }

    static findRoute(origin: string, destination: string,
        options: MoveOptions = {}): { [roomName: string]: boolean } | undefined {
        const linearDistance = Game.map.getRoomLinearDistance(origin, destination);
        const restrictDistance = options.restrictDistance || linearDistance + 10;
        const allowedRooms = { [origin]: true, [destination]: true };

        // Determine whether to use highway bias
        let highwayBias = 1;
        if (options.preferHighway) {
            highwayBias = 2.5;
        } else if (options.preferHighway != false) {
            // if (linearDistance > 8) {
            // 	highwayBias = 2.5;
            // } else {
            // 	let oCoords = Cartographer.getRoomCoordinates(origin);
            // 	let dCoords = Cartographer.getRoomCoordinates(destination);
            // 	if (_.any([oCoords.x, oCoords.y, dCoords.x, dCoords.y], z => z % 10 <= 1 || z % 10 >= 9)) {
            // 		highwayBias = 2.5;
            // 	}
            // }
        }

        const ret = (<GameMap>Game.map).findRoute(origin, destination, {
            routeCallback: (roomName: string) => {
                const rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
                if (rangeToRoom > restrictDistance) { // room is too far out of the way
                    return Number.POSITIVE_INFINITY;
                }
                if (!options.allowHostile && this.shouldAvoid(roomName) &&
                    roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
                    return Number.POSITIVE_INFINITY;
                }
                if (options.preferHighway && Cartographer.roomType(roomName) == ROOMTYPE_ALLEY) {
                    return 1;
                }
                return highwayBias;
            },
        });

        if (!_.isArray(ret)) {
            // log.warning(`Movement: couldn't findRoute from ${origin} to ${destination}!`);
        } else {
            for (const value of ret) {
                allowedRooms[value.room] = true;
            }
            return allowedRooms;
        }
        return;
    }

    /**
    * Returns the shortest path from start to end position, regardless of (passable) terrain
    */
    static findShortestPath(startPos: RoomPosition, endPos: RoomPosition,
        options: MoveOptions = {}): PathFinderPath {
        _.defaults(options, {
            ignoreCreeps: true,
            range: 1,
            direct: true,
        });
        const ret = this.findPath(startPos, endPos, options);
        // if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${endPos.print}!`);
        return ret;
    }

    /**
    * Returns the shortest path from start to end position, regardless of (passable) terrain
    */
    static findPathToRoom(startPos: RoomPosition, roomName: string, options: MoveOptions = {}): PathFinderPath {
        options.range = 23;
        const ret = this.findPath(startPos, new RoomPosition(25, 25, roomName), options);
        // if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${roomName}!`);
        return ret;
    }

    /**
    * Default room callback, which automatically determines the most appropriate callback method to use
    */
    static roomCallback(roomName: string, origin: RoomPosition, destination: RoomPosition,
        allowedRooms: { [roomName: string]: boolean } | undefined,
        options: MoveOptions): CostMatrix | boolean {
        if (allowedRooms && !allowedRooms[roomName]) {
            return false;
        }
        if (!options.allowHostile && this.shouldAvoid(roomName)
            && roomName != origin.roomName && roomName != destination.roomName) {
            return false;
        }

        const room = Game.rooms[roomName];
        if (room) {
            const matrix = this.getCostMatrix(room, options, false);
            // Modify cost matrix if needed
            if (options.modifyRoomCallback) {
                return options.modifyRoomCallback(room, matrix.clone());
            } else {
                return matrix;
            }
        } else { // have no vision
            return this.getCostMatrixForInvisibleRoom(roomName, options);
        }
    }


	/**
	 * Find the first walkable position in the room, spiraling outward from the center
	 */
    static findPathablePosition(roomName: string,
        clearance: { width: number, height: number } = { width: 1, height: 1 }): RoomPosition {
        const terrain = Game.map.getRoomTerrain(roomName);

        let x, y: number;
        let allClear: boolean;
        for (let radius = 0; radius < 23; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dy) !== radius && Math.abs(dx) !== radius) {
                        continue;
                    }
                    x = 25 + dx;
                    y = 25 + dy;
                    allClear = true;
                    for (let w = 0; w < clearance.width; w++) {
                        for (let h = 0; h < clearance.height; h++) {
                            if (terrain.get(x + w, y + h) === TERRAIN_MASK_WALL) {
                                allClear = false;
                            }
                        }
                    }
                    if (allClear) {
                        return new RoomPosition(x, y, roomName);
                    }
                }
            }
        }
        // Should never reach here!
        return new RoomPosition(-10, -10, 'cannotFindPathablePosition');
    }

    /**
 * Sets hostile creep positions to impassible
 */
    static blockHostileCreeps(matrix: CostMatrix, room: Room) {
        _.forEach(room.hostiles, hostile => {
            matrix.set(hostile.pos.x, hostile.pos.y, CREEP_COST);
        });
    }

	/**
	 * Sets all creep positions to impassible
	 */
    static blockAllCreeps(matrix: CostMatrix, room: Room) {
        _.forEach(room.find(FIND_CREEPS), creep => {
            matrix.set(creep.pos.x, creep.pos.y, CREEP_COST);
        });
    }

	/**
	 * Sets road positions to 1 if cost is less than 0xfe
	 */
    static preferRoads(matrix: CostMatrix, room: Room) {
        _.forEach(room.roads, road => {
            if (matrix.get(road.pos.x, road.pos.y) < 0xfe) {
                matrix.set(road.pos.x, road.pos.y, 1);
            }
        });
    }

	/**
	 * Sets walkable rampart positions to 1 if cost is less than 0xfe
	 */
    static preferRamparts(matrix: CostMatrix, room: Room) {
        _.forEach(room.walkableRamparts, rampart => {
            if (matrix.get(rampart.pos.x, rampart.pos.y) < 0xfe) {
                matrix.set(rampart.pos.x, rampart.pos.y, 1);
            }
        });
    }

	/**
	 * Sets walkable rampart positions to 1, everything else is blocked
	 */
    static blockNonRamparts(matrix: CostMatrix, room: Room) {
        for (let y = 0; y < 50; ++y) {
            for (let x = 0; x < 50; ++x) {
                matrix.set(x, y, 0xff);
            }
        }
        _.forEach(room.walkableRamparts, rampart => {
            matrix.set(rampart.pos.x, rampart.pos.y, 1);
        });
    }

    /**
 * Get a cloned copy of the cost matrix for a room with specified options
 */
    static getCostMatrix(room: Room, options: MoveOptions, clone = true): CostMatrix {
        let matrix: CostMatrix;
        if (options.ignoreCreeps == false) {
            matrix = this.getCreepMatrix(room);
        } else if (options.avoidSK) {
            matrix = this.getSkMatrix(room);
        } else if (options.ignoreStructures) {
            matrix = new PathFinder.CostMatrix();
        } else if (options.direct) {
            matrix = this.getDirectMatrix(room);
        } else {
            matrix = this.getDefaultMatrix(room);
        }
        // Register other obstacles
        if (options.obstacles && options.obstacles.length > 0) {
            matrix = matrix.clone();
            for (const obstacle of options.obstacles) {
                if (obstacle && obstacle.roomName == room.name) {
                    matrix.set(obstacle.x, obstacle.y, 0xff);
                }
            }
        }
        if (clone) {
            matrix = matrix.clone();
        }
        return matrix;
    }

    /**
 * Default matrix for a room, setting impassable structures and constructionSites to impassible, ignoring roads
 */
    static getDirectMatrix(room: Room): CostMatrix {
        return $.costMatrix(room.name, MatrixTypes.direct, () => {
            const matrix = new PathFinder.CostMatrix();
            // Set passability of structure positions
            const impassibleStructures: Structure[] = [];
            _.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
                if (!s.isWalkable) {
                    impassibleStructures.push(s);
                }
            });
            _.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
            const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
            _.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, 0xfe));
            // Set passability of construction sites
            _.forEach(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => {
                if (!site.isWalkable) {
                    matrix.set(site.pos.x, site.pos.y, 0xff);
                }
            });
            return matrix;
        });
    }

    /**
 * Avoids creeps in a room
 */
    static getCreepMatrix(room: Room, fromMatrix?: CostMatrix): CostMatrix {
        if (room._creepMatrix) {
            return room._creepMatrix;
        }
        const matrix = this.getDefaultMatrix(room).clone();
        _.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, CREEP_COST)); // don't block off entirely
        room._creepMatrix = matrix;
        return room._creepMatrix;
    }

    private static getCostMatrixForInvisibleRoom(roomName: string, options: MoveOptions,
        clone = true): CostMatrix | boolean {
        let matrix: CostMatrix | undefined;
        if (options.avoidSK) {
            matrix = $.costMatrixRecall(roomName, MatrixTypes.sk);
        } else if (options.direct) {
            matrix = $.costMatrixRecall(roomName, MatrixTypes.direct);
        } else {
            matrix = $.costMatrixRecall(roomName, MatrixTypes.default);
        }
        // Register other obstacles
        if (matrix && options.obstacles && options.obstacles.length > 0) {
            matrix = matrix.clone();
            for (const obstacle of options.obstacles) {
                if (obstacle && obstacle.roomName == roomName) {
                    matrix.set(obstacle.x, obstacle.y, 0xff);
                }
            }
        }
        if (matrix && clone) {
            matrix = matrix.clone();
        }
        return matrix || true;
    }

    /**
 * Avoids source keepers in a room
 */
    private static getSkMatrix(room: Room): CostMatrix {
        if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) {
            return this.getDefaultMatrix(room);
        }
        return $.costMatrix(room.name, MatrixTypes.sk, () => {
            const matrix = this.getDefaultMatrix(room).clone();
            const avoidRange = 6;
            _.forEach(room.keeperLairs, lair => {
                for (let dx = -avoidRange; dx <= avoidRange; dx++) {
                    for (let dy = -avoidRange; dy <= avoidRange; dy++) {
                        matrix.set(lair.pos.x + dx, lair.pos.y + dy, 0xfe);
                    }
                }
            });
            return matrix;
        });
    }

    /**
 * Default matrix for a room, setting impassable structures and constructionSites to impassible
 */
    static getDefaultMatrix(room: Room): CostMatrix {
        return $.costMatrix(room.name, MatrixTypes.default, () => {
            const matrix = new PathFinder.CostMatrix();
            // Set passability of structure positions
            const impassibleStructures: Structure[] = [];
            _.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
                if (s.structureType == STRUCTURE_ROAD) {
                    matrix.set(s.pos.x, s.pos.y, 1);
                } else if (!s.isWalkable) {
                    impassibleStructures.push(s);
                }
            });
            _.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
            const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
            _.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, 0xfe));
            // Set passability of construction sites
            _.forEach(room.find(FIND_CONSTRUCTION_SITES), (site: ConstructionSite) => {
                if (site.my && !site.isWalkable) {
                    matrix.set(site.pos.x, site.pos.y, 0xff);
                }
            });
            return matrix;
        });
    }


    	/**
	 * Calculate and/or cache the length of the shortest path between two points.
	 * Cache is probabilistically cleared in Mem
	 */
	static distance(arg1: RoomPosition, arg2: RoomPosition): number {
		const [name1, name2] = [arg1.name, arg2.name].sort(); // alphabetize since path is the same in either direction
		if (!Memory.pathing.distances[name1]) {
			Memory.pathing.distances[name1] = {};
		}
		if (!Memory.pathing.distances[name1][name2]) {
			const ret = this.findShortestPath(arg1, arg2);
			if (!ret.incomplete) {
				Memory.pathing.distances[name1][name2] = ret.path.length;
			}
		}
		return Memory.pathing.distances[name1][name2];
	}

}
