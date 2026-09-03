# Real-player recording runbook

Goal: collect one truthful, same-player baseline/adapted comparison without making the tester wait on setup. Target tester time: **six minutes or less**, excluding optional conversation afterward.

## Operator preflight — finish before the tester arrives

- [ ] Use the exact release candidate and intended recording browser.
- [ ] Reset and reload; confirm **06 LIVE · APPLY ABSENT**, six discoverable tools, no proposal, and no prior trial.
- [ ] Open the agent beside the app and paste—but do not send—the prepared baseline prompt.
- [ ] Confirm capture resolution, microphone, game audio, cursor, free disk space, and notification suppression.
- [ ] Verify the tester's chosen input method works with one harmless practice action, then reset again.
- [ ] Prepare the four short follow-up prompts from [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md).
- [ ] Tell the tester they may stop at any moment and that a neutral or negative result is valid.

## Thirty-second consent and orientation

Default to anonymous, screen-only capture: no face, voice, hands, name, direct quote, health information, notifications, or unrelated tabs. This is the cleanest evidence and rights path.

The [official rules](https://webmcp.devpost.com/rules) include downstream Sponsor/Devpost promotional-use terms for submitted participant identity, voice, image, and likeness. If any identifiable participant material will appear, explain the actual downstream use and duration, obtain separate written permission that covers it, and have the entrant obtain legal review if the scope is unclear. A generic “competition video” yes is not enough for a broader license.

Use plain language:

> “You will play the same short course twice. Between runs, the agent may propose settings, but you decide whether to approve them. After the second run, choose how it actually felt. There is no right answer, and you can stop at any time. May I record the game screen and anonymous input for the public competition demo? I will not include your face, voice, hands, name, or a quote.”

Record each publication permission separately:

- screen and game input;
- hands or face;
- voice;
- quote or paraphrase; and
- name/attribution or anonymous use.

Do not assume that permission for the screen includes any other category. Do not request or record a diagnosis. A functional preference such as “fast motion is difficult” or “I use one switch” is enough.

## Live session — tester actions only

The operator handles prompts and agent waiting. The tester performs only these actions:

1. Select the real need the game should respect.
2. Complete the baseline trial.
3. Read the exact proposed changes and preserved challenge.
4. Approve or decline the proposal personally.
5. Complete the adapted trial using the reviewed settings.
6. Choose **Better for me**, **About the same**, **Worse for me**, or **Skip** without coaching.
7. Confirm whether the final displayed result matches their experience.

The operator may ask the agent to compare and undo, but must not click the player's approval or check-in.

## Operator rules

- Never tell the tester which check-in answer would look best.
- Never switch to a different baseline, sample record, or automation trace.
- Never silently alter the proposal after approval.
- Stop immediately for discomfort, confusion, unwanted motion/audio, or withdrawn consent.
- If the agent is slow, explain that the tester may relax while the operator waits. Agent latency may be edited later; human decisions may not.
- A neutral, mixed, or negative verdict is valid. Record it exactly.

## Evidence record

Fill this immediately after the run:

- Release commit/version:
- Recording filename and timestamp:
- Tester consent scope:
- Input method and selected need:
- Baseline trial ID:
- Proposal ID and exact settings:
- Adapted trial ID:
- Player check-in:
- Score before → after / delta:
- Accuracy before → after / delta:
- Collision rate before → after / delta:
- Median collect time (target visible → collected) before → after / delta:
- Exact verdict:
- Consented tester observation (precise paraphrase by default; quote only if separately licensed):
- Human-audible cue result:
- Anything not tested:

## After the tester leaves

- [ ] Preserve the untouched master recording.
- [ ] Copy only verified absolute baseline/adapted values and consented observations into `submission.release.json`, then compile the packet.
- [ ] Remove personal information and any footage outside the agreed consent scope.
- [ ] If the tester withdraws public-use permission, do not publish their footage or quote; schedule another session.
- [ ] Reset the live app to a fresh six-tool state.
