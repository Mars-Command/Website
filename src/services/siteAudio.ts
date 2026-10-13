import { createUISFX } from "uisfx";
import type { CueName, PlayingSFX, PlayOptions, UISFXPlayer } from "uisfx";
import { sitePath } from "../config/account";

export const SOUND_PACK = "scifi";
export const SOUND_PREFERENCE_KEY = "mars-command:sound";
export type LoopCue =
	"loading" | "processing" | "recording" | "connecting" | "scanning" | "streaming";
export type OneShotCue = Exclude<CueName, LoopCue>;
export type SoundProcess = {
	stop: () => void;
	finish: (cue: OneShotCue) => void;
	readonly active: boolean;
};

type SoundState = {
	enabled: boolean;
	volume: number;
	typing: boolean;
	unlocked: boolean;
	message: string;
};
const initialState: SoundState = {
	enabled: false,
	volume: 0.7,
	typing: false,
	unlocked: false,
	message: "",
};

export class SiteAudio {
	private state = initialState;
	private initialized = false;
	private listeners = new Set<() => void>();
	private player: UISFXPlayer | null = null;
	private context: AudioContext | null = null;
	private processes = new Set<SoundProcess>();
	private opening: HTMLAudioElement | null = null;
	private newPage: HTMLAudioElement | null = null;
	private intro: { id: symbol; entered: boolean; started: boolean } | null = null;
	private audioVersion = 0;
	private owners = 0;
	private retirement = 0;
	private invalidForms = new WeakSet<HTMLElement>();

	getSnapshot = () => this.state;
	getServerSnapshot = () => initialState;
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private update(patch: Partial<SoundState>) {
		this.state = { ...this.state, ...patch };
		this.listeners.forEach((listener) => listener());
	}

	private report(message: string, error: unknown) {
		console.error(message, error);
		this.update({ message });
	}

	initialize() {
		if (this.initialized || typeof window === "undefined") return;
		this.initialized = true;
		try {
			const raw = window.localStorage.getItem(SOUND_PREFERENCE_KEY);
			if (raw === null) return;
			const saved: unknown = JSON.parse(raw);
			if (
				typeof saved !== "object" ||
				saved === null ||
				!("enabled" in saved) ||
				typeof saved.enabled !== "boolean" ||
				!("volume" in saved) ||
				typeof saved.volume !== "number" ||
				!Number.isFinite(saved.volume) ||
				saved.volume < 0 ||
				saved.volume > 1 ||
				!("typing" in saved) ||
				typeof saved.typing !== "boolean"
			)
				throw new Error("Invalid sound preferences");
			this.update({ enabled: saved.enabled, volume: saved.volume, typing: saved.typing });
		} catch (error) {
			this.report(
				"Sound preferences could not be loaded. Sound remains off until you enable it.",
				error,
			);
		}
	}

	private persist() {
		try {
			const { enabled, volume, typing } = this.state;
			window.localStorage.setItem(
				SOUND_PREFERENCE_KEY,
				JSON.stringify({ enabled, volume, typing }),
			);
		} catch (error) {
			this.report(
				"Sound preferences could not be saved. Your changes apply to this visit only.",
				error,
			);
		}
	}

	private contextChanged = () => {
		this.update({ unlocked: this.context?.state === "running" });
	};

	private fromGesture(): UISFXPlayer | null {
		this.initialize();
		if (typeof window === "undefined" || !this.state.enabled || this.state.volume === 0)
			return null;
		try {
			if (!window.AudioContext) throw new Error("Web Audio is unavailable");
			if (!this.context) {
				this.context = new window.AudioContext();
				this.context.addEventListener("statechange", this.contextChanged);
			}
			if (!this.player) {
				this.player = createUISFX({
					pack: SOUND_PACK,
					volume: 0.7,
					enabled: this.state.enabled,
					context: this.context,
				});
				this.player.setVolume(this.state.volume);
				this.player.setPack(SOUND_PACK);
			}
			const context = this.context;
			if (context.state === "running") this.update({ unlocked: true });
			else
				void context
					.resume()
					.then(() => {
						if (this.context !== context) return;
						if (context.state === "running") this.update({ unlocked: true });
						else
							this.report(
								"Audio is blocked. Use Enable sound to try again.",
								new Error("AudioContext did not resume"),
							);
					})
					.catch((error) => {
						if (this.context === context)
							this.report("Audio is blocked. Use Enable sound to try again.", error);
					});
			return this.player;
		} catch (error) {
			this.report(
				"Sound could not start in this browser. You can continue without it.",
				error,
			);
			return null;
		}
	}

