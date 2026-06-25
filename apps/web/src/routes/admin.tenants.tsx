import { createFileRoute } from "@tanstack/react-router";
import { AdminTenantsPage } from "@/pages/admin-tenants-page";
import { parseFirmProvisioningSearchRequest } from "@/features/firms/validators";

export const Route = createFileRoute("/admin/tenants")({
  validateSearch: parseFirmProvisioningSearchRequest,
  component: AdminTenantsPage,
});
