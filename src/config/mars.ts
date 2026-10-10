const configuredLauncherUrl =
	import.meta.env.VITE_LAUNCHER_DOWNLOAD_URL?.trim() ??
	`${import.meta.env.BASE_URL}setup.exe`;

function isSafeDownloadUrl(value: string): boolean {
	if (/^(?:\/(?!\/)|\.\/)/.test(value)) {
		return true;
	}
	try {
		const url = new URL(value);
		return url.protocol === "https:" || url.protocol === "http:";
	} catch {
		return false;
	}
}

export const marsConfig = {
	serverAddress:
		import.meta.env.VITE_SERVER_ADDRESS?.trim() ||
		"play.nexusgit.info",
	voiceAddress:
		import.meta.env.VITE_VOICE_ADDRESS?.trim() ||
		"voice.nexusgit.info",
	minecraftVersion: "1.21.1",
	loader: "NeoForge",
	serverName: "Mars",
	clientVersion: import.meta.env.VITE_CLIENT_VERSION?.trim() || "1.4.0",
	statusApiUrl: "https://api.mcstatus.io/v2/status/java",
	launcherDownloadUrl: isSafeDownloadUrl(configuredLauncherUrl)
		? configuredLauncherUrl
		: null,
	useMockStatus:
		import.meta.env.DEV &&
		import.meta.env.VITE_USE_MOCK_STATUS === "true",
} as const;
