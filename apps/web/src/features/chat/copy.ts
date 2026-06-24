import type { FirmBrainConfig } from "@leadpilot/shared";

export const CHAT_COPY = {
  shellTitle: "LeadPilot",
  shellSubtitle: (firmName: string) => `${firmName} - client conversations`,
  sidebarTitle: "Conversations",
  sidebarFootnote: "Saved on this device",
  newSessionCustomer: "New conversation",
  newSessionMatter: "No topic yet",
  emptySelectSession: "Pick a conversation to continue.",
  emptyChat: "Send a message to get started.",
  emptyStateTitle: "Ask before you book a call",
  emptyStateBody:
    "Describe your situation in plain language. You will get general information shaped by this company's public profile, not legal advice, and not an attorney-client relationship.",
  suggestedPromptsLabel: "Start with a question",
  composerPlaceholder: "Describe your situation in plain language…",
  status: {
    idle: "Ready",
    submitted: "Sending",
    streaming: "Writing",
    error: "Offline",
    done: "Ready",
  },
  statusSubline: (matterLabel: string) => matterLabel,
  connectionError: "Could not reach the assistant. Make sure the agent is running, then send your message again.",
  assistantError: "The assistant hit a problem and could not finish that reply. You can send another message to continue.",
  toolFailureError: "One of the assistant's background checks failed. You can keep chatting or try again.",
  turnTimeout:
    "That reply took longer than expected. LeadPilot is recovering this conversation before you send another message.",
  turnRecoveryFailed:
    "LeadPilot could not recover the last reply on this conversation. Start a new conversation to continue safely.",
  toolRunning: "Checking sources",
  toolComplete: "Done",
} as const;

export type AskPageCopy = {
  emptyStateTitle: string;
  emptyStateBody: string;
  suggestedPromptsLabel: string;
  suggestedPrompts: string[];
  composerPlaceholder: string;
};

const DEFAULT_ASK_COPY: AskPageCopy = {
  emptyStateTitle: CHAT_COPY.emptyStateTitle,
  emptyStateBody: CHAT_COPY.emptyStateBody,
  suggestedPromptsLabel: CHAT_COPY.suggestedPromptsLabel,
  suggestedPrompts: [
    "What should we prepare before the first call?",
    "Which details decide whether this is a fit?",
    "What would make this request urgent enough to escalate?",
  ],
  composerPlaceholder: CHAT_COPY.composerPlaceholder,
};

function cleanLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function resolveAskPageCopy(input: {
  firmName: string;
  brainConfig: FirmBrainConfig | null;
}): AskPageCopy {
  const firmName = cleanLabel(input.firmName);
  const persistedQuestions = input.brainConfig?.compiled.suggestedQuestions?.map(cleanLabel).filter(Boolean) ?? [];

  return {
    emptyStateTitle: firmName ? `Ask ${firmName} before you book a call` : DEFAULT_ASK_COPY.emptyStateTitle,
    emptyStateBody:
      `Describe your business situation in plain language. You will get intake guidance shaped by ${firmName || "this company"}'s public profile—not legal advice, and not an attorney-client relationship.`,
    suggestedPromptsLabel: DEFAULT_ASK_COPY.suggestedPromptsLabel,
    suggestedPrompts:
      persistedQuestions.length >= 3
        ? persistedQuestions.slice(0, 3)
        : DEFAULT_ASK_COPY.suggestedPrompts,
    composerPlaceholder: DEFAULT_ASK_COPY.composerPlaceholder,
  };
}
