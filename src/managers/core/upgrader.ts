import { Manager } from "managers/Manager";
import { ManagerPriority } from "priorities/priorities_managers";
import { Roles, Setups } from "creepSetup/setup";
import { Bot } from "bot/Bot";
import { Tasks } from "tasks/Tasks";
import { UpgradeSite } from "components/upgradeSite";
import { log } from "console/log";

export class UpgradingManager extends Manager {
    upgradeSite: any;
    upgraders: Bot[];
    settings: {[property: string]: number;}
    room: Room;

    constructor(upgradeSite: UpgradeSite, priority = ManagerPriority.upgrading.upgrade){
        super(upgradeSite, 'upgrade', priority);
        this.upgradeSite = upgradeSite;
        this.upgraders = this.bots(Roles.upgrader);
    }
    init(): void {
        if(this.brain.level < 3) {
            return;
        }

        if(this.brain.assets.energy > UpgradeSite.settings.energyBuffer || this.upgradeSite.controller.ticksToDowngrade < 500) {
            log.debug(`attempting to init upgradeManger ${this.print}`);
            let setup = Setups.upgrader.default;
            if(this.brain.level == 8) {
                setup = Setups.upgrader.rcl8;;
                if(this.brain.labs.length == 10 && this.brain.assets[RESOURCE_CATALYZED_GHODIUM_ACID] >= 4 * LAB_BOOST_MINERAL) {
                    // setup = Setups.upgrader.rcl8_boosted;
                }
            }

            if(this.brain.level == 8) {
                this.wishlist(1, setup);
            } else {
                const upgradePowerEach = setup.getBodyPotential(WORK, this.brain);
                const upgradersNeeded = Math.ceil(this.upgradeSite.upgradePowerNeeded / upgradePowerEach);
                this.wishlist(upgradersNeeded, setup);
            }
        }


    }
    run(): void {
        this.autoRun(this.upgraders, upgrader => this.handleUpgrader(upgrader));
    }
    handleUpgrader(upgrader: Bot): void {
        if(upgrader.carry.energy > 0) {
            if(this.upgradeSite.link && this.upgradeSite.link.hits < this.upgradeSite.link.hitsMax) {
                upgrader.task = Tasks.repair(this.upgradeSite.link);
                return;
            }

            if(this.upgradeSite.battery && this.upgradeSite.battery.hits < this.upgradeSite.battery.hitsMax) {
                upgrader.task = Tasks.repair(this.upgradeSite.battery);
                return;
            }

            const inputSite = this.upgradeSite.findInputConstructionSite();
            if(inputSite) {
                upgrader.task = Tasks.build(inputSite);
                return;
            }

            if(!this.upgradeSite.controller.signedByMe && !this.upgradeSite.controller.signedByScreeps) {
                upgrader.task = Tasks.signController(this.upgradeSite.controller);
                return;
            }
            upgrader.task = Tasks.upgrade(this.upgradeSite.controller);
        } else {
            if(this.upgradeSite.link && this.upgradeSite.link.energy > 0) {
                upgrader.task = Tasks.withdraw(this.upgradeSite.link);
            } else if (this.upgradeSite.battery && this.upgradeSite.battery.energy > 0) {
                upgrader.task = Tasks.withdraw(this.upgradeSite.battery);
            } else {
                if(this.upgradeSite.battery && this.upgradeSite.battery.targetedBy.length == 0) {
                    upgrader.task = Tasks.recharge();
                }
            }
        }
    }

}
