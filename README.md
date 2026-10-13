# Mars Command Web

A responsive Mars Command colony status site built with React, TypeScript, Vite, and Tailwind CSS v4. The desktop Tauri launcher is maintained separately in `mars-command-client`.

## Run locally

The loading screen and browser icon share **Petrora Rubra, the Crowned** with the
desktop client. `public/planet.png` is the 1024x1024 transparent source;
`public/apple-touch-icon.png` is its 180x180 derivative. The generator command
and native icon regeneration instructions are in the sibling client's README.
Both HTML icon links and the loading-screen image respect the configured `BASE_PATH`.

## Terminal interface

The site uses a full-page, monochrome Bash-inspired workspace with a Mars-red
accent: no simulated desktop window, title bar, or traffic-light controls.
The planet is visible in the initial HTML, before the JavaScript bundle loads.
On startup, the screen waits for the document, fonts, planet image, and initial
telemetry (or account data) to settle. The normal intro lasts approximately
**four seconds**, including its **1.5-second** fade to opacity zero. Slow
readiness checks can extend that duration; skip and reduced-motion behavior
remain immediate once data and assets are ready.
Only after that fade does the main terminal type its text in document order,
while the sidebar fades in from top to bottom. Text reserves its final dimensions
to prevent layout jumps; screen readers receive complete text, not character-by-character
announcements. Periodic telemetry and newly returned account data update without
replaying the intro.

Main-content boxes reserve their layout space but stay hidden and inert until
the typing sequence reaches them. Their SVG border draws over 220 ms before
their text starts; later panels and action controls no longer appear as empty
frames on startup.

Each directory item opens a detailed mission file. The bottom prompt types
`clear`, removes the old output, types `cat <mission-file>`, then types the selected
view from top to bottom. The sidebar and its live telemetry stay mounted. A new
click supersedes an unfinished command rather than queuing stale views. Reduced
motion removes animated command delays. “Skip typing” finishes the current
transition immediately; selecting another file re-enables animation unless
reduced motion is requested.
Server uplink includes live telemetry and the reported server build alongside
explicitly labelled configured client targets; a running mod inventory and internal
server metrics are not available from the public feed and are not invented.
Deployment includes client setup and verification guidance; transmissions explain
the curated log; the account file describes identity, profile and private-upload
workflows with links to the existing account/sign-in pages.

The `/account` area has its own terminal directory and mobile menu: account
dashboard, personal profiles, community profiles, and private submissions.
Profile lists load when their file is first opened. Creating/editing a profile
uses a focused editor instead of displaying a form alongside every list.
Profile drafts, search state, and selected JAR/reservation state survive switching
files. The submission component stays mounted but hidden/inert outside its view,
so navigation does not cancel an upload. Its heading/panel can replay the terminal
reveal without remounting the file input or upload controller.

Private workspace state is keyed to the verified user identity. Signing out,
reloading, or replacing the identity discards local drafts; session revalidation
temporarily removes private submission controls and cancels local upload work.
An interrupted upload may already have reached the backend; refresh after signing
in before retrying. Public browsing remains available without sign-in, while
profile copying, editing, submission and desktop approval retain their existing
backend and explicit-consent requirements.

Transmission entries are curated change notes in
[src/data/transmissions.ts](src/data/transmissions.ts), shared by the overview and
the detailed transmissions file. Update this list when features or workflows
change; it is not an automated deployment feed, server event stream, or health check.

“Skip intro” / “Skip typing” bypass animation, and `prefers-reduced-motion: reduce`
shows ready content immediately without the fade or typing. Status/network failures
still use the existing explicit error states; a missing planet image reports its
failure instead of keeping the loader stuck. Internal account/home navigation
uses browser history without a document reload; OAuth, downloads, modified clicks,
and external links retain their native behavior. On mobile, a sticky header
menu exposes all five mission files plus direct account/sign-in links. Selecting
a file closes the menu and runs the same terminal transition as desktop navigation.
Escape, outside interaction, and resizing to desktop dismiss the menu. The main
terminal appears first; telemetry and the installation guide stack beneath it.

## Interface sounds

