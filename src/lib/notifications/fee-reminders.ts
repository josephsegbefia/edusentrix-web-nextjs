import "server-only";

import { sendEmail } from "@/lib/email/brevo";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { normalizePhone } from "@/lib/notifications/teacher-whatsapp-policy";

export type FeeReminderChannel = "email" | "sms" | "whatsapp";

export type FeeReminderWardSummary = {
  studentName: string;
  classGroupName?: string;
  outstandingMinor: number;
  overdueInvoiceCount?: number;
};

export type FeeReminderEmailPayload = {
  schoolName: string;
  guardianName: string;
  totalOutstandingMinor: number;
  currency?: string;
  wards: FeeReminderWardSummary[];
  customMessage?: string;
  actionLink?: string;
  subjectOverride?: string;
};

export type FeeReminderDispatchInput = {
  channel: FeeReminderChannel;
  email?: string | null;
  phone?: string | null;
  emailPayload: FeeReminderEmailPayload;
};

export type FeeReminderDispatchResult = {
  success: boolean;
  channel: FeeReminderChannel;
  reason?: string;
  mode?: string;
};

export async function dispatchFeeReminder(
  input: FeeReminderDispatchInput
): Promise<FeeReminderDispatchResult> {
  if (input.channel === "email") {
    if (!input.email) {
      return { success: false, channel: "email", reason: "missing_email" };
    }
    await sendEmail(input.email, "FEE_REMINDER", input.emailPayload);
    return { success: true, channel: "email" };
  }

  if (input.channel === "whatsapp") {
    const phone = normalizePhone(input.phone);
    if (!phone) {
      return { success: false, channel: "whatsapp", reason: "missing_phone" };
    }
    const result = await sendWhatsAppMessage(phone, "FEE_REMINDER", {
      school_name: input.emailPayload.schoolName,
      guardian_name: input.emailPayload.guardianName,
      total_outstanding: (input.emailPayload.totalOutstandingMinor / 100).toFixed(2),
      wards_count: String(input.emailPayload.wards.length),
    });
    return {
      success: result.success,
      channel: "whatsapp",
      reason: result.error,
      mode: result.mode,
    };
  }

  // SMS transport intentionally not implemented yet. This provides a stable channel
  // contract so we can plug in an SMS provider without changing admin UI/API shape.
  return {
    success: false,
    channel: "sms",
    reason: "sms_provider_not_configured",
  };
}

