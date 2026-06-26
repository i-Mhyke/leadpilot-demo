import { useEffect, useState } from "react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ClickableTableRow } from "@/features/dashboard/components/clickable-table-row";
import {
  FirmProvisioningCard,
  type FirmAdminStats,
} from "@/features/firms/tenant-provisioning-card";
import {
  loadFirmProvisioningPageState,
  type FirmProvisioningPageState,
} from "@/features/firms/server";
import { FIRM_INDUSTRY_OPTIONS, FIRM_JURISDICTION_OPTIONS } from "@/features/firms/validators";

const adminTenantsRoute = getRouteApi("/admin/tenants");

type AdminTenantsSearch = {
  firmSlug?: string;
  mode?: "add";
  country?: string;
  sector?: (typeof FIRM_INDUSTRY_OPTIONS)[number];
};

type AdminDirectoryRow = FirmProvisioningPageState["directory"][number];

const INDUSTRY_LABELS: Record<(typeof FIRM_INDUSTRY_OPTIONS)[number], string> = {
  legal: "Legal",
  healthcare: "Healthcare",
  accounting: "Accounting",
  consulting: "Consulting",
  real_estate: "Real estate",
  general: "General",
};

const COUNTRY_LABEL_BY_CODE = new Map<string, string>(
  FIRM_JURISDICTION_OPTIONS.map((option) => [option.code, option.name]),
);

function getCountryLabel(code?: string | null) {
  if (!code) return "All countries";
  return COUNTRY_LABEL_BY_CODE.get(code) ?? code;
}

function getIndustryLabel(industry?: string | null) {
  if (!industry) return "All sectors";
  return INDUSTRY_LABELS[industry as (typeof FIRM_INDUSTRY_OPTIONS)[number]] ?? industry;
}

function createSearchUpdater(
  navigate: ReturnType<typeof adminTenantsRoute.useNavigate>,
  search: AdminTenantsSearch,
) {
  return (patch: Partial<AdminTenantsSearch>) => {
    void navigate({
      to: "/admin/tenants",
      search: () => ({ ...search, ...patch }),
      replace: true,
    });
  };
}

