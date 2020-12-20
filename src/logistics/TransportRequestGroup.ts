import { profile } from "profiler";
import { blankPriorityQueue, Priority } from "priorities/priorities";


export interface TransportRequest {
    target: TransportRequestTarget;
    amount: number;
    resourceType: ResourceConstant;
}

interface TransportRequestOptions {
	amount?: number;
	resourceType?: ResourceConstant;
}


export type TransportRequestTarget = TransferrableStoreStructure;

@profile
export class TransportRequestGroup {
    supply: { [priority: number]: TransportRequest[] };
    withdraw: { [priority: number]: TransportRequest[] };
    supplyById: { [id: string]: TransportRequest[] };
    withdrawById: { [id: string]: TransportRequest[] };
    constructor() {
        this.refresh();
    }

    refresh(): void {
        this.supply = blankPriorityQueue();
        this.withdraw = blankPriorityQueue();
        this.supplyById = {};
        this.withdrawById = {};
    }

    needsWithdrawing(priorityThreshold?: Priority): boolean {
        for (const priority in this.withdraw) {
            if (priorityThreshold != undefined && parseInt(priority, 10) > priorityThreshold) {
                continue;
            }
            if (this.withdraw[priority].length > 0) {
                return true;
            }
        }
        return false;
    }

    getPrioritizedClosetRequest(pos: RoomPosition, type: 'supply' | 'withdraw', filter?: (request: TransportRequest) => boolean): TransportRequest | undefined {
        const requests = (type == 'withdraw' && this.withdraw) || this.supply;
        for (const priority in requests) {
            const targets = _.map(requests[priority], request => request.target);
            const target = pos.findClosestByRangeThenPath(targets);
            if(target){
                let searchRequests;
                if(filter) {
                    searchRequests = _.filter(requests[priority], req => filter(req));
                } else {
                    searchRequests = requests[priority];
                }
                return _.find(searchRequests, request => request.target.ref == target!.ref);
            }
        }
        return;
    }

    needsSupplying(priorityThreshold?: Priority): boolean {
		for (const priority in this.supply) {
			if (priorityThreshold != undefined && parseInt(priority, 10) > priorityThreshold) {
				continue; // lower numerical priority values are more important; if priority > threshold then ignore it
			}
			if (this.supply[priority].length > 0) {
				return true;
			}
		}
		return false;
	}

    private getInputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
        // @ts-ignore
        return (resourceType && target.store.getFreeCapacity(resourceType)) || 0;
    }

    private getOutputAmount(target: TransportRequestTarget, resourceType: ResourceConstant): number {
        // @ts-ignore
        return (resourceType && target.store.getUsedCapacity(resourceType)) || 0;
    }

    requestInput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
        _.defaults(opts, {
            resourceType: RESOURCE_ENERGY,
        });
        if (opts.amount == undefined) {
            opts.amount = this.getInputAmount(target, opts.resourceType!);
        }

        const req: TransportRequest = {
            target: target,
            resourceType: opts.resourceType!,
            amount: opts.amount!
        };
        if(opts.amount > 0) {
            this.supply[priority].push(req);
            if(!this.supplyById[target.id]) this.supplyById[target.id] = [];
            this.supplyById[target.id].push(req)
        }
    }

    requestOutput(target: TransportRequestTarget, priority = Priority.Normal, opts = {} as TransportRequestOptions): void {
        _.defaults(opts, {
            resourceType: RESOURCE_ENERGY,
        });
        if (opts.amount == undefined) {
            opts.amount = this.getOutputAmount(target, opts.resourceType!);
        }

        const req: TransportRequest = {
            target: target,
            resourceType: opts.resourceType!,
            amount: opts.amount!
        };
        if(opts.amount > 0) {
            this.withdraw[priority].push(req);
            if(!this.withdrawById[target.id]) this.withdrawById[target.id] = [];
            this.withdrawById[target.id].push(req)
        }
    }

    /**
    * Summarize the state of the transport request group to the console; useful for debugging.
    */
    summarize(ignoreEnergy = false): void {
        console.log(`Supply requests ==========================`);
        for (const priority in this.supply) {
            if (this.supply[priority].length > 0) {
                console.log(`Priority: ${priority}`);
            }
            for (const request of this.supply[priority]) {
                if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
                console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
                    `resourceType: ${request.resourceType}`);
            }
        }
        console.log(`Withdraw requests ========================`);
        for (const priority in this.withdraw) {
            if (this.withdraw[priority].length > 0) {
                console.log(`Priority: ${priority}`);
            }
            for (const request of this.withdraw[priority]) {
                if (ignoreEnergy && request.resourceType == RESOURCE_ENERGY) continue;
                console.log(`    targetID: ${request.target.ref}  amount: ${request.amount}  ` +
                    `resourceType: ${request.resourceType}`);
            }
        }
    }
}
