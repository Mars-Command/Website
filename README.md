# Mars Command Web

A responsive Mars Command colony status site built with React, TypeScript, Vite, and Tailwind CSS v4. The desktop Tauri launcher is maintained separately in `mars-command-client`.

## Run locally

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
