import test from "node:test";
import assert from "node:assert/strict";
import { StructuredModelAgentDecisionAdapter, UNBREAK_MODEL_RESPONSE_FORMAT } from "../../server/agents/decision.js";

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
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content } }] }), { status });
}

function validAction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "a",
    actionType: "read",
    targetApp: "Safari",
    targetClass: "allowlisted-app-open",
    sourceTrust: "trusted_scenario",
    purpose: "open app",
    command: "open_app",
    argument: "Safari",
    ...overrides,
  };
}

function validDecision(action: Record<string, unknown> = validAction()): string {
  return JSON.stringify({ proposedActions: [action], rationaleRedacted: "bounded proposal" });
}

test("structured model response is validated and marked live only at the adapter boundary", async () => {
  const adapter = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(JSON.stringify({
    proposedActions: [validAction()], rationaleRedacted: "bounded proposal",
  })) });
  const decision = await adapter.decide(input);
  assert.equal(decision.source, "live");
  assert.equal(decision.proposedActions[0]?.argument, "Safari");
});

test("model request supplies the strict action schema and allows zero proposals", async () => {
  let request: Record<string, unknown> | undefined;
  const adapter = new StructuredModelAgentDecisionAdapter({
    ...options,
    fetchImpl: async (_url, init) => {
      request = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response(JSON.stringify({ proposedActions: [], rationaleRedacted: "No action is appropriate." }));
    },
  });
  const decision = await adapter.decide(input);
  assert.deepEqual(decision.proposedActions, []);
  assert.deepEqual((request as { response_format?: unknown }).response_format, UNBREAK_MODEL_RESPONSE_FORMAT);
});

test("unexpected action properties fail closed", async () => {
  const adapter = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(validDecision({ extra: true })) });
  await assert.rejects(() => adapter.decide(input), /Unexpected action field/);
});

test("invalid commands and target classes fail closed", async () => {
  for (const action of [validAction({ command: "swipe" }), validAction({ targetClass: "" }), validAction({ targetClass: "x".repeat(201) })]) {
    const adapter = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(validDecision(action)) });
    await assert.rejects(() => adapter.decide(input), /failed closed/);
  }
});

test("missing mandatory decision or action fields fail closed", async () => {
  const missingDecisionField = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(JSON.stringify({ proposedActions: [] })) });
  await assert.rejects(() => missingDecisionField.decide(input), /Model decision rationale is invalid/);
  const missingActionField = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(validDecision(validAction({ argument: undefined }))) });
  await assert.rejects(() => missingActionField.decide(input), /Invalid argument/);
});

test("invalid or non-allowlisted model output fails closed", async () => {
  const invalid = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => response(JSON.stringify({
    proposedActions: [{ id: "a", actionType: "read", targetApp: "Messages", targetClass: "restricted-app-open", sourceTrust: "trusted_scenario", purpose: "unsafe", command: "open_app", argument: "Messages" }],
    rationaleRedacted: "unsafe",
  })) });
  await assert.rejects(() => invalid.decide(input), /failed closed/);
});

test("incomplete provider envelopes fail closed", async () => {
  for (const body of [{}, { choices: [] }, { choices: [{ message: {} }] }]) {
    const adapter = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => new Response(JSON.stringify(body), { status: 200 }) });
    await assert.rejects(() => adapter.decide(input), /incomplete|did not contain a JSON message/);
  }
});

test("non-stop and refusal responses fail closed", async () => {
  const incomplete = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{}" } }] }), { status: 200 }) });
  await assert.rejects(() => incomplete.decide(input), /incomplete/);
  const refused = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { refusal: "not available" } }] }), { status: 200 }) });
  await assert.rejects(() => refused.decide(input), /refused/);
});

test("model transport errors fail closed", async () => {
  const failing = new StructuredModelAgentDecisionAdapter({ ...options, fetchImpl: async () => { throw new Error("network unavailable"); } });
  await assert.rejects(() => failing.decide(input), /failed closed/);
});
