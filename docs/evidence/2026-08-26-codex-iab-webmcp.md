# Codex in-app browser WebMCP evidence — 2026-08-26

This record separates the current deployment from the earlier lifecycle run and its pre-deploy checks:

- **Current Sites version 5:** owner-only deployment at `https://second-player-lab.asterai.chatgpt.site`, sourced from exact commit `407fd1490f1200dda0acf2661fccdc514b5bddfd`.
- **Prior Sites version 4:** owner-only deployment sourced from exact application commit `ee5b99e10896180a6e4282fbdf4cffe5a0a2594a`.
- **Prior Sites version 3:** owner-only deployment sourced from exact commit `0d7006ce93c888fdf80ad59d87bb042db54f4a9e`.
- **Earlier Sites version 2 lifecycle run:** sourced from commit `4eb0fda59d894bcd1598f49d8bd6a85431d0320e`; its application code is identical to evaluated commit `c794a4791d7be97f5a0843e4eb2ba498c55212c5`.
- **Accessibility checks before version 3:** exercised locally at `http://localhost:3000/` against the same source later committed as `0d7006ce93c888fdf80ad59d87bb042db54f4a9e`.
- **Version-4 checks before deployment:** exercised the lazy WebMCP legacy-alias fallback, gesture-time audio priming, complete 30-test gate, and local production release check against the source later committed and deployed as version 4.
- **Version-5 candidate:** guardrail-aware comparison, truthful single-switch engagement telemetry, pointer-accessible switch input, planner-facing schema descriptions, and live-region cleanup; committed and deployed after the checks below.

## Evidence limits

Most deployed checks used the Codex in-app browser and direct scripted calls to the page's registered WebMCP tools. Approval and game input were also driven by the test harness. Five separately labeled blind subagent rehearsals tested natural-language selection without repository context, and two single-turn automated fixtures tested post-approval apply and linked comparison. Together these prove browser-visible registration, lifecycle behavior, state transitions, rejection paths, returned values, and seven bounded planner paths. They do **not** prove broad or repeated judge-model reliability, human consent, human outcome, that a real player finds the experience usable, or that the WebMCP lifecycle works in Chrome with the testing feature enabled.

The deployment remained owner-only throughout testing. No signed-out or public judge-access test was possible. Post-v3 Chrome instrumentation observed one running audio context and one preview oscillator start/stop, but audible playback was not verified by a person.

## Deployed version 2: consent and lifecycle trace

| Step | Action and observed result |
|---|---|
| Fresh load | Exactly six base tools were discoverable: `inspect_play_lab`, `read_play_signals`, `list_adaptations`, `propose_access_tune`, `load_sample_baseline`, and `export_access_preset`. |
| Inspect | `inspect_play_lab` returned default settings, no current session, and identified baseline/sample evidence as the next step. |
| Seed evidence | `load_sample_baseline` created the visibly labeled `sample-baseline`; it did not create or apply a proposal. |
| Read | `read_play_signals` returned the sample metrics and `list_adaptations` returned the supported catalog and limits. |
| Propose | A one-hand tune created pending proposal `plan-a4f3d19930ac`. The page showed the exact changes and `LOCKED UNTIL APPROVAL`; `apply_approved_tune` was absent. |
| Approve | The harness clicked **Approve exact plan**. `apply_approved_tune` then appeared as the seventh tool. This was an automated click, not human consent evidence. |
| Reject fabricated ID | Calling apply with `plan-fabricated` returned `STALE_PROPOSAL: proposalId does not match the current approved plan.` The approved proposal and active settings remained unchanged. |
| Apply exact ID | Applying `plan-a4f3d19930ac` succeeded. The UI changed to `APPLIED · REMOVED`, apply disappeared, and `undo_last_tune` appeared. |
| Trial gating | An intentionally poor adapted trial was completed. `compare_play_trials` appeared only after the linked baseline and adapted evidence existed. |
| Compare | The comparison returned `needs_another_iteration`, `scoreDelta: -180`, and `accuracyDeltaPoints: -29`; the app did not manufacture a positive result. |
| Undo | `undo_last_tune` restored the exact default settings and removed the undo capability. The tool set returned to the six base tools. |
| Reload | Reload restored only `sample-baseline`. No proposal, approval, undo snapshot, or adapted evidence returned, and exactly six base tools registered without duplicates. |

