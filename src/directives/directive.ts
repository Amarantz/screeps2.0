import { profile } from "../profiler"
import { Brain, getAllBrains } from "Brian";
import { getPosFromString, randomHex, equalXYR, toColumns } from "utils/utils";
import { NotifierPriority } from "./Notifier";
import { Pathing } from "../movement/Pathing";
import { SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER } from "constants";
import { Manager } from "managers/Manager";
import { log } from "console/log";
import { randomInt } from "utils/random";

export const DEFAULT_MAX_PATH_LENGTH = 800;
const DEFAULT_MAX_LINEAR_RANGE = 15;
const DIRECTIVE_PATH_TIMEOUT = 30000;
interface DirectiveCreationOptions {
    memory?: FlagMemory;
    name?: string;
    quiet?: boolean;
}

@profile
export abstract class Directive {
    static directiveName: string;
    static color: ColorConstant;
    static secondaryColor: ColorConstant;

    memory: FlagMemory;
    name: string;
    ref: string;
    waypoints: RoomPosition[];
    pos: RoomPosition;
    room: Room | undefined;
    brain: Brain;
    managers: { [manager: string]: Manager };
    constructor(flag: Flag, brainFilter?: (brain: Brain) => boolean) {
        this.memory = flag.memory;
        this.name = flag.name;
        this.ref = flag.ref;
        // Register creation tick
        if (!this.memory[MEM.TICK]) {
            this.memory[MEM.TICK] = Game.time;
        }

        // Relocate flag if needed; this must be called before the brain calculations
        if (this.memory.setPos) {
            const setPosition = derefRoomPosition(this.memory.setPos);
            if (!this.flag.pos.isEqualTo(setPosition)) {
                this.flag.setPosition(setPosition);
            } else {
                delete this.memory.setPos;
            }
            this.pos = setPosition;
            this.room = Game.rooms[setPosition.roomName];
        } else {
            this.pos = flag.pos;
            this.room = flag.room;
        }

        // Handle brain assigning
        const forceRecalc = !!this.memory.recalcBrainOnTick && Game.time >= this.memory.recalcBrainOnTick;
        const brain = this.getBrain(brainFilter, forceRecalc);

        // Delete the directive if the brain is dead
        if (!brain) {
            if (BigBrain.errors.length == 0) {
                log.alert(`Could not get brain for directive ${this.print}; removing flag!`);
                flag.remove();
            } else {
                log.alert(`Could not get brain for directive ${this.print}; ` +
                    `exceptions present this tick, so won't remove`);
            }
            return;
        }


        if (this.memory[MEM.EXPIRATION] && Game.time > this.memory[MEM.EXPIRATION]!) {
            flag.remove();
            return;
        }



        this.brain = brain;
        this.brain.flags = [...this.brain.flags, flag];
        this.managers = {};

        // Run creation actions if needed
        if (this.age == 0) {
            this.onCreation();
        }

        global[this.name] = this;
        BigBrain.CEO.registerDirective(this);
        BigBrain.directives[this.name] = this;
    }

    get print(): string {
        return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.name + ']</a>';
    }

    debug(...args: any[]) {
        if (this.memory.debug) {
            log.alert(this.print, args);
        }
    }

    get age(): number {
        return Game.time - this.memory[MEM.TICK]!;
    }

    private info(): string {
        let msg: string =
            `Info for ${this.print}: —————————————————————————————————————————————————————————————————————————`;
        const info1 = {
            'Type:': this.directiveName,
            'Name:': this.name,
            'Pos:': this.pos.print,
            'Brain:': this.brain.print,
        };
        msg += toColumns(info1).join('\n');
        msg += `Overlords: \n`;
        const tab = `  `;
        for (const name in this.managers) {
            msg += tab + `${name}:\n`;
            const olInfo: { [left: string]: string } = {};
            const manager = this.managers[name] as any;
            olInfo[tab + tab + 'Creep usage:'] = JSON.stringify(manager.creepUsageReport);
            olInfo[tab + tab + 'Bots:'] = _.mapValues(manager._bots,
                botOfRole => _.map(botOfRole, (bot: any) => bot.print));
            olInfo[tab + tab + 'CombatBots:'] = _.mapValues(manager._CombatBots,
                botOfRole => _.map(botOfRole, (bot: any) => bot.print));
            msg += toColumns(olInfo).join('\n');
        }
        msg += 'Memory:\n' + print(this.memory);
        return msg;
    }

