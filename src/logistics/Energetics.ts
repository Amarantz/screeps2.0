import { brainStage, Brain } from "Brian"
import { PROFILER_COLONY_LIMIT } from "settings"

export class Energetics {
    static settings = {
        storage: {
            total: {
                cap: STORAGE_CAPACITY - 100000,
                tolerance: 5000,
            },
            energy: {
                destroyTerminalThreshold: 2000000,
            }
        },
        terminal: {
            total: {
                cap: TERMINAL_CAPACITY - 50000
            },
            energy: {
                sendSize: 25000,
                inThreshold: 25000,
                outThreshold: 100000,
                equilibrium: 50000,
                tolerance: 5000,
                tradeAmount: 10000,
            }
        }
    }

    static lowPowerMode(brain: Brain): boolean {
        if(brain.stage === brainStage.Adult) {
            //@ts-ignore
            if(_.sum(brain.storage!.store) > this.settings.storage.total.cap &&
                //@ts-ignore
                brain.terminal && _.sum(brain.terminal.store) > this.settings.terminal.total.cap
            ) {
                return true;
            }
        }
        return false;
    }
}
