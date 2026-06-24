import type { ThinkingLevel } from '@flue/runtime';

const DEFAULT_COMPACTION_THRESHOLD_PERCENT = 0.8;

export function resolveModelSpecifier(): string {
  const provider = process.env.LEADPILOT_MODEL_PROVIDER?.trim() || "openai";
  const modelId = process.env.LEADPILOT_AGENT_MODEL?.trim() || "gpt-4.1-mini";
  if (provider === "openai") return `openai/${modelId}`;
  return modelId;
}

export function resolveThinkingLevel(): ThinkingLevel {
  const value = process.env.LEADPILOT_THINKING ?? "off";
  if (value === "low" || value === "medium" || value === "high") return value;
  return "off";
}

export function resolveCompactionConfig() {
  const explicitValue = process.env.LEADPILOT_MODEL_CONTEXT_WINDOW_TOKENS;
  const thresholdPercent = resolveCompactionThresholdPercent();
  if (explicitValue) {
    const parsedValue = Number.parseInt(explicitValue, 10);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return { modelContextWindowTokens: parsedValue, thresholdPercent };
    }
  }
  return { thresholdPercent };
}

function resolveCompactionThresholdPercent(): number {
  const explicitValue = process.env.LEADPILOT_COMPACTION_THRESHOLD_PERCENT;
  if (!explicitValue) return DEFAULT_COMPACTION_THRESHOLD_PERCENT;
  const parsedValue = Number.parseFloat(explicitValue);
  if (Number.isFinite(parsedValue) && parsedValue > 0 && parsedValue < 1) {
    return parsedValue;
  }
  return DEFAULT_COMPACTION_THRESHOLD_PERCENT;
}
