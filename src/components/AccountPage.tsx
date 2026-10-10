import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { sitePath } from "../config/account";
import { useSession } from "../hooks/useSession";
import { accountApi, errorMessage } from "../services/accountApi";
import type { Profile, ProfileInput, ProfileMod } from "../types/account";
import { AccountShell, Identity, TerminalMessage } from "./AccountShell";
import { copyProfileInput, validateProfileInput } from "../utils/accountUi";
import { CapsuleSubmissions } from "./CapsuleSubmissions";

const emptyInput = (): ProfileInput => ({ name: "", description: "", mods: [] });
const emptyMod = (): ProfileMod => ({ name: "", version: "", sourceUrl: "", sha256: "" });

function useProfiles(mine: boolean, enabled: boolean, q: string, revision: number, ownerId?: string) {
	const key = JSON.stringify([mine, enabled, q, revision, ownerId]);
	const [result, setResult] = useState<{ key: string; profiles: Profile[] | null; error: string }>({ key: "", profiles: null, error: "" });
	useEffect(() => {
		let active = true;
		if (enabled) {
			accountApi.profiles(mine, q).then(result => {
				if (active) setResult({ key, profiles: result, error: "" });
			}).catch(error => {
				if (active) setResult({ key, profiles: null, error: errorMessage(error) });
			});
		}
		return () => { active = false; };
	}, [mine, enabled, q, key]);
	return result.key === key ? result : { profiles: null, error: "" };
}

