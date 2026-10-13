// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
	copyProfileInput,
	readLoginQuery,
	routeFor,
	validateProfileInput,
} from "../utils/accountUi";
import { accountApi, ApiError } from "../services/accountApi";
import { capsuleApi } from "../services/capsuleApi";
import type { Profile } from "../types/account";
import type { Capsule } from "../types/capsule";
import { AccountPage } from "./AccountPage";
import { AuthLogin } from "./AuthLogin";
import { siteAudio } from "../services/siteAudio";
import { recordProcessSounds } from "../services/siteAudio.testUtils";

vi.mock("../config/account", async (importOriginal) => ({
	...(await importOriginal<typeof import("../config/account")>()),
	accountConfig: {
		apiBase: "https://backend.example",
		sponsorsUrl: null,
	},
}));

const user = {
	id: "42",
	username: "astronaut",
	avatarUrl: "https://github.com/avatar.png",
	roles: ["member"],
};
const personal: Profile = {
	id: "mine1",
	name: "Personal mission",
	description: "My mods",
	visibility: "private",
	owner: user,
	mods: [],
	sourceProfileId: null,
	updatedAt: "2026-10-07T20:00:00Z",
};
const publicProfile: Profile = {
	...personal,
	id: "public1",
	name: "Public mission",
	visibility: "public",
};
let container: HTMLDivElement;
let root: Root;
let originalScroll: PropertyDescriptor | undefined;

