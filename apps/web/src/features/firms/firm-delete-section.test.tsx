import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { FirmDeleteSection } from "./firm-delete-section";

const deleteFirm = vi.fn() as Mock;

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => deleteFirm,
}));

vi.mock("./server", () => ({
  deleteFirmProvisioning: "deleteFirmProvisioning",
}));

describe("FirmDeleteSection", () => {
  beforeEach(() => {
    deleteFirm.mockReset();
    window.localStorage.clear();
  });

  it("requires typing the firm slug before delete is enabled", async () => {
    const user = userEvent.setup();
    render(
      <FirmDeleteSection
        firm={{
          id: "firm-1",
          name: "Northline Advisory",
          slug: "northline-advisory",
          industry: "consulting",
          jurisdiction: "United Kingdom",
          status: "active",
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /delete firm/i });
    expect(button).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "northline-advisory");
    expect(button).toBeEnabled();
  });

  it("deletes the firm and clears stored demo sessions", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    deleteFirm.mockResolvedValue({ slug: "northline-advisory" });
    window.localStorage.setItem(
      "leadpilot.demo.sessions",
      JSON.stringify([
        {
          id: "session-1",
          firmSlug: "northline-advisory",
          customerName: "New conversation",
          matterLabel: "No topic yet",
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
        {
          id: "session-2",
          firmSlug: "demo-law",
          customerName: "New conversation",
          matterLabel: "No topic yet",
          updatedAt: "2026-06-24T00:00:00.000Z",
        },
      ]),
    );
    window.localStorage.setItem(
      "leadpilot.demo.activeSessionId",
      JSON.stringify({ "northline-advisory": "session-1", "demo-law": "session-2" }),
    );

    render(
      <FirmDeleteSection
        firm={{
          id: "firm-1",
          name: "Northline Advisory",
          slug: "northline-advisory",
          industry: "consulting",
          jurisdiction: "United Kingdom",
          status: "active",
        }}
        onDeleted={onDeleted}
      />,
    );

    await user.type(screen.getByRole("textbox"), "northline-advisory");
    await user.click(screen.getByRole("button", { name: /delete firm/i }));

    await waitFor(() => {
      expect(deleteFirm).toHaveBeenCalledWith({
        data: { firmSlug: "northline-advisory" },
      });
    });
    expect(onDeleted).toHaveBeenCalled();

    const stored = JSON.parse(window.localStorage.getItem("leadpilot.demo.sessions") ?? "[]") as Array<{
      firmSlug: string;
    }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]?.firmSlug).toBe("demo-law");
    expect(JSON.parse(window.localStorage.getItem("leadpilot.demo.activeSessionId") ?? "{}")).toEqual({
      "demo-law": "session-2",
    });
  });
});
