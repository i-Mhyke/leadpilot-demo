import { evaluateConversationReadiness } from "@leadpilot/domain";
import type { ConversationReadiness, LeadScoreFactors } from "@leadpilot/shared";

export type LeadNextAction = "offer_booking" | "ask_for_contact" | "continue_qualification";

export function resolveLeadNextAction(input: { shouldOfferBooking: boolean; shouldAskForContact: boolean }): LeadNextAction {
  if (input.shouldOfferBooking) return "offer_booking";
  if (input.shouldAskForContact) return "ask_for_contact";
  return "continue_qualification";
}

export function resolveLeadQualification(input: {
  scoreFactors: LeadScoreFactors; contactCaptureThreshold: number;
  bookingOfferThreshold: number; explicitHelpIntent?: boolean; highUrgency?: boolean;
}): ConversationReadiness & { nextAction: LeadNextAction } {
  const readiness = evaluateConversationReadiness(input);
  return { ...readiness, nextAction: resolveLeadNextAction({ shouldOfferBooking: readiness.shouldOfferBooking, shouldAskForContact: readiness.shouldRequestContact }) };
}

export function toLeadSaveModelOutput(result: { nextAction: string; score: number; temperature: string }): string {
  return `Lead saved. Next action: ${result.nextAction}. Score: ${result.score} (${result.temperature}).`;
}
export function toBookingResultModelOutput(result: { bookingRequestId?: string; status: string; nextAction: string }): string {
  if (result.bookingRequestId) {
    return `Booking request captured. Appointment not yet confirmed.`;
  }
  return `Booking request not captured. Missing information.`;
}
export function toReadinessModelOutput(result: { phase: string; nextAction: string }): string {
  return `Phase: ${result.phase}. Next action: ${result.nextAction}.`;
}
export function shouldPersistLead(nextAction: LeadNextAction): boolean {
  return nextAction !== "continue_qualification";
}

export function formatLeadModelOutput(output: { nextAction: LeadNextAction; persisted?: boolean }): string {
  const prefix = output.persisted === false ? `Lead not saved. Next action: ${output.nextAction}.` : `Lead saved. Next action: ${output.nextAction}.`;
  switch (output.nextAction) {
    case "ask_for_contact": return `${prefix} Ask for name and email...`;
    case "offer_booking": return `${prefix} Ask permission, collect name and email...`;
    default: return `${prefix} Continue qualification with one question...`;
  }
}

export function formatBookingFailureModelOutput(missingFields: string[]): string {
  const humanFields = missingFields.map((field) => {
    switch (field) {
      case "preferred_booking_at":
        return "preferred booking date and time";
      case "company_name":
        return "company name";
      default:
        return field.replace(/_/g, " ");
    }
  });
  return `Booking request not captured. Missing required fields: ${humanFields.join(", ")}.`;
}

export function formatBookingNeedsLeadModelOutput(): string {
  return "Booking request not captured. Call upsert_lead first.";
}

export function formatBookingSuccessModelOutput(_input: { optionalFieldsMissing: { phone: boolean; preferredTime: boolean } }): string {
  return "Booking request captured. Appointment is not confirmed. If you'd like, ask for company name, phone number, urgency, or any other context that will help the associate prepare.";
}

export function formatReadinessModelOutput(output: ConversationReadiness & { nextAction: LeadNextAction }): string {
  return `Phase: ${output.conversationPhase}. Next: ${output.nextAction}. ${output.recommendedNextStep}`;
}
