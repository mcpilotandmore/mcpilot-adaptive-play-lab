# Provenance-bearing comparison evidence — 2026-08-26

Scope: the behavioral traces below were captured against the exact release candidate in the Codex in-app browser at `http://localhost:3000/`; the later handoff section records its private version-6 deployment and live smoke. This is not a human usability study, identity proof, or public-access result.

## Automated release gate

- `npm run verify`: PASS — ESLint, strict TypeScript, 46/46 tests, and Vinext production build.
- `npm run release:check -- http://localhost:3000/`: PASS — HTTP 200, `Origin-Agent-Cluster: ?1`, and `Permissions-Policy: tools=(self)`.
- Fresh page load exposed exactly six base tools without console errors.

## Negative control: fictional baseline cannot become an outcome claim

1. `load_sample_baseline` returned `source: sample`, `evidenceGrade: fictional_sample`, and `courseId: signal-course-v1`.
2. Proposal `plan-23d9c06c9721` visibly retained **FICTIONAL SAMPLE · DEMO PLAN** and the course ID.
3. Before approval, `apply_approved_tune` was absent. A visible approval click made it available; exact application removed it.
4. A complete played adapted trial produced `trial-5a09ad91-0794-486f-ac01-2488cab5520a`.
5. The UI showed **DEMO ONLY · FICTIONAL EVIDENCE** and identified `sample baseline + played adapted`.
6. `compare_play_trials` returned:

   - `evidenceGrade: demo_only`
   - `claimableOutcome: false`
   - `baselineSource: sample`
   - `adaptedSource: played`
   - `courseId: signal-course-v1`
   - `meaningfulImprovements: []`
   - `materialRegressions: []`
   - `verdict: demo_only`

Raw score, accuracy, collision, and response deltas remained visible, but the result explicitly said no outcome claim was allowed.

## Played-pair gate: the visible check-in controls paired-comparison availability

1. Played baseline `trial-c438eae2-95ef-42c3-99d7-82a34df066e7` carried `source: played`, `evidenceGrade: played_trial`, and `courseId: signal-course-v1`.
2. Proposal `plan-4733ee0f6e01` retained the played-baseline grade and exact course.
3. After exact approval/application and played adapted trial `trial-ba1bd4bf-f752-44be-a113-82b809dccf83`, the page showed the visible checkpoint. The observed UI label **PLAYER-ONLY CHECKPOINT** described its intended interaction path; it did not verify a human identity.
4. Before any response:

   - paired deltas and the comparison verdict were hidden, while raw per-run UI could remain visible;
   - the dock read **LOCKED UNTIL PLAYER CHECK-IN**;
   - `compare_play_trials` was absent from a fresh tool snapshot.

   This first trace did not inspect pending `inspect_play_lab` or `read_play_signals` output. The final exact-candidate rerun below closes that gap.

5. The browser harness used a normal semantic click to select **Worse for me**. The button changed to `aria-pressed=true`, and the browser then announced `compare_play_trials` as newly available.
6. `read_play_signals` and `compare_play_trials` both returned a record with:

   - `status: answered`
   - `outcome: worse`
   - the exact baseline ID
   - `capturedVia: visible_player_ui`
   - an ISO timestamp

7. The comparison returned `evidenceGrade: played_pair`, `claimableOutcome: true`, and `player_reported_experience` in `materialRegressions`. With no objective gain in this no-input trace, the verdict was `needs_another_iteration`.

Recorded unit coverage separately proves that Worse converts otherwise-clear objective gains into `tradeoff_detected`, Better does not manufacture a stronger objective verdict, and Same caps an otherwise-clear objective result below clear.

## Final exact-candidate rerun: redaction, four outcomes, and evidence-preserving undo

The final local rerun used played baseline `trial-9a85cd0d-3da9-44a0-a1a4-704ce7527ff7`, proposal `plan-3392122b135e`, and played adapted trial `trial-99db776a-8e3f-45b0-8fdc-fd47d6a6a0f0`.

