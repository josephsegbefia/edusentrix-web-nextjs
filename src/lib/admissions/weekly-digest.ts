// src/lib/admissions/weekly-digest.ts
// Renders + sends the weekly admissions digest to admission managers.
//
// Triggered by the cron route at /api/cron/admissions-weekly-digest. Safe to
// call ad-hoc for testing — it gates on whether a school actually has an
// active admission cycle.

import "server-only";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { renderGenericBrandedEmail } from "@/lib/email/branded-template";
import { sendTrackedBrevoEmail } from "@/lib/email/services/send-brevo-email";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import {
  buildSchoolDigestPayload,
  type SchoolDigestPayload,
} from "@/lib/admissions/analytics";
import { getAppUrl } from "@/lib/utils/getAppUrl";

const TEMPLATE_KEY = "ADMISSIONS_WEEKLY_DIGEST";

export type DigestRecipient = {
  userId: Types.ObjectId;
  email: string;
  firstName?: string | null;
  role: string;
};

export type DigestSendResult = {
  schoolId: string;
  schoolName: string;
  cycleCount: number;
  recipients: number;
  sent: number;
  skipped: number;
  reason?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function durationFromHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

function renderCycleBlock(
  cycle: SchoolDigestPayload["cycles"][number],
  appUrl: string
): string {
  const cycleHref = `${appUrl}/admin/admissions/${cycle.cycleId}`;
  const tone =
    cycle.pendingActions.decisionsOlderThan48h > 0 ? "#d97706" : "#0f172a";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <tr>
        <td style="padding:18px 18px 6px 18px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
            Cycle
          </p>
          <h3 style="margin:4px 0 0;font-size:16px;font-weight:600;color:#0f172a;">
            ${escapeHtml(cycle.cycleName)}
          </h3>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 18px 18px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td width="33%" style="padding:6px 8px;background:#f8fafc;border-radius:8px;">
                <div style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">New this week</div>
                <div style="font-size:18px;font-weight:600;color:#0f172a;">${formatNumber(cycle.totals.submittedThisWeek)}</div>
              </td>
              <td width="2"></td>
              <td width="33%" style="padding:6px 8px;background:#f8fafc;border-radius:8px;">
                <div style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Decisioned</div>
                <div style="font-size:18px;font-weight:600;color:#0f172a;">${formatNumber(cycle.totals.decidedThisWeek)}</div>
              </td>
              <td width="2"></td>
              <td width="33%" style="padding:6px 8px;background:#f8fafc;border-radius:8px;">
                <div style="font-size:11px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Provisioned</div>
                <div style="font-size:18px;font-weight:600;color:#0f172a;">${formatNumber(cycle.totals.provisionedThisWeek)}</div>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="padding:8px 0;color:#475569;">Total submitted</td>
              <td style="padding:8px 0;text-align:right;color:#0f172a;font-weight:600;">${formatNumber(cycle.totals.applications)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;">Submitted → enrolled</td>
              <td style="padding:8px 0;text-align:right;color:#0f172a;font-weight:600;">
                ${pct(
                  cycle.totals.applications
                    ? cycle.funnel[cycle.funnel.length - 1].count /
                        cycle.totals.applications
                    : 0
                )}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#475569;">Median decision time</td>
              <td style="padding:8px 0;text-align:right;color:#0f172a;font-weight:600;">${durationFromHours(cycle.decisionVelocity.medianHours)}</td>
            </tr>
          </table>

          ${
            cycle.pendingActions.decisionsOlderThan48h > 0 ||
            cycle.pendingActions.outstandingFees > 0 ||
            cycle.pendingActions.unreviewedApplications > 0
              ? `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
              <tr>
                <td style="padding:12px 14px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${tone};letter-spacing:0.06em;text-transform:uppercase;">
                    Needs attention
                  </p>
                  <ul style="margin:0;padding-left:18px;font-size:13px;color:#0f172a;">
                    ${
                      cycle.pendingActions.decisionsOlderThan48h > 0
                        ? `<li>${formatNumber(cycle.pendingActions.decisionsOlderThan48h)} application${cycle.pendingActions.decisionsOlderThan48h === 1 ? "" : "s"} waiting more than 48 hours</li>`
                        : ""
                    }
                    ${
                      cycle.pendingActions.unreviewedApplications > 0
                        ? `<li>${formatNumber(cycle.pendingActions.unreviewedApplications)} new application${cycle.pendingActions.unreviewedApplications === 1 ? "" : "s"} not yet reviewed</li>`
                        : ""
                    }
                    ${
                      cycle.pendingActions.outstandingFees > 0
                        ? `<li>${formatNumber(cycle.pendingActions.outstandingFees)} application fee${cycle.pendingActions.outstandingFees === 1 ? "" : "s"} outstanding</li>`
                        : ""
                    }
                  </ul>
                </td>
              </tr>
            </table>
          `
              : ""
          }

          <p style="margin:18px 0 0;text-align:center;">
            <a href="${cycleHref}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
              Open cycle →
            </a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

export async function renderWeeklyDigest(
  payload: SchoolDigestPayload,
  schoolName: string,
  recipientFirstName: string | null
): Promise<{ subject: string; htmlContent: string; textContent: string }> {
  const appUrl = getAppUrl();

  if (payload.cycles.length === 0) {
    const subject = `${schoolName} — Admissions weekly recap`;
    const html = renderGenericBrandedEmail({
      subject,
      htmlContent: `
        <p>Hi ${escapeHtml(recipientFirstName || "there")},</p>
        <p>Here is the weekly admissions recap for <strong>${escapeHtml(schoolName)}</strong>.</p>
        <p style="color:#64748b;">No active admission cycles this week. As soon as you publish a cycle, this digest will start summarising new applications, decisions, and outstanding actions.</p>
        <p style="margin-top:24px;text-align:center;">
          <a href="${appUrl}/admin/admissions" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
            Open admissions
          </a>
        </p>
      `,
      preheader: `Weekly admissions recap for ${schoolName}`,
      brand: { name: schoolName },
    });
    return {
      subject,
      htmlContent: html,
      textContent: `Hi ${recipientFirstName || "there"},\n\nNo active admission cycles this week for ${schoolName}.\nVisit ${appUrl}/admin/admissions to start a cycle.`,
    };
  }

  const totals = payload.cycles.reduce(
    (acc, c) => ({
      submitted: acc.submitted + c.totals.submittedThisWeek,
      decided: acc.decided + c.totals.decidedThisWeek,
      provisioned: acc.provisioned + c.totals.provisionedThisWeek,
      applications: acc.applications + c.totals.applications,
    }),
    { submitted: 0, decided: 0, provisioned: 0, applications: 0 }
  );

  const subject = `${schoolName} — ${formatNumber(totals.submitted)} new applications this week`;

  const cyclesHtml = payload.cycles.map((c) => renderCycleBlock(c, appUrl)).join("");

  const htmlContent = renderGenericBrandedEmail({
    subject,
    htmlContent: `
      <p>Hi ${escapeHtml(recipientFirstName || "there")},</p>
      <p>Here’s how admissions performed this week at <strong>${escapeHtml(schoolName)}</strong>.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
        <tr>
          <td width="33%" style="padding:14px;background:#eef2ff;border-radius:10px;text-align:center;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">New</div>
            <div style="margin-top:4px;font-size:24px;font-weight:700;color:#0f172a;">${formatNumber(totals.submitted)}</div>
          </td>
          <td width="2"></td>
          <td width="33%" style="padding:14px;background:#ecfdf5;border-radius:10px;text-align:center;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#047857;">Decisioned</div>
            <div style="margin-top:4px;font-size:24px;font-weight:700;color:#0f172a;">${formatNumber(totals.decided)}</div>
          </td>
          <td width="2"></td>
          <td width="33%" style="padding:14px;background:#fffbeb;border-radius:10px;text-align:center;">
            <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#d97706;">Provisioned</div>
            <div style="margin-top:4px;font-size:24px;font-weight:700;color:#0f172a;">${formatNumber(totals.provisioned)}</div>
          </td>
        </tr>
      </table>

      ${cyclesHtml}

      <p style="margin-top:28px;font-size:12px;color:#64748b;">
        You’re receiving this digest because you manage admissions for ${escapeHtml(schoolName)}.
        Manage notification preferences in your account settings.
      </p>
    `,
    preheader: `${formatNumber(totals.submitted)} new this week · ${formatNumber(totals.decided)} decisioned`,
    brand: { name: schoolName },
  });

  const textContent = [
    `Admissions weekly recap for ${schoolName}`,
    "",
    `New: ${totals.submitted}`,
    `Decisioned: ${totals.decided}`,
    `Provisioned: ${totals.provisioned}`,
    "",
    `Open admissions: ${appUrl}/admin/admissions`,
  ].join("\n");

  return { subject, htmlContent, textContent };
}

export async function listDigestRecipients(
  schoolId: Types.ObjectId
): Promise<DigestRecipient[]> {
  await connectToDatabase();
  const memberships = await UserMembership.find({
    schoolId,
    status: "active",
    $or: [
      { roles: { $in: ["school_admin"] } },
      { subroles: { $in: ["admissions_officer"] } },
    ],
  })
    .select({ userId: 1, roles: 1 })
    .lean();

  if (memberships.length === 0) return [];

  const userIds = memberships.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } })
    .select({ _id: 1, email: 1, firstName: 1 })
    .lean();
  const userMap = new Map<
    string,
    { email?: string; firstName?: string | null }
  >();
  for (const u of users) {
    userMap.set(String(u._id), {
      email: u.email,
      firstName: u.firstName ?? null,
    });
  }

  const recipients: DigestRecipient[] = [];
  for (const m of memberships) {
    const u = userMap.get(String(m.userId));
    if (!u?.email) continue;
    const isAdmin = (m.roles ?? []).includes("school_admin");
    recipients.push({
      userId: m.userId as Types.ObjectId,
      email: u.email,
      firstName: u.firstName ?? null,
      role: isAdmin ? "school_admin" : "admissions_officer",
    });
  }
  return recipients;
}

