import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

export function Home() {
  return (
    <main className="page space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4 rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top_left,_rgba(45,106,106,0.14),_transparent_46%),linear-gradient(180deg,#ffffff_0%,#f7fafb_100%)] p-7 shadow-[0_24px_60px_rgba(18,34,42,0.08)] sm:p-8">
          <div className="eyebrow">Tenant control plane</div>
          <h1 className="title max-w-2xl">
            Provision a firm, then open its ask and dashboard surfaces.
          </h1>
          <p className="lede max-w-2xl">
            Create a firm row with a generated slug. The same slug powers both the public ask page
            and the dashboard, so you can move from setup to demo immediately.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/admin/tenants"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition"
            >
              Open admin tenants
            </Link>
            <Link
              to="/ask/$firmSlug"
              params={{ firmSlug: "demo-law" }}
              className="border-border bg-card hover:bg-accent inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition"
            >
              Open demo ask
            </Link>
            <Link
              to="/dashboard/$firmSlug"
              params={{ firmSlug: "demo-law" }}
              className="border-border bg-card hover:bg-accent inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition"
            >
              Open demo dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Link to="/admin/tenants" className="card">
          <h2>Admin Tenants</h2>
          <p className="muted">Internal surface for creating tenant workspaces and their slugs.</p>
        </Link>
        <Link to="/ask/$firmSlug" params={{ firmSlug: "demo-law" }} className="card">
          <h2>Public Ask Page</h2>
          <p className="muted">
            Standalone intake experience for firms without existing website traffic.
          </p>
        </Link>
        <Link to="/dashboard/$firmSlug" params={{ firmSlug: "demo-law" }} className="card">
          <h2>Firm Dashboard</h2>
          <p className="muted">Operational overview for conversations, leads, and follow-up state.</p>
        </Link>
        <Link to="/dashboard/$firmSlug/leads" params={{ firmSlug: "demo-law" }} className="card">
          <h2>Lead Pipeline</h2>
          <p className="muted">Conversation and booking work queue for the current firm.</p>
        </Link>
      </section>
    </main>
  );
}
