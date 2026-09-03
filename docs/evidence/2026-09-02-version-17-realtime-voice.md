# Version-17 optional Realtime voice guide and private deployment

Scope: add an optional OpenAI Realtime voice guide that makes the visible flow easier to understand without granting the model page or WebMCP authority, configure its server-only runtime secret, verify the exact application source, and deploy it privately on 2026-09-02. This is engineering and release evidence, not human-audible playback, accessibility benefit, a new WebMCP lifecycle, or a final-film result.

## Exact artifact

- Application commit: `f6932d3585c82e4c4136115fe9d337f9e03359b7`
- Owner-only OpenAI Sites version: 17
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_0c1a99238c3481918a0b9f9a057de76e`
- Deployment ID: `appgdep_6a9889de78948191b76c0a12253a90d3`
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Environment-set revision: 1
- Local package SHA-256: `63bdd95d712de70d07bb585789dc955d2f93d98a862541fd1951244d7429080c`
- Sites archive-storage content hash: `sha256:b3a6402da828ae06b97695c7bbab3346bb1aed7405fe812296eefa8eba1496d1`

The local tar hash and Sites storage hash describe different representations and are recorded separately.

## What changed

- A first-viewport **Optional OpenAI Realtime voice guide** can explain the visible flow with live captions and bounded page context.
- Voice never starts automatically. A player must press **Start voice guide** before microphone permission is requested, and **Stop** tears down capture. A client-side maximum ends a connection after two minutes.
- The Realtime session is pinned to `gpt-realtime-2.1`, uses server voice activity detection and transcription, returns audio only, and has a small output-token ceiling.
- The voice session has no tools. Its instructions explicitly prohibit playing, approving, applying, undoing, answering the player check-in, or representing that it used WebMCP.
- Gameplay, settings, telemetry, approvals, comparisons, and all WebMCP tool authority remain in the existing local product flow.
- The standard OpenAI API key is read only in the server route. The browser receives neither the key nor a client secret.

## Secret handling

- The already-confirmed ignored local key was transferred directly to the owner-only Sites project as secret `OPENAI_API_KEY` without printing it into the agent-visible transcript.
- Sites reported environment revision 1 and returned the stored value as `null`.
- Exact-byte scans found zero local-key occurrences in the clean client/server build and packaged deployment archive.
- The clean-checkout verifier removes `OPENAI_API_KEY` from child-process environments and performs its own exact-byte scan before reporting success.

## Verification before deployment

- `npm test`: PASS — 65 product tests and 101 automated tests total.
- ESLint: PASS.
- Strict TypeScript: PASS.
- Vinext production build: PASS.
- The release configuration requires `Permissions-Policy: tools=(self), microphone=(self)`; the same policy is covered by the release checker and application tests.
- A separate external clean-checkout verification passed using the same application source; the verifier hardening itself was committed afterward as release-only commit `a02b6ffd9cd943d49ab3f58cd8e909fd51ebdde3`.
- The version-17 archive was created from a clean external checkout of the exact application commit. It contained 99 local tar entries and no key bytes before upload.

## Production smoke

- The saved Sites version points to exact application commit `f6932d3585c82e4c4136115fe9d337f9e03359b7`; deployment `appgdep_6a9889de78948191b76c0a12253a90d3` completed successfully with environment revision 1.
- The signed-in deployed page rendered the optional voice guide, explicit Start control, mic-off state, privacy disclosure, and named hazards.
- The deployed WebMCP inventory settled at six base tools with Apply absent, preserving the approval-created capability boundary.
- A same-origin request with deliberately invalid but shape-valid SDP reached the hosted route. It returned sanitized `502 voice_connection_failed` JSON with `Cache-Control: no-store, max-age=0`, not `503 voice_not_configured`. This proves only that the configured route reached the upstream call boundary.
- The live deployment was marked as the current browser deliverable.

## Boundaries

- Version 17 remains private and is not yet accessible to signed-out judges.
- At version-17 release-QA time, microphone permission had not been granted. A later owner test reached a connected session, live transcription/captions, and Stop, but it ended before playout completed and did not establish audibility; the subsequent owner-heard version-18 result is recorded in the [version-18 playback-recovery evidence](2026-09-02-version-18-realtime-playback-recovery.md).
- The Realtime route is suitable only for the current owner-only demo. Before public access, add genuine authentication, distributed throttling, request-stream limiting, and an OpenAI project spend cap or disable hosted voice.
- A complete played-pair production WebMCP lifecycle was not rerun on version 17. The latest complete deployed lifecycle remains the human-played version-12 record.
- `productionLifecyclePassed` therefore remains false in the release manifest.
- Final name, public access, public repository, narrated public video, signed-out checks, and final submission remain open.
