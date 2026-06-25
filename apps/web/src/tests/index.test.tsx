import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Home } from "../pages/home";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
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

describe("Home", () => {
  it("routes tenant creation to the admin surface", () => {
    render(<Home />);

    expect(screen.getByRole("link", { name: /open admin tenants/i })).toHaveAttribute(
      "href",
      "/admin/tenants",
    );
    expect(screen.queryByText(/provision a tenant/i)).toBeNull();
  });
});
