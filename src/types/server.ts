export type ServerStatus = {
	online: boolean;
	host: string;
	port: number;
	playersOnline: number | null;
	playersMax: number | null;
	latencyMs: number | null;
	motd: string | null;
	versionName: string | null;
	checkedAt: string;
	error: string | null;
};

export type StatusPhase = "checking" | "ready";
