import { profile } from "profiler";
import { onPublicServer } from "utils/utils";
import { Notifier } from "directives/Notifier";
import { Directive } from "directives/directive";
import { Mem } from "memory/memory";
import { Brain } from "Brian";

interface CEOMemory {
    suspendUntil: { [managerRef: string]: number };
}

const defaultCEOMemory: CEOMemory = {
    suspendUntil: {},
}

@profile
export class CEO implements ICEO {
    private memory: CEOMemory;
    private managers: any[];
    private managersByBrain: { [brainName: string]: any[]}
    private sorted: boolean;
    notifier: any;
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
                return acc;
            }
            return [...acc, dir];
        }, [] as Directive[])
    }
    registerManager(manager: any) {
        throw new Error("Method not implemented.");
    }
    getManagersForBase(base: any): any[] {
        throw new Error("Method not implemented.");
    }
    isManagerSuspended(manager: any): boolean {
        throw new Error("Method not implemented.");
    }
    suspendManagerFor(manager: any): void {
        throw new Error("Method not implemented.");
    }
    suspendManagerUntil(manager: any): void {
        throw new Error("Method not implemented.");
    }
    init(): void {
        this.directives.forEach(directive => directive.init());
    }
    run(): void {
        this.directives.forEach(directive => directive.run());
    }
    getCreepReport(brain: any): string[][] {
        throw new Error("Method not implemented.");
    }

}
