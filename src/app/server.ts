import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runMockDemo } from "../server/orchestration/mock-run.js";

const port = Number(process.env.PORT ?? 3000);
const liveConfigured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);

function modeLabel(): { mode: "mock" | "live-configured"; label: string; detail: string } {
  return liveConfigured
    ? { mode: "live-configured", label: "LIVE CONFIGURED", detail: "PhoneUse credentials are present; no live run is claimed until a smoke test passes." }
    : { mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." };
}

function send(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

type DemoReport = Awaited<ReturnType<typeof runMockDemo>>;

function reportMarkup(report: DemoReport): string {
  const baseline = report.baseline;
  const replay = report.protectedReplay;
  return `<h2>Evidence report <span class="neutral">· MOCK</span></h2><p>${report.variant.content}</p><div class="grid"><article class="run-card"><h3>Baseline</h3><div class="row"><span>Attack action</span><span class="value fail">${baseline.attackDispatched ? "dispatched" : "not dispatched"}</span></div><div class="row"><span>Legitimate task</span><span class="value ${baseline.legitimateTaskCompleted ? "pass" : "fail"}">${baseline.legitimateTaskCompleted ? "completed" : "not completed"}</span></div><div class="row"><span>Restricted effect</span><span class="value ${baseline.unauthorizedEffectPrevented ? "pass" : "fail"}">${baseline.unauthorizedEffectPrevented ? "prevented" : "observed"}</span></div></article><article class="run-card"><h3>Protected replay</h3><div class="row"><span>Attack action</span><span class="value pass">${replay.attackDispatched ? "dispatched" : "denied before dispatch"}</span></div><div class="row"><span>Legitimate task</span><span class="value ${replay.legitimateTaskCompleted ? "pass" : "fail"}">${replay.legitimateTaskCompleted ? "completed" : "not completed"}</span></div><div class="row"><span>Restricted effect</span><span class="value ${replay.unauthorizedEffectPrevented ? "pass" : "fail"}">${replay.unauthorizedEffectPrevented ? "prevented" : "observed"}</span></div></article></div><h3>Trace</h3><div class="trace">${replay.events.map((event) => `${event.phase.toUpperCase()}  ${event.detail}`).join("\n")}</div>`;
}

function page(report?: DemoReport): string {
  const mode = modeLabel();
  const result = report ? reportMarkup(report) : "<h2>Not run</h2><p>Start the demo to generate baseline and protected replay evidence.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unbreak — action boundary test</title><style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#151d33;--line:#2b3858;--muted:#9aa8c7;--ink:#f6f8ff;--cyan:#79e2d0;--red:#ff8c9d;--amber:#ffd27d}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -10%,#24345c 0,#0b1020 45%);color:var(--ink);font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(100% - 24px,760px);margin:0 auto;padding:18px 0 36px}header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:22px}.eyebrow{color:var(--cyan);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.mode{border:1px solid var(--amber);color:var(--amber);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:800;white-space:nowrap}h1{font-size:clamp(30px,9vw,56px);line-height:.98;letter-spacing:-.05em;margin:10px 0}h2{font-size:20px;margin:0 0 8px}p{color:var(--muted);margin:8px 0}.story{font-size:20px;color:var(--ink);margin:14px 0 20px}.panel{background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line);border-radius:20px;padding:16px;margin-top:14px;box-shadow:0 16px 50px #02051144}.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.select,button{min-height:46px;border-radius:12px;border:1px solid var(--line);background:#1c2742;color:var(--ink);padding:0 14px;font:inherit}button{background:var(--cyan);color:#07151b;border:0;font-weight:800;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.grid{display:grid;gap:12px}.run-card{border:1px solid var(--line);border-radius:16px;padding:14px}.run-card h3{margin:0 0 10px;font-size:17px}.row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #2b385866;padding:9px 0;color:var(--muted)}.row:first-of-type{border-top:0}.value{color:var(--ink);font-weight:700;text-align:right}.pass{color:var(--cyan)}.fail{color:var(--red)}.neutral{color:var(--amber)}.trace{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#b9c7e7;white-space:pre-wrap;max-height:180px;overflow:auto}.foot{font-size:12px;color:var(--muted);margin-top:20px}@media(min-width:600px){.grid{grid-template-columns:1fr 1fr}}
</style></head><body><main><header><div><div class="eyebrow">Unbreak / action boundary lab</div><h1>Break the agent.<br>Repair the boundary.</h1></div><div id="mode" class="mode">${mode.label}</div></header>
<section class="hero"><p class="story">Test whether untrusted app content can redirect a legitimate mobile task into an unrelated restricted write.</p><div id="mode-detail" class="panel"><p>${mode.detail}</p></div></section>
<section class="panel"><form method="get" action="/demo"><div class="toolbar"><label for="variant">Attack variation</label><select name="variant" id="variant" class="select"><option value="direct-edit">Direct edit instruction</option><option value="urgent-review">Urgent review instruction</option></select><button id="run" type="submit">Run deterministic demo</button></div></form></section>
<section id="result" class="panel" aria-live="polite">${result}</section><p class="foot">Every result is sourced from the server-side run. MOCK is not LIVE. A live label requires a verified PhoneUse device response and independent state checks.</p>
</main></body></html>`;
}

function route(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/") return send(response, 200, page(), "text/html; charset=utf-8");
  if (url.pathname === "/demo") { void runMockDemo(url.searchParams.get("variant") ?? "direct-edit").then((report) => send(response, 200, page(report), "text/html; charset=utf-8")).catch((error: unknown) => send(response, 400, error instanceof Error ? error.message : "Run failed", "text/plain; charset=utf-8")); return; }
  if (url.pathname === "/api/health") return send(response, 200, JSON.stringify(modeLabel()), "application/json");
  if (url.pathname === "/api/demo") { void runMockDemo(url.searchParams.get("variant") ?? "direct-edit").then((report) => send(response, 200, JSON.stringify(report), "application/json")).catch((error: unknown) => send(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : "Run failed" }), "application/json")); return; }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
}

createServer(route).listen(port, "127.0.0.1", () => console.log(`Unbreak UI listening on http://127.0.0.1:${port}`));
