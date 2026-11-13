import test from "node:test";
import assert from "node:assert/strict";
import { PhoneUseSdkAdapter, type PhoneUseSdkDevice } from "../../server/adapters/phoneuse.js";

function action(argument: string) {
  return {
    id: "open-app-test",
    actionType: "read" as const,
    targetApp: argument,
    targetClass: "allowlisted-app-open",
    sourceTrust: "trusted_scenario" as const,
    purpose: "controlled app-open smoke test",
    command: "open_app" as const,
    argument,
  };
}

test("non-allowlisted app is denied before SDK dispatch", async () => {
  let openCalls = 0;
  const fakeDevice: PhoneUseSdkDevice = {
    backendName: "phone-use-cloud",
    apps: { open: async () => { openCalls += 1; return { success: true, message: "unexpected" }; } },
    observe: async () => ({ success: true, message: "unused", app: "Home" }),
    tap: async () => ({ success: true, message: "unused" }),
    closeSession: async () => undefined,
  };
  const adapter = new PhoneUseSdkAdapter(fakeDevice, { allowedApps: ["Safari"], allowedTapLabels: [] });

  await assert.rejects(() => adapter.dispatch(action("Messages")), /not allowlisted/);
  assert.equal(openCalls, 0);
});

test("allowlisted app reaches the SDK adapter boundary", async () => {
  let opened = "";
  const fakeDevice: PhoneUseSdkDevice = {
    backendName: "phone-use-cloud",
    apps: { open: async (app) => { opened = app; return { success: true, message: "ok" }; } },
    observe: async () => ({ success: true, message: "unused", app: "Safari" }),
    tap: async () => ({ success: true, message: "unused" }),
    closeSession: async () => undefined,
  };
  const adapter = new PhoneUseSdkAdapter(fakeDevice, { allowedApps: ["Safari"], allowedTapLabels: [] });

  const result = await adapter.dispatch(action("Safari"));
  assert.equal(result.success, true);
  assert.equal(opened, "Safari");
});
