// @vitest-environment jsdom
import { act, StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serverStatusProvider } from "../services/serverStatus";
import { siteAudio } from "../services/siteAudio";
import { recordProcessSounds } from "../services/siteAudio.testUtils";
import type { ServerStatus } from "../types/server";
import { useServerStatus } from "./useServerStatus";

const status: ServerStatus = {
	online: true,
	host: "play.nexusgit.info",
	port: 25565,
	playersOnline: 2,
	playersMax: 67,
	latencyMs: null,
	motd: "Mars",
	versionName: null,
	checkedAt: "2026-10-13T01:00:00Z",
	error: null,
};
let container: HTMLDivElement;
let root: Root;
let feed: ReturnType<typeof useServerStatus>;

function Harness() {
	const current = useServerStatus();
	useLayoutEffect(() => {
		feed = current;
	});
	return <p>{current.status?.error ?? current.status?.playersOnline}</p>;
}
function deferred() {
	let resolve!: (value: ServerStatus) => void;
	const promise = new Promise<ServerStatus>((finish) => {
		resolve = finish;
	});
	return { promise, resolve };
}

beforeEach(() => {
	(
		globalThis as typeof globalThis & {
			IS_REACT_ACT_ENVIRONMENT: boolean;
		}
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers();
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	vi.spyOn(serverStatusProvider, "getStatus").mockResolvedValue(status);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
	vi.useRealTimers();
});
async function render() {
	await act(async () =>
		root.render(
			<StrictMode>
				<Harness />
			</StrictMode>,
		),
	);
}

describe("explicit telemetry refresh sounds", () => {
	it("keeps startup and periodic polling silent", async () => {
		recordProcessSounds();
		await render();
		await act(async () => vi.advanceTimersByTimeAsync(15000));
		expect(
			siteAudio.startProcessFromGesture,
		).not.toHaveBeenCalled();
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		expect(serverStatusProvider.getStatus).toHaveBeenCalledTimes(2);
	});

	it.each([null, "Status request timed out"])(
		"waits for the real manual response before its outcome (%s)",
		async (error) => {
			const processes = recordProcessSounds();
			await render();
			const next = deferred();
			vi.mocked(
				serverStatusProvider.getStatus,
			).mockReturnValueOnce(next.promise);
			await act(async () => {
				feed.refresh();
				feed.refresh();
			});
			expect(
				siteAudio.startProcessFromGesture,
			).toHaveBeenCalledExactlyOnceWith(
				"loading",
				expect.any(Function),
			);
			expect(siteAudio.playOutcome).not.toHaveBeenCalled();
			await act(async () =>
				next.resolve({
					...status,
					error,
					playersOnline: 4,
				}),
			);
			expect(processes[0].active).toBe(false);
			expect(
				siteAudio.playOutcome,
			).toHaveBeenCalledExactlyOnceWith(
				error ? "error" : "success",
			);
			expect(container.textContent).toBe(error ?? "4");
		},
	);

	it("stops on unmount and ignores a late response", async () => {
		const processes = recordProcessSounds();
		await render();
		const next = deferred();
		vi.mocked(serverStatusProvider.getStatus).mockReturnValueOnce(
			next.promise,
		);
		await act(async () => feed.refresh());
		await act(async () => root.unmount());
		expect(processes[0].active).toBe(false);
		await act(async () => next.resolve(status));
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		root = createRoot(container);
	});
});
