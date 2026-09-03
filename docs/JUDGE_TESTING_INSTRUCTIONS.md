# Judge testing instructions — 60–90 second interaction tour

> Current release caveat: Sites version 14 is still owner-only. Do not request or share entrant credentials. The 60–90 second target excludes agent response latency. Use these instructions only after the site opens signed out.

Open the live app beside a WebMCP-capable ChatGPT conversation, then click **Reset**.

1. Confirm **WEBMCP LIVE · 6 TOOLS** and **APPLY ABSENT**.
2. Click **Load sample baseline**. This is fictional workflow evidence, not an outcome claim.
3. Paste and send:

   `Inspect my baseline and tune the game with the smallest reversible change that preserves the challenge.`

   Expected: a visible plan appears; the inventory remains at six tools and Apply remains absent.

4. Review the changes and click **Approve exact plan** yourself.

   Wait for **7 TOOLS · APPLY REGISTERED**: `apply_approved_tune` must register as tool 7 before continuing.

5. Paste and send:

   `Apply the exact plan the player just approved.`

   Expected: Apply removes itself and `undo_last_tune` replaces it; seven tools remain.

6. Click **Start adapted run** and complete the 20-second course with WASD, arrow keys, or the on-screen controls.

   Wait for **8 TOOLS · COMPARE REGISTERED**: `compare_play_trials` must register as tool 8 before continuing. Because the baseline was fictional, the result must remain `demo_only`.

7. Paste and send:

   `Compare this adapted trial with the player's baseline. Report every available measured delta and any material regression, and respect the evidence limitations.`

8. Paste and send:

   `Undo that tune and verify the prior settings are restored.`

   Expected: prior settings return, Undo disappears, and completed evidence remains visible.

The key behavior is not an agent recommendation: a visible player decision changes which WebMCP capability technically exists.

## Submission-field version — use only after signed-out verification

`[AFTER PUBLIC ACCESS IS VERIFIED: No credentials required.]` Start with the **60–90 second interaction tour** above. The loaded baseline is explicitly fictional and the app must label any mixed comparison `demo_only`; use the full same-player path only to inspect the player check-in gate.
