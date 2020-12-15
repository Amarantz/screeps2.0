import { Task } from "./Task";
import { log } from "console/log";
import { TaskInvalid } from "./instances.invalid";

export function initializeTask(protoTask: ProtoTask): Task {
	// Retrieve name and target data from the ProtoTask
	const taskName = protoTask.name;
	const target = deref(protoTask._target.ref);
	let task: any;
	// Create a task object of the correct type
    switch (taskName) {
        default:
			log.error(`Invalid task name: ${taskName}! task.creep: ${protoTask._creep.name}. Deleting from memory!`);
			task = new TaskInvalid();
			break;
    }
    	// Modify the task object to reflect any changed properties
	task.proto = protoTask;
	// Return it
	return task;
}
