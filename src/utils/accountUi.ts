import { safeHttpUrl } from "../config/account";
import type { Profile, ProfileInput } from "../types/account";

export function routeFor(pathname: string, base = import.meta.env.BASE_URL) {
	const root = base.replace(/\/+$/, "");
	if (pathname === root || pathname === `${root}/`) return "home";
	if (pathname === `${root}/auth/login` || pathname === `${root}/auth/login/`) return "login";
	if (pathname === `${root}/account` || pathname === `${root}/account/`) return "account";
	return "not-found";
}

export function readLoginQuery(search: string) {
	const params = new URLSearchParams(search);
	const id = params.get("requestId");
	const invalidRequest = id !== null && (!id.trim() || id.length > 512 ||
		[...id].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127));
	return {
		requestId: invalidRequest ? null : id,
		invalidRequest,
		authResult: params.get("authResult"),
	};
}

export function validateProfileInput(input: ProfileInput): string | null {
	if (!input.name.trim()) return "Enter a profile name.";
	if (input.mods.some(mod => !mod.name.trim() || !mod.version.trim() ||
		!safeHttpUrl(mod.sourceUrl)?.startsWith("https://") || !/^[a-fA-F0-9]{64}$/.test(mod.sha256))) {
		return "Each mod requires a name, version, HTTPS source URL, and 64-character SHA-256 checksum. These are metadata, not proof of scanning.";
	}
	return null;
}

export function copyProfileInput(profile: Profile): ProfileInput {
	return {
		name: `${profile.name} (personal copy)`,
		description: profile.description,
		mods: profile.mods.map(mod => ({ ...mod })),
	};
}
