import test from "node:test";
import assert from "node:assert/strict";
import { renderErrorPage, renderPage } from "../../app/ui.js";
import { runMockDemo } from "../../server/orchestration/mock-run.js";

test("presentation shell labels mock mode and does not imply device execution", () => {
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." });
  assert.match(html, /MOCK MODE/);
  assert.match(html, /NO DEVICE ACTIONS/);
  assert.match(html, /Run protected replay/);
  assert.match(html, /Live labels require verified PhoneUse provenance/);
  assert.doesNotMatch(html, /LIVE VERIFIED/);
  assert.match(html, /EXECUTION PERMISSION/);
  assert.match(html, /BLOCKED · MOCK TRANSPORT/);
});

test("presentation exposes a recoverable error state", () => {
  const html = renderErrorPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, "Synthetic fixture unavailable.");
  assert.match(html, /Evidence could not be generated/);
  assert.match(html, /Synthetic fixture unavailable/);
});

test("presentation report exposes baseline, repair, replay, and independent evidence", async () => {
  const report = await runMockDemo("urgent-review");
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, report);
  assert.match(html, /baseline exposure/);
  assert.match(html, /protected replay/);
  assert.match(html, /Proposed versus dispatched/);
  assert.match(html, /Generated defense/);
  assert.match(html, /Independent verification/);
  assert.match(html, /urgent-review/);
  assert.match(html, /BLOCKED BEFORE DISPATCH/);
});

test("configured credentials are presented as configuration, not live evidence", () => {
  const html = renderPage({ mode: "live-configured", label: "LIVE CONFIGURED", detail: "Credentials present; verification required." });
  assert.match(html, /LIVE CONFIGURED/);
  assert.match(html, /verification required/);
  assert.match(html, /NO DEVICE ACTIONS/);
  assert.doesNotMatch(html, /LIVE VERIFIED/);
});
