# Version-13 visible WebMCP redesign and private deployment

Scope: competition-presentation redesign, exact-source verification, private deployment, and a bounded production WebMCP smoke on 2026-09-01. The production smoke used an automated DOM approval and was canceled without applying the tune. It is not human consent, a human outcome, an accessibility result, a complete lifecycle, or final film evidence.

## Exact artifact

- Application commit: `b004a29f23c7d70ec69306513321446b1310adf9`
- Owner-only OpenAI Sites version: 13
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Local package SHA-256: `e6bb650ea5dbd0e6047f236ed735b1f4b0c8a78ef0f01c4d2fd8773f39cb6b98`
- Sites archive-storage content hash: `sha256:baf206077da8dd46c535ecfdc508f12c210c029f059bbb9297bc982d3794e653`

The local tar hash and Sites storage hash describe different representations and are recorded separately.

## What changed

- The first fold now exposes the actual registered WebMCP inventory instead of narrating hidden state.
- The causal receipt reads **Apply absent → Player approves → Apply registered**, while the live inventory supplies the truthful current ordinal on every cycle.
- Real site-tool calls and capability registrations create prominent one-shot activity events in both the handoff and game arena.
- The copy handoff shows the exact selectable request and states that copying does not send a chat message.
- Apply, compare, and undo slots appear only when those capabilities are present in the browser registry.
- Manual application is visually demoted to a fallback; the WebMCP handoff is the primary path.
- The game arena was rebuilt around a cinematic orbital-deck environment, a spacecraft, signal beacon, hazards, motion layers, and adapted-run treatment.
- Mobile scrolling, held keyboard controls, player-check-in focus safety, tab semantics, forced colors, reduced motion, and visible programmatic focus were hardened.

## Visual asset provenance

The runtime backdrop is `public/signal-run-arena-v1.webp` (1536 by 864, 180,426 bytes). Its generated source was retained outside the repository during asset preparation and is not part of the public release.

Image-generation prompt summary: create an original premium 16:9 top-down/slightly isometric orbital training deck above a starfield, with deep navy materials, cobalt energy lanes, mint architectural edges, restrained coral hazards, and a dark uncluttered central play field; include no text, interface, logos, watermark, characters, or baked gameplay objects. The generated PNG was visually inspected, then converted with Sharp to the optimized WebP used by the site.

## Verification before deployment

- `npm run verify`: PASS — ESLint, strict TypeScript, all 56 product tests (92 automated tests total), and the Vinext production build.
- `git diff --check`: PASS.
- Local release probe: HTTP 200, `Origin-Agent-Cluster: ?1`, and `Permissions-Policy: tools=(self)`.
- `npm run verify:clean`: PASS from a Git archive of exact application commit `b004a29f23c7d70ec69306513321446b1310adf9`, including lockfile install, 92 tests, and production build.
- Local in-app-browser lifecycle smoke: real WebMCP calls loaded fictional sample evidence, proposed a bounded tune, registered Apply after an automated visible approval, applied the exact revision, replaced Apply with Undo, and restored the prior settings. This was automated fictional QA, not player evidence.
- Independent read-only code audits found and then rechecked fixes for repeat-key check-in safety, cycle-independent capability labeling, focus visibility, mobile scrolling, forced colors, reduced motion, dynamic capability truth, and clipboard fallback.

## Production smoke

- The pushed source SHA, saved Sites-version source SHA, and application commit all matched `b004a29f23c7d70ec69306513321446b1310adf9`.
- Authenticated HTTP returned 200 with `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, the product title, and the new approval headline.
- The signed-in in-app browser exposed the six base tools and rendered the same six tools in the visible inventory.
- A bounded proposal against the preserved played baseline was approved by browser automation solely to verify registration. The actual browser inventory became seven tools, the Apply slot appeared, and the page displayed **Apply capability registered**.
- The smoke proposal was canceled immediately. Apply disappeared, the proposal returned to `null`, and preserved baseline `trial-1fde6125-3cbf-4713-bd1f-2a63ea4724db` remained unchanged.
- Post-deploy access remained custom and owner-only: one allowed owner account, zero external visitors, zero groups, zero workspace groups, and zero tenant groups.

## Boundaries

- Version 13 intentionally remains private and is not yet accessible to signed-out judges.
- A complete played-pair production lifecycle was not rerun on version 13. The latest complete deployed lifecycle remains the human-played version-12 record.
- `productionLifecyclePassed` therefore remains false for the version-13 release manifest.
- WebMCP-enabled Chrome, signed-out access, final video capture, independent judge comprehension, broader accessibility acceptance, and public release remain open.
