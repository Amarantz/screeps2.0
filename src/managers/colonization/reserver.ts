import { profile } from "profiler";
import { DirectiveOutpost } from "../../directives/colony/outpost";
import { ManagerPriority } from "priorities/priorities_managers";
import { Manager } from "managers/Manager";
import { Roles, Setups } from "creepSetup/setup";
import { Bot } from "bot/Bot";
import settings, { PROFILER_COLONY_LIMIT } from "settings";
import { RoomIntel } from "intel/RoomIntel";
import { Tasks } from "tasks/Tasks";

@profile
export class ReserveringManager extends Manager {
    reservers: Bot[];
    reserveBuffer: number;
    constructor(directive: DirectiveOutpost, priority = ManagerPriority.remoteRoom.reserve) {
        super(directive, 'reserve', priority);
        this.priority += this.outpostIndex * ManagerPriority.remoteRoom.roomIncrement;
        this.reserveBuffer = 2000;
        this.reservers = this.bots(Roles.reserver);
    }

    init(): void {
        let amount: number = 0;
        if (this.room) {
            if (this.room.controller!.needsReserving(this.reserveBuffer)) {
                amount = 1
            } else if (this.room.controller!.reservation && this.room.controller!.reservedByMe) {
                amount = Math.min(this.room.controller!.pos.availableNeighbors(true).length, 2);
            }
        } else if (RoomIntel.roomReservedBy(this.pos.roomName) == settings.MY_USERNAME && RoomIntel.roomReservationRemaining(this.pos.roomName) < 1000) {
            amount = 1
        }
        this.wishlist(amount, Setups.reserver)
    }

    private handleReservers(reserver: Bot) {
        if(reserver.avoidDanger()) return;
        if(reserver.room == this.room && !reserver.pos.isEdge){
            if(!this.room.controller!.signedByMe){
                if(!this.room.my && this.room.controller!.signedByScreeps){
                    reserver.task = Tasks.reserve(this.room.controller!);
                } else {
                    reserver.task = Tasks.signController(this.room.controller!);
                }
            } else {
                reserver.task = Tasks.reserve(this.room.controller!);
            }
        } else {
            reserver.goTo(this.pos);
        }
    }

    run() {
        this.autoRun(this.reservers, reserver => this.handleReservers(reserver));
    }
}
