import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { renderErrorPage, renderPage, type DeviceConnectionState, type ObservationArtifact, type PresentationMode } from "./ui.js";
import { runMockDemo } from "../server/orchestration/mock-run.js";
import { PhoneUseSdkAdapter } from "../server/adapters/phoneuse.js";
import { dispatchThroughAuthorizationGateway } from "../server/orchestration/authorized-dispatch.js";
import { attackVariants } from "../domain/scenarios.js";
import type { Policy, ProposedAction } from "../domain/types.js";

const port = Number(process.env.PORT ?? 3000);
const liveConfigured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);

type PhoneUseFailure = { status: Exclude<DeviceConnectionState, "connected" | "unverified">; code: string; message: string; retryable: boolean };

function classifyPhoneUseError(error: unknown): PhoneUseFailure {
  const candidate = error as { code?: unknown; retryable?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "UNKNOWN";
  const message = typeof candidate.message === "string" && candidate.message.length > 0 ? candidate.message : "PhoneUse observation failed.";
  const normalized = `${code} ${message}`.toLowerCase();
  if (/back.?end_not_found|sandbox.*(not configured|needs)|missing.*sandbox/.test(normalized)) return { status: "not_configured", code, message, retryable: false };
  if (/session_not_found|session not found|unauthori[sz]ed|\b401\b|\b403\b|expired|aborted/.test(normalized)) return { status: "expired", code, message, retryable: false };
  return { status: "unavailable", code, message, retryable: candidate.retryable === true };
}

function modeFor(state: DeviceConnectionState, reason?: string, code?: string): PresentationMode {
  const label = state === "connected" ? "CONNECTED" : state === "expired" ? "EXPIRED" : state === "unavailable" ? "UNAVAILABLE" : state === "not_configured" ? "NOT CONFIGURED" : "UNVERIFIED";
  return { mode: state === "connected" ? "live-configured" : "mock", label, detail: state === "connected" ? "PhoneUse observation verified." : state === "not_configured" ? "No PhoneUse transport is configured." : "PhoneUse connectivity is not verified.", connectionState: state, connectionReason: reason, connectionCode: code };
}

const mode = liveConfigured ? modeFor("unverified") : modeFor("not_configured");

function send(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

function sendScreenshot(response: ServerResponse, bytes: Buffer): void {
  response.writeHead(200, {
    "content-type": "image/png",
    "content-length": bytes.byteLength,
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
  });
  response.end(bytes);
}

async function observeLiveDevice(): Promise<ObservationArtifact> {
  if (!liveConfigured) throw new Error("PhoneUse sandbox is not configured on the server.");
  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] });
  const observation = await adapter.observeArtifact();
  return {
    kind: observation.screenshotDataUrl ? "screenshot" : "snapshot",
    provenance: "live",
    app: observation.appIdentity ?? observation.app ?? observation.appBundleId,
    screenId: observation.screenId,
    observedAt: observation.observedAt,
    imageDataUrl: observation.screenshotDataUrl,
  };
}

async function readDeviceReadiness(): Promise<{ status: DeviceConnectionState; app?: string; observedAt?: string; reason?: string; code?: string; retryable?: boolean }> {
  if (!liveConfigured) return { status: "not_configured", reason: "PhoneUse sandbox credentials are not configured on the server.", code: "BACKEND_NOT_FOUND", retryable: false };
  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] });
  const observation = await adapter.observe();
  const readiness: { status: DeviceConnectionState; app?: string; observedAt?: string; reason?: string; code?: string; retryable?: boolean } = { status: "connected" };
  const app = observation.appIdentity ?? observation.app ?? observation.appBundleId;
  if (app) readiness.app = app;
  if (observation.observedAt) readiness.observedAt = observation.observedAt;
  return readiness;
}

async function runLiveSafeProbe(): Promise<{ artifact: ObservationArtifact; reason: string }> {
  if (!liveConfigured) throw new Error("Live PhoneUse run is not configured; use /demo only for explicitly labeled mock evidence.");
  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] });
  const before = await adapter.observe();
  const action: ProposedAction = {
    id: "live-safe-safari-open",
    actionType: "read",
    targetApp: "Safari",
    targetClass: "allowlisted-app-open",
    sourceTrust: "trusted_scenario",
    purpose: "open the allowlisted Safari surface for live verification",
    command: "open_app",
    argument: "Safari",
  };
  const policy: Policy = {
    id: "live-safe-safari-open-policy",
    version: 1,
    scenarioId: "live-safe-safari-open",
    rules: [{ id: "allow-live-safe-safari-open", actionType: "read", targetClass: "allowlisted-app-open", sourceTrust: "trusted_scenario", effect: "allow", reason: "Explicitly allowlisted read-only Safari launch." }],
  };
  const gated = await dispatchThroughAuthorizationGateway(adapter, policy, action);
  if (gated.decision.decision !== "allow" || !gated.decision.dispatched || !gated.result?.success) throw new Error("Live Safari action did not complete through the authorization gateway.");
  const after = await adapter.observe();
  if (after.appIdentity !== "Safari") throw new Error(`Independent verification failed: expected Safari, observed ${after.appIdentity ?? "unknown app"}.`);
  const artifactObservation = await adapter.observeArtifact();
  const artifact: ObservationArtifact = {
    kind: artifactObservation.screenshotDataUrl ? "screenshot" : "snapshot",
    provenance: "live",
    app: artifactObservation.appIdentity ?? artifactObservation.app ?? artifactObservation.appBundleId,
    screenId: artifactObservation.screenId,
    observedAt: artifactObservation.observedAt,
    imageDataUrl: artifactObservation.screenshotDataUrl,
  };
  return { artifact, reason: `LIVE VERIFIED: allowlisted Safari open authorized and independently observed (${before.appIdentity ?? "unknown"} → ${after.appIdentity}).` };
}

