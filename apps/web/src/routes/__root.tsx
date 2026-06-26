import type { ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import "../styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LeadPilot" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const isBareShell =
    pathname.startsWith("/ask/") ||
    /^\/dashboard\/[^/]+(\/.*)?$/.test(pathname);

  return (
    <RootDocument>
      {isBareShell ? (
        <Outlet />
      ) : (
        <div className="shell">
          <header className={pathname === "/" ? "landing-topbar" : "topbar"}>
            <Link to="/" className={pathname === "/" ? "landing-brand" : "brand"}>
              LeadPilot
            </Link>
            <nav className={pathname === "/" ? "landing-nav" : "nav"}>
              <Link to="/ask/$firmSlug" params={{ firmSlug: "demo-law" }}>
                Ask page
              </Link>
              <Link to="/dashboard/$firmSlug" params={{ firmSlug: "demo-law" }}>
                Dashboard
              </Link>
              <Link to="/dashboard/$firmSlug/leads" params={{ firmSlug: "demo-law" }}>
                Leads
              </Link>
            </nav>
          </header>
          <Outlet />
        </div>
      )}
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
