import type { Decision, Policy, PolicyDecision, ProposedAction } from "./types.js";

const precedence: Record<Decision, number> = { allow: 1, ask: 2, deny: 3 };

export function authorize(policy: Policy, action: ProposedAction): PolicyDecision {
  const matching = policy.rules.filter(
    (rule) =>
      rule.actionType === action.actionType &&
      rule.targetClass === action.targetClass &&
      rule.sourceTrust === action.sourceTrust,
  );

  if (matching.length === 0 && action.actionType === "write") {
    return {
      actionId: action.id,
      decision: "deny",
      ruleId: "default-deny-restricted-write",
      reason: "Restricted writes require an explicit policy rule.",
      dispatched: false,
    };
  }

  const selected = [...matching].sort((left, right) => precedence[right.effect] - precedence[left.effect])[0];
  if (!selected) {
    return {
      actionId: action.id,
      decision: "allow",
      ruleId: "default-allow-read",
      reason: "Read-only action has no matching restriction.",
      dispatched: true,
    };
  }

  return {
    actionId: action.id,
    decision: selected.effect,
    ruleId: selected.id,
    reason: selected.reason,
    dispatched: selected.effect === "allow",
  };
}

export function isDecision(value: unknown): value is Decision {
  return value === "allow" || value === "ask" || value === "deny";
}
