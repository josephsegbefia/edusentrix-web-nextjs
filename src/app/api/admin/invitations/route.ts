import { NextRequest } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import { School } from "@/models/School";
import { sendEmail } from "@/lib/email/brevo";
import { recordActivity } from "@/lib/audit/recordActivity";
import { getAppUrl, getInvitationRedirectUrl } from "@/lib/utils/getAppUrl";
import mongoose from "mongoose";

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.literal("bursar"),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  photoUrl: z.string().url().optional(),
});

type InvitationInvitedBy = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
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
    const { schoolId, userId } = await requireSchoolAdmin();
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

    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    const existingPending = await Invitation.findOne({
      schoolId: schoolIdObj,
      email: normalizedEmail,
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

    const APP_URL = getAppUrl();
    const redirectUrl = getInvitationRedirectUrl();
    let clerkInvitationId: string | undefined;
    let invitationStatus: "pending" | "failed" = "pending";
    let invitationError: string | null = null;

    try {
      const clerk = await clerkClient();
      const clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: normalizedEmail,
        redirectUrl,
        publicMetadata: {
          role: "bursar",
          schoolId: String(schoolIdObj),
        },
        ignoreExisting: true,
      });
      clerkInvitationId = clerkInvitation.id;

      const school = await School.findById(schoolIdObj)
        .select("name")
        .lean<{ name?: string } | null>();
      const schoolName = school?.name || "your school";
      const inviteeName =
        parsed.data.firstName && parsed.data.lastName
          ? `${parsed.data.firstName} ${parsed.data.lastName}`.trim()
          : normalizedEmail;

      await sendEmail(normalizedEmail, "USER_INVITE", {
        name: inviteeName,
        role: "bursar",
        schoolName,
        setupLink: `${APP_URL}/sign-in`,
      });
    } catch (inviteError: unknown) {
      console.error("Bursar invitation error:", inviteError);
      invitationStatus = "failed";
      invitationError =
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to create bursar invitation";
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
      invitedBy: new mongoose.Types.ObjectId(String(userId)),
      metadata: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        photoUrl: parsed.data.photoUrl,
      },
    });

    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(String(userId)),
      type: "invitation.sent",
      entityType: "invitation",
      entityId: String(created._id),
      description: `Invited bursar: ${normalizedEmail}`,
      metadata: {
        email: normalizedEmail,
        role: "bursar",
        status: invitationStatus,
      },
    });

    if (invitationStatus === "failed") {
      return new Response(
        JSON.stringify({
          success: false,
          error: invitationError || "Failed to create bursar invitation",
          invitationId: String(created._id),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return Response.json(
      {
        success: true,
        data: {
          _id: String(created._id),
          email: created.email,
          role: created.role,
          status: created.status,
          sentAt: created.sentAt.toISOString(),
          expiresAt: created.expiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("Failed to create invitation:", e);
    const message =
      e instanceof Error ? e.message : "Failed to create invitation";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
