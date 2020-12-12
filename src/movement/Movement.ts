export interface MoveOptions {
	direct?: boolean;							// ignore all terrain costs
	terrainCosts?: {							// terrain costs, determined automatically for creep body if unspecified
		plainCost: number,							// plain costs; typical: 2
		swampCost: number							// swamp costs; typical: 10
	};											//
	force?: boolean;							// whether to ignore Zerg.blockMovement
	ignoreCreeps?: boolean;						// ignore pathing around creeps
	ignoreCreepsOnDestination?: boolean; 		// ignore creeps currently standing on the destination
	ignoreStructures?: boolean;					// ignore pathing around structures
	preferHighway?: boolean;					// prefer alley-type rooms
	allowHostile?: boolean;						// allow to path through hostile rooms; origin/destination room excluded
	avoidSK?: boolean;							// avoid walking within range 4 of source keepers
	range?: number;								// range to approach target
	fleeRange?: number;							// range to flee from targets
	obstacles?: RoomPosition[];					// don't path through these room positions
	restrictDistance?: number;					// restrict the distance of route to this number of rooms
	useFindRoute?: boolean;						// whether to use the route finder; determined automatically otherwise
	maxOps?: number;							// pathfinding times out after this many operations
	movingTarget?: boolean;						// appends a direction to path in case creep moves
	stuckValue?: number;						// creep is marked stuck after this many idle ticks
	maxRooms?: number;							// maximum number of rooms to path through
	repath?: number;							// probability of repathing on a given tick
	repathOnceVisible?: boolean;				// repath after gaining visibility to a previously invisible room
	route?: { [roomName: string]: boolean };	// lookup table for allowable pathing rooms
	ensurePath?: boolean;						// can be useful if route keeps being found as incomplete
	noPush?: boolean;							// whether to ignore pushing behavior
	modifyRoomCallback?: (r: Room, m: CostMatrix) => CostMatrix; // modifications to default cost matrix calculations
	waypoints?: RoomPosition[];					// list of waypoints to visit on the way to target
}
