// src/app/api/admin/admissions/cycles/[cycleId]/invites/route.ts
// Send a direct application invite to one or more guardians via email.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { School } from "@/models/School";
import { sendRawEmail } from "@/lib/email/brevo";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

type Params = Promise<{ cycleId: string }>;

const InviteSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
  message: z.string().max(2000).optional(),
});

function originFromRequest(req: NextRequest): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.send_email");
    const { cycleId } = await params;
    if (!mongoose.Types.ObjectId.isValid(cycleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid cycle id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid invite payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const cycle = await AdmissionCycle.findOne({
      _id: cycleId,
      schoolId: ctx.schoolId,
    });
    if (!cycle) {
      return NextResponse.json(
        { success: false, error: "Cycle not found" },
        { status: 404 }
      );
    }
    if (cycle.status !== "published") {
      return NextResponse.json(
        {
          success: false,
          error: "Publish the cycle before sending invites.",
        },
        { status: 409 }
      );
    }

    const school = await School.findById(ctx.schoolId)
      .select({ name: 1 })
      .lean();
    const schoolName = (school as { name?: string } | null)?.name ?? "the school";

    const origin = originFromRequest(req);
    const applyUrl = `${origin}/apply/${ctx.schoolId.toString()}/${cycle.slug}?via=invite`;
    const customMsg = parsed.data.message?.trim();

    const results = await Promise.allSettled(
      parsed.data.recipients.map(async (r) => {
        const html = `
          <p>Hello${r.name ? ` ${r.name}` : ""},</p>
          <p>You're invited to apply to <strong>${schoolName}</strong> for our
          <strong>${cycle.name}</strong> intake.</p>
          ${customMsg ? `<blockquote style="border-left:3px solid #d1d5db;padding-left:12px;color:#4b5563">${customMsg}</blockquote>` : ""}
          <p style="margin-top:20px">
            <a href="${applyUrl}" style="background:#0a4ad9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open application</a>
          </p>
          <p style="font-size:12px;color:#6b7280">Or paste this link into your browser:<br/>
          ${applyUrl}</p>
        `;
        await sendRawEmail({
          to: r.email,
          subject: `You're invited to apply to ${schoolName}`,
          htmlContent: html,
        });
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    return NextResponse.json({
      success: true,
      data: {
        sent,
        failed,
        recipients: results.map((r, i) => ({
          email: parsed.data.recipients[i].email,
          ok: r.status === "fulfilled",
          error:
            r.status === "rejected"
              ? r.reason instanceof Error
                ? r.reason.message
                : String(r.reason)
              : null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admissions invite error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send invites" },
      { status: 500 }
    );
  }
}
