export const accountViews = [
	{ id: "dashboard", label: "Account dashboard", file: "account.txt", description: "Your identity and workspace. One mission file for each workflow." },
	{ id: "personal", label: "Personal profiles", file: "personal-profiles.txt", description: "Create and edit private mod metadata. Publication is always a separate action." },
	{ id: "community", label: "Community profiles", file: "community-profiles.txt", description: "Browse shared profiles and make independent personal copies." },
	{ id: "submissions", label: "Private submissions", file: "private-submissions.txt", description: "Reserve a JAR release, send its bytes and follow backend validation. Nothing here is public." },
] as const;

export type AccountView = typeof accountViews[number]["id"];
