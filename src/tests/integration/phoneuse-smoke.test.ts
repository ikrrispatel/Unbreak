import test from "node:test";
import { PhoneUseSdkAdapter } from "../../server/adapters/phoneuse.js";

const enabled = process.env.PHONE_USE_RUN_LIVE_SMOKE === "1";
const configured = Boolean(process.env.PHONE_USE_SANDBOX_URL && process.env.PHONE_USE_SANDBOX_TOKEN);

test("live PhoneUse smoke: observe and close only", { skip: !enabled || !configured ? "Set PHONE_USE_RUN_LIVE_SMOKE=1 plus sandbox URL/token to opt in." : false }, async () => {
  const adapter = await PhoneUseSdkAdapter.create({ allowedApps: [], allowedTapLabels: [] });
  try {
    const observation = await adapter.observe();
    if (!observation.screenId.includes("phone-use")) throw new Error("Unexpected PhoneUse observation provenance.");
  } finally {
    await adapter.close();
  }
});
