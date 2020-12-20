import { Manager } from "managers/Manager";
import { fileURLToPath } from "url";
import { Tasks } from "tasks/Tasks";
import { Bot } from "bot/Bot";
import { patternCost, bodyCost, CreepSetup } from "creepSetup/CreepSetup";
import { Roles, Setups } from "creepSetup/setup";
import { DirectiveBootstrap } from "directives/situational/bootstrap";
import { ManagerPriority } from "priorities/priorities_managers";
import { DirectiveHarvest } from "directives/resource/harvest";
import { SpawnRequest } from "components/spawner";
import { RESOURCES_ALL_EXCEPT_ENERGY } from "resources/map_resoures";
import { worker } from "cluster";

export class BootstrappingManager extends Manager {
    fillers: Bot[];
    supplyStructures: (StructureSpawn | StructureExtension)[];
    withdrawStructures: (StructureStorage | StructureTerminal | StructurePowerSpawn | StructureContainer | StructureLink | StructureTower | StructureLab)[];

    constructor(directive: DirectiveBootstrap, priority = ManagerPriority.emergency.bootstrap) {
        super(directive, 'bootstrap', priority);
        this.fillers = this.bots(Roles.filler);
        this.supplyStructures = _.filter([...this.brain.spawns, ...this.brain.extensions], structure => structure.energy < structure.energyCapacity);
        //@ts-ignore
        this.withdrawStructures = _.filter(_.compact([this.brain.storage!, this.brain.terminal!, this.brain.powerSpawn!, ...this.room!.containers, ...this.room!.links, ...this.room!.towers, ...this.room!.labs]), structure => structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
    }
    init(): void {
        const totalEnergyInRoom = _.sum(this.withdrawStructures, structure => structure.store.energy);
        const costToMakeNormalMinerAndFiller = patternCost(Setups.worker.miner.emergency) * 3 + patternCost(Setups.filler.default);
        if (totalEnergyInRoom < costToMakeNormalMinerAndFiller) {
            if (this.brain.getCreepsByRole(Roles.harvester).length == 0) {
                this.spawnBootstrapMiners();
                return;
            }
        }
        if (this.brain.getCreepsByRole(Roles.queen).length == 0 && this.brain.spawner) {
            const transport = _.first(this.brain.getBotsByRole(Roles.transport));
            if (transport) {
                transport.reassign(this.brain.spawner.manager, Roles.queen);
            } else {
                this.wishlist(1, Setups.filler.default);
            }
        }
        this.spawnBootstrapMiners();
    }
    spawnBootstrapMiners() {
        // Isolate mining site overlords in the room
        let miningSitesInRoom = _.filter(_.values(this.brain.miningSites),
            site => site.room == this.brain.room) as DirectiveHarvest[];
        if (this.brain.spawns[0]) {
            miningSitesInRoom = _.sortBy(miningSitesInRoom, site => site.pos.getRangeTo(this.brain.spawns[0]));
        }

        // If you have no miners then create whatever is the biggest miner you can make
        const pattern = [WORK, WORK, CARRY, MOVE];
        const miningOverlordsInRoom = _.map(miningSitesInRoom, site => site.managers.mine);
        const allMiners = _.flatten(_.map(miningOverlordsInRoom, overlord => overlord.lifetimeFilter(overlord.miners)));
        const allMiningPower = _.sum(allMiners, creep => creep.getActiveBodyparts(WORK));
        let sizeLimit: number;
        if (allMiningPower == 0) {
            sizeLimit = Math.min(Math.floor(this.brain.room.energyAvailable / bodyCost(pattern)), 3);
        } else { // Otherwise if you have miners then you can afford to make normal ones
            sizeLimit = 3;
        }
        const setup = new CreepSetup(Roles.harvester, {
            pattern: pattern,
            sizeLimit: sizeLimit,
        });

        // Create a bootstrapMiners and donate them to the miningSite overlords as needed
        for (const overlord of miningOverlordsInRoom) {
            const filteredMiners = this.lifetimeFilter(overlord.miners);
            const miningPowerAssigned = _.sum(_.map(this.lifetimeFilter(overlord.miners),
                creep => creep.getActiveBodyparts(WORK)));
            if (miningPowerAssigned < overlord.miningPowerNeeded &&
                filteredMiners.length < overlord.pos.availableNeighbors().length) {
                if (this.brain.spawner) {
                    const request: SpawnRequest = {
                        setup: setup,
                        manager: overlord,
                        priority: this.priority + 1,
                    };
                    this.brain.spawner.enqueue(request);
                    this.debug(`Enqueueing bootstrap miner with size ${sizeLimit}`);
                }
            }
        }
    }

    private supplyActions(filler: Bot) {
        const target = filler.pos.findClosestByRange(this.supplyStructures);
        if (target) {
            filler.task = Tasks.transfer(target);
        } else {
            this.rechargeActions(filler);
        }
    }

    private rechargeActions(filler: Bot) {
        const target = filler.pos.findClosestByRange(this.withdrawStructures);
        if (target) {
            filler.task = Tasks.withdraw(target);
        } else {
            filler.task = Tasks.recharge();
        }
    }

    private handleFiller(filler: Bot) {
        if (filler.carry.energy > 0) {
            this.supplyActions(filler);
        } else {
            this.rechargeActions(filler);
        }
    }
    run(): void {
        for (const filler of this.fillers) {
            if (filler.isIdle) {
                this.handleFiller(filler);
            }
            filler.run();
        }
    }

}
