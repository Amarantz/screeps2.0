import { profile } from "profiler";
import { Directive } from "directives/directive";
import { AttackStructurePriorities } from "priorities/priorities_structures";

@profile
export class DirectiveDismantle extends Directive {
    static directiveName = 'dismantle';
    static color = COLOR_GREY;
    static secondaryColor = COLOR_GREY;

    constructor(flag: Flag) {
        super(flag);
    }

    HigherManager() {

    }

    getTarget(): Structure | undefined {
        if(!this.pos.isVisible){
            return;
        }
        const targetedStructures = this.pos.lookFor(LOOK_STRUCTURES) as Structure[];
        for(const s of targetedStructures){
            if(AttackStructurePriorities.includes(s.structureType as BuildableStructureConstant)){
                return s;
            }
        }
        return;
    }

    init(): void {
        const target = this.getTarget();
        if(target && !this.brain.managers.work.dismantleStructures.includes(target)){
            this.brain.managers.work.dismantleStructures.push(target)
        }
    }

    run(): void {
        if(this.pos.isVisible && !this.getTarget()) {
            this.remove();
        }
    }
}
