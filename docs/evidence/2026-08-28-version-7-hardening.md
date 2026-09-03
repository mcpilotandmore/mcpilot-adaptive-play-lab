# Version-7 hardening and private deployment record

Date: 2026-08-28, America/Los_Angeles

Scope: this record covers the exact version-7 application source, automated verification, packaging, authenticated production smoke, and access inspection. It does not claim a version-7 browser/WebMCP lifecycle, signed-out access, independent judge comprehension, or human accessibility acceptance.

## Exact application artifact

- Application commit: `05d3a807bd4aac6a3be43b31f8bec928cf647e76`
- Sites project: `appgprj_6a8f3d7aac148191a22887e505499bae`
- Live URL: `https://second-player-lab.asterai.chatgpt.site`
- Saved version: 7
- Version ID: `appgprj_6a8f3d7aac148191a22887e505499bae~appgver_6b97e6ed722c819187f55120f1a65230`
- Deployment ID: `appgdep_6a91d746127881918325c550cd2c45ff`
- Packaged archive hash: `sha256:22f0de4bdf4584411236277f86c52f3f28677dd0a246ddfb89ea4c120a6c3e69`

## Shipped changes

### Fail-closed persisted evidence

Restored `played` trials now have to satisfy relationships derived from the fixed course and runtime:

- fixed target total and collected/collision/expired arithmetic
- integral and bounded duration, input, collision, direction, and reaction fields
- idle time no greater than trial duration
- reaction count equal to collected targets, with each reaction time inside the trial duration
- direction counts totaling the input count and bounded direction changes
- score equal to the shared canonical scoring function
- movement and collision bounds compatible with the course and cooldown

The fictional sample must match the canonical sample payload and ID exactly. These checks reject corrupt or fabricated local records before they can become trusted comparison evidence; they do not prove who physically played a valid in-page trial.

### Player-owned manual edits

Changing a setting manually after an agent tune now closes that applied proposal's lineage and revokes its undo snapshot synchronously. A stale undo can no longer overwrite the player's newer manual choices.

### Consistent scoring

Live score, final score, and persisted score validation now use one canonical scoring function. Final scoring includes every uncollected course target as expired.

### Persistent WebMCP handoff

The page now keeps the agent handoff visible:

> Play → Agent proposes → You approve → Verify

It exposes a copyable intended prompt, a fast demo-evidence action, and the names of the six base tools. When WebMCP is unavailable, the page labels those names as a contract preview instead of presenting a misleading zero-tool product state. Nothing changes until the exact visible proposal is approved.

## Automated verification

`npm run verify` passed on the exact application commit:

- ESLint: PASS
- strict TypeScript: PASS
- deterministic tests: 51 of 51 PASS
- Vinext production build: PASS

New regression coverage includes:

- canonical score agreement
- rejection of impossible persisted played telemetry
- acceptance of a canonical played fixture
- rejection of a forged fictional sample
- acceptance of the canonical fictional sample
- revocation of stale undo after a later manual edit

A local release check at `http://localhost:4176/` returned:

- HTTP 200
- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`

## Private Sites deployment

The successful build was packaged, saved as Sites version 7, and deployed successfully. Authenticated HTTP smoke against the live URL returned:

- HTTP 200
- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`
- expected product headline present
- persistent WebMCP handoff marker present

Post-deploy access inspection remained unchanged:

- access mode: custom, owner-only
- current role: owner
- allowed account users: 1
- external visitors: 0
- workspace groups: 0
- tenant groups: 0

This deliberately preserves the existing private boundary. It is not judge-accessible until the entrant explicitly approves widening access and a signed-out check passes.

## Evidence not established here

- The complete WebMCP browser lifecycle was not rerun on version 7. The latest full deployed lifecycle trace remains version 6.
- Chrome still needs the WebMCP testing flag enabled before its full lifecycle can be evaluated.
- Signed-out access is not proven because version 7 remains owner-only.
- No real player accessibility session or human-audible output check was performed.
- No public repository, public video, or final Devpost submission was created.
