// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { transmissions } from "../data/transmissions";
import { useServerStatus } from "../hooks/useServerStatus";
import { PageExperience, PLANET_FADE_MS, TerminalBox, TerminalFade, TerminalSequence, TerminalText } from "./TerminalExperience";

vi.mock("../hooks/useServerStatus", () => ({ useServerStatus: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
let reduced = false;
let originalFonts: PropertyDescriptor | undefined;
let originalScroll: PropertyDescriptor | undefined;

beforeEach(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers();
	reduced = false;
	vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
	vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
	vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
	originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
	vi.mocked(useServerStatus).mockReturnValue({
		status: { online: true, host: "play.nexusgit.info", port: 25565, playersOnline: 2, playersMax: 67,
			latencyMs: null, motd: "Welcome to Mars", versionName: "Reported NeoForge build", checkedAt: "2026-10-12T03:00:00Z", error: null },
		isChecking: false, lastUpdated: "2026-10-12T03:00:00Z", refresh: vi.fn(),
	});
	originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
	Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
	else Reflect.deleteProperty(document, "fonts");
	if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
	else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function Screen({ ready = true, first = "First terminal line" }: { ready?: boolean; first?: string }) {
	return <StrictMode><PageExperience ready={ready}>
		<TerminalSequence><main><p><TerminalText>{first}</TerminalText></p><p><TerminalText>Second terminal line</TerminalText></p></main></TerminalSequence>
		<TerminalFade order={2}><aside>Sidebar information</aside></TerminalFade>
	</PageExperience></StrictMode>;
}
async function render(props: { ready?: boolean; first?: string } = {}) {
	await act(async () => root.render(<Screen {...props} />));
}
async function imageEvent(type = "load") {
	const image = container.querySelector(".planet-loader img");
	if (!image) throw new Error("Missing loading planet");
	await act(async () => image.dispatchEvent(new Event(type)));
	await advance(16);
}
async function advance(ms: number) { await act(async () => vi.advanceTimersByTime(ms)); }
function lines() { return Array.from(container.querySelectorAll("[data-type-line]")); }
function click(text: string) {
	const button = Array.from(container.querySelectorAll("button")).find(item => item.textContent === text);
	if (!button) throw new Error(`Missing button: ${text}`);
	return act(async () => button.click());
}

describe("planet boot and terminal reveal", () => {
	it("waits for document, fonts, image and initial data before the exact 1.5-second fade", async () => {
		vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
		let finishFonts: () => void = () => {};
		Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>(resolve => { finishFonts = resolve; }) } });
		await render({ ready: false });
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("loading");
		expect(container.querySelector(".page-content")?.hasAttribute("inert")).toBe(true);
		await imageEvent();
		await render();
		await advance(3000);
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("loading");
		await act(async () => window.dispatchEvent(new Event("load")));
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("loading");
		await act(async () => finishFonts());
		await advance(16);
		expect(PLANET_FADE_MS).toBe(1500);
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("fading");
		await advance(1499);
		expect(container.querySelector(".is-entered")).toBeNull();
		expect(lines().every(line => !line.classList.contains("is-typed"))).toBe(true);
		await advance(1);
		expect(container.querySelector(".planet-loader")).toBeNull();
		expect(container.querySelector(".page-content")?.hasAttribute("inert")).toBe(false);
		expect(container.querySelector(".terminal-fade")?.classList.contains("is-revealed")).toBe(true);
		expect(container.querySelector(".terminal-fade")?.getAttribute("style")).toContain("220ms");
	});

	it("types top to bottom, reserves full text, and does not replay on live updates", async () => {
		await render();
		await imageEvent();
		await advance(1500);
		await advance(80);
		expect(lines()[0].querySelector(".typed-output")?.textContent?.length).toBeGreaterThan(0);
		expect(lines()[1].querySelector(".typed-output")?.textContent).toBe("");
		expect(lines()[0].querySelector(".typed-source")?.textContent).toBe("First terminal line");
		expect(lines()[0].querySelector(".typed-output")?.getAttribute("aria-hidden")).toBe("true");
		await advance(1000);
		expect(lines().every(line => line.classList.contains("is-typed"))).toBe(true);
		expect(container.textContent).not.toContain("Skip typing");
		await render({ first: "Fresh telemetry without replay" });
		expect(lines()[0].classList.contains("is-typed")).toBe(true);
		expect(lines()[0].textContent).toBe("Fresh telemetry without replay");
	});

	it("respects reduced motion without a fade or partial text", async () => {
		reduced = true;
		await render();
		await imageEvent();
		expect(container.querySelector(".planet-loader")).toBeNull();
		expect(lines().every(line => line.classList.contains("is-typed"))).toBe(true);
		expect(container.querySelector(".terminal-fade")?.classList.contains("no-motion")).toBe(true);
		expect(container.textContent).not.toContain("Skip typing");
	});

	it("does not wait for animation frames when motion is disabled", async () => {
		reduced = true;
		const frame = vi.fn(() => 0);
		vi.stubGlobal("requestAnimationFrame", frame);
		await render();
		await imageEvent();
		expect(container.querySelector(".planet-loader")).toBeNull();
		expect(lines().every(line => line.classList.contains("is-typed"))).toBe(true);
		expect(frame).not.toHaveBeenCalled();
	});

	it("allows skipping without bypassing readiness, and skipping in-progress typing", async () => {
		await render({ ready: false });
		await imageEvent();
		await click("Skip intro");
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("loading");
		await render();
		await advance(16);
		expect(container.querySelector(".planet-loader")).toBeNull();
		expect(lines().every(line => line.classList.contains("is-typed"))).toBe(true);
		await act(async () => root.unmount());
		root = createRoot(container);
		await render();
		await imageEvent();
		await advance(1500);
		await click("Skip typing");
		expect(lines().every(line => line.classList.contains("is-typed"))).toBe(true);
		expect(container.querySelector(".terminal-fade")?.classList.contains("no-motion")).toBe(true);
	});

	it("reports a failed planet image and cleans up animation timers on unmount", async () => {
		await render({ ready: false });
		await imageEvent("error");
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("Planet image unavailable");
		await render();
		await advance(16);
		expect(container.querySelector("[data-phase]")?.getAttribute("data-phase")).toBe("fading");
		await advance(1500);
		await advance(80);
		await act(async () => root.unmount());
		expect(document.body.style.overflow).toBe("");
		expect(vi.getTimerCount()).toBe(0);
		root = createRoot(container);
	});

	it("draws each container only when the typing sequence reaches it", async () => {
		await act(async () => root.render(<StrictMode><PageExperience><TerminalSequence>
			<p><TerminalText>A sufficiently long introductory line before any boxes</TerminalText></p>
			<TerminalBox id="first-box" className="panel"><TerminalText>Inside the first box</TerminalText></TerminalBox>
			<TerminalBox id="second-box" className="panel"><TerminalText>Inside the second box</TerminalText></TerminalBox>
		</TerminalSequence></PageExperience></StrictMode>));
		const first = container.querySelector("#first-box")!;
		const second = container.querySelector("#second-box")!;
		await imageEvent();
		await advance(1500);
		await advance(80);
		expect(first.classList.contains("is-drawn")).toBe(false);
		expect(second.classList.contains("is-drawn")).toBe(false);
		expect(first.hasAttribute("inert")).toBe(true);
		await advance(500);
		expect(first.classList.contains("is-drawn")).toBe(true);
		expect(first.hasAttribute("inert")).toBe(false);
		expect(second.classList.contains("is-drawn")).toBe(false);
		expect(first.querySelector(".typed-output")?.textContent).toBe("");
		expect(first.querySelector("rect")?.getAttribute("pathLength")).toBe("1");
		await advance(1500);
		expect(second.classList.contains("is-drawn")).toBe(true);
		expect(first).toBe(container.querySelector("#first-box"));
		expect(first.querySelector(".is-typed")).not.toBeNull();
	});
});

async function renderApp() {
	await act(async () => root.render(<StrictMode><App /></StrictMode>));
}
async function openApp() {
	await renderApp();
	await imageEvent();
	await advance(1500);
	await advance(30000);
}
async function select(label: string) {
	const item = Array.from(container.querySelectorAll<HTMLButtonElement>(".directory-nav button")).find(button => button.textContent?.includes(label));
	if (!item) throw new Error(`Missing directory item: ${label}`);
	await act(async () => item.click());
}
function phase() { return container.querySelector("main")?.getAttribute("data-navigation-phase"); }
function view() { return container.querySelector("main")?.getAttribute("data-view"); }
function command() { return container.querySelector(".terminal-command-line .typed-source")?.textContent; }

describe("mission file navigation", () => {
	it("types clear, removes output, types cat, then types the selected detailed view", async () => {
		await openApp();
		const sidebar = container.querySelector("aside");
		expect(phase()).toBe("idle");
		await select("Server uplink");
		expect(phase()).toBe("clear");
		expect(command()).toBe("clear");
		expect(container.querySelector("#hero-panel")).not.toBeNull();
		await advance(80);
		const partial = container.querySelector(".terminal-command-line .typed-output")?.textContent ?? "";
		expect(partial.length).toBeGreaterThan(0);
		expect(partial.length).toBeLessThan(5);
		await advance(120);
		expect(phase()).toBe("cat");
		expect(view()).toBe("empty");
		expect(container.querySelector(".terminal-output")?.textContent).toBe("");
		expect(command()).toBe("cat server-uplink.txt");
		await advance(300);
		expect(view()).toBe("uplink");
		expect(phase()).toBe("typing");
		expect(container.querySelector("#server-status")?.classList.contains("is-drawn")).toBe(false);
		expect(container.querySelector("#hero-panel")).toBeNull();
		expect(sidebar).toBe(container.querySelector("aside"));
		expect(container.querySelector(".planet-loader")).toBeNull();
		await advance(30000);
		expect(phase()).toBe("idle");
		const mainText = container.querySelector("main")?.textContent;
		expect(mainText).toContain("Reported NeoForge build");
		expect(mainText).toContain("Configured mod loader");
		expect(mainText).toContain("does not report the running mod inventory");
		expect(container.querySelectorAll("#telemetry-heading")).toHaveLength(1);
		expect(container.querySelectorAll("#uplink-telemetry-heading")).toHaveLength(1);
		expect(container.querySelector('.directory-nav button[aria-current="page"]')?.textContent).toContain("Server uplink");
	});

	describe("mobile mission menu", () => {
		it("exposes every mission view and closes after selecting each one", async () => {
			reduced = true;
			await openApp();
			const toggle = container.querySelector<HTMLButtonElement>(".header-menu-toggle")!;
			const menu = container.querySelector<HTMLDivElement>(".mobile-mission-menu")!;
			expect(toggle.getAttribute("aria-expanded")).toBe("false");
			expect(toggle.getAttribute("aria-controls")).toBe(menu.id);
			expect(menu.hidden).toBe(true);
			for (const [label, id] of [
				["Server uplink", "uplink"], ["Deployment", "deployment"], ["Transmissions", "transmissions"],
				["Account & profiles", "account"], ["Overview", "overview"],
			]) {
				await act(async () => toggle.click());
				expect(toggle.getAttribute("aria-expanded")).toBe("true");
				expect(menu.hidden).toBe(false);
				expect(menu.querySelectorAll(".mobile-directory-nav button")).toHaveLength(5);
				const item = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.includes(label))!;
				await act(async () => item.click());
				expect(view()).toBe(id);
				expect(phase()).toBe("idle");
				expect(menu.hidden).toBe(true);
				expect(toggle.getAttribute("aria-expanded")).toBe("false");
				expect(document.activeElement).toBe(container.querySelector("main"));
				expect(menu.querySelector('button[aria-current="page"]')?.textContent).toContain(label);
			}
			expect(menu.querySelector('a[href$="account"]')?.textContent).toContain("Account dashboard");
			expect(menu.querySelector('a[href$="auth/login"]')?.textContent).toContain("Sign in");
		});

		it("uses the existing clear and cat animation for mobile selections", async () => {
			await openApp();
			const toggle = container.querySelector<HTMLButtonElement>(".header-menu-toggle")!;
			await act(async () => toggle.click());
			const item = Array.from(container.querySelectorAll<HTMLButtonElement>(".mobile-directory-nav button"))
				.find(button => button.textContent?.includes("Server uplink"))!;
			await act(async () => item.click());
			expect(container.querySelector<HTMLDivElement>(".mobile-mission-menu")?.hidden).toBe(true);
			expect(document.activeElement).toBe(toggle);
			expect(phase()).toBe("clear");
			expect(command()).toBe("clear");
			await advance(200);
			expect(phase()).toBe("cat");
			expect(command()).toBe("cat server-uplink.txt");
			await advance(300);
			expect(view()).toBe("uplink");
			await advance(30000);
			expect(phase()).toBe("idle");
			expect(document.activeElement).toBe(container.querySelector("main"));
		});

		it("supports Escape, outside interaction and moving focus outside the menu", async () => {
			reduced = true;
			await openApp();
			const toggle = container.querySelector<HTMLButtonElement>(".header-menu-toggle")!;
			const menu = container.querySelector<HTMLDivElement>(".mobile-mission-menu")!;
			await act(async () => { toggle.focus(); toggle.click(); });
			await act(async () => menu.querySelector<HTMLButtonElement>("button")!.focus());
			await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
			expect(menu.hidden).toBe(true);
			expect(document.activeElement).toBe(toggle);
			await act(async () => toggle.click());
			await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
			expect(menu.hidden).toBe(true);
			await act(async () => toggle.click());
			await act(async () => container.querySelector<HTMLElement>("main")!.focus());
			expect(menu.hidden).toBe(true);
			expect(document.activeElement).toBe(container.querySelector("main"));
		});

		it("closes when the layout switches to desktop and removes its resize listener", async () => {
			reduced = true;
			let resize = () => {};
			const media = {
				matches: true,
				addEventListener: vi.fn((_type: string, listener: () => void) => { resize = listener; }),
				removeEventListener: vi.fn(),
			};
			vi.stubGlobal("matchMedia", (query: string) => query.includes("max-width") ? media :
				{ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
			await openApp();
			const toggle = container.querySelector<HTMLButtonElement>(".header-menu-toggle")!;
			await act(async () => toggle.click());
			expect(container.querySelector<HTMLDivElement>(".mobile-mission-menu")?.hidden).toBe(false);
			media.matches = false;
			await act(async () => resize());
			expect(container.querySelector<HTMLDivElement>(".mobile-mission-menu")?.hidden).toBe(true);
			expect(toggle.getAttribute("aria-expanded")).toBe("false");
			expect(media.removeEventListener).toHaveBeenCalledWith("change", resize);
		});
	});

	it("supersedes rapid clicks during clear, cat and view typing", async () => {
		await openApp();
		await select("Server uplink");
		await advance(50);
		await select("Deployment");
		await advance(200);
		expect(command()).toBe("cat deployment.txt");
		await select("Transmissions");
		await advance(200);
		expect(command()).toBe("cat transmissions.log");
		await advance(300);
		expect(view()).toBe("transmissions");
		await advance(80);
		await select("Account & profiles");
		await advance(200);
		await advance(400);
		expect(view()).toBe("account");
		await advance(30000);
		expect(view()).toBe("account");
		expect(phase()).toBe("idle");
		expect(container.querySelector("#identity-details")).not.toBeNull();
		expect(container.querySelector("#transmissions")).toBeNull();
		expect(container.querySelector("#server-stack")).toBeNull();
	});

	it("shows expanded content and drawn boxes immediately with reduced motion", async () => {
		reduced = true;
		await openApp();
		for (const [label, id, expected] of [
			["Deployment", "deployment", "Ed25519"],
			["Transmissions", "transmissions", "curated release notes"],
			["Account & profiles", "account", "64 MiB"],
			["Overview", "overview", "YOUR PLACE IN THE COLONY"],
		]) {
			await select(label);
			expect(view()).toBe(id);
			expect(phase()).toBe("idle");
			expect(container.querySelector("main")?.textContent).toContain(expected);
			expect(container.querySelectorAll(".terminal-box:not(.is-drawn)")).toHaveLength(0);
			expect(container.querySelectorAll("[data-type-line]:not(.is-typed)")).toHaveLength(0);
			expect(command()).toBeUndefined();
		}
		await select("Deployment");
		expect(container.querySelector('.button-secondary[href="#deployment-guide"]')).not.toBeNull();
		expect(container.querySelectorAll("#install-guide")).toHaveLength(1);
		expect(container.querySelectorAll("#deployment-guide")).toHaveLength(1);
	});

	it("continues updating telemetry without replaying commands or borders", async () => {
		reduced = true;
		await openApp();
		await select("Server uplink");
		const card = container.querySelector("#server-status");
		const feed = vi.mocked(useServerStatus).mock.results.at(-1)?.value;
		vi.mocked(useServerStatus).mockReturnValue({ ...feed, status: { ...feed.status, playersOnline: 7, versionName: "Fresh server build" } });
		await renderApp();
		expect(view()).toBe("uplink");
		expect(phase()).toBe("idle");
		expect(card).toBe(container.querySelector("#server-status"));
		expect(container.querySelector("#server-status")?.textContent).toContain("7 / 67");
		expect(container.querySelector("main")?.textContent).toContain("Fresh server build");
		expect(container.querySelectorAll("[data-type-line]:not(.is-typed)")).toHaveLength(0);
	});

	it("shows the same actual change notes in overview and the transmissions file", async () => {
		reduced = true;
		await openApp();
		const overviewNotes = Array.from(container.querySelectorAll(".transmission-list article"), article => article.textContent);
		expect(overviewNotes).toHaveLength(transmissions.length);
		expect(container.querySelector(".transmission-count")?.textContent).toBe(`${String(transmissions.length).padStart(2, "0")} UPDATES`);
		expect(overviewNotes.join(" ")).toContain("Interactive mission files added");
		expect(overviewNotes.join(" ")).toContain("Full-page terminal interface rebuilt");
		expect(overviewNotes.join(" ")).toContain("Private JAR submission workflows added");
		expect(overviewNotes.join(" ")).not.toMatch(/END PROTOCOL|Landing Zone 01|fictional limits|somebody else's problem/);
		await select("Transmissions");
		const detailedNotes = Array.from(container.querySelectorAll(".transmission-list article"), article => article.textContent);
		expect(detailedNotes).toEqual(overviewNotes);
		const logDescription = container.querySelector("#transmission-source")?.closest("section")?.textContent;
		expect(logDescription).toContain("curated release notes");
		expect(logDescription).not.toContain("moon");
	});

	it("skips an in-flight command cleanly and retains keyboard-accessible controls", async () => {
		await openApp();
		await select("Server uplink");
		await advance(50);
		await click("Skip typing");
		expect(view()).toBe("uplink");
		expect(phase()).toBe("idle");
		expect(container.querySelector(".skip-typing")).toBeNull();
		const refresh = container.querySelector<HTMLButtonElement>(".refresh-button")!;
		await act(async () => refresh.click());
		expect(vi.mocked(useServerStatus).mock.results.at(-1)?.value.refresh).toHaveBeenCalledOnce();
		expect(document.activeElement).toBe(container.querySelector("main"));
		expect(container.querySelector("main")?.getAttribute("aria-busy")).toBe("false");
		await select("Deployment");
		expect(phase()).toBe("clear");
		expect(command()).toBe("clear");
	});

	it("still animates new navigation after the initial intro was skipped", async () => {
		await renderApp();
		await imageEvent();
		await click("Skip intro");
		await advance(16);
		expect(phase()).toBe("idle");
		const oldCard = container.querySelector("#server-status");
		const sidebar = container.querySelector(".sidebar-directory");
		await select("Server uplink");
		expect(phase()).toBe("clear");
		expect(command()).toBe("clear");
		expect(sidebar?.classList.contains("no-motion")).toBe(true);
		expect(oldCard?.classList.contains("no-motion")).toBe(true);
		await advance(200);
		await advance(300);
		expect(container.querySelector("#server-status")?.classList.contains("no-motion")).toBe(false);
	});
});
