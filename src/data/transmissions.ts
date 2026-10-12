export type Transmission = {
	severity: "warning" | "info" | "success";
	title: string;
	body: string;
};

export const transmissions: Transmission[] = [
	{
		severity: "success",
		title: "Interactive mission files added",
		body: "Directory selections now run clear and cat before typing a detailed view. New selections replace unfinished transitions instead of queuing stale output.",
	},
	{
		severity: "success",
		title: "Full-page terminal interface rebuilt",
		body: "The site now uses a monochrome Bash-inspired layout with Mars-red accents, a 1.5-second planet fade, and top-to-bottom typing. Desktop-window chrome has been removed.",
	},
	{
		severity: "info",
		title: "Panels now reveal with their content",
		body: "Panel borders draw in when the typing sequence reaches them. Deployment actions, client specifications, and transmission groups stay hidden until their turn.",
	},
	{
		severity: "info",
		title: "Mobile mission menu and motion controls improved",
		body: "A header menu now opens every mission file on small screens. Skip controls finish the current animation, and reduced-motion preferences remove animated delays.",
	},
	{
		severity: "success",
		title: "Account workspace split into mission files",
		body: "A compact dashboard now leads to dedicated personal-profile, community-profile and private-submission views. Profile drafts and selected JARs survive view switches; desktop authorization still requires explicit identity confirmation.",
	},
	{
		severity: "success",
		title: "Private JAR submission workflows added",
		body: "Signed-in users can reserve and upload private JAR releases, refresh backend validation status, retry eligible blocked work, and withdraw submissions. Uploads do not create public downloads.",
	},
];
