> **Draft only.** Replace the public URLs and filmed result from the release manifest before pasting into Devpost. The final product name is locked.

# MCPilot Adaptive Interactive Play Lab

**Your approval changes what the agent can do.**

- Live app: [LIVE URL]
- Source and MIT license: [PUBLIC REPOSITORY URL]
- Demo video: [PUBLIC YOUTUBE URL]

## What we built

Most accessibility menus ask players to solve the problem before they can use the solution. A player leaves the action, guesses which settings might help, and changes several controls.

MCPilot turns that guesswork into one short, reversible experiment.

The player completes a 20-second fixed course. A browser agent reads device-local measurements such as accuracy, collisions, pauses, movement balance, and response time. It proposes the smallest supported change while explaining what it intends to preserve. The player reviews the exact values and approves or declines them.

If approved, the agent applies only that reviewed plan. The player repeats the same course and answers a simple question: better, about the same, worse, or skip. The app then reports every available change, calls out regressions, and keeps an exact undo available.

The agent never plays, approves, or answers the experience check-in for the person.

An optional OpenAI Realtime voice guide can explain that division of labor out loud. The player explicitly starts the microphone, sees live captions, and can ask what the current step means. The guide receives only a bounded summary of visible page state, has no tools, and cannot change the lab; it automatically disconnects after two minutes.

## Why this is a strong fit for WebMCP

The information needed for this interaction exists inside the open game page: the completed trial, current settings, selected needs, supported adjustment limits, proposal state, player approval, and undo snapshot. An assistant looking at screenshots would have to infer that state and hope it remained current.

WebMCP lets the page expose those facts as small, structured tools tied to the live session. More importantly, it lets the page change which tools exist as the player makes decisions.

Before approval, the agent can inspect the game, read the trial measurements, discover supported adaptations, and propose a plan—but there is no apply tool. When the player clicks **Approve exact plan**, `apply_approved_tune` registers for that proposal. It accepts only the approved ID and values; after use, it disappears and exact undo becomes available.

The same rule protects the result. After the second trial, `compare_play_trials` remains unavailable until the player answers or explicitly skips the on-screen check-in. There is no WebMCP tool for submitting that answer.

This is not a webpage with a permanent automation API attached. The player's visible choices determine what the agent is technically capable of doing next.

## How it creates a better experience

Instead of trying eight settings blindly, the player gets one explainable proposal from the completed trial. Nothing changes silently. The values stay visible, the second run uses the same course, and the saved snapshot can restore every setting.

The app also refuses to turn a flattering number into a success story. A higher score is not enough if collisions, response time, or the player's own experience became worse. **Better** can support an objectively strong result but cannot create one. **About the same** prevents a clear-improvement verdict. **Worse** vetoes success. **Skip** allows an objective comparison but not a player-benefit claim.

**Final filmed result:** [SELECTED NEED; EXACT SETTINGS CHANGE; BEFORE/AFTER METRICS; PLAYER CHECK-IN; VERDICT; UNDO RESULT]

## What people and agents can now do together

The agent reads several measurements, checks supported ranges, constructs a valid configuration, keeps both trials tied to the same course and approved plan, and presents every tradeoff.

The person keeps the decisions only they can make: playing the game, approving a change, and reporting how the result felt.

That division is the point. A recommendation-only assistant has no page-defined, session-bound way to inspect, apply, verify, and undo this experiment. A fully autonomous agent should not grant itself permission or decide whether a change helped someone. With WebMCP, neither side impersonates the other.

This is designed to reduce the guesswork involved in trying an alternative control or presentation setup. For game developers, it demonstrates a reusable permission pattern whose deterministic game state stays local. Optional voice is a separate explanation layer: microphone audio and a bounded page-state summary go to OpenAI only while the player is connected.

## How we implemented WebMCP

MCPilot uses React 19, TypeScript, Vinext, Vite, and the imperative WebMCP API. Six base tools handle inspection, signal reading, adaptation discovery, proposal creation, clearly labeled sample data, and preset export. Apply, compare, and undo register only when application state permits them. A server-only OpenAI Realtime WebRTC route powers the optional captioned guide with no tools and no access to game mutations.

Strict schemas reject extra properties, and application code checks every supported range again. IDs and saved settings keep both runs connected, while the UI and WebMCP tools pass through the same validation rules.

Gameplay telemetry, settings, approvals, and comparisons remain device-local; there is no account system, backend MCP server, or database. The optional voice guide streams microphone audio and a bounded page-state summary only while connected, and the standard API key stays on the server. Its deterministic behavior is covered by 65 product tests (101 automated tests total).

The result is a working human-agent loop built around a simple rule: the agent can help the game listen, but the player remains in control.
