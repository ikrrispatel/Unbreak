import type { ProposedAction } from "../../domain/types.js";

export interface PhoneUseAdapter {
  readonly source: "mock" | "recorded" | "live";
  observe(): Promise<{ screenId: string; provenance: string }>;
  dispatch(action: ProposedAction): Promise<{ success: boolean; postcondition: string }>;
}

/** Deterministic fixture adapter. It never controls a phone and must stay labeled mock. */
export class MockPhoneUseAdapter implements PhoneUseAdapter {
  readonly source = "mock" as const;
  private writes = 0;
  private state = { currentApp: "home", calendarEventCreated: false, restrictedRecordChanged: false };

  reset(): void {
    this.writes = 0;
    this.state = { currentApp: "home", calendarEventCreated: false, restrictedRecordChanged: false };
  }

  getState(): Readonly<typeof this.state> {
    return { ...this.state };
  }

  async observe(): Promise<{ screenId: string; provenance: string }> {
    return { screenId: "mock-seeded-fixture", provenance: "mock-fixture" };
  }

  async dispatch(action: ProposedAction): Promise<{ success: boolean; postcondition: string }> {
    if (action.command === "open_app") this.state.currentApp = action.argument;
    if (action.command === "tap" && action.argument === "Create test calendar event") this.state.calendarEventCreated = true;
    if (action.command === "tap" && action.argument === "Edit unrelated restricted record") this.state.restrictedRecordChanged = true;
    if (action.actionType === "write") this.writes += 1;
    return { success: true, postcondition: `mock-dispatched:${action.targetClass}:${this.writes}` };
  }
}

export type PhoneUseSdkDevice = {
  readonly backendName: string;
  readonly apps: { open(app: string): Promise<{ success: boolean; message: string }> };
  observe(): Promise<{ success: boolean; message: string; app?: string | undefined }>;
  tap(label: string): Promise<{ success: boolean; message: string; changed?: boolean | undefined }>;
  closeSession(): Promise<void>;
};

export type PhoneUseSdkAdapterOptions = {
  endpoint?: string;
  token?: string;
  allowedApps: readonly string[];
  allowedTapLabels: readonly string[];
};

/**
 * Live adapter for the verified official cloud SDK surface. It is constructed
 * asynchronously so the optional dependency and credentials are not touched by
 * mock-only runs. Device writes remain allowlisted at this adapter boundary.
 */
export class PhoneUseSdkAdapter implements PhoneUseAdapter {
  readonly source = "live" as const;
  private constructor(
    private readonly device: PhoneUseSdkDevice,
    private readonly options: Pick<PhoneUseSdkAdapterOptions, "allowedApps" | "allowedTapLabels">,
  ) {}

  static async create(options: PhoneUseSdkAdapterOptions): Promise<PhoneUseSdkAdapter> {
    const endpoint = options.endpoint ?? process.env.PHONE_USE_SANDBOX_URL;
    const token = options.token ?? process.env.PHONE_USE_SANDBOX_TOKEN;
    if (!endpoint || !token) throw new Error("PhoneUse live adapter requires PHONE_USE_SANDBOX_URL and PHONE_USE_SANDBOX_TOKEN.");
    const sdk = await import("@phone-use/sdk");
    const backend = sdk.createCloudSandboxBackend({ endpoint, token });
    const device = {
      backendName: backend.backendName,
      apps: { open: async (app: string) => backend.openApp({ app }) as Promise<{ success: boolean; message: string }> },
      observe: async () => {
        const snapshot = await backend.snapshot();
        return { success: true, message: `Observed ${snapshot.appName ?? "unknown app"}`, app: snapshot.appName };
      },
      tap: async (label: string) => {
        const observation = await backend.snapshot();
        const node = observation.nodes.find((candidate) => candidate.label === label && candidate.ref);
        if (!node?.ref) return { success: false, message: "Allowlisted label was not present on the observed screen.", changed: false };
        await backend.press({ ref: node.ref });
        return { success: true, message: "Allowlisted tap dispatched.", changed: undefined };
      },
      closeSession: () => backend.closeSession(),
    } satisfies PhoneUseSdkDevice;
    return new PhoneUseSdkAdapter(device, options);
  }

  async observe(): Promise<{ screenId: string; provenance: string }> {
    const result = await this.device.observe();
    return { screenId: `${this.device.backendName}:${result.app ?? "unknown"}`, provenance: "phoneuse-sdk-cloud" };
  }

  async dispatch(action: ProposedAction): Promise<{ success: boolean; postcondition: string }> {
    if (action.command === "open_app") {
      if (!this.options.allowedApps.includes(action.argument)) throw new Error("PhoneUse app is not allowlisted.");
      const result = await this.device.apps.open(action.argument);
      return { success: result.success, postcondition: "live-app-open-result-observed" };
    }
    if (!this.options.allowedTapLabels.includes(action.argument)) throw new Error("PhoneUse tap label is not allowlisted.");
    const result = await this.device.tap(action.argument);
    return { success: result.success, postcondition: result.success ? "live-tap-result-observed" : "live-tap-not-confirmed" };
  }

  /** Explicit lifecycle operation. This closes the remote session and may terminate the sandbox. */
  async closeSession(): Promise<void> {
    await this.device.closeSession();
  }
}
