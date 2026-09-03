# Version-16 hazard encounters and private deployment

Scope: make the three generated hazards feel like distinct game encounters, preserve the fixed collision course and consent-gated WebMCP lifecycle, verify the exact source, and deploy it privately on 2026-09-02. This is presentation and release evidence, not a new player trial, accessibility outcome, WebMCP lifecycle, or final-film result.

## Exact artifact

- Application commit: `556d604e12ecef4d1cac7aa553bda64288a73ecc`
- Owner-only OpenAI Sites version: 16
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Local package SHA-256: `6259edf1fc14d56dc6775f3d15efc5e9abd54fcc931c84af59ad15ff3d91591e`
- Sites archive-storage content hash: `sha256:d99eddded051d3d827c431969be64d49494b64e7796b25b542a2bed147e78961`

The local tar hash and Sites storage hash describe different representations and are recorded separately.

## What changed

- A compact **THREAT INDEX** introduces Rift Spire, Pulse Mine, and Static Thorn with their artwork and a plain-language shape cue before the first run on sufficiently wide screens.
- Each hazard now has a distinct restrained effect: Rift Spire surges vertically, Pulse Mine emits expanding rings, and Static Thorn carries an asymmetric electrical arc.
- A collision illuminates the exact impacted hazard and briefly names it in a centered **COLLISION // IDENTIFIED** callout. The same name is added to the polite screen-reader status.
- Hazard labels combine the unique name and shape cue. The toolbar now accurately calls them three named anomalies instead of three red anomalies.
- The pre-run dossier is hidden at compact widths where it could overlap the primary instruction card.
- The frozen `PLAY_COURSE` hazard geometry and collision loop were not changed. Outer frames remain the rectangular, axis-aligned collision zones; all generated art and effects stay clipped inside them.

## Accessibility and motion boundaries

- Reduced-motion and no-motion modes stop the new hazard effects, impact animation, and art response. Pulse Mine retains a static ring cue when motion is stopped.
- Monochrome applies grayscale treatment while retaining names, glyphs, and silhouettes.
- Forced-colors hides raster art and decorative effects but keeps each visible text glyph. Rift Spire, Pulse Mine, and Static Thorn also receive distinct system-color border and internal-marker grammar without changing their rectangular hitboxes.
- The encounter effects are CSS presentation. Gameplay still uses the three single-frame WebPs generated for version 15; no video or animated raster was added to the play loop.

## Verification before deployment

- The hazard-presentation contract checks one unique name, variant, image, and plain-language cue for every immutable hitbox.
- `git diff --check`: PASS aside from the repository's existing Windows line-ending notices.
- `npm run verify`: PASS — ESLint, strict TypeScript, all 93 automated tests, and the Vinext production build.
- `npm run verify:clean`: PASS from a Git archive of exact application commit `556d604e12ecef4d1cac7aa553bda64288a73ecc`, including lockfile installation with zero reported vulnerabilities, 93 tests, and the production build.
- A separate read-only responsive and accessibility source audit caught and closed the compact-width dossier overlap, reduced-motion omissions, forced-color identity loss, and a circular-frame collision-truth regression before release.

## Production smoke

- The pushed source SHA, saved Sites-version source SHA, and application commit all matched `556d604e12ecef4d1cac7aa553bda64288a73ecc`.
- Authenticated production HTTP returned 200 with `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`.
- The production HTML contained `THREAT INDEX`, all three hazard names, and the revised named-anomalies instruction.
- Authenticated production asset requests returned 200 for all three hazard WebPs, with the same byte sizes as version 15: Rift Spire 155,352 bytes, Pulse Mine 125,652 bytes, and Static Thorn 68,134 bytes.
- Post-deploy access remained custom and owner-only: one allowed account, zero external visitors, and no allowed groups.

## Boundaries

- Version 16 intentionally remains private and is not yet accessible to signed-out judges.
- Source, build, archive, deployment, headers, HTML markers, and asset responses were checked. No fresh browser screenshot or human visual-acceptance pass was performed for the version-16 arena.
- A complete played-pair production lifecycle was not rerun on version 16. The latest complete deployed lifecycle remains the human-played version-12 record.
- `productionLifecyclePassed` therefore remains false for the release manifest.
- Final name, public access, public repository, narrated public video, Chrome WebMCP lifecycle, signed-out checks, and final submission remain open.
