import { profile } from "profiler";
import { Component } from "./Component";
import { Brain } from "Brian";
import { TransportRequestGroup } from "logistics/TransportRequestGroup";
import { Mem } from "memory/memory";
import { Priority } from "priorities/priorities";
import { log } from "console/log";
import { Cartographer } from "utils/Cartographer";
import { $ } from '../caching/GlobalCache';
import { CommandCenterOverlord } from "managers/core/manager";

export const MAX_OBSERVE_DISTANCE = 4;

interface CommandCenterMemory {
    idlePos?: ProtoPos;
}

/**
 * The command center groups the high-level structures at the core of the bunker together, including storage, terminal,
 * link, power spawn, observer, and nuker.
 */
@profile
export class CommandCenter extends Component {

    memory: CommandCenterMemory;
    storage: StructureStorage;								// The brain storage, also the instantiation object
    link: StructureLink | undefined;						// Link closest to storage
    terminal: StructureTerminal | undefined;				// The brain terminal
    towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
    powerSpawn: StructurePowerSpawn | undefined;			// Brain Power Spawn
    nuker: StructureNuker | undefined;						// Brain nuker
    observer: StructureObserver | undefined;				// Brain observer
    transportRequests: TransportRequestGroup;				// Box for energy requests

    private observeRoom: string | undefined;
    private _idlePos: RoomPosition;							// Cached idle position

    static settings = {
        enableIdleObservation: true,
        linksTransmitAt: LINK_CAPACITY - 100,
        refillTowersBelow: 750,
    };

    constructor(brain: Brain, storage: StructureStorage) {
        super(brain, storage, 'commandCenter');
        this.memory = Mem.wrap(this.brain.memory, 'commandCenter');
        // Register physical components
        this.storage = storage;
        this.terminal = brain.terminal;
        this.powerSpawn = brain.powerSpawn;
        this.nuker = brain.nuker;
        this.observer = brain.observer;
        if (this.brain.bunker) {
            this.link = this.brain.bunker.anchor.findClosestByLimitedRange(brain.availableLinks, 1);
            this.brain.linkNetwork.claimLink(this.link);
            this.towers = this.brain.bunker.anchor.findInRange(brain.towers, 1);
        } else {
            this.link = this.pos.findClosestByLimitedRange(brain.availableLinks, 2);
            this.brain.linkNetwork.claimLink(this.link);
            this.towers = this.pos.findInRange(brain.towers, 3);
        }
        this.transportRequests = new TransportRequestGroup(); // commandCenter always gets its own request group
        this.observeRoom = undefined;
    }

    refresh() {
        this.memory = Mem.wrap(this.brain.memory, 'commandCenter');
        $.refreshRoom(this);
        $.refresh(this, 'storage', 'terminal', 'powerSpawn', 'nuker', 'observer', 'link', 'towers');
        this.transportRequests.refresh();
        this.observeRoom = undefined;
    }

    higherManagers() {
        if (this.link || this.terminal) {
            this.manager = new CommandCenterOverlord(this);
        }
    }

    // Idle position
    get idlePos(): RoomPosition {
        if (this.brain.bunker) {
            return this.brain.bunker.anchor;
        }
        if (!this.memory.idlePos || Game.time % 25 == 0) {
            this.memory.idlePos = this.findIdlePos();
        }
        return derefRoomPosition(this.memory.idlePos);
    }

    /* Find the best idle position */
    private findIdlePos(): RoomPosition {
        // Try to match as many other structures as possible
        const proximateStructures: Structure[] = _.compact([this.link!,
        this.terminal!,
        this.powerSpawn!,
        this.nuker!,
        ...this.towers]);
        const numNearbyStructures = (pos: RoomPosition) =>
            _.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
        return _.last(_.sortBy(this.storage.pos.neighbors, pos => numNearbyStructures(pos)));
    }

    /* Register a link transfer store if the link is sufficiently full */
    private registerLinkTransferRequests(): void {
        if (this.link) {
            if (this.link.energy > CommandCenter.settings.linksTransmitAt) {
                this.brain.linkNetwork.requestTransmit(this.link);
            }
        }
    }

