import { Directive } from "directives/directive";
import { Manager } from "managers/Manager";
import { Bot } from "bot/Bot";
import { profile } from 'profiler';
import { ManagerPriority } from "priorities/priorities_managers";
import { $ } from "caching/GlobalCache";
import { Pathing } from "movement/Pathing";
import { log } from "console/log";
import { Setups } from "creepSetup/setup";
import { dropTaskName } from "tasks/instances/drop";

const BUILD_OUTPUT_FREQUENCY = 15;

@profile
export class ExtractorManager extends Manager {
    directive: Directive;
    room: Room | undefined;
    extractor: StructureExtractor | undefined;
    mineral: Mineral | undefined;
    container: StructureContainer | undefined;
    harvesters: Bot[];

    static settings = {
        maxHavesters: 2
    }

    constructor(directive: Directive, priority: number) {
        super(directive, 'mineral', priority);

        this.directive = directive;
        this.priority = this.priority + this.outpostIndex * ManagerPriority.remoteSKRoom.roomIncrement;
        this.populateStructures();
    }

    private shouldHaveContainer() {
        return this.mineral && (this.mineral.mineralAmount > 0 || this.mineral.ticksToRegeneration < 2000);
    }

    private populateStructures() {
        if(Game.rooms[this.pos.roomName]) {
            this.extractor = this.pos.lookForStructure(STRUCTURE_EXTRACTOR) as StructureExtractor | undefined;
            this.mineral = this.pos.lookFor(LOOK_MINERALS)[0];
            this.container = this.pos.findClosestByLimitedRange(Game.rooms[this.pos.roomName].containers, 1);
        }
    }
    private calculateContainerPos() {
        let originPos: RoomPosition | undefined;
        if(this.brain.storage){
            originPos = this.brain.storage.pos;
        } else if ( this.brain.roomPlanner.storagePos ) {
            originPos = this.brain.roomPlanner.storagePos
        }
        if(originPos){
            const path = Pathing.findShortestPath(this.pos, originPos).path;
            const pos = _.find(path, pos => pos.getRangeTo(this) == 1);
            if (pos) return pos;
        }
        log.warning(`Last resort container position calculation for ${this.print}!`);
        return _.first(this.pos.availableNeighbors(true));
    }

    private registerOutputRequest() {
        if(this.container) {
            const outputThreshold = this.harvesters.length == 0 ? this.container.store.getCapacity() : 0;
            if(this.container.store.getUsedCapacity() > outputThreshold) {
                this.brain.logisticsNetwork.requestOutput(this.container, {resourceType: 'all'});
            }
        }
    }

    refresh(): void {
        if (!this.room && Game.rooms[this.pos.roomName]) {
            this.populateStructures();
        }
        super.refresh();
        $.refresh(this, 'extractor', 'mineral', 'container');
    }

    init(): void {
        this.registerOutputRequest();
        const amount = this.mineral && this.mineral.mineralAmount > 0 && this.extractor && this.container ? Math.min(this.mineral.pos.availableNeighbors().length, ExtractorManager.settings.maxHavesters) : 0;
        this.wishlist(amount, Setups.worker.extractor);
    }
    private buildOutputIfNeeded() {
        if(!this.container && this.shouldHaveContainer()) {
            const contructionSite = _.first(_.filter(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2), s => s.structureType == STRUCTURE_CONTAINER));

            if(!contructionSite){
                const containerPos = this.calculateContainerPos();
                log.info(`${this.print}: building container at ${containerPos.print}`);
                const r = containerPos.createConstructionSite(STRUCTURE_CONTAINER);
                if(r != OK) {
                    log.error(`${this.print}: cannont build container at ${containerPos}! result: ${r}`);
                }
            }
        }
    }

    private handleHarvester(h: Bot) {
        if(h.avoidDanger({timer: 10, dropEnergy: true})) {
            return;
        }

        if(h.room == this.room && !h.pos.isEdge) {
            if(this.mineral && !h.pos.inRangeToPos(this.mineral.pos,1)) {
                return h.goTo(this.mineral);
            }
            if(this.mineral) {
                const ret = h.harvest(this.mineral);
                if(ret == ERR_NOT_IN_RANGE) {
                    return h.goTo(this.mineral)
                }
                if(this.container) {
                    if(h.store.getUsedCapacity() > 0.9 * h.store.getCapacity()){
                        const r = h.transferAll(this.container);
                        if(r == ERR_NOT_IN_RANGE) {
                            return h.goTo(this.container, {range: 1});
                        }
                    }

                    if(this.harvesters.length == 1 && !h.pos.isEqualTo(this.container.pos)) {
                        return h.goTo(this.container, {range: 1});
                    }
                }
            }
        } else {
            h.goTo(this);
        }
        return;
    }
    run(): void {
        _.forEach(this.harvesters, harvester => this.handleHarvester(harvester));
        if(this.room && Game.time % BUILD_OUTPUT_FREQUENCY == 2) {
            this.buildOutputIfNeeded();
        }
    }
}
