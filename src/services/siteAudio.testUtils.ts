import { vi } from "vitest";
import { siteAudio } from "./siteAudio";
import type { SoundProcess } from "./siteAudio";

export function recordProcessSounds() {
	const processes: SoundProcess[] = [];
	vi.spyOn(siteAudio, "playOutcome").mockReturnValue(null);
	vi.spyOn(siteAudio, "playFromGesture").mockReturnValue(null);
	vi.spyOn(siteAudio, "startProcessFromGesture").mockImplementation(
		(_cue, onStop) => {
			let active = true;
			const process: SoundProcess = {
				get active() {
					return active;
				},
				stop: vi.fn(() => {
					if (!active) return;
					active = false;
					onStop();
				}),
				finish: vi.fn((cue) => {
					const notify = active;
					process.stop();
					if (notify) siteAudio.playOutcome(cue);
				}),
			};
			processes.push(process);
			return process;
		},
	);
	const stop = () => {
		processes.forEach((process) => process.stop());
	};
	vi.spyOn(siteAudio, "stopAll").mockImplementation(stop);
	vi.spyOn(siteAudio, "stopLoops").mockImplementation(stop);
	return processes;
}
