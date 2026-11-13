import type { PolicyDecision, ProposedAction } from "../../domain/types.js";
import { assertAuthorizedDispatch, type PhoneUseAdapter } from "./phoneuse.js";

const DEFAULT_ENDPOINT = "https://mcp.phoneuse.com/mcp";

export type PhoneUseComDeviceStatus = "online" | "offline" | "unauthorized" | "unknown";
export type PhoneUseComDevice = {
  deviceId: string;
  status: PhoneUseComDeviceStatus;
  platform?: "android" | "ios" | "unknown";
  kind?: string;
  displayName?: string;
  capabilities?: Record<string, unknown>;
};

export type PhoneUseComOptions = {
  endpoint?: string;
  apiKey?: string;
  deviceId?: string;
  fetchImpl?: typeof globalThis.fetch;
  allowedAppIds: readonly string[];
};

export type PhoneUseComObservation = {
  screenId: string;
  provenance: "phoneuse-com-mcp";
  app?: string;
  deviceId: string;
  deviceStatus: PhoneUseComDeviceStatus;
  frameId?: string;
  capturedAt?: string;
  imageDataUrl?: string;
};

type McpResponse = {
  result?: { structuredContent?: unknown; content?: Array<{ type?: string; mimeType?: string; data?: string; text?: string }> };
  error?: { code?: number; message?: string; data?: unknown };
};

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("PhoneUse.com MCP returned an invalid object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`PhoneUse.com MCP response is missing ${field}.`);
  return value;
}

function resultContent(response: McpResponse): Record<string, unknown> {
  if (response.error) throw new Error(`PhoneUse.com MCP ${response.error.message ?? "request failed"}.`);
  const result = response.result;
  if (!result) throw new Error("PhoneUse.com MCP returned no result.");
  if (result.structuredContent !== undefined) return object(result.structuredContent);
  const textContent = result.content?.find((entry) => entry.type === "text" && entry.text)?.text;
  if (!textContent) throw new Error("PhoneUse.com MCP returned no structured content.");
  return object(JSON.parse(textContent));
}

function imageContent(response: McpResponse): { mimeType: "image/png" | "image/jpeg"; data: string } | undefined {
  const image = response.result?.content?.find((entry) => entry.type === "image" && entry.data);
  if (!image?.data) return undefined;
  return { mimeType: image.mimeType === "image/png" ? "image/png" : "image/jpeg", data: image.data };
}

/** PhoneUse.com hosted MCP adapter. This is not the PhoneUse.dev SDK adapter. */
export class PhoneUseComAdapter implements PhoneUseAdapter {
  readonly source = "live" as const;
  readonly provider = "phoneuse-com" as const;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly allowedAppIds: readonly string[];
  private readonly configuredDeviceId: string | undefined;
  private selectedDevice: PhoneUseComDevice | undefined;
  private leaseId: string | undefined;
  private lastFrameId: string | undefined;

