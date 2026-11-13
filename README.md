# Unbreak

### Break the agent. Repair the boundary.

Unbreak is a PhoneUse-powered security runtime for mobile agents. It discovers when untrusted app content redirects a legitimate task, turns the observed violation into a narrow enforceable policy, and verifies a defended replay with independent state checks.

> **PhoneUse integration:** PhoneUse remains Unbreak’s exclusive mobile execution engine. The live adapter uses the official `@phone-use/sdk` cloud backend and is isolated behind the existing adapter boundary. This repository does not claim a live run from credentials alone.

## What exists today

| Capability | Status | Evidence |
| --- | --- | --- |
| Strict policy authorization | Implemented | Deny precedence, default-deny restricted writes, runtime validation |
| Deterministic attack → repair → replay | Implemented | Two unseen synthetic attack variations in `npm test` |
| Independent evaluation | Implemented | Legitimate-task and unauthorized-effect predicates are evaluated separately |
| Official PhoneUse adapter | Implemented | `@phone-use/sdk@0.6.0`, isolated live adapter, explicit session close |
| Observation-only PhoneUse smoke test | Opt-in | Requires an authorized sandbox; never closes the running session |
| Safari open and denied-dispatch tests | Opt-in | State-changing and denied-boundary tests are excluded from ordinary tests |
| Structured server-side model adapter | Implemented, opt-in | Strict JSON Schema, fail-closed parsing, explicit capability contract |
| Native iOS fixture | Blocked | Full Xcode/iOS Simulator SDK is not available in the current environment |

The default UI and test workflow are deliberately labeled `MOCK`. `RECORDED` means evidence captured from a prior verified boundary, not a current device action. `LIVE` is reserved for an actual PhoneUse response plus independent verification.

## The workflow

```text
observe → propose → authorize → dispatch → observe
                    ↓
             generate narrow repair policy
                    ↓
             reset → defended replay → independent evaluation
```

The agent only proposes. Every proposal is recorded separately and must pass the mandatory authorization gateway before it can reach a PhoneUse adapter. The UI shows the proposal ledger, authorization result, generated policy, execution trace, and before/after assertions.

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm start
```

Open `http://127.0.0.1:3000`. The mobile-first interface runs the deterministic fixture and clearly marks it `MOCK MODE`; it performs no phone action.

When an authorized PhoneUse Cloud sandbox is configured on the server, use the device panel's `Refresh observation` control or request `GET /?observe=1`. The page displays only the SDK's current snapshot metadata and screenshot artifact. `GET /api/device/readiness` reports `ready` or `disconnected` without exposing credentials; `GET /api/device/observe` returns redacted metadata and an artifact-presence marker. There is intentionally no browser-facing raw PhoneUse RPC or dispatch route.

## Tests and opt-in runs

Ordinary tests never require credentials and never contact PhoneUse:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Live operations are separate and require environment configuration. Never commit tokens or paste them into the repository.

```bash
# Observation only; preserves the running sandbox.
PHONE_USE_RUN_LIVE_SMOKE=1 npm run test:live:observe

# Explicit, controlled Safari open; no closeSession call.
PHONE_USE_RUN_LIVE_OPEN=1 npm run test:live:open

# Denied non-allowlisted app proposal; should dispatch zero times.
PHONE_USE_RUN_LIVE_NEGATIVE=1 npm run test:live:negative

# Model connectivity only; no PhoneUse dispatch.
UNBREAK_RUN_LIVE_MODEL=1 npm run test:live:model

# Separate adversarial proposal classification at a recording boundary.
UNBREAK_RUN_LIVE_MODEL_ATTACK=1 npm run test:live:model
```

The model adapter expects an authorized server-side OpenAI-compatible Chat Completions provider configured with `UNBREAK_MODEL_API_URL`, `UNBREAK_MODEL_API_KEY`, and `UNBREAK_MODEL_NAME`. It sends strict `json_schema` output and rejects malformed, incomplete, or unauthorized proposals.

## Secure deployment notes

Run the server behind an HTTPS reverse proxy with authentication, network access restricted to the operator and the PhoneUse worker, and secrets injected by the deployment environment or secret manager. Keep `PHONE_USE_SANDBOX_URL`, `PHONE_USE_SANDBOX_TOKEN`, and model credentials out of browser bundles, logs, `.env` files committed to Git, and screenshots. The current local server provides a safe read-only observation surface; it is not a public deployment or a complete user-authentication system.

## Security model and limitations

- Untrusted mobile content is data, never an authorization source.
- Deny rules take precedence; restricted writes default to deny.
- PhoneUse dispatch requires a matching allow decision from the gateway.
- App and tap capabilities are explicitly allowlisted at the live adapter boundary.
- Model errors, refusals, malformed responses, and unknown fields fail closed.
- A successful proposal is not proof of a device state change; postconditions are independently observed.
- The mock fixture demonstrates the architecture, not PhoneUse performance or universal security.
- No real accounts, recipients, secrets, OTPs, payments, or private data are used by the fixture.

## Repository map

- `src/domain/` — policies, validation, scenarios, and independent evaluation.
- `src/server/adapters/` — mock and official PhoneUse adapter boundaries.
- `src/server/agents/` — mock and structured model proposal adapters.
- `src/server/orchestration/` — mandatory authorization gateway and replay workflow.
- `src/app/` — mobile-first presentation UI and local server.
- `docs/` — device audit and test evidence, including current blockers.

## Attribution and license

Unbreak integrates the official PhoneUse SDK as an execution dependency. No additional third-party attribution or license file is asserted here beyond the repository’s actual dependencies. Add a project license before distributing the repository publicly.
