import { readFile } from "node:fs/promises";

const targetVersion = "0.1.0";
const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const failures = [];

if (manifest.version !== targetVersion) failures.push(`package.json version must be ${targetVersion}`);
if (lock.version !== targetVersion) failures.push(`package-lock.json version must be ${targetVersion}`);
if (lock.packages?.[""]?.version !== targetVersion) failures.push(`package-lock.json root package version must be ${targetVersion}`);

function validApiBase(value) {
	try {
		const url = new URL(value);
		const localHttp = url.protocol === "http:" &&
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
		return (url.protocol === "https:" || localHttp) && !url.username && !url.password &&
			!url.search && !url.hash && !/\/api\/?$/.test(url.pathname);
	} catch {
		return false;
	}
}

function validSponsorsUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "github.com" && !url.port &&
			/^\/sponsors\/[A-Za-z0-9-]+\/?$/.test(url.pathname) && !url.search && !url.hash;
	} catch {
		return false;
	}
}

const apiBase = process.env.VITE_API_BASE_URL?.trim();
const sponsorsUrl = process.env.VITE_SPONSORS_URL?.trim();
if (process.env.REQUIRE_DEPLOY_CONFIG === "true" && !apiBase) {
	failures.push("VITE_API_BASE_URL must be configured for deployment");
} else if (apiBase && !validApiBase(apiBase)) {
	failures.push("VITE_API_BASE_URL must be HTTPS (or loopback HTTP), omit credentials/query/fragment, and not end in /api");
}
if (sponsorsUrl && !validSponsorsUrl(sponsorsUrl)) {
	failures.push("VITE_SPONSORS_URL must be an HTTPS github.com/sponsors/<recipient> URL");
}

if (failures.length) {
	for (const failure of failures) console.error(`Release check failed: ${failure}`);
	process.exit(1);
}
console.log(`Release check passed for website ${targetVersion}.`);
