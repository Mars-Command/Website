// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUISFX } from "uisfx";
import type { PlayingSFX, UISFXPlayer } from "uisfx";
import { SoundSettings } from "../components/SoundSettings";
import { sitePath } from "../config/account";
import {
	SiteAudio,
	siteAudio,
	SOUND_PACK,
	SOUND_PREFERENCE_KEY,
} from "./siteAudio";

vi.mock("uisfx", () => ({ createUISFX: vi.fn() }));

const player = {
	play: vi.fn<UISFXPlayer["play"]>(),
	unlock: vi.fn<UISFXPlayer["unlock"]>(),
	preload: vi.fn<UISFXPlayer["preload"]>(),
	setPack: vi.fn<UISFXPlayer["setPack"]>(),
	getPack: vi.fn<UISFXPlayer["getPack"]>(),
	setVolume: vi.fn<UISFXPlayer["setVolume"]>(),
	getVolume: vi.fn<UISFXPlayer["getVolume"]>(),
	setEnabled: vi.fn<UISFXPlayer["setEnabled"]>(),
	isEnabled: vi.fn<UISFXPlayer["isEnabled"]>(),
	stopAll: vi.fn<UISFXPlayer["stopAll"]>(),
	destroy: vi.fn<UISFXPlayer["destroy"]>(),
} satisfies UISFXPlayer;
const contexts: FakeAudioContext[] = [];
const handles: PlayingSFX[] = [];
let resumeImmediately = true;
let resumeResult: Promise<void>;

class FakeAudioContext extends EventTarget {
	state: AudioContextState = "suspended";
	constructor() {
		super();
		contexts.push(this);
	}
	resume = vi.fn(() => {
		if (resumeImmediately) {
			this.state = "running";
			this.dispatchEvent(new Event("statechange"));
		}
		return resumeResult;
	});
	suspend = vi.fn(async () => {
		this.state = "suspended";
		this.dispatchEvent(new Event("statechange"));
	});
	close = vi.fn(async () => {
		this.state = "closed";
	});
}