    private registerRequests(): void {

        // Refill core spawn (only applicable to bunker layouts)
        if (this.brain.bunker && this.brain.bunker.coreSpawn) {
            if (this.brain.bunker.coreSpawn.energy < this.brain.bunker.coreSpawn.energyCapacity) {
                this.transportRequests.requestInput(this.brain.bunker.coreSpawn, Priority.Normal);
            }
        }

        // If the link has energy and nothing needs it, empty it
        if (this.link && this.link.energy > 0) {
            if (this.brain.linkNetwork.receive.length == 0 || this.link.cooldown > 3) {
                this.transportRequests.requestOutput(this.link, Priority.High);
            }
        }

        // Nothing else should request if you're trying to start a room back up again
        if (this.brain.state.bootstrapping) {
            return;
        }

        // Supply requests:

        // If the link is empty and can send energy and something needs energy, fill it up
        if (this.link && this.link.energy < 0.9 * this.link.energyCapacity && this.link.cooldown <= 1) {
            if (this.brain.linkNetwork.receive.length > 0) { 	// If something wants energy
                this.transportRequests.requestInput(this.link, Priority.Critical);
            }
        }
        // Refill towers as needed with variable priority
        const refillTowers = _.filter(this.towers, tower => tower.energy < CommandCenter.settings.refillTowersBelow);
        _.forEach(refillTowers, tower => this.transportRequests.requestInput(tower, Priority.High));

        // Refill power spawn
        if (this.powerSpawn) {
            if (this.powerSpawn.energy < this.powerSpawn.energyCapacity * .5) {
                this.transportRequests.requestInput(this.powerSpawn, Priority.NormalLow);
            } else if (this.powerSpawn.power < this.powerSpawn.powerCapacity * .5 && this.terminal
                && this.terminal.store.power && this.terminal.store.power >= 100) {
                this.transportRequests.requestInput(this.powerSpawn, Priority.NormalLow, { resourceType: RESOURCE_POWER });
            }
        }
        // Refill nuker with low priority
        if (this.nuker) {
            if (this.nuker.energy < this.nuker.energyCapacity && (this.storage.energy > 200000 && this.nuker.cooldown
                <= 1000 || this.storage.energy > 800000)) {
                this.transportRequests.requestInput(this.nuker, Priority.Low);
            }
            if (this.nuker.ghodium < this.nuker.ghodiumCapacity
                && this.brain.assets[RESOURCE_GHODIUM] >= LAB_MINERAL_CAPACITY) {
                this.transportRequests.requestInput(this.nuker, Priority.Low, { resourceType: RESOURCE_GHODIUM });
            }
        }

        if (this.storage && this.terminal) {
            if (this.storage.store[RESOURCE_OPS] < 3000 && this.terminal.store[RESOURCE_OPS] > 100) {
                this.transportRequests.requestInput(this.storage, Priority.Normal, { resourceType: RESOURCE_OPS });
            }
        }

    }

    requestRoomObservation(roomName: string) {
        this.observeRoom = roomName;
    }

    private runObserver(): void {
        if (this.observer) {
            if (this.observeRoom) {
                this.observer.observeRoom(this.observeRoom);
            } else if (CommandCenter.settings.enableIdleObservation && Game.time % 1000 < 100) {
                const axisLength = MAX_OBSERVE_DISTANCE * 2 + 1;
                const dx = Game.time % axisLength - MAX_OBSERVE_DISTANCE;
                const dy = Math.floor((Game.time % axisLength ** 2) / axisLength) - MAX_OBSERVE_DISTANCE;
                if (dx == 0 && dy == 0) {
                    return;
                }
                const roomToObserve = Cartographer.findRelativeRoomName(this.pos.roomName, dx, dy);
                this.observer.observeRoom(roomToObserve);
                // // TODO OBSERVER FIX ONLY LOOK AT southwest corner
                // const dx = Game.time % MAX_OBSERVE_DISTANCE;
                // const dy = Game.time % (MAX_OBSERVE_DISTANCE ** 2);
                // const roomToObserve = Cartographer.findRelativeRoomName(this.pos.roomName, dx, dy);
                this.observer.observeRoom(roomToObserve);
            }
        }
    }

    private runPowerSpawn() {
        // if (this.powerSpawn && this.storage && this.brain.assets.energy > 300000 &&
        // 	this.powerSpawn.store.energy >= 50 && this.powerSpawn.store.power > 0) {
        // 	if (Game.market.credits < TraderJoe.settings.market.credits.canBuyAbove) {
        // 		// We need to get enough credits that we can start to buy things. Since mineral prices have plunged
        // 		// recently, often the only way to do this without net losing credits (after factoring in the
        // 		// energy -> credits of transaction costs) is to sell excess energy. Power processing eats up a
        // 		// huge amount of energy, so we're going to disable it below a certain threshold.
        // 		return;
        // 	}
        // 	if (Game.time % 20 == 0) {
        // 		log.info(`Processing power in ${this.room.print}`);
        // 	}
        // 	this.powerSpawn.processPower();
        // }
    }

    // Initialization and operation ====================================================================================

    init(): void {
        this.registerLinkTransferRequests();
        this.registerRequests();
    }

    run(): void {
        this.runObserver();
        this.runPowerSpawn();
    }

    // visuals(coord: Coord): Coord {
    // 	let {x, y} = coord;
    // 	const height = this.storage && this.terminal ? 2 : 1;
    // 	const titleCoords = Visualizer.section(`${this.brain.name} Command Center`,
    // 										   {x, y, roomName: this.room.name}, 9.5, height + .1);
    // 	const boxX = titleCoords.x;
    // 	y = titleCoords.y + 0.25;
    // 	if (this.storage) {
    // 		Visualizer.text('Storage', {x: boxX, y: y, roomName: this.room.name});
    // 		Visualizer.barGraph(_.sum(this.storage.store) / this.storage.storeCapacity,
    // 							{x: boxX + 4, y: y, roomName: this.room.name}, 5);
    // 		y += 1;
    // 	}
    // 	if (this.terminal) {
    // 		Visualizer.text('Terminal', {x: boxX, y: y, roomName: this.room.name});
    // 		Visualizer.barGraph(_.sum(this.terminal.store) / this.terminal.storeCapacity,
    // 							{x: boxX + 4, y: y, roomName: this.room.name}, 5);
    // 		y += 1;
    // 	}
    // 	return {x: x, y: y + .25};
    // }
}