export function AccountPage() {
	const { user, setUser, loading, error: sessionError, retry } = useSession();
	const [revision, setRevision] = useState(0);
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const personal = useProfiles(true, !!user && !loading && !sessionError, "", revision, user?.id);
	const community = useProfiles(false, true, query, revision);
	const [input, setInput] = useState<ProfileInput>(emptyInput);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	async function act(operation: () => Promise<unknown>, success: string, reset = false) {
		if (busy) return;
		setBusy(true);
		setError("");
		setMessage("");
		try {
			await operation();
			setMessage(success);
			setRevision(value => value + 1);
			if (reset) {
				setInput(emptyInput());
				setEditingId(null);
				setDeleteId(null);
			}
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			setBusy(false);
		}
	}

	function save(event: FormEvent) {
		event.preventDefault();
		const invalid = validateProfileInput(input);
		if (invalid) { setError(invalid); return; }
		const payload = { ...input, name: input.name.trim(), mods: input.mods.map(mod => ({
			...mod, name: mod.name.trim(), version: mod.version.trim(),
			sourceUrl: mod.sourceUrl.trim(), sha256: mod.sha256.toLowerCase(),
		})) };
		void act(() => editingId ? accountApi.update(editingId, payload) : accountApi.create(payload),
			"Personal profile saved. Saving does not publish or submit it.", true);
	}

	function edit(profile: Profile) {
		setEditingId(profile.id);
		setInput({ name: profile.name, description: profile.description, mods: profile.mods.map(mod => ({ ...mod })) });
		setError("");
	}

	function changeMod(index: number, field: keyof ProfileMod, value: string) {
		setInput(current => ({ ...current, mods: current.mods.map((mod, position) =>
			position === index ? { ...mod, [field]: value } : mod) }));
	}

	return <AccountShell title="Account & personal mod profiles">
		{loading && <TerminalMessage>Checking your secure website session…</TerminalMessage>}
		{sessionError && <><TerminalMessage error>{sessionError}</TerminalMessage><button disabled={loading || busy} onClick={retry}>Retry session check</button></>}
		{!loading && !sessionError && !user && <p><a href={sitePath("auth/login")}>Sign in with GitHub</a> to create and manage personal profiles.</p>}
		{user && !loading && !sessionError && <>
			<Identity user={user} />
			<p>Roles supplied by backend: {user.roles.length ? user.roles.join(", ") : "none"}. Roles cannot be assigned here.</p>
			<button disabled={busy} onClick={() => void act(async () => {
				await accountApi.logout();
				setUser(null);
				setInput(emptyInput());
				setEditingId(null);
				setDeleteId(null);
			}, "Website session signed out.")}>Sign out of website</button>
		</>}
		{busy && <TerminalMessage>Sending request to mission control…</TerminalMessage>}
		{error && <TerminalMessage error>{error}</TerminalMessage>}
		{message && <TerminalMessage>{message}</TerminalMessage>}
		{user && !loading && !sessionError && <CapsuleSubmissions key={user.id} ownerId={user.id} onSessionExpired={retry} />}
		{user && !loading && !sessionError && <section aria-labelledby="personal-heading">
			<h2 id="personal-heading">Your personal profiles</h2>
			<p>New profiles and public copies are private. Submission is a separate action; backend validation alone determines whether a profile can be published.</p>
			{personal.error ? <><TerminalMessage error>{personal.error}</TerminalMessage><button disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry profiles</button></> :
				personal.profiles === null ? <TerminalMessage>Loading personal profiles…</TerminalMessage> :
					personal.profiles.length === 0 ? <p>No personal profiles yet.</p> :
						<ul className="profile-list">{personal.profiles.map(profile => <li key={profile.id}>
							<h3>{profile.name}</h3><p>{profile.description}</p>
							<p>{profile.visibility} // {profile.mods.length} mods // Updated: {profile.updatedAt}</p>
							<button disabled={busy} onClick={() => edit(profile)}>Edit {profile.name}</button>
							<button disabled={busy} onClick={() => setDeleteId(profile.id)}>Delete {profile.name}</button>
							<button disabled={busy || profile.visibility !== "private"}
								onClick={() => void act(() => accountApi.submit(profile.id), "Backend accepted the submission. See the refreshed profile for its visibility.")}>
								Submit {profile.name} for publication
							</button>
							{deleteId === profile.id && <div className="delete-confirmation">
								<p>Delete “{profile.name}”? This cannot be undone.</p>
								<button disabled={busy} onClick={() => void act(() => accountApi.remove(profile.id), "Profile deleted.", true)}>Confirm deletion</button>
								<button disabled={busy} onClick={() => setDeleteId(null)}>Cancel deletion</button>
							</div>}
						</li>)}</ul>}
			<form onSubmit={save} aria-label={editingId ? "Edit personal profile" : "Create personal profile"} aria-busy={busy}>
				<h2>{editingId ? "Edit personal profile" : "Create personal profile"}</h2>
				<fieldset disabled={busy}>
					<legend>Profile metadata</legend>
					<label>Name<input required value={input.name} onChange={event => setInput({ ...input, name: event.target.value })} /></label>
					<label>Description<textarea value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} /></label>
					<p>Metadata only: no file uploads, downloads, installation, or client-side scanning.</p>
					{input.mods.map((mod, index) => <fieldset key={index}>
						<legend>Mod {index + 1}</legend>
						{(["name", "version", "sourceUrl", "sha256"] as const).map(field => <label key={field}>
							{({ name: "Mod name", version: "Version", sourceUrl: "Source URL (HTTPS only)", sha256: "SHA-256" })[field]}
							<input required type={field === "sourceUrl" ? "url" : "text"} value={mod[field]}
								onChange={event => changeMod(index, field, event.target.value)} />
						</label>)}
						<button type="button" onClick={() => setInput({ ...input, mods: input.mods.filter((_, position) => position !== index) })}>Remove mod {index + 1}</button>
					</fieldset>)}
					<button type="button" onClick={() => setInput({ ...input, mods: [...input.mods, emptyMod()] })}>Add mod metadata</button>
					<button type="submit">{editingId ? "Save changes" : "Create private profile"}</button>
					{editingId && <button type="button" onClick={() => { setEditingId(null); setInput(emptyInput()); }}>Cancel edit</button>}
				</fieldset>
			</form>
		</section>}
		<section aria-labelledby="community-heading">
			<h2 id="community-heading">Public community profiles</h2>
			<form onSubmit={event => { event.preventDefault(); setQuery(search); setRevision(value => value + 1); }} role="search">
				<label>Search names and descriptions<input value={search} onChange={event => setSearch(event.target.value)} /></label>
				<button type="submit" disabled={busy}>Search public profiles</button>
			</form>
			{community.error ? <><TerminalMessage error>{community.error}</TerminalMessage><button disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry public profiles</button></> :
				community.profiles === null ? <TerminalMessage>Loading public profiles…</TerminalMessage> :
					community.profiles.length === 0 ? <p>No public profiles matched this search.</p> :
						<ul className="profile-list">{community.profiles.map(profile => <li key={profile.id}>
							<h3>{profile.name}</h3><p>{profile.description}</p>
							<p>Owner: {profile.owner.username} // {profile.mods.length} mods</p>
							<details><summary>View mod metadata</summary><ul>{profile.mods.map((mod, index) =>
								<li key={index}>{mod.name} // {mod.version}<p>Source: <code>{mod.sourceUrl}</code></p><p>SHA-256: <code>{mod.sha256}</code></p></li>)}</ul></details>
							<button disabled={!user || loading || !!sessionError || busy} onClick={() => void act(
								() => accountApi.create(copyProfileInput(profile), profile.id),
								"Independent personal copy created. The original public profile is unchanged.")}>Copy {profile.name} to personal profiles</button>
							{!user && <p>Sign in to copy public metadata into an independent private profile.</p>}
						</li>)}</ul>}
		</section>
	</AccountShell>;
}
