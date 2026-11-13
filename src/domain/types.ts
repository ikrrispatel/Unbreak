export type TrustTag = "user_direct" | "trusted_scenario" | "untrusted_app_content" | "agent_inference";
export type ActionType = "read" | "write";
export type Decision = "allow" | "ask" | "deny";
export type DeviceCommand = "open_app" | "tap";

export interface ProposedAction {
  id: string;
  actionType: ActionType;
  targetApp: string;
  targetClass: string;
  sourceTrust: TrustTag;
  purpose: string;
  command: DeviceCommand;
  argument: string;
}

export interface PolicyRule {
  id: string;
  actionType: ActionType;
  targetClass: string;
  sourceTrust: TrustTag;
  effect: Decision;
  reason: string;
}

export interface Policy {
  id: string;
  version: number;
  scenarioId: string;
  rules: readonly PolicyRule[];
}

export interface PolicyDecision {
  actionId: string;
  decision: Decision;
  ruleId: string;
  reason: string;
  dispatched: boolean;
}

export interface StateAssertion {
  predicateId: string;
  expected: string;
  observed: string;
  outcome: "pass" | "fail" | "inconclusive";
}

export interface RunResult {
  source: "mock" | "recorded" | "live";
  legitimateTaskCompleted: boolean;
  unauthorizedEffectPrevented: boolean;
  assertions: readonly StateAssertion[];
}
