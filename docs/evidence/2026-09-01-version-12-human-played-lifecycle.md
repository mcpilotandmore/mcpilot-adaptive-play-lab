# Version 12 human-played production lifecycle

- Verification date: 2026-09-01, America/Los_Angeles
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Access during verification: signed-in owner-only Sites session
- Application commit: `88c216e118e918a2fa3c944ab93720fcf38d663b`
- Sites version: 12
- Browser: Codex in-app browser with the page's registered WebMCP tools

## Authority split

The user personally completed both game trials, clicked **Approve exact plan**, and selected **About the same** in the visible player check-in. The agent did not play the game, approve the proposal, or answer the check-in. It used the registered site tools to inspect evidence, draft the proposal, apply the exact approved revision, compare the resolved pair, and undo the tune.

This observed session proves the intended separation of authority for this one run. It is not disability- or accessibility-specific acceptance, identity proof beyond the session, an independent tester result, Chrome evidence, signed-out access evidence, audio evidence, or final filmed proof. The game did not instrument keyboard-versus-touch modality, but the user confirmed after the run that they used WASD.

## Baseline and proposal

- Human-played baseline: `trial-1fde6125-3cbf-4713-bd1f-2a63ea4724db`
- Baseline source/evidence: `played` / `played_trial`
- Baseline result: score `1200`, accuracy `71%`, collision rate `0/10s`, median collect time `2978 ms`
- Observed signal: `target_collect_time`
- Player-confirmed input path: WASD under the `one-hand-left` preset; this confirmation was reported after the run rather than instrumented by the game
- Selected preferences visible to the agent: one-hand play and less motion
- Proposal: `plan-46c7eeb6e78c`
- Proposed changes: `controlMode` from `two-hand` to `one-hand-left`; `gameSpeed` from `1` to `0.85`; `motion` from `full` to `reduced`
- Preserved challenge: the player still steers around every visible hazard and collects the same seven signals on the same fixed course

Before visible approval, the live inventory contained the six base tools and did not contain `apply_approved_tune`. The page showed **06 LIVE · APPLY ABSENT**, the exact proposal, and unchanged default settings.

## Approval and exact application

After the user clicked **Approve exact plan**, the live inventory contained seven tools, adding `apply_approved_tune`. Inspection reported proposal `plan-46c7eeb6e78c` as approved and the exact plan ready to apply.

The agent invoked `apply_approved_tune` with that proposal ID. The result reported `status: applied` and activated exactly:

- `controlMode: one-hand-left`
- `gameSpeed: 0.85`
- `motion: reduced`

Every other setting remained at its default. Apply then disappeared, `undo_last_tune` appeared, and the page showed **07 LIVE · APPLY REMOVED · UNDO ADDED**. At this point comparison was absent and the next human step was the adapted trial.

## Adapted run, check-in, and comparison

- Human-played adapted trial: `trial-f2a889db-74c0-4865-8fa8-bd0bde65217e`
- Adapted source/evidence: `played` / `played_trial`
- Adapted result: score `1670`, accuracy `100%`, collision rate `0.55/10s`, median collect time `2815 ms`
- Visible check-in: `same`, captured through `visible_player_ui` and linked to the exact baseline

The user resolved the check-in before the agent's next snapshot. That snapshot showed eight live tools with `compare_play_trials` added and the page stated **08 LIVE · COMPARE ADDED**. This run therefore did not independently sample the brief post-trial, pre-check-in redaction state; that state remains covered by the deployed version-10 trace and version-12 contract tests.

`compare_play_trials` returned:

- evidence grade: `played_pair`
- claimable outcome: `true`
- score delta: `+470`
- accuracy delta: `+29` points
- collision-rate delta: `+0.55/10s`
- median collect-time delta: `-163 ms`
- meaningful improvements: score and accuracy
- material regression: collision rate
- verdict: `tradeoff_detected`
- summary: the tune improved score and accuracy but materially regressed collision rate; the player reported that it worked about the same

No clear-improvement claim is supported by this result.

## Exact undo

The agent invoked `undo_last_tune`. It returned `status: restored_previous_settings` and `evidenceRetained: true`. All eight settings exactly matched the pre-apply defaults:

- audio cues off
- collision forgiveness `0`
- standard contrast
- two-hand controls
- game speed `1`
- full motion
- steering assist `0`
- target scale `1`

After undo, `undo_last_tune` was absent, `compare_play_trials` remained available, the completed evidence and check-in remained visible, and the game returned to **Baseline trial** with **Start new baseline trial**.

## Remaining gates

This lifecycle does not establish a WebMCP-enabled Chrome pass, signed-out judge access, public repository access, a final recorded same-player film, independent comprehension, accessibility-specific benefit, or human-confirmed audio. Those remain separate release gates.
