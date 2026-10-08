import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredApiBase, configuredSponsorsUrl, safeHttpUrl } from "../config/account";
import { ApiError, createAccountApi, errorMessage, isProfile, isUser } from "./accountApi";
import type { Profile } from "../types/account";

const user = { id: "42", username: "astronaut", avatarUrl: "https://github.com/avatar.png", roles: ["member"] };
const profile: Profile = {
	id: "p1", name: "Mission", description: "Colony mods", visibility: "private", owner: user,
	mods: [{ name: "Mod", version: "1", sourceUrl: "https://example.com/mod.jar", sha256: "a".repeat(64) }],
	sourceProfileId: null, updatedAt: "2026-10-07T20:00:00Z",
};
const input = { name: profile.name, description: profile.description, mods: profile.mods };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.restoreAllMocks());

describe("configured public endpoints", () => {
	it("requires an explicit API server base without /api and never chooses a live default", () => {
		expect(configuredApiBase(undefined)).toBeNull();
		expect(configuredApiBase("")).toBeNull();
		expect(configuredApiBase("https://backend.example/base/")).toBe("https://backend.example/base");
		expect(configuredApiBase("http://localhost:8000")).toBe("http://localhost:8000");
		expect(configuredApiBase("http://127.0.0.1:8000/base/")).toBe("http://127.0.0.1:8000/base");
		expect(configuredApiBase("http://backend.example")).toBeNull();
		for (const value of ["https://backend.example/api", "javascript:alert(1)", "https://user:secret@example.com", "https://example.com?token=secret", "//example.com", "https://example.com/#token"]) {
			expect(configuredApiBase(value)).toBeNull();
		}
	});
	it("does not invent a donation recipient or accept arbitrary destinations", () => {
		expect(configuredSponsorsUrl(undefined)).toBeNull();
		expect(configuredSponsorsUrl("https://github.com/sponsors/Mars-Command")).toBe("https://github.com/sponsors/Mars-Command");
		for (const value of ["https://evil.example/sponsors/test", "https://github.com/sponsors/", "http://github.com/sponsors/test", "https://github.com/sponsors/test?redirect=bad"]) {
			expect(configuredSponsorsUrl(value)).toBeNull();
		}
		expect(safeHttpUrl("data:image/svg+xml,bad")).toBeNull();
	});
});

