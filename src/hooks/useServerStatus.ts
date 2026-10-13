import { useEffect, useRef, useState } from "react";
import { serverStatusProvider } from "../services/serverStatus";
import type { ServerStatus } from "../types/server";
import { useProcessSound } from "./useProcessSound";
import type { SoundProcess } from "../services/siteAudio";

const REFRESH_INTERVAL_MS = 15_000;

export function useServerStatus() {
	const [status, setStatus] = useState<ServerStatus | null>(null);
	const [isChecking, setIsChecking] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<string | null>(null);
	const refreshRef = useRef<(process?: SoundProcess | null) => Promise<void>>(async () => undefined);
	const requestInFlightRef = useRef<Promise<ServerStatus> | null>(null);
	const processSound = useProcessSound();

	useEffect(() => {
		let active = true;

		const refresh = async (process?: SoundProcess | null) => {
			setIsChecking(true);
			const request =
				requestInFlightRef.current ??
				serverStatusProvider.getStatus();
			requestInFlightRef.current = request;

			try {
				const nextStatus = await request;
				if (active) {
					setStatus(nextStatus);
					setLastUpdated(nextStatus.checkedAt);
					process?.finish(nextStatus.error ? "error" : "success");
				}
			} finally {
				process?.stop();
				if (requestInFlightRef.current === request)
					requestInFlightRef.current = null;
				if (active) setIsChecking(false);
			}
		};

		refreshRef.current = refresh;
		void refresh();

		const interval = window.setInterval(
			() => void refresh(),
			REFRESH_INTERVAL_MS,
		);
		return () => {
			active = false;
			window.clearInterval(interval);
		};
	}, []);

	return {
		status,
		isChecking,
		lastUpdated,
		refresh: () => {
			if (requestInFlightRef.current) return;
			const process = processSound.start("loading");
			void refreshRef.current(process);
		},
	};
}
