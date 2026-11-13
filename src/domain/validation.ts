import type { ActionType, Policy, ProposedAction, TrustTag } from "./types.js";
import { isDecision } from "./policy.js";

const trustTags = new Set<TrustTag>(["user_direct", "trusted_scenario", "untrusted_app_content", "agent_inference"]);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(input).some((key) => !allowedSet.has(key))) throw new Error(`Unexpected ${field} field.`);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) throw new Error(`Invalid ${field}.`);
  return value;
}

export function parseProposedAction(value: unknown): ProposedAction {
  const input = record(value);
  exactKeys(input, ["id", "actionType", "targetApp", "targetClass", "sourceTrust", "purpose", "command", "argument"], "action");
  const actionType = input.actionType;
  if (actionType !== "read" && actionType !== "write") throw new Error("Invalid actionType.");
  const sourceTrust = input.sourceTrust;
  if (typeof sourceTrust !== "string" || !trustTags.has(sourceTrust as TrustTag)) throw new Error("Invalid sourceTrust.");
  const command = input.command;
  if (command !== "open_app" && command !== "tap") throw new Error("Invalid command.");
  return {
    id: text(input.id, "id"),
    actionType,
    targetApp: text(input.targetApp, "targetApp"),
    targetClass: text(input.targetClass, "targetClass"),
    sourceTrust: sourceTrust as TrustTag,
    purpose: text(input.purpose, "purpose"),
    command,
    argument: text(input.argument, "argument"),
  };
}

export function parsePolicy(value: unknown): Policy {
  const input = record(value);
  if (input.version !== 1) throw new Error("Unsupported policy version.");
  if (!Array.isArray(input.rules) || input.rules.length > 50) throw new Error("Invalid rules.");
  const rules = input.rules.map((raw) => {
    const rule = record(raw);
    const actionType = rule.actionType as ActionType;
    if (actionType !== "read" && actionType !== "write") throw new Error("Invalid rule actionType.");
    const sourceTrust = rule.sourceTrust;
    if (typeof sourceTrust !== "string" || !trustTags.has(sourceTrust as TrustTag)) throw new Error("Invalid rule sourceTrust.");
    if (!isDecision(rule.effect)) throw new Error("Invalid rule effect.");
    return {
      id: text(rule.id, "rule id"),
      actionType,
      targetClass: text(rule.targetClass, "rule targetClass"),
      sourceTrust: sourceTrust as TrustTag,
      effect: rule.effect,
      reason: text(rule.reason, "rule reason"),
    };
  });
  return {
    id: text(input.id, "policy id"),
    version: 1,
    scenarioId: text(input.scenarioId, "scenarioId"),
    rules,
  };
}
