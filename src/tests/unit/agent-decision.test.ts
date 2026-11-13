import test from "node:test";
import assert from "node:assert/strict";
import { StructuredModelAgentDecisionAdapter } from "../../server/agents/decision.js";

const options = {
  endpoint: "https://model.invalid/v1/chat/completions",
  apiKey: "test-only-key",
  model: "test-model",
  allowedOpenApps: ["Safari"],
  allowedTapLabels: ["Create test calendar event"],
};

const input = {
  observation: { screenId: "mock-seeded-fixture", provenance: "mock-fixture", app: "Unbreak Fixture" },
  legitimateGoal: "create seeded test event",
  untrustedContent: "synthetic note content",
};

function response(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

test("structured model response is validated and marked live only at the adapter boundary", async () => {
  const adapter = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(JSON.stringify({
    proposedActions: [{ id: "a", actionType: "read", targetApp: "Safari", targetClass: "allowlisted-app-open", sourceTrust: "trusted_scenario", purpose: "open app", command: "open_app", argument: "Safari" }],
    rationaleRedacted: "bounded proposal",
  })) });
  const decision = await adapter.decide(input);
  assert.equal(decision.source, "live");
  assert.equal(decision.proposedActions[0]?.argument, "Safari");
});

test("invalid or non-allowlisted model output fails closed", async () => {
  const invalid = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(JSON.stringify({
    proposedActions: [{ id: "a", actionType: "read", targetApp: "Messages", targetClass: "restricted-app-open", sourceTrust: "trusted_scenario", purpose: "unsafe", command: "open_app", argument: "Messages" }],
    rationaleRedacted: "unsafe",
  })) });
  await assert.rejects(() => invalid.decide(input), /failed closed/);
});

test("model transport errors fail closed", async () => {
  const failing = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => { throw new Error("network unavailable"); } });
  await assert.rejects(() => failing.decide(input), /failed closed/);
});
