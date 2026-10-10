// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/accountApi";
import { capsuleApi } from "../services/capsuleApi";
import type { Capsule } from "../types/capsule";
import { MAX_JAR_BYTES } from "../utils/capsuleUi";
import { CapsuleSubmissions } from "./CapsuleSubmissions";

const input = { project: "Mars mod", version: "1", sourceUrl: "https://example.com/mod" };
const reserved: Capsule = { ...input, releaseId: "a".repeat(32), ownerId: "42", artifactSha256: null,
	state: "reserved", revision: 1, createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z",
	evidence: null, queue: null, publicDownloadAvailable: false };
const blocked: Capsule = { ...reserved, state: "scan_blocked", revision: 2, artifactSha256: "b".repeat(64),
	queue: { status: "blocked", attempts: 1, maxAttempts: 3, nextAttemptAt: null, lastError: "scanning_not_configured" } };
let container: HTMLDivElement;
let root: Root;
const expired = vi.fn();

beforeEach(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	vi.spyOn(capsuleApi, "mine").mockResolvedValue([]);
	vi.spyOn(capsuleApi, "reserve").mockResolvedValue(reserved);
	vi.spyOn(capsuleApi, "upload").mockResolvedValue(blocked);
	vi.spyOn(capsuleApi, "read").mockResolvedValue(blocked);
	vi.spyOn(capsuleApi, "retry").mockResolvedValue({ ...blocked, state: "scan_pending", revision: 3 });
	vi.spyOn(capsuleApi, "withdraw").mockResolvedValue({ ...blocked, state: "withdrawn", revision: 3 });
	expired.mockReset();
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});
async function render(ownerId = "42") {
	await act(async () => root.render(<CapsuleSubmissions key={ownerId} ownerId={ownerId} onSessionExpired={expired} />));
}
function button(text: string) {
	const found = [...container.querySelectorAll("button")].find(value => value.textContent === text);
	if (!found) throw new Error(`Missing button: ${text}`);
	return found;
}
async function click(text: string) { await act(async () => button(text).click()); }
async function fillInput(label: string, value: string) {
	const element = [...container.querySelectorAll("label")].find(item => item.textContent === label)?.querySelector("input");
	if (!element) throw new Error(`Missing input: ${label}`);
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
		element.dispatchEvent(new Event("input", { bubbles: true }));
	});
}
async function select(file: File) {
	const element = container.querySelector<HTMLInputElement>('input[type="file"]')!;
	await act(async () => {
		Object.defineProperty(element, "files", { value: [file], configurable: true });
		element.dispatchEvent(new Event("change", { bubbles: true }));
	});
}
async function ready() {
	await fillInput("Project", input.project);
	await fillInput("Release version", input.version);
	await fillInput("Source URL (HTTPS)", input.sourceUrl);
	await select(new File(["jar"], "mission.jar"));
}
async function submit() {
	await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}

