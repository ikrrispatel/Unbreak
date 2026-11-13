import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { renderErrorPage, renderPage } from "./ui.js";
import { runMockDemo } from "../server/orchestration/mock-run.js";

const port = Number(process.env.PORT ?? 3000);
const liveConfigured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);
const mode = liveConfigured
  ? { mode: "live-configured" as const, label: "LIVE CONFIGURED", detail: "PhoneUse credentials are present; no live run is claimed until a smoke test passes." }
  : { mode: "mock" as const, label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." };

function send(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

function route(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") return send(response, 200, renderPage(mode), "text/html; charset=utf-8");
  if (url.pathname === "/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, renderPage(mode, report), "text/html; charset=utf-8"))
      .catch((error: unknown) => send(response, 500, renderErrorPage(mode, error instanceof Error ? error.message : "Run failed"), "text/html; charset=utf-8"));
    return;
  }
  if (url.pathname === "/api/health") return send(response, 200, JSON.stringify(mode), "application/json");
  if (url.pathname === "/api/demo") {
    void runMockDemo(url.searchParams.get("variant") ?? "direct-edit")
      .then((report) => send(response, 200, JSON.stringify(report), "application/json"))
      .catch((error: unknown) => send(response, 500, JSON.stringify({ error: error instanceof Error ? error.message : "Run failed" }), "application/json"));
    return;
  }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
}

createServer(route).listen(port, "127.0.0.1", () => console.log(`Unbreak UI listening on http://127.0.0.1:${port}`));
