import { describe, expect, it, vi } from "vitest";
import { capsuleFailure, createCapsuleApi, isCapsule, isCapsuleEvidence, isCapsuleQueue } from "./capsuleApi";
import type { Capsule } from "../types/capsule";
import { canRetryCapsule, canWithdrawCapsule, MAX_JAR_BYTES, mergeCapsules, validateCapsuleInput, validateJar } from "../utils/capsuleUi";

const input = { project: "Mars mod", version: "1.0", sourceUrl: "https://example.com/mod" };
const capsule: Capsule = { ...input, releaseId: "a".repeat(32), ownerId: "42",
	createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z",
	artifactSha256: null, state: "reserved", revision: 1, evidence: null, queue: null, publicDownloadAvailable: false };
const bound: Capsule = { ...capsule, state: "scan_blocked", revision: 2, artifactSha256: "b".repeat(64),
	queue: { status: "blocked", attempts: 1, maxAttempts: 3, nextAttemptAt: null, lastError: "scanning_not_configured" },
	evidence: { version: 1, artifactSha256: "b".repeat(64), provider: "disabled", providerResultId: "unconfigured",
		policyVersion: "1", scannedAt: "2026-10-10T10:00:00Z", expiresAt: "2026-10-17T10:00:00Z",
		verdict: "blocked", summary: "scanning_not_configured" } };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const signal = () => new AbortController().signal;
function xhrMock() {
	return {
		open: vi.fn(), send: vi.fn(), abort: vi.fn(), setRequestHeader: vi.fn(),
		withCredentials: false, timeout: 0, status: 200, responseText: JSON.stringify(bound),
		upload: { onprogress: null as ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null },
		onload: null as (() => void) | null, onerror: null as (() => void) | null,
		ontimeout: null as (() => void) | null, onabort: null as (() => void) | null,
	};
}

describe("strict capsule contract", () => {
	it("accepts reserved and digest-bound scanner-blocked records", () => {
		expect(isCapsule(capsule)).toBe(true);
		expect(isCapsule(bound)).toBe(true);
		expect(isCapsule({ ...bound, state: "publishable", evidence: { ...bound.evidence, verdict: "accepted" } })).toBe(true);
	});
	it.each([
		{ state: "clean" }, { revision: 0 }, { revision: 1.2 }, { revision: Number.MAX_SAFE_INTEGER + 1 },
		{ releaseId: "invalid" }, { ownerId: "" }, { project: "" }, { version: [] },
		{ sourceUrl: "http://example.com" }, { sourceUrl: "https://user:secret@example.com" },
		{ sourceUrl: "https://example.com/#fragment" }, { publicDownloadAvailable: true },
		{ createdAt: "yesterday" }, { updatedAt: "2026-10-09T10:00:00Z" }, { evidence: {} },
		{ queue: { status: "pending" } }, { artifactSha256: "bad" }, { state: "publishable" },
	])("rejects malformed capsule fields %j", fields => expect(isCapsule({ ...capsule, ...fields })).toBe(false));
	it("rejects missing binding, mismatched evidence and invalid queue/evidence values", () => {
		expect(isCapsule({ ...bound, artifactSha256: null })).toBe(false);
		expect(isCapsule({ ...bound, evidence: { ...bound.evidence, artifactSha256: "c".repeat(64) } })).toBe(false);
		expect(isCapsule({ ...bound, state: "publishable" })).toBe(false);
		expect(isCapsuleQueue({ ...bound.queue, attempts: -1 })).toBe(false);
		expect(isCapsuleQueue({ ...bound.queue, attempts: 4 })).toBe(false);
		expect(isCapsuleQueue({ ...bound.queue, maxAttempts: 0 })).toBe(false);
		expect(isCapsuleQueue({ ...bound.queue, nextAttemptAt: "" })).toBe(false);
		expect(isCapsuleEvidence({ ...bound.evidence, version: 0 })).toBe(false);
		expect(isCapsuleEvidence({ ...bound.evidence, expiresAt: capsule.createdAt })).toBe(false);
		expect(isCapsuleEvidence({ ...bound.evidence, providerResultId: "" })).toBe(false);
	});
	it("preserves newer revisions and immutable facts independently of JSON key order", () => {
		expect(mergeCapsules([bound], [capsule])).toEqual([bound]);
		expect(mergeCapsules([bound], [{ ...bound, queue: { maxAttempts: 3, attempts: 1, status: "blocked", lastError: "scanning_not_configured", nextAttemptAt: null } }])).toEqual([bound]);
		expect(() => mergeCapsules([bound], [{ ...bound, project: "Changed", revision: 3 }])).toThrow("inconsistent");
		expect(() => mergeCapsules([bound], [{ ...bound, artifactSha256: "c".repeat(64), revision: 3 }])).toThrow("inconsistent");
		expect(() => mergeCapsules([bound], [{ ...bound, state: "withdrawn" }])).toThrow("inconsistent");
	});
});

