import { DirectiveHarvest } from "./resource/harvest";
import { Directive } from "./directive";
import { DirectiveOutpost } from "./colony/outpost";
import { DirectiveOutpostSK } from "./colony/outpostSK";
import { DirectiveBootstrap } from "./situational/bootstrap";
import { DirectiveDismantle } from "./targeting/dismantle";
import { DirectiveClearRoom } from "./colony/clearRoom";
import { DirectiveMineral } from "./resource/mineral";

/**
 * This is the initializer for directives, which maps flags by their color code to the corresponding directive
 */
export function DirectiveWrapper(flag: Flag): Directive | undefined {

    switch (flag.color) {
        case COLOR_YELLOW:
            switch(flag.secondaryColor) {
                case COLOR_YELLOW:
                    return new DirectiveHarvest(flag);
                case COLOR_CYAN:
                    return new DirectiveMineral(flag);
            }
            break;
        case COLOR_PURPLE:
            switch(flag.secondaryColor) {
                case COLOR_PURPLE:
                    return new DirectiveOutpost(flag);
                case COLOR_YELLOW:
                    return new DirectiveOutpostSK(flag);
                case COLOR_ORANGE:
                    return new DirectiveClearRoom(flag);
            }
            break;
        case COLOR_ORANGE:
            switch(flag.secondaryColor) {
                case COLOR_ORANGE:
                    return new DirectiveBootstrap(flag);
            }
            break;
        case COLOR_GREY:
            switch(flag.secondaryColor) {
                case COLOR_GREY:
                    return new DirectiveDismantle(flag);
            }
            break;
    }

    return;
}
