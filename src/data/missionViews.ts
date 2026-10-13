export const missionViews = [
	{ id: "overview", label: "Overview", file: "overview.txt" },
	{ id: "uplink", label: "Server uplink", file: "server-uplink.txt" },
	{ id: "deployment", label: "Deployment", file: "deployment.txt" },
	{
		id: "transmissions",
		label: "Transmissions",
		file: "transmissions.log",
	},
	{
		id: "account",
		label: "Account & profiles",
		file: "account-and-profiles.txt",
	},
] as const;

export type MissionView = (typeof missionViews)[number]["id"];
