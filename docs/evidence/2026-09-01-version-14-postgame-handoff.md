# Version-14 post-game handoff clarity and private deployment

Scope: repair the baseline-completion dead end, verify the exact source, deploy it privately, and smoke-test the deployed handoff on 2026-09-01. The production smoke was automated and stopped after copy. It is not human play, consent, comprehension, an accessibility result, a complete lifecycle, or final film evidence.

## Exact artifact

- Application commit: `2a83e823b777a7d9dbbe3d6f9a9ce6f40075b684`
- Owner-only OpenAI Sites version: 14
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Local package SHA-256: `f3505189ae82b6e66338f5325243a9859ef4c24e26705f29bacbc09951932d5f`
- Sites archive-storage content hash: `sha256:de1776c65c6e68bb7de9590d5d8ec78d1d5defd1eb8772bdd55711fcbdd0cdea`

The local tar hash and Sites storage hash describe different representations and are recorded separately.

## What changed

- A completed baseline now opens the Tune plan panel instead of hiding the next step behind Play signals.
- The arena replaces replay-as-primary with **Baseline captured. Next: ask the agent.**
- A visible receipt shows **Run saved → Send in chat → Review plan**.
- Copy is an immediate arena action; replay remains available as a quiet secondary action.
- After copy, the card reads **COPIED — NOT SENT** and explicitly says that nothing is running and the page cannot send messages or change settings.
- A received proposal replaces the former disabled game button with an actionable **Review exact plan** control that focuses the visible approval gate.
- An approved plan presents the truthful Apply state: copy when registered, retry when registration paused, or a clear WebMCP-browser requirement when unavailable.
- Baseline completion moves keyboard focus to the described copy action. Adapted completion retains its separate visible player-check-in focus behavior.

## Verification before deployment

- `git diff --check`: PASS.
- `npm run verify`: PASS — ESLint, strict TypeScript, all 56 product tests (92 automated tests total), and the Vinext production build.
- `npm run verify:clean`: PASS from a Git archive of exact application commit `2a83e823b777a7d9dbbe3d6f9a9ce6f40075b684`, including lockfile installation with zero reported vulnerabilities, 92 tests, and the production build.
- A local 20-second direct-UI trial ended on the Tune plan tab with the primary copy action active. Copy changed the arena and adjacent panel to explicit copied-not-sent guidance.
- An independent read-only UX audit found and then rechecked fixes for completion focus and truthful Apply registration failure/unavailable states.

## Production smoke

- The pushed source SHA, saved Sites-version source SHA, and application commit all matched `2a83e823b777a7d9dbbe3d6f9a9ce6f40075b684`.
- Authenticated HTTP returned 200 with `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the product title.
- A fresh signed-in production tab exposed six base WebMCP tools.
- A separate automated no-input 20-second baseline opened Tune plan and focused **1 · Copy request**. The arena displayed all three steps and kept **Replay baseline** secondary.
- Copy changed the deployed card to **COPIED — NOT SENT**, **Now paste it into chat and press Send**, and **Nothing is running yet. This page cannot send chat messages or change settings.**
- The user's original production tab remained unrefreshed with pending plan `plan-1e0ae83f818d`, the exact two proposed diffs, and the visible **Approve exact plan** gate. No approval or application was performed during this release.
- Post-deploy access remained custom and owner-only: one allowed owner account, zero external visitors, zero groups, zero workspace groups, and zero tenant groups.

## Boundaries

- Version 14 intentionally remains private and is not yet accessible to signed-out judges.
- The direct production trial in this release was automated, no-input interaction QA; it is not the user's preserved played baseline or a human outcome.
- A complete played-pair production lifecycle was not run on version 14. The latest complete deployed lifecycle remains the human-played version-12 record.
- `productionLifecyclePassed` therefore remains false for the version-14 release manifest.
- WebMCP-enabled Chrome, signed-out access, final video capture, independent judge comprehension, broader accessibility acceptance, and public release remain open.
