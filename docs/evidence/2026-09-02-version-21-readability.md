# Version 21 readability release

Date: 2026-09-02, America/Los_Angeles

## Scope

Version 21 strengthens the existing visual hierarchy without changing product behavior. Critical actions now use a 14 px text floor; the live WebMCP capability receipt, Realtime states and captions, copied-request handoff, game controls, evidence panels, and settings drawer use larger text, more comfortable line height, reduced small-label tracking, and brighter muted colors. Decorative arena coordinates and compact glyphs remain intentionally small.

Mobile check-in choices now use a two-column layout with taller targets, and the WebMCP next-action card collapses to one column so its action label remains readable. No gameplay, WebMCP registration, permission, evidence, or Realtime authority logic changed.

## Exact-source verification

- Application commit: `cb7f19545b1c22bb32003435a5655459ea2945c9`
- `npm run verify`: PASS — ESLint, strict TypeScript, 101 automated tests, and the Vinext production build
- `npm run verify:clean`: PASS from a clean archive of the exact commit
- Sites source branch after push: `main` at `cb7f19545b1c22bb32003435a5655459ea2945c9`
- Local deployment archive SHA-256: `71bd48b664353e02241990c7fe60723fe7315e4e9190366514939f3bd289498f`
- Sites archive content hash: `sha256:7ac18f0e700463a564d097ca3ac4f1858c2d485ba038177ea6a5777a432615b3`

## Private deployment

- Site: `https://second-player-lab.asterai.chatgpt.site`
- Saved Sites version: 21
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_eefb5823bbb48191a3194a18244c00f9`
- Deployment ID: `appgdep_6a9907ede4c081918b8bc131eae595e5`
- Deployment status: `succeeded`
- Access before deployment: `custom`, current user `owner`, one allowed account, zero external visitors, zero groups
- Access policy was not changed during this release.

## Evidence boundary

No new interactive browser, independent comprehension, signed-out, audio, or complete lifecycle pass was run for version 21. The current proof for authenticated live UI/WebMCP/audio-sink behavior and the owner-confirmed audible Realtime reply remains version 18. The current complete human-played production WebMCP lifecycle remains version 12.
