import type { ReactNode } from "react";
import { sitePath } from "../config/account";
import { marsConfig } from "../config/mars";
import { missionViews } from "../data/missionViews";
import type { MissionView } from "../data/missionViews";
import type { ServerStatus } from "../types/server";
import { HeroPanel } from "./HeroPanel";
import { InstallGuide } from "./InstallGuide";
import { LauncherDownloadCard } from "./LauncherDownloadCard";
import { ServerStatusCard } from "./ServerStatusCard";
import { ServerTelemetry } from "./ServerTelemetry";
import { TerminalBox, TerminalText } from "./TerminalExperience";
import { TransmissionList } from "./TransmissionList";

function DetailPanel({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<TerminalBox
			className="panel detail-panel"
			aria-labelledby={id}
		>
			<div className="panel-heading">
				<h2 id={id}>
					<TerminalText>{title}</TerminalText>
				</h2>
			</div>
			<div className="detail-body">{children}</div>
		</TerminalBox>
	);
}

function ViewHeading({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<header className="view-heading">
			<p className="eyebrow">
				<TerminalText>
					MARS COMMAND / MISSION FILES
				</TerminalText>
			</p>
			<h1>
				<TerminalText>{title}</TerminalText>
			</h1>
			<p>
				<TerminalText>{description}</TerminalText>
			</p>
		</header>
	);
}

type MissionViewProps = {
	view: MissionView;
	status: ServerStatus | null;
	checking: boolean;
	lastUpdated: string | null;
	onRefresh: () => void;
};