export async function sendWeeklyDigestForSchool(
  schoolId: Types.ObjectId,
  options: { dryRun?: boolean } = {}
): Promise<DigestSendResult> {
  await connectToDatabase();
  const school = await School.findById(schoolId)
    .select({ name: 1, logo: 1 })
    .lean();
  const schoolName = (school as { name?: string } | null)?.name ?? "Your school";

  const payload = await buildSchoolDigestPayload(schoolId);
  const recipients = await listDigestRecipients(schoolId);

  const result: DigestSendResult = {
    schoolId: String(schoolId),
    schoolName,
    cycleCount: payload.cycles.length,
    recipients: recipients.length,
    sent: 0,
    skipped: 0,
  };

  if (payload.cycles.length === 0) {
    result.skipped = recipients.length;
    result.reason = "no active cycles";
    return result;
  }
  if (recipients.length === 0) {
    result.reason = "no recipients";
    return result;
  }

  for (const recipient of recipients) {
    try {
      const email = await renderWeeklyDigest(
        payload,
        schoolName,
        recipient.firstName ?? null
      );
      if (options.dryRun) {
        result.sent += 1;
        continue;
      }
      await sendTrackedBrevoEmail({
        to: recipient.email,
        toName: recipient.firstName ?? undefined,
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
        templateKey: TEMPLATE_KEY,
        schoolId: String(schoolId),
        schoolName,
      });
      result.sent += 1;
    } catch (err) {
      console.error(
        `Weekly digest send failed for ${recipient.email}:`,
        err instanceof Error ? err.message : err
      );
      result.skipped += 1;
    }
  }
  return result;
}