function route(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    if (!liveConfigured && url.searchParams.get("observe") !== "1") return send(response, 200, renderPage(mode), "text/html; charset=utf-8");
    void observeLiveDevice()
      .then((artifact) => send(response, 200, renderPage(modeFor("connected"), undefined, artifact), "text/html; charset=utf-8"))
      .catch((error: unknown) => { const failure = classifyPhoneUseError(error); send(response, 503, renderErrorPage(modeFor(failure.status, failure.message, failure.code), failure.message), "text/html; charset=utf-8"); });
    return;
  }
  if (url.pathname === "/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, renderPage({ ...mode, mode: "mock", label: "MOCK RUN", detail: "Deterministic fixture only. PhoneUse was not invoked." }, report), "text/html; charset=utf-8"))
      .catch((error: unknown) => send(response, 500, renderErrorPage(mode, error instanceof Error ? error.message : "Run failed"), "text/html; charset=utf-8"));
    return;
  }
  if (url.pathname === "/live-run") {
    if (!liveConfigured) return send(response, 503, renderErrorPage(modeFor("not_configured", "Live PhoneUse run is not configured; use /demo only for explicitly labeled mock evidence.", "BACKEND_NOT_FOUND"), "Live PhoneUse run is not configured; use /demo only for explicitly labeled mock evidence."), "text/html; charset=utf-8");
    void runLiveSafeProbe()
      .then(({ artifact, reason }) => send(response, 200, renderPage(modeFor("connected", reason, "LIVE_SAFE_PROBE_VERIFIED"), undefined, artifact), "text/html; charset=utf-8"))
      .catch((error: unknown) => { const failure = classifyPhoneUseError(error); send(response, 503, renderErrorPage(modeFor(failure.status, failure.message, failure.code), failure.message), "text/html; charset=utf-8"); });
    return;
  }
  if (url.pathname === "/api/health") return send(response, 200, JSON.stringify(mode), "application/json");
  if (url.pathname === "/api/device/readiness") {
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ status: "method_not_allowed" }), "application/json");
    void readDeviceReadiness()
      .then((readiness) => send(response, 200, JSON.stringify(readiness), "application/json"))
      .catch((error: unknown) => { const failure = classifyPhoneUseError(error); send(response, 200, JSON.stringify(failure), "application/json"); });
    return;
  }
  if (url.pathname === "/api/device/observe") {
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ status: "method_not_allowed" }), "application/json");
    void observeLiveDevice()
      .then((artifact) => send(response, 200, JSON.stringify({ status: "connected", artifact: { ...artifact, imageDataUrl: artifact.imageDataUrl ? "present" : undefined } }), "application/json"))
      .catch((error: unknown) => { const failure = classifyPhoneUseError(error); send(response, 503, JSON.stringify(failure), "application/json"); });
    return;
  }
  if (url.pathname === "/api/device/screenshot") {
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ status: "method_not_allowed" }), "application/json");
    if (!liveConfigured) return send(response, 503, JSON.stringify({ status: "not_configured", code: "BACKEND_NOT_FOUND", retryable: false, reason: "PhoneUse sandbox is not configured on the server." }), "application/json");
    void PhoneUseSdkAdapter.create({ allowedApps: ["Safari"], allowedTapLabels: [] })
      .then((adapter) => adapter.screenshotBytes())
      .then((bytes) => sendScreenshot(response, bytes))
      .catch((error: unknown) => { const failure = classifyPhoneUseError(error); send(response, 503, JSON.stringify(failure), "application/json"); });
    return;
  }
  if (url.pathname === "/api/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, JSON.stringify(report), "application/json"))
      .catch((error: unknown) => send(response, 500, JSON.stringify({ error: error instanceof Error ? error.message : "Run failed" }), "application/json"));
    return;
  }
  if (url.pathname === "/api/scenarios") {
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ status: "method_not_allowed" }), "application/json");
    return send(response, 200, JSON.stringify({ scenarios: attackVariants.map(({ id, content }) => ({ id, title: id, content })) }), "application/json");
  }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
}

export function createUnbreakServer() {
  return createServer(route);
}

if (process.env.UNBREAK_IMPORT_ONLY !== "1") {
  createUnbreakServer().listen(port, "127.0.0.1", () => console.log(`Unbreak UI listening on http://127.0.0.1:${port}`));
}
