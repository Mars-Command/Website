import { marsConfig } from "../config/mars";
import type { ServerStatus } from "../types/server";
import { TerminalBox, TerminalText } from "./TerminalExperience";

type ServerTelemetryProps = {
	status: ServerStatus | null;
	checking: boolean;
	lastUpdated: string | null;
	terminal?: boolean;
};

function displayCount(value: number | null | undefined): string {
	return value === null || value === undefined ? "—" : String(value);
}

function displayTime(value: string | null): string {
	if (!value || Number.isNaN(Date.parse(value))) return "AWAITING CHECK";
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(value));
}

export function ServerTelemetry({
	status,
	checking,
	lastUpdated,
	terminal = false,
}: ServerTelemetryProps) {
	const headingId = terminal
		? "uplink-telemetry-heading"
		: "telemetry-heading";
	const Container = terminal ? TerminalBox : "section";
	const text = (value: string) =>
		terminal ? <TerminalText>{value}</TerminalText> : value;
	const rows = [
		["HOST", status?.host || marsConfig.serverAddress],
		["MINECRAFT", marsConfig.minecraftVersion],
		["LOADER", marsConfig.loader.toUpperCase()],
		["VOICE", marsConfig.voiceAddress],
		[
			"STATUS",
			checking
				? "CHECKING"
				: status?.online
					? "ONLINE"
					: "OFFLINE",
		],
		[
			"PERSONNEL",
			status?.playersOnline == null
				? "—"
				: `${displayCount(status.playersOnline)} / ${displayCount(status.playersMax)}`,
		],
		[
			"LATENCY",
			status?.latencyMs == null
				? "—"
				: `${Math.round(status.latencyMs)} ms`,
		],
		["LAST CHECK", displayTime(lastUpdated)],
	] as const;

	return (
		<Container
			className={`panel telemetry-panel${terminal ? " telemetry-panel--full" : ""}`}
			aria-labelledby={headingId}
		>
			<div className="panel-heading">
				<div>
					<p className="eyebrow">
						{text("CONNECTION DETAILS")}
					</p>
					<h2 id={headingId}>
						{text("SERVER TELEMETRY")}
					</h2>
				</div>
				<span className="telemetry-mark">SYS</span>
			</div>
			<dl className="telemetry-list">
				{rows.map(([label, value]) => (
					<div
						className={`telemetry-row ${label === "STATUS" ? `telemetry-row--${value.toLowerCase()}` : ""}`}
						key={label}
					>
						<dt>{text(label)}</dt>
						<dd>
							<span className="telemetry-separator">
								::
							</span>
							{text(value)}
						</dd>
					</div>
				))}
			</dl>
			<p className="telemetry-note">
				{text(
					"Live status from the public feed. Minecraft, loader and voice targets are configured colony connection details.",
				)}
			</p>
		</Container>
	);
}
