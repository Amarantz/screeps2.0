import { profile } from "../profiler"
import { Brain } from "Brian";
import { getPosFromString, randomHex, equalXYR } from "utils/utils";
import { NotifierPriority } from "./Notifier";
import { Pathing } from "../movement/Pathing";
import { SSL_OP_MICROSOFT_BIG_SSLV3_BUFFER } from "constants";

const DEFAULT_MAX_PATH_LENGTH = 600;
const DEFAULT_MAX_LINEAR_RANGE = 10;

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
    manager: {};
    constructor(flag: Flag, brainFilter?: (brain: Brain) => boolean) {
        this.memory = flag.memory || {} as FlagMemory;
        if (this.memory.suspendUntil) {
            if (Game.time < this.memory.suspendUntil) {
                RESOURCE_TRANSISTOR;
            } else {
                delete this.memory.suspendUntil;
            }
        }
        this.name = flag.name;
        this.ref = flag.ref;
        if (!this.memory[_MEM.TICK]) {
            this.memory[_MEM.TICK] = Game.time;
        }
        if (this.memory.waypoints) {
            this.waypoints = _.map(this.memory.waypoints, posName => getPosFromString(posName)!);
        }

        //Relocate flag if needed:
        const needsRelocating = this.handleRelocation();
        if (!needsRelocating) {
            this.pos = flag.pos;
            this.room = flag.room;
        }

        const brain = this.getBrain(brainFilter);
        if (!brain) {
            if (BigBrain.errors.length == 0) {
                flag.remove();
            }
            return;
        }


        if (this.memory[_MEM.EXPIRATION] && Game.time > this.memory[_MEM.EXPIRATION]!) {
            flag.remove();
            return;
        }

        this.brain = brain;
        this.brain.flags = [...this.brain.flags, flag];
        this.manager = {};
        global[this.name] = this;
        BigBrain.CEO.registerDirective(this);
        BigBrain.directives[this.name] = this;
    }

    static getPos(flag: Flag): RoomPosition {
        if (flag.memory && flag.memory.setPosition) {
            const pos = derefRoomPosition(flag.memory.setPosition);
            return pos;
        }
        return flag.pos;
    }

    get flag(): Flag {
        return Game.flags[this.name];
    }

    refresh(): void {
        const flag = this.flag;
        if (!flag) {
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
        if (this.memory.setPosition) {
            const pos = derefRoomPosition(this.memory.setPosition);
            if (!this.flag.pos.isEqualTo(pos)) {
                const result = this.flag.setPosition(pos);
                if (result == OK) {

                }
            } else {
                delete this.flag.memory.setPosition;
                this.pos = pos;
                this.room = Game.rooms[this.pos.roomName];
                return true;
            }
        }
        return false;
    }

    private getBrain(brainFilter?: (brain: Brain) => boolean, verbose = false): Brain | undefined {
        if(this.memory[_MEM.BRAIN]) {
            return this.memory[_MEM.BRAIN] && BigBrain.brains[this.memory[_MEM.BRAIN]!];
        } else {
            const brainNames = _.keys(BigBrain.brains);
            brainNames.forEach(name => {
                if(this.name.includes(name)){
                    if(this.name.split(name)[1] != '') return;
                    this.memory[_MEM.BRAIN] = name;
                    return BigBrain.brains[name];
                }
            });

            const brain = BigBrain.brains[BigBrain.brainsMaps[this.pos.roomName]] as Brain | undefined;
            if(brain) {
                if(!brainFilter || brainFilter(brain)) {
                    this.memory[_MEM.BRAIN] = brain.name;
                    return brain;
                }
            }

            const nearestBrain = this.findNearestBrain(brainFilter, verbose);
            if(nearestBrain) {
                console.log(`Brain ${nearestBrain.room.print} assigned to ${this.name}.`)
                this.memory[_MEM.BRAIN] = nearestBrain.room.name;
            } else {
                console.log(`Could not find colony match for ${this.name} in ${this.pos.roomName}!`)
            }
        }
        return;
    }

    private findNearestBrain(brainFilter?: (brain: Brain) => boolean, verbose:boolean = false): Brain | undefined {
        const maxPathLength = this.memory.maxPathLength || DEFAULT_MAX_PATH_LENGTH;
        const maxLinearRange = this.memory.maxLinearRange || DEFAULT_MAX_LINEAR_RANGE;
        if (verbose) console.log(`Recalculating brain associated for ${this.name} in ${this.pos.roomName}`);
        let nearestBrain: Brain | undefined = undefined;
        const BrainRooms = Object.keys(Game.rooms).reduce((acc, roomName) => {
            if(Game.rooms[roomName].my){
                return [...acc, Game.rooms[roomName]]
            }
            return acc;
        }, [] as Room[])
        Object.values(BigBrain.brains).forEach((brain: Brain) => {
            if(Game.map.getRoomLinearDistance(this.pos.roomName, brain.name) > maxLinearRange) {
                return;
            }
        });

        if(nearestBrain){
            return nearestBrain;
        }
        return;
    }

    remove(force = false): number | undefined {
        if(!this.memory.persistent || force) {
            delete BigBrain.directives[this.name];
            BigBrain.CEO.removeDirective(this);
            if (this.brain) {
                _.remove(this.brain.flags, flag => flag.name == this.name);
            }
            if(this.flag){
                return this.flag.remove();
            }
        }
        return;
    }

    setColor(color: ColorConstant, secondaryColor?: ColorConstant): number {
        if(secondaryColor){
            return this.flag.setColor(color, secondaryColor);
        }
        return this.flag.setColor(color);
    }

    setPosition(pos: RoomPosition): number {
        return this.flag.setPosition(pos);
    }

    static create(pos: RoomPosition, opts: DirectiveCreationOptions = {}): number | string {
        let flagName = opts.name || undefined;
        if(!flagName) {
            flagName = `${this.directiveName}:${randomHex(6)}`;
            if(Game.flags[flagName]){
                return ERR_NAME_EXISTS;
            }
        }
        const r = pos.createFlag(flagName, this.color, this.secondaryColor) as string | number;
        if(r == flagName && opts.memory){
            Memory.flags[flagName] = opts.memory;
        }
        return r;
    }

    static isPresent(pos: RoomPosition, scope: 'room' | 'pos'): boolean {
        const room = Game.rooms[pos.roomName] as Room | undefined;
        if(scope === 'room') {
            if(room) {
                return _.filter(room.flags, flag => this.filter(flag) && !(flag.memory.setPosition && flag.memory.setPosition.roomName != pos.roomName)).length > 0;
            } else {
                const flagsInRoom = _.filter(Game.flags, flag => {
                    if(flag.memory.setPosition) return flag.memory.setPosition.roomName == pos.roomName;
                    return flag.pos.roomName == pos.roomName;
                })
                return _.filter(flagsInRoom, flag => this.filter(flag)).length > 0;
            }
        }
        if(scope === 'pos'){
            if (room) {
                return _.filter(pos.lookFor(LOOK_FLAGS),
                                flag => this.filter(flag) &&
                                        !(flag.memory.setPosition
                                        && !equalXYR(pos, flag.memory.setPosition))).length > 0;
            } else {
                const flagsAtPos = _.filter(Game.flags, function(flag) {
                    if (flag.memory.setPosition) { // does it need to be relocated?
                        return equalXYR(flag.memory.setPosition, pos);
                    } else { // properly located
                        return equalXYR(flag.pos, pos);
                    }
                });
                return _.filter(flagsAtPos, flag => this.filter(flag)).length > 0;
            }
        }
        return false;
    }

    static createIfNotPresent(pos: RoomPosition, scope: 'room' | 'pos', opts: DirectiveCreationOptions = {}): number | string | undefined {
        if(this.isPresent(pos, scope)){
            return;
        }

        const room = Game.rooms[pos.roomName];
        if(!room){
            if(!opts.memory){
                opts.memory = {};
            }
            opts.memory.setPosition = pos;
        }
        if(room){
            return this.create(pos, opts);
        }
        if(scope === 'room'){
            let createAtPos: RoomPosition;
            if(opts.memory && opts.memory[_MEM.BRAIN]) {
                createAtPos = Pathing.findPathablePosition(opts.memory[_MEM.BRAIN]!);
            } else {
                createAtPos = Pathing.findPathablePosition(_.first(Object.values(BigBrain)).room.name);
            }
            return this.create(createAtPos, opts)
        }

        if(scope === 'pos'){
            let createAtPos: RoomPosition;
            if(opts.memory && opts.memory[_MEM.BRAIN]) {
                createAtPos = Pathing.findPathablePosition(opts.memory[_MEM.BRAIN]!);
            } else {
                createAtPos = Pathing.findPathablePosition(_.first(Object.values(BigBrain)).room.name);
            }
            return this.create(createAtPos, opts)
        }
        return;
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

    abstract HigherManager(): void;
    abstract init(): void;
    abstract run(): void;
}
