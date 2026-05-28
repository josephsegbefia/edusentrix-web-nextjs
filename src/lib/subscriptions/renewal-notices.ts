import "server-only";

import { Types } from "mongoose";
import { SchoolSubscription } from "@/models/SchoolSubscription";
import { Notification } from "@/models/Notification";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { resolveSchoolBillingRecipients } from "./admin-recipients";
import { recordSubscriptionEvent } from "./record-event";

const NOTICE_WINDOWS = [30, 14, 7, 1] as const;

function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" });
}

export async function sendSubscriptionRenewalNotices(options?: {
  now?: Date;
  dryRun?: boolean;
  schoolId?: string;
}) {
  const now = options?.now ?? new Date();
  const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const filter: Record<string, unknown> = {
    status: { $in: ["active", "pilot", "grace"] },
    endsAt: { $gte: now, $lte: maxDate },
  };
  if (options?.schoolId) filter.schoolId = new Types.ObjectId(options.schoolId);

  const subs = await SchoolSubscription.find(filter).lean();
  let considered = 0;
  let notified = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (!sub.endsAt) continue;
    const days = daysUntil(sub.endsAt, now);
    const window = NOTICE_WINDOWS.find((candidate) => days <= candidate && days > candidate - 7);
    if (!window) continue;
    considered += 1;

    const existing = await import("@/models/SubscriptionEvent").then(({ SubscriptionEvent }) =>
      SubscriptionEvent.exists({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "subscription_renewal_notice_sent",
        "metadata.windowDays": window,
      })
    );
    if (existing) {
      skipped += 1;
      continue;
    }

    const recipients = await resolveSchoolBillingRecipients(sub.schoolId);
    if (!recipients.length) {
      skipped += 1;
      continue;
    }

    if (!options?.dryRun) {
      for (const recipient of recipients) {
        if (recipient.userId) {
          await Notification.create({
            schoolId: sub.schoolId,
            userId: recipient.userId,
            type: "reminder",
            title: "Subscription renewal due",
            body: `${sub.tierName || "Your subscription"} renews on ${formatDate(sub.endsAt)}.`,
            priority: days <= 7 ? "high" : "normal",
            entityType: "SchoolSubscription",
            entityId: sub._id,
            actionUrl: "/admin/subscription",
            metadata: { windowDays: window, endsAt: sub.endsAt.toISOString(), planCode: sub.tierCode ?? null },
          });
        }

        await sendTrackedBrevoEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: `Subscription renewal due in ${days} day${days === 1 ? "" : "s"}`,
          htmlContent: `<p>${sub.tierName || "Your EduSentrix subscription"} renews on <strong>${formatDate(sub.endsAt)}</strong>.</p><p>Please review the subscription page or contact EduSentrix billing if you need a plan change before renewal.</p>`,
          textContent: `${sub.tierName || "Your EduSentrix subscription"} renews on ${formatDate(sub.endsAt)}. Review the subscription page or contact EduSentrix billing if you need a plan change before renewal.`,
          templateKey: "SUBSCRIPTION_STATUS_CHANGE",
          schoolId: String(sub.schoolId),
          relatedEntityType: "SchoolSubscription",
          relatedEntityId: String(sub._id),
          recipientUserId: recipient.userId ? String(recipient.userId) : null,
          recipientRole: recipient.role,
          async: true,
        });
      }

      await recordSubscriptionEvent({
        schoolId: sub.schoolId,
        subscriptionId: sub._id,
        eventType: "subscription_renewal_notice_sent",
        actorEmail: "system",
        summary: `Renewal notice sent ${days} day${days === 1 ? "" : "s"} before subscription end.`,
        metadata: { windowDays: window, daysRemaining: days, endsAt: sub.endsAt.toISOString() },
      });
    }

    notified += recipients.length;
  }

  return { considered, notified, skipped, dryRun: Boolean(options?.dryRun) };
}
