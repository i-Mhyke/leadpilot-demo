/**
 * Eve client base URL.
 * Dev: leave unset — requests go same-origin to /eve and Vite proxies to the agent.
 * Prod (same-origin): leave unset — Vercel rewrites /eve to the web project's edge proxy.
 * Prod (split-origin): set to the agent deployment URL (requires agent CORS + LEADPILOT_PUBLIC_CHAT).
 */
export function getAgentHost() {
  const configured = import.meta.env.VITE_AGENT_BASE_URL?.trim();
  return configured ?? "";
}
