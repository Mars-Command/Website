import { ClipboardList } from "lucide-react";
import { marsConfig } from "../config/mars";
import { TerminalBox, TerminalText } from "./TerminalExperience";

const installSteps = [
	"Download the Mars Command Launcher",
	"Install or open the launcher",
	"Press the 'Setup' button",
	"Let the client synchronise the required Mars files",
	`Launch Mars and connect to ${marsConfig.serverAddress}`,
];

export function InstallGuide({ terminal = false }: { terminal?: boolean }) {
	const Container = terminal ? TerminalBox : "section";
	const text = (value: string) =>
		terminal ? <TerminalText>{value}</TerminalText> : value;
	const headingId = terminal
		? "deployment-guide-heading"
		: "guide-heading";
	return (
		<Container
			className={`panel guide-panel${terminal ? " guide-panel--full" : ""}`}
			id={terminal ? "deployment-guide" : "install-guide"}
			aria-labelledby={headingId}
		>
			<div className="panel-heading">
				<div>
					<p className="eyebrow">
						{text("QUICK START")}
					</p>
					<h2 id={headingId}>
						{text("HOW TO JOIN")}
					</h2>
				</div>
				<ClipboardList
					size={18}
					className="heading-icon"
					aria-hidden="true"
				/>
			</div>
			<ol className="install-steps">
				{installSteps.map((step, index) => (
					<li key={step}>
						<span>
							{text(
								String(
									index +
										1,
								).padStart(
									2,
									"0",
								),
							)}
						</span>
						<p>{text(step)}</p>
					</li>
				))}
			</ol>
			<p className="guide-note">
				{text(
					"The launcher manages the Mars client files. Do not manually edit managed mods or configuration files unless instructed by Mars Command.",
				)}
			</p>
		</Container>
	);
}
