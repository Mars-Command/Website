const pulseTimers = new WeakMap<HTMLElement, number>();

export function pulseTarget(targetId: string): void {
	const target = document.getElementById(targetId);
	if (!target) return;

	const previousTimer = pulseTimers.get(target);
	if (previousTimer) window.clearTimeout(previousTimer);

	target.classList.remove("pulse-target");
	void target.offsetWidth;
	target.classList.add("pulse-target");

	const timer = window.setTimeout(() => {
		target.classList.remove("pulse-target");
		pulseTimers.delete(target);
	}, 1100);
	pulseTimers.set(target, timer);
}
