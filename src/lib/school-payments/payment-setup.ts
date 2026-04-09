import type { Types } from "mongoose";

import { isLikelyPaystackSubaccountCode } from "@/lib/school-payments/paystack-subaccount-code";

export type SchoolPaymentSetupStatus =
  | "not_started"
  | "awaiting_billing_owner"
  | "details_submitted"
  | "pending_provisioning"
  | "review_required"
  | "provisioned"
  | "failed";

type SchoolPaymentSetupShape = {
  status?: SchoolPaymentSetupStatus | null;
  ownerUserId?: Types.ObjectId | string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerAssignedAt?: Date | null;
  ownerAssignedBy?: Types.ObjectId | string | null;
  delegateUserId?: Types.ObjectId | string | null;
  delegateName?: string | null;
  delegateEmail?: string | null;
  delegateAssignedAt?: Date | null;
  delegateAssignedBy?: Types.ObjectId | string | null;
  submittedAt?: Date | null;
  submittedBy?: Types.ObjectId | string | null;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | string | null;
  approvedByEmail?: string | null;
  reviewReason?: string | null;
  lastUpdatedAt?: Date | null;
  lastUpdatedBy?: Types.ObjectId | string | null;
};

type SchoolPaymentShape = {
  createdBy?: Types.ObjectId | string | null;
  bank?: {
    bankName?: string | null;
    branchName?: string | null;
    sortCode?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
  } | null;
  billing?: {
    status?: "unprovisioned" | "provisioned" | "failed" | null;
    paymentSetup?: SchoolPaymentSetupShape | null;
    paystack?: {
      subaccountCode?: string | null;
      subaccountId?: string | null;
      lastError?: string | null;
    } | null;
  } | null;
};

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizePaymentSetupEmail(email: string | null | undefined) {
  return (email || "").toLowerCase().trim();
}

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const SCHOOL_NAME_STOP_WORDS = new Set([
  "academy",
  "basic",
  "campus",
  "center",
  "centre",
  "college",
  "education",
  "educational",
  "ghana",
  "high",
  "international",
  "jhs",
  "junior",
  "kg",
  "kindergarten",
  "limited",
  "ltd",
  "montessori",
  "nursery",
  "prep",
  "preparatory",
  "primary",
  "school",
  "senior",
  "shs",
  "st",
  "saint",
  "the",
]);

function tokenizeIdentity(value: string | null | undefined) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !SCHOOL_NAME_STOP_WORDS.has(token));
}

export function hasCompleteSchoolBankDetails(school: SchoolPaymentShape) {
  const bank = school.bank;
  return Boolean(
    hasText(bank?.bankName) &&
      hasText(bank?.branchName) &&
      hasText(bank?.sortCode) &&
      hasText(bank?.accountName) &&
      hasText(bank?.accountNumber)
  );
}

export function assessSchoolPaymentSetupReview(input: {
  schoolName?: string | null;
  accountName?: string | null;
  hadProvisionedRail?: boolean;
  bankChanged?: boolean;
}) {
  const reasons: string[] = [];

  if (input.hadProvisionedRail && input.bankChanged) {
    reasons.push(
      "This school was already live for online payments, so the payout change needs manual review before checkout can be re-enabled."
    );
  }

  const schoolTokens = tokenizeIdentity(input.schoolName);
  const accountTokens = tokenizeIdentity(input.accountName);
  const sharedTokens = accountTokens.filter((token) => schoolTokens.includes(token));

  if (
    hasText(input.schoolName) &&
    hasText(input.accountName) &&
    schoolTokens.length > 0 &&
    accountTokens.length > 0 &&
    sharedTokens.length === 0
  ) {
    reasons.push(
      "The payout account name does not clearly match the school identity, so it has been flagged for review."
    );
  }

  return {
    requiresReview: reasons.length > 0,
    reason: reasons[0] || null,
    reasons,
  };
}

export function getBillingOwnerUserId(
  school: SchoolPaymentShape
): string | null {
  const explicitOwner = school.billing?.paymentSetup?.ownerUserId;
  if (explicitOwner) {
    return String(explicitOwner);
  }

  if (school.createdBy) {
    return String(school.createdBy);
  }

  return null;
}