  constructor(options: PhoneUseComOptions) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.apiKey = options.apiKey ?? process.env.PHONEUSE_API_KEY ?? "";
    this.configuredDeviceId = options.deviceId ?? process.env.PHONEUSE_DEVICE_ID;
    this.allowedAppIds = options.allowedAppIds;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!this.apiKey) throw new Error("PhoneUse.com adapter requires PHONEUSE_API_KEY.");
    if (this.allowedAppIds.length === 0) throw new Error("PhoneUse.com adapter requires an app-id allowlist.");
  }

  static fromEnv(options: Pick<PhoneUseComOptions, "allowedAppIds">): PhoneUseComAdapter {
    return new PhoneUseComAdapter(options);
  }

  private async call(name: string, arguments_: Record<string, unknown>): Promise<{ response: McpResponse; data: Record<string, unknown> }> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`, method: "tools/call", params: { name, arguments: arguments_ } }),
    });
    if (!response.ok) throw new Error(`PhoneUse.com MCP HTTP ${response.status}.`);
    const payload = (await response.json()) as McpResponse;
    return { response: payload, data: resultContent(payload) };
  }

  async listDevices(): Promise<readonly PhoneUseComDevice[]> {
    const { data } = await this.call("list_devices", {});
    if (!Array.isArray(data.devices)) throw new Error("PhoneUse.com list_devices returned no device list.");
    return data.devices.map((candidate) => {
      const device = object(candidate);
      const normalized: PhoneUseComDevice = {
        deviceId: text(device.deviceId, "deviceId"),
        status: device.status === "online" || device.status === "offline" || device.status === "unauthorized" || device.status === "unknown" ? device.status : "unknown",
        ...(device.platform === "android" || device.platform === "ios" || device.platform === "unknown" ? { platform: device.platform } : {}),
        ...(typeof device.kind === "string" ? { kind: device.kind } : {}),
        ...(typeof device.displayName === "string" ? { displayName: device.displayName } : {}),
        ...(typeof device.capabilities === "object" && device.capabilities !== null ? { capabilities: device.capabilities as Record<string, unknown> } : {}),
      };
      return normalized;
    });
  }

  async readiness(): Promise<PhoneUseComDevice> {
    const devices = await this.listDevices();
    const device = this.configuredDeviceId ? devices.find((candidate) => candidate.deviceId === this.configuredDeviceId) : devices.find((candidate) => candidate.platform === "android" && candidate.status === "online") ?? devices[0];
    if (!device) throw new Error("PhoneUse.com returned no devices for this organization.");
    this.selectedDevice = device;
    if (device.status !== "online") throw new Error(`PhoneUse.com device ${device.deviceId} is ${device.status}, not online.`);
    return device;
  }

  private async device(): Promise<PhoneUseComDevice> {
    if (this.selectedDevice?.status === "online") return this.selectedDevice;
    return this.readiness();
  }

  private async ensureLease(deviceId: string): Promise<string> {
    if (this.leaseId) return this.leaseId;
    const { data } = await this.call("acquire_device", { deviceId });
    this.leaseId = text(data.leaseId, "leaseId");
    return this.leaseId;
  }

  private async screenshotResponse(): Promise<{ observation: PhoneUseComObservation; image?: { mimeType: "image/png" | "image/jpeg"; data: string } }> {
    const device = await this.device();
    const leaseId = this.leaseId;
    const args: Record<string, unknown> = { deviceId: device.deviceId };
    if (leaseId) args.leaseId = leaseId;
    const { response, data } = await this.call("screenshot", args);
    const frameId = typeof data.frameId === "string" ? data.frameId : undefined;
    if (frameId) this.lastFrameId = frameId;
    const format = data.format === "png" ? "png" : "jpeg";
    const image = imageContent(response) ?? (typeof data.imageBase64 === "string" ? { mimeType: format === "png" ? "image/png" as const : "image/jpeg" as const, data: data.imageBase64 } : undefined);
    return { observation: { screenId: `phoneuse-com:${device.deviceId}`, provenance: "phoneuse-com-mcp", deviceId: device.deviceId, deviceStatus: device.status, ...(frameId ? { frameId } : {}), ...(typeof data.capturedAt === "string" ? { capturedAt: data.capturedAt } : {}) }, ...(image ? { image } : {}) };
  }

  async observe(): Promise<PhoneUseComObservation> {
    return (await this.screenshotResponse()).observation;
  }

  async observeArtifact(): Promise<PhoneUseComObservation> {
    const result = await this.screenshotResponse();
    return { ...result.observation, ...(result.image ? { imageDataUrl: `data:${result.image.mimeType};base64,${result.image.data}` } : {}) };
  }

  async screenshotBytes(): Promise<Buffer> {
    const result = await this.screenshotResponse();
    if (!result.image) throw new Error("PhoneUse.com screenshot did not include image data.");
    return Buffer.from(result.image.data, "base64");
  }

  async dispatch(action: ProposedAction, authorization: PolicyDecision): Promise<{ success: boolean; postcondition: string }> {
    assertAuthorizedDispatch(action, authorization);
    const device = await this.device();
    const leaseId = await this.ensureLease(device.deviceId);
    if (action.command !== "open_app") throw new Error("PhoneUse.com adapter currently supports only allowlisted open_app actions; coordinate taps require a verified screen target.");
    if (!this.allowedAppIds.includes(action.argument)) throw new Error("PhoneUse.com app id is not allowlisted.");
    const args: Record<string, unknown> = { deviceId: device.deviceId, appId: action.argument, leaseId, idempotencyKey: action.id };
    if (this.lastFrameId) { args.observedFrame = this.lastFrameId; args.refuseIfOthersActed = true; }
    const { data } = await this.call("open_app", args);
    if (data.status !== "committed") return { success: false, postcondition: `phoneuse-com-open-app-${String(data.status ?? "unconfirmed")}` };
    return { success: true, postcondition: `phoneuse-com-open-app-committed:${device.deviceId}` };
  }

  async closeSession(): Promise<void> {
    if (!this.leaseId || !this.selectedDevice) return;
    const leaseId = this.leaseId;
    this.leaseId = undefined;
    await this.call("release_device", { deviceId: this.selectedDevice.deviceId, leaseId });
  }
}
