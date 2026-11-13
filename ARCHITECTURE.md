# Unbreak — Architecture and Integration Boundaries

**State:** Proposed target architecture for an empty repository. This is not a claim that these components exist or have passed tests. Revise after actual PhoneUse smoke testing.

## 1. Principle

PhoneUse is the **sole phone execution engine**. Unbreak owns adversarial scenario selection, action authorization, policy generation/validation, state verification, evidence, and mobile-first UX. An LLM may *propose* an action or rule, but only Unbreak's policy engine can authorize a restricted device action.

Never assume PhoneUse Local (`phoneuse-official/phoneuse`, Mac + USB iPhone + WDA) and the separate `@phone-use/sdk` / cloud emulator products share implementation or API semantics. Select **one verified transport**, implement an adapter for that transport, and record its version/commit.

## 2. Proposed stack (verify before installation)

- **Frontend:** Next.js + TypeScript + Tailwind CSS, responsive/mobile-first, accessible UI. Use a lightweight chart/diff component only if useful.
- **Backend:** Next.js server routes or a minimal Node/TypeScript service; keep device control, API keys, and policy engine server-side. A separate Python worker is *optional* only if a proven reuse requires Python.
- **Validation:** Zod / JSON-schema equivalents; typed models for decisions and reports.
- **Persistence:** SQLite for local hackathon MVP via a lightweight ORM; no database is required for the very first smoke test. Consider JSON fixtures for deterministic test setup, but do not use mutable JSON files as a multiuser database.
- **LLM:** Pluggable model adapter with strict structured outputs and timeouts; no provider-specific commitment until credentials verified.
- **Tracing:** Structured internal event log first, optional LangSmith integration behind a feature flag.
- **Execution:** One verified PhoneUse backend. Prefer official `@phone-use/sdk` if installed/working in this environment; otherwise the official local PhoneUse REST/MCP API if physical-iPhone prerequisites are met. Verify API methods, no invented SDK calls.
- **Deployment:** Phone-accessible UI served over trusted HTTPS for judging; device control stays in a protected worker reachable only by the application server. If local device access is needed, use a secure tunnel only after reviewing access controls.

## 3. Directory proposal

```text
Unbreak/
  PRD.md
  ARCHITECTURE.md
  AI_RULES.md
  PLAN.md
  README.md
  .env.example
  .gitignore
  package.json
  src/
    app/                    # mobile pages + server routes
    components/             # status, run viewer, proof cards
    domain/
      types.ts              # versioned run/scenario/policy schemas
      policy.ts             # pure decision engine
      evaluator.ts          # paired state assertions
      scenarios.ts          # allowlisted test scenarios
    server/
      adapters/phoneuse/    # selected PhoneUse transport only
      orchestration/        # run > attack > diagnose > patch > replay
      models/               # structured LLM calls + validation
      evidence/             # event persistence, redaction, trace linking
      persistence/          # DB access
    tests/
      unit/
      integration/
      fixtures/
  scripts/
    smoke-phoneuse.*       # non-destructive device probe
    reset-fixture.*        # specific to verified test app
    verify-demo.*          # scripted acceptance checks
  docs/
    DEVICE_AUDIT.md        # observed backend/device/app capabilities
    REUSE_AUDIT.md         # dependency/license review
    DEMO_RUNBOOK.md        # exact commands, reset, fallback, timing
    TEST_EVIDENCE.md       # commands/results/timestamps/limitations
```

Adapt paths to the chosen framework rather than preserving a decorative tree. Avoid spawning extra services without a demonstrated need.

## 4. Trust and action boundaries

```text
Mobile UI (untrusted user input)
  -> Server API [authenticate + authorize + validate]
  -> Run orchestrator [bounded scenario + controlled state]
     -> Attack generator [untrusted, schema-constrained]
     -> Agent planner [proposed actions, NOT device permissions]
     -> ACTION GATE [server-controlled allow / ask / deny]
        -> PhoneUse adapter [sole device execution]
           -> Phone app / sandboxed fixture
     -> Observation + state assertions [independent evaluator]
     -> Candidate policy generator [schema-constrained]
     -> Policy validation + replay
  -> Redacted evidence store / optional LangSmith
  -> Mobile proof card
```

**Security property:** Every device write belonging to an Unbreak-controlled run must pass `authorize(context, proposed_action)` *before* reaching PhoneUse. Do not allow a direct raw PhoneUse action path accessible to the planner or browser that bypasses the gate. PhoneUse's own permission floor remains an additional check; Unbreak cannot bypass it.

**Provenance:** Every planned write records source content IDs / trust classification (`user_direct`, `trusted_scenario`, `untrusted_app_content`, `agent_inference`), target app/resource, purpose, decision, and applied policy ID. These labels are evidence annotations, not magical precise information-flow tracking: do not claim formal taint tracking if provenance is inferred by an LLM.

## 5. Core entities

- `Scenario`: id, title, legitimateGoal, forbiddenEffect, supportedBackend, apps, seedFixture, resetProcedure, validationSpec, allowedActions, variationStrategy.
- `Run`: id, scenarioId, mode (`baseline|protected`), status, backend, deviceIdHash, policyVersion, createdAt, finishedAt, reason.
- `Observation`: id, runId, timestamp, sourceApp, screenHash, redactedText, screenshotRef, evidenceType.
- `ProposedAction`: id, runId, timestamp, actionType, target, argsRedacted, originatingObservationIds, trustTags, intendedPurpose.
- `PolicyDecision`: actionId, decision (`allow|ask|deny`), policyRuleId, reason, timestamp, dispatched, deviceResult.
- `Policy`: id, version, scope, conditions, effects, rationale, generatedBy, validationStatus, approvedAt.
- `StateAssertion`: runId, predicateId, expected, observed, source (`device|fixture|manual`), outcome (`pass|fail|inconclusive`), timestamp.
- `Evidence`: runId, eventId, kind, ref, redactionStatus, createdAt.
- `RegressionCase`: id, scenarioId, variantId, policyVersion, expectedBlockedAction, expectedLegitimateOutcome, lastResult.

