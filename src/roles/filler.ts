import { profile } from '../profiler/Profiler';

@profile
export class Filler {
    static run(creep:Creep){
        if(creep.store.energy === 0){
            if(creep.room.storage && creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE){
                creep.moveTo(creep.room.storage);
            }
        } else {
            const fillable = creep.room.find(FIND_MY_STRUCTURES, { filter: (s) => (s.structureType === 'spawn' || s.structureType === 'extension') && !s.isFull})
            if(creep.transfer(fillable[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(fillable[0]);
            }
            if(fillable.length === 0) {
                const towers = creep.room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType === 'tower'})
                if(creep.transfer(towers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(towers[0]);
                }
            }
        }
    }
}
