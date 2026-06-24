import type { Conversation } from "./conversation.ts";
import type { Firm } from "./firm.ts";
import type { BookingRequest, BookingStatus, LeadProfile } from "./leads.ts";

export const CONVERSATION_CONTEXT_PREVIEW_LIMIT = 8;

export interface DashboardRecentTopic {
  topic: string;
  count: number;
}

export type DashboardRecentConversation = Pick<
  Conversation,
  "id" | "matterSummary" | "phase" | "status" | "lastMessageAt" | "createdAt"
>;

export interface FirmDashboardMetrics {
  conversationsTotal: number;
  conversationsToday: number;
  newLeads: number;
  bookingRequests: number;
  recentTopics: DashboardRecentTopic[];
}

export interface FirmDashboardOverview {
  firm: Firm;
  metrics: FirmDashboardMetrics;
  recentConversations: DashboardRecentConversation[];
}

export type FirmDashboardResult =
  | { kind: "ok"; overview: FirmDashboardOverview }
  | { kind: "not_found"; slug: string }
  | { kind: "inactive"; slug: string };

export interface FirmConversationLead {
  conversationId: string;
  visitorId: string;
  visitorLabel: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  matterSummary?: string;
  preferredBookingAt?: string;
  phase: DashboardRecentConversation["phase"];
  status: DashboardRecentConversation["status"];
  sourceUrl?: string;
  lastMessageAt?: string;
  createdAt: string;
  messageCount: number;
  topics: string[];
  lead?: {
    status: "new" | "contacted" | "converted" | "archived";
    temperature: "cold" | "warm" | "hot";
    score: number;
    summary?: string;
  };
  bookingStatus?: "requested" | "reviewed" | "scheduled" | "declined" | "closed";
}

export type FirmConversationLeadsResult =
  | { kind: "ok"; leads: FirmConversationLead[] }
  | { kind: "not_found"; slug: string }
  | { kind: "inactive"; slug: string };

export interface BookingRequestItem {
  id: string;
  conversationId: string;
  status: BookingStatus;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  preferredBookingAt?: string;
  matterSummary: string;
  leadBrief: string;
  preferredTimeText?: string;
  urgency?: string;
  createdAt: string;
}

export interface ConversationContextMessage {
  id: string;
  role: "visitor" | "assistant";
  content: string;
  createdAt: string;
}

export interface FirmBookingDetail {
  conversationId: string;
  booking: BookingRequest;
  lead?: Pick<LeadProfile, "status" | "temperature" | "score" | "summary">;
  messages: ConversationContextMessage[];
  messageCount: number;
}

export type FirmBookingRequestsResult =
  | { kind: "ok"; bookings: BookingRequestItem[] }
  | { kind: "not_found"; slug: string }
  | { kind: "inactive"; slug: string };

export type FirmBookingDetailResult =
  | { kind: "ok"; detail: FirmBookingDetail }
  | { kind: "not_found"; slug: string }
  | { kind: "inactive"; slug: string }
  | { kind: "not_found_booking"; conversationId: string };
