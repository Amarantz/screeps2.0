// Type guards library: this allows for instanceof - like behavior for much lower CPU cost. Each type guard
// differentiates an ambiguous input by recognizing one or more unique properties.

import {AnyBot} from '../bot/AnyBot';
import { Bot } from '../bot/Bot';
import { PowerBot } from 'bot/PowerBot';
import { CombatBot } from 'bot/CombatBot';
import { NeuralBot } from 'bot/NeuralBot';

// export interface EnergyStructure extends Structure {
// 	energy: number;
// 	energyCapacity: number;
// }

// export interface StoreStructure extends Structure {
// 	store: StoreDefinition;
// 	storeCapacity: number;
// }

// export function isEnergyStructure(obj: RoomObject): obj is EnergyStructure {
// 	return (<EnergyStructure>obj).energy != undefined && (<EnergyStructure>obj).energyCapacity != undefined;
// }
//
// export function isStoreStructure(obj: RoomObject): obj is StoreStructure {
// 	return (<StoreStructure>obj).store != undefined && (<StoreStructure>obj).storeCapacity != undefined;
// }

export function isStructure(obj: RoomObject): obj is Structure {
	return (<Structure>obj).structureType != undefined;
}

export function isOwnedStructure(structure: Structure): structure is OwnedStructure {
	return (<OwnedStructure>structure).owner != undefined;
}

export function isSource(obj: Source | Mineral): obj is Source {
	return (<Source>obj).energy != undefined;
}

export function isTombstone(obj: RoomObject): obj is Tombstone {
	return (<Tombstone>obj).deathTime != undefined;
}

export function isRuin(obj: RoomObject): obj is Ruin {
	return (<Ruin>obj).destroyTime != undefined;
}

export function isResource(obj: RoomObject): obj is Resource {
	return (<Resource>obj).amount != undefined;
}

export function hasPos(obj: HasPos | RoomPosition): obj is HasPos {
	return (<HasPos>obj).pos != undefined;
}

export function isCreep(obj: RoomObject): obj is Creep {
	return (<Creep>obj).fatigue != undefined;
}

export function isPowerCreep(obj: RoomObject): obj is PowerCreep {
	return (<PowerCreep>obj).powers != undefined;
}

export function isAnyBot(thing: any): thing is AnyBot {
	return (<AnyBot>thing).isAnyBot || false;
}

export function isStandardBot(creep: AnyCreep | AnyBot): creep is Bot {
	return (<Bot>creep).isStandardBot || false;
}

export function isPowerBot(creep: AnyCreep | AnyBot): creep is PowerBot {
	return (<PowerBot>creep).isPowerBot || false;
}

export function isCombatBot(bot: AnyCreep | AnyBot): bot is CombatBot {
	return (<CombatBot>bot).isCombatBot || false;
}

export function isNeuralBot(bot: AnyCreep | AnyBot): bot is NeuralBot {
	return (<NeuralBot>bot).isNeuralBot || false;
}
