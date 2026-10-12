// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteRouter } from "./SiteRouter";
import { sitePath } from "./config/account";

vi.mock("./App", () => ({ default: () => <main><a href={sitePath("account")}>Account</a><a href={sitePath("auth/login") + "?requestId=mission-1"}>Desktop sign in</a></main> }));
vi.mock("./components/AccountPage", () => ({ AccountPage: () => <main>Personal profiles<a href={sitePath()}>Home</a></main> }));
vi.mock("./components/AuthLogin", () => ({ AuthLogin: ({ search }: { search: string }) => <main>Login callback: {search}</main> }));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
	(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	window.history.replaceState(null, "", sitePath());
	vi.spyOn(window, "scrollTo").mockImplementation(() => {});
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", sitePath());
});

describe("dynamic terminal navigation", () => {
	it("navigates internally through history and responds to back/forward events", async () => {
		const push = vi.spyOn(window.history, "pushState");
		await act(async () => root.render(<SiteRouter />));
		await act(async () => container.querySelector<HTMLAnchorElement>('a[href$="account"]')!.click());
		expect(push).toHaveBeenCalledOnce();
		expect(window.location.pathname).toBe(sitePath("account"));
		expect(container.textContent).toContain("Personal profiles");
		expect(document.title).toBe("Account // Mars Command");
		expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
		await act(async () => {
			window.history.replaceState(null, "", sitePath());
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(container.textContent).toContain("Desktop sign in");
		expect(document.title).toBe("Mars Command // Colony Network");
	});

	it("retains desktop request query state when switching routes", async () => {
		await act(async () => root.render(<SiteRouter />));
		await act(async () => container.querySelector<HTMLAnchorElement>('a[href*="requestId"]')!.click());
		expect(window.location.search).toBe("?requestId=mission-1");
		expect(container.textContent).toContain("Login callback: ?requestId=mission-1");
	});

	it("does not intercept modified, download, external, hash, or already-handled clicks", async () => {
		const push = vi.spyOn(window.history, "pushState");
		await act(async () => root.render(<SiteRouter />));
		const nativeCases = [
			{ href: sitePath("account"), ctrlKey: true },
			{ href: sitePath("account"), button: 1 },
			{ href: sitePath("account"), target: "_blank" },
			{ href: sitePath("account"), download: "profile" },
			{ href: "https://github.com/" },
			{ href: "http://%" },
			{ href: null },
			{ href: "#main-content" },
			{ href: sitePath("account"), handled: true },
		];
		for (const item of nativeCases) {
			const anchor = document.createElement("a");
			if (item.href !== null) anchor.href = item.href;
			if (item.target) anchor.target = item.target;
			if (item.download) anchor.download = item.download;
			document.body.append(anchor);
			const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: item.ctrlKey, button: item.button ?? 0 });
			if (item.handled) event.preventDefault();
			// Cancel native jsdom navigation after the router has had the opportunity to handle it.
			const cancelNative = (click: MouseEvent) => {
				expect(click.defaultPrevented).toBe(!!item.handled);
				click.preventDefault();
			};
			document.addEventListener("click", cancelNative);
			await act(async () => anchor.dispatchEvent(event));
			document.removeEventListener("click", cancelNative);
			anchor.remove();
		}
		expect(push).not.toHaveBeenCalled();
	});
});
