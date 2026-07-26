<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { Tween } from 'svelte/motion';

	import { createInterruptible } from 'utils-shared/interruptible';

	type Props = {
		amount: number;
		duration: number;
		/**
		 * Optional count curve. Defaults to Svelte's linear easing — games that already ship a
		 * linear count-up must not change behaviour, so never give this a default here.
		 */
		easing?: (t: number) => number;
		/**
		 * Optional restart trigger. Games that remount this provider per win (the `{#key}` pattern)
		 * leave it undefined and keep calling `startCountUp` themselves, e.g. from `<OnMount>`.
		 * Games that keep the provider mounted across wins pass a value that changes once per win:
		 * the count-up then resets (amount back to 0, `countUpCompleted` back to false) and starts
		 * again on its own, no remount needed.
		 */
		restartKey?: unknown;
		oncomplete: () => void;
		children: Snippet<
			[
				{
					countUpAmount: number;
					startCountUp: () => Promise<void>;
					finishCountUp: () => void;
					countUpCompleted: boolean;
				},
			]
		>;
	};

	const props: Props = $props();
	const countUpAmount = new Tween(0);
	const interruptible = createInterruptible();

	let countUpCompleted = $state(false);

	const countUp = () =>
		countUpAmount.set(props.amount, { duration: props.duration, easing: props.easing });
	const resetCountUp = () => countUpAmount.set(props.amount, { duration: 0 });
	const finishCountUp = () => interruptible.interrupt();
	const startCountUp = async () => {
		await interruptible.add(countUp);
		resetCountUp();
		countUpCompleted = true;
		props.oncomplete();
		interruptible.clear();
	};

	// Opt-in only: untouched for every game that does not pass `restartKey`.
	$effect(() => {
		if (props.restartKey === undefined) return;
		// Only `restartKey` should re-trigger this — `amount`/`duration` are read by the count-up
		// itself and would otherwise restart it mid-flight (e.g. when turbo is toggled).
		untrack(() => {
			interruptible.clear();
			countUpCompleted = false;
			countUpAmount.set(0, { duration: 0 });
			startCountUp();
		});
	});
</script>

{@render props.children({
	countUpAmount: countUpAmount.current,
	startCountUp,
	finishCountUp,
	countUpCompleted,
})}
