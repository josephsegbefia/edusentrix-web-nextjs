/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ClientSession } from "mongoose";
import type { HydratedDocument } from "mongoose";
import type { Types } from "mongoose";
import type { ISchool } from "@/models/School";
import type { IUser } from "@/models/User";
import { resolveBankCode } from "@/lib/banks/banks";
import {
  assessSchoolPaymentSetupReview,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";

export type OnboardingSchoolFormBody = {
  name: string;
  type: "Basic" | "Secondary";
  curriculumCode?:
    | "ghana_nacca"
    | "cambridge"
    | "ib_pyp"
    | "ib_myp"
    | "british_nc"
    | "american"
    | "hybrid";
  address?: string | null | undefined;
  email?: string | undefined;
  city?: string | null | undefined;
  region?: string | null | undefined;
  bank?: {
    bankName?: string | null;
    branchName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    sortCode?: string | null;
  } | null | undefined;
};

/**
 * Persists school + bank + payment setup snapshot for the launch wizard (step 2 / 3).
 * `billingOwner` is the school-side identity for payout ownership; `auditUserId` records who saved (self or platform staff).
 */
export async function persistOnboardingSchoolProfile(
  school: HydratedDocument<ISchool>,
  parsed: OnboardingSchoolFormBody,
  billingOwner: IUser,
  auditUserId: Types.ObjectId,
  session: ClientSession
): Promise<{
  paymentSetupStatus: string;
  reviewReason: string | null;
}> {
  let derivedSortCode: string | null = null;
  const bankReq = parsed.bank || undefined;
  if (bankReq?.bankName && bankReq?.branchName) {
    derivedSortCode = await resolveBankCode(
      bankReq.bankName,
      bankReq.branchName
    );
  }

  const normalizedType =
    parsed.type === "Secondary" ? "SHS" : parsed.type;

  school.name = parsed.name;
  school.type = normalizedType;
  if (parsed.curriculumCode) {
    (school as any).curriculumCode = parsed.curriculumCode;
  }
  school.address = parsed.address ?? undefined;
  school.email = parsed.email ?? undefined;
  school.city = parsed.city ?? undefined;
  school.region = parsed.region ?? undefined;

  const existingBank = school.bank || {};

  school.bank = {
    bankName: bankReq?.bankName || undefined,
    branchName: bankReq?.branchName || undefined,
    sortCode: derivedSortCode || undefined,
    accountName: bankReq?.accountName || undefined,
    accountNumber: bankReq?.accountNumber || undefined,
  };

  const paymentDetailsReady = hasCompleteSchoolBankDetails({
    bank: school.bank,
    billing: school.billing,
  });
  const bankChanged =
    (existingBank.bankName || "") !== (bankReq?.bankName || "") ||
    (existingBank.branchName || "") !== (bankReq?.branchName || "") ||
    (existingBank.accountName || "") !== (bankReq?.accountName || "") ||
    (existingBank.accountNumber || "") !== (bankReq?.accountNumber || "");
  const review = paymentDetailsReady
    ? assessSchoolPaymentSetupReview({
        schoolName: school.name,
        accountName: bankReq?.accountName || null,
        hadProvisionedRail: Boolean(
          school.billing?.paystack?.subaccountCode ||
            school.billing?.paystack?.subaccountId
        ),
        bankChanged,
      })
    : { requiresReview: false, reason: null };
  const billing = school.billing || (school.billing = {});
  const existingPaymentSetup = billing.paymentSetup || {};
  const paymentSetupUpdatedAt = new Date();

  billing.paymentSetup = {
    ...existingPaymentSetup,
    ownerUserId: existingPaymentSetup.ownerUserId || billingOwner._id,
    ownerName:
      existingPaymentSetup.ownerName ||
      billingOwner.name ||
      [billingOwner.firstName, billingOwner.lastName].filter(Boolean).join(" ") ||
      undefined,
    ownerEmail: existingPaymentSetup.ownerEmail || billingOwner.email,
    ownerAssignedAt:
      existingPaymentSetup.ownerAssignedAt || paymentSetupUpdatedAt,
    ownerAssignedBy: existingPaymentSetup.ownerAssignedBy || billingOwner._id,
    status: paymentDetailsReady
      ? review.requiresReview
        ? "review_required"
        : "details_submitted"
      : "not_started",
    submittedAt: paymentDetailsReady ? paymentSetupUpdatedAt : null,
    submittedBy: paymentDetailsReady ? billingOwner._id : null,
    reviewReason: paymentDetailsReady ? review.reason : null,
    lastUpdatedAt: paymentSetupUpdatedAt,
    lastUpdatedBy: auditUserId,
  };

  await school.save({ session });

  return {
    paymentSetupStatus: school.billing?.paymentSetup?.status || "not_started",
    reviewReason: school.billing?.paymentSetup?.reviewReason || null,
  };
}
