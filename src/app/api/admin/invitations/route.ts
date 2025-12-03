import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
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
      | null;
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

    const filter: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
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
      data: items.map((item) => ({
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
        invitedBy: item.invitedBy
          ? {
              _id: String((item.invitedBy as any)._id),
              firstName: (item.invitedBy as any).firstName,
              lastName: (item.invitedBy as any).lastName,
              email: (item.invitedBy as any).email,
            }
          : null,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
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
