import { ArrowUpRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { sitePath } from "../config/account";
import { accountViews } from "../data/accountViews";
import type { AccountView } from "../data/accountViews";
import { useSession } from "../hooks/useSession";
import { useTerminalNavigation } from "../hooks/useTerminalNavigation";
import { useProcessSound } from "../hooks/useProcessSound";
import { accountApi, errorMessage } from "../services/accountApi";
import { siteAudio } from "../services/siteAudio";
import type { OneShotCue } from "../services/siteAudio";
import type { Profile, ProfileInput, ProfileMod, User } from "../types/account";
import { copyProfileInput, validateProfileInput } from "../utils/accountUi";
import { Identity, TerminalMessage } from "./AccountShell";
import { CapsuleSubmissions } from "./CapsuleSubmissions";
import { TerminalNavigation } from "./MissionNavigation";
import { SiteHeader } from "./SiteHeader";
import { PageExperience, TerminalBox, TerminalFade, TerminalSequence, TerminalText } from "./TerminalExperience";

const emptyInput = (): ProfileInput => ({ name: "", description: "", mods: [] });
const emptyMod = (): ProfileMod => ({ name: "", version: "", sourceUrl: "", sha256: "" });

function useProfiles(mine: boolean, enabled: boolean, q: string, revision: number, ownerId?: string) {
	const key = JSON.stringify([mine, enabled, q, revision, ownerId]);
	const [result, setResult] = useState<{ key: string; profiles: Profile[] | null; error: string }>({ key: "", profiles: null, error: "" });
	useEffect(() => {
		let active = true;
		if (enabled) {
			accountApi.profiles(mine, q).then(profiles => {
				if (active) setResult({ key, profiles, error: "" });
			}).catch(error => {
				if (active) setResult({ key, profiles: null, error: errorMessage(error) });
			});
		}
		return () => { active = false; };
	}, [mine, enabled, q, key]);
	return result.key === key ? result : { profiles: null, error: "" };
}

function AccountHeading({ view }: { view: AccountView }) {
	const item = accountViews.find(item => item.id === view)!;
	return <header className="view-heading account-view-heading">
		<p className="eyebrow"><TerminalText>MARS COMMAND / IDENTITY WORKSPACE</TerminalText></p>
		<h1><TerminalText>{item.label}</TerminalText></h1>
		<p><TerminalText>{item.description}</TerminalText></p>
	</header>;
}

type WorkspaceProps = {
	user: User | null;
	loading: boolean;
	sessionError: string;
	retry: () => void;
	onSignedOut: () => void;
	signedOut: boolean;
};

function AccountWorkspace({ user, loading, sessionError, retry, onSignedOut, signedOut }: WorkspaceProps) {
	const main = useRef<HTMLElement>(null);
	const prompt = useRef<HTMLDivElement>(null);
	const navigation = useTerminalNavigation<AccountView>("dashboard", main, prompt);
	const activeView = navigation.transitioning ? navigation.target : navigation.view;
	const target = accountViews.find(item => item.id === navigation.target)!;
	const authorized = !!user && !loading && !sessionError;
	const processSound = useProcessSound(authorized && !navigation.transitioning);
	const [visited, setVisited] = useState({ personal: false, community: false, submissions: false });
	const [revision, setRevision] = useState(0);
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const personal = useProfiles(true, authorized && visited.personal, "", revision, user?.id);
	const community = useProfiles(false, visited.community, query, revision);
	const [input, setInput] = useState<ProfileInput>(emptyInput);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const profileName = useRef<HTMLInputElement>(null);
	const hasDraft = !!editingId || !!input.name || !!input.description || input.mods.length > 0;

	function navigate(view: AccountView) {
		if (view !== "dashboard") setVisited(previous => ({ ...previous, [view]: true }));
		navigation.navigate(view);
	}

	useLayoutEffect(() => {
		if (editorOpen && navigation.view === "personal" && authorized) {
			const frame = requestAnimationFrame(() => {
				if (!profileName.current?.closest(".is-drawn")) return;
				profileName.current.closest("form")?.scrollIntoView({ behavior: "instant", block: "start" });
				profileName.current.focus({ preventScroll: true });
			});
			return () => cancelAnimationFrame(frame);
		}
	}, [editorOpen, editingId, navigation.view, navigation.output, authorized]);

	async function act(operation: () => Promise<unknown>, success: string, reset = false, cue: OneShotCue = "success") {
		if (busy) return;
		const process = processSound.start();
		let outcome: OneShotCue = "error";
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
				setEditorOpen(false);
			}
			outcome = cue;
		} catch (error) {
			setError(errorMessage(error));
		} finally {
			process?.finish(outcome);
			setBusy(false);
		}
	}

	function save(event: FormEvent) {
		event.preventDefault();
		const invalid = validateProfileInput(input);
		if (invalid) { setError(invalid); siteAudio.playFromGesture("error"); return; }
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
		setEditorOpen(true);
		setError("");
		siteAudio.playFromGesture("open");
	}

	function changeMod(index: number, field: keyof ProfileMod, value: string) {
		setInput(current => ({ ...current, mods: current.mods.map((mod, position) =>
			position === index ? { ...mod, [field]: value } : mod) }));
	}

	function accessPanel() {
		return <TerminalBox className="panel account-card" aria-labelledby="account-access-heading">
			<h2 id="account-access-heading"><TerminalText>{loading || sessionError ? "Verify your session" : "Sign in required"}</TerminalText></h2>
			<p>{loading || sessionError ? "Your identity is not verified. Wait for the session check or retry it above before using private workflows." :
				"Use GitHub to create personal profiles and manage private submissions. Community profiles are available without signing in."}</p>
			<a className="account-button" href={sitePath("auth/login")}>Sign in with GitHub <ArrowUpRight size={13} aria-hidden="true" /></a>
		</TerminalBox>;
	}

	const feedback = <>
		{loading && <TerminalMessage>Checking your secure website session...</TerminalMessage>}
		{sessionError && <><TerminalMessage error>{sessionError}</TerminalMessage><button disabled={loading || busy} onClick={() => {
			retry(); siteAudio.playFromGesture("retry");
		}}>Retry session check</button></>}
		{!user && signedOut && <TerminalMessage>Website session signed out. Local drafts and upload context have been cleared.</TerminalMessage>}
		{authorized && busy && <TerminalMessage>Sending request to mission control...</TerminalMessage>}
		{authorized && error && <TerminalMessage error>{error}</TerminalMessage>}
		{authorized && message && <TerminalMessage>{message}</TerminalMessage>}
	</>;

	return <div className="site-shell account-workspace">
		<SiteHeader online={null} checking={false} homeHref={sitePath()} menuLabel="account"
			state={<span className={`header-session${authorized ? " is-authenticated" : ""}`}><i />
				{loading ? "CHECKING SESSION" : sessionError ? "SESSION UNVERIFIED" : user ? user.username : "PUBLIC ACCESS"}</span>}
			mobileNavigation={<>
				<TerminalNavigation items={accountViews} mobile label="Account directory" activeView={activeView}
					onNavigate={navigate} />
				<div className="mobile-account-links">
					<a href={sitePath()}>Mission control <ArrowUpRight size={13} aria-hidden="true" /></a>
					<a href={sitePath("auth/login")}>Sign in <ArrowUpRight size={13} aria-hidden="true" /></a>
				</div>
			</>} />
		<div className="terminal-workspace">
			<aside className="terminal-sidebar account-sidebar" aria-label="Account workspace directory">
				<TerminalFade className="sidebar-directory">
					<p className="sidebar-label">ACCOUNT DIRECTORY</p>
					<TerminalNavigation items={accountViews} label="Account directory" activeView={activeView} onNavigate={navigate} />
				</TerminalFade>
				<TerminalFade order={6} className="account-sidebar-note">
					<p className="eyebrow">SESSION WORKSPACE</p>
					<p>Profile drafts and selected JARs stay in this session when you switch files.</p>
					<p>Reloading, signing out, or changing identity clears local private context.</p>
					<a href={sitePath()}>Return to mission control <ArrowUpRight size={12} aria-hidden="true" /></a>
				</TerminalFade>
			</aside>
			<main ref={main} className="terminal-main account-panel account-workspace-main" id="main-content" tabIndex={-1}
				data-account-view={navigation.view ?? "empty"} data-navigation-phase={navigation.phase} aria-busy={navigation.phase !== "idle"}>
				<div className="terminal-output" inert={navigation.transitioning}>
					{navigation.view && navigation.view !== "submissions" && <TerminalSequence key={navigation.output} onComplete={() => navigation.completeOutput(navigation.output)}>
						<AccountHeading view={navigation.view} />
						{feedback}
						{navigation.view === "dashboard" && <>
							{authorized && user ? <TerminalBox className="panel account-card" aria-labelledby="account-identity-heading">
								<div className="account-card-heading"><h2 id="account-identity-heading"><TerminalText>Your GitHub identity</TerminalText></h2><span className="account-tag">VERIFIED SESSION</span></div>
								<Identity user={user} />
								<dl className="account-facts"><div><dt>Backend roles</dt><dd>{user.roles.length ? user.roles.join(", ") : "none"}</dd></div></dl>
								<div className="account-card-actions">
									<button disabled={busy} onClick={() => void act(async () => { await accountApi.logout(); onSignedOut(); }, "Website session signed out.")}>Sign out of website</button>
									<details><summary>Session safety</summary><p>Roles are supplied by the backend and cannot be assigned here. Signing out clears local drafts and cancels local uploads; the backend may already have received bytes. Refresh a submission after signing in again.</p></details>
								</div>
							</TerminalBox> : accessPanel()}
							<div className="account-card-grid">
								{accountViews.filter(item => item.id !== "dashboard").map(item =>
									<TerminalBox key={item.id} as="article" className="panel account-launch-card">
										<p className="eyebrow"><TerminalText>{item.file}</TerminalText></p>
										<h2><TerminalText>{item.label}</TerminalText></h2>
										<p><TerminalText>{item.description}</TerminalText></p>
										<button onClick={() => navigate(item.id)}><TerminalText>{`Open ${item.label.toLowerCase()}`}</TerminalText><ArrowUpRight size={14} aria-hidden="true" /></button>
									</TerminalBox>)}
							</div>
						</>}
						{navigation.view === "personal" && (authorized ? <>
							{editorOpen ? <TerminalBox key="editor" className="panel account-card profile-editor" aria-labelledby="profile-editor-heading">
								<div className="account-card-heading"><h2 id="profile-editor-heading">{editingId ? "Edit personal profile" : "Create personal profile"}</h2>
									<button disabled={busy} onClick={() => { setEditorOpen(false); siteAudio.playFromGesture("close"); }}>Back to profiles</button></div>
								<form onSubmit={save} aria-label={editingId ? "Edit personal profile" : "Create personal profile"} aria-busy={busy}>
									<fieldset disabled={busy}>
										<legend>Profile metadata</legend>
										<label>Name<input ref={profileName} required value={input.name} onChange={event => setInput({ ...input, name: event.target.value })} /></label>
										<label>Description<textarea value={input.description} onChange={event => setInput({ ...input, description: event.target.value })} /></label>
										<p className="account-help">Metadata only: no file uploads, downloads, installation, or client-side scanning.</p>
										{input.mods.map((mod, index) => <fieldset key={index}>
											<legend>Mod {index + 1}</legend>
											{(["name", "version", "sourceUrl", "sha256"] as const).map(field => <label key={field}>
												{({ name: "Mod name", version: "Version", sourceUrl: "Source URL (HTTPS only)", sha256: "SHA-256" })[field]}
												<input required type={field === "sourceUrl" ? "url" : "text"} value={mod[field]} onChange={event => changeMod(index, field, event.target.value)} />
											</label>)}
											<button type="button" onClick={() => setInput({ ...input, mods: input.mods.filter((_, position) => position !== index) })}>Remove mod {index + 1}</button>
										</fieldset>)}
										<div className="account-card-actions">
											<button type="button" onClick={() => setInput({ ...input, mods: [...input.mods, emptyMod()] })}>Add mod metadata</button>
											<button type="submit">{editingId ? "Save changes" : "Create private profile"}</button>
											<button type="button" onClick={() => {
												setEditingId(null); setInput(emptyInput()); setEditorOpen(false); siteAudio.playFromGesture("cancel");
											}}>{editingId ? "Cancel edit" : "Discard draft"}</button>
										</div>
									</fieldset>
								</form>
							</TerminalBox> : <TerminalBox key="list" className="panel account-card" aria-labelledby="personal-heading">
								<div className="account-card-heading"><h2 id="personal-heading">Your personal profiles</h2>
									<button disabled={busy} onClick={() => { setEditorOpen(true); siteAudio.playFromGesture("open"); }}>{hasDraft ? editingId ? "Resume edit" : "Resume draft" : "Create profile"}</button></div>
								<p className="account-help">New profiles and public copies are private. Publication requires a separate submission accepted by the backend.</p>
								{personal.error ? <><TerminalMessage error>{personal.error}</TerminalMessage><button disabled={busy} onClick={() => {
									setRevision(value => value + 1); siteAudio.playFromGesture("retry");
								}}>Retry profiles</button></> :
									personal.profiles === null ? <TerminalMessage>Loading personal profiles...</TerminalMessage> :
										personal.profiles.length === 0 ? <p>No personal profiles yet.</p> :
											<ul className="profile-list">{personal.profiles.map(profile => <li key={profile.id}>
												<div className="profile-entry-heading"><h3>{profile.name}</h3><span className="account-tag">{profile.visibility}</span></div>
												<p>{profile.description}</p>
												<p className="profile-meta">{profile.mods.length} mods / Updated: {profile.updatedAt}</p>
												<div className="account-card-actions">
													<button disabled={busy} aria-label={`Edit ${profile.name}`} onClick={() => edit(profile)}>Edit</button>
													<button disabled={busy} aria-label={`Delete ${profile.name}`} onClick={() => {
														setDeleteId(profile.id); siteAudio.playFromGesture("warning");
													}}>Delete</button>
													<button disabled={busy || profile.visibility !== "private"} aria-label={`Submit ${profile.name} for publication`}
														onClick={() => void act(() => accountApi.submit(profile.id), "Backend accepted the submission. See the refreshed profile for its visibility.", false, "queued")}>Submit for publication</button>
												</div>
												{deleteId === profile.id && <div className="delete-confirmation">
													<p>Delete "{profile.name}"? This cannot be undone.</p>
													<button disabled={busy} onClick={() => void act(() => accountApi.remove(profile.id), "Profile deleted.", true, "delete")}>Confirm deletion</button>
													<button disabled={busy} onClick={() => { setDeleteId(null); siteAudio.playFromGesture("cancel"); }}>Cancel deletion</button>
												</div>}
											</li>)}</ul>}
							</TerminalBox>}
						</> : accessPanel())}
						{navigation.view === "community" && <TerminalBox className="panel account-card" aria-labelledby="community-heading">
							<h2 id="community-heading">Public community profiles</h2>
							<form className="profile-search" onSubmit={event => { event.preventDefault(); setQuery(search); setRevision(value => value + 1); }} role="search">
								<label>Search names and descriptions<input value={search} onChange={event => setSearch(event.target.value)} /></label>
								<button type="submit" disabled={busy}>Search public profiles</button>
							</form>
							{!authorized && <p className="account-help"><a href={sitePath("auth/login")}>Sign in</a> to copy public metadata into an independent private profile.</p>}
							{community.error ? <><TerminalMessage error>{community.error}</TerminalMessage><button disabled={busy} onClick={() => {
								setRevision(value => value + 1); siteAudio.playFromGesture("retry");
							}}>Retry public profiles</button></> :
								community.profiles === null ? <TerminalMessage>Loading public profiles...</TerminalMessage> :
									community.profiles.length === 0 ? <p>No public profiles matched this search.</p> :
										<ul className="profile-list">{community.profiles.map(profile => <li key={profile.id}>
											<div className="profile-entry-heading"><h3>{profile.name}</h3><span className="account-tag">PUBLIC</span></div><p>{profile.description}</p>
											<p className="profile-meta">Owner: {profile.owner.username} / {profile.mods.length} mods</p>
											<details><summary>View mod metadata</summary><ul>{profile.mods.map((mod, index) =>
												<li key={index}>{mod.name} / {mod.version}<p>Source: <code>{mod.sourceUrl}</code></p><p>SHA-256: <code>{mod.sha256}</code></p></li>)}</ul></details>
											<button disabled={!authorized || busy} aria-label={`Copy ${profile.name} to personal profiles`} onClick={() => void act(
												() => accountApi.create(copyProfileInput(profile), profile.id), "Independent personal copy created. The original public profile is unchanged.")}>Copy to personal profiles</button>
										</li>)}</ul>}
						</TerminalBox>}
					</TerminalSequence>}
					<section className="account-persistent-pane" hidden={navigation.view !== "submissions"} inert={navigation.view !== "submissions"} aria-hidden={navigation.view !== "submissions"}>
						{authorized && user && visited.submissions ? <TerminalSequence active={navigation.view === "submissions"} replayKey={navigation.output} onComplete={() => navigation.completeOutput(navigation.output)}>
							<AccountHeading view="submissions" />{feedback}
							<TerminalBox className="panel account-card"><CapsuleSubmissions ownerId={user.id} onSessionExpired={retry}
								active={navigation.view === "submissions" && !navigation.transitioning} /></TerminalBox>
						</TerminalSequence> : navigation.view === "submissions" && <TerminalSequence key={navigation.output} onComplete={() => navigation.completeOutput(navigation.output)}>
							<AccountHeading view="submissions" />{feedback}{accessPanel()}
						</TerminalSequence>}
					</section>
				</div>
				<div ref={prompt} className="terminal-prompt terminal-command-line" aria-live="polite" aria-atomic="true">
					<span>visitor@mars</span>:<b>~</b>${" "}
					{navigation.transitioning ? <TerminalSequence key={`${navigation.request}-${navigation.phase}`}
						onComplete={() => navigation.completeCommand(navigation.phase === "clear" ? "clear" : "cat", navigation.request)}>
						<TerminalText>{navigation.phase === "clear" ? "clear" : `cat ${target.file}`}</TerminalText>
					</TerminalSequence> : <span className="idle-cursor" aria-hidden="true" />}
				</div>
			</main>
		</div>
		<div className="terminal-statusbar"><span><i /> IDENTITY WORKSPACE</span><span>PRIVATE BY DEFAULT <b>/</b> UTF-8</span></div>
	</div>;
}

export function AccountPage() {
	const { user, setUser, loading, error: sessionError, retry } = useSession();
	const [notice, setNotice] = useState({ ownerId: user?.id ?? null, signedOut: false });
	if (user && notice.ownerId !== user.id) setNotice({ ownerId: user.id, signedOut: false });
	return <PageExperience ready={!loading}>
		<AccountWorkspace key={user?.id ?? "anonymous"} user={user} loading={loading} sessionError={sessionError} retry={retry}
			signedOut={notice.signedOut} onSignedOut={() => {
				siteAudio.stopAll();
				setNotice(current => current.ownerId === user?.id ? { ...current, signedOut: true } : current);
				setUser(current => current?.id === user?.id ? null : current);
				siteAudio.playOutcome("disconnect");
			}} />
	</PageExperience>;
}