describe("private JAR submission UX", () => {
	it("reserves immutable metadata, uploads raw selected file and explains scanner blocking", async () => {
		await render();
		await ready();
		await submit();
		expect(capsuleApi.reserve).toHaveBeenCalledWith(input, expect.any(String), "42", expect.any(AbortSignal));
		expect(capsuleApi.upload).toHaveBeenCalledWith(reserved.releaseId, expect.any(File), "42", expect.any(AbortSignal), expect.any(Function));
		expect(container.textContent).toContain("Scanning blocked");
		expect(container.textContent).toContain("private and unpublished");
		expect(container.textContent).toContain("Backend SHA-256");
		expect(button("Retry JAR upload").disabled).toBe(true);
		expect(container.querySelector<HTMLInputElement>('input[type="file"]')!.disabled ||
			container.querySelector<HTMLInputElement>('input[type="file"]')!.closest("fieldset")!.disabled).toBe(true);
		expect(container.querySelector('a[href*="artifact"]')).toBeNull();
	});
	it("rejects wrong extensions, empty and oversized files without reservation", async () => {
		await render();
		await ready();
		for (const file of [new File(["bad"], "mod.zip"), new File([], "mod.jar")]) {
			await select(file); await submit();
			expect(container.querySelector('[role="alert"]')).not.toBeNull();
		}
		const oversized = new File(["jar"], "large.jar");
		Object.defineProperty(oversized, "size", { value: MAX_JAR_BYTES + 1 });
		await select(oversized); await submit();
		expect(container.textContent).toContain("64 MiB");
		expect(capsuleApi.reserve).not.toHaveBeenCalled();
	});
	it("shows upload progress without declaring backend acceptance, and retries interruption on the same reservation", async () => {
		const first = deferred<Capsule>();
		let report!: (value: number) => void;
		vi.mocked(capsuleApi.upload).mockImplementationOnce((_id, _file, _owner, _signal, progress) => { report = progress; return first.promise; });
		await render(); await ready(); await submit();
		await act(async () => report(100));
		expect(container.textContent).toContain("waiting for backend validation");
		expect(container.textContent).not.toContain("Backend confirmed");
		await act(async () => first.reject(new ApiError("Upload interrupted. Refresh first.")));
		expect(container.textContent).toContain("interrupted");
		vi.mocked(capsuleApi.read).mockResolvedValueOnce(reserved);
		await click("Refresh Mars mod");
		await submit();
		expect(capsuleApi.reserve).toHaveBeenCalledOnce();
		expect(capsuleApi.upload).toHaveBeenCalledTimes(2);
		const calls = vi.mocked(capsuleApi.upload).mock.calls;
		expect(calls[0][0]).toBe(calls[1][0]);
		expect(calls[0][1]).toBe(calls[1][1]);
	});
	it("reuses an uncertain reservation key and keeps metadata locked", async () => {
		vi.mocked(capsuleApi.reserve).mockRejectedValueOnce(new ApiError("Connection interrupted"));
		await render(); await ready(); await submit();
		const key = vi.mocked(capsuleApi.reserve).mock.calls[0][1];
		expect(container.querySelectorAll("fieldset")[0].disabled).toBe(true);
		await submit();
		expect(vi.mocked(capsuleApi.reserve).mock.calls[1][1]).toBe(key);
		expect(capsuleApi.upload).toHaveBeenCalledOnce();
	});
	it("cancels an upload locally, permits refresh and ignores its late completion", async () => {
		const old = deferred<Capsule>();
		vi.mocked(capsuleApi.upload).mockReturnValueOnce(old.promise);
		await render(); await ready(); await submit();
		const uploadSignal = vi.mocked(capsuleApi.upload).mock.calls[0][3];
		await click("Cancel JAR upload");
		expect(uploadSignal.aborted).toBe(true);
		expect(button("Refresh submissions").disabled).toBe(false);
		expect(container.textContent).toContain("cancelled locally");
		vi.mocked(capsuleApi.read).mockResolvedValueOnce(reserved);
		await click("Refresh Mars mod");
		await act(async () => old.resolve(blocked));
		expect(container.textContent).not.toContain("Scanning blocked");
		expect(button("Retry JAR upload").disabled).toBe(false);
	});
	it("refreshes a lost upload success without sending another JAR", async () => {
		vi.mocked(capsuleApi.upload).mockRejectedValueOnce(new ApiError("Upload interrupted"));
		await render(); await ready(); await submit();
		await click("Refresh Mars mod");
		expect(button("Retry JAR upload").disabled).toBe(true);
		expect(capsuleApi.upload).toHaveBeenCalledOnce();
	});
	it("resumes an existing unbound reservation after reload without reserving again", async () => {
		vi.mocked(capsuleApi.mine).mockResolvedValueOnce([reserved]);
		await render();
		await click("Choose JAR for Mars mod");
		await select(new File(["jar"], "mission.jar"));
		await submit();
		expect(capsuleApi.reserve).not.toHaveBeenCalled();
		expect(capsuleApi.upload).toHaveBeenCalledOnce();
	});
	it("supports eligible scan retry, explicit withdrawal confirmation and terminal status", async () => {
		vi.mocked(capsuleApi.mine).mockResolvedValueOnce([blocked]);
		await render();
		await click("Retry scan for Mars mod");
		expect(container.textContent).toContain("scan_pending");
		expect(container.textContent).not.toContain("Retry scan for Mars mod");
		vi.mocked(capsuleApi.withdraw).mockResolvedValueOnce({ ...blocked, state: "withdrawn", revision: 4 });
		await click("Withdraw Mars mod");
		expect(capsuleApi.withdraw).not.toHaveBeenCalled();
		await click("Confirm withdrawal");
		expect(container.textContent).toContain("Submission withdrawn");
		expect(container.textContent).not.toContain("Confirm withdrawal");
	});
	it("reports API guard failures and refresh recovery without success-shaped empty output", async () => {
		vi.mocked(capsuleApi.mine).mockRejectedValueOnce(new ApiError("Mission control returned an invalid capsule list."));
		await render();
		expect(container.textContent).toContain("invalid capsule list");
		expect(container.textContent).not.toContain("No JAR submissions yet");
		await click("Refresh submissions");
		expect(container.textContent).toContain("No JAR submissions yet");
	});
	it("never lets an older refresh replace a newer operational revision", async () => {
		vi.mocked(capsuleApi.mine).mockResolvedValueOnce([blocked]);
		vi.mocked(capsuleApi.read).mockResolvedValueOnce(reserved);
		await render(); await click("Refresh Mars mod");
		expect(container.textContent).toContain("revision 2");
		expect(container.textContent).toContain("scan_blocked");
	});
	it("does not offer rejected retries or imply that publishable means public", async () => {
		vi.mocked(capsuleApi.mine).mockResolvedValueOnce([{ ...blocked, state: "publishable" }, { ...blocked, releaseId: "c".repeat(32), project: "Rejected", state: "rejected" }]);
		await render();
		expect(container.textContent).toContain("Workflow complete");
		expect(container.textContent).toContain("Still private");
		expect(container.textContent).not.toContain("Retry scan for");
		expect(container.querySelector("a")).toBeNull();
	});
});

