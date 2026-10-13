import { useEffect, useSyncExternalStore } from "react";
import { siteAudio } from "../services/siteAudio";

export function SoundSettings() {
	const sound = useSyncExternalStore(
		siteAudio.subscribe,
		siteAudio.getSnapshot,
		siteAudio.getServerSnapshot,
	);
	useEffect(() => siteAudio.attach(), []);
	return (
		<div
			className="sound-controls"
			role="group"
			aria-label="Sound preferences"
		>
			<button
				type="button"
				className="skip-animation sound-toggle"
				onClick={() =>
					sound.enabled
						? siteAudio.setEnabled(false)
						: siteAudio.enableFromGesture()
				}
				title={
					sound.enabled && !sound.unlocked
						? "Sound is on. Playback starts after your first interaction."
						: undefined
				}
			>
				{sound.enabled ? "Mute sound" : "Enable sound"}
			</button>
			<details className="sound-settings">
				<summary>Sound settings</summary>
				<div className="sound-settings-panel">
					<label>
						Sound volume{" "}
						<span>
							{Math.round(
								sound.volume *
									100,
							)}
							%
						</span>
						<input
							type="range"
							min={0}
							max={100}
							step={1}
							value={Math.round(
								sound.volume *
									100,
							)}
							aria-label="Sound volume"
							aria-valuetext={`${Math.round(sound.volume * 100)} percent`}
							onChange={(event) =>
								siteAudio.setVolume(
									Number(
										event
											.target
											.value,
									) / 100,
								)
							}
						/>
					</label>
					<label className="sound-typing">
						<input
							type="checkbox"
							checked={sound.typing}
							onChange={(event) =>
								siteAudio.setTypingFromGesture(
									event
										.target
										.checked,
								)
							}
						/>
						Typing sounds
					</label>
					<p>
						Only your text entry makes
						typing sounds. Sound never
						replaces visual feedback.
					</p>
				</div>
			</details>
			{sound.message && (
				<p
					className="sound-message terminal-error"
					role="status"
				>
					{sound.message}
				</p>
			)}
			{sound.enabled && !sound.unlocked && sound.message && (
				<button
					type="button"
					className="skip-animation sound-toggle"
					onClick={() => siteAudio.enableFromGesture()}
				>
					Enable sound
				</button>
			)}
		</div>
	);
}
