export class AdminProvisioningDisabledError extends Error {
  constructor() {
    super("Admin provisioning is disabled for this deployment.");
    this.name = "AdminProvisioningDisabledError";
  }
}

export function assertAdminProvisioningEnabled() {
  if (process.env.LEADPILOT_DISABLE_ADMIN_PROVISIONING === "true") {
    throw new AdminProvisioningDisabledError();
  }
}
