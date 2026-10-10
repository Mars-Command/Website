import { accountConfig, safeHttpUrl } from "../config/account";
import { ApiError } from "./accountApi";
import { capsuleStates } from "../types/capsule";
import type { Capsule, CapsuleEvidence, CapsuleInput, CapsuleQueue } from "../types/capsule";
import { validateCapsuleInput, validateJar } from "../utils/capsuleUi";

const object = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const integer = (value: unknown, minimum: number): value is number =>
	typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === "string" &&
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
	Number.isFinite(Date.parse(value));

export function isCapsuleEvidence(value: unknown): value is CapsuleEvidence {
	return object(value) && integer(value.version, 1) && digest(value.artifactSha256) &&
		text(value.provider) && text(value.providerResultId) && text(value.policyVersion) &&
		timestamp(value.scannedAt) && timestamp(value.expiresAt) &&
		Date.parse(value.expiresAt) > Date.parse(value.scannedAt) &&
		typeof value.verdict === "string" && ["accepted", "rejected", "blocked", "error"].includes(value.verdict) &&
		typeof value.summary === "string";
}

export function isCapsuleQueue(value: unknown): value is CapsuleQueue {
	return object(value) && typeof value.status === "string" && ["pending", "leased", "complete", "blocked", "failed"].includes(value.status) &&
		integer(value.attempts, 0) && integer(value.maxAttempts, 1) && value.attempts <= value.maxAttempts &&
		(value.nextAttemptAt === null || timestamp(value.nextAttemptAt)) &&
		(value.lastError === null || typeof value.lastError === "string");
}

export function isCapsule(value: unknown): value is Capsule {
	if (!object(value) || typeof value.releaseId !== "string" || !/^[a-f0-9]{32}$/.test(value.releaseId) ||
		!text(value.ownerId) || !text(value.project) || value.project.length > 120 || !text(value.version) || value.version.length > 80 ||
		typeof value.sourceUrl !== "string" || safeHttpUrl(value.sourceUrl)?.startsWith("https://") !== true ||
		value.sourceUrl.length > 2048 || !!new URL(value.sourceUrl).hash ||
		!timestamp(value.createdAt) || !timestamp(value.updatedAt) || Date.parse(value.updatedAt) < Date.parse(value.createdAt) ||
		!integer(value.revision, 1) || !capsuleStates.includes(value.state as Capsule["state"]) ||
		!(value.artifactSha256 === null || digest(value.artifactSha256)) ||
		!(value.evidence === null || isCapsuleEvidence(value.evidence)) ||
		!(value.queue === null || isCapsuleQueue(value.queue)) || value.publicDownloadAvailable !== false) return false;
	if (["reserved", "uploading"].includes(String(value.state)) && value.artifactSha256 !== null) return false;
	if (["quarantined", "scan_pending", "scan_blocked", "rejected", "publishable"].includes(String(value.state)) &&
		!digest(value.artifactSha256)) return false;
	if (value.evidence && value.evidence.artifactSha256 !== value.artifactSha256) return false;
	if (value.state === "publishable" && (!value.evidence || value.evidence.verdict !== "accepted")) return false;
	return true;
}

const failureMessages: Record<string, string> = {
	release_not_found: "This release is no longer available to your account.",
	idempotency_conflict: "Reservation metadata conflicts with an earlier request. Refresh before starting a new submission.",
	upload_in_progress: "An upload is already in progress. Refresh before retrying.",
	upload_timeout: "The backend timed out while receiving the JAR. Refresh before retrying the same reservation.",
	release_already_bound: "This release already has immutable artifact bytes. Refresh its status; a different JAR requires a new release.",
	invalid_state: "This release cannot perform that action in its current state. Refresh its status.",
	submission_limit: "Your account has reached the active submission limit (default: 10). Withdraw an unused submission or wait for expiry.",
	retry_not_eligible: "This scan is not eligible for retry. Refresh its status.",
	artifact_too_large: "The backend refused this JAR as too large (default limit: 64 MiB).",
	artifact_empty: "The backend refused an empty JAR.",
	artifact_invalid: "The backend could not validate this file as a safe JAR archive.",
	invalid_input: "The backend refused the release metadata. Check the project, version and HTTPS source URL.",
	unsupported_media_type: "The backend refused the artifact upload format.",
	storage_unavailable: "Private artifact storage is unavailable. Refresh and try again later.",
	scanning_not_configured: "Scanning is not configured. Your JAR remains private and unpublished.",
};

export function capsuleFailure(data: unknown, status: number): ApiError {
	const detail = object(data) ? data.detail : undefined;
	if (!object(detail) || !text(detail.code) || !/^[a-z][a-z0-9_]{0,127}$/.test(detail.code) ||
		!text(detail.message)) return new ApiError(`Mission control refused the request (HTTP ${status}); invalid error response.`, status);
	const message = status === 401 ? "Your session has expired. Check your session before continuing." :
		status === 403 ? "Your account or browser origin is not permitted to perform this action." :
			status === 429 ? "Too many requests. Wait before trying again." :
				failureMessages[detail.code] ?? `Mission control refused the request (HTTP ${status}). Refresh before retrying.`;
	return new ApiError(message, status, detail.code);
}

