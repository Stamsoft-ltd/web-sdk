export const createInterruptible = () => {
	type ResolveArgs = { interrupted: boolean };
	type Resolve = (args: ResolveArgs) => void;

	let resolveList: Resolve[] = [];
	// Pending interrupt: set when interrupt() fires before any add() is queued.
	// The next add() immediately resolves as interrupted instead of running the action.
	let pendingInterrupt = false;

	const add = (targetToWait: () => Promise<any>) =>
		new Promise<ResolveArgs>(async (resolve) => {
			if (pendingInterrupt) {
				resolve({ interrupted: true });
				return;
			}
			resolveList.push(resolve);
			await targetToWait();
			resolve({ interrupted: false });
		});

	const clear = () => {
		resolveList = [];
		pendingInterrupt = false;
	};
	const getLength = () => resolveList.length;
	const interrupt = () => {
		pendingInterrupt = true;
		resolveList.forEach((resolve) => resolve({ interrupted: true }));
	};

	return {
		add,
		clear,
		getLength,
		interrupt,
	};
};
