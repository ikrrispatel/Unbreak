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
    assert.match(unavailableBody, /unavailable/);
    assert.doesNotMatch(unavailableBody, /PHONE_USE_SANDBOX_TOKEN|Bearer\s/i);

    const writeAttempt = await fetch(`${base}/api/device/observe`, { method: "POST", body: JSON.stringify({ command: "tap" }) });
    assert.equal(writeAttempt.status, 405);
    assert.equal((await writeAttempt.json()).status, "method_not_allowed");

    const arbitraryDispatch = await fetch(`${base}/api/device/dispatch`, { method: "POST", body: JSON.stringify({ command: "tap" }) });
    assert.equal(arbitraryDispatch.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
