import { InstallGuide } from "./components/InstallGuide";
import { MissionViewContent } from "./components/MissionViews";
import { MissionNavigation } from "./components/MissionNavigation";
import { ServerTelemetry } from "./components/ServerTelemetry";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import {
	PageExperience,
	TerminalFade,
	TerminalSequence,
	TerminalText,
} from "./components/TerminalExperience";
import { missionViews } from "./data/missionViews";
import type { MissionView } from "./data/missionViews";
import { useServerStatus } from "./hooks/useServerStatus";
import { useTerminalNavigation } from "./hooks/useTerminalNavigation";
import type { ServerStatus } from "./types/server";

function MissionWorkspace({
	status,
	isChecking,
	lastUpdated,
	refresh,
}: {
	status: ServerStatus | null;
	isChecking: boolean;
	lastUpdated: string | null;
	refresh: () => void;
}) {
	const main = useRef<HTMLElement>(null);
	const prompt = useRef<HTMLDivElement>(null);
	const navigation = useTerminalNavigation<MissionView>(
		"overview",
		main,
		prompt,
	);
	const target = missionViews.find(
		(item) => item.id === navigation.target,
	)!;
	const { transitioning, navigate } = navigation;

	return (
		<div className="site-shell">
			<div className="content-wrap">
				<SiteHeader
					online={status?.online ?? null}
					checking={isChecking}
					onHome={() => navigate("overview")}
					onNavigate={navigate}
					activeView={
						transitioning
							? navigation.target
							: navigation.view
					}
				/>
				<div className="terminal-workspace">
					<aside
						className="terminal-sidebar"
						aria-label="Colony directory and telemetry"
					>
						<TerminalFade
							order={0}
							className="sidebar-directory"
						>
							<p className="sidebar-label">
								COLONY DIRECTORY
							</p>
							<MissionNavigation
								activeView={
									transitioning
										? navigation.target
										: navigation.view
								}
								onNavigate={
									navigate
								}
							/>
						</TerminalFade>
						<TerminalFade order={6}>
							<ServerTelemetry
								status={status}
								checking={
									isChecking
								}
								lastUpdated={
									lastUpdated
								}
							/>
						</TerminalFade>
						<TerminalFade order={9}>
							<InstallGuide />
						</TerminalFade>
						<TerminalFade order={12}>
							<p className="sidebar-footnote">
								REMOTE OUTPOST /
								SOL SYSTEM
								<br />
								<span>
									One
									small
									step.
									One new
									world.
								</span>
							</p>
						</TerminalFade>
					</aside>
					<main
						ref={main}
						className="terminal-main"
						id="main-content"
						tabIndex={-1}
						data-view={
							navigation.view ??
							"empty"
						}
						data-navigation-phase={
							navigation.phase
						}
						aria-busy={
							navigation.phase !==
							"idle"
						}
					>
						<div
							className="terminal-output"
							inert={transitioning}
						>
							{navigation.view && (
								<TerminalSequence
									key={
										navigation.output
									}
									onComplete={() =>
										navigation.completeOutput(
											navigation.output,
										)
									}
								>
									<MissionViewContent
										view={
											navigation.view
										}
										status={
											status
										}
										checking={
											isChecking
										}
										lastUpdated={
											lastUpdated
										}
										onRefresh={
											refresh
										}
									/>
								</TerminalSequence>
							)}
						</div>
						<div
							ref={prompt}
							className="terminal-prompt terminal-command-line"
							aria-live="polite"
							aria-atomic="true"
						>
							<span>
								visitor@mars
							</span>
							:<b>~</b>${" "}
							{transitioning ? (
								<TerminalSequence
									key={`${navigation.request}-${navigation.phase}`}
									onComplete={() =>
										navigation.completeCommand(
											navigation.phase ===
												"clear"
												? "clear"
												: "cat",
											navigation.request,
										)
									}
								>
									<TerminalText>
										{navigation.phase ===
										"clear"
											? "clear"
											: `cat ${target.file}`}
									</TerminalText>
								</TerminalSequence>
							) : (
								<span
									className="idle-cursor"
									aria-hidden="true"
								/>
							)}
						</div>
					</main>
				</div>
				<div className="terminal-statusbar">
					<span>
						<i /> MARS COMMAND NETWORK
					</span>
					<span>
						UTF-8 <b>/</b> bash <b>/</b> 1
						session
					</span>
				</div>
				<SiteFooter />
			</div>
		</div>
	);
}

function App() {
	const { status, isChecking, lastUpdated, refresh } = useServerStatus();
	return (
		<PageExperience ready={status !== null}>
			<MissionWorkspace
				status={status}
				isChecking={isChecking}
				lastUpdated={lastUpdated}
				refresh={refresh}
			/>
		</PageExperience>
	);
}

export default App;
import { useRef } from "react";