    /**
 * Returns values for weighted and unweighted path length from Brain and recomputes if necessary.
 */
    get distanceFromBrain(): { unweighted: number, terrainWeighted: number } {
        if (!this.memory[MEM.DISTANCE] || Game.time >= this.memory[MEM.DISTANCE]![MEM.EXPIRATION]) {
            const ret = Pathing.findPath(this.brain.pos, this.pos, { maxOps: DIRECTIVE_PATH_TIMEOUT });
            const terrainCache: { [room: string]: RoomTerrain } = {};
            const terrainWeighted = _.sum(ret.path, pos => {
                let terrain: RoomTerrain;
                if (!terrainCache[pos.roomName]) {
                    terrainCache[pos.roomName] = Game.map.getRoomTerrain(pos.roomName);
                }
                terrain = terrainCache[pos.roomName];
                return terrain.get(pos.x, pos.y) == TERRAIN_MASK_SWAMP ? 5 : 1;
            });
            this.memory[MEM.DISTANCE] = {
                [MEM_DISTANCE.UNWEIGHTED]: ret.path.length,
                [MEM_DISTANCE.WEIGHTED]: terrainWeighted,
                [MEM.EXPIRATION]: Game.time + 10000 + randomInt(0, 100),
            };
            if (ret.incomplete) {
                this.memory[MEM.DISTANCE]!.incomplete = true;
            }
        }
        const memDistance = this.memory[MEM.DISTANCE]!;
        if (memDistance.incomplete) {
            log.warning(`${this.print}: distanceFromBrain() info incomplete!`);
        }
        return {
            unweighted: memDistance[MEM_DISTANCE.UNWEIGHTED],
            terrainWeighted: memDistance[MEM_DISTANCE.WEIGHTED],
        };
    }

	/**
	 * Gets an effective room position for a directive; allows you to reference this.pos in constructor super() without
	 * throwing an error
	 */
    static getPos(flag: Flag): RoomPosition {
        if (flag.memory && flag.memory.setPos) {
            const pos = derefRoomPosition(flag.memory.setPos);
            return pos;
        }
        return flag.pos;
    }

    get flag(): Flag {
        return Game.flags[this.name];
    }

    // This allows you to access static DirectiveClass.directiveName from an instance of DirectiveClass
    get directiveName(): string {
        return (<any>this.constructor).directiveName;
    }

    refresh(): void {
        const flag = this.flag;
        if (!flag) {
            log.warning(`Missing flag for directive ${this.print}! Removing directive.`);
            this.remove();
            return;
        }
        this.memory = flag.memory;
        this.pos = flag.pos;
        this.room = flag.room;
    }

    alert(message: string, priority = NotifierPriority.Normal): void {
        BigBrain.CEO.notifier.alert(message, this.pos.roomName, priority);
    }

    private handleRelocation(): boolean {
        if (this.memory.setPos) {
            const pos = derefRoomPosition(this.memory.setPos);
            if (!this.flag.pos.isEqualTo(pos)) {
                const result = this.flag.setPosition(pos);
                if (result == OK) {
                    log.debug(`Moving ${this.name} from ${this.flag.pos.print} to ${pos.print}.`);
                } else {
                    log.warning(`Could not set room position to ${JSON.stringify(this.memory.setPos)}!`);
                }
            } else {
                delete this.memory.setPos;
            }
            this.pos = pos;
            this.room = Game.rooms[pos.roomName];
            return true;
        }
        return false;
    }

