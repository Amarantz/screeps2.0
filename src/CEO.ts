import { profile } from "profiler";
import { onPublicServer } from "utils/utils";
import { Notifier } from "directives/Notifier";
import { Directive } from "directives/directive";
import { Mem } from "memory/memory";
import { Brain } from "Brian";
import { Manager } from "managers/Manager";
import { USE_TRY_CATCH } from "settings";

interface CEOMemory {
    suspendUntil: { [managerRef: string]: number };
}

const defaultCEOMemory: CEOMemory = {
    suspendUntil: {},
}

@profile
export class CEO implements ICEO {
    private memory: CEOMemory;
    private managers: Manager[];
    private managersByBrain: { [brainName: string]: Manager[]}
    private sorted: boolean;
    notifier: Notifier;
    static settings = {
        outpostCheckFrequency: onPublicServer() ? 250 : 100,
    }
    private directives: Directive[];

    constructor() {
        this.memory = Mem.wrap(Memory, 'CEO', defaultCEOMemory);
        this.directives = [];
        this.managers = [];
        this.managersByBrain = {};
        this.sorted = false;
        this.notifier = new Notifier();
    }

    private get brains(): Brain[] {
        return _.values(BigBrain.brains);
    }

    refresh() {
        this.memory = Mem.wrap(Memory, 'CEO', defaultCEOMemory);
        this.notifier.clear();
    }

    registerDirective(directive: Directive): void {
        console.log(JSON.stringify(directive));
        this.directives = [...this.directives, directive];
    }

    removeDirective(directive: Directive): void {
        this.directives = this.directives.reduce((acc, dir) => {
            if(dir.name === directive.name) {
                for(const name in directive.manager) {
                    this.removeManager(directive.manager[name]);
                }
                return acc;
            }
            return [...acc, dir];
        }, [] as Directive[])
    }

    private removeManager(manager: Manager): void {
        _.remove(this.managers, m => m.ref == manager.ref);
        if(this.managersByBrain[manager.brain.name]){
            _.remove(this.managersByBrain[manager.brain.name], m => m.ref == manager.ref)
        }
    }

    registerManager(manager: Manager): void {
        this.managers = [...this.managers, manager]
        if(!this.managersByBrain[manager.brain.name]) {
            this.managersByBrain[manager.brain.name] = [];
        }
        this.managersByBrain[manager.brain.name].push(manager);
    }

    getManagersForBrain(brain: Brain): Manager[] {
        return this.managersByBrain[brain.name];
    }

    isManagerSuspended(manager: Manager): boolean {
        if (this.memory.suspendUntil[manager.ref]) {
            if(Game.time < this.memory.suspendUntil[manager.ref]){
                return true;
            } else {
                delete this.memory.suspendUntil[manager.ref];
                return false;
            }
        }
        return false;
    }

    suspendManagerFor(manager: Manager, ticks: number): void {
        this.memory.suspendUntil[manager.ref] = Game.time + ticks;
    }
    suspendManagerUntil(manager: Manager, untilTick: number): void {
        this.memory.suspendUntil[manager.ref] = untilTick;
    }
    init(): void {
        this.directives.forEach(directive => directive.init());
        if(!this.sorted){
            this.managers.sort((a, b) => a.priority - b.priority);
            for(const name in this.managersByBrain) {
                this.managersByBrain[name].sort((a,b) => a.priority - b.priority);
            }
            this.sorted = true;
        }

        for(const manager of this.managers) {
            if(!this.isManagerSuspended(manager)) {
                manager.preInit();
                this.try(() => manager.init());
            }
        }
    }
    run(): void {
        this.directives.forEach(directive => directive.run());
        this.managers.forEach(manager => {
            !this.isManagerSuspended(manager) && this.try(() => manager.run());
        })
    }
    getCreepReport(brain: any): string[][] {
        throw new Error("Method not implemented.");
    }

    private try(callback: () => any, identifier?: string): void {
        if(USE_TRY_CATCH) {
            try {
                callback();
            } catch (e) {
                if(identifier) {
                    e.name = `Caught unhandled exception at ${'' + callback} (identifer: ${identifier}): \n ${e.name} \n ${e.stack}`;
                } else {
                    e.name = `Caught unhandled exception at ${'' + callback}: \n ${e.name} \n ${e.stack}`;
                }
                BigBrain.errors.push(e);
            }
        } else {
            callback();
        }
    }

}
