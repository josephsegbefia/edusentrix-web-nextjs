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
  assignPendingBillingOwnerInvitation,
  bindBillingOwnerToSchool,
  releasePendingBillingOwnerInvitation,
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

    const internalTestSnapshot = await loadSchoolInternalTestSnapshot(schoolIdObj);
    const syntheticFlow = shouldUseSyntheticTestUserFlow(internalTestSnapshot);

    if (syntheticFlow && inviteMode === "owner_initial") {
      const pwd = getInternalTestDefaultPassword();
      if (!pwd) {
        return NextResponse.json(
          {
            success: false,
            error:
              "INTERNAL_TEST_DEFAULT_PASSWORD is not configured. Set it on the server to create synthetic billing owner accounts.",
            code: "INTERNAL_TEST_PASSWORD_NOT_CONFIGURED",
          },
          { status: 503 }
        );
      }

      const inviteEmail = await allocateSyntheticTestEmail(
        schoolIdObj,
        "billing_owner"
      );

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

      await assignPendingBillingOwnerInvitation({
        schoolId: access.schoolId,
        ownerEmail: inviteEmail,
        ownerName: parsed.data.ownerName,
        updatedBy: access.userId,
      });

      const ownerName = parsed.data.ownerName.trim();
      const nameParts = ownerName.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? ownerName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

      let ownerUserId: mongoose.Types.ObjectId | null = null;
      try {
        const ownerUser = await User.create({
          email: inviteEmail,
          firstName,
          lastName,
          role: "billing_owner",
          schoolId: schoolIdObj,
          isTestUser: true,
          testUserSource: "manual_test_school",
          pendingOnboarding: false,
        });
        ownerUserId =
          ownerUser._id instanceof mongoose.Types.ObjectId
            ? ownerUser._id
            : new mongoose.Types.ObjectId(String(ownerUser._id));

        await UserMembership.findOneAndUpdate(
          { userId: ownerUserId, schoolId: schoolIdObj },
          { $addToSet: { roles: "billing_owner" }, $set: { status: "active" } },
          { upsert: true }
        );

        const { clerkUserId } = await createSyntheticClerkAccount({
          email: inviteEmail,
          password: pwd,
          firstName,
          lastName,
          role: "billing_owner",
          schoolId: schoolIdObj,
        });

        await User.updateOne({ _id: ownerUserId }, { $set: { clerkUserId } });

        await bindBillingOwnerToSchool({
          schoolId: schoolIdObj,
          userId: ownerUserId,
          email: inviteEmail,
          name: parsed.data.ownerName,
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365);

        const created = await Invitation.create({
          email: inviteEmail,
          role: "billing_owner",
          schoolId: schoolIdObj,
          status: "accepted",
          sentAt: new Date(),
          acceptedAt: new Date(),
          expiresAt,
          resendCount: 0,
          invitedBy: new mongoose.Types.ObjectId(String(access.userId)),
          metadata: {
            firstName: parsed.data.ownerName,
            accessSurface: "payment_setup",
            paymentAuthorityMode: inviteMode,
            invitationEmailSuppressed: true,
            syntheticClerkUser: true,
          },
        });

        await recordInvitationEmailSuppressed({
          schoolId: schoolIdObj,
          actorId: new mongoose.Types.ObjectId(String(access.userId)),
          templateKey: "BILLING_OWNER_INVITE",
          targetEmail: inviteEmail,
        });

        await recordActivity({
          schoolId: schoolIdObj,
          userId: new mongoose.Types.ObjectId(String(access.userId)),
          type: "invitation.sent",
          entityType: "invitation",
          entityId: String(created._id),
          description: `Created synthetic billing owner: ${inviteEmail}`,
          metadata: {
            email: inviteEmail,
            role: "billing_owner",
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
          notes: "Synthetic billing owner created from payment setup (internal test).",
        });

        return NextResponse.json({
          success: true,
          data: {
            invitationId: String(created._id),
            email: inviteEmail,
            role: created.role,
            status: created.status,
            mode: inviteMode,
            expiresAt: created.expiresAt.toISOString(),
            warning: null,
            syntheticTestUser: true,
            userId: String(ownerUserId),
          },
        });
      } catch (syntheticErr) {
        console.error("Synthetic billing owner creation failed:", syntheticErr);
        if (ownerUserId) {
          try {
            await UserMembership.deleteMany({ userId: ownerUserId });
            await User.deleteOne({ _id: ownerUserId });
          } catch {
            /* ignore */
          }
        }
        await releasePendingBillingOwnerInvitation({
          schoolId: access.schoolId,
          ownerEmail: inviteEmail,
          updatedBy: access.userId,
        }).catch(() => undefined);
        return NextResponse.json(
          {
            success: false,
            error:
              syntheticErr instanceof Error
                ? syntheticErr.message
                : "Failed to create synthetic billing owner",
            code: "SYNTHETIC_BILLING_OWNER_FAILED",
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
          role: "billing_owner",
          schoolId: String(access.schoolId),
        },
        ignoreExisting: true,
      });
      clerkInvitationId = clerkInvitation.id;
    } catch (inviteError: unknown) {
      console.error("Billing owner invitation error:", inviteError);
      invitationStatus = "failed";
      invitationError =
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to create billing owner invitation";
    }

    if (invitationStatus === "pending") {
      try {
        const rendered = renderTemplate("USER_INVITE", {
          name: parsed.data.ownerName,
          role: "billing owner",
          schoolName: school.name || "your school",
          setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
        });

        await sendTrackedBrevoEmail({
          to: normalizedEmail,
          subject: rendered.subject,
          htmlContent: rendered.htmlContent,
          textContent: rendered.textContent,
          templateKey: "BILLING_OWNER_INVITE",
          schoolId: String(access.schoolId),
          schoolName: school.name || undefined,
          actorId: String(access.userId),
          actorRole: "school_admin",
          relatedEntityType: "invitation",
        });
      } catch (emailError: unknown) {
        console.error("Billing owner invite email error:", emailError);
        emailDeliveryWarning =
          emailError instanceof Error
            ? emailError.message
            : "Failed to send billing owner email";
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const created = await Invitation.create({
      email: normalizedEmail,
      role: "billing_owner",
      schoolId: schoolIdObj,
      status: invitationStatus,
      clerkInvitationId,
      sentAt: new Date(),
      expiresAt,
      resendCount: 0,
      invitedBy: new mongoose.Types.ObjectId(String(access.userId)),
      metadata: {
        firstName: parsed.data.ownerName,
        accessSurface: "payment_setup",
        paymentAuthorityMode: inviteMode,
      },
    });

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
      entityId: String(created._id),
      description:
        invitationStatus === "pending"
          ? `Invited billing owner: ${normalizedEmail}`
          : `Billing owner invitation failed: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "billing_owner",
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
        notes: "Billing owner invitation issued from payment setup.",
      });
    }

    if (invitationStatus === "failed") {
      return NextResponse.json(
        {
          success: false,
          error: invitationError || "Failed to create billing owner invitation",
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
        mode: inviteMode,
        expiresAt: created.expiresAt.toISOString(),
        warning: emailDeliveryWarning,
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
