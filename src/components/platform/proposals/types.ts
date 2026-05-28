export type PlatformProposal = {
  id: string;
  schoolName: string;
  schoolLocation: string;
  recipientName: string;
  recipientTitle: string;
  recipientEmail: string;
  recipientPhone: string;
  title: string;
  proposalType: "general" | "pilot" | "full_implementation" | "pricing" | "demo_follow_up";
  selectedModules: string[];
  status:
    | "draft"
    | "ready"
    | "sent"
    | "followed_up"
    | "demo_scheduled"
    | "pilot_started"
    | "accepted"
    | "rejected"
    | "archived";
  version: number;
  hasPdf: boolean;
  pdfIsStale: boolean;
  lastGeneratedAt: string | null;
  sentAt: string | null;
  nextFollowUpDate: string | null;
  followUpNotes: string;
  internalNotes: string;
  pricing: {
    currency: "GHS" | "USD";
    setupFee?: number | null;
    recurringFee?: number | null;
    cadence?: "monthly" | "termly" | "annual" | null;
    studentRange?: string | null;
    discountNote?: string | null;
    paymentTerms?: string | null;
  };
  sections: Array<{
    key: string;
    title: string;
    subtitle: string;
    content: string;
    order: number;
    enabled: boolean;
    displayStyle: "standard" | "highlight" | "cards" | "table" | "callout";
    pageBreakBefore: boolean;
    pageBreakAfter: boolean;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProposalActivity = {
  id: string;
  action: string;
  message: string;
  createdAt: string | null;
};

export type ProposalSendLog = {
  id: string;
  recipientEmail: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  sentAt: string | null;
  createdAt: string | null;
};
