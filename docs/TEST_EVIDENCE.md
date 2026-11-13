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