Before any checkpoint response:

- `compare_play_trials` was absent.
- `inspect_play_lab` returned provenance and lineage state but no score, accuracy, or signal codes for the adapted run; it set `metricsWithheld: true` and `withholdingReason: pending_visible_player_check_in`.
- Default `read_play_signals({})` rejected with `PLAYER_CHECK_IN_REQUIRED` and exposed no adapted metrics.
- Keyboard focus moved to the first native checkpoint radio after the adapted trial.

The browser harness then used normal semantic radio clicks for every visible choice against the same pair:

- **Skip:** `verdict: objective_only`, `claimableOutcome: false`, and an explicit no-player-outcome-claim summary.
- **About the same:** `needs_another_iteration` for this no-input pair; unit coverage separately proves that Same caps an otherwise-clear objective result below clear.
- **Worse for me:** `needs_another_iteration` plus `player_reported_experience` in material regressions.
- **Better for me:** `needs_another_iteration`; the positive response did not upgrade the objective result.

Finally, `undo_last_tune` restored all exact default settings and returned `evidenceRetained: true`. Undo then disappeared, while `compare_play_trials`, the played pair, and the recorded check-in remained available. This prevents an undo from deleting inconvenient evidence.

## 1280×720 checkpoint geometry

The first implementation kept three capability rows visible and covered the lower player-choice row. The dock was changed to show only the relevant capability plus immediate manual undo, and the checkpoint now uses one native radio group.

Final observed geometry and semantics:

- All four choice labels measured about `74 × 44` px at 1280×720.
- Choice, metadata, and status text computed to `12px`.
- Every label center was unobstructed. After extending the compact layout through 760 px viewport height, the final result-state dock measured 147.5 px tall, ended at y=701.05, and its 40 px undo action ended at y=690.66 inside the 720 px viewport.
- Focus moved to the first radio after adapted play; arrow-key selection stayed inside the native group, and selection displayed a non-color check marker while the result remained a live status.
- All four normal semantic radio clicks succeeded and changed the comparison output.

This is automated geometry and interaction evidence, not real-player acceptance.

## Private production handoff

The exact application source was committed as `3d6ce6a86e0c0ba7f2794ee7c2e45a244664bc1a`, packaged from the successful 46-test build, saved as Sites version 6, and deployed successfully. Authenticated production smoke returned HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the app marker. A fresh signed-in page exposed the expected headline and six base tools with the updated provenance/check-in descriptions.

Post-deploy access inspection still showed custom owner-only access: one allowed owner account, no editors, no external visitors, and no workspace or tenant groups. This intentionally does not establish signed-out judge access.

A fresh automated production lifecycle then used baseline `trial-369e980c-7d02-458f-82e8-ddd1b2c32e54`, proposal `plan-2a38469a7ef3`, and adapted trial `trial-3bcd5fb9-80f4-4c06-9500-030bf645686f`. Apply followed the absent → visible approval/present → exact application/absent sequence. Before the check-in, inspect returned `metricsWithheld: true`, the default signal read rejected with `PLAYER_CHECK_IN_REQUIRED`, and compare was absent. Consecutive ArrowRight input kept focus in the radio group while selecting Same then Worse. Compare then returned `needs_another_iteration` with `player_reported_experience`; undo restored all exact defaults, removed itself, returned `evidenceRetained: true`, and left the comparison available. This is production automation, not a human outcome.

## Boundaries

- “Captured through the visible player UI” does not cryptographically prove which physical person clicked.
- No WebMCP or site tool is intended to submit the checkpoint. This trace does not prove that generic browser automation is impossible; the harness itself performed the observed click.
- The browser harness performed the clicks and trials; it is not consent or outcome evidence from a target user.
- The completed run may remain visible, but pending agent-facing metrics were redacted and paired deltas plus the verdict stayed locked.
- Chrome with its WebMCP testing flag enabled remains untested.
- The deployed version 6 remains owner-only and is not yet judge-accessible.
