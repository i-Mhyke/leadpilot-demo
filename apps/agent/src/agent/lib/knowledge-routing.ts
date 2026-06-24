const FIRM_PEOPLE_QUERY = /\b(who\b|which lawyer|talk to|speak with|point me|team member)\b/i;

export function isFirmPeopleRoutingQuestion(message: string): boolean {
  return FIRM_PEOPLE_QUERY.test(message.trim());
}

export function firmPeopleRoutingContextNudge(): string {
  return 'Call search_knowledge with scope "firm" for team expertise.';
}

export function visitorMessageText(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  if ("text" in message && typeof message.text === "string") return message.text;
  if ("message" in message && typeof message.message === "string") return message.message;
  return "";
}
