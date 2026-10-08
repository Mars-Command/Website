import type { ReactNode } from "react";
import { safeHttpUrl, sitePath } from "../config/account";
import type { User } from "../types/account";

export function AccountShell({ title, children }: { title: string; children: ReactNode }) {
	return <div className="site-shell">
		<div className="ambient-grid" aria-hidden="true" />
		<div className="content-wrap account-wrap">
			<nav className="account-nav" aria-label="Mission control">
				<a href={sitePath()}>Mars Command home</a>
				<a href={sitePath("account")}>Account &amp; mod profiles</a>
				<a href={sitePath("auth/login")}>Sign in</a>
			</nav>
			<main className="account-panel">
				<p className="terminal-label">MARS COMMAND // IDENTITY TERMINAL</p>
				<h1>{title}</h1>
				{children}
			</main>
		</div>
	</div>;
}

export function Identity({ user }: { user: User }) {
	const avatar = safeHttpUrl(user.avatarUrl);
	return <div className="account-identity">
		{avatar && <img src={avatar} width="64" height="64" alt={`${user.username}'s GitHub avatar`} referrerPolicy="no-referrer" />}
		<div><strong>{user.username}</strong><p>GitHub identity // {user.id}</p></div>
	</div>;
}

export function TerminalMessage({ error = false, children }: { error?: boolean; children: ReactNode }) {
	return <p className={`terminal-message${error ? " terminal-error" : ""}`}
		role={error ? "alert" : "status"}>{error ? "[FAILURE] " : "[STATUS] "}{children}</p>;
}
