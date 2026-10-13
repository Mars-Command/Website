// @vitest-environment jsdom
import { act, StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { siteAudio } from "../services/siteAudio";
import type { SoundProcess } from "../services/siteAudio";
import { useProcessSound } from "./useProcessSound";

let container: HTMLDivElement;
let root: Root;
let process: SoundProcess;
let sound: ReturnType<typeof useProcessSound>;

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	vi.spyOn(siteAudio, "startProcessFromGesture").mockImplementation((_cue, onStop) => {
		let active = true;
		process = {
			get active() {
				return active;
			},
			stop: vi.fn(() => {
				active = false;
				onStop();
			}),
			finish: vi.fn(),
		};
		return process;
	});
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});

function Harness({ visible = true }: { visible?: boolean }) {
	const current = useProcessSound(visible);
	useLayoutEffect(() => {
		sound = current;
	});
	return null;
}
async function render(visible = true) {
	await act(async () =>
		root.render(
			<StrictMode>
				<Harness visible={visible} />
			</StrictMode>,
		),
	);
}

describe("visible process sound ownership", () => {
	it("starts idempotently and clears the retained handle when the global service stops it", async () => {
		await render();
		const first = sound.start();
		expect(sound.start()).toBe(first);
		expect(siteAudio.startProcessFromGesture).toHaveBeenCalledOnce();
		process.stop();
		expect(sound.start()).not.toBe(first);
		expect(siteAudio.startProcessFromGesture).toHaveBeenCalledTimes(2);
	});

	it("stops an invisible process without cancelling its underlying operation", async () => {
		await render();
		sound.start();
		const running = process;
		await render(false);
		expect(running.stop).toHaveBeenCalledOnce();
		expect(sound.start()).toBeNull();
		await render();
		expect(siteAudio.startProcessFromGesture).toHaveBeenCalledOnce();
	});

	it("stops on unmount and starts a fresh handle after remount", async () => {
		await render();
		sound.start("connecting");
		const previous = process;
		await act(async () => root.unmount());
		expect(previous.stop).toHaveBeenCalledOnce();
		root = createRoot(container);
		await render();
		expect(sound.start("connecting")).not.toBe(previous);
	});

	it("accepts a null player handle", async () => {
		vi.mocked(siteAudio.startProcessFromGesture).mockReturnValue(null);
		await render();
		expect(sound.start()).toBeNull();
		sound.stop();
	});
});
