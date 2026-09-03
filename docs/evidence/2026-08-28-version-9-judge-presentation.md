# Version 9 judge-presentation record

Date: 2026-08-28, America/Los_Angeles

## Artifact

- Application commit: `fd870698e0df9a63064cf4e493494093fab014db`
- OpenAI Sites version: 9
- Production URL: `https://second-player-lab.asterai.chatgpt.site`
- Archive hash: `sha256:4f95bd7ca86a2f4a1e3a0448a735a29829000edad6903f630041cf99dd877b65`
- Access during verification: owner-only custom access; one allowed account user, zero external visitors, zero workspace groups, and zero tenant groups

## Problem found

The premium version-8 visual system held up at wide desktop and mobile sizes, but a sample/demo state-flow rehearsal exposed a material judge-view failure at 1280×720. In the final comparison state, the fixed-height copilot grid gave the result content only about 77 px while the gate dock occupied a competing row. The headline looked polished, but the evidence a judge needed to read was effectively trapped behind a tiny scroll area.

## Version-9 correction

- A single `.panel-scroll-region` now owns the flexible short-desktop space instead of making the result and gate dock compete for separate grid rows.
- The player-needs editor collapses to a compact summary after baseline evidence exists and remains reopenable through a 44 px **Change** control.
- Proposal and final-comparison transitions reset the relevant scroll container; the comparison reset runs after the committed result is present.
- At 901–1400 px widths, the paired metric cards reflow into three horizontal rows so metric names, values, and deltas remain legible.
- Compact-height styling preserves the core permission event while removing redundant detail that duplicated the same state.
- Final trial controls now distinguish start from replay states.

## Exact-source browser QA

An agent-run browser rehearsal exercised the first view, sample baseline, proposal, visible approval, tool application, active adapted trial, and final comparison using the exact version-9 source.

At 1280×720, the final result region opened at scroll position 0 with 496 px of usable height. The same view showed:

- evidence provenance;
- the `DEMO ONLY` result boundary;
- the 180 → 0 score pair;
- all three paired metric rows; and
- the permission event below the result.

The 1920×1080 pass checked wide-desktop hierarchy. The 390×844 pass checked the compact first view and the player-needs collapse/reopen interaction, including `aria-expanded` returning to `false` after collapse. The clean deployed first view was then inspected at 1280×720.

## Automated and production checks

- `npm run verify`: ESLint clean, strict TypeScript clean, 51 of 51 tests passed, Vinext production build passed.
- `npm run release:check -- http://localhost:4176/`: HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`.
- Authenticated production smoke: HTTP 200 with both required headers and the expected hero, permission-story, visible-human-gates, agent-control-plane, needs-summary, and panel-scroll-region markers.
- Post-deploy Sites inspection: version 9 current and access still owner-only.

## Evidence boundary

The browser work above is agent-run visual and interaction QA. It is not an independent judge-comprehension study, a real-judge result, real-player accessibility acceptance, a human-consent result, a human outcome, or proof of signed-out access. The complete production WebMCP lifecycle remains recorded on version 6; version 9 preserves the same tested command contract but still needs its final Chrome-with-WebMCP and human recording gates.
