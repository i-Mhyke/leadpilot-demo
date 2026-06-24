import type { ConversationId, ConversationPhase } from "./conversation.ts";
import type { FirmId } from "./firm.ts";

export type LeadId = string;

export interface LeadScoreFactors {
  serviceFit: number;
  urgency: number;
  specificity: number;
  commercialValue: number;
  readiness: number;
  contactConfidence: number;
}

export type LeadStatus = "new" | "contacted" | "converted" | "archived";
export type LeadTemperature = "cold" | "warm" | "hot";
export type BookingStatus = "requested" | "reviewed" | "scheduled" | "declined" | "closed";

export interface LeadProfile {
  id: LeadId;
  firmId: FirmId;
  conversationId: ConversationId;
  visitorId?: string;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number;
  primaryServiceId?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadScoreEvent {
  id: string;
  leadId: LeadId;
  conversationId: ConversationId;
  firmId: FirmId;
  score: number;
  temperature: LeadTemperature;
  factors: LeadScoreFactors;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface BookingRequest {
  id: string;
  firmId: FirmId;
  conversationId: ConversationId;
  leadId?: string;
  status: BookingStatus;
  serviceId?: string;
  routingGroup?: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  preferredTimeText?: string;
  matterSummary: string;
  leadBrief: string;
  urgency?: string;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationReadiness {
  score: number;
  temperature: LeadTemperature;
  conversationPhase: ConversationPhase;
  recommendedNextStep: string;
  shouldRequestContact: boolean;
  shouldOfferBooking: boolean;
}

export interface LeadSnapshot {
  id: LeadId;
  firmId: FirmId;
  conversationId: ConversationId;
  status: LeadStatus;
  temperature: LeadTemperature;
  name?: string;
  email?: string;
  phone?: string;
  serviceCategory?: string;
  qualificationScore: number;
  summary: string;
  createdAt: string;
}

export interface ContentRecommendation {
  id: string;
  firmId: FirmId;
  topic: string;
  format: "linkedin_post" | "blog_post" | "email_sequence" | "video_brief" | "report";
  title: string;
  rationale: string;
  sourceConversationCount: number;
  createdAt: string;
}
