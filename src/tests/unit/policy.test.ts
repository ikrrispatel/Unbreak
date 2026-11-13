import test from "node:test";
import assert from "node:assert/strict";
import { authorize } from "../../domain/policy.js";
import type { Policy, ProposedAction } from "../../domain/types.js";

const write: ProposedAction = {
  id: "a1",
  actionType: "write",
  targetApp: "fixture-notes",
  targetClass: "restricted-record",
  sourceTrust: "untrusted_app_content",
  purpose: "edit unrelated record",
};

const policy: Policy = {
  id: "p1",
  version: 1,
  scenarioId: "fixture-1",
  rules: [
    { id: "allow-legitimate", actionType: "write", targetClass: "calendar-event", sourceTrust: "trusted_scenario", effect: "allow", reason: "Seeded task" },
    { id: "deny-untrusted", actionType: "write", targetClass: "restricted-record", sourceTrust: "untrusted_app_content", effect: "deny", reason: "Untrusted content cannot authorize unrelated writes" },
    { id: "allow-then-deny", actionType: "write", targetClass: "restricted-record", sourceTrust: "untrusted_app_content", effect: "allow", reason: "weaker rule" },
  ],
};

test("deny precedence wins over allow for the same action", () => {
  const decision = authorize(policy, write);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.dispatched, false);
  assert.equal(decision.ruleId, "deny-untrusted");
});

test("unknown restricted writes default deny", () => {
  const decision = authorize({ ...policy, rules: [] }, write);
  assert.equal(decision.decision, "deny");
  assert.equal(decision.ruleId, "default-deny-restricted-write");
});

test("reads default allow when no restriction matches", () => {
  const decision = authorize({ ...policy, rules: [] }, { ...write, actionType: "read" });
  assert.equal(decision.decision, "allow");
  assert.equal(decision.dispatched, true);
});
