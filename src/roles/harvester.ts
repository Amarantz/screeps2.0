import { profile } from '../profiler/Profiler';

@profile
export class Harvester {
    static run(creep: Creep){
        if(!creep.memory.sourceId) {
            creep.memory.sourceId = creep.room.sources[0].id;
        }
        if(creep.memory.sourceId && creep.harvest(Game.getObjectById(creep.memory.sourceId) as Source) == ERR_NOT_IN_RANGE) {
            creep.moveTo(Game.getObjectById(creep.memory.sourceId) as Source);
        }
    }
}
