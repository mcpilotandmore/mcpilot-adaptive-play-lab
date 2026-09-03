# Final played-pair WebMCP evidence — 2026-09-03

## Scope

- Live product: https://second-player-lab.asterai.chatgpt.site/
- Course: `signal-course-v1`
- Evidence grade: `played_pair`
- Both trials report `source: played`.

## Capability sequence observed

1. The base page exposed six WebMCP tools and no apply capability.
2. The player visibly approved `plan-c4592b092b30`.
3. The page registered `apply_approved_tune` as tool 7.
4. The browser agent called that exact proposal ID once.
5. Apply disappeared and `undo_last_tune` replaced it.
6. After the adapted trial and visible player check-in, `compare_play_trials` registered as tool 8.

The applied plan changed only the control layout from two-hand/flexible to left-hand WASD and motion from full to reduced. Game speed, target scale, steering assistance, collision forgiveness, contrast, and audio cues were unchanged.

## Played evidence

| Metric | Baseline | Adapted | Delta |
| --- | ---: | ---: | ---: |
| Trial ID | `trial-ebaf831f-a54c-4359-99a8-69253269ad4f` | `trial-b6cf2c66-4577-4153-bc9d-d07eb733c6ae` | — |
| Score | 1750 | 1750 | 0 |
| Accuracy | 100% | 100% | 0 points |
| Collision rate | 0 per 10s | 0 per 10s | 0 |
| Median target-visible-to-collected time | 2307 ms | 2970 ms | +663 ms |

## Player gate and comparison

- Visible check-in: `worse`
- Captured through: `visible_player_ui`
- Recorded at: `2026-09-03T09:18:43.223Z`
- Comparison verdict: `needs_another_iteration`
- Meaningful improvements: none
- Material regressions: median collect time and player-reported experience
- Tool summary: The current tune did not cross enough improvement thresholds without unacceptable regressions; the player reported that it worked worse.

This is truthful negative evidence, not an improvement claim. It demonstrates that the player's check-in can veto an apparently safe adaptation and that the agent reports regressions instead of optimizing the story.

## Publication boundary

The already-published competition video demonstrates the approval-created apply capability and the check-in-gated comparison design. It predates this final played pair and must not be described as showing these exact trial IDs or this exact outcome.
