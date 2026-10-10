# Batch 3 website submission/status report

## Scope delivered

- Website release `0.2.0`; launcher display defaults and release checks `1.4.0`.
- Authenticated private JAR submission section on `/account`, separate from profile metadata.
- Project/version/HTTPS source entry, nonempty `.jar`/64 MiB help, idempotent reservation, raw credentialed JAR upload, transport progress and local cancellation.
- Owned submission list and individual refresh, eligible blocked scan retry, confirmed withdrawal, immutable backend digest/evidence/queue status.
- Interrupted uploads retain reservation and selected bytes. Unbound existing reservations can resume after reload without creating another release.
- Strict response/error guards, owner/release matching, reservation metadata matching, immutable-fact consistency and monotonic revision handling.
- Authenticated UI resets on identity/session changes; teardown aborts requests, ignores late results/progress, and HTTP 401 initiates a new session check.
- Explicit blocked-scanner/private-unpublished messaging. `publishable` is workflow eligibility only. No artifact download/install/publication surface was added.

## Files changed

- `.env.example`, `package.json`, `package-lock.json`, `scripts/check-release.mjs`, `src/config/mars.ts`: versions and release verification.
- `src/types/capsule.ts`: typed capsule, evidence, queue and state contract.
- `src/services/capsuleApi.ts`: strict guards, credentialed JSON API, raw XHR uploads, safe enumerated error messages.
- `src/utils/capsuleUi.ts`: helpful limits/metadata validation, eligibility and revision/immutable-fact merging.
- `src/components/CapsuleSubmissions.tsx`, `src/components/AccountPage.tsx`: private authenticated submission/status experience.
- `src/services/capsuleApi.test.ts`, `src/components/capsule.test.tsx`, `src/components/account.test.tsx`: focused contract, UX, isolation and account regressions.
- `README.md`, this report: directly related workflow, deployment and contract documentation.

## Validation (2026-10-10)

- `npm test -- src\services\capsuleApi.test.ts src\components\capsule.test.tsx src\components\account.test.tsx`: **65 tests passed**.
- `npm test -- src\services\accountApi.test.ts src\services\serverStatus.test.ts`: **30 tests passed**.
- `npm run lint`: passed, no warnings.
- `npm run build`: passed TypeScript and Vite production build; account/login deep-link pages generated.
- `npm run check:release`: passed package/lock, launcher defaults and supplied deployment configuration checks.
- `git diff --check`: passed. PowerShell validation used `npm.cmd` because the machine's script execution policy blocks `npm.ps1`.
- Browser/backend integration was not performed; tests use mock responses and no real artifacts, accounts or scanner provider.

## Cross-repository contract and assumptions

Requires backend `0.3.0` at configured server base without `/api`, exposing `/api/community/capsules`: POST reservation with `{project,version,sourceUrl}` and `Idempotency-Key`; GET `/mine` returns `{capsules:[...]}`; GET `/{releaseId}`, raw PUT `/{releaseId}/artifact`, POST `/{releaseId}/retry`, POST `/{releaseId}/withdraw` return a singular Capsule.

Capsule fields: 32-hex `releaseId`, string `ownerId`, immutable project/version/source/creation time/digest, operational state/revision/update time, nullable digest-bound evidence and queue summaries, and literal `publicDownloadAvailable:false`. Errors use `{detail:{code,message}}`. Reservation and identical-byte upload replay are backend-idempotent. Website never sends a caller-supplied digest.

Retry is offered for digest-bound `scan_blocked` releases with remaining job budget and a non-leased queue. Backend quarantine availability remains authoritative. Rejected/expired/withdrawn releases are terminal. All unpublished releases, including `publishable` and `uploading`, can be withdrawn except expired/withdrawn (withdrawn replay is harmless).

Default limits are 64 MiB, 10 active submissions/account, and seven-day abandoned/failed quarantine cleanup. Operator configuration and backend JAR/public-HTTPS/source-host checks remain authoritative; no runtime limit-discovery endpoint is assumed.

Cross-origin deployment requires exact website Origin, cookie credentials, allowed GET/POST/PUT methods, Content-Type/Idempotency-Key headers and upload-progress preflight support. Origin/CSRF remains backend-enforced. JSON requests time out after 10 seconds; uploads after 120 seconds. No tokens or retry keys/files are persisted in browser storage.

Backend/native client source was not modified. This report accepts the website Batch 3 milestone only; production scanner/provider approval, filesystem/SQLite operation and cross-repository end-to-end verification remain separate acceptance work.