export function getPaymentSetupDelegateUserId(
  school: SchoolPaymentShape
): string | null {
  const explicitDelegate = school.billing?.paymentSetup?.delegateUserId;
  if (explicitDelegate) {
    return String(explicitDelegate);
  }

  return null;
}

export function deriveSchoolPaymentSetupStatus(
  school: SchoolPaymentShape
): SchoolPaymentSetupStatus {
  const explicit = school.billing?.paymentSetup?.status;
  const subaccountCode = school.billing?.paystack?.subaccountCode;
  const lastError = school.billing?.paystack?.lastError;
  const billingStatus = school.billing?.status;

  if (explicit === "awaiting_billing_owner") {
    return "awaiting_billing_owner";
  }

  if (explicit === "pending_provisioning") {
    return "pending_provisioning";
  }

  if (explicit === "review_required") {
    return "review_required";
  }

  if (explicit === "failed" || billingStatus === "failed" || hasText(lastError)) {
    return "failed";
  }

  if (isLikelyPaystackSubaccountCode(subaccountCode)) {
    return "provisioned";
  }

  if (explicit === "details_submitted") {
    return "details_submitted";
  }

  if (
    !hasCompleteSchoolBankDetails(school) &&
    (hasText(school.billing?.paymentSetup?.ownerEmail) ||
      hasText(school.billing?.paymentSetup?.ownerName))
  ) {
    return "awaiting_billing_owner";
  }

  if (hasCompleteSchoolBankDetails(school)) {
    return "details_submitted";
  }

  return explicit || "not_started";
}

export function deriveSchoolPaymentSetupStatusWithoutOwnerHandoff(
  school: SchoolPaymentShape
): SchoolPaymentSetupStatus {
  const explicit = school.billing?.paymentSetup?.status;
  const subaccountCode = school.billing?.paystack?.subaccountCode;
  const lastError = school.billing?.paystack?.lastError;
  const billingStatus = school.billing?.status;

  if (isLikelyPaystackSubaccountCode(subaccountCode)) {
    return "provisioned";
  }

  if (explicit === "pending_provisioning") {
    return "pending_provisioning";
  }

  if (explicit === "review_required") {
    return "review_required";
  }

  if (explicit === "failed" || billingStatus === "failed" || hasText(lastError)) {
    return "failed";
  }

  if (hasCompleteSchoolBankDetails(school)) {
    return "details_submitted";
  }

  return "not_started";
}

export function isSchoolPaymentReady(school: SchoolPaymentShape) {
  return (
    deriveSchoolPaymentSetupStatus(school) === "provisioned" &&
    isLikelyPaystackSubaccountCode(school.billing?.paystack?.subaccountCode)
  );
}

export function getSchoolPaymentSetupMeta(status: SchoolPaymentSetupStatus) {
  switch (status) {
    case "provisioned":
      return {
        label: "Ready",
        tone: "emerald" as const,
        description: "Online fee payments are enabled for this school.",
      };
    case "pending_provisioning":
      return {
        label: "Provisioning",
        tone: "blue" as const,
        description: "EduSentrix is preparing the school's Paystack payout rail.",
      };
    case "details_submitted":
      return {
        label: "Details Saved",
        tone: "amber" as const,
        description: "Payout details are saved and ready for setup submission.",
      };
    case "awaiting_billing_owner":
      return {
        label: "Awaiting Owner",
        tone: "amber" as const,
        description: "Payment setup is waiting for the billing owner to complete it.",
      };
    case "review_required":
      return {
        label: "Needs Review",
        tone: "amber" as const,
        description: "Payment setup needs a manual review before it can go live.",
      };
    case "failed":
      return {
        label: "Attention Needed",
        tone: "red" as const,
        description: "The payment setup attempt failed and needs correction or a retry.",
      };
    case "not_started":
    default:
      return {
        label: "Not Started",
        tone: "slate" as const,
        description: "No payout details have been configured yet.",
      };
  }
}

export function getMissingBankFields(school: SchoolPaymentShape) {
  const bank = school.bank;
  const missing: string[] = [];

  if (!hasText(bank?.bankName)) missing.push("bank");
  if (!hasText(bank?.branchName)) missing.push("branch");
  if (!hasText(bank?.sortCode)) missing.push("sort code");
  if (!hasText(bank?.accountName)) missing.push("account name");
  if (!hasText(bank?.accountNumber)) missing.push("account number");

  return missing;
}
