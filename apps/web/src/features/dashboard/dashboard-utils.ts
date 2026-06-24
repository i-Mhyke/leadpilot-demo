export const DASHBOARD_MOTION =
  "transition-[color,background-color,border-color,transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

export function formatDashboardWhen(iso?: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function visitorInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function dashboardEnterClass(index = 0) {
  const delay = Math.min(index, 6) * 40;
  return `dashboard-enter opacity-0 [animation-delay:${delay}ms]`;
}
