import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { recordActivity } from "@/lib/audit/recordActivity";
import { trackUsage } from "@/lib/billing/trackUsage";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { ensureMembershipForUser } from "@/lib/auth/canonical-user";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.schools.update");
    if (!gate.ok) return gate.res;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid school id" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const schoolId = new mongoose.Types.ObjectId(id);
    const school = await School.findById(schoolId)
      .select("name status")
      .lean<{ _id: mongoose.Types.ObjectId; name?: string; status?: string } | null>();

    if (!school) {
      return NextResponse.json(
        { success: false, error: "School not found" },
        { status: 404 }
      );
    }

    const adminMembership = await UserMembership.findOne({
      schoolId,
      roles: "school_admin",
    })
      .sort({ createdAt: 1 })
      .select("userId")
      .lean<{ userId: mongoose.Types.ObjectId } | null>();

    const adminUser = adminMembership?.userId
      ? await User.findById(adminMembership.userId)
          .select("_id email firstName lastName name clerkUserId")
          .lean<{
            _id: mongoose.Types.ObjectId;
            email?: string | null;
            firstName?: string | null;
            lastName?: string | null;
            name?: string | null;
            clerkUserId?: string | null;
          } | null>()
      : await User.findOne({
          schoolId,
          role: "school_admin",
        })
          .sort({ createdAt: 1 })
          .select("_id email firstName lastName name clerkUserId")
          .lean<{
            _id: mongoose.Types.ObjectId;
            email?: string | null;
            firstName?: string | null;
            lastName?: string | null;
            name?: string | null;
            clerkUserId?: string | null;
          } | null>();

    if (!adminUser?.email) {
      return NextResponse.json(
        {
          success: false,
          error: "No school admin account with an email is linked to this school.",
        },
        { status: 404 }
      );
    }

    if (adminUser.clerkUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "This school admin already has a linked login account.",
        },
        { status: 409 }
      );
    }

    const adminEmail = adminUser.email.toLowerCase().trim();
    const issued = await issueInvitation({
      email: adminEmail,
      role: "school_admin",
      schoolId,
      invitedBy: gate.actor.userId,
      recipientName:
        adminUser.name ||
        `${adminUser.firstName || ""} ${adminUser.lastName || ""}`.trim() ||
        adminEmail,
      schoolName: school.name || "your school",
      recipientUserId: String(adminUser._id),
      actorRole: "platform_admin",
      relatedEntityType: "school",
      relatedEntityId: id,
      invitationMetadata: {
        firstName: adminUser.firstName || undefined,
        lastName: adminUser.lastName || undefined,
        name: adminUser.name || undefined,
        accessSurface: "school_admin_onboarding",
        source: "platform_school_detail",
      },
    });

    await ensureMembershipForUser({
      userId: adminUser._id,
      schoolId,
      role: "school_admin",
      status: "invited",
    });

    await recordActivity({
      schoolId,
      userId: gate.actor.userId,
      type: "invitation.sent",
      entityType: "invitation",
      entityId: issued.invitationId,
      description: `Issued school admin invite: ${adminEmail}`,
      metadata: {
        email: adminEmail,
        role: "school_admin",
        source: "platform_school_detail",
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
      },
    });

    await trackUsage({
      schoolId: id,
      provider: "internal",
      metricKey: "invitations_sent",
      quantity: 1,
      unitLabel: "invites",
      allocationMethod: "manual",
      sourceType: "manual",
      notes: `School admin invitation ${issued.emailStatus} from platform school detail.`,
    });

    return NextResponse.json({
      success: true,
      data: {
        invitationId: issued.invitationId,
        email: adminEmail,
        status: issued.invitationStatus,
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
        warning: issued.warning,
      },
    });
  } catch (error) {
    console.error("Failed to send school admin invite:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send school admin invite",
      },
      { status: 500 }
    );
  }
}
