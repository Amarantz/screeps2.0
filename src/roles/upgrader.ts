import { profile } from '../profiler/Profiler'

@profile
export class Upgrader {
    static run(creep:Creep){
        if (creep.store.energy === 0) {
            if (creep.room.storage && creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE){
                creep.moveTo(creep.room.storage);
            } else {
                const drops = creep.room.find(FIND_DROPPED_RESOURCES);
                const first = _.head(drops);
                if (creep.pickup(first) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(first);
                }
            }
        } else {
            if(creep.room.controller && creep.room.controller.my && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller);
            }
        }
    }
}
