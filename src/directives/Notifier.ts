import { profile } from "../profiler";
import { printRoomName } from '../utils/utils';

export enum NotifierPriority {
    Critical,
    High,
    Normal,
    LOW,
};

interface Alert {
    message: string;
    priority: number;
    roomName?: string;
}

interface Notification {
    message: string;
    roomName: string;
    duration: number;
}

interface NotifierMemory {
    notifications: Notification[];
}

@profile
export class Notifier implements INotifier {
    memory: NotifierMemory;
    alerts: Alert[];
    notifications: Notification[];
    constructor() {
        this.alerts = [];
        this.notifications = [];
    }

    clear() {
        this.alerts = [];
    }

    alert(message: string, roomName: string, priority = NotifierPriority.Normal): void {
        const alert: Alert = { message, roomName, priority};
        this.alerts = [...this.alerts, alert];
    }

    notify(message:string, roomName: string, duration = 100, email =false) {
        console.log(`${printRoomName(roomName)}:${message}`)
    }

    generateNotificationsList(links: boolean): string[] {
        throw new Error("Method not implemented.");
    }

}