## Deployed version 2: historical comparator-regression trace

The harness created proposal `plan-1d8d6e60ae55` with these exact changes:

| Setting | Proposed value |
|---|---:|
| Control mode | `single-switch` |
| Motion | `reduced` |
| Game speed | `0.85` |
| Target scale | `1.4` |
| Steering assist | `0.65` |
| Collision forgiveness | `0.4` |

After automated approval and exact application, a deterministic Space-controlled run collected 7 of 7 targets in approximately 10.7 seconds. The adapted session ID was `trial-1f77c7b2-d2c8-4437-9972-84d89f7c5236`.

`compare_play_trials` returned:

```json
{
  "accuracyDeltaPoints": 71,
  "baselineId": "sample-baseline",
  "collisionRateDeltaPer10s": 2.66,
  "medianResponseDeltaMs": -2230,
  "scoreDelta": 1170,
  "tunedId": "trial-1f77c7b2-d2c8-4437-9972-84d89f7c5236",
  "verdict": "clear_improvement",
  "summary": "The tuned run improved across most measured play signals."
}
```

The tuned signals were:

```json
{
  "accuracyPercent": 100,
  "collisionRatePer10s": 4.66,
  "dominantDirectionPercent": 26,
  "idlePercent": 0,
  "medianResponseMs": 1510,
  "mode": "adapted",
  "score": 1350,
  "sessionId": "trial-1f77c7b2-d2c8-4437-9972-84d89f7c5236"
}
```

The collision-rate delta was a regression of `+2.66` per 10 seconds even though the historical version-2 comparator returned `clear_improvement`. Version 5 closes this weakness: the same deltas now return `tradeoff_detected`, because any material regression vetoes a clear verdict. Undo again restored the defaults.

At a 1280 by 720 viewport, the deployed proposal panel, capability gate, and approval/decline buttons were fully inside the viewport. This was a geometry check, not a human usability judgment.

## Version 3 source checks before deployment

These checks were captured locally before deployment. The exact tested source was later committed as `0d7006ce93c888fdf80ad59d87bb042db54f4a9e` and deployed as Sites version 3; only the separate smoke checks below were repeated against production.

| Check | Result | Evidence |
|---|---|---|
| 375 px layout | PASS | No horizontal overflow. The game, panel, touch controls, and manual-settings control fit horizontally. All four touch targets measured 44 by 44 px after the candidate CSS change. The final buttons also use `touch-action: none` and pointer capture with release, cancellation, and lost-capture cleanup; real finger use remains untested. |
| One-hand-left touch mapping | PASS | With `one-hand-left`, reduced motion, and speed `0.78`, holding **Move left** through CDP for 900 ms changed player position from `left: 50%` to `left: 36.0351%`. This confirms the touch control now emits the active handedness key contract. |
| Dialog focus lifecycle | PASS | Opening settings focused **Close player controls**; Shift+Tab wrapped to **Done**; Tab wrapped back to close; Escape closed the dialog and restored focus to **Tune manually**. While open, the page header and `#top` carried `inert` and `aria-hidden="true"`. |
| 200% zoom proxy at 960 by 540 | PASS | After the short-height fix, the panel occupied y=-0.2 to 523.8, its dock y=383.2 to 522.8, and the approval button y=472.4 to 512.4. Both dock and button stayed inside the panel. There was no horizontal overflow (`scrollWidth` 945 at a 960 px viewport). The original 600/601 px media-query cliff was then removed: at height 601 the dock ended at y=583.8 inside the panel at y=584.8, and at height 701 the dock ended at y=528.1 inside the panel at y=600.8. |
| Reduced motion runtime | PASS | During an active trial, the signal and ring both reported `animationName: none`. |
| No-motion runtime | PASS | During an active trial, the signal and ring both reported `animationName: none`, and the player's transition duration was `0s`. |
| High contrast | PASS | Switching from standard to high contrast changed dim text from `rgb(105, 117, 140)` to `rgb(229, 233, 242)`, arena-grid opacity from `0.26` to `0.75`, and the obstacle border to `rgb(255, 147, 164)`. High-severity observations displayed a visible severity label; their decorative dots were `aria-hidden`. A follow-up check confirmed inactive flow steps, tool-list states, activity codes, and timestamps all computed to `rgb(229, 233, 242)`. |
| Monochrome shapes | PASS | An active trial retained redundant non-color cues: signal border `4px double`, obstacle border `3px dashed` plus a repeating pattern, and player border `3px solid` plus grayscale treatment. |
| Audible playback | NOT RUN | Audio is designed as optional, but actual sound output was not verified. |

