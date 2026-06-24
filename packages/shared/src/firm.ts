export type FirmId = string;

export type FirmIndustry =
  | "legal"
  | "healthcare"
  | "accounting"
  | "consulting"
  | "real_estate"
  | "general";

export type FirmStatus = "active" | "inactive";

export interface Firm {
  id: FirmId;
  name: string;
  slug: string;
  industry: FirmIndustry;
  jurisdiction?: string;
  websiteUrl?: string;
  status: FirmStatus;
}

export interface FirmService {
  id: string;
  firmId: FirmId;
  name: string;
  slug: string;
  description: string;
  visitorExamples: string[];
  qualificationQuestions: string[];
  urgencySignals: string[];
  requiredBookingFields: string[];
  routingGroup?: string;
  isActive: boolean;
}

export interface FirmBookingPolicy {
  bookingMode: "request_only" | "calendar_link" | "calendar_api" | "manual_review";
  contactCaptureThreshold: number;
  bookingOfferThreshold: number;
  requiredContactFields: string[];
  allowPhoneCapture: boolean;
  calendarProvider?: string;
  calendarRoutingNotes?: string;
}

export interface FirmPricingPolicy {
  canDiscussFees: boolean;
  feeSummary?: string;
  feeDisclaimer?: string;
  requiresHumanForFeeQuestions: boolean;
}

export interface FirmToneProfile {
  voice: string;
  formalityLevel: string;
  preferredGreeting?: string;
  avoidPhrases: string[];
  signatureDisclaimer?: string;
}

export interface FirmAgentProfile {
  firm: Firm;
  services: FirmService[];
  bookingPolicy: FirmBookingPolicy;
  pricingPolicy: FirmPricingPolicy;
  toneProfile: FirmToneProfile;
}
