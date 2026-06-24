import type { BookingStatus } from "@leadpilot/shared";

export function bookingStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "requested":
      return "Request received";
    case "reviewed":
      return "Under review";
    case "scheduled":
      return "Scheduled";
    case "declined":
      return "Declined";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function bookingContactLabel(input: {
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
}): string {
  if (input.visitorName?.trim()) return input.visitorName.trim();
  if (input.visitorEmail?.trim()) return input.visitorEmail.trim();
  if (input.companyName?.trim()) return input.companyName.trim();
  return "Visitor";
}
