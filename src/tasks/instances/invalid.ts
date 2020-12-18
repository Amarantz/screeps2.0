import {profile} from '../../profiler';
import {Task} from '../Task';

const invalidTarget = {
	ref: '',
	pos: {
		x       : 25,
		y       : 25,
		roomName: 'W6N1',
	}
};

@profile
export class TaskInvalid extends Task {
	target: any;

	constructor() {
		super('INVALID', invalidTarget);

	}

	isValidTask() {
		return false;
	}

	isValidTarget() {
		return false;
	}

	work() {
		return OK;
	}
}
