import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.UNBREAK_IMPORT_ONLY = "1";
const { createUnbreakServer } = await import("../../app/server.js");

test("browser observation access is read-only and never exposes server credentials", async () => {
  const server = createUnbreakServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    const unavailable = await fetch(`${base}/api/device/observe`);
    const unavailableBody = await unavailable.text();
    assert.equal(unavailable.status, 503);
    assert.match(unavailableBody, /not_configured/);
    assert.doesNotMatch(unavailableBody, /PHONE_USE_SANDBOX_TOKEN|Bearer\s/i);

    const readiness = await fetch(`${base}/api/device/readiness`);
    assert.equal(readiness.status, 200);
    assert.equal((await readiness.json()).status, "not_configured");

    const scenarios = await fetch(`${base}/api/scenarios`);
    assert.equal(scenarios.status, 200);
    assert.equal((await scenarios.json()).scenarios.length, 2);

    const screenshot = await fetch(`${base}/api/device/screenshot`);
    assert.equal(screenshot.status, 503);
    assert.match(await screenshot.text(), /not_configured/);

    const writeAttempt = await fetch(`${base}/api/device/observe`, { method: "POST", body: JSON.stringify({ command: "tap" }) });
    assert.equal(writeAttempt.status, 405);
    assert.equal((await writeAttempt.json()).status, "method_not_allowed");

    const arbitraryDispatch = await fetch(`${base}/api/device/dispatch`, { method: "POST", body: JSON.stringify({ command: "tap" }) });
    assert.equal(arbitraryDispatch.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
