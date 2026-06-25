import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { FirmProvisioningCard } from "./tenant-provisioning-card";

const serverFns = vi.hoisted(() => ({
  createFirm: vi.fn() as Mock,
  loadFirm: vi.fn() as Mock,
  kbUpload: vi.fn() as Mock,
  brainUpload: vi.fn() as Mock,
  deleteFirm: vi.fn() as Mock,
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => {
    if (fn === "createFirmProvisioning") return serverFns.createFirm;
    if (fn === "loadFirmProvisioningState") return serverFns.loadFirm;
    if (fn === "uploadFirmKnowledgeProvisioning") return serverFns.kbUpload;
    if (fn === "saveFirmBrainProvisioning") return serverFns.brainUpload;
    if (fn === "deleteFirmProvisioning") return serverFns.deleteFirm;
    throw new Error(`Unexpected server fn: ${String(fn)}`);
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: { firmSlug?: string };
    className?: string;
  }) => {
    let href = to;
    if (params?.firmSlug) {
      href = href.replace("$firmSlug", params.firmSlug);
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock("./server", () => ({
  createFirmProvisioning: "createFirmProvisioning",
  loadFirmProvisioningState: "loadFirmProvisioningState",
  saveFirmBrainProvisioning: "saveFirmBrainProvisioning",
  uploadFirmKnowledgeProvisioning: "uploadFirmKnowledgeProvisioning",
  deleteFirmProvisioning: "deleteFirmProvisioning",
}));

describe("FirmProvisioningCard", () => {
  beforeEach(() => {
    serverFns.createFirm.mockReset();
    serverFns.loadFirm.mockReset();
    serverFns.kbUpload.mockReset();
    serverFns.brainUpload.mockReset();
    serverFns.deleteFirm.mockReset();
    window.localStorage.clear();
  });

  function uploadFiles(input: HTMLInputElement, files: File[]) {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: files,
    });
    fireEvent.change(input);
  }

  async function createFirm(user: ReturnType<typeof userEvent.setup>) {
    serverFns.createFirm.mockResolvedValue({
      id: "firm-2",
      name: "Northline Advisory",
      slug: "northline-advisory",
      industry: "consulting",
      jurisdiction: "Nigeria",
      status: "active",
    });

    render(<FirmProvisioningCard />);

    await user.type(screen.getByLabelText(/business name/i), "Northline Advisory");
    await user.selectOptions(screen.getByLabelText(/industry/i), "consulting");
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/country/i), "NG");
    await user.click(screen.getByRole("button", { name: /create tenant/i }));

    expect(serverFns.createFirm).toHaveBeenCalledWith({
      data: {
        name: "Northline Advisory",
        industry: "consulting",
        jurisdiction: "NG",
      },
    });

    expect(await screen.findByRole("link", { name: /open dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard/northline-advisory",
    );
    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard/northline-advisory",
    );
    expect(screen.getByRole("link", { name: /open ask page/i })).toHaveAttribute(
      "href",
      "/ask/northline-advisory",
    );
    expect(screen.getByRole("heading", { name: /knowledge base upload/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /firm brain upload/i })).toBeInTheDocument();
  }

  it("submits a tenant and reveals the upload cards", async () => {
    const user = userEvent.setup();
    await createFirm(user);
  });

  it("accepts markdown uploads independently and shows separate success and error state", async () => {
    const user = userEvent.setup();
    await createFirm(user);

    serverFns.kbUpload.mockResolvedValue({
      revision: 3,
      contentHash: "abc123def456",
    });
    serverFns.brainUpload.mockRejectedValue(new Error("Brain compile failed"));

    const kbFile = new File(["# Company knowledge"], "company-knowledge.md", {
      type: "text/markdown",
    });
    uploadFiles(screen.getByLabelText(/knowledge base upload/i), [kbFile]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save knowledge base/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /save knowledge base/i }));

    expect(await screen.findByText(/saved\. revision 3/i)).toBeInTheDocument();
    expect(serverFns.kbUpload).toHaveBeenCalledWith({
      data: {
        firmSlug: "northline-advisory",
        filename: "company-knowledge.md",
        contentMarkdown: "# Company knowledge",
      },
    });

    const brainFile = new File(["# Brain"], "firm-brain.md", {
      type: "text/markdown",
    });
    uploadFiles(screen.getByLabelText(/firm brain upload/i), [brainFile]);
    await waitFor(() => expect(screen.getByRole("button", { name: /save brain/i })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /save brain/i }));

    expect(await screen.findByText(/brain compile failed/i)).toBeInTheDocument();
    expect(serverFns.brainUpload).toHaveBeenCalledWith({
      data: {
        firmSlug: "northline-advisory",
        filename: "firm-brain.md",
        contentMarkdown: "# Brain",
      },
    });
  });

  it("shows the live brain readout after a successful brain upload", async () => {
    const user = userEvent.setup();
    await createFirm(user);

    serverFns.brainUpload.mockResolvedValue({
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
    });

    const brainFile = new File(["# Brain"], "firm-brain.md", {
      type: "text/markdown",
    });
    uploadFiles(screen.getByLabelText(/firm brain upload/i), [brainFile]);
    await user.click(screen.getByRole("button", { name: /save brain/i }));

    expect(await screen.findByText(/saved\. revision 4/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /live brain readout/i })).toBeInTheDocument();
    expect(screen.getByText("firm-brain.md")).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
    expect(screen.getByText(/Northline Advisory is a consulting firm\./i)).toBeInTheDocument();
  });

  it("rejects non-md files", async () => {
    const user = userEvent.setup();
    await createFirm(user);

    const invalidFile = new File(["not markdown"], "company-knowledge.txt", {
      type: "text/plain",
    });
    uploadFiles(screen.getByLabelText(/knowledge base upload/i), [invalidFile]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save knowledge base/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /save knowledge base/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/choose a \.md file/i);
    expect(serverFns.kbUpload).not.toHaveBeenCalled();
  });

  it("disables the submit button while the tenant is being created", async () => {
    const user = userEvent.setup();
    serverFns.createFirm.mockImplementation(
      () =>
        new Promise(() => {
          /* pending */
        }),
    );

    render(<FirmProvisioningCard />);

    await user.type(screen.getByLabelText(/business name/i), "Northline Advisory");
    await user.selectOptions(screen.getByLabelText(/industry/i), "consulting");
    await user.selectOptions(screen.getByLabelText(/country/i), "NG");
    await user.click(screen.getByRole("button", { name: /create tenant/i }));

    expect(await screen.findByRole("button", { name: /creating tenant/i })).toBeDisabled();
  });
});
