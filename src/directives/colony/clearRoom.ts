import { profile } from "profiler";
import { Directive } from "directives/directive";
import { Cartographer, ROOMTYPE_CONTROLLER } from "utils/Cartographer";
import { printRoomName } from "utils/utils";
import { log } from 'console/log';
import { ClaimerManager } from "managers/colonization/claimer";
import { Pathing } from "movement/Pathing";
import SETTINGS from 'settings';
import { DirectiveDismantle } from "directives/targeting/dismantle";
import { Bot } from "bot/Bot";

interface DirectiveClearRoomMemory extends FlagMemory {
    preexistingFlags: string[];
    completedTime?: number;
}

@profile
export class DirectiveClearRoom extends Directive {
    static directiveName = 'clearRoom';
    static color = COLOR_PURPLE;
    static secondaryColor = COLOR_ORANGE;

    memory: DirectiveClearRoomMemory;
    managers: {
        claim: ClaimerManager,
    };

    constructor(flag: Flag) {
        super(flag, brain => brain.level >= 3);
        if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
            log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; removing directive!`);
            this.remove();
        }
        if (Memory.settings.resourceCollectionMode && Memory.settings.resourceCollectionMode >= 1) {
            this.memory.keepStorageStructures = true;
        }
        this.memory.preexistingFlags = _.filter(Game.flags, testingFlag => testingFlag.pos.roomName == flag.pos.roomName && testingFlag.name != flag.name)
            .map(testingFlag => testingFlag.name);
        log.debug(`Existing flags in clear room are ${JSON.stringify(this.memory.preexistingFlags)}`);
    }
    HigherManager(): void {
        this.managers.claim = new ClaimerManager(this);
    }
    init(): void {
        this.alert(`Clearing out room`);
    }

    private RemoveAllStructures() {
        const keepStorageStructures = this.memory.keepStorageStructures || true;
        const keepRoads = this.memory.keepRoads || true;
        const keepContainers = this.memory.keepContainers || true;

        if (this.room) {
            const allStructures = this.room.find(FIND_STRUCTURES);
            let i = 0;
            for (const s of allStructures) {
                if (s.structureType === STRUCTURE_CONTROLLER) {
                    continue;
                }
                if (keepStorageStructures
                    && (s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TERMINAL)
                    && !(s as StructureStorage | StructureTerminal).isEmpty) {
                    return;
                }
                if (keepRoads && s.structureType == STRUCTURE_ROAD) {
					continue;
				}
				if (keepContainers && s.structureType == STRUCTURE_CONTAINER) {
					continue;
				}
				const result = s.destroy();
				if (result == OK) {
					i++;
				}
            }
            log.alert(`Destoryed ${i} strucutres in ${this.room.print}`);
            this.memory.completedTime = Game.time;
            return true;
        } else {
            return false;
        }
    }

    private findStructureBlockingController(poineer: Bot): Structure | undefined {
        const blockingPos = Pathing.findBlockingPos(poineer.pos, poineer.room.controller!.pos, _.filter(poineer.room.structures, s => !s.isWalkable));
        if(blockingPos) {
            const structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
            if(structure) {
                return structure;
            } else {
                log.error(`${this.print}: no structure at blocking pos ${blockingPos.print}! (Why?)`)
            }
        }
        return;
    }

    private cleanupFlags() {
        if(!this.room) {
            return false;
        }
        for (const flag of this.room.flags) {
            if(!_.contains(this.memory.preexistingFlags, flag.name) && flag.name != this.flag.name) {
                flag.remove();
                return;
            }
        }
        return;
    }
    run(): void {
        if(this.room && this.room.my) {
            const done = this.RemoveAllStructures();
            if(done) {
                const r = this.room.controller!.unclaim();
                this.cleanupFlags();
                log.notify(`Removing clearRoomDirective in ${this.pos.roomName}: operation complete.`);
                if(r == OK) {
                    this.remove();
                    BigBrain.shouldBuild = true;
                }
            }
        } else if (this.room && this.room.creeps.length > 1) {
            const currentlyDismantingLocations = DirectiveDismantle.find(this.room.flags);
            if(currentlyDismantingLocations.length == 0) {
                const pathablePos = this.room.creeps[0]?.pos || Pathing.findPathablePosition(this.room.name);
                const blockingLocations = Pathing.findBlockingPos(pathablePos, this.room.controller!.pos, _.filter(this.room.structures, s => !s.isWalkable));
                if(blockingLocations && !Directive.isPresent(blockingLocations)) {
                    log.notify(`Adding dismantle directive for ${this.pos.roomName} to reach controller.`);
                    DirectiveDismantle.create(blockingLocations);
                }
            }
        }
        		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != SETTINGS.MY_USERNAME) {
			log.notify(`Removing clearRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
    }


}
