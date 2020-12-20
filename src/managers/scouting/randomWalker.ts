import { Manager } from "managers/Manager";
import { profile } from 'profiler'
import { Brain } from "Brian";
import { ManagerPriority } from "priorities/priorities_managers";
import { Roles, Setups } from "creepSetup/setup";
import { Bot } from "bot/Bot";
import { Tasks } from "tasks/Tasks";

const DEFAULT_NUM_SCOUTS = 3;

@profile
export class RandomWalkerScoutManager extends Manager {
    scouts: Bot[];

    constructor(brain: Brain, priority = ManagerPriority.scouting.randomWalker) {
        super(brain, 'scout', priority);
        this.scouts = this.bots(Roles.scout, { notifyWhenAttacked: false });
    }

    init(): void {
        this.wishlist(DEFAULT_NUM_SCOUTS, Setups.scout);
    }

    private handleScouts(scout: Bot) {
        const industructibleWalls = _.filter(scout.room.walls, wall => wall.hits == undefined);
        if(industructibleWalls.length > 0) {
            scout.task = Tasks.goToRoom(this.brain.room.name);
        } else {
            const neighboringRooms = _.values(Game.map.describeExits(scout.pos.roomName)) as string[];
            const roomName = _.sample(neighboringRooms);
            if (['normal', 'respawn', 'novice'].includes(Game.map.getRoomStatus(roomName).status)){
                scout.task = Tasks.goToRoom(roomName);
            }
        }
    }

    run(): void {
        this.autoRun(this.scouts, scout => this.handleScouts(scout));
    }
}