export function MissionViewContent({
	view,
	status,
	checking,
	lastUpdated,
	onRefresh,
}: MissionViewProps) {
	const statusCard = (
		<ServerStatusCard
			status={status}
			checking={checking}
			lastUpdated={lastUpdated}
			onRefresh={onRefresh}
		/>
	);
	return (
		<>
			{view === "overview" ? (
				<HeroPanel
					online={status?.online ?? null}
					checking={checking}
				/>
			) : (
				<ViewHeading
					title={missionViews
						.find(
							(item) =>
								item.id ===
								view,
						)!
						.label.toUpperCase()}
					description={
						{
							uplink: "Connection telemetry, the colony's configured stack, and what the public feed can tell you.",
							deployment: "Everything you need to prepare your client and reach the colony.",
							transmissions:
								"Recent changes to Mars Command, from the terminal interface to account and submission workflows.",
							account: "Your GitHub identity, personal mod profiles, and private artifact submissions.",
						}[view]
					}
				/>
			)}
			{marsConfig.useMockStatus &&
				(view === "overview" || view === "uplink") && (
					<TerminalBox
						className="mock-notice"
						role="status"
					>
						<TerminalText>
							SIMULATED TELEMETRY //
							DEVELOPMENT ONLY
						</TerminalText>
					</TerminalBox>
				)}
			{view === "overview" && (
				<>
					{statusCard}
					<LauncherDownloadCard />
					<TransmissionList />
					<DetailPanel
						id="overview-details"
						title="YOUR PLACE IN THE COLONY"
					>
						<p>
							<TerminalText>
								Mars is a modded
								Minecraft
								colony. Start
								with the managed
								client, check
								the uplink, and
								keep an eye on
								mission
								transmissions.
							</TerminalText>
						</p>
						<p>
							<TerminalText>{`The colony targets Minecraft ${marsConfig.minecraftVersion} with ${marsConfig.loader}. Connect to ${marsConfig.serverAddress} after setting up the client.`}</TerminalText>
						</p>
						<p>
							<TerminalText>
								The directory
								opens detailed
								mission files.
								Account access
								is optional for
								reading status
								and downloading
								the launcher.
							</TerminalText>
						</p>
					</DetailPanel>
				</>
			)}
			{view === "uplink" && (
				<>
					{statusCard}
					<ServerTelemetry
						status={status}
						checking={checking}
						lastUpdated={lastUpdated}
						terminal
					/>
					<DetailPanel
						id="server-stack"
						title="SERVER / RUNTIME INFORMATION"
					>
						<dl className="runtime-list">
							{[
								[
									"Reported server build",
									status?.versionName ??
										"Not reported by the status feed",
								],
								[
									"Configured Minecraft target",
									marsConfig.minecraftVersion,
								],
								[
									"Configured mod loader",
									marsConfig.loader,
								],
								[
									"Reported port",
									status
										? String(
												status.port,
											)
										: "Awaiting status",
								],
								[
									"Voice address",
									marsConfig.voiceAddress,
								],
							].map(
								([
									label,
									value,
								]) => (
									<div
										key={
											label
										}
									>
										<dt>
											<TerminalText>
												{
													label
												}
											</TerminalText>
										</dt>
										<dd>
											<TerminalText>
												{
													value
												}
											</TerminalText>
										</dd>
									</div>
								),
							)}
						</dl>
						<p>
							<TerminalText>
								The public
								status feed does
								not report the
								running mod
								inventory, TPS,
								CPU, memory, or
								a reliable
								player roster.
								Those values are
								not inferred
								from the
								configured
								client stack.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								The voice
								address is a
								configured
								connection
								target; voice
								health and
								integration are
								not verified by
								the Minecraft
								status feed.
							</TerminalText>
						</p>
					</DetailPanel>
					<DetailPanel
						id="uplink-notes"
						title="HOW TO READ THE UPLINK"
					>
						<p>
							<TerminalText>
								Status is
								checked every 15
								seconds. Refresh
								performs the
								same guarded
								request; slow
								checks cannot
								overlap.
								Upstream caching
								can make
								successive
								checks return
								the same data.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								MCStatus.io does
								not supply
								Minecraft ping
								latency.
								Unavailable
								readings are
								shown as a dash,
								never as a
								fabricated
								measurement.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								If the colony is
								offline or the
								feed fails,
								review the
								displayed error
								and retry. A
								status-feed
								failure alone
								does not
								establish that
								the game server
								has stopped.
							</TerminalText>
						</p>
					</DetailPanel>
				</>
			)}
			{view === "deployment" && (
				<>
					<LauncherDownloadCard guideId="deployment-guide" />
					<InstallGuide terminal />
					<DetailPanel
						id="deployment-preflight"
						title="BEFORE YOU DEPLOY"
					>
						<p>
							<TerminalText>
								Close Minecraft
								Launcher before
								Setup or Update
								so the client
								can safely
								register its
								game profile. A
								matching
								NeoForge
								installation
								must be
								available in
								Minecraft
								Launcher.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								The desktop
								companion
								supports Windows
								and Linux. On
								Linux, Minecraft
								Launcher must be
								available as
								minecraft-launcher
								on PATH. Use an
								installer
								appropriate for
								your operating
								system.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Setup uses an
								isolated
								mars-client game
								directory and
								leaves the
								shared
								.minecraft/mods
								directory alone.
								Minecraft
								Launcher handles
								Microsoft
								sign-in and
								starting the
								game.
							</TerminalText>
						</p>
					</DetailPanel>
					<DetailPanel
						id="deployment-integrity"
						title="SETUP / UPDATE / LAUNCH"
					>
						<p>
							<TerminalText>
								SETUP registers
								an installation
								and synchronises
								the signed pack.
								UPDATE appears
								when the trusted
								pack or required
								loader changes.
								LAUNCH rechecks
								integrity and
								opens Minecraft
								Launcher without
								resynchronising
								the pack.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								The client
								verifies the
								pack's Ed25519
								signature and
								checks managed
								files against
								signed SHA-256
								hashes and
								sizes. A missing
								trusted manifest
								or an integrity
								problem blocks
								launch.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Personal mods
								remain separate
								from signed pack
								files. Their
								local metadata
								and checksums
								are not a
								signature or
								proof of safety;
								review warnings
								before
								installing them.
							</TerminalText>
						</p>
					</DetailPanel>
				</>
			)}
			{view === "transmissions" && (
				<>
					<TransmissionList />
					<DetailPanel
						id="transmission-key"
						title="SIGNAL CLASSIFICATION"
					>
						<p>
							<TerminalText>
								WARNING / A
								compatibility or
								operational
								change requiring
								attention before
								continuing.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								INFO / An
								interface or
								workflow
								improvement.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								SUCCESS / An
								implemented
								feature or
								completed
								improvement, not
								a live
								service-health
								check.
							</TerminalText>
						</p>
					</DetailPanel>
					<DetailPanel
						id="transmission-source"
						title="ABOUT THIS LOG"
					>
						<p>
							<TerminalText>
								These are
								curated release
								notes for
								changes to Mars
								Command. They
								are maintained
								with the
								website, not
								fetched from a
								live chat or
								server event
								stream.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Open Server
								uplink for live
								status.
								Deployment and
								Account &
								profiles contain
								the usage
								details for
								these features.
							</TerminalText>
						</p>
					</DetailPanel>
				</>
			)}
			{view === "account" && (
				<>
					<DetailPanel
						id="identity-details"
						title="GITHUB IDENTITY / EXPLICIT CONSENT"
					>
						<p>
							<TerminalText>
								Sign in with
								GitHub to manage
								personal
								profiles. Review
								the returned
								identity before
								continuing; a
								desktop launcher
								request requires
								your explicit
								confirmation.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Signing in does
								not
								automatically
								approve desktop
								access, publish
								profiles, or
								grant roles.
								Roles are
								supplied by the
								backend.
							</TerminalText>
						</p>
						<a
							className="button button-primary"
							href={sitePath(
								"account",
							)}
						>
							<TerminalText>
								OPEN ACCOUNT &
								PROFILES
							</TerminalText>
						</a>
						<a
							className="button button-secondary"
							href={sitePath(
								"auth/login",
							)}
						>
							<TerminalText>
								SIGN IN WITH
								GITHUB
							</TerminalText>
						</a>
					</DetailPanel>
					<DetailPanel
						id="profile-details"
						title="PERSONAL MOD PROFILES"
					>
						<p>
							<TerminalText>
								Create private
								profiles, edit
								their mod
								metadata, or
								make a private
								copy of a public
								profile. Saving
								a profile does
								not publish it;
								submission is a
								separate action.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Profile metadata
								describes mod
								names, versions,
								source URLs and
								checksums. It is
								not proof that
								an artifact was
								scanned or is
								safe to install.
							</TerminalText>
						</p>
					</DetailPanel>
					<DetailPanel
						id="artifact-details"
						title="PRIVATE ARTIFACT SUBMISSIONS"
					>
						<p>
							<TerminalText>
								Signed-in users
								can reserve and
								upload one JAR
								per release. The
								browser
								advertises a 64
								MiB limit;
								backend
								validation and
								operator limits
								remain
								authoritative.
							</TerminalText>
						</p>
						<p>
							<TerminalText>
								Uploads are
								private. Sending
								all bytes is not
								backend
								acceptance, and
								a submission
								does not create
								a public
								download or an
								installation
								control.
							</TerminalText>
						</p>
					</DetailPanel>
				</>
			)}
		</>
	);
}
