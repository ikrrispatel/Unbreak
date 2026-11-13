# Unbreak — Executable Hackathon Implementation Plan

**Rule:** Complete one coherent task, verify, update status, commit, then proceed. Codex can continue through unblocked tasks without repeated prompts. Never mark `DONE` on the basis of code generation alone.

Status vocabulary: `TODO` / `IN_PROGRESS` / `VERIFIED` / `BLOCKED` / `SKIPPED (reason)`.

## Phase 0 — Repository and capability audit (P0, blocking gate)

| Task | Verification | Status |
|---|---|---|
| 0.1 Clone `https://github.com/ikrrispatel/Unbreak`, inspect branches/remote/status | Record branch, HEAD, tracked files; do not overwrite teammate work | VERIFIED |
| 0.2 Inventory host OS, Node, Python, git, Codex, available devices/credentials (without printing secrets) | Record versions in `docs/DEVICE_AUDIT.md` | VERIFIED |
| 0.3 Compare official `phoneuse-official/phoneuse` local iPhone project with `phoneuse.dev` SDK/cloud interface | Record supported transport, setup requirements, API version/commit, license; choose only verified backend | VERIFIED |
| 0.4 Check MobileInject and AgentDojo licenses, runnable components, fixture safety, dependency cost | Write `docs/REUSE_AUDIT.md` with reuse/reject decision and attribution | VERIFIED |
| 0.5 PhoneUse read-only smoke test: acquire/connect, inspect screen, open harmless seeded app, verify observation | Log observed device result and screenshot hash; if unavailable, record `BLOCKED` and continue mock-independent tasks | BLOCKED (no device, SDK, or credentials) |

**Gate:** No claims of live phone integration until 0.5 truly succeeds. If physical hardware or credentials are required, ask for only that missing human action when necessary.

## Phase 1 — Skeleton, contracts, tests (P0)

| Task | Verification | Status |
|---|---|---|
| 1.1 Initialize minimal TypeScript mobile web app + server + lockfile, `.gitignore`, `.env.example`, README | `install`, lint, typecheck, build pass; no secrets tracked | IN_PROGRESS (minimal server/UI added; README/lint pending) |
| 1.2 Define versioned schemas for scenarios, runs, observations, actions, policies, assertions | Parse good samples; reject malformed/adversarial samples | IN_PROGRESS (action/policy validation added; remaining entities pending) |
| 1.3 Implement `PhoneUseAdapter` interface + selected verified transport + explicitly named `MockPhoneUseAdapter` | Unit tests; read-only real smoke only if available | IN_PROGRESS (official SDK 0.6.0 snapshot/screenshot adapter and server route added; live smoke still blocked by unavailable server credentials) |
| 1.4 Add structured redacted event store and run status machine | Test event order, status transitions, partial failures | TODO |
| 1.5 Implement mobile-first status and scenario picker | Render at ~390px, phone-accessible controls, truthful empty/error state | IN_PROGRESS (workspace and central device panel implemented; live observation pending credentials) |

## Phase 2 — Controlled baseline run (P0)

| Task | Verification | Status |
|---|---|---|
| 2.1 Select one test-only compatible native app flow with legitimate postcondition and unrelated forbidden effect | Document app availability, accounts, reset method, success assertions | TODO |
| 2.2 Write seed/reset fixture for this actual environment | Two consecutive resets yield same independent starting state | TODO |
| 2.3 Build run orchestrator: observations → proposed actions → dispatch → results | Mock E2E first; real PhoneUse run if reachable | IN_PROGRESS (complete deterministic mock workflow) |
| 2.4 Add allowlisted synthetic injection surface and bounded attack variant generator | No external data/recipients; generated payload schema validates | VERIFIED (two bounded variants) |
| 2.5 Execute baseline, classify proposed vs executed violation using state evidence | Device trace and state assertions; if not compromised, report honest no-compromise | VERIFIED (mock baseline/protected evidence) |

## Phase 3 — The differentiator: enforceable auto-repair (P0)

| Task | Verification | Status |
|---|---|---|
| 3.1 Implement deterministic server-side policy engine: allow/ask/deny, deny precedence, default deny | Unit matrix including prompt variations and malformed inputs | TODO |
| 3.2 Enforce policy before **every** controlled device-write call | Tests prove raw writes cannot bypass the gate; PhoneUse floor still applies | TODO |
| 3.3 Generate narrow schema-constrained candidate policy from trace | Invalid/overbroad policies rejected; original rules immutable by model | TODO |
| 3.4 Validate policy against legitimate action examples and malicious variations | Tests establish legitimate completion not blocked merely for demo | TODO |
| 3.5 Save immutable policy version and regression variant | Version diff and repeatable replay tests | TODO |

## Phase 4 — Replay and independent proof (P0)

