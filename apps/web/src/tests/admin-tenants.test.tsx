import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AdminTenantsPage } from "../routes/admin.tenants";

const serverFns = vi.hoisted(() => ({
  createFirm: vi.fn() as Mock,
  loadPage: vi.fn() as Mock,
  uploadKnowledge: vi.fn() as Mock,
  uploadBrain: vi.fn() as Mock,
}));

const routeState = vi.hoisted(() => ({
  search: {} as { firmSlug?: string; mode?: "add" },
  navigate: vi.fn() as Mock,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => {
    if (fn === "createFirmProvisioning") return serverFns.createFirm;
    if (fn === "loadFirmProvisioningPageState") return serverFns.loadPage;
    if (fn === "uploadFirmKnowledgeProvisioning") return serverFns.uploadKnowledge;
    if (fn === "saveFirmBrainProvisioning") return serverFns.uploadBrain;
    throw new Error(`Unexpected server fn: ${String(fn)}`);
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({
    useNavigate: () => routeState.navigate,
    useSearch: () => routeState.search,
  }),
  Link: ({
    children,
    to,
    params,
    search,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: { firmSlug?: string };
    search?: Record<string, string | undefined> | ((current: Record<string, string | undefined>) => Record<string, string | undefined>);
    className?: string;
  }) => {
    let href = to;
    if (params?.firmSlug) {
      href = href.replace("$firmSlug", params.firmSlug);
    }

    const currentSearch = {};
    const resolvedSearch =
      typeof search === "function" ? search(currentSearch) : search ?? currentSearch;
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearch)) {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    }
    const searchString = query.toString();
    if (searchString) {
      href = `${href}?${searchString}`;
    }

    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock("../features/firms/server", () => ({
  createFirmProvisioning: "createFirmProvisioning",
  loadFirmProvisioningPageState: "loadFirmProvisioningPageState",
  saveFirmBrainProvisioning: "saveFirmBrainProvisioning",
  uploadFirmKnowledgeProvisioning: "uploadFirmKnowledgeProvisioning",
}));

describe("AdminTenantsPage", () => {
  beforeEach(() => {
    serverFns.createFirm.mockReset();
    serverFns.loadPage.mockReset();
    serverFns.uploadKnowledge.mockReset();
    serverFns.uploadBrain.mockReset();
    routeState.search = {};
    routeState.navigate.mockReset();
  });

  it("renders the firm sidebar and empty state when no firm is selected", async () => {
    serverFns.loadPage.mockResolvedValue({
      firms: [
        {
          id: "firm-1",
          name: "Acme Law",
          slug: "acme-law",
          industry: "legal",
          jurisdiction: "Nigeria",
          status: "active",
        },
      ],
      selectedFirm: null,
      brainConfig: null,
      selectionError: null,
    });

    render(<AdminTenantsPage />);

    expect(screen.getByText(/^admin surface$/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /provision tenant workspaces/i })).toBeInTheDocument();
    expect(screen.getByText(/existing firms/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add/i })).toHaveAttribute("href", "/admin/tenants?mode=add");
    expect(await screen.findByText(/acme law/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /select a firm/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });

  it("shows the create form in add mode", async () => {
    routeState.search = { mode: "add" };
    serverFns.loadPage.mockResolvedValue({
      firms: [],
      selectedFirm: null,
      brainConfig: null,
      selectionError: null,
    });

    render(<AdminTenantsPage />);

    expect(await screen.findByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create tenant/i })).toBeInTheDocument();
  });

  it("loads the selected firm brain readout from the url", async () => {
    routeState.search = { firmSlug: "northline-advisory" };
    serverFns.loadPage.mockResolvedValue({
      firms: [
        {
          id: "firm-2",
          name: "Northline Advisory",
          slug: "northline-advisory",
          industry: "consulting",
          jurisdiction: "United Kingdom",
          status: "active",
        },
      ],
      selectedFirm: {
        id: "firm-2",
        name: "Northline Advisory",
        slug: "northline-advisory",
        industry: "consulting",
        jurisdiction: "United Kingdom",
        status: "active",
      },
      brainConfig: {
        firmId: "firm-2",
        sourceFilename: "firm-brain.md",
        rawMarkdown: "# Brain",
        contentHash: "abc123def456",
        revision: 4,
        compiled: {
          businessSummary: "Northline Advisory is a consulting firm.",
          tone: { notes: [] },
          greeting: "Open with a short welcome.",
          qualificationPosture: [],
          escalationRules: [],
          forbiddenClaims: [],
          serviceEmphasis: [],
        },
        compiledAt: "2026-06-24T00:00:00.000Z",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T00:00:00.000Z",
      },
    });

    render(<AdminTenantsPage />);

    expect(await screen.findByRole("heading", { name: /live brain readout/i })).toBeInTheDocument();
    expect(screen.getByText(/northline advisory is a consulting firm/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard/northline-advisory",
    );
    expect(screen.getByRole("link", { name: /add/i })).toHaveAttribute("href", "/admin/tenants?mode=add");
  });
});
