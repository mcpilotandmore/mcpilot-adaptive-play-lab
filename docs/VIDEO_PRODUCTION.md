# Competition video production board

This is the execution companion to [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). The goal is a film that feels designed, not decorated: one continuous human-agent proof loop, one memorable capability transition, and no unsupported claim.

## Creative direction

**Core image:** the real agent tool surface changes because the player visibly approves.

**Visual language:** preserve the app's black, cobalt, mint, and white system. Use hard cuts for state changes, slow 105–118% digital pushes for emphasis, and one restrained unlock accent when **APPLY ADDED** appears. Avoid stock footage, generic AI imagery, fake chat bubbles, logo montages, glitch effects, and decorative transitions.

**Editorial rule:** every flourish must clarify one of four facts:

1. the player creates the evidence;
2. the agent can propose but cannot approve;
3. the visible human decision changes which tool exists; or
4. the player—not telemetry alone—controls what the comparison may claim.

## Required deliverables

- `1920×1080`, 16:9 master, 30 or 60 fps.
- Preferred final runtime between `1:58` and `2:05`; the locked cut targets `1:59`, and YouTube must report less than `3:00`.
- Public YouTube upload with corrected captions and audio.
- One clean 1280×720 or larger thumbnail based on the real interface, not generated product UI.
- Three Devpost stills: **APPLY ABSENT**, **APPLY ADDED**, and final **PLAYED PAIR**.
- A local master export and the immutable source/project file used to edit it.

## Capture layout

- Record the app and browser agent together at native 1920×1080.
- Reserve roughly 68% of the frame for the app and 32% for the agent pane during tool calls.
- Let the arena fill the frame during both human trials while retaining a narrow visible agent edge or clear browser context.
- Keep browser zoom at 100%. Crop in the editor so text geometry and accessibility checks remain representative.
- Use a subtle cursor halo only if it does not obscure button labels.
- Show keystrokes or the tester's hand only when it strengthens the claim that the person—not the agent—played.
- Disable notifications, badges, personal tabs, password managers, chat previews, and desktop overlays before capture.

## Graphics package

Use no more than five editorial overlays:

1. `BASELINE · HUMAN-PLAYED`
2. `20-SECOND RUN · SHORTENED`
3. `PROPOSING IS NOT APPLYING.`
4. `ADAPTED · HUMAN-PLAYED · SHORTENED`
5. `MCPILOT · ADAPTIVE INTERACTIVE PLAY LAB`

Typography should match the product: compact uppercase display face for thesis cards and a neutral sans-serif for captions. Keep overlays inside a 10% title-safe margin. Do not cover the permission card, proposal diff, player checkpoint, verdict, or result metrics.

## Sound and voice

- Record narration in a quiet, soft room with the microphone 10–15 cm from the speaker.
- Target clear conversational speech rather than trailer voice. Remove long breaths and room noise without metallic denoising artifacts.
- Keep the original game cues audible during play.
- Use an original minimal pulse below narration; mute it entirely around approval, player check-in, and exact undo so those clicks land.
- Do not use celebratory sound when the verdict is neutral, mixed, or negative.
- Master for intelligible online playback: approximately `-14 LUFS` integrated with true peaks below `-1 dBTP`.
- Verify the final export through headphones, laptop speakers, and one second device.

## Edit assembly

1. Build the complete truthful screen-recording spine first.
2. Remove only agent latency and genuine dead air. Mark latency compression with a conventional visible jump cut or brief `AGENT WORKING` card.
3. Copy the recorded absolute values and consented observations into `submission.release.json`, run `npm run submission:pack`, and add narration against the locked picture using `submission/ready/DEMO_CAPTIONS.srt`.
4. Add the five permitted overlays and restrained digital pushes.
5. Add original sound accents last.
6. Watch once muted: the capability story must still read.
7. Listen once without looking: the human/agent boundary must still make sense.
8. Watch signed out from the public YouTube URL at 720p and 1080p.

## Thumbnail

Use a real capture of the permission card at **06 LIVE · APPLY ABSENT** with the arena behind it. Add only:

> PLAYER APPROVAL CREATES TOOL 7

Keep the product mark small. Do not use a face unless the recorded tester explicitly consents to public use.

## Quality vetoes

Do not publish a cut if any answer is “no”:

- Does the working product appear immediately, with the first real WebMCP call beginning by 0:12?
- Can a first-time viewer explain why player approval creates tool seven after seeing the single approval moment?
- Is the approval → seventh-tool transition uninterrupted and readable?
- Can the viewer read `apply_approved_tune` entering the actual browser-agent tool surface—not merely an app-rendered counter?
- Are both played trials visibly attributable to the same consenting person?
- Is the checkpoint answer visibly human and uncoached?
- Does the spoken result match the displayed values and exact verdict?
- Does undo restore settings without being described as erasing evidence or restoring the entire application?
- Are the site, repository, and video accessible signed out?
- Does every public artifact use the same final name, tagline, URLs, metrics, and claim boundary?

## Publication sequence

1. Record and lock the human evidence.
2. Copy only verified facts into `submission.release.json`; run `npm run submission:pack` and use the generated files in `submission/ready` as the publication source of truth.
3. Reconcile the non-generated shoot script and claim matrix to that packet; never retype metric deltas into public copy.
4. Export a private review cut and conduct one cold-viewer comprehension test. Reject any cut that repeats the approval climax or spends time on setup.
5. Correct only confusion, legibility, audio, or evidence mismatch.
6. Publish YouTube, verify signed out, then paste the immutable link into Devpost.
7. Freeze the public repository commit and deployed site version.
8. Submit at least one day before the official deadline when possible.
