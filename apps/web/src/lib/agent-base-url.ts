export function resolveAgentBaseUrl(
  env: { AGENT_BASE_URL?: string } = process.env,
  fallback = "http://127.0.0.1:3001",
): string {
  const configured = env.AGENT_BASE_URL?.trim();
  return (configured || fallback).replace(/\/$/, "");
}

export function eveAgentProxyTarget(agentBaseUrl: string): string {
  return `${agentBaseUrl.replace(/\/$/, "")}/eve/**`;
}
