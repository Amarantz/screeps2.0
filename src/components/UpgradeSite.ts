import { Component } from "./Component";
import { profile } from 'profiler';
import { Brain, brainStage } from "Brian";
import { $ } from "caching/GlobalCache";
import { UpgradingManager } from "managers/core/upgrader";
import { Mem } from "memory/memory";
import { log } from "console/log";
import { Stats } from "stats/stats";
import { hasMinerals } from "utils/utils";

interface UpgradeSiteMemory {
    stats: { downtime: number };
    speedFactor: number;		// Multiplier on upgrade parts for fast growth
}


@profile
export class UpgradeSite extends Component {

    memory: UpgradeSiteMemory;
    controller: StructureController;
    upgradePowerNeeded: number;
    link: StructureLink | undefined;
    battery: StructureContainer | undefined;
    batterPos: RoomPosition | undefined;
    manager: UpgradingManager;

    static settings = {
        energyBuffer: 100000,
        energyPerBodyUnit: 20000,
        minLinkDistance: 10,
        linksRequestBelow: 200,
    }
    batteryPos: any;

    constructor(brain: Brain, controller: StructureController) {
        super(brain, controller, 'upgradeSite');
        this.controller = controller;
        this.memory = Mem.wrap(this.brain.memory, 'upgradeSite');
        this.upgradePowerNeeded = this.getUpgradePowerNeeded();
        $.set(this, 'battery', () => {
            const allowableContainers = _.filter(this.room.containers, container => container.pos.findInRange(FIND_SOURCES, 1).length == 0);
            return this.pos.findClosestByLimitedRange(allowableContainers, 3);
        });
        this.batteryPos = $.pos(this, 'batterPos', () => {
            if (this.battery) {
                return this.battery.pos;
            }
            const inputSite = this.findInputConstructionSite();
            if (inputSite) {
                return inputSite.pos;
            }
            return this.calculateBatteryPos() || log.alert(`Upgrade site at ${this.pos.print}: no bbatteryPos!`);
        });
        if(this.batterPos) this.brain.destinations.push({pos: this.batterPos, order: 0});
        $.set(this, 'link', () => this.pos.findClosestByLimitedRange(brain.availableLinks,3));
        this.brain.linkNetwork.claimLink(this.link);
        this.stats();
    }
    refresh(): void {
        this.memory = Mem.wrap(this.brain.memory, 'upgradeSite');
        $.refreshRoom(this);
        $.refresh(this, 'controller', 'battery', 'link');
    }

    findInputConstructionSite(): ConstructionSite | undefined {
        const nearbyInputSites = this.pos.findInRange(this.room.constructionSites, 4, {
            filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_LINK,
        });
        return _.first(nearbyInputSites);
    }

    private getUpgradePowerNeeded(): number {
		return $.number(this, 'upgradePowerNeeded', () => {
			if (this.room.storage) { // Workers perform upgrading until storage is set up
				const amountOver = Math.max(this.brain.assets.energy - UpgradeSite.settings.energyBuffer, 0);
				let upgradePower = 1 + Math.floor(amountOver / UpgradeSite.settings.energyPerBodyUnit);
				if (amountOver > 800000) {
					upgradePower *= 4; // double upgrade power if we have lots of surplus energy
				} else if (amountOver > 500000) {
					upgradePower *= 2;
				}
				if (this.controller.level == 8) {
					if (this.brain.assets.energy < 30000) {
						upgradePower = 0;
					} else {
						upgradePower = Math.min(upgradePower, 15); // don't go above 15 work parts at RCL 8
					}
				} else if (this.controller.level >= 6) {
					// Can set a room to upgrade at an accelerated rate manually
					upgradePower = this.memory.speedFactor != undefined ? upgradePower * this.memory.speedFactor : upgradePower;
				}
				return upgradePower;
			} else {
				return 0;
			}
		});
    }

    init(): void {
        		// Register energy requests
		if (this.link && this.link.energy < UpgradeSite.settings.linksRequestBelow) {
			// this.brain.linkNetwork.requestReceive(this.link);
		}
		const inThreshold = this.brain.stage > brainStage.Infant ? 0.5 : 0.75;
		if (this.battery) {
			if (this.battery.energy < inThreshold * this.battery.storeCapacity) {
				const energyPerTick = UPGRADE_CONTROLLER_POWER * this.upgradePowerNeeded;
				this.brain.logisticsNetwork.requestInput(this.battery, {dAmountdt: energyPerTick});
            }
            //@ts-ignore
			if (hasMinerals(this.battery.store)) { // get rid of any minerals in the container if present
				this.brain.logisticsNetwork.requestOutputMinerals(this.battery);
			}
		}
    }
    higherManagers(): void {
        this.manager = new UpgradingManager(this);
    }
    private stats() {
        const defaults = {
			downtime: 0,
		};
		if (!this.memory.stats) this.memory.stats = defaults;
		_.defaults(this.memory.stats, defaults);
		// Compute downtime
		this.memory.stats.downtime = (this.memory.stats.downtime * (CREEP_LIFE_TIME - 1) +
									  (this.battery ? +this.battery.isEmpty : 0)) / CREEP_LIFE_TIME;
		Stats.log(`brains.${this.brain.name}.upgradeSite.downtime`, this.memory.stats.downtime);
    }

    	/**
	 * Build a container output at the optimal location
	 */
	private buildBatteryIfMissing(): void {
		if (!this.battery && !this.findInputConstructionSite()) {
			const buildHere = this.batteryPos;
			if (buildHere) {
				const result = buildHere.createConstructionSite(STRUCTURE_CONTAINER);
				if (result == OK) {
					return;
				} else {
					log.warning(`Upgrade site at ${this.pos.print}: cannot build battery! Result: ${result}`);
				}
			}
		}
    }

    	/**
	 * Calculate where the input will be built for this site
	 */
	private calculateBatteryPos(): RoomPosition | undefined {
		let originPos: RoomPosition | undefined;
		if (this.brain.storage) {
			originPos = this.brain.storage.pos;
		} else if (this.brain.roomPlanner.storagePos) {
			originPos = this.brain.roomPlanner.storagePos;
		} else {
			return;
		}
		// Find all positions at range 2 from controller
		let inputLocations: RoomPosition[] = [];
		for (const pos of this.pos.getPositionsAtRange(2)) {
			if (pos.isWalkable(true)) {
				inputLocations.push(pos);
			}
		}
		// Try to find locations where there is maximal standing room
		const maxNeighbors = _.max(_.map(inputLocations, pos => pos.availableNeighbors(true).length));
		inputLocations = _.filter(inputLocations,
								  pos => pos.availableNeighbors(true).length >= maxNeighbors);
		// Return location closest to storage by path
		const inputPos = originPos?.findClosestByPath(inputLocations);
		if (inputPos) {
			return inputPos;
        }
        return;
	}

    run(): void {
        if (Game.time % 25 == 7 && this.brain.level >= 2) {
			this.buildBatteryIfMissing();
		}
    }

}
