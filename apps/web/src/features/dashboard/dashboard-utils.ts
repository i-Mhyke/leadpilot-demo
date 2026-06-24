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

export function formatRelativeWhen(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDashboardWhen(iso);
}

const TOPIC_TONES = [
  "bg-sky-50 text-sky-800 ring-sky-200/70",
  "bg-rose-50 text-rose-800 ring-rose-200/70",
  "bg-amber-50 text-amber-900 ring-amber-200/70",
  "bg-emerald-50 text-emerald-900 ring-emerald-200/70",
  "bg-slate-100 text-slate-700 ring-slate-200/80",
] as const;

export function topicPillTone(topic: string) {
  let hash = 0;
  for (let index = 0; index < topic.length; index += 1) {
    hash = (hash + topic.charCodeAt(index) * (index + 1)) % TOPIC_TONES.length;
  }
  return TOPIC_TONES[hash] ?? TOPIC_TONES[4];
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
