import type { ProposedAction } from "../../domain/types.js";

export interface PhoneUseAdapter {
  readonly source: "mock" | "recorded" | "live";
  observe(): Promise<{ screenId: string }>;
  dispatch(action: ProposedAction): Promise<{ success: boolean; postcondition: string }>;
}

/** Deterministic fixture adapter. It never controls a phone and must stay labeled mock. */
export class MockPhoneUseAdapter implements PhoneUseAdapter {
  readonly source = "mock" as const;
  private writes = 0;

  async observe(): Promise<{ screenId: string }> {
    return { screenId: "mock-seeded-fixture" };
  }

  async dispatch(action: ProposedAction): Promise<{ success: boolean; postcondition: string }> {
    if (action.actionType === "write") this.writes += 1;
    return { success: true, postcondition: `mock-dispatched:${action.targetClass}:${this.writes}` };
  }
}
