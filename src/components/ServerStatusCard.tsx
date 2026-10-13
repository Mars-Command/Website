import { RefreshCw, Signal, Users } from "lucide-react";
import { getPersonnelMessage } from "../services/serverStatus";
import type { ServerStatus } from "../types/server";
import { pulseTarget } from "../utils/pulseTarget";
import { StatusBadge } from "./StatusBadge";
import { TerminalBox, TerminalText } from "./TerminalExperience";

type ServerStatusCardProps = {
	status: ServerStatus | null;
	checking: boolean;
	lastUpdated: string | null;
	onRefresh: () => void;
};

function formatTime(value: string | null): string {
	if (!value || Number.isNaN(Date.parse(value)))
		return "AWAITING FIRST CHECK";
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(new Date(value));
}

export function ServerStatusCard({
	status,
	checking,
	lastUpdated,
	onRefresh,
}: ServerStatusCardProps) {
	const online = status?.online ?? null;
	const playerCount = status?.playersOnline;
	const maxPlayers = status?.playersMax;
	const personnel =
		playerCount === null || playerCount === undefined
			? "—"
			: `${playerCount} / ${maxPlayers ?? "—"}`;

	return (
		<TerminalBox
			className="panel status-panel"
			id="server-status"
			aria-labelledby="status-heading"
		>
			<div className="panel-heading">
				<div>
					<p className="eyebrow">
						<TerminalText>
							01 / COLONY UPLINK
						</TerminalText>
					</p>
					<h2 id="status-heading">
						<TerminalText>
							LIVE SERVER STATUS
						</TerminalText>
					</h2>
				</div>
				<StatusBadge
					online={online}
					checking={checking}
				/>
			</div>

			<div
				className="status-readout"
				aria-live="polite"
				aria-atomic="true"
			>
				<div
					className={`status-light ${checking ? "is-checking" : online ? "is-online" : "is-offline"}`}
				/>
				<div className="status-message">
					<strong>
						<TerminalText>
							{checking
								? "CONTACTING MARS"
								: online
									? "COLONY CONNECTION ESTABLISHED"
									: "NO SIGNAL FROM COLONY"}
						</TerminalText>
					</strong>
					<p>
						<TerminalText>
							{getPersonnelMessage(
								status,
								checking,
							)}
						</TerminalText>
					</p>
				</div>
			</div>

			<TerminalBox
				framed={false}
				className="status-stats"
				aria-label="Personnel and latency readings"
			>
				<div className="status-stat">
					<Users size={15} aria-hidden="true" />
					<span>
						<TerminalText>
							PERSONNEL
						</TerminalText>
					</span>
					<strong>
						<TerminalText>
							{personnel}
						</TerminalText>
					</strong>
				</div>
				<div className="status-stat">
					<Signal size={15} aria-hidden="true" />
					<span>
						<TerminalText>
							LATENCY
						</TerminalText>
					</span>
					<strong>
						<TerminalText>
							{status?.latencyMs ==
							null
								? "—"
								: `${Math.round(status.latencyMs)} ms`}
						</TerminalText>
					</strong>
				</div>
			</TerminalBox>

			{status?.motd && (
				<p className="server-motd">
					<TerminalText>{`“${status.motd}”`}</TerminalText>
				</p>
			)}
			{status?.error && !checking && (
				<p className="status-error">{status.error}</p>
			)}

			<div className="status-footnote">
				<span>
					<TerminalText>LAST CHECK</TerminalText>{" "}
					<strong>
						<TerminalText>
							{formatTime(
								lastUpdated,
							)}
						</TerminalText>
					</strong>
				</span>
				<button
					className="icon-button refresh-button"
					type="button"
					onClick={() => {
						pulseTarget("server-status");
						onRefresh();
					}}
					disabled={checking}
					aria-label="Refresh server status"
					title="Refresh server status"
				>
					<RefreshCw
						size={15}
						aria-hidden="true"
					/>
					<span>
						<TerminalText>
							REFRESH
						</TerminalText>
					</span>
				</button>
			</div>
		</TerminalBox>
	);
}
