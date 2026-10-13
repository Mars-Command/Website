import { useEffect, useState } from "react";
import { accountConfig, sitePath } from "../config/account";
import { useSession } from "../hooks/useSession";
import { accountApi, errorMessage } from "../services/accountApi";
import { AccountShell, Identity, TerminalMessage } from "./AccountShell";
import { readLoginQuery } from "../utils/accountUi";
import type { AuthorizationRequest } from "../types/account";
import { useProcessSound } from "../hooks/useProcessSound";
import { siteAudio } from "../services/siteAudio";

export function AuthLogin({
	search = window.location.search,
	navigate = (url: string) => window.location.assign(url),
}: {
	search?: string;
	navigate?: (url: string) => void;
}) {
	const {
		user,
		setUser,
		loading,
		error: sessionError,
		retry,
	} = useSession();
	const processSound = useProcessSound(!loading);
	const { requestId, invalidRequest, authResult } =
		readLoginQuery(search);
	const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [approvedKey, setApprovedKey] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [requestRevision, setRequestRevision] = useState(0);
	const userId = user?.id;
	const requestKey =
		requestId && userId
			? `${requestId}:${userId}:${requestRevision}`
			: null;
	const [requestState, setRequestState] = useState<{
		key: string;
		details: AuthorizationRequest | null;
		error: string;
	} | null>(null);
	const details =
		requestState?.key === requestKey
			? (requestState?.details ?? null)
			: null;
	const requestLoading =
		requestKey !== null && requestState?.key !== requestKey;
	const confirmed = requestKey !== null && confirmedKey === requestKey;
	const approved =
		(requestKey !== null && approvedKey === requestKey) ||
		details?.status === "approved";
	const requestError =
		requestState?.key === requestKey ? requestState?.error : "";
	const minecraft = details?.kind === "minecraft";

	useEffect(() => {
		let active = true;
		if (!requestId || !userId || !requestKey) {
			return () => {
				active = false;
			};
		}
		void accountApi
			.authorizationRequest(requestId)
			.then((result) => {
				if (active)
					setRequestState({
						key: requestKey,
						details: result,
						error: "",
					});
			})
			.catch((error) => {
				if (active)
					setRequestState({
						key: requestKey,
						details: null,
						error: errorMessage(error),
					});
			});
		return () => {
			active = false;
		};
	}, [requestId, userId, requestKey]);

	function setConfirmed(value: boolean) {
		setConfirmedKey(value ? requestKey : null);
	}

	function signIn(switchAccount = false) {
		setConfirmed(false);
		setError("");
		try {
			navigate(
				accountApi.githubStart(
					requestId ?? undefined,
					switchAccount,
				),
			);
		} catch (error) {
			setError(errorMessage(error));
			siteAudio.playFromGesture("error");
		}
	}

	async function approve() {
		if (
			!requestId ||
			!user ||
			!requestKey ||
			!details ||
			!confirmed ||
			busy ||
			approved ||
			requestLoading
		)
			return;
		const process = processSound.start("connecting");
		let outcome: "success" | "error" = "error";
		setBusy(true);
		setError("");
		try {
			const currentUser = await accountApi.session();
			if (currentUser?.id !== user.id) {
				setUser(currentUser);
				setConfirmed(false);
				throw new Error(
					"The website identity changed. Review the current account and confirm again.",
				);
			}
			const currentRequest =
				await accountApi.authorizationRequest(
					requestId,
				);
			if (
				currentRequest.kind !== details.kind ||
				currentRequest.callSign !== details.callSign ||
				currentRequest.playerName !==
					details.playerName ||
				currentRequest.status !== "pending"
			) {
				setRequestState({
					key: requestKey,
					details: currentRequest,
					error: "",
				});
				setConfirmed(false);
				throw new Error(
					"The authorization request changed. Review its current details before continuing.",
				);
			}
			if (currentRequest.kind === "minecraft")
				await accountApi.approveMinecraft(requestId);
			else await accountApi.approve(requestId);
			setApprovedKey(requestKey);
			outcome = "success";
		} catch (error) {
			setConfirmed(false);
			setError(errorMessage(error));
		} finally {
			process?.finish(outcome);
			setBusy(false);
		}
	}

	return (
		<AccountShell
			title={
				minecraft
					? `Confirm arrival // Player ${details.callSign}`
					: details?.kind === "desktop"
						? "Authorize your desktop launcher"
						: "GitHub sign in"
			}
			ready={!loading}
		>
			{authResult === "error" && (
				<TerminalMessage error>
					GitHub sign-in did not complete. Try
					again; no connection has been approved.
				</TerminalMessage>
			)}
			{authResult === "success" && !approved && (
				<TerminalMessage>
					GitHub sign-in returned. Checking the
					website session; approval still requires
					your confirmation.
				</TerminalMessage>
			)}
			{invalidRequest && (
				<TerminalMessage error>
					Invalid authorization request. Return to
					Minecraft or the launcher and start
					again.
				</TerminalMessage>
			)}
			{loading && (
				<TerminalMessage>
					Checking your secure website session…
				</TerminalMessage>
			)}
			{sessionError && (
				<>
					<TerminalMessage error>
						{sessionError}
					</TerminalMessage>
					<button
						onClick={() => {
							retry();
							siteAudio.playFromGesture(
								"retry",
							);
						}}
						disabled={loading}
					>
						Retry session check
					</button>
				</>
			)}
			{error && (
				<TerminalMessage error>{error}</TerminalMessage>
			)}
			{requestError && (
				<TerminalMessage error>
					{requestError}
				</TerminalMessage>
			)}
			{requestLoading && (
				<TerminalMessage>
					Checking the requested connection with
					mission control...
				</TerminalMessage>
			)}
			{requestId &&
				user &&
				!requestLoading &&
				!details &&
				!invalidRequest && (
					<button
						onClick={() => {
							setError("");
							setRequestRevision(
								(value) =>
									value +
									1,
							);
							siteAudio.playFromGesture(
								"retry",
							);
						}}
					>
						Retry request check
					</button>
				)}
			{!loading &&
				!sessionError &&
				!invalidRequest &&
				!approved &&
				(user ? (
					<>
						<Identity user={user} />
						{requestId ? (
							details &&
							!requestLoading && (
								<>
									<p>
										{minecraft
											? `Confirm only your own Minecraft arrival: ${details.playerName}, Player ${details.callSign}.`
											: "Approve only the launcher sign-in you initiated."}{" "}
										Request:{" "}
										<code>
											{
												requestId
											}
										</code>
									</p>
									{minecraft && (
										<p>
											This
											shares
											your
											display
											name
											and
											server-approved
											roles
											with
											the
											Minecraft
											server.
											It
											does
											not
											grant
											access
											to
											private
											profiles
											or
											files.
											Finish
											linking
											by
											reviewing
											and
											confirming
											this
											account
											in
											Minecraft.
										</p>
									)}
									<label className="confirmation">
										<input
											type="checkbox"
											checked={
												confirmed
											}
											disabled={
												busy
											}
											onChange={(
												event,
											) => {
												setConfirmed(
													event
														.target
														.checked,
												);
												siteAudio.playFromGesture(
													event
														.target
														.checked
														? "check"
														: "uncheck",
												);
											}}
										/>

										I
										confirm
										that{" "}
										{
											user.username
										}{" "}
										is
										the
										GitHub
										identity
										I
										want
										to
										use{" "}
										{minecraft
											? `for Minecraft Player ${details.callSign}`
											: "in my desktop launcher"}
										.
									</label>
									<button
										disabled={
											!confirmed ||
											busy
										}
										onClick={
											approve
										}
										aria-busy={
											busy
										}
									>
										{busy
											? "Sending approval..."
											: `Continue as ${user.username} — ${minecraft ? "approve arrival" : "approve launcher"}`}
									</button>
								</>
							)
						) : (
							<a
								className="account-button"
								href={sitePath(
									"account",
								)}
							>
								Continue as{" "}
								{user.username}
							</a>
						)}
						<button
							disabled={
								busy ||
								accountConfig.apiBase ===
									null
							}
							onClick={() =>
								signIn(true)
							}
						>
							Use a different GitHub
							account
						</button>
						<p className="account-help">
							GitHub may keep its
							upstream login. If it
							returns the same
							account, sign out or
							switch accounts on
							GitHub, then retry here.
							Nothing is approved
							automatically.
						</p>
					</>
				) : (
					<>
						<p>
							Use GitHub to establish
							a secure website session
							{requestId
								? ", then review and explicitly approve the requested connection"
								: ""}
							.
						</p>
						<button
							disabled={
								accountConfig.apiBase ===
								null
							}
							onClick={() => signIn()}
						>
							Sign in with GitHub
						</button>
					</>
				))}
			{approved && (
				<TerminalMessage>
					{minecraft
						? "ARRIVAL APPROVAL SAVED // Return to Minecraft and confirm the displayed account. Arrival is not confirmed until that final step."
						: "AUTHORIZATION SUCCESS // Return to the Mars Command launcher to finish sign-in. You can close this tab."}
				</TerminalMessage>
			)}
			{busy && (
				<TerminalMessage>
					Waiting for backend approval. Keep this
					page open.
				</TerminalMessage>
			)}
		</AccountShell>
	);
}
