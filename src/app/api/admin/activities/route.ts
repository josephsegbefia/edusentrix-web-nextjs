import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Activity } from "@/models/Activity";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

    const filter: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
    };

    if (type) {
      filter.type = type;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    const items = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("userId", "firstName lastName email")
      .lean();

    return Response.json({
      success: true,
      data: items.map((item) => ({
        _id: String(item._id),
        type: item.type,
        entityType: item.entityType,
        entityId: item.entityId ? String(item.entityId) : undefined,
        description: item.description,
        metadata: item.metadata,
        user: item.userId
          ? {
              _id: String((item.userId as any)._id),
              firstName: (item.userId as any).firstName,
              lastName: (item.userId as any).lastName,
              email: (item.userId as any).email,
            }
          : null,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (e: unknown) {
    console.error("Failed to fetch activities:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch activities";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