function AdminDirectoryTable(props: {
  directory: AdminDirectoryRow[];
  activeSlug: string | null;
  search: AdminTenantsSearch;
  onSearchPatch: (patch: Partial<AdminTenantsSearch>) => void;
}) {
  const visibleDirectory = props.directory.filter((entry) => {
    if (props.search.country && entry.firm.jurisdiction !== props.search.country) {
      return false;
    }
    if (props.search.sector && entry.firm.industry !== props.search.sector) {
      return false;
    }
    return true;
  });

  const availableCountries = Array.from(
    new Map(
      props.directory
        .map((entry) => entry.firm.jurisdiction)
        .filter((country): country is string => Boolean(country))
        .map((country) => [country, getCountryLabel(country)] as const),
    ).entries(),
  )
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const availableSectors = Array.from(
    new Set(props.directory.map((entry) => entry.firm.industry)),
  ).sort((a, b) => getIndustryLabel(a).localeCompare(getIndustryLabel(b)));

  const hasFilters = Boolean(props.search.country || props.search.sector);

  return (
    <section className="border-border/70 bg-card rounded-[28px] border p-4 shadow-[0_16px_40px_rgba(18,34,42,0.06)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold tracking-tight">Firm directory</p>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            Filter by country and sector, then select a firm to open its detail drawer.
          </p>
        </div>
        <Link
          to="/admin/tenants"
          search={(current) => ({ ...current, mode: "add" as const, firmSlug: undefined })}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-full px-3 py-2 text-xs font-medium shadow-sm transition"
        >
          Add
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="space-y-2">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
            Country
          </span>
          <select
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={props.search.country ?? ""}
            onChange={(event) =>
              props.onSearchPatch({
                country: event.target.value || undefined,
              })
            }
            >
            <option value="">All countries</option>
            {availableCountries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.12em]">
            Sector
          </span>
          <select
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={props.search.sector ?? ""}
            onChange={(event) =>
              props.onSearchPatch({
                sector: event.target.value ? (event.target.value as AdminTenantsSearch["sector"]) : undefined,
              })
            }
          >
            <option value="">All sectors</option>
            {availableSectors.map((sector) => (
              <option key={sector} value={sector}>
                {getIndustryLabel(sector)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          {hasFilters ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex h-10 items-center rounded-full border border-border/70 px-4 text-sm transition"
              onClick={() => props.onSearchPatch({ country: undefined, sector: undefined })}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[24px] border border-border/60">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">
                Firm
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">
                Country
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">
                Sector
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">
                Visits
              </th>
              <th className="text-muted-foreground px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]">
                Conversations
              </th>
            </tr>
          </thead>
          <tbody>
            {props.directory.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  No firms yet. Use Add to create the first tenant.
                </td>
              </tr>
            ) : visibleDirectory.length ? (
              visibleDirectory.map((entry) => {
                const isActive = entry.firm.slug === props.activeSlug;
                return (
                  <ClickableTableRow
                    key={entry.firm.id}
                    to="/admin/tenants"
                    params={{}}
                    search={{
                      firmSlug: entry.firm.slug,
                      country: props.search.country,
                      sector: props.search.sector,
                    }}
                    className={[
                      "border-t border-border/50",
                      isActive ? "bg-primary/5" : "hover:bg-accent/50",
                    ].join(" ")}
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">{entry.firm.name}</p>
                        <p className="text-muted-foreground mt-1 truncate text-xs font-mono">
                          {entry.firm.slug}
                        </p>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-4 align-top text-sm">
                      {getCountryLabel(entry.firm.jurisdiction)}
                    </td>
                    <td className="text-muted-foreground px-4 py-4 align-top text-sm">
                      {getIndustryLabel(entry.firm.industry)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground text-sm font-medium">
                          {entry.askPageVisits + entry.dashboardPageVisits}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Ask {entry.askPageVisits} · Dashboard {entry.dashboardPageVisits}
                        </span>
                      </div>
                    </td>
                    <td className="text-foreground px-4 py-4 align-top text-sm font-medium">
                      {entry.conversationsTotal}
                    </td>
                  </ClickableTableRow>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={5}>
                  No firms match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminSidebar(props: {
  firms: AdminDirectoryRow[];
  activeSlug: string | null;
  search: AdminTenantsSearch;
  onSearchPatch: (patch: Partial<AdminTenantsSearch>) => void;
}) {
  return (
    <AdminDirectoryTable
      directory={props.firms}
      activeSlug={props.activeSlug}
      search={props.search}
      onSearchPatch={props.onSearchPatch}
    />
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
  }, [loadPageState, search.country, search.firmSlug, search.mode, search.sector]);

  const isAddMode = search.mode === "add";
  const updateSearch = createSearchUpdater(navigate, search);
  const selectedDirectoryEntry =
    pageState?.directory.find((entry) => entry.firm.slug === search.firmSlug) ?? null;
  const selectedFirmStats: FirmAdminStats | null = selectedDirectoryEntry
    ? {
        conversationsTotal: selectedDirectoryEntry.conversationsTotal,
        askPageVisits: selectedDirectoryEntry.askPageVisits,
        dashboardPageVisits: selectedDirectoryEntry.dashboardPageVisits,
        lastVisitAt: selectedDirectoryEntry.lastVisitAt,
      }
    : null;

  return (
    <main className="page space-y-8">
      <section className="space-y-4 rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(45,106,106,0.14),_transparent_46%),linear-gradient(180deg,#ffffff_0%,#f7fafb_100%)] p-7 shadow-[0_24px_60px_rgba(18,34,42,0.08)] sm:p-8">
        <div className="eyebrow">Admin surface</div>
        <h1 className="title max-w-2xl">Provision tenant workspaces</h1>
        <p className="lede max-w-2xl">
          Browse the firm directory, inspect visits and conversations in the side panel, and use
          Add to create a new tenant with the selected firm persisted in the URL.
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.9fr)]">
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
            <AdminSidebar
              firms={pageState?.directory ?? []}
              activeSlug={search.firmSlug ?? null}
              search={search}
              onSearchPatch={updateSearch}
            />
          )}
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {isLoading && !pageState ? null : (
            <FirmProvisioningCard
              mode={isAddMode ? "create" : "details"}
              firm={pageState?.selectedFirm ?? null}
              brainConfig={pageState?.brainConfig ?? null}
              stats={selectedFirmStats}
              selectionError={pageState?.selectionError ?? null}
              onCreated={(firm) => {
                navigate({
                  to: "/admin/tenants",
                  search: () => ({
                    firmSlug: firm.slug,
                    country: search.country,
                    sector: search.sector,
                  }),
                  replace: true,
                });
              }}
              onDeleted={() => {
                navigate({
                  to: "/admin/tenants",
                  search: () => ({
                    mode: "add" as const,
                    country: search.country,
                    sector: search.sector,
                  }),
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
