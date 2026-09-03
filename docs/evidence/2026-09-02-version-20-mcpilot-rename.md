# Version 20 MCPilot private rename release

Scope: apply the entrant-selected **MCPilot Adaptive Interactive Play Lab** name across the application and submission materials, preserve compatibility identifiers and historical evidence, verify the exact source, and deploy it privately on 2026-09-02. This is branding and release evidence, not a new player trial, WebMCP lifecycle, accessibility outcome, or voice-acceptance result.

## Rename surface

- The header, footer, page title, application metadata, accessible labels, WebMCP product payload, optional voice guide, package identity, license attribution, README, Devpost draft, publication copy, and video plan now use the selected name.
- The voice guide is instructed to pronounce MCPilot as **M-C Pilot**.
- Internal `second-player-lab` storage, `second-player-preset/v1` exports, the established Sites URL, historical evidence URLs, and provenance identifiers remain unchanged.
- The legacy `public/og.png` social card still visibly says **SECOND PLAYER** and remains a public-name freeze blocker pending explicit asset-refresh authorization.

## Exact-source verification

- Application commit: `59ac4c8926149a2490fb43827f3e0460f8b28c66`
- `npm run verify`: PASS
  - ESLint: PASS
  - strict TypeScript: PASS
  - product tests: 65 of 65 PASS
  - total automated tests: 101 of 101 PASS
  - Vinext production build: PASS
- `npm run verify:clean`: PASS from the exact committed source

## Sites release receipt

- Private Sites version: 20
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_d7dee70536488191b4a3314055c56d18`
- Deployment ID: `appgdep_6a98fe94f3b88191a43a580b14cc45e8`
- Production URL: `https://second-player-lab.asterai.chatgpt.site`
- Sites project title: `MCPilot Adaptive Interactive Play Lab`
- Deployment status: succeeded
- Environment revision: 1
- Local package SHA-256: `30ef776f506ecdf1e3fc1f11ed46da346c4f04feed14d5c84f6b07009de6dd18`
- Sites archive-storage content hash: `sha256:7d658db6179791729334449f1f85e00d7b267a1715a35a6233557cbc924a5899`

Post-deploy access remained custom and owner-only with one allowed owner, zero external visitors, and zero workspace or tenant groups.

## Evidence boundary

- Version 20 received no new interactive browser acceptance pass.
- The latest authenticated UI/WebMCP/audio-sink smoke and owner-confirmed complete audible Realtime reply remain version 18.
- The latest complete human-played production WebMCP lifecycle remains version 12.
- Version 20 is still inaccessible to signed-out judges.
- The selected name has material collision risk with current MCP/AI projects. Public-name freeze remains false until the entrant accepts that risk or changes the name, and until the social card and final public artifacts match.
