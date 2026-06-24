import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <main className="bg-background text-foreground flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm font-semibold tracking-tight">Page not found</p>
          <p className="text-muted-foreground mt-2 text-sm">
            This route is not available in the current LeadPilot app.
          </p>
        </div>
      </main>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