Prefer relational integrity between runs, actions, policies, and assertions. Persist model request metadata (not sensitive raw prompts) for reproducibility.

## 6. API design (proposed; server-only device execution)

- `GET /api/health`: service readiness, no secrets.
- `GET /api/device/capabilities`: sanitized actual backend/device/app probe; never expose credentials.
- `GET /api/scenarios`: supported allowlisted scenarios.
- `POST /api/runs`: accepts validated `{scenarioId, mode, attackVariantId?}`; returns run ID; requires authorization and rate limit.
- `GET /api/runs/:id`: bounded status + redacted evidence summaries.
- `GET /api/runs/:id/events`: sanitized chronological events; SSE optional.
- `POST /api/runs/:id/patch`: generate/validate candidate policy; never auto-grant permission without checking scope.
- `POST /api/runs/:id/replay`: reinitialize allowed test fixture and run under versioned policy.
- `GET /api/runs/:id/report`: mobile-friendly result and exportable redacted JSON.

Never expose an arbitrary `POST /tap`, raw shell, arbitrary URL fetch, or unfiltered PhoneUse RPC on the public interface.

## 7. Policy grammar

Use a typed, bounded JSON rule schema (not executable Python/YAML generated by an LLM). Suggested shape:

```json
{
  "version": 1,
  "scope": {"scenarioId": "demo-1", "app": "target-app"},
  "match": {"actionType": "write", "targetClass": "restricted-record", "sourceTrust": "untrusted_app_content"},
  "effect": "deny",
  "reason": "External content cannot authorize an unrelated restricted write"
}
```

The engine defaults to `deny` for unrecognized restricted writes. `ask` is not a bypass; it requires verified human approval where permitted. Reject any policy that weakens a higher-level rule, broadens scope silently, or cannot be parsed. Include safe policy version rollback.

## 8. Baseline versus defended evaluation

- Baseline is run under a documented permissive policy **only in an isolated, synthetic environment** to test the vulnerability. The run still respects PhoneUse hard denials and user authorization.
- Reset to seed state before defended replay; log state hashes/IDs before and after.
- Protected mode enforces new policy and attempts a separate bounded malicious variation.
- **Independent result** = `unauthorized_effect_prevented` AND `legitimate_task_completed`. A blocked action without task completion is not a full pass.
- If the baseline never proposed a bad action, the attack is **unsuccessful**, not a discovered vulnerability.
- If the protected agent never encountered attack content, mark the protection test **inconclusive**.
- Record `proposed`, `blocked`, `executed`, and `verified-effect` as different facts.

## 9. Error handling and operational behavior

- Explicit device acquisition states: `not_configured`, `connecting`, `ready`, `degraded`, `offline`.
- Timeout and cancellation on all model and device requests; exponential backoff only for safe idempotent reads.
- No blind retries on taps/writes; re-observe the screen and assert preconditions before any retry.
- Make reset and replay idempotent or emit `RESET_REQUIRED` with manual instructions.
- Persist partial run evidence even on failure, including exact phase, exception category, and remediation.
- Never treat an LLM's response text as proof of UI state. PhoneUse action result + independent postcondition both matter.
- Internal logs include trace IDs, duration, backend version, run status; redact content by default.

## 10. Authentication, payments, external services

- **MVP auth:** A server-side demo access token or single-operator session is enough; avoid public unauthenticated device control. Never commit tokens.
- **Payments:** None. Do not implement a billing flow.
- **PhoneUse:** Mandatory for an authentic end-to-end run, with one verified transport.
- **LLM:** Required for adaptive payload/policy generation, but all generated results schema-validated and gate-controlled.
- **LangSmith:** Optional telemetry if valid credentials; no blocker for core functionality.
- **Tavily/Replit:** Optional convenience/infrastructure, not core correctness dependencies.
- **External research repos:** MobileInject task/scoring patterns may be ported selectively with license attribution. No full fork/import without a compatibility and security audit. AgentDojo is a methodological reference; confirm applicable license before borrowing code.

## 11. Deployment and ownership

- Builder A: PhoneUse adapter, device fixture, reset, observation/state verification, end-to-end reliability.
- Builder B: threat/policy engine, backend orchestration, mobile UI, optional tracing.
- Define shared typed contracts early. Each builder works in separate branches and merges reviewable units to `main`; avoid simultaneous edits to central schema files without coordination.
- UI must be publicly reachable *from a phone* while device-control APIs remain private/authenticated. No production keys embedded in frontend.
- Keep `docs/DEVICE_AUDIT.md`, `docs/REUSE_AUDIT.md`, `docs/TEST_EVIDENCE.md`, and `PLAN.md` current as code evolves.

## 12. Source of truth and unresolved dependencies

1. Verify actual repo state, local tools, PhoneUse account or physical device, and SDK/API capabilities at runtime.
2. Pin `@phone-use/sdk` version or local PhoneUse repository commit once selected.
3. Verify installed apps and test account state before choosing demo story.
4. Record the real threat model and limitations before describing the product as self-healing.
5. Keep user-facing status truthful: `mock`, `recorded`, and `live` are separate source types.

References: https://phoneuse.dev/docs ; https://github.com/phoneuse-official/phoneuse ; https://github.com/DeepSota/MobileInject ; https://github.com/sequrity-ai/agentdojo
