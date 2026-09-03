# Cold-judge review protocol

Run this once the public release candidate exists. Separate the film's first-impression test from the full three-URL review so the 15-second thesis score has one reproducible stimulus.

## Session rules

- Before timing begins, the facilitator silently verifies a fresh signed-out ChatGPT in-app browser or Chrome 149+ profile with `chrome://flags/#enable-webmcp-testing` enabled and confirms that WebMCP tools register. Do not reveal the product's tool count or state story.
- First-impression test: show only the public film from 0:00, stop at 0:15, and ask: **“What is the unusual mechanism?”** Record the first answer without replay or coaching.
- Full review: reset the timer, give the evaluator the live app, repository, and public video URLs, then allow 12 minutes. Do not answer product questions during the attempt.
- Default to an anonymous evaluator ID and written timestamps. Record only the app tab, and only with explicit permission; never collect a disability or health rationale, face, voice, notifications, unrelated tabs, or account details.
- Keep raw notes and any recording private, set a deletion date, and do not publish any image, voice, quote, or identifying detail without separate explicit permission for that exact use.
- Do not steer the evaluator toward approval, the check-in, the sample path, or a favorable answer.
- A confusing result is a product or presentation finding, not an evaluator failure.

## Observer-only checklist

Do not show this checklist during the timed attempt. Observe whether the evaluator:

1. states after the fixed 15-second film excerpt that player approval creates or changes an agent capability;
2. opens the app, video, and repository from the public links alone;
3. starts fresh and identifies how many tools are initially available;
4. explores far enough to explain who can propose, approve, play, answer the check-in, compare, and undo;
5. finds the evidence source, fixed course, exact setting changes, measured deltas, and verdict boundary; and
6. explains what the fictional sample can prove and what undo does not erase.

## Pass scorecard

| Gate | Pass condition | Result |
|---|---|---|
| Eligibility | All three public URLs open signed out; video is under 3:00 with explanatory audio; repository includes runnable source and a top-visible license | [PASS / FAIL] |
| Stage-one fit | Evaluator identifies a viable human-agent web app and sees WebMCP as genuinely required, working, and non-trivial | [PASS / FAIL] |
| 15-second thesis | Evaluator says, without prompting, that player approval changes the agent's available tools | [PASS / FAIL] |
| Human/agent boundary | Correctly assigns proposal and tool calls to the agent, but approval, play, and check-in to the person | [PASS / FAIL] |
| State legibility | Finds apply absent → added → removed, compare absent → added, and exact undo | [PASS / FAIL] |
| Evidence honesty | Understands played versus sample provenance and does not infer an unsupported accessibility outcome | [PASS / FAIL] |
| Recovery | Can return to the prior settings and understands that completed evidence remains | [PASS / FAIL] |
| Presentation | Can read the critical labels, proposal diff, result metrics, and captions at normal viewing size | [PASS / FAIL] |

Every scorecard row is release-blocking. The release passes only if all eight rows pass and there is no broken path or unsupported public claim.

## Rubric scoring

Score each area from 1–5 after the task, before discussing the intended design.

- **5:** immediate, specific, convincing, and independently demonstrated;
- **4:** clear and credible with only minor friction;
- **3:** understandable after effort, but incomplete or weakly evidenced;
- **2:** substantial confusion, breakage, or generic value; and
- **1:** absent, unusable, or unsupported.

| Criterion | Question | Score |
|---|---|---|
| WebMCP leverage | Would the core interaction lose its meaning if WebMCP were replaced by a generic chat overlay? | [1–5] |
| Execution | Did the complete loop work, remain legible, and recover cleanly? | [1–5] |
| Potential impact | Can the evaluator name a credible user and a broader reusable pattern without being prompted? | [1–5] |
| Creativity and ambition | Does capability-level approval feel memorable and technically substantive? | [1–5] |

Target: no score below 4 and a total of at least 18/20. Record the first reason given for every score below 5.

## Debrief questions

Ask these only after the timed attempt:

1. What is the one sentence you would tell another judge?
2. At any point, did you think the agent could approve, play, or answer for the player?
3. Which moment was most memorable?
4. What did you expect to happen that did not happen?
5. Which claim felt least supported?
6. If you could change one thing before judging, what would it be?

## Findings record

- Anonymous evaluator ID and exact consent scope: [PRIVATE RECORD]
- Raw-record deletion date: [DATE OR NO RECORDING]
- Date, browser, viewport, and device: [EXACT ENVIRONMENT]
- URL/access failures: [NONE OR EXACT FAILURE]
- 15-second answer: [VERBATIM OR PRECISE PARAPHRASE]
- First wrong turn and timestamp: [OBSERVATION]
- Rubric total: [SCORE / 20]
- Release-blocking finding: [NONE OR EXACT FINDING]
- Fix made and retest result: [CHANGE / RESULT]

Do not turn this one evaluator into a claim about all judges or all players. Use the session only to find ambiguity, breakage, claim mismatch, or presentation friction before the release freezes.