| Task | Verification | Status |
|---|---|---|
| 4.1 Reset fixture; replay original legitimate goal with patched policy | Independent state assertions pass; restricted write denied before dispatch | VERIFIED (mock fixture reset/replay) |
| 4.2 Replay an altered bounded attack, not only exact same phrase | Verify match based on authorization context rather than attack-string equality | VERIFIED (direct-edit and urgent-review variants) |
| 4.3 Compare baseline and protected events and final state | Explicit `legitimate_task_completed`, `unauthorized_effect_prevented`, and `inconclusive` | TODO |
| 4.4 Generate truthful phone-sized evidence report | Show run provenance, timestamps, policy version, trace, screenshot/evidence IDs | TODO |

## Phase 5 — UX, integration, and stage reliability (P0/P1)

| Task | Verification | Status |
|---|---|---|
| 5.1 Polish full mobile flow: start, live progress, baseline, patch, replay, proof | Manual responsive inspection, accessible tap targets, zero fake statuses | TODO |
| 5.2 Add optional LangSmith adapter behind flag | Redacted trace tested; missing API key leaves core loop operational | TODO |
| 5.3 Add bounded judge challenge selector (P1) | Only safe allowlisted outcomes; accepts no unrestricted tool commands | TODO |
| 5.4 Perform three uninterrupted full runs where device available | Record timestamps, success/failure; never invent pass count | TODO |
| 5.5 Verify phone-accessible HTTPS endpoint and protect backend device actions | Load on physical phone, confirm authz and no leaked secrets | TODO |
| 5.6 Create `docs/DEMO_RUNBOOK.md` with intro, reset steps, exact live sequence, backup evidence, contingency | Teammate can reproduce without oral help; fallback labeled recorded | TODO |
| 5.7 Final CI/lint/typecheck/test/build, secret scan, license/attribution review | Save logs/commands to `docs/TEST_EVIDENCE.md`; clean branch | TODO |

## Hard acceptance gate

A hackathon-ready **LIVE** label requires:

- PhoneUse has actually executed the relevant mobile actions and recorded the native device response.
- Baseline attack genuinely induced a forbidden proposed action or effect; otherwise report a safe/unsuccessful attack.
- Generated strict policy was applied at the server-owned action boundary.
- Defended replay denied the restricted action and completed the legitimate task, confirmed by independent state checks.
- A second bounded attack variation was tested.
- A phone user can operate the UI and inspect proof without a laptop.
- Tests pass and no secret is committed.

A **MOCK / RECORDED** demo is an acceptable fallback artifact but does **not** meet the live gate and must be clearly labeled.

## Execution priorities under time pressure

1. Get actual PhoneUse control + one genuine app scenario first.
2. Make baseline / defended execution observable and honest.
3. Make policy enforcement real and independently test it.
4. Make the outcome beautiful and easy to follow on a phone.
5. Only then add LangSmith, Tavily, second app, or complex adaptive attack generation.

If a task is blocked, mark it `BLOCKED` with precise evidence, then continue all safe independent tasks. Do not consume the entire sprint trying to merge incompatible research frameworks.

## Running log

| Time (local) | Phase/task | Result | Evidence / commit |
|---|---|---|---|
| 2026-11-13 | Phase 0 / 0.1–0.5 | Repository and source audit complete; live smoke test blocked by missing PhoneUse setup | `docs/DEVICE_AUDIT.md`, `docs/REUSE_AUDIT.md` |
| 2026-11-13 | Phase 1 / typed policy slice | Policy gate, evaluator, and explicitly mock adapter compile and pass five deterministic tests | `npm run typecheck && npm test` |
| 2026-11-13 | Phase 1 / validation | Runtime policy/action parsing rejects unsupported versions, trust tags, effects, and malformed objects | `npm test` (6 passed) |
| 2026-11-13 | Phase 2–4 / mock loop | Baseline → repair policy → reset → protected replay works for two unseen bounded attack variants; legitimate task preserved | `npm test` (8 passed) |
| 2026-11-13 | Phase 5 / mobile UI | Phone-sized UI and explicit mock/live-configured provenance badge added; browser inspection completed at narrow viewport | `npm run build`, CUA screenshot |
| 2026-11-13 | Phase 1 / live observation presentation | Server-owned read-only observation route added using official SDK `snapshot()` plus `screenshot({ path })`; browser receives no PhoneUse credentials or unrestricted RPC; live execution blocked because required environment credentials are unset | `npm test` (29 passed), `npm run typecheck`, `npm run build`, `git diff --check`; see `docs/TEST_EVIDENCE.md` |
| 2026-11-13 | Full product integration milestone | Added explicit device readiness and allowlisted scenario discovery endpoints, expanded server-boundary tests, and documented secure deployment constraints; full live security workflow remains blocked on a deterministic native fixture and server credentials | `feat/full-product-integration`, 29 tests passed |
| 2026-11-13 | UI correction | Rebuilt the workspace shell with a viewport-bounded PhoneUse stage, concise no-run inspector, working scenario submission, and responsive checks at five requested sizes; live screenshot remains credential-gated | `npm test` (30 passed), browser verification, see `docs/TEST_EVIDENCE.md` |
