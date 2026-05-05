import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { trackUsage } from "@/lib/billing/trackUsage";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
import { assignPendingBillingOwnerInvitation } from "@/lib/school-payments/billing-owner-lifecycle";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";

const BodySchema = z.object({
  ownerName: z.string().trim().min(2, "Owner name is required").max(120),
  ownerEmail: z.email("A valid owner email is required"),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformAdmin();
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    await connectToDatabase();

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid billing owner details",
        },
        { status: 400 }
      );
    }

    const schoolId = id;
    const normalizedEmail = parsed.data.ownerEmail.toLowerCase().trim();
    const inviteMode = "owner_initial" as const;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const existingPending = await Invitation.findOne({
      schoolId: schoolIdObj,
      role: "billing_owner",
      status: "pending",
      expiresAt: { $gt: new Date() },
      "metadata.accessSurface": "payment_setup",
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: "A billing owner invitation is already pending for this school.",
          invitationId: String(existingPending._id),
        },
        { status: 409 }
      );
    }

    const school = await School.findById(schoolId)
      .select("name bank billing")
      .lean<{
        name?: string;
        bank?: {
          bankName?: string | null;
          branchName?: string | null;
          sortCode?: string | null;
          accountName?: string | null;
          accountNumber?: string | null;
        } | null;
        billing?: {
          status?: "unprovisioned" | "provisioned" | "failed" | null;
          paymentSetup?: {
            status?:
              | "not_started"
              | "awaiting_billing_owner"
              | "details_submitted"
              | "pending_provisioning"
              | "review_required"
              | "provisioned"
              | "failed"
              | null;
          } | null;
          paystack?: {
            subaccountCode?: string | null;
          } | null;
        } | null;
      } | null>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const redirectUrl = `${getInvitationRedirectUrl()}?next=${encodeURIComponent(
      "/admin/settings/payment-setup"
    )}`;
    const clerk = await clerkClient();
    let clerkInvitationId: string | undefined;
    let clerkInvitation: { id: string; url?: string | null } | null = null;
    let invitationStatus: "pending" | "failed" = "pending";
    let invitationError: string | null = null;
    let emailDeliveryWarning: string | null = null;

    try {
      clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: normalizedEmail,
        redirectUrl,
        notify: false,
        publicMetadata: {
          role: "billing_owner",
          schoolId: String(schoolId),
        },
        ignoreExisting: true,
      });
      clerkInvitationId = clerkInvitation.id;
    } catch (inviteError: unknown) {
      console.error("Billing owner invitation error:", inviteError);
      invitationStatus = "failed";
      invitationError =
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to create billing owner invitation";
    }

    if (invitationStatus === "pending") {
      try {
        const rendered = renderTemplate("USER_INVITE", {
          name: parsed.data.ownerName,
          role: "billing owner",
          schoolName: school.name || "your school",
          setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
        });

        await sendTrackedBrevoEmail({
          to: normalizedEmail,
          subject: rendered.subject,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent,
          templateKey: "BILLING_OWNER_INVITE",
          schoolId: String(schoolId),
          schoolName: school.name || undefined,
          actorId: String(gate.me._id),
          actorRole: "platform_admin",
          relatedEntityType: "invitation",
        });
      } catch (emailError: unknown) {
        console.error("Billing owner invite email error:", emailError);
        emailDeliveryWarning =
          emailError instanceof Error
            ? emailError.message
            : "Failed to send billing owner email";
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const created = await Invitation.create({
      email: normalizedEmail,
      role: "billing_owner",
      schoolId: schoolIdObj,
      status: invitationStatus,
      clerkInvitationId,
      sentAt: new Date(),
      expiresAt,
      resendCount: 0,
      invitedBy: new mongoose.Types.ObjectId(String(gate.me._id)),
      metadata: {
        firstName: parsed.data.ownerName,
        accessSurface: "payment_setup",
        paymentAuthorityMode: inviteMode,
      },
    });

    if (invitationStatus === "pending" && inviteMode === "owner_initial") {
      await assignPendingBillingOwnerInvitation({
        schoolId,
        ownerEmail: normalizedEmail,
        ownerName: parsed.data.ownerName,
        updatedBy: gate.me._id,
      });
    }

    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(String(gate.me._id)),
      type: "invitation.sent",
      entityType: "invitation",
      entityId: String(created._id),
      description:
        invitationStatus === "pending"
          ? `Invited billing owner (platform assist): ${normalizedEmail}`
          : `Billing owner invitation failed: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "billing_owner",
        status: invitationStatus,
        emailDeliveryWarning,
        assistedByPlatform: true,
      },
    });

    if (invitationStatus === "pending") {
      await trackUsage({
        schoolId,
        provider: "internal",
        metricKey: "invitations_sent",
        quantity: 1,
        unitLabel: "invites",
        allocationMethod: "manual",
        sourceType: "manual",
        notes: "Billing owner invitation issued from platform assisted onboarding.",
      });
    }

    if (invitationStatus === "failed") {
      return NextResponse.json(
        {
          success: false,
          error: invitationError || "Failed to create billing owner invitation",
          invitationId: String(created._id),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invitationId: String(created._id),
        email: normalizedEmail,
        role: created.role,
        status: created.status,
        mode: inviteMode,
        expiresAt: created.expiresAt.toISOString(),
        warning: emailDeliveryWarning,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to invite billing owner:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to invite billing owner",
      },
      { status: 500 }
    );
  }
}
