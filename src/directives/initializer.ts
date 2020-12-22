import { DirectiveHarvest } from "./resource/harvest";
import { Directive } from "./directive";
import { DirectiveOutpost } from "./colony/outpost";
import { DirectiveOutpostSK } from "./colony/outpostSK";
import { DirectiveBootstrap } from "./situational/bootstrap";
import { DirectiveDismantle } from "./targeting/dismantle";
import { DirectiveClearRoom } from "./colony/clearRoom";
import { DirectiveMineral } from "./resource/mineral";
import { DirectiveOutpostDefence } from "./defense/outpostDefence";
import { DirectiveTargetSiege } from "./targeting/seigeTarget";
import { DirectiveHaul } from "./resource/haul";
import { DirectiveGuard } from "./defense/guard";
import { DirectiveModularDismantle } from "./targeting/modualarDismantle";

/**
 * This is the initializer for directives, which maps flags by their color code to the corresponding directive
 */
export function DirectiveWrapper(flag: Flag): Directive | undefined {

    switch (flag.color) {
        case COLOR_YELLOW:
            switch (flag.secondaryColor) {
                case COLOR_YELLOW:
                    return new DirectiveHarvest(flag);
                case COLOR_CYAN:
                    return new DirectiveMineral(flag);
                case COLOR_BLUE:
                    return new DirectiveHaul(flag);
            }
            break;
        case COLOR_PURPLE:
            switch (flag.secondaryColor) {
                case COLOR_PURPLE:
                    return new DirectiveOutpost(flag);
                case COLOR_YELLOW:
                    return new DirectiveOutpostSK(flag);
                case COLOR_ORANGE:
                    return new DirectiveClearRoom(flag);
            }
            break;
        case COLOR_ORANGE:
            switch (flag.secondaryColor) {
                case COLOR_ORANGE:
                    return new DirectiveBootstrap(flag);
            }
            break;
        case COLOR_GREY:
            switch (flag.secondaryColor) {
                case COLOR_GREY:
                    return new DirectiveDismantle(flag);
                case COLOR_ORANGE:
                    return new DirectiveTargetSiege(flag);
                case COLOR_CYAN:
                    return new DirectiveModularDismantle(flag);
            }
        case COLOR_BLUE: {
            switch (flag.secondaryColor) {
                case COLOR_RED:
                    return new DirectiveOutpostDefence(flag)
                case COLOR_BLUE:
                    return new DirectiveGuard(flag);
            }
        }
    }

    return;
}
