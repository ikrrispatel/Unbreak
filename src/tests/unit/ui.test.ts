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
  assert.match(html, /PhoneUse actions/);
  assert.match(html, /Blocked here until an explicit live test boundary/);
});

test("presentation exposes a recoverable error state", () => {
  const html = renderErrorPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, "Synthetic fixture unavailable.");
  assert.match(html, /Could not retrieve device evidence/);
  assert.match(html, /Synthetic fixture unavailable/);
});

test("presentation report exposes baseline, repair, replay, and independent evidence", async () => {
  const report = await runMockDemo("urgent-review");
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only." }, report);
  assert.match(html, /Live surface/);
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
  assert.match(html, /Refresh to request a live observation/);
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

test("device image is constrained to the visible stage", () => {
  const html = renderPage(
    { mode: "mock", label: "MOCK MODE", detail: "Fixture only." },
    undefined,
    { kind: "screenshot", provenance: "recorded", screenId: "recorded-phoneuse:Safari", app: "Safari", imageDataUrl: "data:image/png;base64,recorded" },
  );
  assert.match(html, /\.device-image\{display:block;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain\}/);
});

test("light glass design system exposes compact mobile views", () => {
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Fixture only." });
  assert.match(html, /--canvas:#f7f8fa/);
  assert.match(html, /--glass:rgba\(255,255,255,\.65\)/);
  assert.match(html, /backdrop-filter:blur\(24px\) saturate\(160%\)/);
  assert.match(html, /--radius-panel:20px/);
  assert.match(html, /Workspace views/);
  assert.match(html, /href="#scenario"/);
  assert.match(html, /href="#device"/);
  assert.match(html, /href="#inspector"/);
});
