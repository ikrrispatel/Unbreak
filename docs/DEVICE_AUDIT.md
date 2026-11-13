# Device capability audit

Audit date: 2026-11-13 (America/Los_Angeles)

## Confirmed host facts

- macOS 27.0.1, arm64.
- Node.js v20.20.2 and npm 10.8.2.
- Python 3.9.6.
- `xcodebuild` is unavailable because the active developer directory is Command Line Tools; `xcrun simctl` is unavailable.
- No `phone-use`, `phoneuse`, or `bun` executable is installed.
- No connected iPhone/iPad or WebDriverAgent was reported by `system_profiler SPUSBDataType`.
- No Phone Use cloud or local credentials were present: `PHONE_USE_CLOUD_TOKEN`, `PHONE_USE_SANDBOX_URL`, `PHONE_USE_SANDBOX_TOKEN`, `PHONEUSE_API_URL`, `PHONEUSE_API_KEY` were all unset.
- No local Phone Use token file was present at `~/.phone-use/config.json` or the local PhoneUse checkout state path.

## Source/runtime facts

- The official `phoneuse-official/phoneuse` checkout was inspected at commit `0255aeab12f9a6a7019951cf1845987d43ff009e`.
- Its current README requires macOS with full Xcode, a trusted USB iPhone, Developer Mode, signed WebDriverAgent, Python 3.13, Node.js 24+, and Codex access.
- The separate hosted Phone Use docs describe `@phone-use/sdk` and cloud sandboxes, but no SDK is installed and no cloud token is configured.

## Smoke test result

**BLOCKED — no live PhoneUse smoke test was possible.** There is no authorized device, local API, SDK, or cloud session to probe. No live capability or app availability is claimed. The implementation must remain labeled `mock` until a real transport is configured and a read-only probe is recorded here.

## Smallest human action to unblock live work

Provide an authorized PhoneUse transport: either a configured cloud sandbox/token or a full-Xcode local PhoneUse setup with a synthetic test device/app. Do not send credentials in chat; configure them in the environment and confirm only that they are available.

## Current host recheck — 2026-11-13

- `xcode-select -p` resolves to `/Library/Developer/CommandLineTools`.
- `swift --version` succeeds, but `xcodebuild -version` reports that full Xcode is required.
- `xcrun --sdk iphonesimulator --show-sdk-path` and `xcrun simctl` both fail because the iOS Simulator SDK/tools are unavailable.
- `UNBREAK_MODEL_API_URL`, `UNBREAK_MODEL_API_KEY`, `UNBREAK_MODEL_NAME`, and `UNBREAK_RUN_LIVE_MODEL` are unset.
- `git ls-remote origin refs/heads/main` could not be completed in this shell because `github.com` did not resolve; no push was attempted.

The native fixture therefore remains unbuilt and uninstalled. The exact unblock is to install/select a full Xcode toolchain with an iOS Simulator runtime, then review the fixture before any PhoneUse installation. Separately, configure an authorized server-side model provider using the documented environment variables and verify its OpenAI-compatible structured JSON response contract.
