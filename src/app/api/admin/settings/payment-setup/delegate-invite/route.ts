import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { trackUsage } from "@/lib/billing/trackUsage";
import { recordActivity } from "@/lib/audit/recordActivity";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { assignPendingPaymentSetupDelegate } from "@/lib/school-payments/billing-owner-lifecycle";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";

const BodySchema = z.object({
  delegateName: z.string().trim().min(2, "Delegate name is required").max(120),
  delegateEmail: z.email("A valid delegate email is required"),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requirePaymentSetupAccess();
    if (!access.capabilities.canManageDelegate) {
      return NextResponse.json(
        {
          success: false,
          error: "Only the billing owner can assign a finance delegate.",
        },
        { status: 403 }
      );
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message || "Invalid finance delegate details",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.delegateEmail.toLowerCase().trim();
    const schoolIdObj = new mongoose.Types.ObjectId(String(access.schoolId));
    const school = await School.findById(access.schoolId)
      .select("name billing")
      .lean<{
        name?: string;
        billing?: {
          paymentSetup?: {
            ownerEmail?: string | null;
            delegateEmail?: string | null;
          } | null;
        } | null;
      } | null>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const ownerEmail = school.billing?.paymentSetup?.ownerEmail?.toLowerCase().trim();
    const currentDelegateEmail =
      school.billing?.paymentSetup?.delegateEmail?.toLowerCase().trim() || null;

    if (ownerEmail && ownerEmail === normalizedEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "The current billing owner already has payment setup access.",
        },
        { status: 409 }
      );
    }

    if (currentDelegateEmail) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A finance delegate is already assigned. Remove them before inviting a replacement.",
        },
        { status: 409 }
      );
    }

    const existingPending = await Invitation.findOne({
      schoolId: schoolIdObj,
      role: "bursar",
      status: "pending",
      expiresAt: { $gt: new Date() },
      "metadata.accessSurface": "payment_setup_delegate",
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (existingPending) {
      return NextResponse.json(
        {
          success: false,
          error: "A finance delegate invitation is already pending for this school.",
          invitationId: String(existingPending._id),
        },
        { status: 409 }
      );
    }

    const issued = await issueInvitation({
      email: normalizedEmail,
      role: "bursar",
      schoolId: schoolIdObj,
      invitedBy: access.userId,
      recipientName: parsed.data.delegateName,
      schoolName: school.name || "your school",
      redirectNext: "/admin/settings/payment-setup",
      actorRole: "school_admin",
      relatedEntityType: "invitation",
      invitationMetadata: {
        firstName: parsed.data.delegateName,
        accessSurface: "payment_setup_delegate",
      },
    });
    const invitationStatus = issued.invitationStatus;
    const invitationError = issued.warning || null;
    const created = await Invitation.findById(issued.invitationId);

    if (invitationStatus === "pending") {
      await assignPendingPaymentSetupDelegate({
        schoolId: access.schoolId,
        delegateEmail: normalizedEmail,
        delegateName: parsed.data.delegateName,
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
          ? `Invited finance delegate: ${normalizedEmail}`
          : `Finance delegate invitation failed: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "bursar",
        accessSurface: "payment_setup_delegate",
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
        notes: "Finance delegate invitation issued from payment setup.",
      });
    }

    if (invitationStatus === "failed") {
      return NextResponse.json(
        {
          success: false,
          error: invitationError || "Failed to create finance delegate invitation",
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
        role: "bursar",
        status: invitationStatus,
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
        expiresAt: created?.expiresAt?.toISOString(),
        warning: issued.warning,
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Failed to invite finance delegate:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to invite finance delegate",
      },
      { status: 500 }
    );
  }
}
