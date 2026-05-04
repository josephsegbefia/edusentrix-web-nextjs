import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { requirePaymentSetupAccess } from "@/lib/auth/requirePaymentSetupAccess";
import { trackUsage } from "@/lib/billing/trackUsage";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { recordActivity } from "@/lib/audit/recordActivity";
import {
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
import {
  assignPendingPaymentSetupDelegate,
  bindPaymentSetupDelegateToSchool,
  releasePendingPaymentSetupDelegate,
} from "@/lib/school-payments/billing-owner-lifecycle";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { allocateSyntheticTestEmail } from "@/lib/internal-test/allocate-synthetic-test-email";
import { createSyntheticClerkAccount } from "@/lib/internal-test/create-synthetic-clerk-account";
import { getInternalTestDefaultPassword } from "@/lib/internal-test/env";
import { loadSchoolInternalTestSnapshot } from "@/lib/internal-test/load-internal-test-context";
import { recordInvitationEmailSuppressed } from "@/lib/internal-test/record-invitation-suppressed";
import { shouldUseSyntheticTestUserFlow } from "@/lib/internal-test/synthetic-test-user-flow";

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

    const internalTestSnapshot = await loadSchoolInternalTestSnapshot(schoolIdObj);
    const syntheticFlow = shouldUseSyntheticTestUserFlow(internalTestSnapshot);

    if (syntheticFlow) {
      const pwd = getInternalTestDefaultPassword();
      if (!pwd) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INTERNAL_TEST_DEFAULT_PASSWORD is not configured. Set it on the server to create synthetic finance delegate accounts.",
            code: "INTERNAL_TEST_PASSWORD_NOT_CONFIGURED",
          },
          { status: 503 }
        );
      }

      const inviteEmail = await allocateSyntheticTestEmail(schoolIdObj, "bursar");
      const inviteeName = parsed.data.delegateName.trim();

      const dupUser = await User.findOne({
        schoolId: schoolIdObj,
        email: inviteEmail,
      })
        .select("_id")
        .lean();
      if (dupUser) {
        return NextResponse.json(
          {
            success: false,
            error: "A user with this synthetic email already exists for this school.",
          },
          { status: 409 }
        );
      }

      await assignPendingPaymentSetupDelegate({
        schoolId: access.schoolId,
        delegateEmail: inviteEmail,
        delegateName: inviteeName,
        updatedBy: access.userId,
      });

      const nameParts = inviteeName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? inviteeName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

      let delegateUserId: mongoose.Types.ObjectId | null = null;
      try {
        const delegateUser = await User.create({
          email: inviteEmail,
          firstName,
          lastName,
          role: "bursar",
          schoolId: schoolIdObj,
          isTestUser: true,
          testUserSource: "manual_test_school",
          pendingOnboarding: false,
        });
        delegateUserId =
          delegateUser._id instanceof mongoose.Types.ObjectId
            ? delegateUser._id
            : new mongoose.Types.ObjectId(String(delegateUser._id));

        await UserMembership.findOneAndUpdate(
          { userId: delegateUserId, schoolId: schoolIdObj },
          { $addToSet: { roles: "bursar" }, $set: { status: "active" } },
          { upsert: true }
        );

        const { clerkUserId } = await createSyntheticClerkAccount({
          email: inviteEmail,
          password: pwd,
          firstName,
          lastName,
          role: "bursar",
          schoolId: schoolIdObj,
        });

        await User.updateOne({ _id: delegateUserId }, { $set: { clerkUserId } });

        await bindPaymentSetupDelegateToSchool({
          schoolId: schoolIdObj,
          userId: delegateUserId,
          email: inviteEmail,
          name: inviteeName,
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);

        const created = await Invitation.create({
          email: inviteEmail,
          role: "bursar",
          schoolId: schoolIdObj,
          status: "accepted",
          sentAt: new Date(),
          acceptedAt: new Date(),
          expiresAt,
          resendCount: 0,
          invitedBy: new mongoose.Types.ObjectId(String(access.userId)),
          metadata: {
            firstName: parsed.data.delegateName,
            accessSurface: "payment_setup_delegate",
            invitationEmailSuppressed: true,
            syntheticClerkUser: true,
          },
        });

        await recordInvitationEmailSuppressed({
          schoolId: schoolIdObj,
          actorId: new mongoose.Types.ObjectId(String(access.userId)),
          templateKey: "BURSAR_INVITE",
          targetEmail: inviteEmail,
        });

        await recordActivity({
          schoolId: schoolIdObj,
          userId: new mongoose.Types.ObjectId(String(access.userId)),
          type: "invitation.sent",
          entityType: "invitation",
          entityId: String(created._id),
          description: `Created synthetic finance delegate: ${inviteEmail}`,
          metadata: {
            email: inviteEmail,
            role: "bursar",
            accessSurface: "payment_setup_delegate",
            status: "accepted",
            syntheticTestUser: true,
          },
        });

        await trackUsage({
          schoolId: access.schoolId,
          provider: "internal",
          metricKey: "invitations_sent",
          quantity: 1,
          unitLabel: "invites",
          allocationMethod: "manual",
          sourceType: "manual",
          notes: "Synthetic finance delegate created from payment setup.",
        });

        return NextResponse.json({
          success: true,
          data: {
            invitationId: String(created._id),
            email: inviteEmail,
            role: created.role,
            status: created.status,
            expiresAt: created.expiresAt.toISOString(),
            warning: null,
            syntheticTestUser: true,
            userId: String(delegateUserId),
          },
        });
      } catch (syntheticErr) {
        console.error("Synthetic finance delegate creation failed:", syntheticErr);
        if (delegateUserId) {
          try {
            await UserMembership.deleteMany({ userId: delegateUserId });
            await User.deleteOne({ _id: delegateUserId });
          } catch {
            /* ignore */
          }
        }
        await releasePendingPaymentSetupDelegate({
          schoolId: access.schoolId,
          delegateEmail: inviteEmail,
          updatedBy: access.userId,
        }).catch(() => undefined);
        return NextResponse.json(
          {
            success: false,
            error:
              syntheticErr instanceof Error
                ? syntheticErr.message
                : "Failed to create synthetic finance delegate",
            code: "SYNTHETIC_DELEGATE_FAILED",
          },
          { status: 502 }
        );
      }
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
          role: "bursar",
          schoolId: String(access.schoolId),
        },
        ignoreExisting: true,
      });
      clerkInvitationId = clerkInvitation.id;
    } catch (inviteError: unknown) {
      console.error("Finance delegate invitation error:", inviteError);
      invitationStatus = "failed";
      invitationError =
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to create finance delegate invitation";
    }

    if (invitationStatus === "pending") {
      try {
        const rendered = renderTemplate("USER_INVITE", {
          name: parsed.data.delegateName,
          role: "finance delegate",
          schoolName: school.name || "your school",
          setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
        });

        await sendTrackedBrevoEmail({
          to: normalizedEmail,
          subject: rendered.subject,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent,
          templateKey: "BURSAR_INVITE",
          schoolId: String(access.schoolId),
          schoolName: school.name || undefined,
          actorId: String(access.userId),
          actorRole: "school_admin",
          relatedEntityType: "invitation",
        });
      } catch (emailError: unknown) {
        console.error("Finance delegate invite email error:", emailError);
        emailDeliveryWarning =
          emailError instanceof Error
            ? emailError.message
            : "Failed to send finance delegate email";
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const created = await Invitation.create({
      email: normalizedEmail,
      role: "bursar",
      schoolId: schoolIdObj,
      status: invitationStatus,
      clerkInvitationId,
      sentAt: new Date(),
      expiresAt,
      resendCount: 0,
      invitedBy: new mongoose.Types.ObjectId(String(access.userId)),
      metadata: {
        firstName: parsed.data.delegateName,
        accessSurface: "payment_setup_delegate",
      },
    });

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
      entityId: String(created._id),
      description:
        invitationStatus === "pending"
          ? `Invited finance delegate: ${normalizedEmail}`
          : `Finance delegate invitation failed: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "bursar",
        accessSurface: "payment_setup_delegate",
        status: invitationStatus,
        emailDeliveryWarning,
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
        expiresAt: created.expiresAt.toISOString(),
        warning: emailDeliveryWarning,
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
