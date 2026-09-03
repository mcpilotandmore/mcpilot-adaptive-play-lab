# Version-15 distinct hazard identities and private deployment

Scope: replace the repeated striped collision blocks with three unmistakable hazard identities, preserve gameplay and accessibility truth, verify the exact source, and deploy it privately on 2026-09-01. This is presentation and release evidence, not a new player trial, WebMCP lifecycle, accessibility outcome, or final-film result.

## Exact artifact

- Application commit: `78d92880b9aa2053063645e4583def38c20dec01`
- Owner-only OpenAI Sites version: 15
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Local package SHA-256: `f033701e7a48c7e49a9c6709bbeb392fe2a22999f8010a53abd5c8c31ad6e2cc`
- Sites archive-storage content hash: `sha256:8e68611392e6ffb402f4a280329ce5bc9156c2d7f2305caeba41b8d0c407c358`

The local tar hash and Sites storage hash describe different representations and are recorded separately.

## What changed

- The three formerly identical striped blocks are now **Rift Spire**, **Pulse Mine**, and **Static Thorn**.
- Each hazard has a distinct silhouette, short visible glyph, screen-reader label, accent, and timing signature.
- The assets were generated as separate deterministic-seed images in local ComfyUI 0.24.0 with `juggernautXL_ragnarokBy.safetensors`, then alpha-cleaned and optimized as static WebPs.
- The complete prompts, negative prompt, model, seeds, and sizes ship in `public/hazards/manifest.json`; `npm run art:hazards` owns the reproducible local pipeline.
- Generated artwork is mapped separately from the frozen course definition. The three `x`, `y`, `w`, and `h` collision rectangles did not change.
- The visible outer frame now represents the exact axis-aligned collision rectangle. Only the clipped inner art receives the decorative angle, eliminating the prior rotated-frame mismatch with collision math.
- Reduced-motion and no-motion modes stop all hazard animation. Monochrome keeps the three silhouettes with grayscale treatment and redundant glyphs. Forced-colors hides the raster art and leaves the system-colored dashed collision frames.
- Gameplay uses single-frame assets; no generated video or animated WebP was placed inside the trial.

## Verification before deployment

- Direct inspection confirmed three different source images with transparent backgrounds and strong small-size silhouettes.
- Asset metadata: Rift Spire `420×700`, Pulse Mine `700×420`, Static Thorn `420×700`; each has alpha and no animation chunk.
- The course test now locks the exact three hitbox records and checks a unique name, variant, and static WebP for every hazard.
- `git diff --check`: PASS aside from the repository's existing Windows line-ending notices.
- `npm run verify`: PASS — ESLint, strict TypeScript, all 93 automated tests, and the Vinext production build.
- `npm run verify:clean`: PASS from a Git archive of exact application commit `78d92880b9aa2053063645e4583def38c20dec01`, including lockfile installation with zero reported vulnerabilities, 93 tests, and the production build.

## Production smoke

- The pushed source SHA, saved Sites-version source SHA, and application commit all matched `78d92880b9aa2053063645e4583def38c20dec01`.
- Authenticated production HTTP returned 200 with `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`, and the new arena instruction.
- Authenticated asset requests returned 200 and the exact expected byte sizes: Rift Spire 155,352 bytes, Pulse Mine 125,652 bytes, and Static Thorn 68,134 bytes.
- Post-deploy access remained custom and owner-only: one allowed owner account, zero external visitors, and no workspace or tenant groups.

## Boundaries

- Version 15 intentionally remains private and is not yet accessible to signed-out judges.
- The generated source assets and deployed responses were checked, but no fresh browser screenshot or human visual-acceptance pass was performed for the integrated version-15 arena.
- A complete played-pair production lifecycle was not rerun on version 15. The latest complete deployed lifecycle remains the human-played version-12 record.
- `productionLifecyclePassed` therefore remains false for the release manifest.
- Final name, public access, public repository, narrated public video, Chrome WebMCP lifecycle, signed-out checks, and final submission remain open.
