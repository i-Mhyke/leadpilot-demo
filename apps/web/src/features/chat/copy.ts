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
    "Describe your startup situation in plain language. You will get general information on formation, fundraising, data protection, or licensing—not legal advice, and not an attorney-client relationship.",
  suggestedPromptsLabel: "Start with a question",
  suggestedPrompts: [
    "We're raising on SAFE notes—what should we know about Nigerian law?",
    "We're launching B2B SaaS in Lagos. What NDPR paperwork do we need?",
    "We're building a remittance API. Which CBN licenses apply?",
  ],
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