describe("client help and eligibility", () => {
	it("checks extension, nonempty bytes and the exact 64 MiB boundary", () => {
		expect(validateJar(null)).toContain("Select");
		expect(validateJar(new File(["x"], "mod.zip"))).toContain(".jar");
		expect(validateJar(new File([], "mod.jar"))).toContain("empty");
		const jar = new File(["x"], "MOD.JAR");
		Object.defineProperty(jar, "size", { value: MAX_JAR_BYTES, configurable: true });
		expect(validateJar(jar)).toBe("");
		Object.defineProperty(jar, "size", { value: MAX_JAR_BYTES + 1 });
		expect(validateJar(jar)).toContain("64 MiB");
	});
	it("validates metadata and shows only eligible actions", () => {
		expect(validateCapsuleInput(input)).toBe("");
		expect(validateCapsuleInput({ ...input, project: " " })).toContain("project");
		expect(validateCapsuleInput({ ...input, version: "x".repeat(81) })).toContain("80");
		expect(validateCapsuleInput({ ...input, sourceUrl: "https://example.com/#bad" })).toContain("HTTPS");
		expect(canRetryCapsule(bound)).toBe(true);
		expect(canRetryCapsule({ ...bound, state: "rejected" })).toBe(false);
		expect(canRetryCapsule({ ...bound, queue: { ...bound.queue!, attempts: 3 } })).toBe(false);
		expect(canRetryCapsule({ ...bound, queue: { ...bound.queue!, status: "leased" } })).toBe(false);
		expect(canWithdrawCapsule({ ...bound, state: "publishable" })).toBe(true);
		expect(canWithdrawCapsule({ ...capsule, state: "uploading" })).toBe(true);
		expect(canWithdrawCapsule({ ...bound, state: "expired" })).toBe(false);
	});
});