    /**
         * Computes the parent brain for the directive to be handled by
         */
    private getBrain(brainFilter?: (brain: Brain) => boolean, forceRecalc = false): Brain | undefined {
        // If something is written to flag.brain, use that as the brain
        if (this.memory[MEM.BRAIN] && !forceRecalc) {
            return BigBrain.brains[this.memory[MEM.BRAIN]!];
        } else {

            // If flag contains a brain name as a substring, assign to that brain, regardless of RCL
            const brainNames = _.keys(BigBrain.brains);
            for (const name of brainNames) {
                if (this.name.includes(name)) {
                    if (this.name.split(name)[1] != '') continue; // in case of other substring, e.g. E11S12 and E11S1
                    this.memory[MEM.BRAIN] = name;
                    return BigBrain.brains[name];
                }
            }

            // If flag is in a room belonging to a brain and the brain has sufficient RCL, assign to there
            const brain = BigBrain.brains[BigBrain.brainsMaps[this.pos.roomName]] as Brain | undefined;
            if (brain) {
                if (!brainFilter || brainFilter(brain)) {
                    this.memory[MEM.BRAIN] = brain.name;
                    return brain;
                }
            }

            // Otherwise assign to closest brain
            const maxPathLength = this.memory.maxPathLength || DEFAULT_MAX_PATH_LENGTH;
            const maxLinearRange = this.memory.maxLinearRange || DEFAULT_MAX_LINEAR_RANGE;
            this.debug(`Recalculating brain association for ${this.name} in ${this.pos.roomName}`);

            let nearestBrain: Brain | undefined;
            let minDistance = Infinity;
            for (const brain of getAllBrains()) {
                if (Game.map.getRoomLinearDistance(this.pos.roomName, brain.name) > maxLinearRange
                    && !this.memory.allowPortals) {
                    continue;
                }
                if (!brainFilter || brainFilter(brain)) {
                    const ret = Pathing.findPath((brain.spawner || brain).pos, this.pos,
                        { maxOps: DIRECTIVE_PATH_TIMEOUT });
                    // TODO handle directives that can't find a path at great range
                    if (!ret.incomplete) {
                        if (ret.path.length < maxPathLength && ret.path.length < minDistance) {
                            nearestBrain = brain;
                            minDistance = ret.path.length;
                        }
                        if (ret.portalUsed && ret.portalUsed.expiration) {
                            this.memory.recalcBrainOnTick = ret.portalUsed.expiration + 1;
                        }
                        this.debug(`Path length to ${brain.room.print}: ${ret.path.length}`);
                    } else {
                        this.debug(`Incomplete path from ${brain.room.print}`);
                    }
                }
            }

            if (nearestBrain) {
                log.info(`Brain ${nearestBrain.room.print} assigned to ${this.name}.`);
                this.memory[MEM.BRAIN] = nearestBrain.room.name;
                return nearestBrain;
            } else {
                log.error(`Could not find brain match for ${this.name} in ${this.pos.roomName}! ` +
                    `Try setting memory.maxPathLength and memory.maxLinearRange.`);
            }
        }
        return undefined;
    }

    private findNearestBrain(brainFilter?: (brain: Brain) => boolean, verbose: boolean = false): Brain | undefined {
        const maxPathLength = this.memory.maxPathLength || DEFAULT_MAX_PATH_LENGTH;
        const maxLinearRange = this.memory.maxLinearRange || DEFAULT_MAX_LINEAR_RANGE;
        if (verbose) console.log(`Recalculating brain associated for ${this.name} in ${this.pos.roomName}`);
        let nearestBrain: Brain | undefined = undefined;
        const BrainRooms = Object.keys(Game.rooms).reduce((acc, roomName) => {
            if (Game.rooms[roomName].my) {
                return [...acc, Game.rooms[roomName]]
            }
            return acc;
        }, [] as Room[])
        Object.values(BigBrain.brains).forEach((brain: Brain) => {
            if (Game.map.getRoomLinearDistance(this.pos.roomName, brain.name) > maxLinearRange) {
                return;
            }
        });

        if (nearestBrain) {
            return nearestBrain;
        }
        return;
    }

    remove(force = false): number | undefined {
        if (!this.memory.persistent || force) {
            delete BigBrain.directives[this.name];
            BigBrain.CEO.removeDirective(this);
            if (this.brain) {
                _.remove(this.brain.flags, flag => flag.name == this.name);
            }
            if (this.flag) {
                return this.flag.remove();
            }
        }
        return;
    }

    setColor(color: ColorConstant, secondaryColor?: ColorConstant): number {
        if (secondaryColor) {
            return this.flag.setColor(color, secondaryColor);
        }
        return this.flag.setColor(color);
    }

    setPosition(pos: RoomPosition): number {
        return this.flag.setPosition(pos);
    }

    static create(pos: RoomPosition, opts: DirectiveCreationOptions = {}): number | string {
        let flagName = opts.name || undefined;
        if (!flagName) {
            flagName = `${this.directiveName}:${randomHex(6)}`;
            if (Game.flags[flagName]) {
                return ERR_NAME_EXISTS;
            }
        }
        const r = pos.createFlag(flagName, this.color, this.secondaryColor) as string | number;
        if (r == flagName && opts.memory) {
            Memory.flags[flagName] = opts.memory;
        }
        return r;
    }

