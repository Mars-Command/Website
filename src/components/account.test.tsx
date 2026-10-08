// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { copyProfileInput, readLoginQuery, routeFor, validateProfileInput } from "../utils/accountUi";
import { accountApi, ApiError } from "../services/accountApi";
import type { Profile } from "../types/account";
import { AccountPage } from "./AccountPage";
import { AuthLogin } from "./AuthLogin";

vi.mock("../config/account", async importOriginal => ({
	...await importOriginal<typeof import("../config/account")>(),
	accountConfig: { apiBase: "https://backend.example", sponsorsUrl: null },
}));

const user = { id: "42", username: "astronaut", avatarUrl: "https://github.com/avatar.png", roles: ["member"] };
const personal: Profile = { id: "mine1", name: "Personal mission", description: "My mods", visibility: "private",
	owner: user, mods: [], sourceProfileId: null, updatedAt: "2026-10-07T20:00:00Z" };
const publicProfile: Profile = { ...personal, id: "public1", name: "Public mission", visibility: "public" };
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	vi.spyOn(accountApi, "session").mockResolvedValue(user);
	vi.spyOn(accountApi, "profiles").mockImplementation(async mine => mine ? [personal] : [publicProfile]);
	vi.spyOn(accountApi, "approve").mockResolvedValue();
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
});
async function render(element: React.ReactNode) { await act(async () => root.render(element)); }
function button(text: string) {
	const result = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes(text));
	if (!result) throw new Error(`Missing button: ${text}`);
	return result;
}
async function click(element: HTMLElement) { await act(async () => element.click()); }

describe("landing and minimal routing", () => {
	it("retains existing landing panels and makes account UI reachable", () => {
		const html = renderToStaticMarkup(<App />);
		expect(html).toContain("hero-panel");
		expect(html).toContain("PUBLIC");
		expect(html).toContain("Account &amp; profiles");
		expect(html).toContain("Donations unavailable");
		expect(html).toContain("launcher");
		expect(html).toContain("telemetry");
		expect(routeFor("/", "/")).toBe("home");
		expect(routeFor("/auth/login", "/")).toBe("login");
		expect(routeFor("/account/", "/")).toBe("account");
		expect(routeFor("/mars/auth/login", "/mars/")).toBe("login");
		expect(routeFor("/unknown", "/")).toBe("not-found");
	});
	it("reads only safe callback state and never uses returned tokens", () => {
		expect(readLoginQuery("?requestId=r1&authResult=success&accessToken=secret")).toMatchObject({ requestId: "r1", authResult: "success" });
		expect(readLoginQuery("?requestId=%00")).toMatchObject({ invalidRequest: true, requestId: null });
	});
});

