/* eslint-disable @typescript-eslint/no-for-in-array */
export function onPublicServer(): boolean {
  return Game.shard.name.includes("shard");
}

/**
 * Return whether the IVM is enabled
 */
export function isIVM(): boolean {
  return typeof Game.cpu.getHeapStatistics === "function";
}

/**
 * Generate a randomly-offset cache expiration time
 */
export function getCacheExpiration(timeout: number, offset = 5): number {
  return Game.time + timeout + Math.round(Math.random() * offset * 2 - offset);
}

const hexChars = "0123456789abcdef";

/**
 * Generate a random hex string of specified length
 */
export function randomHex(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return result;
}

/**
 * Obtain the username of the player
 */
export function getUsername(): string {
  for (const i in Game.rooms) {
    const room = Game.rooms[i];
    if (room && room.controller && room.controller.my && room.controller.owner) {
      return room.controller.owner.username;
    }
  }
  for (const i in Game.creeps) {
    const creep = Game.creeps[i];
    if (creep.owner) {
      return creep.owner.username;
    }
  }
  console.log("ERROR: Could not determine username. You can set this manually in src/settings/settings_user");
  return "ERROR: Could not determine username.";
}

/**
 * Correct generalization of the modulo operator to negative numbers
 */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Equivalent to lodash.minBy() method
 */
export function minBy<T>(objects: T[], iteratee: (obj: T) => number | false): T | undefined {
  let minObj: T | undefined;
  let minVal = Infinity;
  let val: number | false;
  for (const i in objects) {
    val = iteratee(objects[i]);
    if (val !== false && val < minVal) {
      minVal = val;
      minObj = objects[i];
    }
  }
  return minObj;
}

/**
 * Equivalent to lodash.maxBy() method
 */
export function maxBy<T>(objects: T[], iteratee: (obj: T) => number | false): T | undefined {
  let maxObj: T | undefined;
  let maxVal = -Infinity;
  let val: number | false;
  for (const i in objects) {
    val = iteratee(objects[i]);
    if (val !== false && val > maxVal) {
      maxVal = val;
      maxObj = objects[i];
    }
  }
  return maxObj;
}
