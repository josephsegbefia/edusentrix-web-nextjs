import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { recordActivity } from "@/lib/audit/recordActivity";
import { trackUsage } from "@/lib/billing/trackUsage";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
  withInvitedEmail,
} from "@/lib/utils/getAppUrl";
import { Invitation } from "@/models/Invitation";
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
    const redirectUrl = withInvitedEmail(
      getInvitationRedirectUrl(),
      adminEmail
    );
    const clerk = await clerkClient();
    const clerkInvitation = await clerk.invitations.createInvitation({
      emailAddress: adminEmail,
      redirectUrl,
      notify: false,
      publicMetadata: {
        role: "school_admin",
        schoolId: id,
      },
      ignoreExisting: true,
    });

    const rendered = renderTemplate("SCHOOL_INVITE", {
      schoolName: school.name || "your school",
      setupLink: getInvitationAcceptUrl(
        clerkInvitation,
        redirectUrl,
        adminEmail
      ),
    });

    await sendTrackedBrevoEmail({
      to: adminEmail,
      subject: rendered.subject,
      htmlContent: rendered.htmlContent,
      textContent: rendered.textContent,
      templateKey: "SCHOOL_ADMIN_INVITE",
      schoolId: id,
      schoolName: school.name || undefined,
      actorId: String(gate.actor.userId),
      actorRole: "platform_admin",
      relatedEntityType: "school",
      relatedEntityId: id,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await Invitation.create({
      email: adminEmail,
      role: "school_admin",
      schoolId,
      status: "pending",
      clerkInvitationId: clerkInvitation.id,
      sentAt: new Date(),
      expiresAt,
      resendCount: 0,
      invitedBy: new mongoose.Types.ObjectId(String(gate.actor.userId)),
      metadata: {
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
      entityId: invitation._id,
      description: `Sent school admin invite: ${adminEmail}`,
      metadata: {
        email: adminEmail,
        role: "school_admin",
        source: "platform_school_detail",
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
      notes: "School admin invitation sent from platform school detail.",
    });

    return NextResponse.json({
      success: true,
      data: {
        invitationId: String(invitation._id),
        email: adminEmail,
        expiresAt: expiresAt.toISOString(),
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
