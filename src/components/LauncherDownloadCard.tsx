import { ArrowDownToLine, ArrowUpRight, Rocket } from "lucide-react";
import { marsConfig } from "../config/mars";
import { pulseTarget } from "../utils/pulseTarget";
import { TerminalBox, TerminalText } from "./TerminalExperience";

export function LauncherDownloadCard({ guideId = "install-guide" }: { guideId?: string }) {
	return (
		<TerminalBox
			className="launcher-panel"
			id="launcher-panel"
			aria-labelledby="launcher-heading"
		>
			<div className="launcher-copy">
				<p className="eyebrow">
					<Rocket size={14} aria-hidden="true" />{" "}
					<TerminalText>02 / CLIENT DEPLOYMENT</TerminalText>
				</p>
				<h2 id="launcher-heading">
					<TerminalText>MARS COMMAND CLIENT</TerminalText>
				</h2>
				<p className="launcher-subtitle">
					<TerminalText>Your direct connection to the colony. Install, synchronise, launch.</TerminalText>
				</p>
				<TerminalBox framed={false} className="launcher-actions" aria-label="Client deployment actions">
					{marsConfig.launcherDownloadUrl ? (
						<a
							className="button button-primary"
							href={
								marsConfig.launcherDownloadUrl
							}
							target="_blank"
							rel="noreferrer"
							onClick={() =>
								pulseTarget(
									"launcher-panel",
								)
							}
						>
							<ArrowDownToLine
								size={17}
								aria-hidden="true"
							/>{" "}
							<TerminalText>DOWNLOAD LAUNCHER</TerminalText>
						</a>
					) : (
						<button
							className="button button-primary"
							type="button"
							disabled
						>
							<ArrowDownToLine
								size={17}
								aria-hidden="true"
							/>{" "}
							<TerminalText>LAUNCHER DOWNLOAD COMING SOON</TerminalText>
						</button>
					)}
					<a
						className="button button-secondary"
						href={`#${guideId}`}
						onClick={() =>
							pulseTarget(
								guideId,
							)
						}
					>
						<TerminalText>VIEW INSTALL GUIDE</TerminalText>{" "}
						<ArrowUpRight
							size={15}
							aria-hidden="true"
						/>
					</a>
				</TerminalBox>
			</div>
			<TerminalBox framed={false}
				className="launcher-specs"
				aria-label="Client version information"
			>
				<p>
					<span><TerminalText>CLIENT VERSION</TerminalText></span>
					<strong>
						<TerminalText>{`v${marsConfig.clientVersion}`}</TerminalText>
					</strong>
				</p>
				<p>
					<span><TerminalText>GAME</TerminalText></span>
					<strong>
						<TerminalText>{`Minecraft ${marsConfig.minecraftVersion}`}</TerminalText>
					</strong>
				</p>
				<p>
					<span><TerminalText>LOADER</TerminalText></span>
					<strong><TerminalText>{marsConfig.loader}</TerminalText></strong>
				</p>
			</TerminalBox>
		</TerminalBox>
	);
}
