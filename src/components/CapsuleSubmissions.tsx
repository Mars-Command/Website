import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, errorMessage } from "../services/accountApi";
import { capsuleApi } from "../services/capsuleApi";
import type { Capsule, CapsuleInput } from "../types/capsule";
import { canRetryCapsule, canWithdrawCapsule, capsuleStatusText, mergeCapsules, validateCapsuleInput, validateJar } from "../utils/capsuleUi";
import { TerminalMessage } from "./AccountShell";

const emptyInput = (): CapsuleInput => ({ project: "", version: "", sourceUrl: "" });

export function CapsuleSubmissions({ ownerId, onSessionExpired }: { ownerId: string; onSessionExpired: () => void }) {
	const [capsules, setCapsules] = useState<Capsule[]>([]);
	const records = useRef<Capsule[]>([]);
	const [input, setInput] = useState<CapsuleInput>(emptyInput);
	const [file, setFile] = useState<File | null>(null);
	const [reservation, setReservation] = useState<string | null>(null);
	const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
	const [busy, setBusy] = useState(true);
	const lock = useRef(true);
	const controller = useRef<AbortController | null>(null);
	const [progress, setProgress] = useState<number | null>(null);
	const [artifactAttempted, setArtifactAttempted] = useState(false);
	const [error, setError] = useState("");
	const [message, setMessage] = useState("");
	const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
	const [fileInputKey, setFileInputKey] = useState(0);
	const sessionExpired = useRef(onSessionExpired);
	useEffect(() => { sessionExpired.current = onSessionExpired; }, [onSessionExpired]);

	function accept(incoming: Capsule[]) {
		const merged = mergeCapsules(records.current, incoming);
		records.current = merged;
		setCapsules(merged);
	}

	useEffect(() => {
		const request = new AbortController();
		controller.current = request;
		lock.current = true;
		capsuleApi.mine(ownerId, request.signal).then(result => {
			if (!request.signal.aborted) accept(result);
		}).catch(error => {
			if (request.signal.aborted) return;
			setError(errorMessage(error));
			if (error instanceof ApiError && error.status === 401) sessionExpired.current();
		}).finally(() => {
			if (!request.signal.aborted) { lock.current = false; setBusy(false); }
		});
		return () => { controller.current?.abort(); request.abort(); };
	}, [ownerId]);

	async function run(operation: (signal: AbortSignal) => Promise<void>) {
		if (lock.current) return;
		lock.current = true;
		const request = new AbortController();
		controller.current = request;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await operation(request.signal);
		} catch (error) {
			if (!request.signal.aborted) {
				setError(errorMessage(error));
				if (error instanceof ApiError && error.status === 401) sessionExpired.current();
			}
		} finally {
			if (!request.signal.aborted) { lock.current = false; setBusy(false); setProgress(null); }
		}
	}

	function submit(event: FormEvent) {
		event.preventDefault();
		const invalid = validateJar(file) || validateCapsuleInput(input);
		if (invalid) { setError(invalid); return; }
		const jar = file!;
		const payload = { project: input.project.trim(), version: input.version.trim(), sourceUrl: input.sourceUrl.trim() };
		void run(async signal => {
			let id = reservation;
			if (!id) {
				const key = idempotencyKey ?? crypto.randomUUID();
				setIdempotencyKey(key);
				const reserved = await capsuleApi.reserve(payload, key, ownerId, signal);
				if (signal.aborted) return;
				accept([reserved]);
				id = reserved.releaseId;
				setReservation(id);
				if (reserved.artifactSha256) {
					setMessage("The earlier request already bound a JAR. Status refreshed; no second upload was sent.");
					return;
				}
				if (reserved.state !== "reserved") {
					setMessage("The reservation is not currently awaiting bytes. Refresh its status before retrying; no JAR was sent.");
					return;
				}
			}
			setProgress(0);
			setArtifactAttempted(true);
			const uploaded = await capsuleApi.upload(id, jar, ownerId, signal, percent => {
				if (!signal.aborted) setProgress(percent);
			});
			if (signal.aborted) return;
			accept([uploaded]);
			setMessage("Backend confirmed the JAR digest. Your submission is private and unpublished.");
		});
	}

	function refresh(id?: string) {
		void run(async signal => {
			const incoming = id ? [await capsuleApi.read(id, ownerId, signal)] : await capsuleApi.mine(ownerId, signal);
			if (signal.aborted) return;
			accept(incoming);
			setMessage("Submission status refreshed from the backend.");
		});
	}

	function reset() {
		setInput(emptyInput()); setFile(null); setReservation(null);
		setIdempotencyKey(null);
		setArtifactAttempted(false);
		setFileInputKey(value => value + 1);
		setError(""); setMessage("");
	}

	const selected = capsules.find(capsule => capsule.releaseId === reservation);
	const bound = !!selected?.artifactSha256;
	const uploadEligible = !selected || selected.state === "reserved";
	return <section aria-labelledby="capsules-heading">
		<h2 id="capsules-heading">Private JAR submissions</h2>
		<p>Submit one .jar per immutable release, up to 64 MiB (67,108,864 bytes). The backend validates archive structure, hashes the received bytes, and enforces operator limits (default: 10 active submissions per account).</p>
		<p>Uploads are quarantined privately. Scanning may be blocked until a trusted provider is configured. Even a completed workflow does not publish a download or install a mod.</p>
		<button disabled={busy} onClick={() => refresh()}>Refresh submissions</button>
		{busy && <TerminalMessage>{progress === null ? "Contacting mission control…" :
			progress === 100 ? "JAR sent; waiting for backend validation and digest confirmation…" : `Uploading JAR: ${progress}%`}</TerminalMessage>}
		{progress !== null && <progress aria-label="JAR upload progress" max={100} value={progress} />}
		{progress !== null && <button onClick={() => {
			controller.current?.abort();
			lock.current = false;
			setBusy(false);
			setProgress(null);
			setError("Upload cancelled locally. The backend may have received the JAR; refresh its status before retrying.");
		}}>Cancel JAR upload</button>}
		{error && <TerminalMessage error>{error}</TerminalMessage>}
		{message && <TerminalMessage>{message}</TerminalMessage>}
		<form aria-label="Submit private JAR" aria-busy={busy} onSubmit={submit}>
			<fieldset disabled={busy || reservation !== null || idempotencyKey !== null}>
				<legend>Immutable release metadata</legend>
				<label>Project<input required maxLength={120} value={input.project} onChange={event => setInput({ ...input, project: event.target.value })} /></label>
				<label>Release version<input required maxLength={80} value={input.version} onChange={event => setInput({ ...input, version: event.target.value })} /></label>
				<label>Source URL (HTTPS)<input required type="url" maxLength={2048} value={input.sourceUrl} onChange={event => setInput({ ...input, sourceUrl: event.target.value })} /></label>
			</fieldset>
			<fieldset disabled={busy || idempotencyKey !== null || artifactAttempted || bound || !uploadEligible}>
				<legend>JAR artifact</legend>
				<label>JAR file<input key={fileInputKey} type="file" accept=".jar,application/java-archive"
					onChange={event => { const selectedFile = event.target.files?.[0] ?? null; setFile(selectedFile); setError(validateJar(selectedFile)); }} /></label>
			</fieldset>
			{file && <p>Selected: {file.name} ({file.size.toLocaleString()} bytes). Extension checks are help only, not a security scan.</p>}
			{reservation && <p>Reservation: {reservation}. Retry uses the same release and selected bytes. Refresh after an interruption; a bound digest cannot be replaced.</p>}
			<button type="submit" disabled={busy || bound || !uploadEligible}>{reservation ? "Retry JAR upload" : idempotencyKey ? "Retry reservation and upload" : "Reserve and upload JAR"}</button>
			<button type="button" disabled={busy} onClick={reset}>Start a new submission</button>
		</form>
		{!busy && capsules.length === 0 && !error && <p>No JAR submissions yet.</p>}
		<ul className="profile-list">{capsules.map(capsule => <li key={capsule.releaseId}>
			<h3>{capsule.project} — {capsule.version}</h3>
			<p>{capsuleStatusText[capsule.state]}</p>
			<p>Release {capsule.releaseId} // revision {capsule.revision} // {capsule.state}</p>
			<p>Created: {capsule.createdAt} // Updated: {capsule.updatedAt}</p>
			<p>Source: {capsule.sourceUrl}</p>
			<p>Backend SHA-256: <code>{capsule.artifactSha256 ?? "Not yet bound"}</code></p>
			{capsule.queue && <p>Scan queue: {capsule.queue.status} // attempts {capsule.queue.attempts}/{capsule.queue.maxAttempts}
				{capsule.queue.nextAttemptAt && ` // Next attempt: ${capsule.queue.nextAttemptAt}`}</p>}
			{capsule.evidence && <p>Evidence v{capsule.evidence.version}: {capsule.evidence.verdict} // {capsule.evidence.provider} // policy {capsule.evidence.policyVersion}<br />
				{capsule.evidence.summary}<br />Scanned: {capsule.evidence.scannedAt} // Expires: {capsule.evidence.expiresAt}</p>}
			<button disabled={busy} onClick={() => refresh(capsule.releaseId)}>Refresh {capsule.project}</button>
			{capsule.state === "reserved" && reservation !== capsule.releaseId && <button disabled={busy} onClick={() => {
				reset();
				setInput({ project: capsule.project, version: capsule.version, sourceUrl: capsule.sourceUrl });
				setReservation(capsule.releaseId);
			}}>Choose JAR for {capsule.project}</button>}
			{canRetryCapsule(capsule) && <button disabled={busy} onClick={() => void run(async signal => {
				const result = await capsuleApi.retry(capsule.releaseId, ownerId, signal);
				if (!signal.aborted) { accept([result]); setMessage("Retry requested. Backend policy still determines whether scanning can proceed; nothing was published."); }
			})}>Retry scan for {capsule.project}</button>}
			{canWithdrawCapsule(capsule) && <button disabled={busy} onClick={() => setConfirmWithdraw(capsule.releaseId)}>Withdraw {capsule.project}</button>}
			{confirmWithdraw === capsule.releaseId && <div className="delete-confirmation">
				<p>Withdraw this unpublished release? This is terminal; retained quarantine bytes follow backend cleanup policy.</p>
				<button disabled={busy} onClick={() => void run(async signal => {
					const result = await capsuleApi.withdraw(capsule.releaseId, ownerId, signal);
					if (!signal.aborted) { accept([result]); setConfirmWithdraw(null); setMessage("Backend confirmed withdrawal. Nothing was published."); }
				})}>Confirm withdrawal</button>
				<button disabled={busy} onClick={() => setConfirmWithdraw(null)}>Cancel withdrawal</button>
			</div>}
		</li>)}</ul>
	</section>;
}