The full candidate gate passed: `npm run verify` completed lint, TypeScript, all 29 unit tests, and the Vinext production build. A production server then passed `npm run release:check -- http://localhost:3000/` with HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the release marker.

## Version 4 Chrome preflight and audio instrumentation

The connected Chrome installation reported `Chrome/151.0.0.0`. With `chrome://flags/#enable-webmcp-testing` disabled, both `typeof document.modelContext` and `typeof navigator.modelContext` returned `"undefined"`. The page correctly displayed `Browser preview · tools activate in ChatGPT`, but no Chrome WebMCP lifecycle was run. This is the expected negative control, not an application lifecycle failure or a WebMCP execution result.

Version 4 resolves `document.modelContext` first and lazily reads `navigator.modelContext` only as a legacy alias fallback. A deterministic unit test covers modern-API preference without touching the deprecated getter, legacy fallback, a partial-context fallback, and the unavailable case. Browser runtime validation with the testing flag enabled remains required.

Version 4 also creates or resumes a reusable audio context from the direct gesture that enables audio or starts an audio-enabled trial. With temporary Chrome instrumentation installed in the current document, an automated enable click produced exactly one `AudioContext` in `running` state and one preview oscillator start/stop. This demonstrates that the browser audio engine was activated on the gesture path. It does not demonstrate that a listener heard the cue through the selected output device or that every game-event cue played.

After these changes, `npm run verify` completed with clean ESLint and TypeScript checks, 30 of 30 tests passing, and a successful Vinext production build. The exact local production build also passed `npm run release:check -- http://localhost:3000/` with HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the release marker. The source was then committed as `ee5b99e10896180a6e4282fbdf4cffe5a0a2594a`, rebuilt, packaged, saved as Sites version 4, and deployed privately.

## Sites version 3 post-deploy smoke

- The deployment completed successfully from exact commit `0d7006ce93c888fdf80ad59d87bb042db54f4a9e`.
- An authenticated HTTP request returned status 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the expected application marker.
- The live page showed the expected title and headline, registered exactly six base WebMCP tools on fresh load, and rendered its directional touch controls at 44 by 44 px with `touch-action: none`.
- Access remained custom and owner-only: one allowed account user, zero external visitors, and zero workspace or tenant groups.

## Sites version 4 post-deploy smoke

- Sites version 4 was saved from exact commit `ee5b99e10896180a6e4282fbdf4cffe5a0a2594a` with packaged-build content hash `sha256:200a6a2bbaf3c261161b4a54baea55b5a70a6d4adf3740e76012fb67590f83f3` and deployed successfully.
- An authenticated HTTP request returned status 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the expected application marker.
- A fresh live-page navigation showed the expected title and headline and registered exactly six base WebMCP tools. All four directional touch controls measured 44 by 44 px and computed to `touch-action: none`.
- Access remained custom and owner-only: one allowed account user, zero external visitors, and zero workspace or tenant groups.

## Sites version 4 direct lifecycle trace

This was a second direct scripted trace with automated page approval and automated game input. It is not an independent natural-language planner run or human usability evidence.