The shared client-only player uses [`uisfx`](https://www.npmjs.com/package/uisfx)
with the **`scifi`** pack and a default volume of **70%**. All 12
[catalog packs](https://uisfx.com/uisfx-catalog.json) were reviewed, with browser
previews of `scifi`, `mechanical`, and `arcade`. The restrained digital pings suit
the colony-uplink theme, Minecraft community audience, red monochrome terminal,
and deliberate file transitions better than arcade's brighter, denser texture
or mechanical's industrial detents. Runtime cues are synthesized locally;
no external audio service or per-click network request is used.

Use **Enable sound** in the bottom-left corner. Sound is off by default and
never autoplays, even when an enabled preference is restored after reloading.
The first genuine activation resumes the retained Web Audio context. Until
then, asynchronous feedback is discarded rather than queued. **Mute sound**
stops all active audio immediately. **Sound settings** persists enabled state,
volume, and optional typing sounds in `mars-command:sound` local storage.
Storage and playback failures appear as textual status and are logged.
Reduced motion remains a separate preference and does not mute audio.

If sound is enabled during the loading screen, `public/sounds/opening.mp3`
starts from that gesture and continues through the loader's removal to its
natural end (about 5.83 seconds). `public/sounds/new_page.mp3` starts once with
the initial typing reveal, without cutting off the opening track. Enabling
sound after loading does not replay a stale opening or queue a missed typing
cue. Skipping typing or
requesting reduced motion does not manufacture a typing-start cue. Both asset
URLs respect `BASE_PATH`; browsers that block playback retain an Enable sound
fallback.

| Product event | Cue |
| --- | --- |
| Mission/account file or internal route change | `forward`; browser history uses `back` / `forward` |
| Explicit menu or profile editor opening/closing | `open` / `close` |
| Authorization consent checkbox | `check` / `uncheck` |
| Confirmed profile save/copy or authorization | `success`; failures use `error` |
| Destructive confirmation / committed deletion or withdrawal | `warning` / `delete` |
| Accepted publication or scan retry | `queued`; refused work uses `blocked` |
| JAR upload with backend digest confirmation | `complete`, not at 100% bytes sent |
| Explicit cancellation or draft discard | `cancel` |
| Explicit status refresh | `loading`, then `success` / `error` |
| Visible profile or submission request / approval | Quiet `processing` / `connecting`, then its actual outcome |
| Sound or typing preference enabled | `toggle-on`; disabling typing uses `toggle-off` |
| Opt-in local text-entry input | Brief `typing`, once per trusted input event at low volume, without a cooldown |
| Confirmed website logout | Stop all audio, then `disconnect` |

No sounds are added to hover, scrolling, background polling, live telemetry,
automatic session checks, ordinary list repetition, or disabled controls.
Each visible process retains an idempotent loop handle. Success, failure,
timeout, cancellation, navigation, hidden submission views, identity changes,
unmount, hidden browser tabs, mute, zero volume, and every `finally` path stop and clear it.
Hiding a submission still does **not** cancel its upload; it only stops the
now-invisible sound. Logout uses `stopAll()`. Final app teardown awaits
`player.destroy()` before closing the caller-owned `AudioContext`; Strict Mode
trial remounts do not duplicate or dispose the live player.

The [pack-specific integration guide](https://uisfx.com/docs/agent-guide.md?pack=scifi)
documents the underlying cue and lifecycle contract. Sound always reinforces
the existing text, focus, progress, motion, error, and ARIA feedback.

```sh
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, copy the example with `Copy-Item .env.example .env.local`. The example connects to the live MCStatus.io API. To show clearly marked simulated status during development instead, set `VITE_USE_MOCK_STATUS=true` in `.env.local`. The mock defaults to online with zero personnel. Production always uses the API provider.

Useful commands:

- `npm run dev` starts the Vite development server.
- `npm test` runs status parsing, cookie API contract, authentication UI, profile UI, private capsule submission UI, and landing regression tests (mock responses only).
- `npm run lint` runs Oxlint.
- `npm run check:release` verifies the website's `0.2.0` package/lock versions, launcher display `1.4.0` defaults/any supplied override, and any supplied deployment URLs.
- `npm run build` type-checks and produces the production bundle in `dist/`.
- `npm run preview` serves the production bundle locally.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_STATUS_API_URL` | MCStatus.io Java status API base URL, or same-origin proxy prefix | dev: `/api/mcstatus`; production: direct MCStatus.io URL |
| `VITE_LAUNCHER_DOWNLOAD_URL` | Real launcher artifact URL; must be HTTP(S) | unset, download disabled |
| `VITE_CLIENT_VERSION` | Launcher version displayed on the page | `1.4.0` |
| `VITE_SERVER_ADDRESS` | Public Minecraft server host | `play.nexusgit.info` |
| `VITE_VOICE_ADDRESS` | Public voice host | `voice.nexusgit.info` |
| `VITE_USE_MOCK_STATUS` | Development-only mock switch; ignored in production | `false` |
| `VITE_API_BASE_URL` | HTTPS account/backend server origin or base URL **without `/api`**; loopback HTTP is allowed for local development | unset; account operations fail closed |
| `VITE_SPONSORS_URL` | HTTPS `github.com/sponsors/<recipient>` URL | unset; donations explicitly unavailable |
| `BASE_PATH` | Vite deployment path, such as `/mars/` | `/` |
| `MARS_ENV_DIR` | Optional process environment variable selecting a different Vite environment-file directory (use an empty project-local directory to avoid local env files during validation) | project root |

Vite `VITE_*` values are embedded in the public browser bundle. Never put tokens, webhooks, Minecraft credentials, or other secrets in them.

## Status API

The frontend requests the configured API base plus the encoded `VITE_SERVER_ADDRESS` immediately on page load and again every 15 seconds. In development, `/api/mcstatus` is proxied by Vite to `https://api.mcstatus.io/v2/status/java`, avoiding browser cross-origin/network restrictions. Production defaults to MCStatus.io directly unless `VITE_STATUS_API_URL` points at a same-origin proxy. Requests are serialized so slow responses cannot overlap; the refresh control runs the same guarded request. A five-second client timeout applies. Network errors, non-2xx responses, invalid JSON, and invalid required fields become a safe offline result. Optional/missing telemetry is rendered as an em dash and never as `undefined`, `null`, or `NaN`.

MCStatus.io's response is mapped into the site's `ServerStatus` shape. Player counts come from `players.online` and `players.max`; version and MOTD use their `name_clean` and `clean` fields. `retrieved_at` supplies the last-check time. MCStatus.io does not return server ping latency, so latency remains unavailable rather than showing the browser's connection time to the API.

The service currently documents a 60-second response cache and a limit of five requests per second per client IP. The page's 15-second polling therefore may receive cached results between upstream checks. For higher-traffic deployment, route requests through a shared server/edge cache so each visitor does not independently poll the public API. MCStatus.io returns plain text for non-2xx errors; the client reports these as a safe offline status without exposing raw response bodies.

The mapped client-side status type is:

```ts
type ServerStatus = {
  online: boolean
  host: string
  port: number
  playersOnline: number | null
  playersMax: number | null
  latencyMs: number | null
  motd: string | null
  versionName: string | null
  checkedAt: string
  error: string | null
}
```

The web project does not speak the Minecraft protocol from the browser; it consumes MCStatus.io's public read-only HTTP API, which performs the status query. If MCStatus.io is unavailable, or if traffic needs shared caching or rate limiting, replace `VITE_STATUS_API_URL` with a compatible server-side proxy and keep any upstream credentials there.

## Private artifact submissions (Batch 3)

Signed-in users can reserve and upload one JAR from `/account`, separately from personal profile metadata. Project (120 characters), version (80 characters), and HTTPS source URL (2048 characters, no credentials or fragments) are immutable after reservation. The browser checks `.jar`, nonempty bytes, and a **64 MiB / 67,108,864-byte** maximum; only backend archive validation and its observed SHA-256 establish artifact facts. Limits are operator-configurable: the browser advertises the default 64 MiB and 10-active-submission limits, while the backend is authoritative.

Requires the Batch 3 backend `0.3.0` capsule contract at the configured `VITE_API_BASE_URL`, without `/api`:

- `POST /api/community/capsules` with JSON `{project, version, sourceUrl}` and `Idempotency-Key` reserves an owned release; replays return the same release.
- `PUT /api/community/capsules/{releaseId}/artifact` sends the **raw File**, not multipart or base64, with `Content-Type: application/java-archive`. Cookie credentials are included. XHR reports transport progress; 100% means bytes sent, **not** backend acceptance.
- `GET /api/community/capsules/mine` returns `{capsules: [...]}`; `GET /api/community/capsules/{releaseId}` refreshes one owned release.
- `POST /api/community/capsules/{releaseId}/retry` requests eligible blocked scan work; rejected/expired/withdrawn releases are terminal. `POST /api/community/capsules/{releaseId}/withdraw` confirms terminal withdrawal of an unpublished release.

All singular responses are guarded Capsule records: release/owner IDs, immutable metadata and digest (nullable before binding), state, positive revision, timestamps, nullable evidence/queue summaries, and `publicDownloadAvailable: false`. Evidence must bind the exact artifact digest. Unknown states, malformed lists/errors, wrong owners or release IDs, mutated immutable facts, and contradictory revisions fail closed. Older revisions never replace newer status. No storage paths, worker lease IDs, tokens, public artifact downloads, or installation controls are exposed.

Reservation and JAR selection remain in memory only. After interruption or local cancellation, **refresh first**, then retry the same file/reservation when still reserved; the reservation retry reuses its idempotency key. Identical upload replay is safe; a different JAR cannot replace a bound digest. Metadata/file selection stays locked after a reservation attempt so uncertain network results cannot accidentally reuse a key with different facts. “Start a new submission” discards local retry context, not server records; withdraw abandoned reservations explicitly. Reloading clears the selected file/key; use “Choose JAR for …” on an owned reserved release to attach a file without creating another reservation. Owned submissions remain refreshable and withdrawable. Unbound/failed quarantine expiry defaults to seven days on the backend.

`scan_blocked` explicitly means a trusted scanner is unavailable/unconfigured; the JAR stays **private and unpublished**. `publishable` means workflow eligibility for a future atomic publication step, not a public artifact. There is no production clean fallback and no client-side security scanner.

The authenticated component is recreated on account/session changes; requests are aborted on teardown and late results/progress ignored. HTTP 401 triggers a fresh session check. JSON requests time out after 10 seconds; uploads after 120 seconds. Backend CORS must allow the website's exact origin, cookie credentials, `GET`/`POST`/`PUT`, `Content-Type` and `Idempotency-Key` headers (including preflight for upload progress). Cookie mutation Origin/CSRF policy remains backend-enforced; the browser never invents bearer credentials or sends a caller-supplied digest.

## Launcher release

Until `VITE_LAUNCHER_DOWNLOAD_URL` contains a real HTTP(S) artifact URL, the download control is disabled and says “LAUNCHER DOWNLOAD COMING SOON.” The page identifies the launcher channel as a preview and does not claim client synchronization is implemented. Configure the artifact URL only when a real release is available; publish `VITE_CLIENT_VERSION` alongside it.

The current five-step install guide is informational. The future Tauri release system can connect by publishing versioned launcher artifacts and a signed manifest, then setting the public download URL/version at deployment. Add authenticated release management and client update verification in the launcher/backend, not in this public site.

## Deployment

GitHub Pages deploys automatically when changes are pushed to `main`, or manually from the Actions tab with **Deploy to GitHub Pages**. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow builds and publishes `dist/` for the custom domain `https://mars.nexusgit.info/`, with `BASE_PATH=/` and the domain CNAME included in the artifact.

Before deployment, configure the repository Actions variable `VITE_API_BASE_URL` with the production HTTPS backend base (without `/api`). The workflow intentionally fails rather than deploy account UI with this required value unset or malformed. Optionally configure `VITE_SPONSORS_URL` with the verified `https://github.com/sponsors/<recipient>` destination; an unset value keeps donations unavailable. Tests, lint, release/version checks, the production dependency audit, and the production build must all pass before the Pages artifact is uploaded.

To build locally for the custom domain in PowerShell, set `$env:BASE_PATH="/"` before running `npm run build`. Configure `VITE_LAUNCHER_DOWNLOAD_URL` and other public `VITE_*` values in the workflow if needed; GitHub Pages cannot provide a server-side proxy, so the status API uses its public MCStatus.io endpoint directly. Never put secrets in `VITE_*` values.

## GitHub identity and desktop approval (batch 1)

The landing page remains at `/`; its header links to `/account`, and `/auth/login` is the GitHub identity terminal. Routes respect `BASE_PATH`. No additional routing framework is required.

Set `VITE_API_BASE_URL` explicitly to the backend's HTTPS origin/base **without** `/api` (loopback HTTP remains available for local development). The website appends the contract's `/api/...` paths, sends `credentials: "include"` on all account API requests, and uses browser navigation (not fetch) for `GET /api/auth/github/start`. There is no default live account backend. Invalid or absent configuration, failed requests, and malformed responses are visible errors, never success-shaped empty results.

Sign-in reads the HttpOnly website session from `GET /api/auth/session`. A signed-in user sees their GitHub avatar, **Continue as** and **Use a different GitHub account**. Desktop links retain `requestId`. The backend callback must navigate to the configured website `/auth/login?requestId=...&authResult=success` or `authResult=error&errorCode=<safe-enumerated-code>`; no provider secrets, raw errors, or tokens belong in that URL. The website intentionally displays generic OAuth failure text rather than arbitrary callback error codes.

For desktop sign-in, **Continue as** is disabled until the user explicitly confirms the shown identity. Only then does the website POST `{requestId}` to `/api/auth/desktop/approve`; it rechecks the session identity before approval and requires reconfirmation after an identity change or refusal. OAuth success alone does not approve a desktop request. Account switching requests `switchAccount=1`, but GitHub may retain its upstream login: the UI explains that users may need to switch/sign out on GitHub and retry. Approval ends with terminal-style success and instructions to return to the launcher. No launcher focus scheme is configured, so none is invented or invoked.

The launcher alone initiates `/api/auth/desktop`, retains `deviceCode`, and polls `/api/auth/desktop/poll`. This website never receives or requests a device code or desktop access token. The website can log out its cookie session with `POST /api/auth/logout`. OAuth credentials, role assignment, authorization, cookie security, expiry, and approval binding remain server responsibilities.

### Minecraft arrival confirmation

Minecraft uses the same `/auth/login?requestId=...` page and GitHub OAuth route.
After login, the page reads the request's **server-derived purpose** from
`GET /api/auth/requests/{requestId}`. It never trusts a query parameter to decide
whether to approve a launcher or Minecraft request, and does not fall back to
desktop approval when metadata is unavailable.

Arrival requests show the player's permanent four-digit callsign and Minecraft
name. The user must explicitly confirm the shown GitHub identity before the
page posts `{requestId}` to `/api/auth/minecraft/approve`. Approval shares only
the account display name and server-approved roles with the Minecraft server;
it does not grant private-profile or file access.

Success instructs the player to return to Minecraft and confirm the displayed
account there. Website approval alone is not final linking. No device code,
server integration key, desktop JWT, or provider token enters this page or its
URL. Expiry, replay protection, callsign allocation, conflicting account links,
and in-game finalization are backend responsibilities.

Deploy the updated backend and website together. Normal launcher authorization
now also checks request-purpose metadata before approving; an older backend
without that endpoint fails closed rather than approving an unknown request.

## Personal/community mod profiles

`/account` exposes backend public search (case-insensitive name/description matching is a backend responsibility), authenticated owner profiles, and metadata-only create/edit/delete operations. New profiles are private; copying a public profile POSTs independent metadata with optional `sourceProfileId`, not a shared mutable object. Editing PATCHes name/description/mods only and never visibility or roles. Deletion requires confirmation. Submission is a separate, explicit action through `/api/community/profiles/{id}/submit`, not part of saving or copying.

Each mod has name, version, HTTPS-only source URL, and SHA-256 metadata. A checksum entered in the browser is **not evidence of scanning**. No file upload, mod download, installation, or simulated scanning is implemented. Batch 1 backend submission is fail-closed: HTTP 409 with `{detail:{code:"scanning_not_configured",message:...}}` produces an explicit refusal; the website does not claim publication. Backend errors accept `{detail:string}` or `{detail:{code,message}}`; raw HTML/invalid JSON is not rendered.

Donation ownership is unresolved. Only a configured valid GitHub Sponsors recipient is linked; otherwise the landing footer explicitly says donations are unavailable.

### Account deployment requirements

- Configure the backend's `WEBSITE_URL` to the website's **exact origin** (scheme, host, optional port; no subdirectory path) and GitHub's OAuth callback to the **backend** callback endpoint. Keep OAuth client secrets server-side. Batch-1 auth deployment requires a root-hosted website: `BASE_PATH` support is frontend-only, and authentication at a nonroot base such as `/mars/` is not integrated with the backend callback.
- Register the website's exact origin (including local dev port) in the backend CORS and CSRF allowlists. Cookie mutations have the browser-managed `Origin`; do not disable origin checking or use wildcard credentialed CORS.
- Cross-origin requests require credentialed CORS; truly cross-site cookies require appropriate `SameSite=None; Secure` behavior and may still be blocked by browser privacy policy. HTTPS and a same-site backend deployment are recommended. HttpOnly session cookies cannot be inspected by this React UI.
- SPA hosts must rewrite `/auth/login`, `/account`, and route refreshes to `index.html` while preserving query parameters. The build also emits identical `auth/login/index.html` and `account/index.html` entries for static directory hosting such as GitHub Pages (where arbitrary SPA rewrites are unavailable). The deployed host must serve/redirect these directory entries with query strings intact.
- Validate real OAuth, account-switch behavior, cookie/CORS/CSRF policy, launcher polling, static-host routing, and backend authorization in the configured deployment before release. Automated website tests use mocks and do not certify any live environment.