describe("cookie account API", () => {
	it("fails closed before fetch when not configured", async () => {
		const fetcher = vi.fn();
		const api = createAccountApi(null, fetcher);
		await expect(api.session()).rejects.toThrow("not configured");
		expect(() => api.githubStart()).toThrow("not configured");
		expect(fetcher).not.toHaveBeenCalled();
	});
	it("uses configured base, /api paths and credentials include for website requests", async () => {
		const fetcher = vi.fn().mockResolvedValue(json({ user }));
		const api = createAccountApi("https://backend.example/base", fetcher);
		expect(await api.session()).toEqual(user);
		expect(fetcher).toHaveBeenCalledWith("https://backend.example/base/api/auth/session", expect.objectContaining({ credentials: "include", method: "GET" }));
		fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
		await api.logout();
		expect(fetcher).toHaveBeenLastCalledWith("https://backend.example/base/api/auth/logout", expect.objectContaining({ method: "POST", credentials: "include" }));
	});
	it("retains requestId and explicitly requests account switching through browser navigation URL", () => {
		const api = createAccountApi("http://localhost:8000");
		const url = new URL(api.githubStart("request &1", true));
		expect(url.pathname).toBe("/api/auth/github/start");
		expect(url.searchParams.get("requestId")).toBe("request &1");
		expect(url.searchParams.get("switchAccount")).toBe("1");
	});
	it("approves with requestId only, never a desktop device code or access token", async () => {
		const fetcher = vi.fn().mockResolvedValue(json({ status: "approved" }));
		await createAccountApi("https://backend.example", fetcher).approve("r1");
		expect(fetcher).toHaveBeenCalledWith("https://backend.example/api/auth/desktop/approve",
			expect.objectContaining({ credentials: "include", method: "POST", body: '{"requestId":"r1"}' }));
		fetcher.mockResolvedValue(json({ status: "pending", accessToken: "not-for-website" }));
		await expect(createAccountApi("https://backend.example", fetcher).approve("r1")).rejects.toThrow("did not confirm");
	});
	it.each([null, {}, { user: [] }, { user: { ...user, roles: "admin" } }])("rejects invalid sessions %j", async value => {
		await expect(createAccountApi("https://backend.example", vi.fn().mockResolvedValue(json(value))).session()).rejects.toThrow("invalid session");
	});
	it("distinguishes unauthenticated session from a network failure", async () => {
		expect(await createAccountApi("https://backend.example", vi.fn().mockResolvedValue(json({ user: null }))).session()).toBeNull();
		await expect(createAccountApi("https://backend.example", vi.fn().mockRejectedValue(new Error("network"))).session()).rejects.toThrow("Unable to contact");
	});
	it("never treats invalid JSON, failed requests, or malformed lists as successful empty lists", async () => {
		for (const response of [new Response("not json"), json({}, 500), json({ profiles: [null] }), json({ profiles: [profile] })]) {
			await expect(createAccountApi("https://backend.example", vi.fn().mockResolvedValue(response)).profiles(false)).rejects.toBeInstanceOf(ApiError);
		}
	});
	it("encodes public queries and supports authenticated owner lists", async () => {
		const fetcher = vi.fn().mockImplementation(async () => json({ profiles: [] }));
		const api = createAccountApi("https://backend.example", fetcher);
		expect(await api.profiles(false, "Mars & Moon")).toEqual([]);
		expect(fetcher.mock.calls[0][0]).toBe("https://backend.example/api/community/profiles?q=Mars%20%26%20Moon");
		await api.profiles(true);
		expect(fetcher.mock.calls[1][0]).toBe("https://backend.example/api/community/profiles/mine");
	});
	it("creates private copies, patches optional metadata only, deletes and explicitly submits", async () => {
		const fetcher = vi.fn().mockImplementation(async () => json(profile));
		const api = createAccountApi("https://backend.example", fetcher);
		await api.create(input, "public1");
		const created = JSON.parse(fetcher.mock.calls[0][1].body);
		expect(created).toEqual({ ...input, sourceProfileId: "public1" });
		expect(created).not.toHaveProperty("visibility");
		expect(created).not.toHaveProperty("roles");
		await api.update("id/with space", { name: "Edited" });
		expect(fetcher).toHaveBeenLastCalledWith("https://backend.example/api/community/profiles/id%2Fwith%20space", expect.objectContaining({ method: "PATCH", body: '{"name":"Edited"}' }));
		fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
		await api.remove("p1");
		expect(fetcher).toHaveBeenLastCalledWith("https://backend.example/api/community/profiles/p1", expect.objectContaining({ method: "DELETE" }));
		await api.submit("p1");
		expect(fetcher).toHaveBeenLastCalledWith("https://backend.example/api/community/profiles/p1/submit", expect.objectContaining({ method: "POST" }));
	});
	it("rejects unexpected public create responses", async () => {
		await expect(createAccountApi("https://backend.example", vi.fn().mockResolvedValue(json({ ...profile, visibility: "public" }))).create(input)).rejects.toThrow("private profile");
	});
	it("reports fail-closed backend scanning refusal, plus string/object errors", async () => {
		const api = createAccountApi("https://backend.example", vi.fn().mockResolvedValue(json({ detail: { code: "scanning_not_configured", message: "Not available" } }, 409)));
		try { await api.submit("p1"); } catch (error) {
			expect(error).toMatchObject({ status: 409, code: "scanning_not_configured" });
			expect(errorMessage(error)).toContain("Submission refused by backend");
		}
		await expect(createAccountApi("https://backend.example", vi.fn().mockResolvedValue(json({ detail: "Session required" }, 401))).session()).rejects.toThrow("Session required");
	});
	it("checks required response field types", () => {
		expect(isUser(user)).toBe(true);
		expect(isProfile(profile)).toBe(true);
		expect(isProfile({ ...profile, mods: [{}] })).toBe(false);
		expect(isProfile({ ...profile, description: null })).toBe(false);
		expect(isProfile({ ...profile, updatedAt: "not-a-date" })).toBe(false);
		expect(isProfile({ ...profile, mods: [{ ...profile.mods[0], sourceUrl: "javascript:alert(1)" }] })).toBe(false);
		expect(isProfile({ ...profile, mods: [{ ...profile.mods[0], sha256: "not-a-checksum" }] })).toBe(false);
		expect(isProfile({ ...profile, owner: { ...user, id: "" } })).toBe(false);
	});
});
