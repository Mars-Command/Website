import { accountConfig } from "../config/account";
import type { Profile, ProfileInput, ProfileMod, User } from "../types/account";

export class ApiError extends Error {
	status: number;
	code?: string;
	constructor(message: string, status = 0, code?: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

function object(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUser(value: unknown): value is User {
	return object(value) && typeof value.id === "string" &&
		typeof value.username === "string" && typeof value.avatarUrl === "string" &&
		Array.isArray(value.roles) && value.roles.every(role => typeof role === "string");
}

export function isMod(value: unknown): value is ProfileMod {
	return object(value) && ["name", "version", "sourceUrl", "sha256"]
		.every(key => typeof value[key] === "string");
}

export function isProfile(value: unknown): value is Profile {
	return object(value) && ["id", "name", "description", "updatedAt"]
		.every(key => typeof value[key] === "string") &&
		(value.visibility === "private" || value.visibility === "public") &&
		isUser(value.owner) && Array.isArray(value.mods) && value.mods.every(isMod) &&
		(value.sourceProfileId === null || typeof value.sourceProfileId === "string");
}

export function createAccountApi(base: string | null, fetcher: typeof fetch = fetch) {
	function url(path: string) {
		if (base === null) throw new ApiError("Account API is not configured. Contact mission control.");
		return `${base}${path}`;
	}

	async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
		const endpoint = url(path);
		let response: Response;
		try {
			response = await fetcher(endpoint, {
				method,
				credentials: "include",
				headers: body === undefined ? { Accept: "application/json" } :
					{ Accept: "application/json", "Content-Type": "application/json" },
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(10000),
			});
		} catch {
			throw new ApiError("Unable to contact mission control. Check your connection and try again.");
		}
		if (response.status === 204 && response.ok) return undefined;
		let data: unknown;
		try {
			data = await response.json();
		} catch {
			throw new ApiError(response.ok ? "Mission control returned an invalid response." :
				`Mission control refused the request (HTTP ${response.status}).`, response.status);
		}
		if (!response.ok) {
			const detail = object(data) ? data.detail : undefined;
			const code = object(detail) && typeof detail.code === "string" ? detail.code : undefined;
			const message = typeof detail === "string" ? detail :
				object(detail) && typeof detail.message === "string" ? detail.message :
					`Mission control refused the request (HTTP ${response.status}).`;
			throw new ApiError(message, response.status, code);
		}
		return data;
	}

	async function profileRequest(path: string, method: string, body?: unknown) {
		const result = await request(path, method, body);
		if (!isProfile(result)) throw new ApiError("Mission control returned an invalid profile.");
		return result;
	}

	return {
		async session(): Promise<User | null> {
			const result = await request("/api/auth/session");
			if (!object(result) || !(result.user === null || isUser(result.user))) {
				throw new ApiError("Mission control returned an invalid session.");
			}
			return result.user;
		},
		async logout() {
			await request("/api/auth/logout", "POST");
		},
		githubStart(requestId?: string, switchAccount = false) {
			const params = new URLSearchParams();
			if (requestId) params.set("requestId", requestId);
			if (switchAccount) params.set("switchAccount", "1");
			return url(`/api/auth/github/start${params.size ? `?${params}` : ""}`);
		},
		async approve(requestId: string) {
			const result = await request("/api/auth/desktop/approve", "POST", { requestId });
			if (!object(result) || result.status !== "approved") {
				throw new ApiError("Mission control did not confirm desktop approval.");
			}
		},
		async profiles(mine: boolean, q = ""): Promise<Profile[]> {
			const result = await request(mine ? "/api/community/profiles/mine" :
				`/api/community/profiles?q=${encodeURIComponent(q)}`);
			if (!object(result) || !Array.isArray(result.profiles) ||
				!result.profiles.every(isProfile) ||
				(!mine && result.profiles.some(profile => profile.visibility !== "public"))) {
				throw new ApiError("Mission control returned an invalid profile list.");
			}
			return result.profiles;
		},
		async create(input: ProfileInput, sourceProfileId?: string) {
			const profile = await profileRequest("/api/community/profiles", "POST",
				{ ...input, ...(sourceProfileId ? { sourceProfileId } : {}) });
			if (profile.visibility !== "private") throw new ApiError("Backend did not confirm a private profile. Refresh and contact mission control.");
			return profile;
		},
		update(id: string, input: Partial<ProfileInput>) {
			return profileRequest(`/api/community/profiles/${encodeURIComponent(id)}`, "PATCH", input);
		},
		async remove(id: string) {
			const result = await request(`/api/community/profiles/${encodeURIComponent(id)}`, "DELETE");
			if (result !== undefined) throw new ApiError("Backend did not confirm deletion with HTTP 204. Refresh the profile list before retrying.");
		},
		submit(id: string) {
			return profileRequest(`/api/community/profiles/${encodeURIComponent(id)}/submit`, "POST");
		},
	};
}

export const accountApi = createAccountApi(accountConfig.apiBase);

export function errorMessage(error: unknown): string {
	if (error instanceof ApiError && error.code === "scanning_not_configured") {
		return "Submission refused by backend: mod scanning is not configured. Your profile remains personal; nothing was published.";
	}
	return error instanceof Error ? error.message : "Mission control could not complete the request.";
}
