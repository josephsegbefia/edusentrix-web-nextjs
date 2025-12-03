import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { clerkClient } from "@clerk/nextjs/server";
import mongoose from "mongoose";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const invitationId = params.id;
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

    // Revoke in Clerk if clerkInvitationId exists and not already revoked
    if (invitation.clerkInvitationId && invitation.status !== "revoked") {
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

    // Delete invitation
    await Invitation.deleteOne({
      _id: new mongoose.Types.ObjectId(invitationId),
    });

    return Response.json({
      success: true,
      message: "Invitation deleted successfully",
    });
  } catch (e: unknown) {
    console.error("Failed to delete invitation:", e);
    const message =
      e instanceof Error ? e.message : "Failed to delete invitation";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
