import { useCallback, useLayoutEffect, useRef } from "react";
import { siteAudio } from "../services/siteAudio";
import type { LoopCue, SoundProcess } from "../services/siteAudio";

export function useProcessSound(visible = true) {
	const current = useRef<SoundProcess | null>(null);
	const active = useRef(visible);
	const stop = useCallback(() => {
		current.current?.stop();
		current.current = null;
	}, []);
	useLayoutEffect(() => {
		active.current = visible;
		if (!visible) stop();
		return () => {
			active.current = false;
			stop();
		};
	}, [visible, stop]);
	const start = useCallback((cue: LoopCue = "processing") => {
		if (!active.current) return null;
		if (!current.current) {
			current.current = siteAudio.startProcessFromGesture(
				cue,
				() => {
					current.current = null;
				},
			);
		}
		return current.current;
	}, []);
	return { start, stop };
}
