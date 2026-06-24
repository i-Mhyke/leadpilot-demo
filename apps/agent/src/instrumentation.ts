import { observe, type FlueObservation } from '@flue/runtime';
import { logLeadPilotEvent, recordLeadPilotMetric } from "./agent/lib/observability.ts";

let registered = false;

export function registerObservability() {
  if (registered) return;
  registered = true;
  logLeadPilotEvent("observability.startup", {});
  observe((observation: FlueObservation) => {
    try {
      const o = observation as unknown as Record<string, unknown>;
      const instanceId = o.instanceId as string | undefined;
      const turnId = o.turnId as string | undefined;

      switch (observation.type) {
        case 'agent_start': logLeadPilotEvent("agent.started", { instanceId }); recordLeadPilotMetric("leadpilot.agent.started", 1); break;
        case 'agent_end': logLeadPilotEvent("agent.ended", { instanceId }); recordLeadPilotMetric("leadpilot.agent.ended", 1); break;
        case 'turn_start': logLeadPilotEvent("turn.started", { instanceId, turnId }); recordLeadPilotMetric("leadpilot.turn.started", 1); break;
        case 'turn': logLeadPilotEvent("turn.completed", { instanceId, turnId, isError: o.isError === true }); recordLeadPilotMetric("leadpilot.turn.completed", 1); break;
        case 'tool_start': logLeadPilotEvent("tool.started", { instanceId, toolName: o.toolName as string }); recordLeadPilotMetric("leadpilot.tool.started", 1); break;
        case 'tool': logLeadPilotEvent("tool.completed", { instanceId, toolName: o.toolName as string, isError: o.isError === true }); break;
        case 'log': logLeadPilotEvent(`log.${(o.level as string) || "info"}`, { instanceId, message: o.message as string }); break;
      }
    } catch {}
  });
}
