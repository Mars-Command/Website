import { useState } from "react";
import { accountConfig, sitePath } from "../config/account";
import { useSession } from "../hooks/useSession";
import { accountApi, errorMessage } from "../services/accountApi";
import { AccountShell, Identity, TerminalMessage } from "./AccountShell";
import { readLoginQuery } from "../utils/accountUi";

export function AuthLogin({ search = window.location.search, navigate = (url: string) => window.location.assign(url) }:
	{ search?: string; navigate?: (url: string) => void }) {
	const { user, setUser, loading, error: sessionError, retry } = useSession();
	const { requestId, invalidRequest, authResult } = readLoginQuery(search);
	const [confirmed, setConfirmed] = useState(false);
	const [busy, setBusy] = useState(false);
	const [approved, setApproved] = useState(false);
	const [error, setError] = useState("");

	function signIn(switchAccount = false) {
		setConfirmed(false);
		setError("");
		try {
			navigate(accountApi.githubStart(requestId ?? undefined, switchAccount));
		} catch (error) {
			setError(errorMessage(error));
		}
	}

	async function approve() {
		if (!requestId || !user || !confirmed || busy || approved) return;
		setBusy(true);
		setError("");
		try {
			const currentUser = await accountApi.session();
			if (currentUser?.id !== user.id) {
				setUser(currentUser);
				setConfirmed(false);
				throw new Error("The website identity changed. Review the current account and confirm again.");
			}
			await accountApi.approve(requestId);
			setApproved(true);
		} catch (error) {
			setConfirmed(false);
			setError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	return <AccountShell title={requestId ? "Authorize your desktop launcher" : "GitHub sign in"}>
		{authResult === "error" && <TerminalMessage error>GitHub sign-in did not complete. Try again; no desktop access has been approved.</TerminalMessage>}
		{authResult === "success" && !approved && <TerminalMessage>GitHub sign-in returned. Checking the website session; desktop approval still requires your confirmation.</TerminalMessage>}
		{invalidRequest && <TerminalMessage error>Invalid desktop request. Return to the launcher and start sign-in again.</TerminalMessage>}
		{loading && <TerminalMessage>Checking your secure website session…</TerminalMessage>}
		{sessionError && <><TerminalMessage error>{sessionError}</TerminalMessage><button onClick={retry} disabled={loading}>Retry session check</button></>}
		{error && <TerminalMessage error>{error}</TerminalMessage>}
		{!loading && !sessionError && !invalidRequest && !approved && (user ? <>
			<Identity user={user} />
			{requestId ? <>
				<p>Approve only the launcher sign-in you initiated. Request: <code>{requestId}</code></p>
				<label className="confirmation">
					<input type="checkbox" checked={confirmed} disabled={busy}
						onChange={event => setConfirmed(event.target.checked)} />
					I confirm that {user.username} is the GitHub identity I want to use in my desktop launcher.
				</label>
				<button disabled={!confirmed || busy} onClick={approve} aria-busy={busy}>
					{busy ? "Authorizing launcher…" : `Continue as ${user.username} — approve launcher`}
				</button>
			</> : <a className="account-button" href={sitePath("account")}>Continue as {user.username}</a>}
			<button disabled={busy || accountConfig.apiBase === null} onClick={() => signIn(true)}>Use a different GitHub account</button>
			<p className="account-help">GitHub may keep its upstream login. If it returns the same account, sign out or switch accounts on GitHub, then retry here. Nothing is approved automatically.</p>
		</> : <>
			<p>Use GitHub to establish a secure website session{requestId ? ", then explicitly approve the launcher" : ""}.</p>
			<button disabled={accountConfig.apiBase === null} onClick={() => signIn()}>Sign in with GitHub</button>
		</>)}
		{approved && <TerminalMessage>AUTHORIZATION SUCCESS // Return to the Mars Command launcher to finish sign-in. You can close this tab.</TerminalMessage>}
		{busy && <TerminalMessage>Waiting for backend approval. Keep this page open.</TerminalMessage>}
	</AccountShell>;
}
