import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Policy, ProposedAction } from "../../domain/types.js";
import { PhoneUseSdkAdapter, type PhoneUseAdapter } from "../../server/adapters/phoneuse.js";
import { dispatchThroughAuthorizationGateway } from "../../server/orchestration/authorized-dispatch.js";

const enabled = process.env.PHONE_USE_RUN_LIVE_NEGATIVE === "1";
const configured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);

test("live PhoneUse negative: denied app open never dispatches", { skip: !enabled || !configured ? "Set PHONE_USE_RUN_LIVE_NEGATIVE=1 plus sandbox URL/token to opt in." : false }, async () => {
  const action: ProposedAction = {
    id: "live-denied-synthetic-app-open",
    actionType: "read",
    targetApp: "NonAllowlistedSyntheticApp",
    targetClass: "restricted-app-open",
    sourceTrust: "trusted_scenario",
    purpose: "negative authorization-boundary test; no device dispatch permitted",
    command: "open_app",
    argument: "NonAllowlistedSyntheticApp",
  };
  const policy: Policy = {
    id: "live-denied-app-open-policy",
    version: 1,
    scenarioId: "live-denied-app-open",
    rules: [{
      id: "deny-restricted-app-open",
      actionType: "read",
      targetClass: "restricted-app-open",
      sourceTrust: "trusted_scenario",
      effect: "deny",
      reason: "This negative test must stop before PhoneUse dispatch.",
    }],
  };
  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] });
  let dispatchCalls = 0;
  const spy: PhoneUseAdapter = {
    source: adapter.source,
    observe: () => adapter.observe(),
    dispatch: (proposedAction, authorization) => {
      dispatchCalls += 1;
      return adapter.dispatch(proposedAction, authorization);
    },
  };

  const before = await adapter.observe();
  assert.ok(before.appIdentity, "Foreground app identity must be observable before the denied action.");
  const started = performance.now();
  const gated = await dispatchThroughAuthorizationGateway(spy, policy, action);
  const after = await adapter.observe();
  const durationMs = Math.round(performance.now() - started);

  assert.equal(gated.decision.decision, "deny");
  assert.equal(gated.decision.dispatched, false);
  assert.equal(gated.result, undefined);
  assert.equal(dispatchCalls, 0);
  assert.equal(after.provenance, "phoneuse-sdk-cloud");
  assert.equal(after.appIdentity, before.appIdentity);

  console.log(JSON.stringify({
    source: adapter.source,
    operation: "open_app",
    targetClass: action.targetClass,
    decision: gated.decision.decision,
    dispatched: false,
    adapterDispatchCalls: dispatchCalls,
    foregroundBefore: before.appIdentity,
    foregroundAfter: after.appIdentity,
    durationMs,
  }));
});
