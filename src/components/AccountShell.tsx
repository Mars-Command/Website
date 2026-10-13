import type { ReactNode } from "react";
import { safeHttpUrl, sitePath } from "../config/account";
import type { User } from "../types/account";
import {
	PageExperience,
	TerminalSequence,
	TerminalText,
} from "./TerminalExperience";

export function AccountShell({
	title,
	children,
	ready = true,
}: {
	title: string;
	children: ReactNode;
	ready?: boolean;
}) {
	return (
		<PageExperience ready={ready}>
			<div className="site-shell">
				<div className="content-wrap account-wrap">
					<nav
						className="account-nav"
						aria-label="Mission control"
					>
						<a href={sitePath()}>
							Mars Command home
						</a>
						<a href={sitePath("account")}>
							Account &amp; mod
							profiles
						</a>
						<a
							href={sitePath(
								"auth/login",
							)}
						>
							Sign in
						</a>
					</nav>
					<TerminalSequence>
						<main
							className="account-panel"
							id="main-content"
						>
							<p className="terminal-label">
								<TerminalText>
									MARS
									COMMAND
									//
									IDENTITY
									TERMINAL
								</TerminalText>
							</p>
							<h1>
								<TerminalText>
									{title}
								</TerminalText>
							</h1>
							{children}
						</main>
					</TerminalSequence>
				</div>
			</div>
		</PageExperience>
	);
}

export function Identity({ user }: { user: User }) {
	const avatar = safeHttpUrl(user.avatarUrl);
	return (
		<div className="account-identity">
			{avatar && (
				<img
					src={avatar}
					width="64"
					height="64"
					alt={`${user.username}'s GitHub avatar`}
					referrerPolicy="no-referrer"
				/>
			)}
			<div>
				<strong>{user.username}</strong>
				<p>GitHub identity // {user.id}</p>
			</div>
		</div>
	);
}

export function TerminalMessage({
	error = false,
	children,
}: {
	error?: boolean;
	children: ReactNode;
}) {
	return (
		<p
			className={`terminal-message${error ? " terminal-error" : ""}`}
			role={error ? "alert" : "status"}
		>
			{error ? "[FAILURE] " : "[STATUS] "}
			{children}
		</p>
	);
}
