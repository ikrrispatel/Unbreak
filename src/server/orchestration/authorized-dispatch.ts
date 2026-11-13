import { authorize } from "../../domain/policy.js";
import type { Policy, PolicyDecision, ProposedAction } from "../../domain/types.js";
import type { PhoneUseAdapter } from "../adapters/phoneuse.js";

export type AuthorizedDispatchResult = {
  decision: PolicyDecision;
  result?: { success: boolean; postcondition: string } | undefined;
};

/** The only orchestration path allowed to hand an action to a PhoneUse adapter. */
export async function dispatchThroughAuthorizationGateway(
  adapter: PhoneUseAdapter,
  policy: Policy,
  action: ProposedAction,
): Promise<AuthorizedDispatchResult> {
  const decision = authorize(policy, action);
  if (!decision.dispatched) return { decision };
  return { decision, result: await adapter.dispatch(action, decision) };
}
