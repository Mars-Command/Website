import { safeHttpUrl } from "../config/account";
import type { Capsule, CapsuleInput, CapsuleState } from "../types/capsule";

export const MAX_JAR_BYTES = 64 * 1024 * 1024;

export function validateJar(file: File | null): string {
	if (!file) return "Select a JAR file.";
	if (!/\.jar$/i.test(file.name)) return "Choose a file with the .jar extension.";
	if (file.size === 0) return "The JAR file is empty.";
	if (file.size > MAX_JAR_BYTES) return "The JAR exceeds the 64 MiB upload limit.";
	return "";
}

export function validateCapsuleInput(input: CapsuleInput): string {
	if (!input.project.trim() || !input.version.trim()) return "Enter a project and release version.";
	if (input.project.trim().length > 120 || input.version.trim().length > 80) return "Project must be at most 120 characters and version at most 80.";
	const source = safeHttpUrl(input.sourceUrl.trim());
	if (!source?.startsWith("https://") || new URL(source).hash || input.sourceUrl.trim().length > 2048) return "Enter an HTTPS source URL without credentials or fragments (up to 2048 characters).";
	return "";
}

export const capsuleStatusText: Record<CapsuleState, string> = {
	reserved: "Reserved — waiting for your JAR upload.",
	uploading: "Backend is receiving the JAR. Refresh before retrying an interrupted upload.",
	quarantined: "JAR quarantined privately. Awaiting scan work.",
	scan_pending: "Private JAR queued for scanning.",
	scan_blocked: "Scanning blocked: a trusted scanner is unavailable or not configured. Your JAR remains private and unpublished.",
	rejected: "Scan rejected or failed. Your JAR remains private and unpublished.",
	publishable: "Workflow complete — eligible for a future publication step. Still private; no public download or installation is available.",
	expired: "Submission expired. Reserve a new release to submit again.",
	withdrawn: "Submission withdrawn. Nothing was published.",
};

export function canRetryCapsule(capsule: Capsule): boolean {
	return !!capsule.artifactSha256 && capsule.state === "scan_blocked" && !!capsule.queue &&
		capsule.queue.status !== "leased" && capsule.queue.attempts < capsule.queue.maxAttempts;
}

export function canWithdrawCapsule(capsule: Capsule): boolean {
	return capsule.state !== "withdrawn" && capsule.state !== "expired";
}

export function mergeCapsules(current: Capsule[], incoming: Capsule[]): Capsule[] {
	const result = new Map(current.map(capsule => [capsule.releaseId, capsule]));
	for (const capsule of incoming) {
		const previous = result.get(capsule.releaseId);
		if (previous) {
			if (["ownerId", "project", "version", "sourceUrl", "createdAt"].some(field =>
				previous[field as keyof Capsule] !== capsule[field as keyof Capsule])) {
				throw new Error("Mission control returned inconsistent release facts. Refresh your session.");
			}
			if (capsule.revision < previous.revision) continue;
			if ((previous.artifactSha256 !== null && previous.artifactSha256 !== capsule.artifactSha256) ||
				(capsule.revision === previous.revision && (
					capsule.state !== previous.state || capsule.updatedAt !== previous.updatedAt || capsule.artifactSha256 !== previous.artifactSha256 ||
					!sameSummary(capsule.evidence, previous.evidence) || !sameSummary(capsule.queue, previous.queue)))) {
				throw new Error("Mission control returned inconsistent release facts. Refresh your session.");
			}

			function sameSummary(first: object | null, second: object | null): boolean {
				if (!first || !second) return first === second;
				return Object.entries(first).every(([key, value]) => value === (second as Record<string, unknown>)[key]) &&
					Object.keys(first).length === Object.keys(second).length;
			}
		}
		result.set(capsule.releaseId, capsule);
	}
	return [...result.values()];
}
