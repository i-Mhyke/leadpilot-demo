export const EMERGENCY_MODEL_MESSAGE_MAX = 3;

export function classifyTurnStepBudget(count: number): "zero_tool"|"tool_backed"|"overflow" {
  if (count <= 1) return "zero_tool";
  if (count <= 2) return "tool_backed";
  return "overflow";
}

export function alertTurnStepBudgetExceeded(input: { sessionId: string; turnId: string; modelMessageCount: number }): void {
  console.warn("Turn step budget exceeded", input);
}
