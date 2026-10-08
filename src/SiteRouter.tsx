import App from "./App";
import { AccountPage } from "./components/AccountPage";
import { AccountShell } from "./components/AccountShell";
import { AuthLogin } from "./components/AuthLogin";
import { routeFor } from "./utils/accountUi";

export function SiteRouter() {
	switch (routeFor(window.location.pathname)) {
		case "home": return <App />;
		case "login": return <AuthLogin />;
		case "account": return <AccountPage />;
		default: return <AccountShell title="Page not found"><p>Use mission control navigation to return home.</p></AccountShell>;
	}
}
