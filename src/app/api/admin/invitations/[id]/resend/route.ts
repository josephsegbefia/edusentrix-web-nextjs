import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { sendEmail } from "@/lib/email/brevo";
import { recordActivity } from "@/lib/audit/recordActivity";
import { School } from "@/models/School";
import mongoose from "mongoose";
import { getAppUrl, getInvitationRedirectUrl } from "@/lib/utils/getAppUrl";
import {
  assignPendingBillingOwnerInvitation,
  assignPendingPaymentSetupDelegate,
} from "@/lib/school-payments/billing-owner-lifecycle";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
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

    // Resend via Clerk
    const APP_URL = getAppUrl();
    const redirectUrl =
      invitation.role === "billing_owner" ||
      (invitation.role === "bursar" &&
        invitation.metadata?.accessSurface === "payment_setup_delegate")
        ? `${getInvitationRedirectUrl()}?next=${encodeURIComponent(
            "/admin/settings/payment-setup"
          )}`
        : getInvitationRedirectUrl();

    try {
      const clerk = await clerkClient();
      const clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: invitation.email,
        redirectUrl,
        publicMetadata: {
          role: invitation.role,
          schoolId: String(schoolId),
        },
        ignoreExisting: true,
      });

      // Fetch school name for email
      const school = await School.findById(schoolIdObj)
        .select("name")
        .lean();
      const schoolName = school ? (school as any).name : "your school";

      // Send branded email
      await sendEmail(invitation.email, "USER_INVITE", {
        name: invitation.metadata?.firstName && invitation.metadata?.lastName
          ? `${invitation.metadata.firstName} ${invitation.metadata.lastName}`
          : invitation.email,
        role:
          invitation.role === "billing_owner"
            ? "billing owner"
            : invitation.role === "bursar" &&
                invitation.metadata?.accessSurface === "payment_setup_delegate"
              ? "finance delegate"
              : invitation.role,
        schoolName,
        setupLink: `${APP_URL}/sign-in`,
      });

      // Update invitation record
      await Invitation.updateOne(
        { _id: new mongoose.Types.ObjectId(invitationId) },
        {
          $set: {
            clerkInvitationId: clerkInvitation.id,
            lastResentAt: new Date(),
            status: "pending",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
          $inc: { resendCount: 1 },
        }
      );

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
        metadata: {
          email: invitation.email,
          role: invitation.role,
          resendCount: invitation.resendCount + 1,
        },
      });

      // Record activity
      await recordActivity({
        schoolId: schoolIdObj,
        userId: new mongoose.Types.ObjectId(userId),
        type: "invitation.resent",
        entityType: "invitation",
        entityId: invitationId,
        description: `Resent invitation to ${invitation.email}`,
        metadata: {
          invitationId,
          email: invitation.email,
          role: invitation.role,
          resendCount: invitation.resendCount + 1,
        },
      });

      return Response.json({
        success: true,
        message: "Invitation resent successfully",
      });
    } catch (clerkError: unknown) {
      console.error("Clerk resend error:", clerkError);

      // Update status to failed
      await Invitation.updateOne(
        { _id: new mongoose.Types.ObjectId(invitationId) },
        { $set: { status: "failed" } }
      );

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