let sound: SiteAudio;
let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
	(
		globalThis as typeof globalThis & {
			IS_REACT_ACT_ENVIRONMENT: boolean;
		}
	).IS_REACT_ACT_ENVIRONMENT = true;
	await siteAudio.dispose();
	siteAudio.setEnabled(false);
	siteAudio.setVolume(0.7);
	siteAudio.setTypingFromGesture(false);
	window.localStorage.clear();
	vi.clearAllMocks();
	contexts.length = 0;
	handles.length = 0;
	resumeImmediately = true;
	resumeResult = Promise.resolve();
	vi.stubGlobal("AudioContext", FakeAudioContext);
	vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
	vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
		() => {},
	);
	vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.mocked(createUISFX).mockReturnValue(player);
	player.destroy.mockResolvedValue();
	player.play.mockImplementation(() => {
		let end = () => {};
		const ended = new Promise<void>((resolve) => {
			end = resolve;
		});
		const handle = { stop: vi.fn(() => end()), ended };
		handles.push(handle);
		return handle;
	});
	sound = new SiteAudio();
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	await sound.dispose();
	await siteAudio.dispose();
	container.remove();
	window.localStorage.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("shared client sound player", () => {
	it("keeps a failed persistence warning visible after successful audio activation", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(
			() => {
				throw new DOMException(
					"Blocked",
					"SecurityError",
				);
			},
		);
		sound.enableFromGesture();
		expect(sound.getSnapshot().unlocked).toBe(true);
		expect(sound.getSnapshot().message).toContain(
			"could not be saved",
		);
	});

	it("stops hidden-tab work and does not queue its outcome for a later visit", () => {
		const detach = sound.attach();
		sound.setEnabled(true);
		const process = sound.startProcessFromGesture(
			"processing",
			vi.fn(),
		)!;
		vi.spyOn(document, "visibilityState", "get").mockReturnValue(
			"hidden",
		);
		document.dispatchEvent(new Event("visibilitychange"));
		expect(process.active).toBe(false);
		expect(player.stopAll).toHaveBeenCalledOnce();
		expect(sound.playOutcome("success")).toBeNull();
		vi.spyOn(document, "visibilityState", "get").mockReturnValue(
			"visible",
		);
		document.dispatchEvent(new Event("visibilitychange"));
		expect(sound.playOutcome("success")).toBeNull();
		sound.playFromGesture("forward");
		expect(createUISFX).toHaveBeenCalledOnce();
		detach();
	});

	it("restores preferences without creating audio or replaying asynchronous cues", () => {
		localStorage.setItem(
			SOUND_PREFERENCE_KEY,
			JSON.stringify({
				enabled: true,
				volume: 0.4,
				typing: false,
			}),
		);
		sound.initialize();
		expect(sound.getSnapshot()).toMatchObject({
			enabled: true,
			volume: 0.7,
			unlocked: true,
		});
		expect(sound.playOutcome("success")).toBeNull();
		expect(createUISFX).not.toHaveBeenCalled();
		expect(contexts).toHaveLength(0);
		expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
	});

	it("creates one scifi player and resumes its owned context synchronously in the first handler", () => {
		sound.enableFromGesture();
		expect(SOUND_PACK).toBe("scifi");
		expect(createUISFX).toHaveBeenCalledExactlyOnceWith({
			pack: "scifi",
			volume: 0.7,
			enabled: true,
			context: contexts[0],
		});
		expect(contexts[0].resume).toHaveBeenCalledOnce();
		expect(player.play).toHaveBeenCalledExactlyOnceWith(
			"toggle-on",
			undefined,
		);
		sound.playFromGesture("forward");
		sound.playOutcome("success");
		expect(createUISFX).toHaveBeenCalledOnce();
		expect(contexts).toHaveLength(1);
		expect(player.setPack).toHaveBeenCalledWith("scifi");
	});

	it("drops outcomes while unlock is pending rather than queuing them", async () => {
		resumeImmediately = false;
		let finish = () => {};
		resumeResult = new Promise<void>((resolve) => {
			finish = resolve;
		});
		sound.enableFromGesture();
		expect(sound.playOutcome("success")).toBeNull();
		contexts[0].state = "running";
		finish();
		await resumeResult;
		sound.playOutcome("error");
		expect(player.play.mock.calls.map(([cue]) => cue)).toEqual([
			"toggle-on",
			"error",
		]);
	});

	it("handles a null play handle without creating a retained process", () => {
		sound.setEnabled(true);
		player.play.mockReturnValueOnce(null);
		const stopped = vi.fn();
		expect(
			sound.startProcessFromGesture("loading", stopped),
		).toBeNull();
		sound.stopLoops();
		expect(stopped).not.toHaveBeenCalled();
	});

	it.each(["success", "error", "complete", "delete"] as const)(
		"stops a process before its real %s outcome",
		(cue) => {
			sound.setEnabled(true);
			const cleared = vi.fn();
			const process = sound.startProcessFromGesture(
				"processing",
				cleared,
			)!;
			const handle = handles[0];
			process.finish(cue);
			expect(handle.stop).toHaveBeenCalledOnce();
			expect(cleared).toHaveBeenCalledOnce();
			expect(process.active).toBe(false);
			expect(
				player.play.mock.calls.map(([name]) => name),
			).toEqual(["processing", cue]);
			expect(
				vi.mocked(handle.stop).mock
					.invocationCallOrder[0],
			).toBeLessThan(player.play.mock.invocationCallOrder[1]);
			process.finish("success");
			expect(player.play).toHaveBeenCalledTimes(2);
		},
	);

	it.each([
		"navigation",
		"logout",
		"mute",
		"zero-volume",
		"cancellation",
	] as const)(
		"clears loops and suppresses late outcomes on %s",
		(exit) => {
			sound.setEnabled(true);
			const cleared = vi.fn();
			const process = sound.startProcessFromGesture(
				"processing",
				cleared,
			)!;
			if (exit === "mute") sound.setEnabled(false);
			else if (exit === "zero-volume") sound.setVolume(0);
			else if (exit === "logout") sound.stopAll();
			else if (exit === "navigation") sound.stopLoops();
			else process.stop();
			expect(handles[0].stop).toHaveBeenCalledOnce();
			expect(cleared).toHaveBeenCalledOnce();
			expect(process.active).toBe(false);
			process.finish("complete");
			expect(
				player.play.mock.calls.map(([cue]) => cue),
			).toEqual(["processing"]);
			if (exit === "mute") {
				expect(
					player.stopAll.mock
						.invocationCallOrder[0],
				).toBeLessThan(
					player.setEnabled.mock
						.invocationCallOrder[0],
				);
				expect(player.setEnabled).toHaveBeenCalledWith(
					false,
				);
			}
		},
	);

	it("persists mute, volume and typing preferences independently of motion", () => {
		sound.enableFromGesture();
		sound.setVolume(0.32);
		sound.setTypingFromGesture(true);
		sound.setEnabled(false);
		const restored = new SiteAudio();
		restored.initialize();
		expect(restored.getSnapshot()).toMatchObject({
			enabled: true,
			volume: 0.7,
			typing: true,
			unlocked: true,
		});
		expect(player.setVolume).toHaveBeenCalledWith(0.32);
		expect(createUISFX).toHaveBeenCalledOnce();
	});

	it("surfaces invalid or inaccessible preference storage", () => {
		localStorage.setItem(SOUND_PREFERENCE_KEY, '{"enabled":"yes"}');
		sound.initialize();
		expect(sound.getSnapshot()).toMatchObject({ enabled: true });
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(
			() => {
				throw new DOMException(
					"Blocked",
					"SecurityError",
				);
			},
		);
		sound.setVolume(0.5);
		expect(sound.getSnapshot().volume).toBe(0.5);
		expect(console.error).toHaveBeenCalledTimes(1);
	});

	it("retains the player across a Strict Mode trial detach and destroys it only on final teardown", async () => {
		const detach = sound.attach();
		sound.enableFromGesture();
		detach();
		const finalDetach = sound.attach();
		await Promise.resolve();
		expect(player.destroy).not.toHaveBeenCalled();
		sound.playFromGesture("forward");
		expect(createUISFX).toHaveBeenCalledOnce();
		finalDetach();
		await Promise.resolve();
		await Promise.resolve();
		expect(player.destroy).toHaveBeenCalledOnce();
		expect(contexts[0].close).toHaveBeenCalledOnce();
		expect(player.destroy.mock.invocationCallOrder[0]).toBeLessThan(
			contexts[0].close.mock.invocationCallOrder[0],
		);
	});

	it("awaits player destruction before closing the caller-owned context", async () => {
		sound.enableFromGesture();
		let destroyed = () => {};
		player.destroy.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				destroyed = resolve;
			}),
		);
		const disposal = sound.dispose();
		expect(contexts[0].close).not.toHaveBeenCalled();
		destroyed();
		await disposal;
		expect(contexts[0].state).toBe("closed");
		expect(sound.playOutcome("success")).toBeNull();
	});

	it("stops all voices when the page enters the back-forward cache", () => {
		const detach = sound.attach();
		sound.enableFromGesture();
		window.dispatchEvent(
			new PageTransitionEvent("pagehide", {
				persisted: true,
			}),
		);
		expect(player.stopAll).toHaveBeenCalledOnce();
		expect(contexts[0].suspend).toHaveBeenCalledOnce();
		expect(sound.playOutcome("success")).toBeNull();
		detach();
	});
});

