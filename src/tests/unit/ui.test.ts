import test from "node:test";
import assert from "node:assert/strict";
import { renderErrorPage, renderPage } from "../../app/ui.js";
import { runMockDemo } from "../../server/orchestration/mock-run.js";

test("presentation shell labels mock mode and does not imply device execution", () => {
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." });
  assert.match(html, /MOCK MODE/);
  assert.match(html, /PhoneUse device/);
  assert.match(html, /NO DEVICE OBSERVATION/);
  assert.match(html, /Run attack → repair → replay/);
  assert.match(html, /MOCK is deterministic fixture evidence/);
  assert.doesNotMatch(html, /LIVE VERIFIED/);
  assert.match(html, /PHONEUSE ACTIONS/);
  assert.match(html, /Blocked in this workspace/);
});

test("presentation exposes a recoverable error state", () => {
  const html = renderErrorPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, "Synthetic fixture unavailable.");
  assert.match(html, /Evidence could not be generated/);
  assert.match(html, /Synthetic fixture unavailable/);
});

test("presentation report exposes baseline, repair, replay, and independent evidence", async () => {
  const report = await runMockDemo("urgent-review");
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, report);
  assert.match(html, /Device observation/);
  assert.match(html, /ACTION LEDGER|Proposed actions/);
  assert.match(html, /Generated patch/);
  assert.match(html, /Independent verification|Independent assertions/);
  assert.match(html, /urgent-review/);
  assert.match(html, /BLOCKED/);
  assert.match(html, /mock-seeded-fixture/);
});

test("configured credentials are presented as configuration, not live evidence", () => {
  const html = renderPage({ mode: "live-configured", label: "LIVE CONFIGURED", detail: "Credentials present; verification required." });
  assert.match(html, /LIVE CONFIGURED/);
  assert.match(html, /verification required/);
  assert.match(html, /NO DEVICE OBSERVATION/);
  assert.match(html, /Credentials are present, but no observation has been requested/);
  assert.doesNotMatch(html, /LIVE VERIFIED/);
});

test("device panel renders only supplied recorded artifacts", () => {
  const html = renderPage(
    { mode: "mock", label: "MOCK MODE", detail: "Fixture only." },
    undefined,
    { kind: "screenshot", provenance: "recorded", screenId: "recorded-phoneuse:Safari", app: "Safari", imageDataUrl: "data:image/png;base64,recorded" },
  );
  assert.match(html, /RECORDED/);
  assert.match(html, /recorded-phoneuse:Safari/);
  assert.match(html, /recorded/);
  assert.doesNotMatch(html, /NO DEVICE OBSERVATION/);
});
