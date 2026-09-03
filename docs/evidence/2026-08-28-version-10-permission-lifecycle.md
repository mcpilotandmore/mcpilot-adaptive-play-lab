# Version 10 permission-lifecycle record

Date: 2026-08-28, America/Los_Angeles

## Artifact

- Application commit: `5747f3cf411fc5b3af8217af9e2d3bcdbb66ea4f`
- OpenAI Sites version: 10
- Production URL: `https://second-player-lab.asterai.chatgpt.site`
- Archive hash: `sha256:895792f0c4b1cec8e7adab4dd7a3be684d25d4d0d09d18ef3d0e5b5099ecdb99`
- Access during verification: owner-only custom access; one allowed account user, zero external visitors, zero workspace groups, and zero tenant groups

## Product correction

Version 10 turns the hero's tool count into a live explanation of the permission model:

- `06 LIVE · APPLY ABSENT` before visible approval;
- `07 LIVE · APPLY ADDED` after the exact plan is approved;
- `07 LIVE · APPLY REMOVED · UNDO ADDED` after one use;
- `07 LIVE · COMPARE ABSENT` while played evidence waits for the player checkpoint; and
- `08 LIVE · COMPARE ADDED` after the visible player response.

The release also fixes two post-apply contradictions. Undo controls are disabled during countdown and play, and Undo now returns the arena to **Baseline trial** with **Start new baseline trial** while retaining the completed pair and the already-completed proposal/approval steps.

## Exact-source local lifecycle

The Codex in-app browser exercised the full automated played-pair lifecycle on the exact version-10 source at 1280×720:

- played baseline: `trial-5fda96d8-b50b-46b2-b810-558bb2aee583`;
- visible proposal: `plan-cd009e4cd15f`;
- visible approval changed the live surface from six tools to seven and added exact apply;
- exact apply activated the reviewed settings, removed itself, and added undo;
- the adapted trial kept both dock actions disabled while play was active;
- played adapted trial: `trial-8a6c9bf1-1421-478c-b503-6c0e816a278e`;
- before the visible checkpoint, inspect returned `metricsWithheld: true`, signal read rejected with `PLAYER_CHECK_IN_REQUIRED`, and compare was absent;
- a normal visible radio selection recorded **About the same** and added compare;
- comparison returned `played_pair`, `capturedVia: visible_player_ui`, and `needs_another_iteration` for the automated zero-gain trace; and
- exact undo restored all default settings, retained the completed evidence, removed undo, preserved a monotonic completed journey, and changed the next action to **Start new baseline trial**.

The first view was also checked at 390×844. The new missing-seventh-tool message remained visible and readable in the first mobile viewport.

## Deployed production lifecycle

The same automated played-pair sequence was repeated after private deployment on Sites version 10:

- baseline: `trial-68603e11-f098-4b05-834a-8afe44d45b4d`;
- proposal: `plan-0f8712a56bdf`;
- adapted: `trial-2b475fb7-1ed9-4c7f-872d-f9c77ee68613`;
- approval added exact apply; exact apply removed itself and added undo;
- pending inspect returned `evidenceGrade: played_pair`, `playerCheckInStatus: pending`, `metricsWithheld: true`, and `withholdingReason: pending_visible_player_check_in`;
- pending signal read rejected with `PLAYER_CHECK_IN_REQUIRED`;
- the visible **About the same** selection added compare;
- comparison returned `claimableOutcome: true`, `evidenceGrade: played_pair`, zero fabricated gains, zero hidden regressions, and `needs_another_iteration`;
- undo restored all eight default settings with `evidenceRetained: true`; and
- the resulting page showed seven tools, the completed proposal/approval/verify journey, and **Start new baseline trial**.

## Automated and production checks

- `npm run verify`: ESLint clean, strict TypeScript clean, 52 of 52 tests passed, Vinext production build passed.
- `npm run release:check -- http://localhost:4176/`: HTTP 200, `Origin-Agent-Cluster: ?1`, `Permissions-Policy: tools=(self)`.
- Authenticated production smoke: HTTP 200 with both required headers plus the hero, `APPLY ABSENT`, missing-seventh-tool, visible-human-gates, and agent-control-plane markers.
- Post-deploy Sites inspection: version 10 current and access still owner-only.

## Evidence boundary

Every browser action above was automated. The visible radio path proves capture through the player UI, not human identity, consent, benefit, or accessibility. The zero-gain result is intentionally reported as `needs_another_iteration`, not a successful accessibility outcome. Chrome-with-WebMCP, real-player acceptance, human-confirmed audio, signed-out judge access, the public repository, and the final narrated video remain open gates.