describe("gesture-started original intro tracks", () => {
	it("does not queue a missed typing cue when sound is re-enabled after entry", () => {
		const id = sound.beginIntro();
		sound.enableFromGesture();
		sound.setEnabled(false);
		sound.enterIntro(id, true);
		sound.enableFromGesture();
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
		expect(player.play).toHaveBeenCalledWith(
			"toggle-on",
			undefined,
		);
	});

	it("does not autoplay and lets opening continue when typing starts once", () => {
		const id = sound.beginIntro();
		expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
		sound.enableFromGesture();
		const opening = vi.mocked(HTMLMediaElement.prototype.play).mock
			.contexts[0];
		if (!(opening instanceof HTMLAudioElement))
			throw new Error("Opening audio missing");
		expect(opening.getAttribute("src")).toBe(
			sitePath("sounds/opening.mp3"),
		);
		expect(opening.loop).toBe(false);
		sound.enterIntro(id, true);
		const next = vi.mocked(HTMLMediaElement.prototype.play).mock
			.contexts[1];
		if (!(next instanceof HTMLAudioElement))
			throw new Error("Typing audio missing");
		expect(next.getAttribute("src")).toBe(
			sitePath("sounds/new_page.mp3"),
		);
		expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
		sound.enterIntro(id, true);
		sound.endIntro(id);
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(
			2,
		);
		expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
	});

	it("never plays the typing track after mute", () => {
		const id = sound.beginIntro();
		sound.enableFromGesture();
		sound.setEnabled(false);
		sound.enterIntro(id, true);
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
		expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(
			2,
		);
	});

	it("keeps audio independent of skipped or reduced-motion typing", () => {
		const id = sound.beginIntro();
		sound.enableFromGesture();
		sound.enterIntro(id, false);
		expect(sound.getSnapshot().enabled).toBe(true);
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
		expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
	});

	it("does not replay a stale opening when sound is enabled after loading", () => {
		const id = sound.beginIntro();
		sound.enterIntro(id, true);
		sound.enableFromGesture();
		expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
		expect(player.play).toHaveBeenCalledWith(
			"toggle-on",
			undefined,
		);
	});

	it("reports blocked playback and permits an explicit gesture retry", async () => {
		sound.beginIntro();
		vi.mocked(
			HTMLMediaElement.prototype.play,
		).mockRejectedValueOnce(
			new DOMException(
				"Activation required",
				"NotAllowedError",
			),
		);
		sound.enableFromGesture();
		await Promise.resolve();
		await Promise.resolve();
		expect(sound.getSnapshot()).toMatchObject({ unlocked: false });
		expect(sound.getSnapshot().message).toContain("Enable sound");
		sound.enableFromGesture();
		expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(
			2,
		);
	});

	it("ignores a playback cancellation caused by mute", async () => {
		sound.beginIntro();
		let reject = (_error: Error) => {};
		vi.mocked(HTMLMediaElement.prototype.play).mockReturnValueOnce(
			new Promise<void>((_resolve, fail) => {
				reject = fail;
			}),
		);
		sound.enableFromGesture();
		sound.setEnabled(false);
		reject(new DOMException("Paused", "AbortError"));
		await Promise.resolve();
		expect(console.error).not.toHaveBeenCalled();
		expect(sound.getSnapshot().enabled).toBe(false);
	});
});

