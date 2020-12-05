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

export class CreepSetup {
    bodySetup: any;
    role: string;
    constructor(role: string, bodySetup = {}){
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

    getBodyPotential(partType: BodyPartConstant, energyCapacity: number ): number {
        let body = this.generateBody(energyCapacity)
        return _.filter(body, (part: BodyPartConstant) => part == partType).length;
    }
}
