import { log } from '../../console/log';
import { profile } from '../../profiler';
import { Manager } from 'managers/Manager';
import { Brain } from 'Brian';
import { ManagerPriority } from 'priorities/priorities_managers';
import { Bot } from 'bot/Bot';
import { Roles, Setups } from 'creepSetup/setup';
import { Pathing } from 'movement/Pathing';
import { TransportRequestTarget } from 'logistics/TransportRequestGroup';
import { LogisticsRequest, BufferTarget, ALL_RESOURCE_TYPE_ERROR } from 'logistics/LogisticsNetwork';
import { isTombstone, isResource } from 'declarations/typeGuards';
import { Tasks } from '../../tasks/Tasks';

@profile
export class TransportManager extends Manager {
    transports: Bot[];
    constructor(brain: Brain, priority = ManagerPriority.ownedRoom.transport) {
        super(brain, 'logistics', priority);
        this.transports = this.bots(Roles.transport);
    }

    private neededTransportPower(): number {
        if (!this.brain.storage
            && !(this.brain.spawner && this.brain.spawner.battery)
                && !this.brain.upgradeSite.battery) {
            return 0;
        }

        let transportPower = 0;
        const scaling = 2;
        for (const flagName in this.brain.miningSites) {
            const o = this.brain.miningSites[flagName].managers.mine;
            if (!o.isSuspended && o.miners.length > 0) {
                if ((o.container && !o.link) || o.allowDropMining) {
                    transportPower += o.energyPerTick * scaling * o.distance;
                }
            }
        }

        if (this.brain.upgradeSite.battery) {
            transportPower += UPGRADE_CONTROLLER_POWER * this.brain.upgradeSite.upgradePowerNeeded * scaling * (Pathing.distance(this.brain.pos, this.brain.upgradeSite.battery.pos) || 0);
        }
        if(this.brain.state.lowPowerMode) {
            transportPower *= 0.5;
        }
        return transportPower / CARRY_CAPACITY;
    }

    init(): void {
        const ROAD_COVERAGE_THRESHOLD = 0.75;
        const setup = Setups.transport.early;
        const transportPowerEach = setup.getBodyPotential(CARRY, this.brain);
        const neededTransportPower = this.neededTransportPower();
        const numTransporters = Math.ceil(neededTransportPower / transportPowerEach + 0.1);
        if (this.transports.length == 0) {
            this.wishlist(numTransporters, setup, { priority: ManagerPriority.ownedRoom.firstTransport });
        } else {
            this.wishlist(numTransporters, setup);
        }
    }

    run(): void {
        this.autoRun(this.transports, transport => this.handleSmallTransporter(transport))
    }

    private handleTransporter(transporter: Bot, request: LogisticsRequest | undefined) {
        if (request) {
            const choices = this.brain.logisticsNetwork.bufferChoices(transporter, request);
            const bestChoice = _.last(_.sortBy(choices, choice => request.multiplier * choice.dQ / Math.max(choice.dQ, 0.1)));
            let task = null;
            const amount = this.brain.logisticsNetwork.predictedRequestAmount(transporter, request);
            if (amount > 0) {
                if (isResource(request.target) || isTombstone(request.target)) {
                    log.warning(`Improper logistics request: should not request input for resource or tombstone!`);
                    return;
                } else if (request.resourceType == 'all') {
                    log.error(`${this.print}: cannot request 'all' as input!`);
                    return;
                } else {
                    task = Tasks.transfer(<TransferrableStoreStructure>request.target, request.resourceType);
                }
                if (bestChoice.targetRef != request.target.ref) {
                    // If we need to go to a buffer first to get more stuff
                    const buffer = deref(bestChoice.targetRef) as BufferTarget;
                    //@ts-ignore
                    const withdrawAmount = Math.min(buffer.store[request.resourceType] || 0, transporter.carryCapacity - _.sum(transporter.carry), amount);
                    task = task.fork(Tasks.withdraw(buffer, request.resourceType, withdrawAmount));
                    if (transporter.hasMineralsInCarry && request.resourceType == RESOURCE_ENERGY) {
                        task = task.fork(Tasks.transferAll(buffer));
                    }
                }
            } else if (amount < 0) {
                if (isResource(request.target)) {
                    task = Tasks.pickup(request.target);
                } else {
                    if (request.resourceType == 'all') {
                        if (isResource(request.target)) {
                            log.error(this.print + ALL_RESOURCE_TYPE_ERROR);
                            return;
                        }
                        task = Tasks.withdrawAll(request.target);
                    } else {
                        task = Tasks.withdraw(request.target, request.resourceType);
                    }
                }
                if (task && bestChoice.targetRef != request.target.ref) {
                    // If we need to go to a buffer first to deposit stuff
                    const buffer = deref(bestChoice.targetRef) as BufferTarget;
                    task = task.fork(Tasks.transferAll(buffer));
                }
            } else {
                // console.log(`${transporter.name} chooses a store with 0 amount!`);
                transporter.park();
            }
            // Assign the task to the transporter
            transporter.task = task;
            this.brain.logisticsNetwork.invalidateCache(transporter, request);
        } else {
            // If nothing to do, put everything in a store structure
            //@ts-ignore
            if (_.sum(transporter.carry) > 0) {
                if (transporter.hasMineralsInCarry) {
                    const target = this.brain.terminal || this.brain.storage;
                    if (target) {
                        transporter.task = Tasks.transferAll(target);
                    }
                } else {
                    const dropoffPoints: (StructureLink | StructureStorage)[] = _.compact([this.brain.storage!]);

                    const bestDropoffPoint = transporter.pos.findClosestByMultiRoomRange(dropoffPoints);

                    if (bestDropoffPoint) transporter.task = Tasks.transfer(bestDropoffPoint);
                }
            } else {
                let parkingSpot = transporter.pos;
                if (this.brain.storage) {
                    parkingSpot = this.brain.storage.pos;
                } else if (this.brain.roomPlanner.storagePos) {
                    parkingSpot = this.brain.roomPlanner.storagePos;
                }
                transporter.park(parkingSpot);
            }
        }
        // console.log(JSON.stringify(transporter.memory.task));
    }

    private handleSmallTransporter(smallTransport: Bot) {
        const bestRequestViaGreedy = _.first(this.brain.logisticsNetwork.transporterPreferences(smallTransport));
        this.handleTransporter(smallTransport, bestRequestViaGreedy);
    }

    private handleBigTransportRequest(bigTransport: Bot) {
        const bestRequestViaStableMatching = this.brain.logisticsNetwork.matching[bigTransport.name];
        this.handleTransporter(bigTransport, bestRequestViaStableMatching);
    }

    private pickupDroppedResources(transporter: Bot) {
        const droppedResource = transporter.pos.lookFor(LOOK_RESOURCES)[0];
        if (droppedResource) {
            transporter.pickup(droppedResource);
            return;
        }
        const tombstone = transporter.pos.lookFor(LOOK_TOMBSTONES)[0];
        if (tombstone) {
            const resourceType = _.last(_.sortBy(_.keys(tombstone.store),
                resourceType => (tombstone.store[<ResourceConstant>resourceType] || 0)));
            transporter.withdraw(tombstone, <ResourceConstant>resourceType);
        }

    }
}
