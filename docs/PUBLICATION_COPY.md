# Publication copy kit

Use this file only after `submission.release.json` contains the final evidence and every bracket is replaced. Copy exact values from the manifest; do not improve the story by changing the result.

## Naming block

- Project: **MCPilot Adaptive Interactive Play Lab**
- Tagline: **Your approval changes what the agent can do.**
- Memory line: **The player's approval changes which WebMCP tools exist.**
- Thumbnail line: **PLAYER APPROVAL CREATES TOOL 7**

## One-line pitch

MCPilot is a playable accessibility lab where a player tests one agent-proposed change and can undo it—with approval controlling apply and, for a played pair, the check-in controlling comparison.

## 50-word pitch

MCPilot turns accessibility tuning into a player-controlled experiment. A browser agent reads source-labeled play signals and proposes one reversible change. Apply does not exist until the player approves. For a played pair, comparison does not exist until the player answers a check-in. Evidence, authority, and reversal stay in one loop.

## Audience and problem

Accessibility friction often becomes obvious only during play, yet conventional settings menus force the player to leave that context and translate the experience into unfamiliar options. This prototype lets the player and agent turn the evidence already visible in the game into one bounded, inspectable experiment without asking for a diagnosis or giving the agent unilateral authority.

**Exact recorded outcome:** baseline `[BASELINE TRIAL ID]` → adapted `[ADAPTED TRIAL ID]`; check-in `[BETTER / SAME / WORSE / SKIPPED]`; score `[EXACT DELTA]`; accuracy `[EXACT DELTA]`; collision rate `[EXACT DELTA]`; median collect time `[EXACT DELTA OR UNAVAILABLE]`; verdict `[EXACT VERDICT]`; player observation `[CONSENTED PRECISE OBSERVATION]`.

## Short gallery description

Play once. Let the browser agent inspect source-labeled friction signals and propose the smallest reversible tune. Review every changed value. Your approval creates apply; for a played pair, your later check-in creates comparison. Then inspect every available delta and restore the exact prior settings with one-step undo.

## YouTube package

**Title**

> MCPilot — Player approval creates WebMCP tool 7

**Description**

> What if player approval did more than confirm a dialog—what if it changed what an agent was technically able to do?
>
> MCPilot is a playable accessibility lab built for the OpenAI WebMCP Challenge. A player completes a short trial. A browser agent reads compact, source-labeled interaction signals and proposes one bounded, reversible tune. The mutating apply tool is absent until the player reviews the exact plan and approves it. After the same player tests the adaptation, comparison remains absent until they answer or explicitly skip a visible experience check-in.
>
> The result is one inspectable loop: play → inspect → propose → approve → play again → verify → undo.
>
> Final recorded result: baseline [BASELINE TRIAL ID] → adapted [ADAPTED TRIAL ID]; player check-in [BETTER / SAME / WORSE / SKIPPED]; score [EXACT DELTA]; accuracy [EXACT DELTA]; collision rate [EXACT DELTA]; median collect time [EXACT DELTA OR UNAVAILABLE]; verdict [EXACT VERDICT]. [CONSENTED PRECISE PLAYER OBSERVATION]
>
> Live app: [JUDGE-ACCESSIBLE LIVE URL]
> Public source: [PUBLIC REPOSITORY URL]
> Immutable tag: [RELEASE TAG]
>
> Built with React, TypeScript, Vinext, the imperative WebMCP API, and an optional captioned OpenAI Realtime voice guide. Gameplay telemetry and permission state stay device-local; microphone audio and a bounded page-state summary go to OpenAI only while voice is connected, and the standard API key remains server-side.

**Chapters for the 1:59 cut**

```text
00:00 Human baseline and handoff
00:12 Three real WebMCP calls
00:30 Player approval creates tool 7
00:44 Exact apply · Undo added
00:54 Same-player adapted trial
01:04 The visible player check-in
01:14 Evidence and verdict
01:36 Exact reversal
01:47 How dynamic registration works
```

**Suggested tags**

`WebMCP`, `OpenAI`, `AI agents`, `accessibility`, `human in the loop`, `browser agents`, `game accessibility`

## Devpost gallery

1. **APPLY ABSENT** — The agent can inspect and propose, but no mutating apply capability exists before visible player approval.
2. **APPLY ADDED** — The uninterrupted approval click creates a single-use tool constrained to the exact reviewed proposal.
3. **PLAYED PAIR** — The same fixed course, complete evidence lineage, player check-in, every available delta, and exact verdict remain visible together.

## Social launch copy

> We built MCPilot for the OpenAI WebMCP Challenge.
>
> The twist: approval is not just a dialog. The apply tool literally does not exist until the player reviews and approves the exact plan. For a same-player played pair, their later check-in controls when comparison exists, too.
>
> Play → propose → approve → verify → undo.
>
> Devpost: {ADD_PUBLIC_DEVPOST_URL_AFTER_SUBMISSION}

The post-submission URL token is intentionally outside the pre-submission release gate. Do not publish this post until the entrant explicitly approves the exact final text and public action.

## Claim-safe fallback result lines

Key the sentence to the exact manifest verdict, then append the visible check-in only when it adds a necessary boundary.

- `clear_improvement`: **Multiple objective measures cleared their thresholds, the player selected Better, and no material regression appeared.**
- `mixed_improvement`: **Some objective measures cleared their thresholds without a material regression, but the result did not qualify as a clear improvement.**
- `needs_another_iteration`: **The run did not produce enough qualifying gains without unacceptable regressions, so the page calls for another iteration.**
- `tradeoff_detected`: **At least one measure improved while another measure or the player's report materially regressed, so the page reports a tradeoff.**
- `objective_only`: **The player skipped the check-in, so the page reports objective deltas without making an outcome claim.**

## Final copy gate

- [ ] Final name, tagline, URLs, and release tag match `submission.release.json` exactly.
- [ ] The displayed trial IDs, check-in, verdict, and four deltas match the final recording.
- [ ] No sentence calls the prototype broadly accessible or claims a player benefited unless the recorded evidence supports that exact wording.
- [ ] YouTube title, description, chapters, captions, thumbnail, and Devpost gallery open signed out and use the same story.
- [ ] No tester identity, face, hands, voice, quote, or health information exceeds the recorded consent scope.
