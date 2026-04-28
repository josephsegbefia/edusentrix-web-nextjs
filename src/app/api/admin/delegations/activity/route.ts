import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity } from "@/models/Activity";

const DELEGATION_ACTIVITY_TYPES = [
  "delegation.created",
  "delegation.updated",
  "delegation.revoked",
  "delegation.expired",
  "delegation.migrated",
  "admissions.delegate.assigned",
  "admissions.delegate.revoked",
] as const;

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const schoolId = new mongoose.Types.ObjectId(String(ctx.schoolId));

    const rows = await Activity.find({
      schoolId,
      type: { $in: [...DELEGATION_ACTIVITY_TYPES] },
    })
      .sort({ createdAt: -1 })
      .limit(80)
      .populate("userId", "firstName lastName email")
      .lean();

    const data = rows.map((r) => {
      const uid = r.userId as unknown;
      const populated =
        uid &&
        typeof uid === "object" &&
        "_id" in (uid as Record<string, unknown>);
      const performedBy = populated
        ? {
            _id: String((uid as { _id: mongoose.Types.ObjectId })._id),
            firstName: (uid as { firstName?: string }).firstName,
            lastName: (uid as { lastName?: string }).lastName,
            email: (uid as { email?: string }).email ?? "",
          }
        : null;
      return {
        id: String(r._id),
        type: r.type,
        description: r.description,
        userId: performedBy?._id ?? String(r.userId),
        performedBy,
        entityType: r.entityType ?? null,
        entityId: r.entityId ? String(r.entityId) : null,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json(
      { success: false, error: "Failed to load delegation activity" },
      { status: 500 }
    );
  }
}