describe("identity and stale-request isolation", () => {
	it("aborts late list responses on account changes and does not reveal old metadata", async () => {
		const old = deferred<Capsule[]>();
		vi.mocked(capsuleApi.mine).mockReturnValueOnce(old.promise);
		await render();
		const oldSignal = vi.mocked(capsuleApi.mine).mock.calls[0][1];
		await render("99");
		expect(oldSignal.aborted).toBe(true);
		await act(async () => old.resolve([blocked]));
		expect(container.textContent).not.toContain("Mars mod");
		expect(container.textContent).toContain("No JAR submissions yet");
	});
	it("aborts upload and ignores late response/progress after identity replacement", async () => {
		const old = deferred<Capsule>();
		let report!: (value: number) => void;
		vi.mocked(capsuleApi.upload).mockImplementationOnce((_id, _file, _owner, _signal, progress) => { report = progress; return old.promise; });
		await render(); await ready(); await submit();
		const oldSignal = vi.mocked(capsuleApi.upload).mock.calls[0][3];
		await render("99");
		expect(oldSignal.aborted).toBe(true);
		await act(async () => { report(100); old.resolve(blocked); });
		expect(container.textContent).not.toContain("Mars mod");
		expect(container.textContent).not.toContain("Backend confirmed");
		expect(container.querySelector("progress")).toBeNull();
	});
	it("refreshes authentication on HTTP 401 without retaining old results", async () => {
		vi.mocked(capsuleApi.mine).mockRejectedValueOnce(new ApiError("Session expired", 401));
		await render();
		expect(expired).toHaveBeenCalledOnce();
	});
});
