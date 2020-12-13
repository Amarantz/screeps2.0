import { profile } from "../profiler";
import { Brain } from "Brian";
import { Manager } from "managers/Manager";
import { log } from "console/log";

@profile
export abstract class Component {
    room: Room;
    brain: Brain;
    pos: RoomPosition;
    ref: string;
    memory: any;
    manager: Manager | undefined;
    constructor(brain: Brain, initiationObject: RoomObject, name: string) {
        this.brain = brain;
        this.room = initiationObject.room!;
        this.pos = initiationObject.pos;
        this.ref = `${name}@${this.brain.name}`;
        this.brain.components.push(this);
    }
    get print(): string {
        return `<a href="#!/room/${Game.shard.name}/${this.pos.roomName}">[${this.ref}]</a>`
    }

    protected debug(...args: any[]) {
        if (this.memory.debug) {
            log.alert(this.print, args);
        }
    }
    abstract refresh(): void;
    abstract init(): void;
    abstract higherManagers(): void;
    abstract run(): void;
}
