# Version 19 trial-copy and final-day release

Scope: replace the awkward arena objective with direct player-facing language, add a deadline-first competition checklist, verify the exact source, and deploy it privately on 2026-09-02. This is presentation and release evidence, not a new player trial, WebMCP lifecycle, accessibility outcome, or voice-acceptance result.

## Product change

- The arena objective now reads: **Collect mint signals while avoiding anomalies.**
- Hazard identities, silhouettes, collision geometry, effects, scoring, telemetry, and capability behavior are unchanged.
- The final-sprint document now starts with the mandatory submission path so optional QA cannot displace the official deliverables.

## Exact-source verification

- Application commit: `28de1abeb463a1ba5545cd7a1c1f246d441c122f`
- `npm run verify`: PASS
  - ESLint: PASS
  - strict TypeScript: PASS
  - product tests: 65 of 65 PASS
  - total automated tests: 101 of 101 PASS
  - Vinext production build: PASS
- `npm run verify:clean`: PASS from the exact committed source

## Sites release receipt

- Private Sites version: 19
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_098009e8c4988191a244f3cb251887e0`
- Deployment ID: `appgdep_6a98fa1d04f08191956837af46098055`
- Production URL: `https://second-player-lab.asterai.chatgpt.site`
- Deployment status: succeeded
- Environment revision: 1
- Local package SHA-256: `9155368798010167b1525ca4457d4c3b4fb45eb0e57c677191bac0e111ec3f17`
- Sites archive-storage content hash: `sha256:c87ad14a35c5babdf834e85e5e94b7aa1444f6f8a30928bd175b63303a1c371a`

Post-deploy inspection showed custom owner-only access, one allowed owner, zero external visitors, and zero workspace or tenant groups.

## Evidence boundary

- Version 19 received no new interactive browser acceptance pass.
- The latest authenticated UI/WebMCP/audio-sink smoke and owner-confirmed complete audible Realtime reply remain version 18.
- The latest complete human-played production WebMCP lifecycle remains version 12.
- Version 19 is still inaccessible to signed-out judges and cannot be entered as the final judge URL until the public-access and voice-cost decision is resolved.
