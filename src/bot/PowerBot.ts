import { AnyBot } from "./AnyBot";
import { profile } from "profiler";

@profile
export class PowerBot extends AnyBot {
    isPowerBot: true;

    constructor(powerCreep: PowerCreep, notifyWHenAttacked = true){
        super(powerCreep, notifyWHenAttacked);
    }
}
