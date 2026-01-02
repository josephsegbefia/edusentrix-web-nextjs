import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: invitationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid invitation ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const invitation = await Invitation.findOne({
      _id: new mongoose.Types.ObjectId(invitationId),
      schoolId: new mongoose.Types.ObjectId(schoolId),
    }).lean();

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
        await clerk.invitations.revokeInvitation({
          invitationId: invitation.clerkInvitationId,
        });
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

    // Record activity
    await recordActivity({
      schoolId,
      userId: new mongoose.Types.ObjectId(userId),
      type: "invitation.revoked",
      entityType: "Invitation",
      entityId: new mongoose.Types.ObjectId(invitationId),
      description: `Revoked invitation to ${invitation.email}`,
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
