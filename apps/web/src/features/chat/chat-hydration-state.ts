import type { dbMessagesToInitialEvents } from "./hydrate-chat-events";
import type { DemoSessionCursor } from "./hooks/use-demo-sessions";

export type ChatHydration = {
  initialEvents: ReturnType<typeof dbMessagesToInitialEvents>;
  sessionCursor?: DemoSessionCursor;
};

export function dropHydrationSessionCursor(hydration: ChatHydration | null): ChatHydration | null {
  if (!hydration) return null;
  return {
    ...hydration,
    sessionCursor: undefined,
  };
}
