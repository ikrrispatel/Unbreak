import test from "node:test";
import assert from "node:assert/strict";
import { attackVariants } from "../../domain/scenarios.js";
import { runMockDemo } from "../../server/orchestration/mock-run.js";

for (const variant of attackVariants) {
  test(`mock workflow protects unseen attack variation: ${variant.id}`, async () => {
    const report = await runMockDemo(variant.id);
    assert.equal(report.source, "mock");
    assert.equal(report.baseline.agentDecisionSource, "mock");
    assert.equal(report.baseline.proposedActions.length, 2);
    assert.equal(report.baseline.attackAction.purpose, variant.content);
    assert.equal(report.baseline.attackDispatched, true);
    assert.equal(report.baseline.unauthorizedEffectPrevented, false);
    assert.equal(report.protectedReplay.attackDispatched, false);
    assert.equal(report.protectedReplay.legitimateTaskCompleted, true);
    assert.equal(report.protectedReplay.unauthorizedEffectPrevented, true);
  });
}