	unlockFromGesture() {
		this.fromGesture();
	}

	private play(player: UISFXPlayer, cue: CueName, options?: PlayOptions): PlayingSFX | null {
		try {
			return player.play(cue, options);
		} catch (error) {
			this.report("A sound could not be played. You can continue without it.", error);
			return null;
		}
	}

	playFromGesture(cue: OneShotCue | LoopCue, options?: PlayOptions): PlayingSFX | null {
		const player = this.fromGesture();
		return player ? this.play(player, cue, options) : null;
	}

	playOutcome(cue: OneShotCue, options?: PlayOptions): PlayingSFX | null {
		if (!this.isAudible() || !this.player) return null;
		return this.play(this.player, cue, options);
	}

	private isAudible() {
		return (
			this.state.enabled &&
			this.state.unlocked &&
			this.state.volume > 0 &&
			this.context?.state === "running" &&
			(typeof document === "undefined" || document.visibilityState === "visible")
		);
	}

	startProcessFromGesture(cue: LoopCue, onStop: () => void): SoundProcess | null {
		let handle = this.playFromGesture(cue, { volume: 0.18, retrigger: "overlap" });
		if (!handle) return null;
		let active = true;
		const process: SoundProcess = {
			get active() {
				return active;
			},
			stop: () => {
				if (!active) return;
				active = false;
				handle?.stop();
				handle = null;
				this.processes.delete(process);
				onStop();
			},
			finish: (cue) => {
				const notify = active;
				process.stop();
				if (notify) this.playOutcome(cue);
			},
		};
		this.processes.add(process);
		void handle.ended.then(process.stop).catch((error) => {
			process.stop();
			this.report("A process sound stopped unexpectedly.", error);
		});
		return process;
	}

	stopLoops() {
		[...this.processes].forEach((process) => process.stop());
	}

	stopAll() {
		this.stopLoops();
		this.player?.stopAll();
		this.audioVersion++;
		this.opening?.pause();
		this.newPage?.pause();
	}

	setEnabled(enabled: boolean) {
		if (!enabled) this.stopAll();
		this.update({ enabled });
		this.player?.setEnabled(enabled);
		this.persist();
	}

	setVolume(volume: number) {
		if (!Number.isFinite(volume) || volume < 0 || volume > 1)
			throw new RangeError("Sound volume must be between 0 and 1");
		if (volume === 0) this.stopAll();
		this.update({ volume });
		this.player?.setVolume(volume);
		if (this.opening) this.opening.volume = volume;
		if (this.newPage) this.newPage.volume = volume;
		this.persist();
	}

	setTypingFromGesture(typing: boolean) {
		this.update({ typing });
		this.persist();
		this.playFromGesture(typing ? "toggle-on" : "toggle-off");
	}

	beginIntro() {
		const id = Symbol();
		this.intro = { id, entered: false, started: false };
		return id;
	}

	endIntro(id: symbol) {
		if (this.intro?.id !== id) return;
		this.intro = null;
		this.stopLoops();
	}

	enterIntro(id: symbol, animated: boolean) {
		if (!this.intro || this.intro.id !== id || this.intro.entered) return;
		this.intro.entered = true;
		if (this.intro.started && animated && this.newPage && this.isAudible())
			this.playCustom(this.newPage);
	}

