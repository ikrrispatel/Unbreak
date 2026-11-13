# External reuse audit

Audit date: 2026-11-13 (America/Los_Angeles)

## PhoneUse Local

- Repository: `phoneuse-official/phoneuse`
- Inspected commit: `0255aeab12f9a6a7019951cf1845987d43ff009e`
- License: MIT (`Copyright (c) 2026 PhoneUse contributors`).
- Runtime: Python local API/web app, WebDriverAgent, USB iPhone; separate from hosted Phone Use SDK/cloud.
- Decision: use only as the eventual verified device-control transport. Do not import its controller into the TypeScript core. A live adapter remains blocked pending setup.

## MobileInject

- Repository: `DeepSota/MobileInject`
- Inspected commit: `ab5c47081a646b7b8003de41b3d766f7ad9e0286`
- License: MIT (`Copyright (c) 2026 The MobileInject Authors`).
- Runtime: Android emulator, ADB, Appium 2/UiAutomator2, Python model adapters, seeded APKs and state-reset routines.
- Decision: no runtime reuse. The benchmark is Android/Appium-specific and conflicts with PhoneUse as the sole device-control path. Its bounded scenario/evaluator concepts may inform Unbreak fixtures later, with attribution if code is ever ported.

## AgentDojo

- Repository: `sequrity-ai/agentdojo` (upstream README identifies ETH Zurich / `ethz-spylab/agentdojo`)
- Inspected commit: `357c80dea9af34323f709c3505d9e6d224654c7e`
- License: MIT (`Copyright (c) 2024 Edoardo Debenedetti, Jie Zhang, Mislav Balunovic, Luca Beurer-Kellner, Marc Fischer, and Florian Tramèr`).
- Runtime: Python 3.11+, multiple model/provider and LangChain dependencies; dynamic benchmark suites.
- Decision: methodological reference only. No code or dependency stack is imported into Unbreak; the typed TypeScript policy/evaluator remains smaller, deterministic, and auditable for the MVP.

## Boundary

PhoneUse is the only permitted phone execution path. No ADB, Appium, Android emulator, or alternate iPhone controller is added to the shipped run path.
