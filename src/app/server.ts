import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { renderErrorPage, renderPage, type ObservationArtifact } from "./ui.js";
import { runMockDemo } from "../server/orchestration/mock-run.js";
import { PhoneUseSdkAdapter } from "../server/adapters/phoneuse.js";

const port = Number(process.env.PORT ?? 3000);
const liveConfigured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);
const mode = liveConfigured
  ? { mode: "live-configured" as const, label: "LIVE CONFIGURED", detail: "PhoneUse credentials are present; no live run is claimed until a smoke test passes." }
  : { mode: "mock" as const, label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." };

function send(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
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

function route(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    if (url.searchParams.get("observe") !== "1") return send(response, 200, renderPage(mode), "text/html; charset=utf-8");
    void observeLiveDevice()
      .then((artifact) => send(response, 200, renderPage(mode, undefined, artifact), "text/html; charset=utf-8"))
      .catch((error: unknown) => send(response, 503, renderErrorPage(mode, error instanceof Error ? error.message : "PhoneUse observation failed."), "text/html; charset=utf-8"));
    return;
  }
  if (url.pathname === "/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, renderPage(mode, report), "text/html; charset=utf-8"))
      .catch((error: unknown) => send(response, 500, renderErrorPage(mode, error instanceof Error ? error.message : "Run failed"), "text/html; charset=utf-8"));
    return;
  }
  if (url.pathname === "/api/health") return send(response, 200, JSON.stringify(mode), "application/json");
  if (url.pathname === "/api/device/observe") {
    if (request.method !== "GET") return send(response, 405, JSON.stringify({ status: "method_not_allowed" }), "application/json");
    void observeLiveDevice()
      .then((artifact) => send(response, 200, JSON.stringify({ status: "observed", artifact: { ...artifact, imageDataUrl: artifact.imageDataUrl ? "present" : undefined } }), "application/json"))
      .catch((error: unknown) => send(response, 503, JSON.stringify({ status: "unavailable", reason: error instanceof Error ? error.message : "PhoneUse observation failed." }), "application/json"));
    return;
  }
  if (url.pathname === "/api/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, JSON.stringify(report), "application/json"))
      .catch((error: unknown) => send(response, 500, JSON.stringify({ error: error instanceof Error ? error.message : "Run failed" }), "application/json"));
    return;
  }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
}

export function createUnbreakServer() {
  return createServer(route);
}

if (process.env.UNBREAK_IMPORT_ONLY !== "1") {
  createUnbreakServer().listen(port, "127.0.0.1", () => console.log(`Unbreak UI listening on http://127.0.0.1:${port}`));
}
