// src/app/api/public/admissions/lookup/route.ts
// PUBLIC self-service lookup. A guardian enters their email; we email them
// the tracker links for any applications attached to that address.
//
// Anti-enumeration: this endpoint always returns the same generic 200
// response regardless of whether any applications were found. Bots cannot
// use it to probe whether a given email has an application.
//
// Rate limit: a per-IP soft limit guards against spamming the inbox.
//
// Branding: each school sends its own email so the school logo / sender
// renders correctly (matches ADMISSIONS_TRACKER_LINK registry settings).

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { School } from "@/models/School";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/utils/getAppUrl";

// In-memory IP throttle (5 requests per IP per 15 min). Resets on cold start
// — adequate as an anti-spam guard, not a security boundary.
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const THROTTLE_LIMIT = 5;
const ipBuckets = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isThrottled(ip: string): boolean {
  const now = Date.now();
  const bucket = (ipBuckets.get(ip) ?? []).filter(
    (t) => now - t < THROTTLE_WINDOW_MS
  );
  bucket.push(now);
  ipBuckets.set(ip, bucket);
  return bucket.length > THROTTLE_LIMIT;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const GENERIC_RESPONSE = {
  success: true,
  data: {
    message:
      "If we found applications attached to that email, we’ve sent the tracker links to your inbox.",
  },
} as const;

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (isThrottled(ip)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too many lookup attempts. Please wait a few minutes and try again.",
        },
        { status: 429 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      email?: string;
    } | null;
    const email = (body?.email ?? "").trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const applications = await AdmissionApplication.find({
      "guardian.email": email,
    })
      .select({
        _id: 1,
        referenceCode: 1,
        status: 1,
        submittedAt: 1,
        cycleId: 1,
        schoolId: 1,
        applicant: 1,
        tracker: 1,
        guardian: 1,
        feeStatus: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (applications.length === 0) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    const cycleIds = Array.from(
      new Set(applications.map((a) => String(a.cycleId)))
    );
    const schoolIds = Array.from(
      new Set(applications.map((a) => String(a.schoolId)))
    );
    const [cycles, schools] = await Promise.all([
      AdmissionCycle.find({ _id: { $in: cycleIds } })
        .select({ _id: 1, name: 1, slug: 1 })
        .lean(),
      School.find({ _id: { $in: schoolIds } })
        .select({ _id: 1, name: 1, logo: 1 })
        .lean(),
    ]);
    const cycleMap = new Map(cycles.map((c) => [String(c._id), c]));
    const schoolMap = new Map(
      schools.map((s) => [String(s._id), s as unknown as { _id: unknown; name?: string; logo?: string | null }])
    );

    const guardianName =
      `${applications[0].guardian.firstName ?? ""} ${applications[0].guardian.lastName ?? ""}`.trim();
    const appUrl = getAppUrl();

    const bySchool = new Map<string, typeof applications>();
    for (const app of applications) {
      const key = String(app.schoolId);
      if (!bySchool.has(key)) bySchool.set(key, []);
      bySchool.get(key)!.push(app);
    }

    await Promise.all(
      Array.from(bySchool.entries()).map(async ([schoolKey, apps]) => {
        const school = schoolMap.get(schoolKey);
        const schoolName = school?.name ?? "your school";

        const itemsHtml = apps
          .map((app) => {
            const cycle = cycleMap.get(String(app.cycleId));
            const trackerUrl = `${appUrl}/apply/track/${app.tracker.token}`;
            const statusLabel = String(app.status).replace(/_/g, " ");
            return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
                      ${escapeHtml(cycle?.name ?? "Application")}
                    </p>
                    <h3 style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0f172a;">
                      ${escapeHtml(app.applicant.firstName ?? "")} ${escapeHtml(app.applicant.lastName ?? "")}
                    </h3>
                    <p style="margin:6px 0 0;font-size:13px;color:#475569;">
                      Reference <strong style="color:#0f172a;">${escapeHtml(app.referenceCode)}</strong>
                      &middot; Status <span style="text-transform:capitalize;">${escapeHtml(statusLabel)}</span>
                    </p>
                    <p style="margin:14px 0 0;">
                      <a href="${trackerUrl}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">
                        Open application
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            `;
          })
          .join("");

        const subject =
          apps.length === 1
            ? `Your ${schoolName} admission application`
            : `Your ${schoolName} admission applications (${apps.length})`;

        const htmlContent = `
          <p>Hi ${escapeHtml(guardianName || "there")},</p>
          <p>You requested a list of your admission applications. Here is what we have on file at <strong>${escapeHtml(schoolName)}</strong> for <strong>${escapeHtml(email)}</strong>:</p>
          ${itemsHtml}
          <p style="margin-top:24px;font-size:12px;color:#64748b;">
            If you didn’t request this email, you can safely ignore it — no changes were made.
          </p>
        `;

        await sendTrackedBrevoEmail({
          to: email,
          toName: guardianName || undefined,
          subject,
          htmlContent,
          templateKey: "ADMISSIONS_TRACKER_LINK",
          schoolId: schoolKey,
          schoolName,
          schoolLogo: school?.logo ?? null,
          relatedEntityType: "admission_application",
        });
      })
    );

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    console.error("Public admissions lookup error:", error);
    return NextResponse.json(GENERIC_RESPONSE);
  }
}
