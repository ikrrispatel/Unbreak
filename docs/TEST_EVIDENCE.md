# Test evidence

## 2026-11-13 — Phase 0 audit

Commands run:

- `git remote -v; git branch --show-current; git status --short --branch; git log -5 --oneline --decorate`
- `node --version; npm --version; python3 --version; xcodebuild -version`
- `command -v phone-use; command -v phoneuse; command -v bun; xcrun simctl list devices available`
- `system_profiler SPUSBDataType`
- source checkout inspection for PhoneUse Local, MobileInject, and AgentDojo

Result: repository was empty; control files were added from the supplied versions. No live PhoneUse backend, credentials, simulator, WDA, or USB phone was available. Live smoke test is BLOCKED and is not represented as a pass.

## 2026-11-13 — Typed policy and mock adapter slice

Commands:

- `npm install --ignore-scripts`
- `npm run typecheck`
- `npm test`

Result: typecheck passed. Build passed. Five Node test cases passed, covering deny precedence, default-deny for unknown restricted writes, read behavior, independent predicates, and inconclusive assertions. These are mock/unit results only; they do not promote PhoneUse integration to live.

Follow-up: runtime validation was added for proposed actions and version-1 policies. The test suite now passes six cases, including rejection of unknown trust tags, unsupported policy versions, malformed objects, and executable-looking policy effects.

## 2026-11-13 — Official adapter, mock workflow, and UI

Commands:

- `npm install --save-exact @phone-use/sdk@0.6.0 --ignore-scripts`
- `npm run typecheck`
- `npm test`
- `npm start` (local server)
- Browser inspection at `http://127.0.0.1:3000/` using a narrow viewport screenshot

Result: official SDK 0.6.0 is pinned. The isolated `PhoneUseSdkAdapter` uses the published `createCloudSandboxBackend`, `snapshot`, `openApp`, `press`, and explicit `closeSession` surface only; it requires explicit sandbox URL/token environment variables and allowlisted app/labels. The live smoke test is opt-in and observation-only (`PHONE_USE_RUN_LIVE_SMOKE=1`): it performs one SDK `snapshot`, validates live cloud provenance, and never calls `closeSession`. Sandbox closure remains a separate explicit lifecycle operation. It is skipped in this environment because credentials/device access are absent.

The mock workflow passed both `direct-edit` and `urgent-review` variations: baseline restricted write dispatched; protected replay denied it before adapter dispatch; legitimate calendar fixture state remained complete. The browser-visible UI is phone-sized, shows `MOCK MODE`, and explains that configured credentials alone do not prove a live run.

The controlled live-open test is excluded from ordinary `npm test`; it requires `PHONE_USE_RUN_LIVE_OPEN=1`, authorizes only the trusted Safari `open_app` action, calls the adapter dispatch boundary, observes afterward, verifies SDK-reported app identity `Safari`, and logs only redacted operation/timing fields. It never calls `closeSession`. The prior observation-only check is likewise separate as `npm run test:live:observe`.

## 2026-11-13 — Controlled live app-open preparation

