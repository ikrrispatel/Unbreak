import test from "node:test";
import assert from "node:assert/strict";
import { PhoneUseComAdapter } from "../../server/adapters/phoneuse-com.js";
import type { PolicyDecision, ProposedAction } from "../../domain/types.js";

const allow: PolicyDecision = { actionId: "open-pixel", decision: "allow", ruleId: "allow-safari", reason: "test", dispatched: true };
const openAction: ProposedAction = { id: "open-pixel", actionType: "read", targetApp: "com.android.settings", targetClass: "allowlisted-app-open", sourceTrust: "trusted_scenario", purpose: "safe app probe", command: "open_app", argument: "com.android.settings" };

function fakeFetch(calls: Array<{ name: string; arguments: Record<string, unknown> }>): typeof fetch {
  return (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { params: { name: string; arguments: Record<string, unknown> } };
    calls.push(body.params);
    const result = body.params.name === "list_devices"
      ? { structuredContent: { devices: [{ deviceId: "pixel-7-pro", status: "online", platform: "android", kind: "physical", capabilities: { fidelityTier: "physical" } }] } }
      : body.params.name === "acquire_device"
        ? { structuredContent: { deviceId: "pixel-7-pro", leaseId: "lease-1" } }
        : body.params.name === "screenshot"
          ? { structuredContent: { format: "png", frameId: "frame-1", capturedAt: "2026-11-13T00:00:00.000Z" }, content: [{ type: "image", mimeType: "image/png", data: "cG5n" }] }
          : body.params.name === "open_app"
            ? { structuredContent: { status: "committed", committedAt: "2026-11-13T00:00:01.000Z", idempotencyKey: "open-pixel" } }
            : { structuredContent: { ok: true, deviceId: "pixel-7-pro" } };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("PhoneUse.com adapter reads Android readiness and preserves provider provenance", async () => {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const adapter = new PhoneUseComAdapter({ apiKey: "pbk_test", allowedAppIds: ["com.android.settings"], fetchImpl: fakeFetch(calls) });
  const device = await adapter.readiness();
  assert.deepEqual(device, { deviceId: "pixel-7-pro", status: "online", platform: "android", kind: "physical", capabilities: { fidelityTier: "physical" } });
  const observation = await adapter.observeArtifact();
  assert.equal(observation.provenance, "phoneuse-com-mcp");
  assert.equal(observation.deviceId, "pixel-7-pro");
  assert.equal(observation.frameId, "frame-1");
  assert.equal(observation.imageDataUrl, "data:image/png;base64,cG5n");
  assert.deepEqual(calls.map(({ name }) => name), ["list_devices", "screenshot"]);
});

test("PhoneUse.com adapter dispatches only committed authorized open_app and releases its lease", async () => {
  const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const adapter = new PhoneUseComAdapter({ apiKey: "pbk_test", deviceId: "pixel-7-pro", allowedAppIds: ["com.android.settings"], fetchImpl: fakeFetch(calls) });
  await adapter.observe();
  const result = await adapter.dispatch(openAction, allow);
  assert.deepEqual(result, { success: true, postcondition: "phoneuse-com-open-app-committed:pixel-7-pro" });
  await adapter.closeSession();
  assert.deepEqual(calls.map(({ name }) => name), ["list_devices", "screenshot", "acquire_device", "open_app", "release_device"]);
  assert.equal(calls[3]?.arguments.observedFrame, "frame-1");
});

test("PhoneUse.com adapter fails readiness for a provisioned but offline device", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ result: { structuredContent: { devices: [{ deviceId: "pixel-7-pro", status: "offline", platform: "android" }] } } }), { status: 200 })) as typeof fetch;
  const adapter = new PhoneUseComAdapter({ apiKey: "pbk_test", allowedAppIds: ["com.android.settings"], fetchImpl });
  await assert.rejects(() => adapter.readiness(), /offline, not online/);
});
