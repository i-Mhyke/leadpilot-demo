import type { ConversationMessage } from "@leadpilot/shared";

import type { UseEveAgentOptions } from "./use-flue-agent";
import type { EveMessageData } from "./use-flue-agent";

type ChatInitialEvents = NonNullable<UseEveAgentOptions<EveMessageData>["initialEvents"]>;

function eveTurnIdForHydration(
  eveTurnId: string | undefined,
  role: ConversationMessage["role"],
  messageId: string,
) {
  const raw = eveTurnId ?? `${messageId}:turn`;
  if (role === "visitor" && raw.endsWith(":user")) {
    return raw.slice(0, -":user".length);
  }
  return raw;
}

export function dbMessagesToInitialEvents(messages: ConversationMessage[]): ChatInitialEvents {
  const events: ChatInitialEvents[number][] = [];
  let sequence = 0;

  for (const message of messages) {
    if (message.role !== "visitor" && message.role !== "assistant") continue;

    const turnId = eveTurnIdForHydration(message.eveTurnId, message.role, message.id);

    if (message.role === "visitor") {
      events.push({
        type: "message.received" as const,
        data: {
          message: {
            role: "user" as const,
            text: message.content,
            metadata: message.metadata,
          },
          sequence: sequence++,
          turnId,
        },
      });
      continue;
    }

    events.push({
      type: "message.completed" as const,
      data: {
        message: {
          role: "assistant" as const,
          text: message.content,
          metadata: message.metadata,
        },
        finishReason: "stop" as const,
        sequence: sequence++,
        stepIndex: 0,
        turnId,
      },
    });
  }

  return events as ChatInitialEvents;
}
