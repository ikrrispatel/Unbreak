import test from "node:test";
import assert from "node:assert/strict";
import { renderErrorPage, renderPage } from "../../app/ui.js";
import { runMockDemo } from "../../server/orchestration/mock-run.js";

test("presentation shell labels mock mode and does not imply device execution", () => {
  const html = renderPage({ mode: "mock", label: "MOCK MODE", detail: "Deterministic fixture only. No phone action was executed." });
  assert.match(html, /MOCK MODE/);
  assert.match(html, /PhoneUse device/);
  assert.match(html, /NO DEVICE OBSERVATION/);
  assert.match(html, /Run security test/);
  assert.doesNotMatch(html, /No active run|Run inspector|Run trace/);
  assert.doesNotMatch(html, /LIVE VERIFIED/);
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
  assert.match(html, /Mock execution · no PhoneUse dispatch/);
  assert.doesNotMatch(html, /CONNECTED/);
  assert.match(html, /Run trace/);
  assert.match(html, /href="#inspector"/);
});

test("configured credentials are presented as configuration, not live evidence", () => {
  const html = renderPage({ mode: "live-configured", label: "LIVE CONFIGURED", detail: "Credentials present; verification required." });
  assert.match(html, /UNVERIFIED/);
  assert.doesNotMatch(html, /LIVE CONFIGURED/);
  assert.match(html, /NO DEVICE OBSERVATION/);
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
  assert.match(html, /\.device-stage\{height:min\(640px,calc\(100dvh - 220px\)\);min-height:0;overflow:visible\}/);
  assert.match(html, /@media\(min-width:701px\)\{\.page-head\{padding-bottom:0\}/);
  assert.match(html, /\.device-image\{width:260px;height:auto;aspect-ratio:402 \/ 874;max-height:100%;object-fit:contain\}/);
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
  assert.doesNotMatch(html, /href="#inspector"/);
});
