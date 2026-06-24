import type { BookingRequestItem } from "@leadpilot/shared";

export type LeadContactSource = {
  visitorId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  companyName?: string;
  booking?: Pick<
    BookingRequestItem,
    "visitorName" | "visitorEmail" | "visitorPhone" | "companyName"
  >;
};

export type LeadContactDisplay = {
  displayName: string;
  email?: string;
  phone?: string;
  avatarLabel: string;
  contactCaptured: boolean;
  visitorRef: string;
};

function shortVisitorRef(visitorId: string) {
  return visitorId.slice(0, 8);
}

export function resolveLeadContact(source: LeadContactSource): LeadContactDisplay {
  const name = source.visitorName?.trim() || source.booking?.visitorName?.trim();
  const email = source.visitorEmail?.trim() || source.booking?.visitorEmail?.trim();
  const phone = source.visitorPhone?.trim() || source.booking?.visitorPhone?.trim();
  const visitorRef = shortVisitorRef(source.visitorId);

  if (name) {
    return {
      displayName: name,
      email,
      phone,
      avatarLabel: name,
      contactCaptured: true,
      visitorRef,
    };
  }

  if (email) {
    return {
      displayName: email,
      email,
      phone,
      avatarLabel: email,
      contactCaptured: true,
      visitorRef,
    };
  }

  return {
    displayName: `Visitor ${visitorRef}`,
    email: undefined,
    phone,
    avatarLabel: visitorRef,
    contactCaptured: false,
    visitorRef,
  };
}
