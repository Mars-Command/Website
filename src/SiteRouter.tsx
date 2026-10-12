import App from "./App";
import { AccountPage } from "./components/AccountPage";
import { AccountShell } from "./components/AccountShell";
import { AuthLogin } from "./components/AuthLogin";
import { routeFor } from "./utils/accountUi";

export function SiteRouter() {
	const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }));
	useEffect(() => {
		const update = () => setLocation({ pathname: window.location.pathname, search: window.location.search });
		const navigate = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = event.target instanceof Element ? event.target.closest("a") : null;
			if (!anchor || !anchor.hasAttribute("href") || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
			const url = anchor;
			if (url.origin !== window.location.origin || routeFor(url.pathname) === "not-found" ||
				(url.pathname === window.location.pathname && url.search === window.location.search)) return;
			event.preventDefault();
			window.history.pushState(null, "", url.href);
			update();
			window.scrollTo({ top: 0, behavior: "instant" });
		};
		window.addEventListener("popstate", update);
		document.addEventListener("click", navigate);
		return () => { window.removeEventListener("popstate", update); document.removeEventListener("click", navigate); };
	}, []);
	const route = routeFor(location.pathname);
	useEffect(() => {
		document.title = route === "home" ? "Mars Command // Colony Network" :
			`${route === "account" ? "Account" : route === "login" ? "Sign in" : "Page not found"} // Mars Command`;
	}, [route]);
	const key = `${location.pathname}${location.search}`;
	switch (route) {
		case "home": return <App key={key} />;
		case "login": return <AuthLogin key={key} search={location.search} />;
		case "account": return <AccountPage key={key} />;
		default: return <AccountShell key={key} title="Page not found"><p>Use mission control navigation to return home.</p></AccountShell>;
	}
}
import { useEffect, useState } from "react";
