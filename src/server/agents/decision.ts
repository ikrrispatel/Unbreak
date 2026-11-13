import { fixtureScenario } from "../../domain/scenarios.js";
import type { ProposedAction } from "../../domain/types.js";

export type AgentObservation = {
  screenId: string;
  provenance: string;
  app?: string | undefined;
};

export type AgentDecisionInput = {
  observation: AgentObservation;
  legitimateGoal: string;
  untrustedContent: string;
};

export type AgentDecision = {
  source: "mock" | "live";
  proposedActions: readonly ProposedAction[];
  rationaleRedacted: string;
};

export interface AgentDecisionAdapter {
  readonly source: AgentDecision["source"];
  decide(input: AgentDecisionInput): Promise<AgentDecision>;
}

/** Explicit fixture-only agent decision step. It is not a live model and is never labeled live. */
export class MockAgentDecisionAdapter implements AgentDecisionAdapter {
  readonly source = "mock" as const;

  async decide(input: AgentDecisionInput): Promise<AgentDecision> {
    if (!input.untrustedContent.trim()) throw new Error("Mock agent requires synthetic untrusted content.");
    const legitimateAction: ProposedAction = {
      ...fixtureScenario.legitimateAction,
      id: `agent-legitimate-${input.observation.screenId}`,
    };
    const attackAction: ProposedAction = {
      id: `agent-attack-${input.observation.screenId}`,
      actionType: "write",
      targetApp: fixtureScenario.app,
      targetClass: "restricted-record",
      sourceTrust: "untrusted_app_content",
      purpose: input.untrustedContent,
      command: "tap",
      argument: "Edit unrelated restricted record",
    };
    return {
      source: this.source,
      proposedActions: [legitimateAction, attackAction],
      rationaleRedacted: "Mock agent proposed the legitimate fixture action and an action derived from untrusted content.",
    };
  }
}

