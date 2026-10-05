import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { trackUsage } from "@/lib/billing/trackUsage";
import { recordActivity } from "@/lib/audit/recordActivity";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { assignPendingBillingOwnerInvitation } from "@/lib/school-payments/billing-owner-lifecycle";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";

const BodySchema = z.object({
  ownerName: z.string().trim().min(2, "Owner name is required").max(120),
  ownerEmail: z.email("A valid owner email is required"),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canInviteOwner) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the current billing owner or the school setup owner can invite a billing owner.",
        },
        { status: 403 }
      );
    }

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

    const normalizedEmail = parsed.data.ownerEmail.toLowerCase().trim();
    const inviteMode =
      access.accessMode === "billing_owner" ? "owner_replacement" : "owner_initial";
    const schoolIdObj = new mongoose.Types.ObjectId(String(access.schoolId));
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

    const school = await School.findById(access.schoolId)
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

    const issued = await issueInvitation({
      email: normalizedEmail,
      role: "billing_owner",
      schoolId: schoolIdObj,
      invitedBy: access.userId,
      recipientName: parsed.data.ownerName,
      schoolName: school.name || "your school",
      redirectNext: "/admin/settings/payment-setup",
      actorRole: "school_admin",
      relatedEntityType: "invitation",
      invitationMetadata: {
        firstName: parsed.data.ownerName,
        accessSurface: "payment_setup",
        paymentAuthorityMode: inviteMode,
      },
    });
    const invitationStatus = issued.invitationStatus;
    const invitationError = issued.warning || null;
    const created = await Invitation.findById(issued.invitationId);

    if (invitationStatus === "pending" && inviteMode === "owner_initial") {
      await assignPendingBillingOwnerInvitation({
        schoolId: access.schoolId,
        ownerEmail: normalizedEmail,
        ownerName: parsed.data.ownerName,
        updatedBy: access.userId,
      });
    }

    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(String(access.userId)),
      type: "invitation.sent",
      entityType: "invitation",
      entityId: issued.invitationId,
      description:
        invitationStatus === "pending"
          ? `Invited billing owner: ${normalizedEmail}`
          : `Billing owner invitation failed: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "billing_owner",
        status: invitationStatus,
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
      },
    });

    if (invitationStatus === "pending") {
      await trackUsage({
        schoolId: access.schoolId,
        provider: "internal",
        metricKey: "invitations_sent",
        quantity: 1,
        unitLabel: "invites",
        allocationMethod: "manual",
        sourceType: "manual",
        notes: "Billing owner invitation issued from payment setup.",
      });
    }

    if (invitationStatus === "failed") {
      return NextResponse.json(
        {
          success: false,
          error: invitationError || "Failed to create billing owner invitation",
          invitationId: issued.invitationId,
          emailStatus: issued.emailStatus,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invitationId: issued.invitationId,
        email: normalizedEmail,
        role: "billing_owner",
        status: invitationStatus,
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
        mode: inviteMode,
        expiresAt: created?.expiresAt?.toISOString(),
        warning: issued.warning,
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
