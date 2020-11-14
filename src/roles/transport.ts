import { profile } from '../profiler/Profiler';

@profile
export class Transport {
    static run(creep:Creep){
        if(creep.store.energy === 0){
            const drops = creep.room.find(FIND_DROPPED_RESOURCES);
            const first = _.head(drops);
            if (creep.pickup(first) === ERR_NOT_IN_RANGE){
                creep.moveTo(first);
            }
        } else {
            if(creep.room.storage && creep.transfer(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.storage);
            } else {
                const fillable = creep.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === 'spawn' || s.structureType === 'extension' && !s.isFull})
                if(creep.transfer(fillable[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(fillable[0]);
                }
            }
        }
    }
}
