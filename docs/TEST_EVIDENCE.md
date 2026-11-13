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