describe("authenticated capsule API", () => {
	it("fails closed without a configured base", async () => {
		const fetcher = vi.fn();
		await expect(createCapsuleApi(null, fetcher).mine("42", signal())).rejects.toThrow("not configured");
		expect(fetcher).not.toHaveBeenCalled();
	});
	it("reserves with JSON/idempotency and uses cookie owner-scoped routes", async () => {
		const fetcher = vi.fn().mockImplementation(async () => json(capsule));
		const api = createCapsuleApi("https://backend.example/base", fetcher);
		expect(await api.reserve(input, "key-1", "42", signal())).toEqual(capsule);
		expect(fetcher).toHaveBeenLastCalledWith("https://backend.example/base/api/community/capsules", expect.objectContaining({
			method: "POST", credentials: "include", body: JSON.stringify(input),
			headers: { Accept: "application/json", "Content-Type": "application/json", "Idempotency-Key": "key-1" },
		}));
		await api.read(capsule.releaseId, "42", signal());
		await api.retry(capsule.releaseId, "42", signal());
		expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining(`/${capsule.releaseId}/retry`), expect.objectContaining({ method: "POST", body: undefined }));
		fetcher.mockResolvedValueOnce(json({ ...capsule, state: "withdrawn", revision: 2 }));
		expect((await api.withdraw(capsule.releaseId, "42", signal())).state).toBe("withdrawn");
		fetcher.mockResolvedValueOnce(json({ capsules: [capsule] }));
		expect(await api.mine("42", signal())).toEqual([capsule]);
	});
	it("rejects another owner, wrong release, duplicate/malformed lists and unconfirmed withdrawal", async () => {
		const fetcher = vi.fn().mockImplementation(async () => json(capsule));
		const api = createCapsuleApi("https://backend.example", fetcher);
		await expect(api.reserve(input, "key-1", "99", signal())).rejects.toThrow("mismatched");
		await expect(api.read("c".repeat(32), "42", signal())).rejects.toThrow("mismatched");
		await expect(api.withdraw(capsule.releaseId, "42", signal())).rejects.toThrow("confirm withdrawal");
		await expect(api.reserve({ ...input, project: "Different" }, "key-1", "42", signal())).rejects.toThrow("mismatched reservation metadata");
		for (const data of [{}, { capsules: [null] }, { capsules: [capsule, capsule] }, { capsules: [{ ...capsule, ownerId: "99" }] }]) {
			fetcher.mockResolvedValueOnce(json(data));
			await expect(api.mine("42", signal())).rejects.toThrow();
		}
	});
	it("reports network/JSON failures and validates error shape without rendering backend messages", async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error("secret"));
		const api = createCapsuleApi("https://backend.example", fetcher);
		await expect(api.mine("42", signal())).rejects.toThrow("may have reached");
		fetcher.mockResolvedValueOnce(new Response("not json"));
		await expect(api.mine("42", signal())).rejects.toThrow("invalid response");
		fetcher.mockResolvedValueOnce(json({ detail: { code: "artifact_invalid", message: "secret path" } }, 422));
		await expect(api.reserve(input, "key", "42", signal())).rejects.toMatchObject({ code: "artifact_invalid", status: 422, message: expect.stringContaining("safe JAR") });
		expect(capsuleFailure({ detail: "secret" }, 400).message).toContain("invalid error");
		expect(capsuleFailure({ detail: { code: 1, message: "bad" } }, 400).code).toBeUndefined();
		expect(capsuleFailure({ detail: { code: "scanning_not_configured", message: "secret" } }, 409).message).toContain("private and unpublished");
	});
	it("uploads raw File bytes with credentialed XHR and distinguishes sent progress from binding", async () => {
		const xhr = xhrMock();
		const api = createCapsuleApi("https://backend.example", vi.fn(), () => xhr as unknown as XMLHttpRequest);
		const progress = vi.fn();
		const file = new File(["jar"], "mod.jar");
		const result = api.upload(capsule.releaseId, file, "42", signal(), progress);
		expect(xhr.open).toHaveBeenCalledWith("PUT", `https://backend.example/api/community/capsules/${capsule.releaseId}/artifact`);
		expect(xhr.withCredentials).toBe(true);
		expect(xhr.timeout).toBe(120000);
		expect(xhr.send).toHaveBeenCalledWith(file);
		expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "application/java-archive");
		xhr.upload.onprogress?.({ loaded: 1, total: 2, lengthComputable: true });
		expect(progress).toHaveBeenCalledWith(50);
		xhr.onload?.();
		expect(await result).toEqual(bound);
	});
	it.each(["onerror", "ontimeout", "onabort"] as const)("reports %s and allows the same raw upload to be retried", async failure => {
		const xhr = xhrMock();
		const api = createCapsuleApi("https://backend.example", vi.fn(), () => xhr as unknown as XMLHttpRequest);
		const file = new File(["jar"], "mod.jar");
		const first = api.upload(capsule.releaseId, file, "42", signal(), vi.fn());
		xhr[failure]?.();
		await expect(first).rejects.toThrow("interrupted");
		const retry = api.upload(capsule.releaseId, file, "42", signal(), vi.fn());
		xhr.onload?.();
		expect(await retry).toEqual(bound);
	});
	it("aborts on teardown and fails closed for malformed or unbound upload replies", async () => {
		const xhr = xhrMock();
		const api = createCapsuleApi("https://backend.example", vi.fn(), () => xhr as unknown as XMLHttpRequest);
		const file = new File(["jar"], "mod.jar");
		const controller = new AbortController();
		const uploading = api.upload(capsule.releaseId, file, "42", controller.signal, vi.fn());
		controller.abort();
		await expect(uploading).rejects.toThrow("cancelled");
		expect(xhr.abort).toHaveBeenCalledOnce();
		for (const reply of ["not-json", JSON.stringify(capsule), JSON.stringify({ ...bound, ownerId: "99" })]) {
			xhr.responseText = reply;
			const result = api.upload(capsule.releaseId, file, "42", signal(), vi.fn());
			xhr.onload?.();
			await expect(result).rejects.toThrow();
		}
	});
});
