export function safeHttpUrl(value: string | undefined): string | null {
	if (!value?.trim()) return null;
	try {
		const url = new URL(value.trim());
		if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}

export function configuredApiBase(value: string | undefined): string | null {
	const safe = safeHttpUrl(value);
	if (!safe) return null;
	const url = new URL(safe);
	const localHttp = url.protocol === "http:" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if ((url.protocol !== "https:" && !localHttp) ||
		url.search || url.hash || /\/api\/?$/.test(url.pathname)) return null;
	return safe.replace(/\/+$/, "");
}

export function configuredSponsorsUrl(value: string | undefined): string | null {
	const safe = safeHttpUrl(value);
	if (!safe) return null;
	const url = new URL(safe);
	return url.protocol === "https:" && url.hostname === "github.com" &&
		!url.port && /^\/sponsors\/[A-Za-z0-9-]+\/?$/.test(url.pathname) &&
		!url.search && !url.hash ? safe : null;
}

export const accountConfig = {
	apiBase: configuredApiBase(import.meta.env.VITE_API_BASE_URL),
	sponsorsUrl: configuredSponsorsUrl(import.meta.env.VITE_SPONSORS_URL),
};

export function sitePath(path = ""): string {
	return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
