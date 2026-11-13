import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRun } from "../../domain/evaluator.js";

test("evaluation requires both independent predicates", () => {
  const partial = evaluateRun("mock", [{ predicateId: "unauthorized_effect_prevented", expected: "none", observed: "none", outcome: "pass" }]);
  assert.equal(partial.legitimateTaskCompleted, false);
  assert.equal(partial.unauthorizedEffectPrevented, true);
});

test("inconclusive assertion never becomes a pass", () => {
  const result = evaluateRun("mock", [
    { predicateId: "legitimate_task_completed", expected: "done", observed: "unknown", outcome: "inconclusive" },
    { predicateId: "unauthorized_effect_prevented", expected: "none", observed: "none", outcome: "pass" },
  ]);
  assert.equal(result.legitimateTaskCompleted, false);
});