beforeEach(() => {
	(
		globalThis as typeof globalThis & {
			IS_REACT_ACT_ENVIRONMENT: boolean;
		}
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.stubGlobal("matchMedia", () => ({
		matches: true,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
	vi.stubGlobal(
		"requestAnimationFrame",
		(callback: FrameRequestCallback) =>
			window.setTimeout(() => callback(performance.now()), 0),
	);
	vi.stubGlobal("cancelAnimationFrame", (id: number) =>
		window.clearTimeout(id),
	);
	originalScroll = Object.getOwnPropertyDescriptor(
		HTMLElement.prototype,
		"scrollIntoView",
	);
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
		configurable: true,
		value: vi.fn(),
	});
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	vi.spyOn(accountApi, "session").mockResolvedValue(user);
	vi.spyOn(accountApi, "profiles").mockImplementation(async (mine) =>
		mine ? [personal] : [publicProfile],
	);
	vi.spyOn(accountApi, "approve").mockResolvedValue();
	vi.spyOn(accountApi, "approveMinecraft").mockResolvedValue();
	vi.spyOn(accountApi, "authorizationRequest").mockResolvedValue({
		kind: "desktop",
		status: "pending",
		callSign: null,
		playerName: null,
	});
	vi.spyOn(capsuleApi, "mine").mockResolvedValue([]);
	vi.spyOn(siteAudio, "startIntroFromGesture").mockImplementation(() => {});
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
	if (originalScroll)
		Object.defineProperty(
			HTMLElement.prototype,
			"scrollIntoView",
			originalScroll,
		);
	else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
	vi.unstubAllGlobals();
});
async function render(element: React.ReactNode) {
	await act(async () => root.render(element));
	await act(async () => {
		container
			.querySelector(".planet-loader img")
			?.dispatchEvent(new Event("load"));
		window.dispatchEvent(new Event("load"));
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
	});
	await act(
		async () =>
			new Promise<void>((resolve) =>
				window.setTimeout(resolve, 0),
			),
	);
}
function button(text: string) {
	const result = Array.from(container.querySelectorAll("button")).find(
		(button) =>
			!button.closest("[hidden]") &&
			(button.textContent?.includes(text) ||
				button
					.getAttribute("aria-label")
					?.includes(text)),
	);
	if (!result) throw new Error(`Missing button: ${text}`);
	return result;
}
async function click(element: HTMLElement) {
	await act(async () => element.click());
}
async function openView(label: string) {
	const item = Array.from(
		container.querySelectorAll<HTMLButtonElement>(
			".directory-nav button",
		),
	).find((button) => button.textContent?.includes(label));
	if (!item) throw new Error(`Missing account view: ${label}`);
	await click(item);
}
async function inputValue(
	element: HTMLInputElement | HTMLTextAreaElement,
	value: string,
) {
	const prototype =
		element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	await act(async () => {
		Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
			element,
			value,
		);
		element.dispatchEvent(new Event("input", { bubbles: true }));
	});
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
const release: Capsule = {
	project: "Workspace artifact",
	version: "1",
	sourceUrl: "https://example.com/mod",
	releaseId: "a".repeat(32),
	ownerId: "42",
	artifactSha256: null,
	state: "reserved",
	revision: 1,
	createdAt: "2026-10-12T10:00:00Z",
	updatedAt: "2026-10-12T10:00:00Z",
	evidence: null,
	queue: null,
	publicDownloadAvailable: false,
};
const uploaded: Capsule = {
	...release,
	artifactSha256: "b".repeat(64),
	state: "scan_blocked",
	revision: 2,
	queue: {
		status: "blocked",
		attempts: 1,
		maxAttempts: 3,
		nextAttemptAt: null,
		lastError: "scanning_not_configured",
	},
};
async function selectJar() {
	const form = container.querySelector<HTMLFormElement>(
		'form[aria-label="Submit private JAR"]',
	)!;
	for (const [label, value] of [
		["Project", release.project],
		["Release version", release.version],
		["Source URL (HTTPS)", release.sourceUrl],
	]) {
		const input = Array.from(form.querySelectorAll("label"))
			.find((item) => item.textContent === label)!
			.querySelector("input")!;
		await inputValue(input, value);
	}
	const input =
		form.querySelector<HTMLInputElement>('input[type="file"]')!;
	const file = new File(["jar"], "workspace.jar");
	await act(async () => {
		Object.defineProperty(input, "files", {
			value: [file],
			configurable: true,
		});
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	return { form, input, file };
}

describe("landing and minimal routing", () => {
	it("retains existing landing panels and makes account UI reachable", () => {
		const html = renderToStaticMarkup(<App />);
		expect(html).toContain("hero-panel");
		expect(html).toContain("PUBLIC");
		expect(html).toContain("Account &amp; profiles");
		expect(html).toContain("Donations unavailable");
		expect(html).toContain("launcher");
		expect(html).toContain("telemetry");
		expect(html).not.toContain("terminal-window");
		expect(html).not.toContain("window-dots");
		expect(routeFor("/", "/")).toBe("home");
		expect(routeFor("/auth/login", "/")).toBe("login");
		expect(routeFor("/account/", "/")).toBe("account");
		expect(routeFor("/mars/auth/login", "/mars/")).toBe("login");
		expect(routeFor("/unknown", "/")).toBe("not-found");
	});
	it("reads only safe callback state and never uses returned tokens", () => {
		expect(
			readLoginQuery(
				"?requestId=r1&authResult=success&accessToken=secret",
			),
		).toMatchObject({ requestId: "r1", authResult: "success" });
		expect(readLoginQuery("?requestId=%00")).toMatchObject({
			invalidRequest: true,
			requestId: null,
		});
	});
});

describe("explicit desktop identity confirmation", () => {
	it("uses the same login page for Minecraft but requires arrival-specific explicit approval", async () => {
		vi.mocked(accountApi.authorizationRequest).mockResolvedValue({
			kind: "minecraft",
			status: "pending",
			callSign: "0042",
			playerName: "Astronaut",
		});
		await render(
			<AuthLogin search="?requestId=r1&authResult=success" />,
		);
		expect(container.textContent).toContain("Player 0042");
		expect(container.textContent).toContain("Astronaut");
		expect(button("approve arrival").disabled).toBe(true);
		expect(accountApi.approveMinecraft).not.toHaveBeenCalled();
		await click(
			container.querySelector<HTMLInputElement>(
				'input[type="checkbox"]',
			)!,
		);
		await click(button("approve arrival"));
		expect(
			accountApi.approveMinecraft,
		).toHaveBeenCalledExactlyOnceWith("r1");
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			"Return to Minecraft and confirm",
		);
	});
	it("never falls back to launcher approval when request metadata cannot be verified", async () => {
		vi.mocked(accountApi.authorizationRequest).mockRejectedValue(
			new ApiError("Request unavailable"),
		);
		await render(<AuthLogin search="?requestId=r1" />);
		expect(
			container.querySelector('input[type="checkbox"]'),
		).toBeNull();
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(accountApi.approveMinecraft).not.toHaveBeenCalled();
		expect(button("Retry request check")).toBeDefined();
	});
	it("shows session avatar and requires confirmation even on OAuth success", async () => {
		await render(
			<AuthLogin search="?requestId=r1&authResult=success" />,
		);
		expect(
			container
				.querySelector(".account-identity img")
				?.getAttribute("alt"),
		).toBe("astronaut's GitHub avatar");
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(accountApi.approve).not.toHaveBeenCalled();
		await click(
			container.querySelector<HTMLInputElement>(
				'input[type="checkbox"]',
			)!,
		);
		await click(button("Continue as astronaut"));
		expect(accountApi.approve).toHaveBeenCalledExactlyOnceWith(
			"r1",
		);
		expect(container.textContent).toContain(
			"Return to the Mars Command launcher",
		);
		expect(container.textContent).not.toContain("accessToken");
		expect(container.querySelector('a[href^="mars:"]')).toBeNull();
	});
	it("supports ordinary website Continue as without approving desktop access", async () => {
		await render(<AuthLogin search="" />);
		expect(
			container.querySelector('a[href="/account"]')
				?.textContent,
		).toContain("Account");
		expect(container.textContent).toContain(
			"Continue as astronaut",
		);
		expect(
			container.querySelector('input[type="checkbox"]'),
		).toBeNull();
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(button("different GitHub account").disabled).toBe(false);
		expect(container.textContent).toContain(
			"GitHub may keep its upstream login",
		);
	});
	it("different-account navigation retains the desktop request and clears confirmation", async () => {
		const navigate = vi.fn();
		await render(
			<AuthLogin
				search="?requestId=r1"
				navigate={navigate}
			/>,
		);
		await click(
			container.querySelector<HTMLInputElement>(
				'input[type="checkbox"]',
			)!,
		);
		await click(button("different GitHub account"));
		expect(navigate).toHaveBeenCalledExactlyOnceWith(
			"https://backend.example/api/auth/github/start?requestId=r1&switchAccount=1",
		);
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
	it("shows accessible loading without exposing an approval control", async () => {
		vi.mocked(accountApi.session).mockImplementation(
			() => new Promise(() => {}),
		);
		await render(<AuthLogin search="?requestId=r1" />);
		expect(
			container.querySelector('[role="status"]')?.textContent,
		).toContain("Checking your secure");
		expect(
			container.querySelector('input[type="checkbox"]'),
		).toBeNull();
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
	it("reconfirms changed identity and never approves the previously shown account", async () => {
		await render(<AuthLogin search="?requestId=r1" />);
		vi.mocked(accountApi.session).mockResolvedValue({
			...user,
			id: "99",
			username: "other",
		});
		await click(
			container.querySelector<HTMLInputElement>(
				'input[type="checkbox"]',
			)!,
		);
		await click(button("Continue as astronaut"));
		expect(accountApi.approve).not.toHaveBeenCalled();
		expect(container.textContent).toContain("identity changed");
		expect(button("Continue as other").disabled).toBe(true);
	});
	it("reports approval failures accessibly and requires renewed confirmation", async () => {
		vi.mocked(accountApi.approve).mockRejectedValue(
			new ApiError("Request expired", 410),
		);
		await render(<AuthLogin search="?requestId=r1" />);
		await click(
			container.querySelector<HTMLInputElement>(
				'input[type="checkbox"]',
			)!,
		);
		await click(button("Continue as astronaut"));
		expect(
			container.querySelector('[role="alert"]')?.textContent,
		).toContain("Request expired");
		expect(button("Continue as astronaut").disabled).toBe(true);
		expect(container.textContent).not.toContain(
			"AUTHORIZATION SUCCESS",
		);
	});
	it("renders accessible loading, session failures, and safe OAuth failure text", async () => {
		vi.mocked(accountApi.session).mockRejectedValue(
			new ApiError("Network unavailable"),
		);
		await render(
			<AuthLogin search="?authResult=error&errorCode=raw-secret" />,
		);
		expect(container.textContent).not.toContain("raw-secret");
		expect(
			container.querySelectorAll('[role="alert"]').length,
		).toBe(2);
		expect(button("Retry session").disabled).toBe(false);
		expect(accountApi.approve).not.toHaveBeenCalled();
	});
});

describe("personal profile operations", () => {
	it("plays save feedback only after a successful backend response", async () => {
		const processes = recordProcessSounds();
		const pending = deferred<Profile>();
		vi.spyOn(accountApi, "create").mockReturnValue(pending.promise);
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Create profile"));
		const form = container.querySelector<HTMLFormElement>(
			'form[aria-label="Create personal profile"]',
		)!;
		await inputValue(
			form.querySelector<HTMLInputElement>("input")!,
			"New mission",
		);
		vi.mocked(siteAudio.playOutcome).mockClear();
		await act(async () =>
			form.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(processes[0].active).toBe(true);
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		await act(async () => pending.resolve(personal));
		expect(siteAudio.playOutcome).toHaveBeenCalledExactlyOnceWith(
			"success",
		);
		expect(processes[0].active).toBe(false);
	});

	it("warns on deletion review but plays delete only after committed removal", async () => {
		const processes = recordProcessSounds();
		const pending = deferred<void>();
		vi.spyOn(accountApi, "remove").mockReturnValue(pending.promise);
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Delete Personal mission"));
		expect(siteAudio.playFromGesture).toHaveBeenCalledWith(
			"warning",
		);
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		await click(button("Confirm deletion"));
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		await act(async () => pending.resolve());
		expect(siteAudio.playOutcome).toHaveBeenCalledExactlyOnceWith(
			"delete",
		);
		expect(processes[0].active).toBe(false);
	});

	it("plays validation error without starting a request or loop", async () => {
		const processes = recordProcessSounds();
		const create = vi.spyOn(accountApi, "create");
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Create profile"));
		vi.mocked(siteAudio.playFromGesture).mockClear();
		const form = container.querySelector(
			'form[aria-label="Create personal profile"]',
		)!;
		await act(async () =>
			form.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(
			siteAudio.playFromGesture,
		).toHaveBeenCalledExactlyOnceWith("error");
		expect(create).not.toHaveBeenCalled();
		expect(processes).toHaveLength(0);
	});

	it.each([true, false])(
		"waits for actual authorization resolution (success: %s)",
		async (success) => {
			const processes = recordProcessSounds();
			const pending = deferred<void>();
			vi.mocked(accountApi.approve).mockReturnValue(
				pending.promise,
			);
			await render(<AuthLogin search="?requestId=r1" />);
			await click(
				container.querySelector<HTMLInputElement>(
					'input[type="checkbox"]',
				)!,
			);
			expect(
				siteAudio.playFromGesture,
			).toHaveBeenCalledExactlyOnceWith("check");
			await click(button("Continue as astronaut"));
			expect(siteAudio.playOutcome).not.toHaveBeenCalled();
			if (success) await act(async () => pending.resolve());
			else
				await act(async () =>
					pending.reject(
						new ApiError(
							"Approval expired",
							410,
						),
					),
				);
			expect(
				siteAudio.playOutcome,
			).toHaveBeenCalledExactlyOnceWith(
				success ? "success" : "error",
			);
			expect(processes[0].active).toBe(false);
		},
	);

	it("stops global audio only after logout is confirmed, without a duplicate success cue", async () => {
		recordProcessSounds();
		const pending = deferred<void>();
		vi.spyOn(accountApi, "logout").mockReturnValue(pending.promise);
		await render(<AccountPage />);
		await click(button("Sign out"));
		expect(siteAudio.stopAll).not.toHaveBeenCalled();
		expect(siteAudio.playOutcome).not.toHaveBeenCalled();
		await act(async () => pending.resolve());
		expect(siteAudio.stopAll).toHaveBeenCalledOnce();
		expect(siteAudio.playOutcome).toHaveBeenCalledExactlyOnceWith(
			"disconnect",
		);
	});

	it("creates metadata-only private profiles through the reachable form", async () => {
		const create = vi
			.spyOn(accountApi, "create")
			.mockResolvedValue(personal);
		const submit = vi.spyOn(accountApi, "submit");
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Create profile"));
		const form = container.querySelector<HTMLFormElement>(
			'form[aria-label="Create personal profile"]',
		)!;
		const name = form.querySelector<HTMLInputElement>("input")!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)!.set!.call(name, "New mission");
			name.dispatchEvent(
				new Event("input", { bubbles: true }),
			);
		});
		await act(async () =>
			form.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(create).toHaveBeenCalledWith({
			name: "New mission",
			description: "",
			mods: [],
		});
		expect(submit).not.toHaveBeenCalled();
		expect(form.querySelector('input[type="file"]')).toBeNull();
	});
});

describe("separate account mission files", () => {
	it("starts with a compact dashboard and loads lists only when opened", async () => {
		await render(<AccountPage />);
		expect(
			container
				.querySelector("main")
				?.getAttribute("data-account-view"),
		).toBe("dashboard");
		expect(
			container.querySelectorAll(
				".account-card-grid article",
			),
		).toHaveLength(3);
		expect(container.querySelector("form")).toBeNull();
		expect(accountApi.profiles).not.toHaveBeenCalled();
		expect(capsuleApi.mine).not.toHaveBeenCalled();
		await openView("Personal profiles");
		expect(accountApi.profiles).toHaveBeenCalledExactlyOnceWith(
			true,
			"",
		);
		expect(
			container.querySelector(
				'form[aria-label="Create personal profile"]',
			),
		).toBeNull();
		await openView("Community profiles");
		expect(accountApi.profiles).toHaveBeenCalledWith(false, "");
		await openView("Personal profiles");
		expect(
			vi
				.mocked(accountApi.profiles)
				.mock.calls.filter(([mine]) => mine),
		).toHaveLength(1);
		expect(capsuleApi.mine).not.toHaveBeenCalled();
	});

	it("keeps an unsaved profile and search state while changing files", async () => {
		const create = vi
			.spyOn(accountApi, "create")
			.mockResolvedValue(personal);
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Create profile"));
		const editor = container.querySelector<HTMLFormElement>(
			'form[aria-label="Create personal profile"]',
		)!;
		await inputValue(
			editor.querySelector("input")!,
			"Unfinished mission",
		);
		await inputValue(
			editor.querySelector("textarea")!,
			"Draft description",
		);
		await click(button("Add mod metadata"));
		await inputValue(
			editor.querySelectorAll("input")[1],
			"Unsaved mod",
		);
		await openView("Community profiles");
		const search = container.querySelector<HTMLFormElement>(
			'form[role="search"]',
		)!;
		await inputValue(
			search.querySelector("input")!,
			"Create machines",
		);
		await openView("Personal profiles");
		const restored = container.querySelector<HTMLFormElement>(
			'form[aria-label="Create personal profile"]',
		)!;
		expect(restored.querySelector("input")?.value).toBe(
			"Unfinished mission",
		);
		expect(restored.querySelector("textarea")?.value).toBe(
			"Draft description",
		);
		expect(restored.querySelectorAll("input")[1].value).toBe(
			"Unsaved mod",
		);
		await click(button("Back to profiles"));
		expect(container.querySelector("form")).toBeNull();
		await click(button("Resume draft"));
		expect(
			container.querySelector<HTMLInputElement>(
				'form[aria-label="Create personal profile"] input',
			)?.value,
		).toBe("Unfinished mission");
		await openView("Community profiles");
		expect(
			container.querySelector<HTMLInputElement>(
				'form[role="search"] input',
			)?.value,
		).toBe("Create machines");
		expect(create).not.toHaveBeenCalled();
	});

	it("preserves the actual file input and selected JAR across view switches", async () => {
		await render(<AccountPage />);
		await openView("Private submissions");
		const { input, file, form } = await selectJar();
		await openView("Account dashboard");
		expect(
			container.querySelector<HTMLDivElement>(
				".account-persistent-pane",
			)?.hidden,
		).toBe(true);
		expect(form.closest("[hidden]")).not.toBeNull();
		await openView("Community profiles");
		await openView("Private submissions");
		expect(container.querySelector('input[type="file"]')).toBe(
			input,
		);
		expect(input.files?.[0]).toBe(file);
		expect(form.querySelector("input")?.value).toBe(
			release.project,
		);
		expect(container.querySelector("main")?.textContent).toContain(
			"workspace.jar",
		);
		expect(capsuleApi.mine).toHaveBeenCalledOnce();
	});

	it("continues an upload in another view and keeps the resulting reservation and digest", async () => {
		const upload = deferred<Capsule>();
		let report: (value: number) => void = () => {};
		vi.spyOn(capsuleApi, "reserve").mockResolvedValue(release);
		vi.spyOn(capsuleApi, "upload").mockImplementation(
			(_id, _file, _owner, _signal, progress) => {
				report = progress;
				return upload.promise;
			},
		);
		await render(<AccountPage />);
		await openView("Private submissions");
		const { form, input } = await selectJar();
		await act(async () =>
			form.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		const signal = vi.mocked(capsuleApi.upload).mock.calls[0][3];
		await openView("Community profiles");
		expect(signal.aborted).toBe(false);
		await act(async () => {
			report(100);
			upload.resolve(uploaded);
		});
		await openView("Private submissions");
		expect(container.querySelector('input[type="file"]')).toBe(
			input,
		);
		expect(container.textContent).toContain(
			"Backend confirmed the JAR digest",
		);
		expect(container.textContent).toContain(
			uploaded.artifactSha256,
		);
		expect(button("Retry JAR upload").disabled).toBe(true);
		expect(capsuleApi.reserve).toHaveBeenCalledOnce();
		expect(capsuleApi.upload).toHaveBeenCalledOnce();
	});

	it("clears private drafts and aborts an in-flight upload on sign-out", async () => {
		const upload = deferred<Capsule>();
		vi.spyOn(accountApi, "logout").mockResolvedValue();
		vi.spyOn(capsuleApi, "reserve").mockResolvedValue(release);
		vi.spyOn(capsuleApi, "upload").mockReturnValue(upload.promise);
		await render(<AccountPage />);
		await openView("Private submissions");
		const { form } = await selectJar();
		await act(async () =>
			form.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		const signal = vi.mocked(capsuleApi.upload).mock.calls[0][3];
		await openView("Account dashboard");
		await click(button("Sign out"));
		expect(signal.aborted).toBe(true);
		expect(
			container.querySelector('input[type="file"]'),
		).toBeNull();
		await act(async () => upload.resolve(uploaded));
		expect(container.textContent).not.toContain(release.project);
		expect(container.textContent).not.toContain(
			"Backend confirmed",
		);
		expect(container.textContent).toContain(
			"Website session signed out",
		);
	});

	it("resets owner-specific state after session identity replacement", async () => {
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Create profile"));
		await inputValue(
			container.querySelector<HTMLInputElement>(
				'form[aria-label="Create personal profile"] input',
			)!,
			"Old astronaut draft",
		);
		const other = { ...user, id: "99", username: "another" };
		vi.mocked(accountApi.session).mockResolvedValue(other);
		vi.mocked(capsuleApi.mine).mockRejectedValueOnce(
			new ApiError("Session changed", 401),
		);
		await openView("Private submissions");
		expect(
			container.querySelector(".account-identity")
				?.textContent,
		).toContain("another");
		expect(container.textContent).not.toContain(
			"Old astronaut draft",
		);
		vi.mocked(accountApi.profiles).mockResolvedValue([]);
		await openView("Personal profiles");
		await click(button("Create profile"));
		expect(
			container.querySelector<HTMLInputElement>(
				'form[aria-label="Create personal profile"] input',
			)?.value,
		).toBe("");
	});

	it("ignores a late sign-out result from a replaced identity", async () => {
		const logout = deferred<void>();
		vi.spyOn(accountApi, "logout").mockReturnValue(logout.promise);
		await render(<AccountPage />);
		await click(button("Sign out"));
		vi.mocked(accountApi.session).mockResolvedValue({
			...user,
			id: "99",
			username: "another",
		});
		vi.mocked(capsuleApi.mine).mockRejectedValueOnce(
			new ApiError("Session changed", 401),
		);
		await openView("Private submissions");
		await act(async () => logout.resolve());
		expect(
			container.querySelector(".account-identity")
				?.textContent,
		).toContain("another");
		expect(container.textContent).not.toContain(
			"Website session signed out",
		);
	});

	it("exposes all four account files in the mobile menu and closes after selection", async () => {
		await render(<AccountPage />);
		const toggle = container.querySelector<HTMLButtonElement>(
			".header-menu-toggle",
		)!;
		expect(toggle.getAttribute("aria-label")).toBe(
			"Open account menu",
		);
		await click(toggle);
		const menu = container.querySelector<HTMLDivElement>(
			".mobile-mission-menu",
		)!;
		expect(menu.hidden).toBe(false);
		expect(
			menu.querySelectorAll(".mobile-directory-nav button"),
		).toHaveLength(4);
		const community = Array.from(
			menu.querySelectorAll<HTMLButtonElement>("button"),
		).find((button) =>
			button.textContent?.includes("Community profiles"),
		)!;
		await click(community);
		expect(menu.hidden).toBe(true);
		expect(
			container
				.querySelector("main")
				?.getAttribute("data-account-view"),
		).toBe("community");
		expect(
			menu.querySelector('a[href="/"]')?.textContent,
		).toContain("Mission control");
	});
});
describe("personal profile operations", () => {
	it("sends public search to the backend without client-side empty-list fallbacks", async () => {
		await render(<AccountPage />);
		await openView("Community profiles");
		const search = container.querySelector<HTMLFormElement>(
			'form[role="search"]',
		)!;
		await act(async () => {
			Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)!.set!.call(search.querySelector("input"), "MARS");
			search.querySelector("input")!.dispatchEvent(
				new Event("input", { bubbles: true }),
			);
		});
		await act(async () =>
			search.dispatchEvent(
				new Event("submit", {
					bubbles: true,
					cancelable: true,
				}),
			),
		);
		expect(accountApi.profiles).toHaveBeenCalledWith(false, "MARS");
	});
	it("copies public metadata into a new private profile and does not submit automatically", async () => {
		const create = vi
			.spyOn(accountApi, "create")
			.mockResolvedValue(personal);
		const submit = vi.spyOn(accountApi, "submit");
		await render(<AccountPage />);
		await openView("Community profiles");
		await click(button("Copy Public mission"));
		expect(create).toHaveBeenCalledWith(
			{
				name: "Public mission (personal copy)",
				description: "My mods",
				mods: [],
			},
			"public1",
		);
		expect(submit).not.toHaveBeenCalled();
		expect(container.textContent).toContain(
			"Independent personal copy created",
		);
	});
	it("edits metadata without visibility or role changes", async () => {
		const update = vi
			.spyOn(accountApi, "update")
			.mockResolvedValue(personal);
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Edit Personal mission"));
		await act(async () =>
			container
				.querySelector(
					'form[aria-label="Edit personal profile"]',
				)!
				.dispatchEvent(
					new Event("submit", {
						bubbles: true,
						cancelable: true,
					}),
				),
		);
		expect(update).toHaveBeenCalledWith("mine1", {
			name: personal.name,
			description: personal.description,
			mods: [],
		});
		expect(container.textContent).toContain(
			"Saving does not publish",
		);
	});
	it("requires deletion confirmation and submits only after an explicit action with clear refusal", async () => {
		const remove = vi
			.spyOn(accountApi, "remove")
			.mockResolvedValue();
		vi.spyOn(accountApi, "submit").mockRejectedValue(
			new ApiError(
				"No scanning",
				409,
				"scanning_not_configured",
			),
		);
		await render(<AccountPage />);
		await openView("Personal profiles");
		await click(button("Delete Personal mission"));
		expect(remove).not.toHaveBeenCalled();
		await click(button("Cancel deletion"));
		await click(button("Submit Personal mission"));
		expect(
			container.querySelector('[role="alert"]')?.textContent,
		).toContain("Submission refused by backend");
		await click(button("Delete Personal mission"));
		await click(button("Confirm deletion"));
		expect(remove).toHaveBeenCalledExactlyOnceWith("mine1");
	});
	it("shows list/network failure rather than pretending no profiles exist", async () => {
		vi.mocked(accountApi.profiles).mockRejectedValue(
			new ApiError("Network unavailable"),
		);
		await render(<AccountPage />);
		await openView("Personal profiles");
		expect(container.textContent).toContain("Network unavailable");
		expect(container.textContent).not.toContain(
			"No personal profiles",
		);
		expect(container.textContent).not.toContain(
			"No public profiles",
		);
		await openView("Community profiles");
		expect(
			container.querySelector('[role="alert"]')?.textContent,
		).toContain("Network unavailable");
	});
	it("handles unauthenticated users without fetching owner profiles or allowing copies", async () => {
		vi.mocked(accountApi.session).mockResolvedValue(null);
		await render(<AccountPage />);
		await openView("Community profiles");
		expect(accountApi.profiles).not.toHaveBeenCalledWith(
			true,
			expect.anything(),
		);
		expect(button("Copy Public mission").disabled).toBe(true);
		expect(
			container.querySelector(
				'form[aria-label="Create personal profile"]',
			),
		).toBeNull();
	});
	it("logs out the website cookie session without assigning client roles", async () => {
		const logout = vi
			.spyOn(accountApi, "logout")
			.mockResolvedValue();
		await render(<AccountPage />);
		await click(button("Sign out"));
		expect(logout).toHaveBeenCalledOnce();
		expect(container.textContent).toContain(
			"Website session signed out",
		);
		expect(
			container.querySelector(
				'form[aria-label="Create personal profile"]',
			),
		).toBeNull();
	});
	it("validates mod metadata and makes independent copies", () => {
		expect(
			validateProfileInput({
				name: "",
				description: "",
				mods: [],
			}),
		).toContain("profile name");
		expect(
			validateProfileInput({
				name: "test",
				description: "",
				mods: [
					{
						name: "mod",
						version: "1",
						sourceUrl: "javascript:bad",
						sha256: "bad",
					},
				],
			}),
		).toContain("64-character");
		const mod = {
			name: "mod",
			version: "1",
			sourceUrl: "https://example.com/mod",
			sha256: "a".repeat(64),
		};
		const original = { ...publicProfile, mods: [mod] };
		const copy = copyProfileInput(original);
		copy.mods[0].name = "edited";
		expect(original.mods[0].name).toBe("mod");
		expect(
			validateProfileInput({
				name: "test",
				description: "",
				mods: [mod],
			}),
		).toBeNull();
	});
	it("rejects HTTP mod sources and accepts HTTPS without changing loopback API support", () => {
		const input = {
			name: "Mission",
			description: "",
			mods: [
				{
					name: "Mod",
					version: "1",
					sourceUrl: "http://example.com/mod.jar",
					sha256: "a".repeat(64),
				},
			],
		};
		expect(validateProfileInput(input)).toContain(
			"HTTPS source URL",
		);
		input.mods[0].sourceUrl = "https://example.com/mod.jar";
		expect(validateProfileInput(input)).toBeNull();
	});
});
