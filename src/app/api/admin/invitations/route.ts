import { NextRequest } from "next/server";
import { z } from "zod";
import { optionalPhotoUrlSchema } from "@/schemas/photoUrl";
import { resolvePersistedPhotoUrl } from "@/lib/storage/resolve-photo-url";
import { StorageValidationError } from "@/lib/storage/types";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import { recordActivity } from "@/lib/audit/recordActivity";
import { delegationAuditFields } from "@/lib/audit/delegationAuditFields";
import { issueInvitation } from "@/lib/invitations/issue-invitation";
import mongoose from "mongoose";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import {
  requireSchoolWriteAccess,
  SchoolWriteAccessError,
} from "@/lib/billing/require-school-write-access";
import { trackUsage } from "@/lib/billing/trackUsage";

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.literal("bursar"),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  photoUrl: optionalPhotoUrlSchema,
});

type InvitationInvitedBy = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("invitations");
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as
      | "pending"
      | "accepted"
      | "expired"
      | "revoked"
      | "failed"
      | null;
    const role = searchParams.get("role") as
      | "teacher"
      | "staff"
      | "school_admin"
      | "billing_owner"
      | "parent"
      | "bursar"
      | null;
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    if (!schoolId) {
      throw new Error("Missing schoolId for invitation lookup");
    }

    const filter: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    };

    if (status) {
      filter.status = status;
    }

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Invitation.find(filter)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("invitedBy", "firstName lastName email")
        .lean(),
      Invitation.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: items.map((item) => {
        const invitedBy = item.invitedBy as InvitationInvitedBy | null;
        return {
          _id: String(item._id),
          email: item.email,
          role: item.role,
          status: item.status,
          clerkInvitationId: item.clerkInvitationId,
          sentAt: item.sentAt.toISOString(),
          expiresAt: item.expiresAt.toISOString(),
          acceptedAt: item.acceptedAt?.toISOString(),
          revokedAt: item.revokedAt?.toISOString(),
          resendCount: item.resendCount,
          lastResentAt: item.lastResentAt?.toISOString(),
          invitedBy: invitedBy
            ? {
                _id: String(invitedBy._id),
                firstName: invitedBy.firstName,
                lastName: invitedBy.lastName,
                email: invitedBy.email,
              }
            : null,
          metadata: item.metadata,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: unknown) {
    console.error("Failed to fetch invitations:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch invitations";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await requireSchoolAdminOrDelegatedModuleView("invitations");
    const { schoolId, userId } = authCtx;
    await requireSchoolWriteAccess({ schoolId, action: "invitations.create" });
    await enforceSchoolLimit({
      schoolId,
      limitKey: "maxInvitationsPerMonth",
      message: "The monthly invitation limit has been reached for this subscription.",
    });
    await connectToDatabase();

    if (!schoolId) {
      return new Response(
        JSON.stringify({ success: false, error: "School ID not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const parsed = createInvitationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid request payload",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const photoUrl = await resolvePersistedPhotoUrl({
      schoolId: schoolIdObj,
      photoUrl: parsed.data.photoUrl,
    });
    const effectiveEmail = parsed.data.email.toLowerCase().trim();

    const existingPending = await Invitation.findOne({
      schoolId: schoolIdObj,
      email: effectiveEmail,
      role: "bursar",
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();

    if (existingPending) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "A pending bursar invitation already exists for this email. Use resend instead.",
          invitationId: String(existingPending._id),
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const school = await School.findById(schoolIdObj)
      .select("name")
      .lean<{ name?: string } | null>();
    const schoolName = school?.name || "your school";
    const inviteeName =
      parsed.data.firstName && parsed.data.lastName
        ? `${parsed.data.firstName} ${parsed.data.lastName}`.trim()
        : effectiveEmail;

    const issued = await issueInvitation({
      email: effectiveEmail,
      role: "bursar",
      schoolId: schoolIdObj,
      invitedBy: userId,
      recipientName: inviteeName,
      schoolName,
      actorRole: "school_admin",
      relatedEntityType: "invitation",
      invitationMetadata: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        photoUrl,
      },
    });

    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(String(userId)),
      type: "invitation.sent",
      entityType: "invitation",
      entityId: issued.invitationId,
      description: `Invited bursar: ${effectiveEmail}`,
      ...delegationAuditFields({
        isDelegatedActor: !authCtx.isSchoolAdmin,
        activeDelegationId: authCtx.activeDelegationId,
        module: "invitations",
        action: "invitation.sent",
      }),
      metadata: {
        email: effectiveEmail,
        role: "bursar",
        status: issued.invitationStatus,
        emailStatus: issued.emailStatus,
        deliveryCode: issued.deliveryCode,
      },
    });
    await trackUsage({
      schoolId,
      provider: "internal",
      metricKey: "invitations_sent",
      quantity: 1,
      unitLabel: "invites",
      allocationMethod: "manual",
      sourceType: "manual",
      notes: "Bursar invitation issued.",
    });

    if (issued.invitationStatus === "failed") {
      return new Response(
        JSON.stringify({
          success: false,
          error: issued.warning || "Failed to create bursar invitation",
          invitationId: issued.invitationId,
          emailStatus: issued.emailStatus,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (issued.emailStatus === "sent") {
      await trackUsage({
        schoolId,
        provider: "email",
        metricKey: "transactional_emails_sent",
        quantity: 1,
        unitLabel: "emails",
        allocationMethod: "direct",
        sourceType: "manual",
        notes: "Bursar invitation email sent.",
      });
    }

    const created = await Invitation.findById(issued.invitationId);
    return Response.json(
      {
        success: true,
        data: {
          _id: issued.invitationId,
          email: effectiveEmail,
          role: "bursar",
          status: issued.invitationStatus,
          emailStatus: issued.emailStatus,
          deliveryCode: issued.deliveryCode,
          warning: issued.warning,
          sentAt: created?.sentAt?.toISOString(),
          expiresAt: created?.expiresAt?.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    if (e instanceof StorageValidationError) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (e instanceof SchoolWriteAccessError) {
      return Response.json(
        { success: false, error: e.message, accessMode: e.accessMode },
        { status: e.statusCode }
      );
    }
    console.error("Failed to create invitation:", e);
    const message =
      e instanceof Error ? e.message : "Failed to create invitation";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
