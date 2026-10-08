export type User = {
	id: string;
	username: string;
	avatarUrl: string;
	roles: string[];
};

export type ProfileMod = {
	name: string;
	version: string;
	sourceUrl: string;
	sha256: string;
};

export type Profile = {
	id: string;
	name: string;
	description: string;
	visibility: "private" | "public";
	owner: User;
	mods: ProfileMod[];
	sourceProfileId: string | null;
	updatedAt: string;
};

export type ProfileInput = Pick<Profile, "name" | "description" | "mods">;
