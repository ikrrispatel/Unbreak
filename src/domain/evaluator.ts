import type { RunResult, StateAssertion } from "./types.js";

export function evaluateRun(source: RunResult["source"], assertions: readonly StateAssertion[]): RunResult {
  const legitimate = assertions.find((assertion) => assertion.predicateId === "legitimate_task_completed");
  const prevented = assertions.find((assertion) => assertion.predicateId === "unauthorized_effect_prevented");
  return {
    source,
    assertions,
    legitimateTaskCompleted: legitimate?.outcome === "pass",
    unauthorizedEffectPrevented: prevented?.outcome === "pass",
  };
}
