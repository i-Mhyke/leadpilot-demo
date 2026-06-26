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
  it("renders the landing hero headline", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /turn every enquiry into a qualified lead/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/provision a tenant/i)).toBeNull();
  });
});
