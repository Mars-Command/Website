export const capsuleStates = [
	"reserved", "uploading", "quarantined", "scan_pending", "scan_blocked",
	"rejected", "publishable", "expired", "withdrawn",
] as const;

export type CapsuleState = typeof capsuleStates[number];
export type CapsuleInput = { project: string; version: string; sourceUrl: string };
export type CapsuleEvidence = {
	version: number;
	artifactSha256: string;
	provider: string;
	providerResultId: string;
	policyVersion: string;
	scannedAt: string;
	expiresAt: string;
	verdict: "accepted" | "rejected" | "blocked" | "error";
	summary: string;
};
export type CapsuleQueue = {
	status: "pending" | "leased" | "complete" | "blocked" | "failed";
	attempts: number;
	maxAttempts: number;
	nextAttemptAt: string | null;
	lastError: string | null;
};
export type Capsule = CapsuleInput & {
	releaseId: string;
	ownerId: string;
	createdAt: string;
	artifactSha256: string | null;
	state: CapsuleState;
	revision: number;
	updatedAt: string;
	evidence: CapsuleEvidence | null;
	queue: CapsuleQueue | null;
	publicDownloadAvailable: false;
};
