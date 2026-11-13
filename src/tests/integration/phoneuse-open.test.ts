import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { authorize } from "../../domain/policy.js";
import type { Policy, ProposedAction } from "../../domain/types.js";
import { PhoneUseSdkAdapter } from "../../server/adapters/phoneuse.js";

const enabled = process.env.PHONE_USE_RUN_LIVE_OPEN === "1";
const configured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);

test("live PhoneUse controlled open: Safari only", { skip: !enabled || !configured ? "Set PHONE_USE_RUN_LIVE_OPEN=1 plus sandbox URL/token to opt in." : false }, async () => {
  const action: ProposedAction = {
    id: "live-safari-open",
    actionType: "read",
    targetApp: "Safari",
    targetClass: "allowlisted-app-open",
    sourceTrust: "trusted_scenario",
    purpose: "open Safari without navigation or account access",
    command: "open_app",
    argument: "Safari",
  };
  const policy: Policy = {
    id: "live-safari-open-policy",
    version: 1,
    scenarioId: "live-safari-open",
    rules: [{
      id: "allow-safari-open",
      actionType: "read",
      targetClass: "allowlisted-app-open",
      sourceTrust: "trusted_scenario",
      effect: "allow",
      reason: "Explicitly allowlisted read-only Safari launch for smoke verification.",
    }],
  };
  const decision = authorize(policy, action);
  assert.equal(decision.decision, "allow");
  assert.equal(decision.dispatched, true);

  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] });
  const started = performance.now();
  const dispatched = await adapter.dispatch(action);
  const after = await adapter.observe();
  const durationMs = Math.round(performance.now() - started);

  assert.equal(adapter.source, "live");
  assert.equal(dispatched.success, true);
  assert.equal(after.provenance, "phoneuse-sdk-cloud");
  assert.equal(after.app, "Safari");
  assert.equal(after.screenId, "phone-use-cloud:Safari");

  console.log(JSON.stringify({
    source: adapter.source,
    operation: "open_app",
    targetApp: "Safari",
    decision: decision.decision,
    dispatched: true,
    postObservation: after.app,
    durationMs,
  }));
});
