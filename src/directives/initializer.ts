import { DirectiveHarvest } from "./resource/harvest";
import { Directive } from "./directive";
import { DirectiveOutpost } from "./colony/outpost";
import { DirectiveOutpostSK } from "./colony/outpostSK";

/**
 * This is the initializer for directives, which maps flags by their color code to the corresponding directive
 */
export function DirectiveWrapper(flag: Flag): Directive | undefined {

    switch (flag.color) {
        case COLOR_YELLOW:
            switch(flag.secondaryColor) {
                case COLOR_YELLOW:
                    return new DirectiveHarvest(flag);
            }
            break;
    }

    switch (flag.color) {
        case COLOR_PURPLE:
            switch(flag.secondaryColor) {
                case COLOR_PURPLE:
                    return new DirectiveOutpost(flag);
                case COLOR_YELLOW:
                    return new DirectiveOutpostSK(flag);
            }
    }

    return;
}
