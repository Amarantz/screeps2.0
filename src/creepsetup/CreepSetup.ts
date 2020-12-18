import { Brain } from "Brian";
import { BoostType } from "resources/map_resoures";

export const bodyCost = (bodyparts: BodyPartConstant[]): number => (
    _.sum(bodyparts, part => BODYPART_COST[part])
);

export const patternCost = (setup: CreepSetup) => (
    bodyCost(setup.bodySetup.pattern)
)

export interface BodySetup {
    pattern: BodyPartConstant[],
    sizeLimit: number;
    prefix: BodyPartConstant[],
    sufix: BodyPartConstant[],
    proportionalPrefixSuffix: boolean;
    ordered: boolean;
}

export interface BodyGeneratorReturn {
	body: BodyPartConstant[];
	boosts: ResourceConstant[];
}

export class CreepSetup {
    bodySetup: any;
    role: string;
    private boosts: BoostType[];
    private cache: { [colonyName: string]: { result: BodyGeneratorReturn, expiration: number } };
    constructor(role: string, bodySetup = {}, boosts?: BoostType[]){
        this.role = role;
        _.defaults(bodySetup, {
            pattern: [],
            sizeLimit: Infinity,
            prefix: [],
            sufix: [],
            proportionalPrefixSuffix: false,
            orderer: true,
        });
        this.bodySetup = bodySetup as BodySetup;
        this.boosts = boosts || [];
		this.cache = {};
    }

    generateBody(availableEnergey: number): BodyPartConstant[] {
        let patternCost, patternLength, numRepeat: number;
        const { prefix = [], suffix = [], pattern = [], sizeLimit, proportionalPrefixSuffix, ordered = true } = this.bodySetup;
        let body: BodyPartConstant[] = [];

        if (proportionalPrefixSuffix) {
            patternCost = bodyCost(prefix) + bodyCost(pattern) + bodyCost(suffix);
            patternLength = prefix.length + pattern.length + suffix.length;
            const energyLimit = Math.floor(availableEnergey / patternCost);
            const maxPartLimit = Math.floor(MAX_CREEP_SIZE / patternLength);
            numRepeat = Math.min(energyLimit, maxPartLimit, sizeLimit);
        } else {
            const extraCost = bodyCost(prefix) + bodyCost(suffix);
            patternCost = bodyCost(pattern);
            patternLength = pattern.length;
            const energyLimit = Math.floor((availableEnergey - extraCost) / patternCost);
            const maxPartLimit = Math.floor((MAX_CREEP_SIZE - prefix.length - suffix.length) / patternLength);
            numRepeat = Math.min(energyLimit, maxPartLimit, sizeLimit);
        }

        if (proportionalPrefixSuffix) {
            for(let i = 0; i < numRepeat; i++) {
                body = [...body, ...prefix];
            }
        } else {
            body = [...body, ...prefix];
        }

        if (ordered) {
            for( const part of pattern) {
                for(let i = 0; i < numRepeat; i++) {
                    body = [...body, part];
                }
            }
        } else {
            for(let i = 0; i < numRepeat; i++) {
                body = [...body, ...pattern];
            }
        }

        if (proportionalPrefixSuffix) {
            for(let i = 0; i < numRepeat; i++) {
                body = [...body, ...suffix];
            }
        } else {
            body = [...body, ...suffix];
        }
        return body;
    }

    generateMaxedBody() {
		// TODO hardcoded for our current cap with extensions missing
		return this.generateBody(11100);
	}


    getBodyPotential(partType: BodyPartConstant, energyCapacity: number ): number {
        let body = this.generateBody(energyCapacity)
        return _.filter(body, (part: BodyPartConstant) => part == partType).length;
    }

    	/**
	 * Generate the body and best boosts for a requested creep
	 */
	create(brain: Brain, useCache = false): BodyGeneratorReturn {
		// If you're allowed to use a cached result (e.g. for estimating wait times), return that
		if (useCache && this.cache[brain.name] && Game.time < this.cache[brain.name].expiration) {
			return this.cache[brain.name].result;
		}

		// Otherwise recompute
		const body = this.generateBody(brain.room.energyCapacityAvailable);
		const bodyCounts = _.countBy(body);

		const boosts: ResourceConstant[] = [];

		const result = {
			body  : body,
			boosts: boosts,
		};
		this.cache[brain.name] = {
			result    : result,
			expiration: Game.time + 20,
		};

		return result;
	}
}