describe("accessible sound settings", () => {
	it("does not create audio on mount and uses one click handler for pointer and keyboard activation", async () => {
		await act(async () =>
			root.render(
				<StrictMode>
					<SoundSettings />
				</StrictMode>,
			),
		);
		expect(createUISFX).not.toHaveBeenCalled();
		const button =
			container.querySelector<HTMLButtonElement>("button")!;
		expect(button.textContent).toBe("Enable sound");
		await act(async () => {
			button.dispatchEvent(
				new Event("pointerdown", { bubbles: true }),
			);
			button.dispatchEvent(
				new Event("pointerup", { bubbles: true }),
			);
			button.click();
		});
		expect(player.play.mock.calls.map(([cue]) => cue)).toEqual([
			"toggle-on",
		]);
		expect(button.textContent).toBe("Mute sound");
		await act(async () => {
			button.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}),
			);
			button.dispatchEvent(
				new KeyboardEvent("keyup", {
					key: "Enter",
					bubbles: true,
				}),
			);
			button.click();
		});
		expect(player.play).toHaveBeenCalledOnce();
		expect(siteAudio.getSnapshot().enabled).toBe(false);
		expect(
			JSON.parse(localStorage.getItem(SOUND_PREFERENCE_KEY)!),
		).toMatchObject({
			enabled: false,
		});
	});

	it("changes volume silently and does not sonify programmatic text updates", async () => {
		await act(async () => root.render(<SoundSettings />));
		await act(async () => siteAudio.enableFromGesture());
		const slider = container.querySelector<HTMLInputElement>(
			'input[type="range"]',
		)!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)!.set!.call(slider, "45");
			slider.dispatchEvent(
				new Event("input", { bubbles: true }),
			);
		});
		expect(siteAudio.getSnapshot().volume).toBe(0.45);
		expect(slider.getAttribute("aria-valuetext")).toBe(
			"45 percent",
		);
		await act(async () => siteAudio.setTypingFromGesture(true));
		player.play.mockClear();
		const input = document.createElement("input");
		container.append(input);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "a",
				bubbles: true,
			}),
		);
		expect(player.play).not.toHaveBeenCalled();
	});
});
