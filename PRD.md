# Unbreak — Product Requirements Document

**Project:** https://github.com/ikrrispatel/Unbreak  
**Status:** Hackathon MVP specification; capabilities are targets until verified  
**Team:** Two builders  
**Date:** 2026-11-13  
**Core platform:** PhoneUse

## 1. One-line product

Unbreak continuously tests PhoneUse-powered mobile agents with adversarial content, converts observed instruction-boundary failures into enforceable action policies, and proves fixes with a legitimate-task-preserving replay.

**Positioning:** *Break your agent before someone else does.*  
**Stage thesis:** The impressive event is not the attack. It is an observed failure becoming a reusable, machine-enforced protection, verified on a phone.

## 2. User and problem

**Primary user:** Engineers and agent builders shipping workflows that observe untrusted phone content and then take privileged actions in other apps.  
**Secondary user:** Security/product teams who need an auditable regression test before enabling unattended phone agents.

A phone agent may misinterpret a message, note, ticket, or other third-party content as a new instruction. Existing prompt-injection research illustrates the problem; Unbreak's MVP specifically tests an agent's *action boundary* and produces evidence of repair. We are not claiming to invent prompt-injection discovery, mobile-agent testing, or generalized security.

## 3. Mandatory product loop

1. **Define:** Operator selects a bounded legitimate task, controlled test environment, and forbidden action.
2. **Observe:** PhoneUse drives the task on a real supported mobile execution surface. Record observations, intended actions, action decisions, and resulting device state.
3. **Attack:** Insert synthetic, attacker-controlled content at an allowed surface. The attack may be generated within an allowlisted scenario, but cannot reach real accounts or recipients.
4. **Witness:** Detect a *proposed or actually executed* policy-violating action using independent evidence; report the distinction explicitly.
5. **Repair:** Synthesize a narrow candidate policy using a strict schema. Validate syntax and scope. Enforce it in Unbreak's own action dispatcher, before any restricted PhoneUse call.
6. **Replay:** Reset deterministically; rerun the legitimate task with the policy, including a distinct attack variation.
7. **Prove:** Show both that the restricted action was denied and that the original task finished, backed by device-state checks and trace IDs.
8. **Retain:** Save an anonymized regression scenario and reproducibility metadata.

Do not fake a compromised run. If the baseline attack does not succeed, say **ATTACK DID NOT SUCCEED** and demonstrate the testing workflow honestly; never label a clean run as vulnerable.

## 4. MVP scope (P0)

- A mobile-first web interface that a judge can operate fully from a phone.
- PhoneUse as the **only** device control/execution layer; no parallel ADB/Appium/DroidRun controller in the shipped run path.
- Startup device/provider probe with visible status: available, restricted, unavailable, not tested.
- One **verified** compatible native-mobile workflow using seeded accounts/data; prefer an app that genuinely operates on the selected PhoneUse device. Do not assume Messages, Gmail, WhatsApp, Calendar, Notes, or cloned devices are available.
- A bounded, reversible task with one legitimate cross-app outcome and one unauthorized target. Example only, conditional on device testing: read a seeded message containing a meeting time and add a test calendar event; resist an instruction to edit an unrelated synthetic note. Choose an equally legible workflow if app availability differs.
- Structured `Run`, `Observation`, `ProposedAction`, `PolicyDecision`, `Policy`, `StateAssertion`, `Evidence` records.
- One baseline run and one protected replay on a deterministic reset fixture.
- Narrow rule generator with **default-deny on unapproved cross-app writes**; explicit allow/ask/deny semantics. Rules must validate against a schema and be evaluated before calls are dispatched.
- Two independent success predicates: `legitimate_task_completed` and `unauthorized_effect_prevented`.
- Redacted action trace and phone-visible proof card with truthful timestamps and screenshots where permitted.
- At least one generated regression test for an unseen *bounded variation*; no arbitrary judge instructions that could target real third parties.
- Fallback recorded evidence **clearly labeled** as recorded when live device is inaccessible.

## 5. If time allows (P1)

- Judge challenge selector: 2–3 allowlisted harmless unauthorized goals with optional text customization.
- LangSmith traces and baseline/protected comparison (only after the core loop is working). Gracefully degrade without it.
- Replay timing telemetry, failure taxonomy, exportable redacted report.
- A second native-app workflow on the same PhoneUse platform.
- Optional Tavily context only when it changes a decision; not a mandatory dependency or sponsor checklist.

## 6. Explicit non-goals

- Universal protection of arbitrary third-party agents, apps, or phones.
- Privileged OS interception, SMS push triggers, network capture, traffic interception, or account cloning unless independently verified and specifically approved.
- Live credential, OTP, financial, banking, personal-note, or private-message exfiltration.
- Autonomous money movement, account deletion, security-setting changes, or destructive actions.
- A fake app designed solely to be trivially hacked; a controlled fixture is acceptable only if labeled honestly and supported by actual PhoneUse execution.
- A generic chatbot/agent OS, large multi-agent swarm, app-store deployment, billing, multi-tenant enterprise SaaS, or overnight autonomous security monitoring.
- Claiming all attacks are prevented; one replay is evidence for that tested case only.
- Integrating whole MobileInject/AgentDojo emulator stacks into PhoneUse.