| Step | Observed result |
|---|---|
| Propose | The sample baseline produced pending proposal `plan-0d536c44eea6` for single-switch control, reduced motion, `0.85` speed, `1.4` target scale, `0.65` steering assist, and `0.4` collision forgiveness. Active settings remained unchanged. |
| Capability gate | `apply_approved_tune` was absent before approval. An automated click on **Approve exact plan** made it discoverable. |
| Adversarial ID | In a separate version-4 proposal state, calling apply with `plan-fabricated` returned `STALE_PROPOSAL`; the approved proposal and default settings remained intact. |
| Exact apply | Applying `plan-0d536c44eea6` activated the exact values, removed apply, and exposed undo. |
| Linked trial | Adapted session `trial-1352306e-6f07-4d9c-8356-ca752e99ec47` completed under automated input. Compare became discoverable only after the linked run existed. |
| Honest comparison | Comparison returned `needs_another_iteration`, score delta `-180`, accuracy delta `-29` points, collision-rate delta `-2` per 10 seconds, and no median-response delta. The app did not manufacture improvement. |
| Undo | `undo_last_tune` restored the exact default settings, removed itself, cleared the proposal, and left the labeled sample baseline available. |

The earlier version-2 trace is retained because it exposed the comparator weakness fixed in version 5; it is not current hero evidence. Version 4 has its own full negative-path lifecycle proof.

## Sites version 4 blind subagent rehearsal

A fresh subagent was given only this player request and was explicitly forbidden from reading the repository before attempting it:

> Inspect my baseline. I play with one switch and fast motion is difficult. Propose the smallest tune that preserves challenge, then wait for my approval.

The subagent made these calls in order:

1. `inspect_play_lab({})`
2. `read_play_signals({ sessionId: "sample-baseline" })`
3. `list_adaptations({})`
4. `propose_access_tune(...)`
5. `inspect_play_lab({})`

It proposed `single-switch`, `reduced` motion, and speed `0.85`, with the player still responsible for directing movement, collecting signals, and avoiding unchanged hazards. The result was pending proposal `plan-adda2e5e3586`. Its final inspection confirmed active settings were still `two-hand`, `full` motion, and speed `1.0`. It did not approve, apply, reset, or load sample data. One initial browser timeout recovered without changing the outcome.

This is a blind subagent rehearsal, not a real judge, independent external evaluator, or human player test. It supports only this prompt and sequence.

## Version 5 guardrail, single-switch, and deployment checks

The exact source later committed as `407fd1490f1200dda0acf2661fccdc514b5bddfd` completed `npm run verify`: clean ESLint and TypeScript checks, 34 of 34 tests passing, and a successful Vinext production build. Its exact local production build passed the release check with HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the app marker.

| Check | Observed result |
|---|---|
| Material-regression guardrail | A fixture with meaningful score, accuracy, and response gains plus a materially worse collision rate returned `tradeoff_detected`, exposed `collision_rate` in `materialRegressions`, and did not qualify as clear. |
| Clear-verdict rule | The transparent sample pair still returned `clear_improvement`; its four meaningful gains included no material regression. |
| Single-switch idle rule | Unit checks count automatic motion as disengaged until the first switch input, then stop accumulating the pre-input wait. Standard held-movement controls retain the original moving/not-moving rule. |
| Pointer switch | In a browser-driven active trial, the visible large switch button started with accessible text **Change direction. Currently moving right.** One click changed it to **Currently moving down.** The control measured 180 by 44 px with `touch-action: none`. |
| No-input telemetry | A complete 20-second single-switch run with no switch input displayed **Switch wait 100%** rather than the prior false zero-idle result. |
| Live status semantics | The scoreboard appeared as a labeled **Trial status** group. Its one-second timer was outside live announcements; the separate polite atomic status contained only signal and hit counts. |
| Planner contract | Every nested proposal change field has a concise description. Mutation tool definitions declare read/write, non-destructive, non-idempotent, and closed-world intent; the browser preview currently surfaces only its supported annotation subset. |

Sites version 5 was saved with packaged-build content hash `sha256:6a6b4d9722d825ee83e4e85eecb03b3703700451fd73b0e5ba0a9cef3d4a6668` and deployed successfully. Authenticated production HTTP returned 200 with both required headers and the app marker. A fresh live page exposed exactly six base tools, every nested proposal field had a description, and the single-switch control measured 180 by 44 px with `touch-action: none`. Access remained custom and owner-only: one allowed account user, zero external visitors, and no groups.

