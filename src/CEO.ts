import { profile } from "profiler";
import { onPublicServer } from "utils/utils";
import { Notifier } from "directives/Notifier";
import { Directive } from "directives/directive";
import { Mem } from "memory/memory";
import { Brain } from "Brian";
import { Manager } from "managers/Manager";
import { USE_TRY_CATCH } from "settings";

interface CEOMemory {
    // suspendUntil: { [managerRef: string]: number };
}

const getDefaultCEOMemory = (): CEOMemory => ({});

@profile
export class CEO implements ICeo {
    private memory: CEOMemory;
    private managers: Manager[];
    private managersByBrain: { [brainName: string]: Manager[]}
    notifier: Notifier;
    private directives: Directive[];
    private directivesByType: { [directiveName: string]: Directive[] };
	private directivesByRoom: { [roomName: string]: Directive[] };
	private directivesByBrain: { [brainName: string]: Directive[] };
    private _directiveCached: boolean;
    private _managersCached: boolean;
    static settings = {
        outpostCheckFrequency: onPublicServer() ? 250 : 100,
    }

    constructor() {
        this.memory = Mem.wrap(Memory, 'CEO', getDefaultCEOMemory);
        this.directives = [];
        this.managers = [];
        this._directiveCached = false;
        this.managersByBrain = {};
        this._managersCached = false;
        this.notifier = new Notifier();
    }

    private get brains(): Brain[] {
        return _.values(BigBrain.brains);
    }

    refresh() {
        this.memory = Mem.wrap(Memory, 'CEO', getDefaultCEOMemory);
        this.notifier.clear();
    }

    registerDirective(directive: Directive): void {
        this.directives.push(directive);
        this._directiveCached = false;
    }

	getDirectivesOfType(directiveName: string): Directive[] {
		this.ensureDirectivesCached();
		return this.directivesByType[directiveName] || [];
    }

	getDirectivesInRoom(roomName: string): Directive[] {
		this.ensureDirectivesCached();
		return this.directivesByRoom[roomName] || [];
    }

	getDirectivesForBrain(brain: Brain): Directive[] {
		this.ensureDirectivesCached();
		return this.directivesByBrain[Brain.name] || [];
    }

    removeDirective(directive: Directive): void {
        this.directives = this.directives.reduce((acc, dir) => {
            if(dir.name === directive.name) {
                for(const name in directive.managers) {
                    this.removeManager(directive.managers[name]);
                }
                return acc;
            }
            return [...acc, dir];
        }, [] as Directive[])
        this._directiveCached = false;
    }

    private ensureDirectivesCached(): void {
		if (!this._directiveCached) {
			this.directivesByType = _.groupBy(this.directives, directive => directive.directiveName);
			this.directivesByRoom = _.groupBy(this.directives, directive => directive.pos.roomName);
			this.directivesByBrain = _.groupBy(this.directives, directive => directive.brain.name || 'none');
			this._directiveCached = true;
		}
	}

    private removeManager(manager: Manager): void {
        _.remove(this.managers, m => m.ref == manager.ref);
        this._managersCached = false;
    }

    registerManager(manager: Manager): void {
        this.managers.push(manager);
        this._managersCached = false;
    }

    getManagersForBrain(brain: Brain): Manager[] {
        return this.managersByBrain[brain.name] || [];
    }

    private ensureOverlordsCached(): void {
		if (!this._managersCached) {
			this.managers.sort((o1, o2) => o1.priority - o2.priority);
			this.managersByBrain = _.groupBy(this.managers, manager => manager.brain.name);
			for (const brainName in this.managersByBrain) {
				this.managersByBrain[brainName].sort((o1, o2) => o1.priority - o2.priority);
			}
			this._managersCached = true;
		}
	}

    init(): void {
		this.ensureDirectivesCached();
        this.ensureOverlordsCached();

        this.directives.forEach((directive) => directive.init());
        for(const manager of this.managers) {
            if(!manager.isSuspended) {
                manager.preInit();
                this.try(() => manager.init());
            }
        }
    }
    run(): void {
        this.directives.forEach(directive => directive.run());
        this.managers.forEach(manager => {
            !manager.isSuspended && this.try(() => manager.run());
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