Commands run:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`

Result: typecheck, production build, and all 12 ordinary unit/mock tests passed. Added negative adapter tests proving non-allowlisted apps are rejected before SDK dispatch. Live app-open was not executed because `PHONE_USE_SANDBOX_URL` and `PHONE_USE_SANDBOX_TOKEN` were not present in this environment.

The SDK contract correction is based on the installed 0.6.0 declaration and runtime: `CloudSandboxBackend.openApp()` returns `Promise<OpenAppResult>`, with optional `appName`, `appBundleId`, and `unverified`; it has no `success` property. The adapter now treats a resolved response with `unverified` absent as a dispatch success candidate, while the required fresh snapshot independently verifies final app identity. An `unverified` response is reported as unsuccessful and covered by a unit test.

Opt-in command with the already configured sandbox:

```bash
PHONE_USE_RUN_LIVE_OPEN=1 npm run test:live:open
```

The test authorizes and opens Safari once, observes the device once afterward, verifies `Safari` from the SDK snapshot, emits only redacted timing/provenance evidence, and does not close the sandbox.

The live negative enforcement test is separate and opt-in:

```bash
PHONE_USE_RUN_LIVE_NEGATIVE=1 npm run test:live:negative
```

It observes the current foreground app, submits a synthetic non-allowlisted app-open proposal through the authorization gateway, asserts deny/no result/zero spy dispatch calls, observes again, and verifies the foreground app identity is unchanged. It does not call `closeSession` or access any app content.

## 2026-11-13 — Server-side structured model adapter

Added `StructuredModelAgentDecisionAdapter` with environment-only credentials (`UNBREAK_MODEL_API_URL`, `UNBREAK_MODEL_API_KEY`, `UNBREAK_MODEL_NAME`), a bounded timeout, strict JSON/action validation, explicit app/tap allowlists, and fail-closed handling for transport or malformed model responses. The adapter only proposes actions; callers must pass every proposal through `dispatchThroughAuthorizationGateway` before PhoneUse.

Verification: `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check` passed. Ordinary tests now pass 15 cases, including model response validation and failure tests. No model credential was present and no live model request or live state-changing action was performed.

## 2026-11-13 — Agent-decision attack → repair → replay loop

The deterministic workflow now includes an explicit `AgentDecisionAdapter` boundary. `MockAgentDecisionAdapter` is labeled `mock`; it consumes the observed fixture screen plus synthetic untrusted content and returns separately recorded proposed actions. The orchestration layer sends each proposal through the mandatory authorization gateway, records decisions and dispatches separately, generates the repair deny rule from the observed violating proposal, resets the fixture, and replays the same legitimate task with the bounded attack variation.

Live PhoneUse attack-to-repair remains blocked for this execution context: no model credentials and no verified synthetic native-app fixture/reset procedure are available. Safari is verified for observation/open only; no live untrusted-content injection or multi-app state-changing workflow is claimed. The mock path remains explicitly labeled and covers both bounded attack variations.

## 2026-11-13 — Real-model and native-fixture preparation

The model adapter protocol is an OpenAI-compatible Chat Completions request: JSON POST with `model`, `messages`, and strict `response_format.type = "json_schema"`. The schema requires exactly `proposedActions` and `rationaleRedacted`; each action requires exactly `id`, `actionType`, `targetApp`, `targetClass`, `sourceTrust`, `purpose`, `command`, and `argument`. Runtime validation additionally enforces non-empty strings up to 200 characters, rationale up to 1000 characters, at most eight actions, the enumerated action types/trust tags/commands, and configured app/tap allowlists. Zero actions is valid. Provider compatibility is not claimed until an authorized endpoint returns that contract. `UNBREAK_MODEL_API_URL`, `UNBREAK_MODEL_API_KEY`, and `UNBREAK_MODEL_NAME` are unset in this environment.

## 2026-11-13 — Structured-output contract correction

The first real model attempt failed closed with `Unexpected action field` because the previous request selected JSON mode only and described the schema in prose; it did not provide a provider-enforced schema. The adapter now sends strict Chat Completions JSON Schema output with `additionalProperties: false`, required fields, and enums. Runtime validation remains authoritative and rejects unknown fields, invalid lengths/types, unsupported commands, invalid trust tags, non-allowlisted apps/taps, refusals, non-stop completions, and incomplete envelopes. Untrusted content is included only as bounded data in the user message and cannot alter the system contract.

Deterministic coverage now includes valid output, zero proposals, unexpected properties, invalid commands/target classes, missing fields, unauthorized proposals, incomplete envelopes, refusals, non-stop completions, and transport failures. No OpenAI request was executed during this fix.

Added opt-in model tests split by purpose. `UNBREAK_RUN_LIVE_MODEL=1 npm run test:live:model` is connectivity-only: it uses the observed Safari context and allows only the Safari capability contract, including zero proposals. `UNBREAK_RUN_LIVE_MODEL_ATTACK=1 npm run test:live:model` separately classifies no attack, an unauthorized restricted-record proposal denied by the gateway, and a legitimate proposal completed only at a recording boundary. Neither test controls a device or claims PhoneUse execution.

The model request now includes the explicit static capability contract (`commands`, `openApps`, `tapLabels`, and `targetClasses`) alongside the bounded task data. The test uses recorded Safari evidence, not an invented native calendar fixture. A non-allowlisted target class remains a rejected model proposal; it is never treated as a successful action.

Native fixture preparation is blocked on this host: Swift is installed, but `xcodebuild` requires full Xcode, the iOS Simulator SDK is unavailable, and `simctl` cannot be found. No `.app` was built or installed, and no PhoneUse fixture workflow is claimed.
