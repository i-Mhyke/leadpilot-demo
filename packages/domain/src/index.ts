import type { ConversationPhase, ConversationReadiness, LeadScoreFactors, LeadTemperature } from "@leadpilot/shared";

const WEIGHTS = {
  serviceFit: 0.25,
  urgency: 0.2,
  specificity: 0.2,
  commercialValue: 0.15,
  readiness: 0.1,
  contactConfidence: 0.1,
} as const;

export function normalizeLeadScoreFactors(
  factors: LeadScoreFactors | Record<string, number>,
): LeadScoreFactors {
  if ("serviceFit" in factors) {
    return factors as LeadScoreFactors;
  }

  const legacy = factors as {
    relevanceToServices?: number;
    urgencySignals?: number;
    specificityOfNeed?: number;
    commitmentSignals?: number;
  };

  return {
    serviceFit: legacy.relevanceToServices ?? 0,
    urgency: legacy.urgencySignals ?? 0,
    specificity: legacy.specificityOfNeed ?? 0,
    commercialValue: legacy.commitmentSignals ?? 0,
    readiness: legacy.commitmentSignals ?? 0,
    contactConfidence: 0,
  };
}

export function calculateLeadScore(factors: LeadScoreFactors | Record<string, number>): number {
  const normalized = normalizeLeadScoreFactors(factors);
  const rawScore =
    normalized.serviceFit * WEIGHTS.serviceFit +
    normalized.urgency * WEIGHTS.urgency +
    normalized.specificity * WEIGHTS.specificity +
    normalized.commercialValue * WEIGHTS.commercialValue +
    normalized.readiness * WEIGHTS.readiness +
    normalized.contactConfidence * WEIGHTS.contactConfidence;

  return Math.max(0, Math.min(100, Math.round(rawScore * 100)));
}

export function classifyLeadTemperature(score: number): LeadTemperature {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function shouldRequestContact(score: number, threshold: number): boolean {
  return score >= threshold;
}

export function shouldOfferBooking(score: number, threshold: number): boolean {
  return score >= threshold;
}

export function evaluateConversationReadiness(input: {
  scoreFactors: LeadScoreFactors;
  contactCaptureThreshold: number;
  bookingOfferThreshold: number;
  explicitHelpIntent?: boolean;
  highUrgency?: boolean;
}): ConversationReadiness {
  const score = calculateLeadScore(input.scoreFactors);
  const temperature = classifyLeadTemperature(score);

  let conversationPhase: ConversationPhase = "listen";
  if (score >= input.bookingOfferThreshold) conversationPhase = "convert";
  else if (score >= input.contactCaptureThreshold) conversationPhase = "qualify";
  else if (normalizedHasEducationSignal(input.scoreFactors)) conversationPhase = "educate";

  const shouldRequestContactDetails =
    shouldRequestContact(score, input.contactCaptureThreshold) ||
    input.explicitHelpIntent === true ||
    input.highUrgency === true;

  const shouldOfferBookingNow = shouldOfferBooking(score, input.bookingOfferThreshold);

  let recommendedNextStep = "Ask one clarifying question to understand the matter.";
  if (shouldOfferBookingNow) {
    recommendedNextStep =
      "Ask permission, collect name and email, and offer an optional chance to add anything else that would help the associate understand what they need. Prepare a booking request from the conversation; do not ask the visitor to summarize the thread.";
  } else if (shouldRequestContactDetails) {
    recommendedNextStep =
      "Ask for name and email for follow-up. Offer an optional chance to add anything else that would help the associate understand what they need. Do not ask the visitor to summarize the conversation or project in one sentence.";
  } else if (conversationPhase === "educate") {
    recommendedNextStep = "Provide concise general guidance and one follow-up question.";
  }

  return {
    score,
    temperature,
    conversationPhase,
    recommendedNextStep,
    shouldRequestContact: shouldRequestContactDetails,
    shouldOfferBooking: shouldOfferBookingNow,
  };
}

function normalizedHasEducationSignal(factors: LeadScoreFactors): boolean {
  return factors.serviceFit >= 0.35 || factors.specificity >= 0.35;
}

export function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, "-");
}
