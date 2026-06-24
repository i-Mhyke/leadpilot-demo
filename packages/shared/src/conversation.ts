import type { FirmId } from "./firm.ts";
import type { FirmBrainSnapshot } from "./brain.ts";

export type ConversationPhase = "listen" | "educate" | "qualify" | "convert";
export type ConversationStatus = "open" | "failed" | "closed";
export type ConversationId = string;

export interface Visitor {
  id: string;
  firmId: FirmId;
  anonymousKey?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: ConversationId;
  firmId: FirmId;
  visitorId: string;
  eveSessionId?: string;
  eveContinuationToken?: string;
  eveStreamIndex: number;
  status: ConversationStatus;
  phase: ConversationPhase;
  sourceUrl?: string;
  firmSlug?: string;
  matterSummary?: string;
  primaryServiceId?: string;
  brainSnapshot?: FirmBrainSnapshot;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMetadata {
  categoryClassification?: string;
  topicsDiscussed?: string[];
  qualificationScore?: number;
  scoreFactors?: import("./leads.ts").LeadScoreFactors;
  conversationPhase?: ConversationPhase;
  readyForLeadCapture?: boolean;
  visitorQuestionNormalized?: string;
  suggestedNextQuestion?: string;
  finishReason?: string | null;
  ui?: {
    bookingScheduleRequested?: boolean;
  };
}

export interface ConversationMessage {
  id: string;
  conversationId: ConversationId;
  firmId: FirmId;
  role: "visitor" | "assistant" | "system" | "tool";
  content: string;
  eveTurnId?: string;
  createdAt: string;
  metadata?: ConversationMetadata;
}

export interface ConversationEvent {
  id: string;
  conversationId: ConversationId;
  firmId: FirmId;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
