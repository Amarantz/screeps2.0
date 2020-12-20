import { getUsername, onPublicServer } from "./utils/utils";

const settings = {
USE_PROFILER: true,
  BIG_BRAIN_INTERVAL: 20,
  MY_USERNAME: getUsername(),
  SIGNATURE: "🐻-BRAIN"
};

export default settings;

export const SUPPRESS_INVALID_DIRECTIVE_ALERTS: boolean = false;
export const USE_SCREEPS_PROFILER = false;
export const PROFILER_COLONY_LIMIT = 10;
export const USE_TRY_CATCH = true;
export const MAX_OWNED_ROOMS = Infinity;
export const SHARD3_MAX_OWNED_ROOMS = 3;
global.__DEFAULT_BIGBRAIN_SIGNAGUER__ = settings.SIGNATURE;

/**
 * The amount of credits that Overmind will try to keep in the bank. Default:
 * Private servers: 1,000 (will spend aggressively)
 * Public servers: 100,000 if you are below RCL 10, otherwise 1,000,000.
 */
export const RESERVE_CREDITS = onPublicServer() ? (Game.gcl.level >= 10 ? 1e6 : 1e5) : 1000;
