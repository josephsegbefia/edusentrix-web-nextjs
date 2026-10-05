import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import { School } from "@/models/School";
import mongoose from "mongoose";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { invitationTemplateKeyForRole } from "@/lib/invitations/templates";
import {
  assignPendingBillingOwnerInvitation,
  assignPendingPaymentSetupDelegate,
} from "@/lib/school-payments/billing-owner-lifecycle";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
      "invitations.resend",
    ]);
    const { schoolId, userId } = authCtx;
    await connectToDatabase();

    if (!schoolId) {
      return new Response(
        JSON.stringify({ success: false, error: "School ID not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { id: invitationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid invitation ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const invitationRaw = await Invitation.findOne({
      _id: new mongoose.Types.ObjectId(invitationId),
      schoolId: schoolIdObj,
    }).lean();

    // Normalize invitation (findOne().lean() can be inferred as array by TypeScript)
    const invitation = (
      Array.isArray(invitationRaw) ? invitationRaw[0] || null : invitationRaw
    ) as any;

    if (!invitation) {
      return new Response(
        JSON.stringify({ success: false, error: "Invitation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "accepted") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Cannot resend an accepted invitation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const school = await School.findById(schoolIdObj)
      .select("name")
      .lean();
    const schoolName = school ? (school as any).name : "your school";
    const recipientName =
      invitation.metadata?.firstName && invitation.metadata?.lastName
        ? `${invitation.metadata.firstName} ${invitation.metadata.lastName}`
        : invitation.email;
    const redirectNext =
      invitation.role === "billing_owner" ||
      (invitation.role === "bursar" &&
        invitation.metadata?.accessSurface === "payment_setup_delegate")
        ? "/admin/settings/payment-setup"
        : invitation.role === "teacher"
          ? "/teacher"
          : undefined;

    try {
      invitationTemplateKeyForRole(invitation.role);
      const issued = await issueInvitation({
        email: invitation.email,
        role: invitation.role,
        schoolId: schoolIdObj,
        invitedBy: userId,
        recipientName,
        schoolName,
        redirectNext,
        actorRole: "school_admin",
        relatedEntityType: "invitation",
        relatedEntityId: invitationId,
        existingInvitationId: invitationId,
        invitationMetadata: invitation.metadata || {},
      });

      if (
        invitation.role === "billing_owner" &&
        invitation.metadata?.paymentAuthorityMode !== "owner_replacement"
      ) {
        await assignPendingBillingOwnerInvitation({
          schoolId: schoolIdObj,
          ownerEmail: invitation.email,
          ownerName:
            invitation.metadata?.firstName && invitation.metadata?.lastName
              ? `${invitation.metadata.firstName} ${invitation.metadata.lastName}`.trim()
              : invitation.metadata?.firstName || null,
          updatedBy: userId,
        });
      }

      if (
        invitation.role === "bursar" &&
        invitation.metadata?.accessSurface === "payment_setup_delegate"
      ) {
        await assignPendingPaymentSetupDelegate({
          schoolId: schoolIdObj,
          delegateEmail: invitation.email,
          delegateName:
            invitation.metadata?.firstName && invitation.metadata?.lastName
              ? `${invitation.metadata.firstName} ${invitation.metadata.lastName}`.trim()
              : invitation.metadata?.firstName || null,
          updatedBy: userId,
        });
      }

      // Record activity
      await recordActivity({
        schoolId: schoolIdObj,
        userId: new mongoose.Types.ObjectId(userId),
        type: "invitation.resent",
        entityType: "Invitation",
        entityId: new mongoose.Types.ObjectId(invitationId),
        description: `Resent invitation to ${invitation.email}`,
        ...delegationAuditFields({
          isDelegatedActor: !authCtx.isSchoolAdmin,
          activeDelegationId: authCtx.activeDelegationId,
          module: "invitations",
          action: "invitation.resent",
        }),
        metadata: {
          email: invitation.email,
          role: invitation.role,
          resendCount: issued.resendCount,
          emailStatus: issued.emailStatus,
          deliveryCode: issued.deliveryCode,
        },
      });

      if (issued.invitationStatus === "failed") {
        return new Response(
          JSON.stringify({
            success: false,
            error: issued.warning || "Failed to resend invitation",
            invitationId: issued.invitationId,
            emailStatus: issued.emailStatus,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return Response.json({
        success: true,
        message:
          issued.emailStatus === "sent"
            ? "Invitation resent successfully"
            : issued.warning || "Invitation resent; email delivery is pending",
        data: {
          invitationId: issued.invitationId,
          emailStatus: issued.emailStatus,
          deliveryCode: issued.deliveryCode,
          warning: issued.warning,
        },
      });
    } catch (clerkError: unknown) {
      console.error("Clerk resend error:", clerkError);

      const errorMessage =
        clerkError instanceof Error
          ? clerkError.message
          : "Failed to resend invitation";
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (e: unknown) {
    console.error("Failed to resend invitation:", e);
    const message =
      e instanceof Error ? e.message : "Failed to resend invitation";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
