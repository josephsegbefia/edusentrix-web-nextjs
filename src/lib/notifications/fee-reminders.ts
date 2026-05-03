import "server-only";

import mongoose from "mongoose";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { loadSchoolInternalTestSnapshot } from "@/lib/internal-test/load-internal-test-context";
import {
  shouldSuppressNotification,
  shouldSuppressParentFacingWhatsApp,
} from "@/lib/internal-test/shouldSuppressNotification";
import { renderTemplate } from "@/lib/email/templates";
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
  schoolId?: string | null;
  schoolName?: string | null;
  actorId?: string | null;
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
  if (input.schoolId && mongoose.Types.ObjectId.isValid(input.schoolId)) {
    const snap = await loadSchoolInternalTestSnapshot(
      new mongoose.Types.ObjectId(input.schoolId)
    );
    if (
      input.channel === "email" &&
      shouldSuppressNotification(snap, "parent_notification")
    ) {
      return {
        success: false,
        channel: "email",
        reason: "internal_test_suppressed",
      };
    }
    if (input.channel === "sms" && shouldSuppressNotification(snap, "sms")) {
      return {
        success: false,
        channel: "sms",
        reason: "internal_test_suppressed",
      };
    }
    if (
      input.channel === "whatsapp" &&
      shouldSuppressParentFacingWhatsApp(snap)
    ) {
      return {
        success: false,
        channel: "whatsapp",
        reason: "internal_test_suppressed",
      };
    }
  }

  if (input.channel === "email") {
    if (!input.email) {
      return { success: false, channel: "email", reason: "missing_email" };
    }
    const rendered = renderTemplate("FEE_REMINDER", input.emailPayload);

    await sendTrackedBrevoEmail({
      to: input.email,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      templateKey: "FEE_REMINDER",
      schoolId: input.schoolId,
      schoolName: input.schoolName,
      actorId: input.actorId,
      relatedEntityType: "fee_reminder",
    });
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

