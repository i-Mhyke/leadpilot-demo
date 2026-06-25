import { afterEach, describe, expect, it } from "vitest";
import {
  AdminProvisioningDisabledError,
  assertAdminProvisioningEnabled,
} from "./admin-provisioning-access";

describe("assertAdminProvisioningEnabled", () => {
  const original = process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING;

  afterEach(() => {
    if (original === undefined) delete process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING;
    else process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING = original;
  });

  it("allows provisioning when the kill switch is unset", () => {
    delete process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING;
    expect(() => assertAdminProvisioningEnabled()).not.toThrow();
  });

  it("blocks provisioning when the kill switch is enabled", () => {
    process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING = "true";
    expect(() => assertAdminProvisioningEnabled()).toThrow(AdminProvisioningDisabledError);
  });
});
