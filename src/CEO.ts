import { getAllBrains, Brain } from "Brian";
import { log } from "console/log";
import { Cartographer, ROOMTYPE_CONTROLLER } from "utils/Cartographer";
import { onPublicServer, canClaimAnotherRoom, getAllRooms } from "utils/utils";
import { RoomIntel } from "intel/RoomIntel";
import { DirectiveHarvest } from "directives/resource/harvest";
import { Manager } from "managers/Manager";
import { Directive } from "directives/directive";
import { USE_TRY_CATCH } from "settings";
import { Notifier } from "directives/Notifier";
import { profile } from "profiler";
import { Mem } from "memory/memory";
import { p } from "utils/random";
import { Pathing } from "movement/Pathing";
import { DirectiveOutpost } from "directives/colony/outpost";

// export const DIRECTIVE_CHECK_FREQUENCY = 2;

interface OverseerMemory {

}

const getDefaultOverseerMemory: () => OverseerMemory = () => ({});

/**
 * The Overseer object acts as a scheduler, running directives and managers for all brains each tick. It is also
 * in charge of starting new "processes" (directives) to respond to various situations.
 */
@profile
export class CEO implements ICeo {

    private memory: OverseerMemory;

    private directives: Directive[];
    private directivesByType: { [directiveName: string]: Directive[] };
    private directivesByRoom: { [roomName: string]: Directive[] };
    private directivesByBrain: { [brainName: string]: Directive[] };

    private managers: Manager[];
    private managersByBrain: { [col: string]: Manager[] };

    private _directiveCached: boolean;
    private _managersCached: boolean;

    // combatPlanner: CombatPlanner;
    notifier: Notifier;

    static settings = {
        outpostCheckFrequency: onPublicServer() ? 250 : 100
    };

    constructor() {
        this.memory = Mem.wrap(Memory, 'overseer', getDefaultOverseerMemory);
        this.directives = [];
        this.managers = [];
        this.managersByBrain = {};
        this._managersCached = false;
        this.notifier = new Notifier();
        // this.combatPlanner = new CombatPlanner();
    }

    refresh() {
        this.memory = Mem.wrap(Memory, 'overseer', getDefaultOverseerMemory);
        this.notifier.clear();
    }

    private try(callback: () => any, identifier?: string): void {
        if (USE_TRY_CATCH) {
            try {
                callback();
            } catch (e) {
                if (identifier) {
                    e.name = `Caught unhandled exception at ${'' + callback} (identifier: ${identifier}): \n`
                        + e.name + '\n' + e.stack;
                } else {
                    e.name = `Caught unhandled exception at ${'' + callback}: \n` + e.name + '\n' + e.stack;
                }
                BigBrain.errors.push(e);
            }
        } else {
            callback();
        }
    }

    registerDirective(directive: Directive): void {
        this.directives.push(directive);
        this._directiveCached = false;
    }

    removeDirective(directive: Directive): void {
        _.remove(this.directives, dir => dir.name == directive.name);
        for (const name in directive.managers) {
            this.removeManager(directive.managers[name]);
        }
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
        return this.directivesByBrain[brain.name] || [];
    }

    registerManager(manager: Manager): void {
        this.managers.push(manager);
        this._managersCached = false;
    }

    private removeManager(manager: Manager): void {
        _.remove(this.managers, o => o.ref == manager.ref);
        this._managersCached = false;
    }

    private ensureManagersCached(): void {
        if (!this._managersCached) {
            this.managers.sort((o1, o2) => o1.priority - o2.priority);
            this.managersByBrain = _.groupBy(this.managers, manager => manager.brain.name);
            for (const colName in this.managersByBrain) {
                this.managersByBrain[colName].sort((o1, o2) => o1.priority - o2.priority);
            }
            this._managersCached = true;
        }
    }

    getManagersForBrain(brain: Brain): Manager[] {
        return this.managersByBrain[brain.name] || [];
    }

    init(): void {

        this.ensureDirectivesCached();
        this.ensureManagersCached();

        // Initialize directives
        for (const directive of this.directives) {
            directive.init();
        }

        // Initialize managers
        for (const manager of this.managers) {
            if (!manager.isSuspended) {
                if (manager.profilingActive) {
                    const start = Game.cpu.getUsed();
                    manager.preInit();
                    this.try(() => manager.init());
                    manager.memory[MEM.STATS]!.cpu += Game.cpu.getUsed() - start;
                } else {
                    manager.preInit();
                    this.try(() => manager.init());
                }
            }
        }

        // Register cleanup requests to logistics network
        for (const brain of getAllBrains()) {
        }
    }

    // Operation =======================================================================================================

    run(): void {
        for (const directive of this.directives) {
            log.alert(`attempting to run directive: ${directive.print}`);
            directive.run();
        }
        for (const manager of this.managers) {
            if (!manager.isSuspended) {
                if (manager.profilingActive) {
                    const start = Game.cpu.getUsed();
                    this.try(() => manager.run());
                    manager.memory[MEM.STATS]!.cpu += Game.cpu.getUsed() - start;
                } else {
                    this.try(() => manager.run());
                }
            }
        }
        this.placeDirectives();
    }

    private placeDirectives() {
        const allBrains = getAllBrains();
        if(LATEST_BUILD_TICK == Game.time) {
            _.forEach(allBrains, brain => this.placeHarvestingDirectives(brain));
        }
    }

    private placeHarvestingDirectives(brain: Brain) {
        for(const source of brain.sources) {
            DirectiveHarvest.createIfNotPresent(source.pos, 'pos');
        }
    }

    getCreepReport(brain: Brain): string[][] {
        const spoopyBugFix = false;
        const roleOccupancy: { [role: string]: [number, number] } = {};

        for (const manager of this.managersByBrain[brain.name]) {
            for (const role in manager.creepUsageReport) {
                const report = manager.creepUsageReport[role];
                if (report == undefined) {
                    if (Game.time % 100 == 0) {
                        log.info(`Role ${role} is not reported by ${manager.ref}!`);
                    }
                } else {
                    if (roleOccupancy[role] == undefined) {
                        roleOccupancy[role] = [0, 0];
                    }
                    roleOccupancy[role][0] += report[0];
                    roleOccupancy[role][1] += report[1];
                    if (spoopyBugFix) { // bizzarely, if you comment these lines out, the creep report is incorrect
                        log.debug(`report: ${JSON.stringify(report)}`);
                        log.debug(`occupancy: ${JSON.stringify(roleOccupancy)}`);
                    }
                }
            }
        }


        // let padLength = _.max(_.map(_.keys(roleOccupancy), str => str.length)) + 2;
        const roledata: string[][] = [];
        for (const role in roleOccupancy) {
            const [current, needed] = roleOccupancy[role];
            // if (needed > 0) {
            // 	stringReport.push('| ' + `${role}:`.padRight(padLength) +
            // 					  `${Math.floor(100 * current / needed)}%`.padLeft(4));
            // }
            roledata.push([role, `${current}/${needed}`]);
        }
        return roledata;
    }
}
