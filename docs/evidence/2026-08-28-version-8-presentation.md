# Version 8 presentation release record

Captured on 2026-08-28 in America/Los_Angeles.

## Exact artifact

- Private OpenAI Sites release: version 8
- Production URL: `https://second-player-lab.asterai.chatgpt.site`
- Application source commit: `59657d049446e4b51f2fc11e9ab5a01c975bbdfe`
- Saved archive hash: `sha256:bf86883de855aee627629eed194c9c6fe6dd4e1cd4c05d772a061f3c0d3b7862`
- Deployment result: succeeded
- Access after deployment: custom owner-only access, owner role, one allowed account user, zero external visitors, and zero workspace or tenant groups

The deployment intentionally remains inaccessible to signed-out judges until the entrant approves the exact public-access change.

## Presentation changes

Version 8 makes the product's permission model the visual plot while preserving the version-7 behavior and evidence contract.

- The landing view now leads with **The game meets you halfway**, the six-tool agent handoff, and three compact proof facts: six base tools, two visible human gates, and zero telemetry uploads.
- The hero and product share one black, cobalt, and mint visual system aligned with the existing 1200 by 630 share image. Warm yellow is reserved for human decision states.
- A state-aware permission card makes the capability transition explicit: approval adds exact apply, one use removes apply and exposes undo, adapted play requires the player check-in, and the resolved check-in unlocks comparison.
- The arena stages the approved tune before the second run and keeps **ADAPTED RUN** visible during play.
- The ending now pairs baseline and adapted values for accuracy, collision rate, and median response, with the complete deltas still visible.
- Critical type and metadata were enlarged, primary controls enforce 44 px targets, responsive breakpoint cliffs were removed, and forced-color treatments now cover the player, signal, hazards, and controls.
- Expensive ambient effects are reduced during active play to protect the measured trial's frame budget.

## Verification

The exact deployed application source passed:

- ESLint
- strict TypeScript checking
- all 51 deterministic tests
- the Vinext production build
- local release checking with HTTP 200, `Origin-Agent-Cluster: ?1`, and `Permissions-Policy: tools=(self)`

The successful build output was packaged, tied to the exact pushed commit, saved as Sites version 8, and deployed privately. An authenticated production fetch then returned:

- HTTP 200
- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`
- the expected headline
- the permission-story handoff marker
- the visible-human-gates proof marker
- the agent control-plane marker

## Evidence boundary

This release record proves the implemented hierarchy, exact source/build provenance, automated regression gate, production headers, marker presence, deployment success, and owner-only access. It does not claim a rerun of the full browser/WebMCP lifecycle on version 8, signed-out judge access, independent visual-browser QA, judge comprehension, real-human accessibility acceptance, or an accessibility outcome.