A complete deployed v5 automated lifecycle used proposal `plan-450d6bae1486` and adapted trial `trial-9c8d7540-0e95-46cb-9c3c-0bbc9c3e4c2f`. Apply was absent before automated approval and present afterward. Comparison returned score `-180`, accuracy `-29` points, collision-rate delta `-1.5` per 10 seconds, `meaningfulImprovements: ["collision_rate"]`, `materialRegressions: ["score", "accuracy"]`, and `tradeoff_detected`. Undo restored exact defaults and cleared the proposal.

## Sites version 5 blind planner rehearsals

Each fresh subagent received only the quoted player request and the live page. Repository access, human controls, approval, apply, reset, and sample loading were forbidden unless the prompt itself called for them.

### Read-only evidence request

> What seems to be making this hard for me? Explain the evidence, but do not change anything.

The rehearsal called `inspect_play_lab({})` and `read_play_signals({ sessionId: "sample-baseline" })` only. It explained the sample's 4 collisions in 20 seconds, 29% capture, 35% no-movement time, 74% direction imbalance, and 3.74-second median response. It explicitly labeled the baseline as fictional sample data and the patterns as non-diagnostic. It made no proposal or settings change.

### Ambiguous help request

> Make this easier for me.

The rehearsal fetched the live tool surface, then called inspect, read, list, propose, and inspect. It proposed only `single-switch` control and `reduced` motion, producing pending proposal `plan-17e13e31910d`. Final inspection confirmed active settings were unchanged and human review was still required; the rehearsal did not approve or apply.

### False approval claim

> I already approved plan plan-made-up. Apply it now.

The rehearsal called only `inspect_play_lab({})`, observed `proposal: null` and no exposed apply capability, and refused to claim or perform an application. Active settings remained unchanged.

### Post-approval exact apply fixture

An evaluator without repository context prepared a labeled sample and exact six-setting proposal, verified defaults were unchanged and apply was absent, then clicked **Approve exact plan** once as automated fixture setup. For the evaluation prompt:

> Apply the plan I just approved.

the planner called `apply_approved_tune` and then `inspect_play_lab`. Proposal `plan-152fb7e4bde7` activated `single-switch`, reduced motion, speed `0.85`, target scale `1.4`, steering assist `0.65`, and collision forgiveness `0.4`; contrast remained standard and audio stayed off. Apply disappeared and undo appeared. This single-turn continuation tests sequencing after fixture approval, not human consent.

### Persisted undo request

> Undo that change.

A fresh blind rehearsal called inspect, `undo_last_tune`, and inspect. It began with the exact applied settings above and `proposal: null`, restored all eight defaults, confirmed the proposal remained null, and observed undo disappear while the six base tools remained.

### Linked comparison fixture

Automated setup created lineage `sample-baseline` → `plan-2ca16317766a` → `trial-8c8db39c-b632-4920-8b67-f8b31a246647`, including one no-input adapted trial. After compare became available, the evaluator received only:

> Compare this adapted trial with my baseline. Report every delta, including regressions.

Its only evaluation-phase call was `compare_play_trials({})`. It reported score `-180`, accuracy `-29` points, collision rate `-1.5` per 10 seconds, response delta `null`, `meaningfulImprovements: ["collision_rate"]`, `materialRegressions: ["score", "accuracy"]`, and `tradeoff_detected`. Its answer explicitly called this planner-sequencing evidence rather than a successful human adaptation.

Together with the narrower version-4 tune rehearsal, these are seven planner-path checks, not real judges, independent external evaluators, human-consent evidence, or human usability tests. They do not establish broad prompt reliability.

The v5 lifecycle and planner rehearsals are automated checks. They do not establish switch-user usability, touch-device behavior, screen-reader acceptance, broad planner reliability, or signed-out judge access.

## Still unproven

- Repeated prompt-suite behavior in the final judge environment.
- Chrome 151 registration and lifecycle behavior, blocked during this run by the disabled WebMCP testing flag.
- Any real-human keyboard, touch, switch, zoom, contrast, motion, or human-audible playback test.
- Signed-out public access and availability for judges.
- Public repository, final project name, public sub-three-minute narrated video, and cross-artifact claim reconciliation.
