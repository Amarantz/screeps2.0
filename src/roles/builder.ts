import { profile } from '../profiler/Profiler'

@profile
export class Builder {
    static run(creep:Creep, constructionSites: ConstructionSite[]){
        if(creep.store.energy === 0){
            const drops = creep.room.find(FIND_DROPPED_RESOURCES);
            const first = _.head(drops);
            if (creep.pickup(first) === ERR_NOT_IN_RANGE){
                creep.moveTo(first);
            }
        } else {
            if(constructionSites && creep.build(constructionSites[0]) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSites[0]);
            }
        }
    }
}