describe("explicit desktop identity confirmation", () => {
	it("shows session avatar and requires confirmation even on OAuth success", async () => {
		await render(<AuthLogin search="?requestId=r1&authResult=success" />);
		expect(container.querySelector("img")?.getAttribute("alt")).toBe("astronaut's GitHub avatar");
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(accountApi.approve).not.toHaveBeenCalled();
		await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
		await click(button("Continue as astronaut"));
		expect(accountApi.approve).toHaveBeenCalledExactlyOnceWith("r1");
		expect(container.textContent).toContain("Return to the Mars Command launcher");
		expect(container.textContent).not.toContain("accessToken");
		expect(container.querySelector('a[href^="mars:"]')).toBeNull();
	});
	it("supports ordinary website Continue as without approving desktop access", async () => {
		await render(<AuthLogin search="" />);
		expect(container.querySelector('a[href="/account"]')?.textContent).toContain("Account");
		expect(container.textContent).toContain("Continue as astronaut");
		expect(container.querySelector('input[type="checkbox"]')).toBeNull();
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(button("different GitHub account").disabled).toBe(false);
		expect(container.textContent).toContain("GitHub may keep its upstream login");
	});
	it("different-account navigation retains the desktop request and clears confirmation", async () => {
		const navigate = vi.fn();
		await render(<AuthLogin search="?requestId=r1" navigate={navigate} />);
		await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
		await click(button("different GitHub account"));
		expect(navigate).toHaveBeenCalledExactlyOnceWith("https://backend.example/api/auth/github/start?requestId=r1&switchAccount=1");
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
	it("shows accessible loading without exposing an approval control", async () => {
		vi.mocked(accountApi.session).mockImplementation(() => new Promise(() => {}));
		await render(<AuthLogin search="?requestId=r1" />);
		expect(container.querySelector('[role="status"]')?.textContent).toContain("Checking your secure");
		expect(container.querySelector('input[type="checkbox"]')).toBeNull();
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
	it("reconfirms changed identity and never approves the previously shown account", async () => {
		await render(<AuthLogin search="?requestId=r1" />);
		vi.mocked(accountApi.session).mockResolvedValue({ ...user, id: "99", username: "other" });
		await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
		await click(button("Continue as astronaut"));
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(container.textContent).toContain("identity changed");
		expect(button("Continue as other").disabled).toBe(true);
	});
	it("reports approval failures accessibly and requires renewed confirmation", async () => {
		vi.mocked(accountApi.approve).mockRejectedValue(new ApiError("Request expired", 410));
		await render(<AuthLogin search="?requestId=r1" />);
		await click(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
		await click(button("Continue as astronaut"));
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Request expired");
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(container.textContent).not.toContain("AUTHORIZATION SUCCESS");
	});
	it("renders accessible loading, session failures, and safe OAuth failure text", async () => {
		vi.mocked(accountApi.session).mockRejectedValue(new ApiError("Network unavailable"));
		await render(<AuthLogin search="?authResult=error&errorCode=raw-secret" />);
		expect(container.textContent).not.toContain("raw-secret");
		expect(container.querySelectorAll('[role="alert"]').length).toBe(2);
		expect(button("Retry session").disabled).toBe(false);
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
});

describe("personal profile operations", () => {
	it("creates metadata-only private profiles through the reachable form", async () => {
		const create = vi.spyOn(accountApi, "create").mockResolvedValue(personal);
		const submit = vi.spyOn(accountApi, "submit");
		await render(<AccountPage />);
		const form = container.querySelector<HTMLFormElement>('form[aria-label="Create personal profile"]')!;
		const name = form.querySelector<HTMLInputElement>("input")!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "New mission");
			name.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		expect(create).toHaveBeenCalledWith({ name: "New mission", description: "", mods: [] });
		expect(submit).not.toHaveBeenCalled();
		expect(container.querySelector('input[type="file"]')).toBeNull();
	});
	it("sends public search to the backend without client-side empty-list fallbacks", async () => {
		await render(<AccountPage />);
		const search = container.querySelector<HTMLFormElement>('form[role="search"]')!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search.querySelector("input"), "MARS");
			search.querySelector("input")!.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await act(async () => search.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		expect(accountApi.profiles).toHaveBeenCalledWith(false, "MARS");
	});
	it("copies public metadata into a new private profile and does not submit automatically", async () => {
		const create = vi.spyOn(accountApi, "create").mockResolvedValue(personal);
		const submit = vi.spyOn(accountApi, "submit");
		await render(<AccountPage />);
		await click(button("Copy Public mission"));
		expect(create).toHaveBeenCalledWith({ name: "Public mission (personal copy)", description: "My mods", mods: [] }, "public1");
		expect(submit).not.toHaveBeenCalled();
		expect(container.textContent).toContain("Independent personal copy created");
	});
	it("edits metadata without visibility or role changes", async () => {
		const update = vi.spyOn(accountApi, "update").mockResolvedValue(personal);
		await render(<AccountPage />);
		await click(button("Edit Personal mission"));
		await act(async () => container.querySelector('form[aria-label="Edit personal profile"]')!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
		expect(update).toHaveBeenCalledWith("mine1", { name: personal.name, description: personal.description, mods: [] });
		expect(container.textContent).toContain("Saving does not publish");
	});
	it("requires deletion confirmation and submits only after an explicit action with clear refusal", async () => {
		const remove = vi.spyOn(accountApi, "remove").mockResolvedValue();
		vi.spyOn(accountApi, "submit").mockRejectedValue(new ApiError("No scanning", 409, "scanning_not_configured"));
		await render(<AccountPage />);
		await click(button("Delete Personal mission"));
		expect(remove).not.toHaveBeenCalled();
		await click(button("Cancel deletion"));
		await click(button("Submit Personal mission"));
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Submission refused by backend");
		await click(button("Delete Personal mission"));
		await click(button("Confirm deletion"));
		expect(remove).toHaveBeenCalledExactlyOnceWith("mine1");
	});
	it("shows list/network failure rather than pretending no profiles exist", async () => {
		vi.mocked(accountApi.profiles).mockRejectedValue(new ApiError("Network unavailable"));
		await render(<AccountPage />);
		expect(container.textContent).toContain("Network unavailable");
		expect(container.textContent).not.toContain("No personal profiles");
		expect(container.textContent).not.toContain("No public profiles");
	});
	it("handles unauthenticated users without fetching owner profiles or allowing copies", async () => {
		vi.mocked(accountApi.session).mockResolvedValue(null);
		await render(<AccountPage />);
		expect(accountApi.profiles).not.toHaveBeenCalledWith(true, expect.anything());
		expect(button("Copy Public mission").disabled).toBe(true);
		expect(container.querySelector('form[aria-label="Create personal profile"]')).toBeNull();
	});
	it("logs out the website cookie session without assigning client roles", async () => {
		const logout = vi.spyOn(accountApi, "logout").mockResolvedValue();
		await render(<AccountPage />);
		await click(button("Sign out"));
		expect(logout).toHaveBeenCalledOnce();
		expect(container.textContent).toContain("Website session signed out");
		expect(container.querySelector('form[aria-label="Create personal profile"]')).toBeNull();
	});
	it("validates mod metadata and makes independent copies", () => {
		expect(validateProfileInput({ name: "", description: "", mods: [] })).toContain("profile name");
		expect(validateProfileInput({ name: "test", description: "", mods: [{ name: "mod", version: "1", sourceUrl: "javascript:bad", sha256: "bad" }] })).toContain("64-character");
		const mod = { name: "mod", version: "1", sourceUrl: "https://example.com/mod", sha256: "a".repeat(64) };
		const original = { ...publicProfile, mods: [mod] };
		const copy = copyProfileInput(original);
		copy.mods[0].name = "edited";
		expect(original.mods[0].name).toBe("mod");
		expect(validateProfileInput({ name: "test", description: "", mods: [mod] })).toBeNull();
	});
	it("rejects HTTP mod sources and accepts HTTPS without changing loopback API support", () => {
		const input = { name: "Mission", description: "", mods: [{
			name: "Mod", version: "1", sourceUrl: "http://example.com/mod.jar", sha256: "a".repeat(64),
		}] };
		expect(validateProfileInput(input)).toContain("HTTPS source URL");
		input.mods[0].sourceUrl = "https://example.com/mod.jar";
		expect(validateProfileInput(input)).toBeNull();
	});
});
