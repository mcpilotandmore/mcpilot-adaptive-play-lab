# YouTube publication draft

## Channel About

MCPilot is an adaptive interactive play lab by Nathan Funk / AIMAXIN. A player’s visible decisions change the browser agent’s actual WebMCP capabilities: inspect, propose, approve, apply, verify, and undo—with the human in control.

Built for the OpenAI WebMCP Challenge.

## Video title

MCPilot — Player approval creates a WebMCP tool

## Video description

AI-generated narration using OpenAI Realtime with the `marin` voice.

MCPilot asks a concrete question: what if player approval changed what an agent was technically able to do—not just what it promised to do?

A player completes a short signal course. The browser agent can inspect the live state, read source-labeled evidence, and propose a bounded, reversible tune. But `apply_approved_tune` does not exist until the player reviews and approves the exact revision in the visible page. Once the agent uses that one-shot capability, Apply disappears and exact Undo takes its place.

The same pattern protects evaluation: comparison is unavailable until a second trial and a visible player check-in. Fictional sample data can demonstrate the workflow, but it can never prove a human outcome.

The optional OpenAI Realtime voice guide is deliberately separate. It can explain the next step with speech and live captions, but receives no tools for gameplay, approval, apply, undo, or check-in.

Live demo: https://second-player-lab.asterai.chatgpt.site/

00:00 Played baseline evidence
00:08 Request sent
00:12 Three real WebMCP calls
00:30 Proposal visible; Apply absent
00:44 Player approval creates tool 7
00:54 Exact bounded apply
01:04 Apply disappears; Undo appears
01:14 OpenAI Realtime voice guide
01:36 Player-gated comparison
01:47 Implementation and reversal

Built with React, TypeScript, Vinext, the imperative WebMCP API, and OpenAI Realtime. Game state and permission state stay device-local; the standard OpenAI API key stays server-side.

Built by Nathan Funk / AIMAXIN for the OpenAI WebMCP Challenge.
