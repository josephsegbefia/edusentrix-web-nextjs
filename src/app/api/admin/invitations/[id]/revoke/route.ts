import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import mongoose from "mongoose";
import {
  releasePendingBillingOwnerInvitation,
  releasePendingPaymentSetupDelegate,
} from "@/lib/school-payments/billing-owner-lifecycle";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedAnyPermission([
      "invitations.revoke",
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
          error: "Cannot revoke an accepted invitation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (invitation.status === "revoked") {
      return Response.json({
        success: true,
        message: "Invitation already revoked",
      });
    }

    // Revoke in Clerk if clerkInvitationId exists
    if (invitation.clerkInvitationId) {
      try {
        const clerk = await clerkClient();
        await clerk.invitations.revokeInvitation(
          String(invitation.clerkInvitationId)
        );
      } catch (clerkError: unknown) {
        // Log but don't fail - invitation might already be revoked in Clerk
        console.warn("Clerk revoke error (may be already revoked):", clerkError);
      }
    }

    // Update invitation status
    await Invitation.updateOne(
      { _id: new mongoose.Types.ObjectId(invitationId) },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
        },
      }
    );

    if (
      invitation.role === "billing_owner" &&
      invitation.metadata?.paymentAuthorityMode !== "owner_replacement"
    ) {
      await releasePendingBillingOwnerInvitation({
        schoolId: schoolIdObj,
        ownerEmail: invitation.email,
        updatedBy: userId,
      });
    }

    if (
      invitation.role === "bursar" &&
      invitation.metadata?.accessSurface === "payment_setup_delegate"
    ) {
      await releasePendingPaymentSetupDelegate({
        schoolId: schoolIdObj,
        delegateEmail: invitation.email,
        updatedBy: userId,
      });
    }

    // Record activity
    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      type: "invitation.revoked",
      entityType: "Invitation",
      entityId: new mongoose.Types.ObjectId(invitationId),
      description: `Revoked invitation to ${invitation.email}`,
      ...delegationAuditFields({
        isDelegatedActor: !authCtx.isSchoolAdmin,
        activeDelegationId: authCtx.activeDelegationId,
        module: "invitations",
        action: "invitation.revoked",
      }),
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
    });

    return Response.json({
      success: true,
      message: "Invitation revoked successfully",
    });
  } catch (e: unknown) {
    console.error("Failed to revoke invitation:", e);
    const message =
      e instanceof Error ? e.message : "Failed to revoke invitation";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