export function createCapsuleApi(base: string | null, fetcher: typeof fetch = fetch,
	xhrFactory: () => XMLHttpRequest = () => new XMLHttpRequest()) {
	function url(path: string) {
		if (base === null) throw new ApiError("Account API is not configured. Contact mission control.");
		return `${base}/api/community/capsules${path}`;
	}
	function owned(data: unknown, ownerId: string, releaseId?: string): Capsule {
		if (!isCapsule(data) || data.ownerId !== ownerId || (releaseId && data.releaseId !== releaseId)) {
			throw new ApiError("Mission control returned an invalid or mismatched capsule.");
		}
		return data;
	}
	async function request(path: string, method: string, signal: AbortSignal, body?: CapsuleInput, key?: string) {
		const endpoint = url(path);
		let response: Response;
		try {
			response = await fetcher(endpoint, {
				method, credentials: "include",
				headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}),
					...(key ? { "Idempotency-Key": key } : {}) },
				body: body ? JSON.stringify(body) : undefined,
				signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
			});
		} catch {
			throw new ApiError("Unable to contact mission control. Refresh before retrying; the request may have reached the backend.");
		}
		let data: unknown;
		try { data = await response.json(); } catch {
			throw new ApiError("Mission control returned an invalid response. Refresh before retrying.", response.status);
		}
		if (!response.ok) throw capsuleFailure(data, response.status);
		return data;
	}
	const pathFor = (id: string) => `/${encodeURIComponent(id)}`;
	return {
		async mine(ownerId: string, signal: AbortSignal): Promise<Capsule[]> {
			const data = await request("/mine", "GET", signal);
			if (!object(data) || !Array.isArray(data.capsules)) throw new ApiError("Mission control returned an invalid capsule list.");
			const capsules = data.capsules.map(value => owned(value, ownerId));
			if (new Set(capsules.map(value => value.releaseId)).size !== capsules.length) throw new ApiError("Mission control returned duplicate releases.");
			return capsules;
		},
		async reserve(input: CapsuleInput, key: string, ownerId: string, signal: AbortSignal) {
			const invalid = validateCapsuleInput(input);
			if (invalid || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError(invalid || "Invalid reservation key.");
			const capsule = owned(await request("", "POST", signal, input, key), ownerId);
			if (capsule.project !== input.project.trim() || capsule.version !== input.version.trim() ||
				safeHttpUrl(capsule.sourceUrl) !== safeHttpUrl(input.sourceUrl)) {
				throw new ApiError("Mission control returned mismatched reservation metadata. No JAR was sent.");
			}
			return capsule;
		},
		async read(id: string, ownerId: string, signal: AbortSignal) {
			return owned(await request(pathFor(id), "GET", signal), ownerId, id);
		},
		async retry(id: string, ownerId: string, signal: AbortSignal) {
			return owned(await request(`${pathFor(id)}/retry`, "POST", signal), ownerId, id);
		},
		async withdraw(id: string, ownerId: string, signal: AbortSignal) {
			const capsule = owned(await request(`${pathFor(id)}/withdraw`, "POST", signal), ownerId, id);
			if (capsule.state !== "withdrawn") throw new ApiError("Backend did not confirm withdrawal. Refresh the release.");
			return capsule;
		},
		upload(id: string, file: File, ownerId: string, signal: AbortSignal, progress: (percent: number) => void): Promise<Capsule> {
			const invalid = validateJar(file);
			if (invalid) return Promise.reject(new ApiError(invalid));
			const endpoint = url(`${pathFor(id)}/artifact`);
			return new Promise((resolve, reject) => {
				const xhr = xhrFactory();
				const abort = () => { xhr.abort(); reject(new ApiError("Upload cancelled. Refresh to check whether the backend received the JAR.")); };
				const cleanup = () => signal.removeEventListener("abort", abort);
				xhr.open("PUT", endpoint);
				xhr.withCredentials = true;
				xhr.timeout = 120000;
				xhr.setRequestHeader("Accept", "application/json");
				xhr.setRequestHeader("Content-Type", "application/java-archive");
				xhr.upload.onprogress = event => {
					if (!signal.aborted && event.lengthComputable && event.total > 0) progress(Math.min(100, Math.round(event.loaded / event.total * 100)));
				};
				xhr.onload = () => {
					cleanup();
					try {
						const data: unknown = JSON.parse(xhr.responseText);
						if (xhr.status < 200 || xhr.status >= 300) throw capsuleFailure(data, xhr.status);
						const capsule = owned(data, ownerId, id);
						if (!capsule.artifactSha256) throw new ApiError("Backend did not confirm artifact binding. Refresh before retrying.");
						resolve(capsule);
					} catch (error) {
						reject(error instanceof ApiError ? error : new ApiError("Mission control returned an invalid upload response. Refresh before retrying."));
					}
				};
				xhr.onerror = xhr.ontimeout = xhr.onabort = () => {
					cleanup();
					reject(new ApiError("Upload interrupted. Refresh its status, then retry the same JAR and reservation if no digest was bound."));
				};
				signal.addEventListener("abort", abort, { once: true });
				if (signal.aborted) { cleanup(); abort(); } else {
					try { xhr.send(file); } catch { cleanup(); reject(new ApiError("Unable to start the JAR upload.")); }
				}
			});
		},
	};
}

export const capsuleApi = createCapsuleApi(accountConfig.apiBase);
