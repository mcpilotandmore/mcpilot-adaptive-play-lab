# Version-18 Realtime playback recovery and private deployment

Scope: repair the optional Realtime guide's browser reply-audio path after a version-17 owner test reached live transcription but did not establish audible output. This record covers implementation, automated verification, private deployment, a no-microphone production smoke, and a subsequent owner-confirmed audible Realtime reply on 2026-09-02. It is not an accessibility-benefit claim or a complete WebMCP lifecycle rerun.

## Exact artifact

- Application commit: `28ce5810f400a67ab16a363356b999b34cc457bf`
- Owner-only OpenAI Sites version: 18
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_33da3a7a6d6481919d4cad7d51c74098`
- Deployment ID: `appgdep_6a98d49fc7308191a71a67b42b2ae5c8`
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Environment-set revision: 1
- Local package SHA-256: `9f99efb1299ce58c9d00bd906d1597be9db7f2ca751ee263ce4a97019a6844d1`
- Sites archive-storage content hash: `sha256:50de22a8bd30940862dd53c4887d4ca0174903cd0accf2d522cc5c3dc0fe4a76`

The local compressed-tar hash and Sites storage hash describe different archive representations and are recorded separately.

## What changed

- The remote-audio element is mounted with `autoplay` and `playsinline` before the microphone permission wait, matching the supported WebRTC playback shape while retaining an explicit browser recovery path.
- Microphone/session state and reply-playback state are separate. Server audio events can no longer silently present themselves as proof that the browser accepted playback.
- The panel persistently distinguishes speaker starting, buffering, ready, blocked, paused, and failed states. Autoplay rejection exposes **Enable sound**; a paused element exposes **Resume sound**; terminal or missing-stream failure exposes **Reconnect voice**.
- A four-second output watchdog prevents a missing remote track or unresolved play promise from leaving **Speaker starting** on screen indefinitely.
- Playback callbacks bind the exact connection attempt, peer, mounted audio element, and `srcObject`, so late results from Stop, restart, or replaced media cannot mutate the current session.
- Stop removes media listeners, stops microphone and remote tracks, pauses and clears the audio element, closes the data channel and peer, aborts the pending request, clears the timer, and clears captions.
- Successful `response.done` no longer returns the UI to Listening before playout ends; the reducer waits for `output_audio_buffer.stopped` or `cleared`.
- The transcription vocabulary prompt was removed after the version-17 live test produced that prompt's glossary as a false user caption during silence.
- Blocked, paused, buffering, and failed states stop the decorative Speaking animation. The output card includes mobile and forced-colors treatment, and only one lifecycle status region announces state changes.

## Automated verification

- `npm run verify`: PASS — 65 product tests and 101 automated tests total, ESLint, strict TypeScript, and the Vinext production build.
- `npm run verify:clean`: PASS from the exact committed source after dependency installation reported zero vulnerabilities.
- Executed playback regressions cover successful `play()`, browser-blocked `play()` followed by successful retry, muted/ended-track readiness, generic media failure, stale promise completion, remote-track stop, element pause, and `srcObject` clearing.
- Reducer coverage proves successful `response.done` preserves Speaking and that `output_audio_buffer.stopped` returns the guide to Listening.
- Source-boundary checks prove the standard API key remains server-only, the mounted sink exists before microphone acquisition, the retry UI exists, the React-owned ref is not manually nulled, and the cleanup path is present.

## Production smoke

- The exact application commit was pushed before packaging and saving version 18.
- Deployment completed successfully with environment revision 1 and the already-configured secret `OPENAI_API_KEY`.
- The signed-in production page rendered the optional guide and one mounted audio sink with `autoplay`, `playsinline`, and `aria-hidden`.
- The visible WebMCP inventory settled at six base tools with Apply absent, preserving the approval-created capability boundary.
- The post-reload production browser log contained no warning or error.
- Access remained custom and owner-only: one allowed owner, zero external visitors, and no groups.

## Human production test

- After fresh action-time approval, the owner-only version-18 page acquired microphone input and connected to the OpenAI Realtime session.
- During the live exchange, the page showed **Speaking** and **Reply audio playing**, and the `YOU` and `GUIDE` captions updated with the conversation.
- After the bounded session, the owner explicitly confirmed hearing a complete spoken guide reply. This is human-audible evidence for that single private production run.
- The two-minute cutoff ended capture and returned the page to **Mic off** with **Two-minute demo session complete**. A post-session browser log contained no warning or error.
- The owner did not use manual Stop after the completed reply, and this run did not force autoplay rejection, pause, missing-track, terminal-error, or reconnect recovery. Those paths remain automated evidence rather than human acceptance.
- This result establishes one audible Realtime path, not human-audible game cues, a particular output device, general cross-browser or iOS behavior, accessibility benefit, or reliability across sessions.

## Remaining boundaries

- Version 18 remains private and is not yet accessible to signed-out judges. The hosted voice route still needs genuine authentication, distributed throttling, request-stream limiting, and a project spend cap or must be disabled before public access.
- A complete played-pair production WebMCP lifecycle was not rerun. The latest complete deployed lifecycle remains the human-played version-12 record.