	/**
	 * Returns whether a directive of this type is present either at this position or within the room of this name
	 */
	static isPresent(posOrRoomName: string | RoomPosition): boolean {
		if (PHASE != 'run' && PHASE != 'init') {
			log.error(`Directive.isPresent() will only give correct results in init() and run() phases!`);
			return true; // usually we want to do something if directive isn't present; so this minimizes bad results
		}
		if (typeof posOrRoomName === 'string') {
			const roomName = posOrRoomName as string;
			const directivesInRoom = BigBrain.CEO.getDirectivesInRoom(roomName) as Directive[];
			return _.filter(directivesInRoom, directive => this.filter(directive.flag)).length > 0;
		} else {
			const pos = posOrRoomName as RoomPosition;
			const directivesInRoom = BigBrain.CEO.getDirectivesInRoom(pos.roomName) as Directive[];
			return _.filter(directivesInRoom,
							directive => this.filter(directive.flag) && equalXYR(pos, directive.pos)).length > 0;
		}
	}

/**
	 * Create a directive if one of the same type is not already present (in room | at position).
	 * Calling this method on positions in invisible rooms can be expensive and should be used sparingly.
	 */
	static createIfNotPresent(pos: RoomPosition, scope: 'room' | 'pos',
							  opts: DirectiveCreationOptions = {}): number | string | undefined {
		if (PHASE != 'run') {
			log.error(`Directive.createIfNotPresent() can only be called during the run phase!`);
			return;
		}
		// Do nothing if flag is already here
		if (scope == 'pos') {
			if (this.isPresent(pos)) return;
		} else {
			if (this.isPresent(pos.roomName)) return;
		}

		const room = Game.rooms[pos.roomName] as Room | undefined;
		if (!room) {
			if (!opts.memory) {
				opts.memory = {};
			}
			opts.memory.setPos = pos;
		}
		switch (scope) {
			case 'room':
				if (room) {
					return this.create(pos, opts);
				} else {
					log.info(`Creating directive at ${pos.print}... ` +
							 `No visibility in room; directive will be relocated on next tick.`);
					let createAtPos: RoomPosition;
					if (opts.memory && opts.memory[MEM.BRAIN]) {
						createAtPos = Pathing.findPathablePosition(opts.memory[MEM.BRAIN]!);
					} else {
						createAtPos = Pathing.findPathablePosition(_.first(getAllBrains()).room.name);
					}
					return this.create(createAtPos, opts);
				}
			case 'pos':
				if (room) {
					return this.create(pos, opts);
				} else {
					log.info(`Creating directive at ${pos.print}... ` +
							 `No visibility in room; directive will be relocated on next tick.`);
					let createAtPos: RoomPosition;
					if (opts.memory && opts.memory[MEM.BRAIN]) {
						createAtPos = Pathing.findPathablePosition(opts.memory[MEM.BRAIN]!);
					} else {
						createAtPos = Pathing.findPathablePosition(_.first(getAllBrains()).room.name);
					}
					return this.create(createAtPos, opts);
				}
		}
	}

    /* Filter for _.filter() that checks if a flag is of the matching type */
    static filter(flag: Flag): boolean {
        return flag.color == this.color && flag.secondaryColor == this.secondaryColor;
    }

    /* Map a list of flags to directives, accepting a filter */
    static find(flags: Flag[]): Directive[] {
        flags = _.filter(flags, flag => this.filter(flag));
        return _.compact(_.map(flags, flag => BigBrain.directives[flag.name]));
    }

    	/**
	 * Map a list of flags to directive using the filter of the subclassed directive
	 */
	static findInRoom(roomName: string): Directive[] {
		const directivesInRoom = BigBrain.CEO.getDirectivesInRoom(roomName) as Directive[];
		return _.filter(directivesInRoom, directive => this.filter(directive.flag));
	}

	/**
	 * Map a list of flags to directive using the filter of the subclassed directive
	 */
	static findInBrain(brain: Brain): Directive[] {
		const directivesInBrain = BigBrain.CEO.getDirectivesForBrain(brain) as Directive[];
		return _.filter(directivesInBrain, directive => this.filter(directive.flag));
	}

    /**
     * Actions that are performed only once on the tick of the directive creation
     */
    onCreation(): void {

    }

    abstract HigherManager(): void;
    abstract init(): void;
    abstract run(): void;
}