	private playCustom(audio: HTMLAudioElement) {
		const version = this.audioVersion;
		audio.volume = this.state.volume;
		void audio.play().catch((error) => {
			if (version !== this.audioVersion) return;
			this.update({ unlocked: false });
			this.report(
				"Intro audio could not play. Use Enable sound to continue with audio.",
				error,
			);
		});
	}

	enableFromGesture() {
		this.update({ message: "" });
		this.setEnabled(true);
		const player = this.fromGesture();
		if (!player) return;
		if (this.intro && !this.intro.entered) {
			if (!this.opening) {
				this.opening = new Audio(sitePath("sounds/opening.mp3"));
				this.newPage = new Audio(sitePath("sounds/new_page.mp3"));
				for (const audio of [this.opening, this.newPage]) {
					audio.preload = "auto";
					audio.addEventListener("error", () => {
						if (audio === this.opening || audio === this.newPage) {
							this.update({ unlocked: false });
							this.report(
								"An intro sound is unavailable. Mission control still works without it.",
								audio.error,
							);
						}
					});
				}
			}
			if (!this.intro.started) this.opening.currentTime = 0;
			this.intro.started = true;
			this.playCustom(this.opening);
		} else {
			this.play(player, "toggle-on");
		}
	}

	private input = (event: Event) => {
		if (!event.isTrusted || !this.state.typing) return;
		const target = event.target;
		const textInput =
			target instanceof HTMLInputElement &&
			["text", "search", "email", "url", "tel", "password", "number"].includes(target.type);
		if (
			(textInput || target instanceof HTMLTextAreaElement) &&
			!target.disabled &&
			!target.readOnly
		) {
			this.playFromGesture("typing", { volume: 0.12, cooldownMs: 0, retrigger: "overlap" });
		}
	};

	private invalid = (event: Event) => {
		if (!(
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement
		))
			return;
		const form = event.target.form ?? event.target;
		if (this.invalidForms.has(form)) return;
		this.invalidForms.add(form);
		queueMicrotask(() => this.invalidForms.delete(form));
		this.playOutcome("error");
	};

	private visibilityChanged = () => {
		if (document.visibilityState !== "hidden") return;
		this.stopAll();
		this.update({ unlocked: false });
	};

	private pageHide = (event: PageTransitionEvent) => {
		this.stopAll();
		if (event.persisted) {
			this.update({ unlocked: false });
			void this.context
				?.suspend()
				.catch((error) => this.report("Sound could not be suspended.", error));
		} else
			void this.dispose().catch((error) =>
				this.report("Sound could not shut down cleanly.", error),
			);
	};

	attach() {
		if (typeof window === "undefined") return () => {};
		this.initialize();
		this.owners++;
		this.retirement++;
		if (this.owners === 1) {
			document.addEventListener("input", this.input);
			document.addEventListener("invalid", this.invalid, true);
			document.addEventListener("visibilitychange", this.visibilityChanged);
			window.addEventListener("pagehide", this.pageHide);
		}
		return () => {
			if (--this.owners !== 0) return;
			document.removeEventListener("input", this.input);
			document.removeEventListener("invalid", this.invalid, true);
			document.removeEventListener("visibilitychange", this.visibilityChanged);
			window.removeEventListener("pagehide", this.pageHide);
			const retirement = ++this.retirement;
			// Strict Mode's immediate reattachment cancels trial-mount disposal.
			queueMicrotask(() => {
				if (this.owners === 0 && retirement === this.retirement) {
					void this.dispose().catch((error) =>
						this.report("Sound could not shut down cleanly.", error),
					);
				}
			});
		};
	}

	async dispose() {
		this.stopAll();
		const player = this.player;
		const context = this.context;
		this.player = null;
		this.context = null;
		this.opening = null;
		this.newPage = null;
		this.intro = null;
		this.update({ unlocked: false });
		context?.removeEventListener("statechange", this.contextChanged);
		try {
			await player?.destroy();
		} finally {
			if (context && context.state !== "closed") await context.close();
		}
	}
}

export const siteAudio = new SiteAudio();

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		void siteAudio
			.dispose()
			.catch((error) => console.error("Sound could not shut down cleanly.", error));
	});
}