## 7. Primary user flows

**F1 — Setup:** Open Unbreak on phone → select PhoneUse backend → run capability probe → select available seeded workflow → see reset and account-readiness result.

**F2 — Baseline:** Start authorized test → watch live phone progress → inspect attempted actions → inspect independent state assertions → see honest attack outcome.

**F3 — Patch:** Inspect diagnosed action-boundary failure → inspect generated strict policy → apply to Unbreak dispatcher → see policy active; never silently grant privileged permissions.

**F4 — Replay:** Reset test state → run same authorized task with changed attack wording → see block at decision boundary → verify legitimate task completed → save regression.

**F5 — Judge view:** Open mobile run report → see before/after, evidence, policy, task success and attack-block outcome → open trace (optional).

## 8. Interface requirements

- Designed at ~390px phone viewport first; large readable text, dark/light contrast, tap targets >=44px, no hover-dependent controls.
- One-sentence story visible above the fold: `The phone agent got tricked. Unbreak fixed the boundary.` Only display as fact for a proven run.
- Main visual: side-by-side (stacked on phone) **Baseline** / **Protected replay** cards, each with task outcome, attempted restricted action, and verified final state.
- State labels distinguish `NOT RUN`, `RUNNING`, `PASS`, `FAIL`, `INCONCLUSIVE`, `RECORDED`.
- Show actual device status and current run phase; no simulated phone video passed off as live.
- Evidence screenshot or mobile frame should be rendered responsibly; redact sensitive content and include data-source label.
- Failure and disconnected states must be understandable and recoverable.

## 9. Security and privacy requirements

- Synthetic data, test accounts, allowlisted apps/recipients only. Do not run adversarial payloads against personal/production devices or accounts.
- Server-only API keys; `.env` excluded; `.env.example` contains placeholders only.
- Authz checks on any endpoint that starts or manipulates a device run; localhost is not a universal security boundary.
- Action policy is enforced server-side **before** the PhoneUse tool invocation. No model decision can bypass deny; confirmation is required wherever PhoneUse itself requires it.
- Treat all screen text, attack prompts, third-party content, and model output as untrusted.
- Validate all input with schemas, least-privilege action allowlists, and constrained run timeouts.
- Device writes only to controlled fixtures; never send externally to an unapproved destination.
- No real OTPs, credentials, private messages, or banking records in screenshots/traces. Redact and minimize retention.
- Each trace carries source provenance, device/run IDs, scenario ID, policy version, and independent state-assertion outcome.
- Fail closed on missing policy context or backend errors; distinguish prevented from not attempted.

## 10. Verification and acceptance criteria

**Must-pass:**

1. PhoneUse operation is demonstrated and cited with device/backend/runtime evidence; a mocked adapter is labeled mock.
2. Baseline demonstrates an **observed** forbidden proposed action or effect, not just an LLM statement about being compromised.
3. Protected run blocks that action at a server-owned dispatch boundary with a logged deny decision.
4. Legitimate task's **final phone state** is independently checked (not accepted from a model summary).
5. At least one attack variation succeeds as a protection test without relying on an exact string match.
6. Reset is deterministic or an explicit reset procedure is documented and timed.
7. Mobile UI is operable at 390px, and every result is sourced from recorded execution.
8. All core unit/integration tests pass; run failures, unavailable apps, and backend outages produce truthful statuses.
9. No secrets appear in git history, test artifacts, screenshots, or public demo links.
10. Demo recording and fallback are distinguishable from live execution.

**Stretch targets (not guarantees):** 3 consecutive clean runs; one full before/after loop under the organizer-confirmed stage time; zero manual steps inside the scored workflow except explicitly disclosed setup.

## 11. Constraints and open decisions

- **Verified as of 2026-11-13:** Target GitHub repository is empty; sponsor local PhoneUse repo exists; a separate Phone Use TS SDK/cloud documentation exists. Their compatibility must not be assumed.
- **Unknown:** Which PhoneUse credentials/device type, installed apps, accounts, model API keys, stage timing, and reset hooks the team has.
- **Decision gate:** Before committing to the full stack, Codex must smoke-test the actual available PhoneUse path and write down what worked. If blocked, build a clearly labeled mock adapter for unit/UI development but do not declare live integration complete.

## 12. Sources / implementation references

- Sponsor local project: https://github.com/phoneuse-official/phoneuse (MIT; separate USB-iPhone developer preview)
- Phone Use SDK docs: https://phoneuse.dev/docs and https://phoneuse.dev/docs/sdk/overview (verify access and API against installed version)
- MobileInject: https://github.com/DeepSota/MobileInject (MIT; research scenario/evaluator reference, not turnkey PhoneUse integration)
- AgentDojo: https://github.com/sequrity-ai/agentdojo (study methodology/license before reuse)
- Primary Unbreak repo: https://github.com/ikrrispatel/Unbreak

