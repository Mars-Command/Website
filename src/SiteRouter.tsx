import App from "./App";
import { AccountPage } from "./components/AccountPage";
import { AccountShell } from "./components/AccountShell";
import { AuthLogin } from "./components/AuthLogin";
import { SoundSettings } from "./components/SoundSettings";
import { PageEntryProvider } from "./components/TerminalExperience";
import { siteAudio } from "./services/siteAudio";
import { routeFor } from "./utils/accountUi";

export function SiteRouter() {
	const [location, setLocation] = useState(() => ({
		pathname: window.location.pathname,
		search: window.location.search,
	}));
	useEffect(() => {
		const historyIndex = (state: unknown) =>
			typeof state === "object" &&
			state !== null &&
			"marsNavigationIndex" in state &&
			typeof state.marsNavigationIndex === "number"
				? state.marsNavigationIndex
				: 0;
		let position = historyIndex(window.history.state);
		const update = () => {
			siteAudio.stopLoops();
			setLocation({
				pathname: window.location.pathname,
				search: window.location.search,
			});
		};
		const historyNavigation = (event: PopStateEvent) => {
			const next = historyIndex(event.state);
			update();
			if (next !== position)
				siteAudio.playOutcome(
					next < position ? "back" : "forward",
				);
			position = next;
		};
		const navigate = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return;
			const anchor =
				event.target instanceof Element
					? event.target.closest("a")
					: null;
			if (
				!anchor ||
				!anchor.hasAttribute("href") ||
				anchor.hasAttribute("download") ||
				(anchor.target && anchor.target !== "_self")
			)
				return;
			const url = anchor;
			if (
				url.origin !== window.location.origin ||
				routeFor(url.pathname) === "not-found" ||
				(url.pathname === window.location.pathname &&
					url.search === window.location.search)
			)
				return;
			event.preventDefault();
			siteAudio.stopLoops();
			window.history.pushState(
				{ marsNavigationIndex: ++position },
				"",
				url.href,
			);
			siteAudio.playFromGesture("forward");
			update();
			window.scrollTo({ top: 0, behavior: "instant" });
		};
		window.addEventListener("popstate", historyNavigation);
		document.addEventListener("click", navigate);
		return () => {
			window.removeEventListener(
				"popstate",
				historyNavigation,
			);
			document.removeEventListener("click", navigate);
		};
	}, []);
	const route = routeFor(location.pathname);
	useEffect(() => {
		document.title =
			route === "home"
				? "Mars Command // Colony Network"
				: `${route === "account" ? "Account" : route === "login" ? "Sign in" : "Page not found"} // Mars Command`;
	}, [route]);
	const key = `${location.pathname}${location.search}`;
	const page =
		route === "home" ? (
			<App key={key} />
		) : route === "login" ? (
			<AuthLogin key={key} search={location.search} />
		) : route === "account" ? (
			<AccountPage key={key} />
		) : (
			<AccountShell key={key} title="Page not found">
				<p>
					Use mission control navigation to return
					home.
				</p>
			</AccountShell>
		);
	return (
		<PageEntryProvider>
			<SoundSettings />
			{page}
		</PageEntryProvider>
	);
}
import { useEffect, useState } from "react";
