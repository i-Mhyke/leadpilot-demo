import { useEffect, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { Firm } from "@leadpilot/shared";
import { FirmProvisioningCard } from "@/features/firms/tenant-provisioning-card";
import {
  loadFirmProvisioningPageState,
  type FirmProvisioningPageState,
} from "@/features/firms/server";

const adminTenantsRoute = getRouteApi("/admin/tenants");

function AdminSidebar(props: {
  firms: Firm[];
  activeSlug: string | null;
}) {
  return (
    <aside className="border-border/70 bg-card rounded-[28px] border p-4 shadow-[0_16px_40px_rgba(18,34,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-foreground text-sm font-semibold tracking-tight">Existing firms</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Select a firm or switch to add mode.
          </p>
        </div>
        <Link
          to="/admin/tenants"
          search={() => ({ mode: "add" as const })}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-full px-3 py-2 text-xs font-medium shadow-sm transition"
        >
          Add
        </Link>
      </div>

      <div className="mt-4 space-y-2">
        {props.firms.length ? (
          props.firms.map((firm) => {
            const isActive = firm.slug === props.activeSlug;
            return (
              <Link
                key={firm.id}
                to="/admin/tenants"
                search={() => ({ firmSlug: firm.slug } as const)}
                className={[
                  "block rounded-2xl border px-3 py-3 transition",
                  isActive
                    ? "border-primary/30 bg-primary/10"
                    : "border-border/60 bg-background hover:bg-accent",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">{firm.name}</p>
                    <p className="text-muted-foreground mt-1 truncate text-xs uppercase tracking-[0.12em]">
                      {firm.industry}
                    </p>
                  </div>
                  <code className="bg-muted/70 text-foreground rounded-full px-2 py-1 font-mono text-[11px]">
                    {firm.slug}
                  </code>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="border-border/60 bg-muted/20 rounded-2xl border px-3 py-4">
            <p className="text-sm font-medium">No firms yet</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Use Add to create the first tenant.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function AdminTenantsPage() {
  const search = adminTenantsRoute.useSearch();
  const navigate = adminTenantsRoute.useNavigate();
  const loadPageState = useServerFn(loadFirmProvisioningPageState);
  const [pageState, setPageState] = useState<FirmProvisioningPageState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError(null);

    void loadPageState({ data: search })
      .then((state) => {
        if (!isCurrent) return;
        setPageState(state);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load firms.");
      })
      .finally(() => {
        if (!isCurrent) return;
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [loadPageState, search.firmSlug, search.mode]);

  const isAddMode = search.mode === "add";

  return (
    <main className="page space-y-8">
      <section className="space-y-4 rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(45,106,106,0.14),_transparent_46%),linear-gradient(180deg,#ffffff_0%,#f7fafb_100%)] p-7 shadow-[0_24px_60px_rgba(18,34,42,0.08)] sm:p-8">
        <div className="eyebrow">Admin surface</div>
        <h1 className="title max-w-2xl">Provision tenant workspaces</h1>
        <p className="lede max-w-2xl">
          Select a firm from the sidebar to inspect its live brain and uploads. Use Add to create a
          new tenant, with the selected firm persisted in the URL.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/"
            className="border-border bg-card hover:bg-accent inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition"
          >
            Back to home
          </Link>
          <Link
            to="/dashboard/$firmSlug"
            params={{ firmSlug: "demo-law" }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition"
          >
            Open demo dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AdminSidebar firms={pageState?.firms ?? []} activeSlug={search.firmSlug ?? null} />

        <div className="space-y-4">
          {loadError ? (
            <section className="border-border/60 bg-card rounded-[28px] border p-5 text-sm text-destructive">
              {loadError}
            </section>
          ) : null}

          {isLoading && !pageState ? (
            <section className="border-border/60 bg-card rounded-[28px] border p-5 text-sm text-muted-foreground">
              Loading tenant workspace...
            </section>
          ) : (
            <FirmProvisioningCard
              mode={isAddMode ? "create" : "details"}
              firm={pageState?.selectedFirm ?? null}
              brainConfig={pageState?.brainConfig ?? null}
              selectionError={pageState?.selectionError ?? null}
              onCreated={(firm) => {
                navigate({
                  to: "/admin/tenants",
                  search: () => ({ firmSlug: firm.slug }),
                  replace: true,
                });
              }}
              onDeleted={() => {
                navigate({
                  to: "/admin/tenants",
                  search: () => ({ mode: "add" as const }),
                  replace: true,
                });
              }}
            />
          )}
        </div>
      </section>
    </main>
  );
}
