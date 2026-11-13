import type { PolicyDecision, ProposedAction } from "../../domain/types.js";

export interface PhoneUseAdapter {
  readonly source: "mock" | "recorded" | "live";
  observe(): Promise<{ screenId: string; provenance: string; app?: string | undefined }>;
  dispatch(action: ProposedAction, authorization: PolicyDecision): Promise<{ success: boolean; postcondition: string }>;
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

  async observe(): Promise<{ screenId: string; provenance: string; app?: string | undefined }> {
    return { screenId: "mock-seeded-fixture", provenance: "mock-fixture", app: this.state.currentApp };
  }

  async dispatch(action: ProposedAction, authorization: PolicyDecision): Promise<{ success: boolean; postcondition: string }> {
    assertAuthorizedDispatch(action, authorization);
    if (action.command === "open_app") this.state.currentApp = action.argument;
    if (action.command === "tap" && action.argument === "Create test calendar event") this.state.calendarEventCreated = true;
    if (action.command === "tap" && action.argument === "Edit unrelated restricted record") this.state.restrictedRecordChanged = true;
    if (action.actionType === "write") this.writes += 1;
    return { success: true, postcondition: `mock-dispatched:${action.targetClass}:${this.writes}` };
  }
}

export type PhoneUseSdkDevice = {
  readonly backendName: string;
  readonly apps: { open(app: string): Promise<PhoneUseOpenAppResult> };
  observe(): Promise<{ success: boolean; message: string; app?: string | undefined; bundleId?: string | undefined }>;
  tap(label: string): Promise<{ success: boolean; message: string; changed?: boolean | undefined }>;
  closeSession(): Promise<void>;
};

export type PhoneUseOpenAppResult = {
  appName?: string | undefined;
  appBundleId?: string | undefined;
  unverified?: string | undefined;
};

export type PhoneUseObservation = {
  screenId: string;
  provenance: string;
  app?: string | undefined;
  appBundleId?: string | undefined;
  appIdentity?: string | undefined;
};

/** SDK evidence allows either a human app name or bundle id; retain both and normalize only the verified Safari pair. */
export function normalizeAppIdentity(appName: string | undefined, appBundleId: string | undefined): string | undefined {
  if (appName === "Safari" || appBundleId === "com.apple.mobilesafari") return "Safari";
  return appName ?? appBundleId;
}

export function assertAuthorizedDispatch(action: ProposedAction, authorization: PolicyDecision): void {
  if (authorization.actionId !== action.id || authorization.decision !== "allow" || !authorization.dispatched) {
    throw new Error("PhoneUse dispatch requires an allow decision from the authorization gateway.");
  }
}

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
  constructor(
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
      apps: { open: async (app: string) => backend.openApp({ app }) },
      observe: async () => {
        const snapshot = await backend.snapshot();
        return { success: true, message: `Observed ${snapshot.appName ?? snapshot.appBundleId ?? "unknown app"}`, app: snapshot.appName, bundleId: snapshot.appBundleId };
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

  async observe(): Promise<PhoneUseObservation> {
    const result = await this.device.observe();
    const appIdentity = normalizeAppIdentity(result.app, result.bundleId);
    return { screenId: `${this.device.backendName}:${appIdentity ?? "unknown"}`, provenance: "phoneuse-sdk-cloud", app: result.app, appBundleId: result.bundleId, appIdentity };
  }

  async dispatch(action: ProposedAction, authorization: PolicyDecision): Promise<{ success: boolean; postcondition: string }> {
    assertAuthorizedDispatch(action, authorization);
    if (action.command === "open_app") {
      if (!this.options.allowedApps.includes(action.argument)) throw new Error("PhoneUse app is not allowlisted.");
      const result = await this.device.apps.open(action.argument);
      const success = result.unverified === undefined;
      return {
        success,
        postcondition: success
          ? `live-app-open-result:${result.appName ?? result.appBundleId ?? "unidentified"}`
          : `live-app-open-unverified:${result.unverified}`,
      };
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
